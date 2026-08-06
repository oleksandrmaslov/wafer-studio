// Copyright 2026 Oleksandr Maslov
// SPDX-License-Identifier: Apache-2.0

import {
  Request,
  Response,
  type Notification,
  type RequestResponse,
} from "@zmkfirmware/zmk-studio-ts-client";
import type { GetBehaviorDetailsResponse } from "@zmkfirmware/zmk-studio-ts-client/behaviors";
import { LockState } from "@zmkfirmware/zmk-studio-ts-client/core";
import {
  AddLayerErrorCode,
  MoveLayerErrorCode,
  RemoveLayerErrorCode,
  RestoreLayerErrorCode,
  SetActivePhysicalLayoutErrorCode,
  SetLayerBindingResponse,
  SetLayerPropsResponse,
  type BehaviorBinding,
  type Keymap,
  type Layer,
} from "@zmkfirmware/zmk-studio-ts-client/keymap";
import { ErrorConditions } from "@zmkfirmware/zmk-studio-ts-client/meta";
import type { RpcTransport } from "@zmkfirmware/zmk-studio-ts-client/transport/index";
import { createWaferMockFixture, type MockDeviceFixture } from "./mockFixtures";

const FRAMING_SOF = 0xab;
const FRAMING_ESC = 0xac;
const FRAMING_EOF = 0xad;

type RpcReply = {
  response: Omit<RequestResponse, "requestId">;
  notifications?: Notification[];
};

export interface MockRpcTranscriptEntry {
  request: Request;
  response: RequestResponse;
  notifications: Notification[];
}

export interface MockRpcDeviceSnapshot {
  lockState: LockState;
  unsaved: boolean;
  activePhysicalLayoutIndex: number;
  savedActivePhysicalLayoutIndex: number;
  keymap: Keymap;
  savedKeymap: Keymap;
}

export interface MockRpcTransportOptions {
  fixture?: MockDeviceFixture;
  label?: string;
  /**
   * Maximum size of each response byte chunk. A deliberately small default
   * exercises framing across the same fragmented reads produced by serial and
   * BLE transports.
   */
  responseChunkSize?: number;
}

export interface ReplayRpcStep {
  request: Omit<Request, "requestId">;
  response: Omit<RequestResponse, "requestId">;
  notifications?: Notification[];
}

export interface ReplayRpcTransportOptions {
  label?: string;
  responseChunkSize?: number;
}

enum DecoderState {
  Idle,
  Reading,
  Escaped,
}

function clone<T>(value: T): T {
  if (value instanceof Uint8Array) {
    return new Uint8Array(value) as T;
  }

  if (Array.isArray(value)) {
    return value.map((item) => clone(item)) as T;
  }

  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, clone(item)]),
    ) as T;
  }

  return value;
}

function cloneLayer(layer: Layer): Layer {
  return clone(layer);
}

function cloneKeymap(keymap: Keymap): Keymap {
  return clone(keymap);
}

function cloneLayerArchive(source: Map<number, Layer>): Map<number, Layer> {
  return new Map(
    Array.from(source.entries(), ([id, layer]) => [id, cloneLayer(layer)]),
  );
}

function frame(payload: Uint8Array): Uint8Array {
  const bytes: number[] = [FRAMING_SOF];
  for (const byte of payload) {
    if (byte === FRAMING_SOF || byte === FRAMING_ESC || byte === FRAMING_EOF) {
      bytes.push(FRAMING_ESC);
    }
    bytes.push(byte);
  }
  bytes.push(FRAMING_EOF);
  return new Uint8Array(bytes);
}

abstract class FramedRpcTransport implements RpcTransport {
  readonly label: string;
  readonly abortController = new AbortController();
  readonly readable: ReadableStream<Uint8Array>;
  readonly writable: WritableStream<Uint8Array>;

  private readonly responseChunkSize: number;
  private readonly transcriptEntries: MockRpcTranscriptEntry[] = [];
  private responseController: ReadableStreamDefaultController<Uint8Array> | null =
    null;
  private decoderState = DecoderState.Idle;
  private requestBytes: number[] = [];
  private closed = false;

  protected constructor(label: string, responseChunkSize = 17) {
    this.label = label;
    this.responseChunkSize = Math.max(1, Math.floor(responseChunkSize));

    this.readable = new ReadableStream<Uint8Array>({
      start: (controller) => {
        this.responseController = controller;
      },
      cancel: () => {
        this.closed = true;
      },
    });

    this.writable = new WritableStream<Uint8Array>({
      write: (chunk) => this.consume(chunk),
      close: () => this.shutdown(),
      abort: (reason) => this.shutdown(reason),
    });

    this.abortController.signal.addEventListener(
      "abort",
      () => this.shutdown(),
      { once: true },
    );
  }

  get transcript(): readonly MockRpcTranscriptEntry[] {
    return clone(this.transcriptEntries);
  }

  protected abstract respond(request: Request): RpcReply;

  private consume(chunk: Uint8Array) {
    if (this.closed) {
      throw new Error("Cannot write to a closed mock RPC transport");
    }
    if (!(chunk instanceof Uint8Array)) {
      throw new TypeError("Mock RPC transport accepts Uint8Array chunks only");
    }

    try {
      for (const byte of chunk) {
        this.consumeByte(byte);
      }
    } catch (error) {
      this.shutdown(error);
      throw error;
    }
  }

  private consumeByte(byte: number) {
    switch (this.decoderState) {
      case DecoderState.Idle:
        if (byte !== FRAMING_SOF) {
          throw new Error("Mock RPC framing error: expected start-of-frame");
        }
        this.requestBytes = [];
        this.decoderState = DecoderState.Reading;
        return;

      case DecoderState.Reading:
        if (byte === FRAMING_SOF) {
          throw new Error("Mock RPC framing error: unexpected start-of-frame");
        }
        if (byte === FRAMING_ESC) {
          this.decoderState = DecoderState.Escaped;
          return;
        }
        if (byte === FRAMING_EOF) {
          const payload = new Uint8Array(this.requestBytes);
          this.requestBytes = [];
          this.decoderState = DecoderState.Idle;
          this.handleFrame(payload);
          return;
        }
        this.requestBytes.push(byte);
        return;

      case DecoderState.Escaped:
        this.requestBytes.push(byte);
        this.decoderState = DecoderState.Reading;
        return;
    }
  }

  private handleFrame(payload: Uint8Array) {
    const request = Request.decode(payload);
    const reply = this.respond(request);
    const response: RequestResponse = {
      ...clone(reply.response),
      requestId: request.requestId,
    };
    const notifications = clone(reply.notifications ?? []);

    this.transcriptEntries.push({
      request: clone(request),
      response: clone(response),
      notifications,
    });

    this.enqueue({ requestResponse: response });
    for (const notification of notifications) {
      this.enqueue({ notification });
    }
  }

  private enqueue(response: Response) {
    if (this.closed || !this.responseController) {
      throw new Error("Mock RPC response stream is closed");
    }

    const encoded = frame(Response.encode(response).finish());
    for (
      let offset = 0;
      offset < encoded.length;
      offset += this.responseChunkSize
    ) {
      this.responseController.enqueue(
        encoded.slice(offset, offset + this.responseChunkSize),
      );
    }
  }

  private shutdown(reason?: unknown) {
    if (this.closed) {
      return;
    }
    this.closed = true;

    if (!this.responseController) {
      return;
    }

    try {
      if (reason === undefined) {
        this.responseController.close();
      } else {
        this.responseController.error(reason);
      }
    } catch {
      // The consumer may already have cancelled the stream.
    }
  }
}

export class MockRpcTransport extends FramedRpcTransport {
  private readonly fixture: MockDeviceFixture;
  private readonly stockKeymap: Keymap;
  private readonly stockActivePhysicalLayoutIndex: number;

  private lockState = LockState.ZMK_STUDIO_CORE_LOCK_STATE_UNLOCKED;
  private keymap: Keymap;
  private savedKeymap: Keymap;
  private activePhysicalLayoutIndex: number;
  private savedActivePhysicalLayoutIndex: number;
  private unsaved = false;
  private removedLayers = new Map<number, Layer>();
  private savedRemovedLayers = new Map<number, Layer>();
  private nextLayerId: number;
  private savedNextLayerId: number;

  constructor(options: MockRpcTransportOptions = {}) {
    const fixture = clone(options.fixture ?? createWaferMockFixture());
    super(options.label ?? fixture.label, options.responseChunkSize);

    this.fixture = fixture;
    this.stockKeymap = cloneKeymap(fixture.keymap);
    this.stockActivePhysicalLayoutIndex = fixture.activePhysicalLayoutIndex;
    this.keymap = cloneKeymap(fixture.keymap);
    this.savedKeymap = cloneKeymap(fixture.keymap);
    this.activePhysicalLayoutIndex = fixture.activePhysicalLayoutIndex;
    this.savedActivePhysicalLayoutIndex = fixture.activePhysicalLayoutIndex;
    this.nextLayerId = this.findNextLayerId();
    this.savedNextLayerId = this.nextLayerId;
  }

  snapshot(): MockRpcDeviceSnapshot {
    return {
      lockState: this.lockState,
      unsaved: this.unsaved,
      activePhysicalLayoutIndex: this.activePhysicalLayoutIndex,
      savedActivePhysicalLayoutIndex: this.savedActivePhysicalLayoutIndex,
      keymap: cloneKeymap(this.keymap),
      savedKeymap: cloneKeymap(this.savedKeymap),
    };
  }

  protected respond(request: Request): RpcReply {
    if (request.core) {
      return this.respondToCore(request.core);
    }
    if (request.behaviors) {
      return this.respondToBehaviors(request.behaviors);
    }
    if (request.keymap) {
      return this.respondToKeymap(request.keymap);
    }

    return this.rpcNotFound();
  }

  private respondToCore(request: NonNullable<Request["core"]>): RpcReply {
    if (request.getDeviceInfo === true) {
      return {
        response: { core: { getDeviceInfo: clone(this.fixture.deviceInfo) } },
      };
    }

    if (request.getLockState === true) {
      return { response: { core: { getLockState: this.lockState } } };
    }

    if (request.lock === true) {
      const notifications: Notification[] = [];
      if (this.lockState !== LockState.ZMK_STUDIO_CORE_LOCK_STATE_LOCKED) {
        this.lockState = LockState.ZMK_STUDIO_CORE_LOCK_STATE_LOCKED;
        notifications.push({ core: { lockStateChanged: this.lockState } });
      }
      return { response: { core: {} }, notifications };
    }

    if (request.resetSettings === true) {
      const notifications: Notification[] = [];
      this.setUnsaved(false, notifications);
      this.keymap = cloneKeymap(this.stockKeymap);
      this.savedKeymap = cloneKeymap(this.stockKeymap);
      this.activePhysicalLayoutIndex = this.stockActivePhysicalLayoutIndex;
      this.savedActivePhysicalLayoutIndex = this.stockActivePhysicalLayoutIndex;
      this.removedLayers.clear();
      this.savedRemovedLayers.clear();
      this.nextLayerId = this.findNextLayerId();
      this.savedNextLayerId = this.nextLayerId;
      return { response: { core: { resetSettings: true } }, notifications };
    }

    return this.rpcNotFound();
  }

  private respondToBehaviors(
    request: NonNullable<Request["behaviors"]>,
  ): RpcReply {
    if (request.listAllBehaviors === true) {
      return {
        response: {
          behaviors: {
            listAllBehaviors: {
              behaviors: this.fixture.behaviors.map(({ id }) => id),
            },
          },
        },
      };
    }

    if (request.getBehaviorDetails) {
      const behavior = this.fixture.behaviors.find(
        ({ id }) => id === request.getBehaviorDetails?.behaviorId,
      );
      if (!behavior) {
        return this.rpcNotFound();
      }
      return {
        response: {
          behaviors: { getBehaviorDetails: clone(behavior) },
        },
      };
    }

    return this.rpcNotFound();
  }

  private respondToKeymap(request: NonNullable<Request["keymap"]>): RpcReply {
    if (request.getKeymap === true) {
      return { response: { keymap: { getKeymap: cloneKeymap(this.keymap) } } };
    }

    if (request.setLayerBinding) {
      return this.setLayerBinding(request.setLayerBinding);
    }

    if (request.checkUnsavedChanges === true) {
      return {
        response: { keymap: { checkUnsavedChanges: this.unsaved } },
      };
    }

    if (request.saveChanges === true) {
      const notifications: Notification[] = [];
      this.savedKeymap = cloneKeymap(this.keymap);
      this.savedActivePhysicalLayoutIndex = this.activePhysicalLayoutIndex;
      this.savedRemovedLayers = cloneLayerArchive(this.removedLayers);
      this.savedNextLayerId = this.nextLayerId;
      this.setUnsaved(false, notifications);
      return {
        response: { keymap: { saveChanges: { ok: true } } },
        notifications,
      };
    }

    if (request.discardChanges === true) {
      const notifications: Notification[] = [];
      this.keymap = cloneKeymap(this.savedKeymap);
      this.activePhysicalLayoutIndex = this.savedActivePhysicalLayoutIndex;
      this.removedLayers = cloneLayerArchive(this.savedRemovedLayers);
      this.nextLayerId = this.savedNextLayerId;
      this.setUnsaved(false, notifications);
      return {
        response: { keymap: { discardChanges: true } },
        notifications,
      };
    }

    if (request.getPhysicalLayouts === true) {
      return {
        response: {
          keymap: {
            getPhysicalLayouts: {
              activeLayoutIndex: this.activePhysicalLayoutIndex,
              layouts: clone(this.fixture.physicalLayouts),
            },
          },
        },
      };
    }

    if (request.setActivePhysicalLayout !== undefined) {
      const layoutIndex = request.setActivePhysicalLayout;
      if (
        layoutIndex < 0 ||
        layoutIndex >= this.fixture.physicalLayouts.length
      ) {
        return {
          response: {
            keymap: {
              setActivePhysicalLayout: {
                err: SetActivePhysicalLayoutErrorCode.SET_ACTIVE_PHYSICAL_LAYOUT_ERR_INVALID_LAYOUT_INDEX,
              },
            },
          },
        };
      }

      const notifications: Notification[] = [];
      if (layoutIndex !== this.activePhysicalLayoutIndex) {
        this.activePhysicalLayoutIndex = layoutIndex;
        this.setUnsaved(true, notifications);
      }
      return {
        response: {
          keymap: {
            setActivePhysicalLayout: { ok: cloneKeymap(this.keymap) },
          },
        },
        notifications,
      };
    }

    if (request.moveLayer) {
      return this.moveLayer(
        request.moveLayer.startIndex,
        request.moveLayer.destIndex,
      );
    }

    if (request.addLayer) {
      return this.addLayer();
    }

    if (request.removeLayer) {
      return this.removeLayer(request.removeLayer.layerIndex);
    }

    if (request.restoreLayer) {
      return this.restoreLayer(
        request.restoreLayer.layerId,
        request.restoreLayer.atIndex,
      );
    }

    if (request.setLayerProps) {
      return this.setLayerProps(
        request.setLayerProps.layerId,
        request.setLayerProps.name,
      );
    }

    return this.rpcNotFound();
  }

  private setLayerBinding(
    request: NonNullable<NonNullable<Request["keymap"]>["setLayerBinding"]>,
  ): RpcReply {
    const layer = this.keymap.layers.find(({ id }) => id === request.layerId);
    if (
      !layer ||
      request.keyPosition < 0 ||
      request.keyPosition >= layer.bindings.length
    ) {
      return {
        response: {
          keymap: {
            setLayerBinding:
              SetLayerBindingResponse.SET_LAYER_BINDING_RESP_INVALID_LOCATION,
          },
        },
      };
    }

    if (!request.binding) {
      return {
        response: {
          keymap: {
            setLayerBinding:
              SetLayerBindingResponse.SET_LAYER_BINDING_RESP_INVALID_PARAMETERS,
          },
        },
      };
    }

    const behavior = this.fixture.behaviors.find(
      ({ id }) => id === request.binding?.behaviorId,
    );
    if (!behavior) {
      return {
        response: {
          keymap: {
            setLayerBinding:
              SetLayerBindingResponse.SET_LAYER_BINDING_RESP_INVALID_BEHAVIOR,
          },
        },
      };
    }

    if (!this.validateBinding(request.binding, behavior)) {
      return {
        response: {
          keymap: {
            setLayerBinding:
              SetLayerBindingResponse.SET_LAYER_BINDING_RESP_INVALID_PARAMETERS,
          },
        },
      };
    }

    const notifications: Notification[] = [];
    const oldBinding = layer.bindings[request.keyPosition];
    if (
      oldBinding.behaviorId !== request.binding.behaviorId ||
      oldBinding.param1 !== request.binding.param1 ||
      oldBinding.param2 !== request.binding.param2
    ) {
      layer.bindings[request.keyPosition] = clone(request.binding);
      this.setUnsaved(true, notifications);
    }

    return {
      response: {
        keymap: {
          setLayerBinding: SetLayerBindingResponse.SET_LAYER_BINDING_RESP_OK,
        },
      },
      notifications,
    };
  }

  private moveLayer(startIndex: number, destIndex: number): RpcReply {
    if (startIndex < 0 || startIndex >= this.keymap.layers.length) {
      return {
        response: {
          keymap: {
            moveLayer: { err: MoveLayerErrorCode.MOVE_LAYER_ERR_INVALID_LAYER },
          },
        },
      };
    }
    if (destIndex < 0 || destIndex >= this.keymap.layers.length) {
      return {
        response: {
          keymap: {
            moveLayer: {
              err: MoveLayerErrorCode.MOVE_LAYER_ERR_INVALID_DESTINATION,
            },
          },
        },
      };
    }

    const notifications: Notification[] = [];
    if (startIndex !== destIndex) {
      const [layer] = this.keymap.layers.splice(startIndex, 1);
      this.keymap.layers.splice(destIndex, 0, layer);
      this.setUnsaved(true, notifications);
    }
    return {
      response: { keymap: { moveLayer: { ok: cloneKeymap(this.keymap) } } },
      notifications,
    };
  }

  private addLayer(): RpcReply {
    if (this.keymap.availableLayers <= 0) {
      return {
        response: {
          keymap: {
            addLayer: { err: AddLayerErrorCode.ADD_LAYER_ERR_NO_SPACE },
          },
        },
      };
    }

    const keyCount =
      this.keymap.layers[0]?.bindings.length ??
      this.fixture.physicalLayouts[this.activePhysicalLayoutIndex]?.keys
        .length ??
      0;
    const id = this.nextLayerId;
    this.nextLayerId += 1;
    const layer: Layer = {
      id,
      name: `Layer ${id + 1}`,
      bindings: Array.from({ length: keyCount }, () => ({
        behaviorId: this.transparentBehaviorId(),
        param1: 0,
        param2: 0,
      })),
    };
    const index = this.keymap.layers.length;
    this.keymap.layers.push(layer);
    this.keymap.availableLayers -= 1;

    const notifications: Notification[] = [];
    this.setUnsaved(true, notifications);
    return {
      response: {
        keymap: {
          addLayer: { ok: { index, layer: cloneLayer(layer) } },
        },
      },
      notifications,
    };
  }

  private removeLayer(layerIndex: number): RpcReply {
    if (
      layerIndex < 0 ||
      layerIndex >= this.keymap.layers.length ||
      this.keymap.layers.length <= 1
    ) {
      return {
        response: {
          keymap: {
            removeLayer: {
              err: RemoveLayerErrorCode.REMOVE_LAYER_ERR_INVALID_INDEX,
            },
          },
        },
      };
    }

    const [removed] = this.keymap.layers.splice(layerIndex, 1);
    this.removedLayers.set(removed.id, cloneLayer(removed));
    this.keymap.availableLayers += 1;
    const notifications: Notification[] = [];
    this.setUnsaved(true, notifications);
    return {
      response: { keymap: { removeLayer: { ok: {} } } },
      notifications,
    };
  }

  private restoreLayer(layerId: number, atIndex: number): RpcReply {
    const layer = this.removedLayers.get(layerId);
    if (!layer || this.keymap.layers.some(({ id }) => id === layerId)) {
      return {
        response: {
          keymap: {
            restoreLayer: {
              err: RestoreLayerErrorCode.RESTORE_LAYER_ERR_INVALID_ID,
            },
          },
        },
      };
    }
    if (atIndex < 0 || atIndex > this.keymap.layers.length) {
      return {
        response: {
          keymap: {
            restoreLayer: {
              err: RestoreLayerErrorCode.RESTORE_LAYER_ERR_INVALID_INDEX,
            },
          },
        },
      };
    }

    const restored = cloneLayer(layer);
    this.keymap.layers.splice(atIndex, 0, restored);
    this.removedLayers.delete(layerId);
    this.keymap.availableLayers = Math.max(0, this.keymap.availableLayers - 1);
    const notifications: Notification[] = [];
    this.setUnsaved(true, notifications);
    return {
      response: { keymap: { restoreLayer: { ok: cloneLayer(restored) } } },
      notifications,
    };
  }

  private setLayerProps(layerId: number, name: string): RpcReply {
    const layer = this.keymap.layers.find(({ id }) => id === layerId);
    if (!layer) {
      return {
        response: {
          keymap: {
            setLayerProps:
              SetLayerPropsResponse.SET_LAYER_PROPS_RESP_ERR_INVALID_ID,
          },
        },
      };
    }
    if (name.length > this.keymap.maxLayerNameLength) {
      return {
        response: {
          keymap: {
            setLayerProps:
              SetLayerPropsResponse.SET_LAYER_PROPS_RESP_ERR_GENERIC,
          },
        },
      };
    }

    const notifications: Notification[] = [];
    if (layer.name !== name) {
      layer.name = name;
      this.setUnsaved(true, notifications);
    }
    return {
      response: {
        keymap: {
          setLayerProps: SetLayerPropsResponse.SET_LAYER_PROPS_RESP_OK,
        },
      },
      notifications,
    };
  }

  private setUnsaved(value: boolean, notifications: Notification[]) {
    if (this.unsaved === value) {
      return;
    }
    this.unsaved = value;
    notifications.push({ keymap: { unsavedChangesStatusChanged: value } });
  }

  private validateBinding(
    binding: BehaviorBinding,
    behavior: GetBehaviorDetailsResponse,
  ): boolean {
    if (behavior.metadata.length === 0) {
      return binding.param1 === 0 && binding.param2 === 0;
    }

    return behavior.metadata.some(
      ({ param1, param2 }) =>
        this.validateParameter(binding.param1, param1) &&
        this.validateParameter(binding.param2, param2),
    );
  }

  private validateParameter(
    value: number,
    descriptions: GetBehaviorDetailsResponse["metadata"][number]["param1"],
  ): boolean {
    if (descriptions.length === 0) {
      return value === 0;
    }

    return descriptions.some((description) => {
      if (description.nil !== undefined) {
        return value === 0;
      }
      if (description.constant !== undefined) {
        return value === description.constant;
      }
      if (description.range) {
        return value >= description.range.min && value <= description.range.max;
      }
      if (description.layerId !== undefined) {
        return this.keymap.layers.some(({ id }) => id === value);
      }
      if (description.hidUsage) {
        // Implicit modifier flags live in the high byte and are not part of
        // the encoded HID page/usage pair.
        const hidUsage = value & 0x00ffffff;
        const page = Math.floor(hidUsage / 0x10000) & 0xffff;
        const usage = hidUsage & 0xffff;
        return (
          (page === 0x07 &&
            usage >= 4 &&
            usage <= description.hidUsage.keyboardMax) ||
          (page === 0x0c &&
            usage > 0 &&
            usage <= description.hidUsage.consumerMax)
        );
      }
      return false;
    });
  }

  private transparentBehaviorId(): number {
    return (
      this.fixture.behaviors.find(
        ({ displayName }) => displayName === "Transparent",
      )?.id ?? 0
    );
  }

  private findNextLayerId(): number {
    return Math.max(-1, ...this.keymap.layers.map(({ id }) => id)) + 1;
  }

  private rpcNotFound(): RpcReply {
    return {
      response: { meta: { simpleError: ErrorConditions.RPC_NOT_FOUND } },
    };
  }
}

export class ReplayRpcTransport extends FramedRpcTransport {
  private currentStep = 0;

  constructor(
    private readonly steps: readonly ReplayRpcStep[],
    options: ReplayRpcTransportOptions = {},
  ) {
    super(options.label ?? "ZMK Studio RPC Replay", options.responseChunkSize);
  }

  get remainingSteps(): number {
    return this.steps.length - this.currentStep;
  }

  protected respond(request: Request): RpcReply {
    const step = this.steps[this.currentStep];
    if (!step) {
      throw new Error(
        `RPC replay exhausted before request ${JSON.stringify(Request.toJSON(request))}`,
      );
    }

    const actual = Request.toJSON({ ...request, requestId: 0 });
    const expected = Request.toJSON({ ...clone(step.request), requestId: 0 });
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
      throw new Error(
        `RPC replay mismatch at step ${this.currentStep}: expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`,
      );
    }

    this.currentStep += 1;
    return {
      response: clone(step.response),
      notifications: clone(step.notifications ?? []),
    };
  }
}

export function createMockRpcTransport(
  options: MockRpcTransportOptions = {},
): MockRpcTransport {
  return new MockRpcTransport(options);
}

export function createReplayRpcTransport(
  steps: readonly ReplayRpcStep[],
  options: ReplayRpcTransportOptions = {},
): ReplayRpcTransport {
  return new ReplayRpcTransport(steps, options);
}

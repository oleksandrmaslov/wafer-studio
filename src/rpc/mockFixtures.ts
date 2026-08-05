import type { GetBehaviorDetailsResponse } from "@zmkfirmware/zmk-studio-ts-client/behaviors";
import type { GetDeviceInfoResponse } from "@zmkfirmware/zmk-studio-ts-client/core";
import type {
  BehaviorBinding,
  Keymap,
  PhysicalLayout,
} from "@zmkfirmware/zmk-studio-ts-client/keymap";

export interface MockDeviceFixture {
  label: string;
  deviceInfo: GetDeviceInfoResponse;
  behaviors: GetBehaviorDetailsResponse[];
  physicalLayouts: PhysicalLayout[];
  activePhysicalLayoutIndex: number;
  keymap: Keymap;
}

export const WAFER_BEHAVIOR_IDS = {
  keyPress: 10,
  transparent: 11,
  none: 12,
  keyToggle: 101,
  stickyKey: 115,
  graveEscape: 127,
  momentaryLayer: 20,
  toggleLayer: 21,
  toLayer: 223,
  stickyLayer: 239,
  bluetooth: 30,
  outputSelection: 31,
  modTap: 40,
  layerTap: 41,
  mouseClick: 50,
  mouseMove: 503,
  mouseScroll: 509,
  rgbUnderglow: 60,
  backlight: 607,
  externalPower: 70,
  reset: 701,
  bootloader: 709,
  studioUnlock: 733,
  capsWord: 80,
  keyRepeat: 81,
  softOff: 82,
  copyLineMacro: 907,
  bracketTapDance: 919,
} as const;

const KEY_COUNT = 42;
const KEYBOARD_PAGE = 0x07;
const CONSUMER_PAGE = 0x0c;

const hid = (page: number, usage: number) => page * 0x10000 + usage;
const keyboard = (usage: number) => hid(KEYBOARD_PAGE, usage);
const consumer = (usage: number) => hid(CONSUMER_PAGE, usage);

const binding = (
  behaviorId: number,
  param1 = 0,
  param2 = 0,
): BehaviorBinding => ({ behaviorId, param1, param2 });

const keyPress = (usage: number) => binding(WAFER_BEHAVIOR_IDS.keyPress, usage);
const transparent = () => binding(WAFER_BEHAVIOR_IDS.transparent);

function createWaferGeometry(thumbSpread = 0): PhysicalLayout {
  const keys: PhysicalLayout["keys"] = [];
  const columnOffsets = [75, 35, 0, 0, 35, 75];

  for (let row = 0; row < 3; row += 1) {
    for (let column = 0; column < 6; column += 1) {
      keys.push({
        width: 100,
        height: 100,
        x: column * 100,
        y: row * 100 + columnOffsets[column],
        r: -300,
        rx: 600,
        ry: 350,
      });
    }

    for (let column = 0; column < 6; column += 1) {
      keys.push({
        width: 100,
        height: 100,
        x: 800 + column * 100,
        y: row * 100 + columnOffsets[5 - column],
        r: 300,
        rx: 800,
        ry: 350,
      });
    }
  }

  keys.push(
    {
      width: 110,
      height: 100,
      x: 260 - thumbSpread,
      y: 385,
      r: -1200,
      rx: 590,
      ry: 410,
    },
    {
      width: 115,
      height: 100,
      x: 375 - Math.floor(thumbSpread / 2),
      y: 410,
      r: -700,
      rx: 590,
      ry: 410,
    },
    {
      width: 125,
      height: 100,
      x: 495,
      y: 420,
      r: -200,
      rx: 590,
      ry: 410,
    },
    {
      width: 125,
      height: 100,
      x: 680,
      y: 420,
      r: 200,
      rx: 810,
      ry: 410,
    },
    {
      width: 115,
      height: 100,
      x: 810 + Math.floor(thumbSpread / 2),
      y: 410,
      r: 700,
      rx: 810,
      ry: 410,
    },
    {
      width: 110,
      height: 100,
      x: 930 + thumbSpread,
      y: 385,
      r: 1200,
      rx: 810,
      ry: 410,
    },
  );

  if (keys.length !== KEY_COUNT) {
    throw new Error(`Wafer mock geometry must have ${KEY_COUNT} keys`);
  }

  return {
    name: thumbSpread === 0 ? "Wafer Split 42" : "Wafer Split 42 — Wide",
    keys,
  };
}

function createBaseBindings(): BehaviorBinding[] {
  const usageIds = [
    // Top row: Tab Q W E R T | Y U I O P Backspace
    43, 20, 26, 8, 21, 23, 28, 24, 12, 18, 19, 42,
    // Home row: Esc A S D F G | H J K L ; '
    41, 4, 22, 7, 9, 10, 11, 13, 14, 15, 51, 52,
    // Bottom row: Shift Z X C V B | N M , . / Shift
    225, 29, 27, 6, 25, 5, 17, 16, 54, 55, 56, 229,
  ];

  return [
    ...usageIds.map((usage) => keyPress(keyboard(usage))),
    binding(WAFER_BEHAVIOR_IDS.momentaryLayer, 1),
    binding(WAFER_BEHAVIOR_IDS.modTap, keyboard(224), keyboard(41)),
    keyPress(keyboard(44)),
    keyPress(keyboard(40)),
    binding(WAFER_BEHAVIOR_IDS.layerTap, 2, keyboard(42)),
    binding(WAFER_BEHAVIOR_IDS.bluetooth, 3, 0),
  ];
}

function createNavigationBindings(): BehaviorBinding[] {
  const bindings = Array.from({ length: KEY_COUNT }, transparent);

  const navigationKeys: Record<number, number> = {
    6: 74, // Home
    7: 75, // Page Up
    8: 82, // Up
    9: 78, // Page Down
    10: 77, // End
    18: 80, // Left
    19: 81, // Down
    20: 82, // Up
    21: 79, // Right
    30: 76, // Delete
  };

  for (const [position, usage] of Object.entries(navigationKeys)) {
    bindings[Number(position)] = keyPress(keyboard(usage));
  }

  for (let index = 0; index < 12; index += 1) {
    bindings[index] = keyPress(keyboard(58 + index));
  }

  bindings[36] = binding(WAFER_BEHAVIOR_IDS.toggleLayer, 3);
  bindings[38] = keyPress(keyboard(44));
  bindings[39] = keyPress(keyboard(40));
  return bindings;
}

function createSymbolBindings(): BehaviorBinding[] {
  const bindings = Array.from({ length: KEY_COUNT }, transparent);
  const usageIds = [
    53, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 45, 41, 47, 48, 46, 49, 50, 36,
    37, 38, 39, 45, 46, 225, 47, 48, 51, 52, 53, 54, 55, 56, 45, 46, 229,
  ];

  usageIds.forEach((usage, index) => {
    bindings[index] = keyPress(keyboard(usage));
  });
  bindings[38] = keyPress(keyboard(44));
  bindings[39] = keyPress(keyboard(40));
  bindings[40] = binding(WAFER_BEHAVIOR_IDS.momentaryLayer, 3);
  return bindings;
}

function createMediaBindings(): BehaviorBinding[] {
  const bindings = Array.from({ length: KEY_COUNT }, transparent);

  bindings[6] = keyPress(consumer(0x00b6)); // Previous track
  bindings[7] = keyPress(consumer(0x00cd)); // Play/pause
  bindings[8] = keyPress(consumer(0x00b5)); // Next track
  bindings[18] = keyPress(consumer(0x00e2)); // Mute
  bindings[19] = keyPress(consumer(0x00ea)); // Volume down
  bindings[20] = keyPress(consumer(0x00e9)); // Volume up
  bindings[24] = binding(WAFER_BEHAVIOR_IDS.mouseClick, 1);
  bindings[25] = binding(WAFER_BEHAVIOR_IDS.mouseClick, 2);
  bindings[26] = binding(WAFER_BEHAVIOR_IDS.mouseClick, 4);
  bindings[27] = binding(WAFER_BEHAVIOR_IDS.backlight, 2);
  bindings[28] = binding(WAFER_BEHAVIOR_IDS.copyLineMacro);
  bindings[29] = binding(WAFER_BEHAVIOR_IDS.bracketTapDance);
  bindings[30] = binding(WAFER_BEHAVIOR_IDS.rgbUnderglow, 0);
  bindings[31] = binding(WAFER_BEHAVIOR_IDS.rgbUnderglow, 7);
  bindings[32] = binding(WAFER_BEHAVIOR_IDS.rgbUnderglow, 8);
  bindings[33] = binding(WAFER_BEHAVIOR_IDS.externalPower, 2);
  bindings[34] = binding(WAFER_BEHAVIOR_IDS.graveEscape);
  bindings[35] = binding(WAFER_BEHAVIOR_IDS.outputSelection, 0);
  bindings[36] = binding(WAFER_BEHAVIOR_IDS.bluetooth, 1);
  bindings[37] = binding(WAFER_BEHAVIOR_IDS.bluetooth, 2);
  bindings[38] = binding(WAFER_BEHAVIOR_IDS.stickyKey, keyboard(225));
  bindings[39] = binding(WAFER_BEHAVIOR_IDS.keyToggle, keyboard(57));
  bindings[40] = binding(WAFER_BEHAVIOR_IDS.capsWord);
  bindings[41] = binding(WAFER_BEHAVIOR_IDS.keyRepeat);
  return bindings;
}

function assertBindings(name: string, bindings: BehaviorBinding[]) {
  if (bindings.length !== KEY_COUNT) {
    throw new Error(
      `Wafer mock layer "${name}" has ${bindings.length} bindings; expected ${KEY_COUNT}`,
    );
  }
  return bindings;
}

function createBehaviors(): GetBehaviorDetailsResponse[] {
  const noParameters = [{ param1: [], param2: [] }];
  const keyUsage = {
    name: "Key or consumer usage",
    hidUsage: { keyboardMax: 0xe7, consumerMax: 0x029f },
  };
  const layer = { name: "Layer", layerId: {} };

  return [
    {
      id: WAFER_BEHAVIOR_IDS.keyPress,
      displayName: "Key Press",
      metadata: [{ param1: [keyUsage], param2: [] }],
    },
    {
      id: WAFER_BEHAVIOR_IDS.transparent,
      displayName: "Transparent",
      metadata: noParameters,
    },
    {
      id: WAFER_BEHAVIOR_IDS.none,
      displayName: "None",
      metadata: noParameters,
    },
    {
      id: WAFER_BEHAVIOR_IDS.keyToggle,
      displayName: "Key Toggle",
      metadata: [{ param1: [keyUsage], param2: [] }],
    },
    {
      id: WAFER_BEHAVIOR_IDS.stickyKey,
      displayName: "Sticky Key",
      metadata: [{ param1: [keyUsage], param2: [] }],
    },
    {
      id: WAFER_BEHAVIOR_IDS.graveEscape,
      displayName: "Grave/Escape",
      metadata: noParameters,
    },
    {
      id: WAFER_BEHAVIOR_IDS.momentaryLayer,
      displayName: "Momentary Layer",
      metadata: [{ param1: [layer], param2: [] }],
    },
    {
      id: WAFER_BEHAVIOR_IDS.toggleLayer,
      displayName: "Toggle Layer",
      metadata: [{ param1: [layer], param2: [] }],
    },
    {
      id: WAFER_BEHAVIOR_IDS.toLayer,
      displayName: "To Layer",
      metadata: [{ param1: [layer], param2: [] }],
    },
    {
      id: WAFER_BEHAVIOR_IDS.stickyLayer,
      displayName: "Sticky Layer",
      metadata: [{ param1: [layer], param2: [] }],
    },
    {
      id: WAFER_BEHAVIOR_IDS.bluetooth,
      displayName: "Bluetooth",
      metadata: [
        {
          param1: [
            { name: "Clear Selected Profile", constant: 0 },
            { name: "Next Profile", constant: 1 },
            { name: "Previous Profile", constant: 2 },
            { name: "Clear All Profiles", constant: 4 },
          ],
          param2: [],
        },
        {
          param1: [
            { name: "Select Profile", constant: 3 },
            { name: "Disconnect Profile", constant: 5 },
          ],
          param2: [{ name: "Profile", range: { min: 0, max: 4 } }],
        },
      ],
    },
    {
      id: WAFER_BEHAVIOR_IDS.outputSelection,
      displayName: "Output Selection",
      metadata: [
        {
          param1: [
            { name: "Toggle Outputs", constant: 0 },
            { name: "USB Output", constant: 1 },
            { name: "BLE Output", constant: 2 },
            { name: "No Output", constant: 3 },
          ],
          param2: [],
        },
      ],
    },
    {
      id: WAFER_BEHAVIOR_IDS.modTap,
      displayName: "Mod-Tap",
      metadata: [{ param1: [keyUsage], param2: [keyUsage] }],
    },
    {
      id: WAFER_BEHAVIOR_IDS.layerTap,
      displayName: "Layer-Tap",
      metadata: [{ param1: [layer], param2: [keyUsage] }],
    },
    {
      id: WAFER_BEHAVIOR_IDS.mouseClick,
      displayName: "Mouse Key Press",
      metadata: [
        {
          param1: [
            { name: "MB1", constant: 1 },
            { name: "MB2", constant: 2 },
            { name: "MB3", constant: 4 },
            { name: "MB4", constant: 8 },
            { name: "MB5", constant: 16 },
          ],
          param2: [],
        },
      ],
    },
    {
      id: WAFER_BEHAVIOR_IDS.mouseMove,
      displayName: "Mouse Move",
      metadata: [],
    },
    {
      id: WAFER_BEHAVIOR_IDS.mouseScroll,
      displayName: "Mouse Scroll",
      metadata: [],
    },
    {
      id: WAFER_BEHAVIOR_IDS.rgbUnderglow,
      displayName: "Underglow",
      metadata: [
        {
          param1: [
            { name: "Toggle On/Off", constant: 0 },
            { name: "Turn On", constant: 1 },
            { name: "Turn OFF", constant: 2 },
            { name: "Hue Up", constant: 3 },
            { name: "Hue Down", constant: 4 },
            { name: "Saturation Up", constant: 5 },
            { name: "Saturation Down", constant: 6 },
            { name: "Brightness Up", constant: 7 },
            { name: "Brightness Down", constant: 8 },
            { name: "Speed Up", constant: 9 },
            { name: "Speed Down", constant: 10 },
            { name: "Next Effect", constant: 11 },
            { name: "Previous Effect", constant: 12 },
          ],
          param2: [],
        },
      ],
    },
    {
      id: WAFER_BEHAVIOR_IDS.backlight,
      displayName: "Backlight",
      metadata: [
        {
          param1: [
            { name: "Toggle On/Off", constant: 2 },
            { name: "Turn On", constant: 0 },
            { name: "Turn OFF", constant: 1 },
            { name: "Increase Brightness", constant: 3 },
            { name: "Decrease Brightness", constant: 4 },
            { name: "Cycle Brightness", constant: 5 },
          ],
          param2: [],
        },
        {
          param1: [{ name: "Set Brightness", constant: 6 }],
          param2: [{ name: "Brightness", range: { min: 0, max: 100 } }],
        },
      ],
    },
    {
      id: WAFER_BEHAVIOR_IDS.externalPower,
      displayName: "External Power",
      metadata: [],
    },
    {
      id: WAFER_BEHAVIOR_IDS.reset,
      displayName: "Reset",
      metadata: noParameters,
    },
    {
      id: WAFER_BEHAVIOR_IDS.bootloader,
      displayName: "Bootloader",
      metadata: noParameters,
    },
    {
      id: WAFER_BEHAVIOR_IDS.studioUnlock,
      displayName: "Studio Unlock",
      metadata: noParameters,
    },
    {
      id: WAFER_BEHAVIOR_IDS.capsWord,
      displayName: "Caps Word",
      metadata: noParameters,
    },
    {
      id: WAFER_BEHAVIOR_IDS.keyRepeat,
      displayName: "Key Repeat",
      metadata: noParameters,
    },
    {
      id: WAFER_BEHAVIOR_IDS.softOff,
      displayName: "Soft Off",
      metadata: noParameters,
    },
    {
      id: WAFER_BEHAVIOR_IDS.copyLineMacro,
      displayName: "Copy Line Macro",
      metadata: noParameters,
    },
    {
      id: WAFER_BEHAVIOR_IDS.bracketTapDance,
      displayName: "Bracket Tap Dance",
      metadata: noParameters,
    },
  ];
}

export function createWaferMockFixture(): MockDeviceFixture {
  return {
    label: "Wafer Studio Demo",
    deviceInfo: {
      name: "Wafer Split 42",
      serialNumber: new Uint8Array([
        0x57, 0x46, 0x52, 0x2d, 0x30, 0x30, 0x30, 0x31,
      ]),
    },
    behaviors: createBehaviors(),
    physicalLayouts: [createWaferGeometry(), createWaferGeometry(30)],
    activePhysicalLayoutIndex: 0,
    keymap: {
      layers: [
        {
          id: 0,
          name: "Base",
          bindings: assertBindings("Base", createBaseBindings()),
        },
        {
          id: 1,
          name: "Navigation",
          bindings: assertBindings("Navigation", createNavigationBindings()),
        },
        {
          id: 2,
          name: "Symbols",
          bindings: assertBindings("Symbols", createSymbolBindings()),
        },
        {
          id: 3,
          name: "Media",
          bindings: assertBindings("Media", createMediaBindings()),
        },
      ],
      availableLayers: 4,
      maxLayerNameLength: 16,
    },
  };
}

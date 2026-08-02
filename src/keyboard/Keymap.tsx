import {
  PhysicalLayout,
  Keymap as KeymapMsg,
} from "@zmkfirmware/zmk-studio-ts-client/keymap";
import type { GetBehaviorDetailsResponse } from "@zmkfirmware/zmk-studio-ts-client/behaviors";
import type { BehaviorBinding } from "@zmkfirmware/zmk-studio-ts-client/keymap";

import { PhysicalLayout as PhysicalLayoutComp } from "./PhysicalLayout";
import type { LayoutZoom } from "./layoutZoom";
import { HidUsageLabel } from "./HidUsageLabel";

type BehaviorMap = Record<number, GetBehaviorDetailsResponse>;

function layerNameForId(keymap: KeymapMsg, layerId: number): string {
  const index = keymap.layers.findIndex((layer) => layer.id === layerId);
  const layer = keymap.layers[index];
  return layer?.name || (index >= 0 ? `Layer ${index}` : `Layer ${layerId}`);
}

function renderBinding(
  binding: BehaviorBinding,
  behavior: GetBehaviorDetailsResponse | undefined,
  keymap: KeymapMsg,
) {
  if (!behavior) {
    return {
      header: "CUSTOM",
      children: (
        <span className="font-mono text-xs">#{binding.behaviorId}</span>
      ),
    };
  }

  const name = behavior.displayName.toLocaleLowerCase();
  const param1IsHid = behavior.metadata.some((set) =>
    set.param1.some((value) => value.hidUsage),
  );
  const param2IsHid = behavior.metadata.some((set) =>
    set.param2.some((value) => value.hidUsage),
  );
  const param1IsLayer = behavior.metadata.some((set) =>
    set.param1.some((value) => value.layerId),
  );

  if (name.includes("transparent")) {
    return {
      header: "",
      children: <span aria-label="Transparent">↘</span>,
    };
  }

  if (name === "none" || name.includes("none")) {
    return {
      header: "",
      children: <span aria-label="Do nothing">—</span>,
    };
  }

  if (name.includes("mod-tap") || name.includes("mod tap")) {
    return {
      header: "T/H",
      children: <HidUsageLabel hid_usage={binding.param2} />,
    };
  }

  if (name.includes("layer-tap") || name.includes("layer tap")) {
    return {
      header: layerNameForId(keymap, binding.param1),
      children: <HidUsageLabel hid_usage={binding.param2} />,
    };
  }

  if (name.includes("bluetooth")) {
    return {
      header: "BLUETOOTH",
      children: (
        <span>{binding.param2 >= 0 ? `BT ${binding.param2 + 1}` : "BT"}</span>
      ),
    };
  }

  if (param1IsLayer) {
    return {
      header: name.includes("toggle") ? "TOGGLE" : "HOLD",
      children: <span>{layerNameForId(keymap, binding.param1)}</span>,
    };
  }

  if (param1IsHid) {
    return {
      header: "",
      children: <HidUsageLabel hid_usage={binding.param1} />,
    };
  }

  if (param2IsHid) {
    return {
      header: behavior.displayName,
      children: <HidUsageLabel hid_usage={binding.param2} />,
    };
  }

  return {
    header: behavior.displayName,
    children: (
      <span className="font-mono text-xs">{binding.param1 || "·"}</span>
    ),
  };
}

export interface KeymapProps {
  layout: PhysicalLayout;
  keymap: KeymapMsg;
  behaviors: BehaviorMap;
  scale: LayoutZoom;
  selectedLayerIndex: number;
  selectedKeyPosition: number | undefined;
  onKeyPositionClicked: (keyPosition: number) => void;
}

export const Keymap = ({
  layout,
  keymap,
  behaviors,
  scale,
  selectedLayerIndex,
  selectedKeyPosition,
  onKeyPositionClicked,
}: KeymapProps) => {
  if (!keymap.layers[selectedLayerIndex]) {
    return <></>;
  }

  const positions = layout.keys.map((k, i) => {
    if (i >= keymap.layers[selectedLayerIndex].bindings.length) {
      return {
        id: `${keymap.layers[selectedLayerIndex].id}-${i}`,
        header: "Unknown",
        x: k.x / 100.0,
        y: k.y / 100.0,
        width: k.width / 100,
        height: k.height / 100.0,
        children: <span></span>,
      };
    }

    const binding = keymap.layers[selectedLayerIndex].bindings[i];
    const behavior = behaviors[binding.behaviorId];
    const rendered = renderBinding(binding, behavior, keymap);

    return {
      id: `${keymap.layers[selectedLayerIndex].id}-${i}`,
      header: rendered.header,
      x: k.x / 100.0,
      y: k.y / 100.0,
      width: k.width / 100,
      height: k.height / 100.0,
      r: (k.r || 0) / 100.0,
      rx: (k.rx || 0) / 100.0,
      ry: (k.ry || 0) / 100.0,
      children: rendered.children,
    };
  });

  return (
    <PhysicalLayoutComp
      positions={positions}
      oneU={48}
      hoverZoom={true}
      zoom={scale}
      selectedPosition={selectedKeyPosition}
      onPositionClicked={onKeyPositionClicked}
    />
  );
};

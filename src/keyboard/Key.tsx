import { PropsWithChildren } from "react";
import BehaviorShortNames from "./behavior-short-names.json";

interface KeyProps {
  selected?: boolean;
  width: number;
  height: number;
  oneU: number;
  header?: string;
  onClick?: () => void;
}

interface BehaviorShortName {
  short?: string;
}

const MAX_HEADER_LENGTH = 9;
const shortNames: Record<string, BehaviorShortName> = BehaviorShortNames;

const shortenHeader = (header: string | undefined) => {
  if (typeof header === "undefined") {
    return "";
  }
  // Empty string is a valid header for behaviors where we don't want to see a header, which is falsy
  // So we use an undefined check here
  if (typeof shortNames[header]?.short !== "undefined") {
    return shortNames[header].short;
  } else if (header.length > MAX_HEADER_LENGTH) {
    const words = header.split(/[\s,-]+/);
    const lettersPerWord = Math.trunc(MAX_HEADER_LENGTH / words.length);
    return words.map((word) => word.substring(0, lettersPerWord)).join("");
  } else {
    return header;
  }
};

export const Key = ({
  selected = false,
  width,
  height,
  oneU,
  header,
  onClick,
  children,
}: PropsWithChildren<KeyProps>) => {
  const pixelWidth = width * oneU - 2;
  const pixelHeight = height * oneU - 2;

  return (
    <button
      type="button"
      className={`wafer-key @container group relative flex items-center justify-center ${
        onClick ? "cursor-pointer" : "cursor-default"
      }`}
      data-interactive={Boolean(onClick)}
      data-selected={selected}
      aria-pressed={onClick ? selected : undefined}
      aria-hidden={onClick ? undefined : true}
      tabIndex={onClick ? undefined : -1}
      style={{
        width: `${pixelWidth}px`,
        height: `${pixelHeight}px`,
      }}
      onClick={onClick}
    >
      <span
        className={`pointer-events-none absolute left-1/2 top-1 max-w-[calc(100%_-_0.5rem)] -translate-x-1/2 truncate text-center font-keycap text-[0.55rem] leading-none ${
          selected ? "font-semibold text-ink" : "font-medium text-muted"
        }`}
      >
        {shortenHeader(header)}
      </span>
      {children}
    </button>
  );
};

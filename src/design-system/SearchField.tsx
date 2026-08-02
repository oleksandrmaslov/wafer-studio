import { Search, X } from "lucide-react";

export interface SearchFieldProps {
  ariaLabel: string;
  value: string;
  placeholder?: string;
  disabled?: boolean;
  onChange: (value: string) => void;
}

export function SearchField({
  ariaLabel,
  value,
  placeholder,
  disabled = false,
  onChange,
}: SearchFieldProps) {
  return (
    <div className="wafer-search-field">
      <Search aria-hidden="true" className="size-4 shrink-0" />
      <input
        type="search"
        aria-label={ariaLabel}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.currentTarget.value)}
        placeholder={placeholder}
        className="min-h-9 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-base-content/40 [&::-webkit-search-cancel-button]:hidden"
      />
      {value && (
        <button
          type="button"
          aria-label="Clear search"
          disabled={disabled}
          onClick={() => onChange("")}
          className="grid size-8 shrink-0 place-items-center rounded-md text-base-content/50 outline-none hover:bg-base-300 hover:text-base-content focus-visible:ring-2 focus-visible:ring-focus"
        >
          <X aria-hidden="true" className="size-3.5" />
        </button>
      )}
    </div>
  );
}

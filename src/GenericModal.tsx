import React from "react";

export interface GenericModalProps {
  onClose?: () => void;
  className?: string;
  children: React.ReactNode;
}

export const GenericModal = React.forwardRef(
  (
    { onClose, children, className }: GenericModalProps,
    ref: React.Ref<HTMLDialogElement>,
  ) => (
    <dialog
      ref={ref}
      aria-modal="true"
      onClose={onClose}
      className={[
        "m-auto max-h-[calc(100dvh-2rem)] max-w-[calc(100vw-2rem)] overflow-y-auto overscroll-contain rounded-[1.5rem] border border-[#D5D1C6] bg-[#FCFAF4] p-5 text-[#171815] shadow-[0_28px_80px_rgba(23,24,21,0.24)] backdrop:bg-[#171815]/65 backdrop:backdrop-blur-[2px] sm:p-7",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {children}
    </dialog>
  ),
);

GenericModal.displayName = "GenericModal";

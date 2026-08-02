export interface AppFooterProps {
  onShowAbout: () => void;
  onShowLicenseNotice: () => void;
}

export const AppFooter = ({
  onShowAbout,
  onShowLicenseNotice,
}: AppFooterProps) => {
  return (
    <footer className="flex min-h-8 flex-wrap items-center justify-center gap-x-3 gap-y-1 border-t border-line bg-base-200 px-3 py-1 text-[0.6875rem] text-base-content/55">
      <span className="font-medium text-base-content/70">
        Wafer Studio preview
      </span>
      <span aria-hidden="true">·</span>
      <span className="hidden sm:inline">Compatible with ZMK Studio</span>
      <span aria-hidden="true" className="hidden sm:inline">
        ·
      </span>
      <button
        type="button"
        className="rounded-sm underline-offset-4 hover:text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
        onClick={onShowAbout}
      >
        About
      </button>
      <button
        type="button"
        className="rounded-sm underline-offset-4 hover:text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
        onClick={onShowLicenseNotice}
      >
        <span className="sm:hidden">Notices</span>
        <span className="hidden sm:inline">Open-source notices</span>
      </button>
    </footer>
  );
};

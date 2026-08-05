import { useEffect, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faApple,
  faLinux,
  faWindows,
  IconDefinition,
} from "@fortawesome/free-brands-svg-icons";
import { ArrowUpRight, DownloadIcon, Github, Terminal } from "lucide-react";
import releaseData from "./data/release-data.json";

/**
 * The download page for the desktop application.
 *
 * The desktop build exists for one concrete reason, and the page leads with it:
 * browsers expose Web Bluetooth for this on Linux only, so on Windows and macOS
 * a wireless keyboard is unreachable from the web version. Everything else is
 * the same application.
 *
 * It reads `release-data.json`, regenerated before every build from whichever
 * repository `scripts/generate-release-data.js` points at — which is now this
 * project's own, not upstream ZMK Studio's. That file can legitimately be empty
 * (a fork with no published release, or a build made offline), so the empty
 * state is a real layout rather than a page of dead links.
 */

type Platform = "windows" | "mac" | "linux" | "unknown";

const PLATFORMS: Record<
  Exclude<Platform, "unknown">,
  { name: string; icon: IconDefinition }
> = {
  windows: { name: "Windows", icon: faWindows },
  mac: { name: "macOS", icon: faApple },
  linux: { name: "Linux", icon: faLinux },
};

interface DownloadLink {
  name: string;
  /** Matched against the asset filename rather than the whole URL. */
  pattern: RegExp;
}

const PLATFORM_LINKS: Record<Platform, DownloadLink[]> = {
  windows: [
    { name: "Installer (.exe)", pattern: /\.exe$/ },
    { name: "Installer (.msi)", pattern: /\.msi$/ },
  ],
  mac: [{ name: "Disk image (.dmg)", pattern: /\.dmg$/ }],
  linux: [
    { name: "AppImage", pattern: /\.AppImage$/ },
    { name: "Debian package (.deb)", pattern: /\.deb$/ },
    { name: "RPM package (.rpm)", pattern: /\.rpm$/ },
  ],
  unknown: [],
};

interface ReleaseAsset {
  name: string;
  browser_download_url: string;
  size?: number;
}

const release = releaseData as {
  tag_name: string | null;
  html_url?: string;
  assets?: ReleaseAsset[];
};

const assets: ReleaseAsset[] = release.assets ?? [];
const version = release.tag_name;
const releasesUrl =
  release.html_url ??
  "https://github.com/oleksandrmaslov/wafer-zmk-studio/releases";
const repoUrl = releasesUrl.replace(/\/releases(\/.*)?$/, "");

function detectPlatform(): Platform {
  if (typeof window === "undefined") return "unknown";

  const agent = window.navigator.userAgent.toLowerCase();
  if (agent.includes("win")) return "windows";
  if (agent.includes("mac")) return "mac";
  if (agent.includes("linux") && !agent.includes("android")) return "linux";

  return "unknown";
}

function findAsset(link: DownloadLink): ReleaseAsset | undefined {
  return assets.find((asset) => link.pattern.test(asset.name));
}

function formatSize(bytes?: number): string | undefined {
  return bytes ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : undefined;
}

/** One row in the every-platform list. Renders nothing without an asset. */
function AssetRow({ link }: { link: DownloadLink }) {
  const asset = findAsset(link);
  if (!asset) return null;

  return (
    <a
      href={asset.browser_download_url}
      className="wafer-dispersive flex min-h-11 items-center gap-2.5 rounded-control px-2 text-sm !text-ink no-underline transition-colors hover:bg-hover"
    >
      <DownloadIcon aria-hidden="true" className="size-4 shrink-0 text-muted" />
      <span className="min-w-0 flex-1 truncate">{link.name}</span>
      {formatSize(asset.size) && (
        <span className="shrink-0 font-mono text-[0.6875rem] text-tertiary">
          {formatSize(asset.size)}
        </span>
      )}
    </a>
  );
}

export const Download = () => {
  const [platform, setPlatform] = useState<Platform>("unknown");
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    const detected = detectPlatform();
    setPlatform(detected);
    // With nothing to recommend, the full list is the only useful thing here.
    if (PLATFORM_LINKS[detected].length === 0) setShowAll(true);
  }, []);

  const known = platform === "unknown" ? undefined : PLATFORMS[platform];
  const primary = PLATFORM_LINKS[platform]
    .map((link) => ({ link, asset: findAsset(link) }))
    .filter((entry): entry is { link: DownloadLink; asset: ReleaseAsset } =>
      Boolean(entry.asset),
    );

  return (
    <div className="wafer-substrate min-h-full w-full bg-base-300 px-4 py-16 text-base-content">
      <main className="mx-auto grid w-full max-w-xl gap-8">
        <header className="grid justify-items-center gap-4 text-center">
          {/* Unclipped and at size: the mark is already drawn as an icon, with
              its own rounded square and its own light. */}
          <img
            src={`${import.meta.env.BASE_URL}wafer-mark.png`}
            alt=""
            aria-hidden="true"
            className="size-28 rounded-[22%]"
          />
          <div>
            <h1 className="text-3xl font-black tracking-[-0.03em] text-ink">
              Wafer Studio for desktop
            </h1>
            <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-muted">
              The same editor, plus the one thing a browser cannot do: connect
              to a keyboard over Bluetooth. Browsers expose Web Bluetooth for
              this on Linux only, so on Windows and macOS a wireless board needs
              the desktop app.
            </p>
            {version && (
              <p className="mt-3 font-mono text-xs text-tertiary">{version}</p>
            )}
          </div>
        </header>

        {assets.length > 0 ? (
          <div className="wafer-float grid gap-4 p-5">
            {known && primary.length > 0 && (
              <div className="grid gap-2">
                {primary.map(({ link, asset }) => (
                  <a
                    key={link.name}
                    href={asset.browser_download_url}
                    className="wafer-accent flex min-h-12 flex-wrap items-center justify-center gap-x-3 gap-y-0.5 rounded-xl px-5 text-sm font-bold no-underline transition hover:opacity-90 active:opacity-75"
                  >
                    <FontAwesomeIcon icon={known.icon} className="h-5" />
                    Download for {known.name}
                    <span className="font-normal opacity-70">{link.name}</span>
                  </a>
                ))}
              </div>
            )}

            <div className="grid gap-2">
              {primary.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowAll((previous) => !previous)}
                  className="min-h-9 justify-self-start rounded-control px-1 text-left text-xs font-semibold text-muted underline decoration-line-strong underline-offset-4 transition-colors hover:text-ink"
                >
                  {showAll ? "Hide" : "Show"} builds for every platform
                </button>
              )}

              {showAll && (
                <div className="grid gap-3 border-t border-line-subtle pt-3">
                  {(
                    Object.keys(PLATFORMS) as Exclude<Platform, "unknown">[]
                  ).map((id) => {
                    const rows = PLATFORM_LINKS[id].filter((link) =>
                      findAsset(link),
                    );
                    if (rows.length === 0) return null;

                    return (
                      <section key={id}>
                        <h2 className="px-1 pb-1 text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-tertiary">
                          {PLATFORMS[id].name}
                        </h2>
                        <div className="grid">
                          {rows.map((link) => (
                            <AssetRow key={link.name} link={link} />
                          ))}
                        </div>
                      </section>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        ) : (
          /* Not an error, and phrased as what it is. A project that has not cut
             a release yet lands here, and the honest answer is the source. */
          <div className="wafer-float grid gap-4 p-5">
            <div>
              <p className="font-bold text-ink">No builds published yet</p>
              <p className="mt-1 text-sm leading-6 text-muted">
                There is no packaged desktop release to download at the moment.
                It runs from source in the meantime — that needs Rust, and on
                Windows the MSVC build tools.
              </p>
            </div>
            <pre className="overflow-x-auto rounded-xl border border-line-subtle bg-canvas p-3 font-mono text-xs leading-relaxed text-muted">
              <code>{`git clone ${repoUrl}\nnpm install\nnpm run tauri build`}</code>
            </pre>
            <a
              href={releasesUrl}
              className="wafer-dispersive flex min-h-11 items-center gap-2 rounded-control px-2 text-sm font-semibold !text-ink no-underline transition-colors hover:bg-hover"
            >
              <Terminal aria-hidden="true" className="size-4 text-muted" />
              <span className="min-w-0 flex-1">Releases and build notes</span>
              <ArrowUpRight aria-hidden="true" className="size-4 text-muted" />
            </a>
          </div>
        )}

        <footer className="grid justify-items-center gap-3 text-center">
          <a
            href={releasesUrl}
            className="inline-flex min-h-9 items-center gap-2 text-xs font-semibold !text-muted no-underline transition-colors hover:!text-ink"
          >
            <Github aria-hidden="true" className="size-4" />
            All releases on GitHub
          </a>
          <p className="text-xs leading-5 text-tertiary">
            Rather not install anything?{" "}
            <a
              href={import.meta.env.BASE_URL}
              className="font-semibold !text-ink underline decoration-line-strong underline-offset-4"
            >
              Open Wafer Studio in the browser
            </a>{" "}
            — USB works everywhere.
          </p>
        </footer>
      </main>
    </div>
  );
};

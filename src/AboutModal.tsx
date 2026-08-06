// Modified by Oleksandr Maslov for Wafer Studio, 2026.
// Based on ZMK Studio, licensed under Apache-2.0.
// SPDX-License-Identifier: Apache-2.0

import React from "react";
import { useModalRef } from "./misc/useModalRef";

import cannonKeys from "./assets/cannonkeys.png";
import cannonKeysDarkMode from "./assets/cannonkeys-dark-mode.png";

import niceAndTyperactive from "./assets/niceandtyperactive.png";
import niceAndTyperactiveDarkMode from "./assets/niceandtyperactive-dark-mode.png";

import kinesis from "./assets/kinesis.png";
import kinesisDarkMode from "./assets/kinesis-dark-mode.png";

import keychron from "./assets/keychron.png";
import keychronDarkMode from "./assets/keychron-dark-mode.png";

import littleKeyboards from "./assets/littlekeyboards.avif";
import littleKeyboardsDarkMode from "./assets/littlekeyboards-dark-mode.avif";

import keebmaker from "./assets/keebmaker.png";
import keebmakerDarkMode from "./assets/keebmaker-dark-mode.png";

import keebio from "./assets/keebio.avif";

import deskHero from "./assets/deskhero.webp";
import deskHeroDarkMode from "./assets/deskhero-dark-mode.webp";

import mode from "./assets/mode.png";
import modeDarkMode from "./assets/mode-dark-mode.png";

import mechlovin from "./assets/mechloving.png";
import mechlovinDarkMode from "./assets/mechlovin-dark-mode.png";

import phaseByte from "./assets/phasebyte.png";

import keycapsss from "./assets/keycapsss.png";
import keycapsssDarkMode from "./assets/keycapsss-dark-mode.png";

import mekibo from "./assets/mekibo.png";
import mekiboDarkMode from "./assets/mekibo-dark-mode.png";

import splitkb from "./assets/splitkb.png";
import splitkbDarkMode from "./assets/splitkb-dark-mode.png";
import { GenericModal } from "./GenericModal";
import { ExternalLink } from "./misc/ExternalLink";

// Apache-2.0 section 4 requires the licence and the NOTICE to travel with every
// copy, not just with the repository. Inlining them as text means the web build
// and the desktop build show the same thing without a filesystem plugin; the
// installers additionally ship both files as bundle resources.
import LICENSE from "../LICENSE?raw";
import NOTICE from "../NOTICE?raw";

export interface AboutModalProps {
  open: boolean;
  onClose: () => void;
}

enum SponsorSize {
  Large,
  Medium,
  Small,
}

const sponsors = [
  {
    level: "Platinum",
    size: SponsorSize.Large,
    vendors: [
      {
        name: "nice!keyboards / typeractive",
        img: niceAndTyperactive,
        darkModeImg: niceAndTyperactiveDarkMode,
        url: "https://typeractive.xyz/",
      },
      {
        name: "Kinesis",
        img: kinesis,
        darkModeImg: kinesisDarkMode,
        url: "https://kinesis-ergo.com/",
      },
    ],
  },
  {
    level: "Gold+",
    size: SponsorSize.Large,
    vendors: [
      {
        name: "CannonKeys",
        img: cannonKeys,
        darkModeImg: cannonKeysDarkMode,
        url: "https://cannonkeys.com/",
      },
      {
        name: "Keychron",
        img: keychron,
        darkModeImg: keychronDarkMode,
        url: "https://keychron.com/",
      },
    ],
  },
  {
    level: "Gold",
    size: SponsorSize.Medium,
    vendors: [
      {
        name: "Little Keyboards",
        img: littleKeyboards,
        darkModeImg: littleKeyboardsDarkMode,
        url: "https://littlekeyboards.com/",
      },
      {
        name: "Keebmaker",
        img: keebmaker,
        darkModeImg: keebmakerDarkMode,
        url: "https://keebmaker.com/",
      },
    ],
  },
  {
    level: "Silver",
    size: SponsorSize.Medium,
    vendors: [
      {
        name: "keeb.io",
        img: keebio,
        url: "https://keeb.io/",
      },
      {
        name: "Mode Designs",
        img: mode,
        darkModeImg: modeDarkMode,
        url: "https://modedesigns.com/",
      },
    ],
  },
  {
    level: "Bronze",
    size: SponsorSize.Small,
    vendors: [
      {
        name: "deskhero",
        img: deskHero,
        darkModeImg: deskHeroDarkMode,
        url: "https://deskhero.ca/",
      },
      {
        name: "PhaseByte",
        img: phaseByte,
        url: "https://phasebyte.com/",
      },
      {
        name: "Mechlovin'",
        img: mechlovin,
        darkModeImg: mechlovinDarkMode,
        url: "https://mechlovin.studio/",
      },
    ],
  },
  {
    level: "Additional",
    size: SponsorSize.Small,
    vendors: [
      {
        name: "splitkb.com",
        img: splitkb,
        darkModeImg: splitkbDarkMode,
        url: "https://splitkb.com/",
      },
      {
        name: "keycapsss",
        img: keycapsss,
        darkModeImg: keycapsssDarkMode,
        url: "https://keycapsss.com/",
      },
      {
        name: "mekibo",
        img: mekibo,
        darkModeImg: mekiboDarkMode,
        url: "https://mekibo.com/",
      },
    ],
  },
];

export const AboutModal = ({ open, onClose }: AboutModalProps) => {
  const ref = useModalRef(open, true);

  return (
    <GenericModal
      ref={ref}
      className="max-h-[min(50rem,calc(100vh-2rem))] w-[min(52rem,calc(100vw-2rem))] min-w-min overflow-y-auto"
      onClose={onClose}
    >
      <div className="flex items-start justify-between gap-6 border-b border-line pb-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
            Wafer Studio
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-[-0.03em]">
            A calmer way to shape your keyboard
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-base-content/65">
            Wafer Studio is a Wafer-designed configurator compatible with ZMK
            Studio-enabled keyboards. It uses the official ZMK Studio protocol
            and TypeScript client, and is an independent product rather than an
            official ZMK application.
          </p>
          <dl className="mt-4 grid max-w-xl grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-xs">
            <dt className="text-base-content/50">Studio client</dt>
            <dd className="font-mono tabular-nums">0.0.18</dd>
            <dt className="text-base-content/50">Compatibility</dt>
            <dd>Official ZMK Studio RPC</dd>
          </dl>
        </div>
        <button
          className="min-h-11 shrink-0 rounded-lg border border-line bg-raised px-4 text-sm font-semibold hover:bg-base-300"
          onClick={onClose}
        >
          Close
        </button>
      </div>

      <div className="py-5">
        <h2 className="font-semibold">Open-source foundation</h2>
        <p className="mt-2 text-sm leading-relaxed text-base-content/65">
          The ZMK Project:{" "}
          <ExternalLink href="https://zmk.dev/">website</ExternalLink>,{" "}
          <ExternalLink href="https://github.com/zmkfirmware/zmk/issues/">
            GitHub issues
          </ExternalLink>
          , and{" "}
          <ExternalLink href="https://zmk.dev/community/discord/invite">
            community Discord
          </ExternalLink>
          . The official ZMK Studio interface is made possible by its
          contributors and the following sponsors.
        </p>
        <p className="mt-3 rounded-lg border border-line bg-base-100 px-3 py-2 text-xs leading-relaxed text-base-content/60">
          These companies supported the upstream ZMK Studio project. They do not
          sponsor or endorse Wafer Studio.
        </p>
      </div>
      <div className="grid auto-rows-auto grid-cols-[auto_minmax(min-content,1fr)] items-center justify-items-center gap-2 rounded-xl border border-line bg-base-100 p-4">
        {sponsors.map((s) => {
          const heightVariants = {
            [SponsorSize.Large]: "h-16",
            [SponsorSize.Medium]: "h-12",
            [SponsorSize.Small]: "h-8",
          };

          return (
            <React.Fragment key={s.level}>
              <label>{s.level}</label>
              <div
                className={`grid grid-rows-1 gap-x-1 auto-cols-fr grid-flow-col justify-items-center items-center ${
                  heightVariants[s.size]
                }`}
              >
                {s.vendors.map((v) => {
                  const maxSizeVariants = {
                    [SponsorSize.Large]: "max-h-16",
                    [SponsorSize.Medium]: "max-h-12",
                    [SponsorSize.Small]: "max-h-8",
                  };

                  return (
                    <a key={v.name} href={v.url} target="_blank">
                      <picture aria-label={v.name}>
                        {v.darkModeImg && (
                          <source
                            className={maxSizeVariants[s.size]}
                            srcSet={v.darkModeImg}
                            media="(prefers-color-scheme: dark)"
                          />
                        )}
                        <img className={maxSizeVariants[s.size]} src={v.img} />
                      </picture>
                    </a>
                  );
                })}
              </div>
            </React.Fragment>
          );
        })}
      </div>

      <div className="pt-6">
        <h2 className="font-semibold">Licenses and attribution</h2>
        <p className="mt-2 text-sm leading-relaxed text-base-content/65">
          Wafer Studio is a derivative of{" "}
          <ExternalLink href="https://github.com/zmkfirmware/zmk-studio">
            ZMK Studio
          </ExternalLink>
          , Copyright 2024 The ZMK Contributors, and is released under the same
          Apache License, Version 2.0. Source files changed from upstream carry a
          modification notice in their header, and{" "}
          <ExternalLink href="https://github.com/oleksandrmaslov/wafer-studio/blob/main/MODIFICATIONS.md">
            MODIFICATIONS.md
          </ExternalLink>{" "}
          lists what changed. Desktop builds install a copy of the LICENSE and
          NOTICE files alongside the application.
        </p>

        <details className="group mt-4 rounded-xl border border-line bg-base-100">
          <summary className="cursor-pointer list-none px-4 py-3 text-sm font-semibold marker:content-none">
            NOTICE
            <span className="ml-2 font-normal text-base-content/50 group-open:hidden">
              show
            </span>
          </summary>
          <pre className="max-h-64 overflow-auto whitespace-pre-wrap border-t border-line px-4 py-3 font-mono text-xs text-base-content/70">
            {NOTICE}
          </pre>
        </details>

        <details className="group mt-2 rounded-xl border border-line bg-base-100">
          <summary className="cursor-pointer list-none px-4 py-3 text-sm font-semibold marker:content-none">
            Apache License, Version 2.0
            <span className="ml-2 font-normal text-base-content/50 group-open:hidden">
              show
            </span>
          </summary>
          <pre className="max-h-64 overflow-auto whitespace-pre-wrap border-t border-line px-4 py-3 font-mono text-xs text-base-content/70">
            {LICENSE}
          </pre>
        </details>
      </div>
    </GenericModal>
  );
};

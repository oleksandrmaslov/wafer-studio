# Protocol provenance

Wafer Studio intentionally keeps the official ZMK Studio wire contract behind
its own product and domain layers.

Current foundation pins:

- Upstream UI base: `zmkfirmware/zmk-studio` commit
  `1bb6bb84a370c8917d8e4db15207087b26b3a844`.
- TypeScript RPC client: `@zmkfirmware/zmk-studio-ts-client` `0.0.18`, locked
  with npm registry integrity metadata in `package-lock.json`; its source tag
  points to commit `87ccd3a36280e245f7d6e2116d404ae2ff952ee0`.
- Wire messages: `zmkfirmware/zmk-studio-messages` commit
  `6cb4c283e76209d59c45fbcb218800cd19e9339d`, recorded by the client source
  tag's submodule pointer.

The published package contains generated protobuf code but omits that submodule
SHA from its package metadata. Before protocol-sensitive snapshots, diagnostics,
or exports ship, compare the generated client types with the pinned messages
commit and update both pins together.

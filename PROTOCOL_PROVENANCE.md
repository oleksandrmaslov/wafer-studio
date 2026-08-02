# Protocol provenance

Wafer Studio intentionally keeps the official ZMK Studio wire contract behind
its own product and domain layers.

Current foundation pins:

- Upstream UI base: `zmkfirmware/zmk-studio` commit
  `1bb6bb84a370c8917d8e4db15207087b26b3a844`.
- TypeScript RPC client: `@zmkfirmware/zmk-studio-ts-client` `0.0.18`, locked
  with npm registry integrity metadata in `package-lock.json`.

The published client package contains generated protobuf code but does not
expose the source `zmk-studio-messages` commit in its package metadata. That
messages SHA remains an explicit release blocker: record it alongside generated
type drift checks before Wafer snapshots or diagnostic exports claim a complete
protocol fingerprint.

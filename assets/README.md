# Design sources

Not shipped, not built — these are the masters everything else is derived from.

## `wafer-mark-1024.png`

The app mark at 1024×1024, the smallest size the icon pipeline accepts.
`tauri icon` refuses a source below 1024, so without this file nobody could
regenerate the icon set from a fresh clone: the largest copy anywhere else in
the repository is the 512px `src-tauri/icons/icon.png`, which is an output
rather than a source.

Regenerate every derived icon from it:

```sh
npm run tauri -- icon assets/wafer-mark-1024.png   # desktop, Android, iOS sets
python scripts/generate-social-images.py           # cards, touch, maskable, favicon
```

The original artwork is 6000×6000. It is deliberately not committed — 14 MB of
binary would sit in every clone forever to serve a pipeline that caps out at
1024. Keep it wherever you keep the Figma file.

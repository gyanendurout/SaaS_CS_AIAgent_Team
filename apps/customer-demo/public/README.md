# public/

Drop the JOOLA wordmark SVG here as `joola-logo.svg` and a small favicon as `favicon.ico`.

The header component (`DemoHeader.tsx`) references `/joola-logo.svg` and falls back to a CSS wordmark if the asset is missing, so the app remains demo-safe even before the logo is added.

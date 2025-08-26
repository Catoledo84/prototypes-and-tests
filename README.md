# Prototypes and tests – figma-smart-search

React + TypeScript + Vite prototype for a dynamic search bar with operators and type-aware inputs.

## Local dev
```bash
npm i
npm run dev
```

## Deploy to GitHub Pages
Vite base path is set to `/prototypes-and-tests/` in `vite.config.ts`.

1) Build:
```bash
npm run build
```
2) Publish `dist/` to `gh-pages`:
```bash
npm i -D gh-pages
npx gh-pages -d dist -r https://github.com/Catoledo84/prototypes-and-tests.git
```

Live URL after publish:
`https://Catoledo84.github.io/prototypes-and-tests/`

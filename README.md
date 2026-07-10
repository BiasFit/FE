# BiasFit FE

BiasFit (BF) frontend web app.

## Stack

- React
- TypeScript
- Vite
- Tailwind CSS
- npm
- Vercel

## Local Development

Use a cmd terminal from this `FE` folder.

```bat
npm install
npm run dev
```

## Build

```bat
npm run build
npm run preview
```

## Tailwind CSS

Tailwind is configured through:

- `tailwind.config.ts`
- `postcss.config.cjs`
- `src/styles.css`

Use Tailwind utility classes for layout and component styling. Keep future MVP screens inside the current BiasFit scope:

1. Style DNA diagnosis
2. Virtual stylemate TOP 3 matching
3. Outfit card save/download flow

## Vercel

This project includes `vercel.json` for Vercel deployment:

- Framework: Vite
- Build command: `npm run build`
- Output directory: `dist`
- SPA fallback: all routes rewrite to `index.html`

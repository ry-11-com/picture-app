# Dump — files to upload to GitHub Pages

Upload all 9 files below to your repo (same one you already used —
`ry-11-com.github.io/picture-app/`), replacing what's there. Commit, wait
~30 seconds for Pages to redeploy, then re-check the URL in PWABuilder.

## Files
- `index.html` — the whole app (self-contained, nothing else to load)
- `manifest.json` — now includes: unique `id`, `scope`, `categories`,
  two icon *purposes* (`any` + properly padded `maskable`), and two real
  in-app screenshots — the things that were pulling the score down
- `sw.js` — service worker (offline caching + what makes "Install" show up)
- `icon-192.png`, `icon-512.png` — your camera artwork, as-is (purpose: any)
- `icon-maskable-192.png`, `icon-maskable-512.png` — the same artwork
  recomposed with extra padding so Android's circular/squircle mask
  doesn't crop into it
- `screenshot-1.jpg`, `screenshot-2.jpg` — real screenshots of the app
  (Home and Studio), used for the richer install prompt

## After uploading
1. Recheck `https://ry-11-com.github.io/picture-app/` in PWABuilder —
   the manifest section should now score much higher.
2. If it's green, go straight to Package for stores → Android, same
   steps as before, to get your `.apk`.

## If the score still isn't 100
The remaining points on a PWABuilder report are usually **Service
Worker** checks (e.g. background sync, push notification support) —
those are optional, store-readiness extras that don't affect whether
the app installs or works. It's fine to ship without them.

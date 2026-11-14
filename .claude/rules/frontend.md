---
paths:
  - frontend/**
---

# Frontend

- Verbindliche Regeln: [docs/DEVELOPMENT-GUIDELINES.md](../../docs/DEVELOPMENT-GUIDELINES.md).
- Runtime-Config (OIDC) kommt aus `/config.js`: im Container per `envsubst` aus `.docker/nginx/config.js.template` erzeugt, `public/config.js` ist im Repo bewusst leer (ohne sie lieferte der Dev-Server per SPA-Fallback HTML statt JS); der Dev-Server nimmt die Werte aus `frontend/.env.local` (`VITE_OIDC_*`, Vorlage `.env.example`). Neue Laufzeitwerte in Template **und** Entrypoint ergänzen.
- `__COMMIT_HASH__` setzt `vite.config.js` aus `git rev-parse` oder dem Build-Arg `COMMIT_HASH` (`scripts/deploy.sh`).
- Service Worker kommt aus `vite-plugin-pwa` (`registerType: autoUpdate`). Bilder unter `/api/v1/images/…` werden CacheFirst gecacht; deshalb sind Bild-URLs UUID-basiert und unveränderlich.
- Der Viewport in `index.html` sperrt Pinch-Zoom absichtlich (Koch-Modus auf iOS).

## Sitzung und Login
- Sitzungslogik in `src/auth/session.ts`, OIDC-Setup in `src/auth/oidc.ts`. `requestLogin` ist die einzige Stelle mit Login-Redirect; Routen ohne Login tragen `meta.public`.
- oidc-client-ts: `signinSilent()` ohne `silentRequestTimeoutInSeconds` läuft **ohne** Timeout (das `undefined` überschreibt per Spread den Settings-Default). Immer explizit übergeben.
- Die Access-Token-Laufzeit im IdP muss über 60 s liegen, sonst feuert der Expiring-Timer (Default 60 s vor Ablauf) sofort wieder und die Erneuerung läuft in Schleife.
- `npm ci` immer ohne `--legacy-peer-deps`: Den Peer-Konflikt `vite-plugin-pwa` 1.x ↔ Vite 8 löst der Override in `package.json`. Das Flag ignoriert alle Peers (u. a. fehlt dann `eslint`, das bis W.15 nur als Peer im Lock steht). Im Frontend-Dockerfile entfällt es mit W.5.

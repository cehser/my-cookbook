---
paths:
  - frontend/**
---

# Frontend

- Verbindliche Regeln: [docs/DEVELOPMENT-GUIDELINES.md](../../docs/DEVELOPMENT-GUIDELINES.md).
- Runtime-Config (OIDC) kommt aus `/config.js`: im Container per `envsubst` aus `.docker/nginx/config.js.template` erzeugt, `public/config.js` gilt nur für den Dev-Server. Neue Laufzeitwerte in Template **und** Entrypoint ergänzen.
- `__COMMIT_HASH__` setzt `vite.config.js` aus `git rev-parse` oder dem Build-Arg `COMMIT_HASH` (`scripts/deploy.sh`).
- Service Worker kommt aus `vite-plugin-pwa` (`registerType: autoUpdate`). Bilder unter `/api/v1/images/…` werden CacheFirst gecacht; deshalb sind Bild-URLs UUID-basiert und unveränderlich.
- Der Viewport in `index.html` sperrt Pinch-Zoom absichtlich (Koch-Modus auf iOS).

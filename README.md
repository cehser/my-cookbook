# my-cookbook

> **⚠️ Vue 3 Migration in Progress**  
> Branch: `vue3-migration`  
> See [VUE3_MIGRATION.md](VUE3_MIGRATION.md) for details and roadmap.

Ein persönliches Kochbuch als Progressive Web App (PWA) mit Vue 3, Vite und WebDAV-Sync.

## Features
- 📱 PWA - Offline-fähig, installierbar
- ☁️ WebDAV Sync - Rezepte in der Cloud speichern
- 🔍 Suche und Filter
- 📊 Mengenumrechnung
- 📷 Rezeptbilder
- 🔗 QR-Code zum Teilen der Konfiguration

## Development Setup

### Mit Docker (empfohlen)
```bash
# Dev-Server starten
docker-compose -f docker-compose.dev.yml up

# Öffne http://localhost:8080
```

### Lokal (ohne Docker)
```bash
npm install --legacy-peer-deps
npm run dev
```

## Update package-lock.json
Hin und wieder muss die package-lock.json erneuert werden. Am einfachsten geht das mit Docker (hier Powershell):

```
docker run --rm -it -v ${PWD}:/app -w /app node:lts-alpine sh -c "
  npm cache clean --force &&
  rm -f package-lock.json &&
  npm install --legacy-peer-deps &&
  chown $(id -u):$(id -g) package-lock.json 2>/dev/null || true
"
```

## Project setup
```
npm install
```

### Compiles and hot-reloads for development
```
npm run serve
```

### Compiles and minifies for production
```
npm run build
```

### Lints and fixes files
```
npm run lint
```

### Customize configuration
See [Configuration Reference](https://cli.vuejs.org/config/).

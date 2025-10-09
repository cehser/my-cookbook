# my-cookbook3

## Update packacke-lock.json
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

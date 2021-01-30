module.exports = {
  // ...other vue-cli plugin options...
  pwa: {
    name: 'Kochbuch',
    themeColor: '#4DBA87',
    msTileColor: '#000000',
    appleMobileWebAppCapable: 'yes',
    appleMobileWebAppStatusBarStyle: 'black',

    manifestOptions: {
      name: 'Kochbuch',
      short_name: 'Kochbuch',
      start_url: '.',
      lang: 'de',
      display: 'standalone',
      theme_color: '#4DBA87',
      icons: [
        {
          src: 'img/favicon.svg',
          sizes: '942x942',
          type: 'image/svg+xml'
        }
      ],
    },

    iconPaths: {
      favicon32: null,
      favicon16: null,
      appleTouchIcon: 'img/favicon180x180.png',
      maskIcon: 'img/favicon.svg',
      icon: 'img/favicon.svg',
      msTileImage: 'img/favicon180x180.png'
    },

    // configure the workbox plugin
    workboxPluginMode: 'GenerateSW',
  }
}
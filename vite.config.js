import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: '/corso-caccia/',
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      // Registriamo il SW manualmente in main.jsx (virtual:pwa-register) per avere
      // l'auto-reload alla nuova versione; evitiamo quindi lo script auto-iniettato.
      injectRegister: false,
      includeAssets: ['favicon.png', 'apple-touch-icon.png', 'icon-192.png', 'icon-512.png', 'icon-512-maskable.png'],
      manifest: {
        name: 'Corso Caccia — Simulatore Esame Venatorio',
        short_name: 'Corso Caccia',
        description: 'Simulatore d\'esame per l\'abilitazione venatoria (Lombardia). 824 domande, esame a tempo, simulazioni per sezione. Funziona offline.',
        id: '/corso-caccia/',
        start_url: '/corso-caccia/',
        scope: '/corso-caccia/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#052e16',
        theme_color: '#052e16',
        lang: 'it',
        categories: ['education'],
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webmanifest}'],
        navigateFallback: '/corso-caccia/index.html',
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: []
      }
    })
  ]
})

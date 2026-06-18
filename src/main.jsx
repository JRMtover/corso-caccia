import { createRoot } from 'react-dom/client'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(<App />)

// --- Registrazione service worker con aggiornamento AFFIDABILE ---
// Il SW generato (workbox skipWaiting + clientsClaim) attiva subito la nuova versione.
// Qui ne forziamo il pickup sul dispositivo:
//  - updateViaCache:'none' -> il controllo di sw.js bypassa la cache HTTP (GitHub Pages
//    serve sw.js con max-age=600, che altrimenti ritarderebbe il rilevamento);
//  - registration.update() al ritorno in foreground (il setInterval è inaffidabile in
//    background sulle PWA mobili) + un controllo periodico per sessioni lunghe;
//  - al cambio di controller (nuovo SW attivo) si ricarica UNA volta per mostrare la
//    versione nuova.
if ('serviceWorker' in navigator) {
  let refreshing = false
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (refreshing) return
    refreshing = true
    window.location.reload()
  })

  window.addEventListener('load', () => {
    const swUrl = `${import.meta.env.BASE_URL}sw.js`
    navigator.serviceWorker.register(swUrl, { updateViaCache: 'none' })
      .then((registration) => {
        registration.update()
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible') registration.update()
        })
        setInterval(() => registration.update(), 60 * 60 * 1000)
      })
      .catch(() => { /* in dev sw.js può non esistere: ignora */ })
  })
}

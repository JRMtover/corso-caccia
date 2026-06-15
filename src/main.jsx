import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import App from './App.jsx'

// autoUpdate: appena viene pubblicata una nuova versione, il nuovo service worker
// prende il controllo e la pagina si ricarica AUTOMATICAMENTE sulla versione nuova
// (così non si resta mai bloccati su una versione vecchia in cache). Controlla anche
// la presenza di aggiornamenti ogni ora per le sessioni rimaste aperte a lungo.
registerSW({
  immediate: true,
  onRegisteredSW(swUrl, registration) {
    if (registration) {
      setInterval(() => registration.update(), 60 * 60 * 1000)
    }
  },
})

createRoot(document.getElementById('root')).render(<App />)

# Corso Caccia — Simulatore Esame Venatorio (PWA)

App live: **https://jrmtover.github.io/corso-caccia/**

Progressive Web App per la preparazione all'esame di abilitazione venatoria
(Lombardia). 824 domande, simulazione d'esame a tempo, simulazioni per sezione,
modalità studio. Funziona **completamente offline** dopo la prima apertura.

## Stack
- **Vite + React** (JSX precompilato, nessun Babel a runtime, nessun CDN)
- **Tailwind CSS** compilato staticamente
- **vite-plugin-pwa / Workbox** — service worker con precache dell'intero app-shell

## Sviluppo
```bash
npm install
npm run dev       # server di sviluppo
npm run build     # build di produzione in dist/
npm run preview   # anteprima della build
```

## Come aggiornare le domande
Tutte le domande sono in **`src/data.js`**.

Formato di ogni domanda:
```js
_q("id", "Sezione", "Testo della domanda?", "Opzione A", "Opzione B", "Opzione C", "a")
//        |          |                       |            |            |           ^ risposta corretta: "a" | "b" | "c"
//        |          sezione                 opzioni
//        id univoco
```

Sezioni d'esame (bilanciamento 30 domande: 10/7/7/6):
`Legislazione` (10) · `Zoologia` (7) · `Armi` (7) · `Tutela Natura` (6).
Altre sezioni disponibili solo per le simulazioni per materia:
`Pronto Soccorso`, `CaniDaCaccia`, `Ecologia`, `Riconoscimento`, `SpecieCacciabili`.

Per aggiungere una domanda: inserisci una nuova riga `_q(...)` nell'array
`QUESTIONS` (o `GEN_QUESTIONS`) con un `id` univoco.

## Come ripubblicare
Il deploy è **automatico**: a ogni `git push` sul branch `main`, la GitHub Action
(`.github/workflows/deploy.yml`) builda e pubblica `dist/` su GitHub Pages.

```bash
git add -A
git commit -m "Aggiorna domande"
git push
```
In ~1 minuto il sito è aggiornato. Gli utenti con l'app già installata ricevono
la nuova versione automaticamente al successivo avvio (service worker autoUpdate).

## Installazione su telefono
- **iOS (Safari):** Condividi → "Aggiungi a Home"
- **Android (Chrome):** menu ⋮ → "Installa app" / "Aggiungi a schermata Home"

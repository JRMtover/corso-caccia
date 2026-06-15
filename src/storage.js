// Persistenza locale dello storico esami (tracking dell'andamento della preparazione).
// Usa localStorage; se non disponibile (es. modalità privata) degrada senza errori.
const KEY = "corsoCaccia.examHistory.v1";

export function loadHistory() {
  try {
    const raw = localStorage.getItem(KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export function saveHistory(history) {
  try {
    localStorage.setItem(KEY, JSON.stringify(history));
  } catch {
    /* storage non disponibile: lo storico resta solo in memoria per la sessione */
  }
}

export function clearHistory() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* no-op */
  }
}

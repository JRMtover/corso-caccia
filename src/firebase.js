// Backend condiviso (classifica globale) — Firebase Firestore + autenticazione anonima.
//
// Modello dati: collection "players", un documento per dispositivo (id = uid anonimo
// di Firebase, stabile per browser). Ogni documento contiene nome, hash dell'IP
// (solo come identificatore, MAI mostrato) e statistiche aggregate.
//
// La classifica è pubblica in LETTURA; in SCRITTURA ciascuno può modificare solo il
// proprio documento (regola request.auth.uid == uid), così non si possono falsificare
// i punteggi altrui. La apiKey qui sotto è pubblica per natura (è così per le web app
// Firebase): la sicurezza è garantita dalle regole Firestore, non dal nascondere la key.
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously } from 'firebase/auth';
import {
  initializeFirestore, persistentLocalCache, persistentMultipleTabManager,
  collection, doc, query, limit, onSnapshot, runTransaction, setDoc, serverTimestamp,
} from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyAJlmShl-p_O9uaygosHOUiX8yyx-PD5dQ",
  authDomain: "caccia-simulator.firebaseapp.com",
  projectId: "caccia-simulator",
  storageBucket: "caccia-simulator.firebasestorage.app",
  messagingSenderId: "1022715655092",
  appId: "1:1022715655092:web:d15d72b032c441e197f8e1",
};

// Finché i valori sono i segnaposto, le funzioni cloud sono disattivate e l'app
// funziona comunque (solo lo storico locale). Verrà attivata inserendo la config.
export const isConfigured = !String(firebaseConfig.apiKey).startsWith('__');

let db = null, uidPromise = Promise.resolve(null);

if (isConfigured) {
  const app = initializeApp(firebaseConfig);
  // Cache locale persistente: la classifica resta visibile anche offline (ultimo
  // dato noto) e le scritture fatte offline si sincronizzano al ritorno online.
  db = initializeFirestore(app, {
    localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
  });
  uidPromise = signInAnonymously(getAuth(app)).then(c => c.user.uid).catch(() => null);
}

export function getUid() { return uidPromise; }

// SHA-256 dell'IP pubblico (recuperato da un servizio esterno). Restituisce l'hash
// esadecimale, oppure null se non disponibile (es. offline). L'IP in chiaro non viene
// mai memorizzato né trasmesso al nostro backend.
export async function hashIp() {
  try {
    const res = await fetch('https://api.ipify.org?format=json', { cache: 'no-store' });
    const { ip } = await res.json();
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(ip));
    return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
  } catch {
    return null;
  }
}

function cleanName(name) {
  return (name || '').trim().slice(0, 30) || 'Anonimo';
}

// Registra/aggiorna il profilo del giocatore (nome + hash IP), senza toccare le
// statistiche. Usato quando l'utente imposta/cambia il nome.
export async function registerPlayer(name, ipHash) {
  if (!isConfigured) return;
  const uid = await uidPromise;
  if (!uid) return;
  await setDoc(doc(db, 'players', uid), {
    name: cleanName(name),
    ipHash: ipHash ?? null,
    updatedAt: serverTimestamp(),
  }, { merge: true });
}

// Registra l'esito di un esame (transazione atomica). Mantiene:
// - aggregati: esami, superati, somma errori, somma tempo, record errori/punteggio/tempo;
// - per sezione: corrette/totali cumulative (per le percentuali nel dettaglio);
// - storico: ultimi 20 esami (data, punteggio, errori, esito, tempo) per la schermata dettaglio.
export async function recordExamResult(result, name, ipHash) {
  if (!isConfigured) return;
  const uid = await uidPromise;
  if (!uid) return;
  const ref = doc(db, 'players', uid);
  const nowIso = new Date().toISOString();
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    const p = snap.exists() ? snap.data() : {};
    const time = result.timeUsed || 0;
    const examsTaken = (p.examsTaken || 0) + 1;
    const passedCount = (p.passedCount || 0) + (result.passed ? 1 : 0);
    const sumErrors = (p.sumErrors || 0) + result.errors;
    const sumTime = (p.sumTime || 0) + time;
    const bestErrors = Math.min(p.bestErrors ?? 99, result.errors);
    const bestScore = Math.max(p.bestScore ?? 0, result.score);
    // miglior tempo solo tra gli esami superati
    let bestTime = p.bestTime ?? null;
    if (result.passed) bestTime = bestTime == null ? time : Math.min(bestTime, time);

    // aggregati per sezione: { Sezione: { c: corrette, t: totali } }
    const sec = { ...(p.sec || {}) };
    for (const [s, v] of Object.entries(result.perSection || {})) {
      const cur = sec[s] || { c: 0, t: 0 };
      sec[s] = { c: cur.c + (v.correct || 0), t: cur.t + (v.total || 0) };
    }

    // storico (ultimi 20 esami)
    const history = [...(p.history || []), {
      ts: nowIso, score: result.score, errors: result.errors, passed: !!result.passed, time,
    }].slice(-20);

    tx.set(ref, {
      name: cleanName(name || p.name),
      ipHash: ipHash ?? p.ipHash ?? null,
      examsTaken, passedCount, sumErrors, sumTime,
      bestErrors, bestScore, bestTime,
      sec, history,
      lastErrors: result.errors, lastPassed: !!result.passed,
      updatedAt: serverTimestamp(),
    }, { merge: true });
  });
}

// Si iscrive in tempo reale alla classifica globale. Richiama cb(players[]) ad ogni
// aggiornamento. Restituisce la funzione di disiscrizione (o null se non configurato).
export function subscribeLeaderboard(cb) {
  if (!isConfigured) return null;
  const q = query(collection(db, 'players'), limit(200));
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map(d => d.data()).filter(p => (p.examsTaken || 0) > 0));
  }, () => cb(null));
}

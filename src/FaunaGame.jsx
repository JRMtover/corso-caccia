import { useState, useMemo, useEffect } from 'react';
import { FAUNA } from './fauna.js';

const ROUND_SIZE = 10;
const BASE = import.meta.env.BASE_URL;

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Pool globali per i distrattori
const ALL_COMMON = [...new Set(FAUNA.map(f => f.common))];
const ALL_SCI = [...new Set(FAUNA.map(f => f.sci))];
const ALL_FAMILY = [...new Set(FAUNA.map(f => f.family))];

function pickDistractors(pool, correct, n, preferred = []) {
  const out = [];
  for (const p of shuffle(preferred)) {
    if (out.length >= n) break;
    if (p !== correct && !out.includes(p)) out.push(p);
  }
  for (const p of shuffle(pool)) {
    if (out.length >= n) break;
    if (p !== correct && !out.includes(p)) out.push(p);
  }
  return out;
}

const STAGES = [
  { key: 'common', label: 'Che animale è?', kind: 'nome' },
  { key: 'sci', label: 'Qual è la specie (nome scientifico)?', kind: 'specie' },
  { key: 'family', label: 'A quale famiglia appartiene?', kind: 'famiglia' },
];

export default function FaunaGame({ onExit }) {
  const queue = useMemo(() => shuffle(FAUNA).slice(0, ROUND_SIZE), []);
  const [pos, setPos] = useState(0);
  const [stage, setStage] = useState(0);
  const [wrong, setWrong] = useState([]);       // opzioni sbagliate in questo step
  const [solved, setSolved] = useState(false);
  const [errors, setErrors] = useState(0);
  const [perfect, setPerfect] = useState(0);    // animali completati senza errori
  const [animalErr, setAnimalErr] = useState(false); // errore su questo animale
  const [done, setDone] = useState(false);

  const animal = queue[pos];
  const st = STAGES[stage];

  // Opzioni per lo step corrente (3: 1 corretta + 2 distrattori)
  const options = useMemo(() => {
    if (!animal) return [];
    const correct = animal[st.key];
    let distract;
    if (st.key === 'sci') {
      const sameFam = FAUNA.filter(f => f.family === animal.family && f.sci !== correct).map(f => f.sci);
      distract = pickDistractors(ALL_SCI, correct, 2, sameFam);
    } else if (st.key === 'family') {
      distract = pickDistractors(ALL_FAMILY, correct, 2);
    } else {
      distract = pickDistractors(ALL_COMMON, correct, 2);
    }
    return shuffle([correct, ...distract]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pos, stage]);

  // Avanzamento automatico dopo una risposta corretta
  useEffect(() => {
    if (!solved) return;
    const t = setTimeout(() => {
      if (stage < STAGES.length - 1) {
        setStage(s => s + 1);
        setWrong([]); setSolved(false);
      } else {
        // animale completato
        if (!animalErr) setPerfect(p => p + 1);
        if (pos + 1 >= queue.length) {
          setDone(true);
        } else {
          setPos(p => p + 1); setStage(0); setWrong([]); setSolved(false); setAnimalErr(false);
        }
      }
    }, 700);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [solved]);

  if (!FAUNA.length || !animal) return (
    <div className="min-h-screen bg-gradient-to-br from-green-950 to-emerald-900 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl p-8 text-center max-w-md w-full">
        <div className="text-5xl mb-3">📭</div>
        <p className="text-gray-700 font-bold mb-5">Nessun animale disponibile.</p>
        <button onClick={onExit} className="bg-green-700 hover:bg-green-600 text-white font-black rounded-2xl py-3 px-6">Torna alla Home</button>
      </div>
    </div>
  );

  if (done) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-950 to-emerald-900 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl shadow-2xl p-8 max-w-md w-full text-center">
          <div className="text-6xl mb-3">{perfect === queue.length ? '🏆' : perfect >= queue.length * 0.6 ? '👍' : '📚'}</div>
          <h2 className="text-2xl font-black text-green-900 mb-1">Riconoscimento completato</h2>
          <p className="text-gray-500 mb-5">{queue.length} animali</p>
          <div className="grid grid-cols-2 gap-3 mb-5">
            <div className="bg-green-50 rounded-2xl p-3"><div className="text-2xl font-black text-green-600">{perfect}/{queue.length}</div><div className="text-green-700 text-xs">Senza errori</div></div>
            <div className="bg-red-50 rounded-2xl p-3"><div className="text-2xl font-black text-red-600">{errors}</div><div className="text-red-700 text-xs">Errori totali</div></div>
          </div>
          <button onClick={onExit} className="w-full bg-green-700 hover:bg-green-600 text-white font-black text-lg rounded-2xl py-4 transition-all">Torna alla Home</button>
        </div>
      </div>
    );
  }

  const pick = (opt) => {
    if (solved) return;
    if (wrong.includes(opt)) return;
    if (opt === animal[st.key]) {
      setSolved(true);
    } else {
      setWrong(w => [...w, opt]);
      setErrors(e => e + 1);
      setAnimalErr(true);
    }
  };

  const optStyle = (opt) => {
    if (solved && opt === animal[st.key]) return 'bg-green-500 border-green-600 text-white font-bold';
    if (wrong.includes(opt)) return 'bg-red-500 border-red-600 text-white font-bold opacity-70';
    return 'bg-white border-gray-200 hover:border-amber-400 hover:bg-amber-50 text-gray-800';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-950 to-emerald-900 flex flex-col items-center p-4">
      <div className="w-full max-w-lg mt-5 mb-3">
        <div className="flex justify-between items-center mb-2">
          <button onClick={onExit} className="text-green-400 hover:text-white text-sm font-bold">← Esci</button>
          <span className="text-white text-sm font-black">🦌 Indovina l'animale</span>
          <span className="text-green-300 text-sm font-bold">{pos + 1}/{queue.length}</span>
        </div>
        {/* indicatore dei 3 livelli */}
        <div className="flex gap-1.5">
          {STAGES.map((s, i) => (
            <div key={s.key} className={'flex-1 h-1.5 rounded-full ' + (i < stage ? 'bg-green-400' : i === stage ? 'bg-amber-400' : 'bg-white/20')} />
          ))}
        </div>
      </div>

      {/* Foto */}
      <div className="w-full max-w-lg mb-4">
        <div className="w-full rounded-3xl overflow-hidden bg-white/10 shadow-xl" style={{ aspectRatio: '4 / 3' }}>
          <img src={BASE + animal.img} alt="Animale da riconoscere" className="w-full h-full object-cover" loading="eager" />
        </div>
        {/* man mano che si indovina, si mostrano i dati già scoperti */}
        {stage > 0 && (
          <p className="text-center text-green-300 text-sm mt-2 font-bold">
            {animal.common}{stage > 1 ? <span className="italic text-green-400"> · {animal.sci}</span> : null}
          </p>
        )}
      </div>

      <div className="w-full max-w-lg mb-3">
        <p className="text-amber-300 text-sm font-black text-center">{st.label}</p>
      </div>

      <div className="w-full max-w-lg flex flex-col gap-3">
        {options.map(opt => (
          <button key={opt} onClick={() => pick(opt)}
            className={'w-full text-center px-5 py-4 rounded-2xl transition-all duration-100 leading-snug border-2 ' +
              (st.key === 'sci' ? 'italic ' : '') + 'text-base ' + optStyle(opt)}>
            {opt}
          </button>
        ))}
      </div>

      {solved && (
        <p className="text-green-400 font-bold mt-4 text-center">✓ {st.kind === 'famiglia' ? 'Completato!' : 'Esatto!'}</p>
      )}
    </div>
  );
}

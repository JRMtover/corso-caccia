import { useState, useMemo, useEffect } from 'react';
import { QUESTIONS, SECTION_COLORS, SECTION_EMOJI } from './data.js';
import { loadHistory, saveHistory, clearHistory } from './storage.js';
import { isConfigured as cloudEnabled, hashIp, registerPlayer, recordExamResult, subscribeLeaderboard } from './firebase.js';
import './index.css';

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function uniqueByStem(arr) {
  const seen = new Set(); const out = [];
  for (const q of arr) {
    const k = q.question.trim().toLowerCase();
    if (!seen.has(k)) { seen.add(k); out.push(q); }
  }
  return out;
}

const POOLS = {};
QUESTIONS.forEach(q => { (POOLS[q.section] = POOLS[q.section] || []).push(q); });

const EXAM_BLUEPRINT = [
  { section: "Legislazione", n: 10 },
  { section: "Zoologia",     n: 7 },
  { section: "Armi",         n: 7 },
  { section: "Tutela Natura",n: 6 },
];
const EXAM_TIME = 30 * 60;
const MAX_ERRORS = 4;

function buildExam() {
  const seen = new Set(); const out = [];
  EXAM_BLUEPRINT.forEach(b => {
    let added = 0;
    for (const q of shuffle(POOLS[b.section] || [])) {
      if (added >= b.n) break;
      const k = q.question.trim().toLowerCase();
      if (seen.has(k)) continue;
      seen.add(k); out.push(q); added++;
    }
  });
  return shuffle(out);
}

const SECTION_SIMS = [
  { key: "Legislazione",    label: "Legislazione venatoria",      emoji: "⚖️", color: "#3b82f6" },
  { key: "Zoologia",        label: "Zoologia e specie",           emoji: "🦌", color: "#22c55e" },
  { key: "Armi",            label: "Armi e munizioni",            emoji: "🔫", color: "#f97316" },
  { key: "Tutela Natura",   label: "Tutela della natura",         emoji: "🌿", color: "#a855f7" },
  { key: "Pronto Soccorso", label: "Primo soccorso",              emoji: "🏥", color: "#ef4444" },
  { key: "CaniDaCaccia",    label: "Cani da caccia",              emoji: "🐕", color: "#92400e" },
  { key: "Ecologia",        label: "Ecologia",                    emoji: "🌍", color: "#0d9488" },
  { key: "Riconoscimento",  label: "Riconoscimento fauna",        emoji: "🔎", color: "#65a30d" },
  { key: "SpecieCacciabili",label: "Specie cacciabili e periodi", emoji: "📅", color: "#0891b2" },
];

function fmtTime(s) {
  const m = Math.floor(s / 60), x = s % 60;
  return (m < 10 ? "0" : "") + m + ":" + (x < 10 ? "0" : "") + x;
}

function ProgressBar({ current, total, color = "bg-amber-500" }) {
  const pct = total > 0 ? Math.round((current / total) * 100) : 0;
  return (
    <div className="w-full bg-white/20 rounded-full h-2.5">
      <div className={color + " h-2.5 rounded-full transition-all duration-300"} style={{ width: pct + "%" }} />
    </div>
  );
}

function SectionBadge({ section }) {
  return (
    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold text-white"
      style={{ backgroundColor: (SECTION_COLORS[section] || "#475569") + "cc" }}>
      {SECTION_EMOJI[section] || "📘"} {section}
    </span>
  );
}

function HomeScreen({ player, setPlayer, onRegister, history, onResetHistory, cloudEnabled, leaderboard, onExam, onStudy, onSection }) {
  const [open, setOpen] = useState(false);
  const n = history.length;
  const recent = [...history].reverse();                                   // più recenti in cima
  const passRate = n ? Math.round(history.filter(e => e.passed).length / n * 100) : 0;
  const avgErr = n ? history.reduce((s, e) => s + e.errors, 0) / n : 0;
  const bestErr = n ? Math.min(...history.map(e => e.errors)) : 0;
  const trend = history.slice(-12);                                        // ultimi 12 per il grafico
  const trendMax = Math.max(6, ...trend.map(e => e.errors));

  // Classifica globale: ordina per % superati, poi minor record errori, poi più esami.
  const ranked = (leaderboard || []).map(p => ({
    ...p,
    rate: p.examsTaken ? p.passedCount / p.examsTaken : 0,
    avg: p.examsTaken ? p.sumErrors / p.examsTaken : 0,
  })).sort((a, b) => b.rate - a.rate || a.bestErrors - b.bestErrors || b.examsTaken - a.examsTaken);
  const myName = player.trim().toLowerCase();

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-950 via-green-900 to-emerald-900 flex flex-col items-center p-4 pb-12">
      <div className="w-full max-w-lg mt-8 mb-5 text-center">
        <div className="text-6xl mb-1 fly">🦆</div>
        <h1 className="text-4xl font-black text-white tracking-tight">Corso Caccia</h1>
        <p className="text-green-300 text-base mt-1">Simulatore Esame Venatorio · Lombardia</p>
        <p className="text-green-500 text-xs mt-1">{QUESTIONS.length} domande ufficiali · Allegato B1 L.R. 26/93</p>
      </div>

      <div className="w-full max-w-lg mb-5">
        <label htmlFor="player" className="block text-green-300 text-xs font-bold mb-1 ml-1">GIOCATORE</label>
        <input id="player" value={player} onChange={e => setPlayer(e.target.value)}
          onBlur={e => onRegister(e.target.value)} maxLength={30}
          placeholder="Inserisci il tuo nome…"
          className="w-full bg-white/10 text-white placeholder-green-600 rounded-2xl px-4 py-3 text-lg font-bold outline-none border-2 border-transparent focus:border-amber-400 transition-colors backdrop-blur" />
        {cloudEnabled && <p className="text-green-500 text-xs mt-1 ml-1">Il nome ti fa comparire nella classifica globale condivisa.</p>}
      </div>

      <div className="w-full max-w-lg flex flex-col gap-3">
        <button onClick={onExam}
          className="bg-green-700 hover:bg-green-600 active:bg-green-800 text-white font-black text-xl rounded-2xl py-5 px-6 shadow-xl transition-all duration-150 flex items-center gap-4 text-left">
          <span className="text-3xl">📝</span>
          <div><div>Simulazione Esame</div><div className="text-sm font-normal text-green-100">30 domande · 30 min · max 4 errori</div></div>
        </button>

        <div className="bg-white/10 rounded-2xl overflow-hidden backdrop-blur border border-white/10">
          <button onClick={() => setOpen(o => !o)} aria-expanded={open}
            className="w-full text-white font-black text-xl py-5 px-6 flex items-center gap-4 hover:bg-white/5 transition-colors text-left">
            <span className="text-3xl">🎯</span>
            <div className="flex-1"><div>Simulazioni per Sezione</div><div className="text-sm font-normal opacity-80">Allenati su una singola materia</div></div>
            <span className={"text-2xl transition-transform duration-200 " + (open ? "rotate-180" : "")}>▾</span>
          </button>
          {open && (
            <div className="px-3 pb-3 pt-1 flex flex-col gap-2 max-h-96 overflow-y-auto">
              {SECTION_SIMS.map(s => (
                <button key={s.key} onClick={() => onSection(s)}
                  className="w-full flex items-center gap-3 rounded-xl px-4 py-3 text-left bg-white/10 hover:bg-white/20 active:scale-95 transition-all">
                  <span className="text-2xl">{s.emoji}</span>
                  <div className="flex-1">
                    <div className="font-bold text-white">{s.label}</div>
                    <div className="text-xs text-green-300">{(POOLS[s.key] || []).length} domande disponibili</div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <button onClick={onStudy}
          className="bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-green-950 font-black text-xl rounded-2xl py-5 px-6 shadow-xl transition-all duration-150 flex items-center gap-4 text-left">
          <span className="text-3xl">📖</span>
          <div><div>Modalità Studio</div><div className="text-sm font-normal text-green-950">Tutte le domande con feedback immediato</div></div>
        </button>
      </div>

      {n > 0 && (
        <div className="w-full max-w-lg mt-7">
          <div className="flex items-center justify-between mb-2">
            <p className="text-amber-400 text-sm font-black">📊 IL TUO ANDAMENTO</p>
            <button onClick={onResetHistory} className="text-green-500 hover:text-red-400 text-xs font-bold transition-colors">Cancella storico</button>
          </div>

          {/* Statistiche aggregate */}
          <div className="grid grid-cols-4 gap-2 mb-3">
            <div className="bg-white/10 rounded-xl p-2.5 text-center backdrop-blur">
              <div className="text-xl font-black text-white">{n}</div>
              <div className="text-green-300 text-[10px]">Esami</div>
            </div>
            <div className="bg-white/10 rounded-xl p-2.5 text-center backdrop-blur">
              <div className="text-xl font-black text-green-400">{passRate}%</div>
              <div className="text-green-300 text-[10px]">Superati</div>
            </div>
            <div className="bg-white/10 rounded-xl p-2.5 text-center backdrop-blur">
              <div className="text-xl font-black text-amber-300">{avgErr.toFixed(1)}</div>
              <div className="text-green-300 text-[10px]">Media err.</div>
            </div>
            <div className="bg-white/10 rounded-xl p-2.5 text-center backdrop-blur">
              <div className="text-xl font-black text-white">{bestErr}</div>
              <div className="text-green-300 text-[10px]">Record err.</div>
            </div>
          </div>

          {/* Grafico trend: errori per esame (più basso = meglio); verde se superato */}
          {trend.length > 1 && (
            <div className="bg-white/10 rounded-2xl p-3 mb-3 backdrop-blur">
              <div className="flex items-end justify-between gap-1 h-20">
                {trend.map((e, i) => (
                  <div key={i} className="flex-1 flex flex-col items-center justify-end h-full" title={e.errors + " errori"}>
                    <div className={"w-full rounded-t " + (e.passed ? "bg-green-500" : "bg-red-500")}
                      style={{ height: Math.max(6, Math.round(e.errors / trendMax * 100)) + "%" }} />
                  </div>
                ))}
              </div>
              <p className="text-green-400 text-[10px] text-center mt-1.5">Errori per esame (verde = superato) · ultimi {trend.length}</p>
            </div>
          )}

          {/* Storico recente */}
          <div className="bg-white/10 rounded-2xl overflow-hidden backdrop-blur divide-y divide-white/10">
            {recent.slice(0, 6).map((e, i) => (
              <div key={i} className="flex items-center gap-2 px-4 py-2.5">
                <span className="text-green-300 text-xs flex-1 truncate">{e.date}</span>
                <span className={"text-xs font-bold " + (e.passed ? "text-green-400" : "text-red-400")}>{e.passed ? "PROMOSSO" : "RESPINTO"}</span>
                <span className="text-white text-xs w-12 text-right">{e.score}/{e.total}</span>
                <span className="text-red-300 text-xs w-12 text-right">{e.errors} err</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Classifica globale condivisa tra tutti i giocatori (Firebase) */}
      {cloudEnabled && (
        <div className="w-full max-w-lg mt-7">
          <p className="text-amber-400 text-sm font-black mb-2">🏆 CLASSIFICA GLOBALE</p>
          {leaderboard === null ? (
            <div className="bg-white/10 rounded-2xl p-4 text-center text-green-300 text-sm backdrop-blur">Caricamento classifica…</div>
          ) : ranked.length === 0 ? (
            <div className="bg-white/10 rounded-2xl p-4 text-center text-green-300 text-sm backdrop-blur">
              Nessun giocatore ancora in classifica. Inserisci il nome e completa un esame per essere il primo! 🦆
            </div>
          ) : (
            <div className="bg-white/10 rounded-2xl overflow-hidden backdrop-blur divide-y divide-white/10">
              {ranked.slice(0, 20).map((p, i) => {
                const mine = p.name && p.name.trim().toLowerCase() === myName;
                return (
                  <div key={i} className={"flex items-center gap-2 px-3 py-2.5 " + (mine ? "bg-amber-400/15" : "")}>
                    <span className="w-6 text-center font-black text-sm"
                      style={{ color: i === 0 ? "#fbbf24" : i === 1 ? "#cbd5e1" : i === 2 ? "#d97706" : "#4d7c5a" }}>
                      {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : i + 1}
                    </span>
                    <span className="flex-1 text-white font-bold truncate text-sm">{p.name || "Anonimo"}</span>
                    <span className="text-green-300 text-xs w-9 text-right" title="esami svolti">{p.examsTaken}🎯</span>
                    <span className="text-green-400 text-xs font-bold w-10 text-right" title="% superati">{Math.round(p.rate * 100)}%</span>
                    <span className="text-amber-300 text-xs w-12 text-right" title="record errori (più basso = meglio)">{p.bestErrors} err</span>
                  </div>
                );
              })}
            </div>
          )}
          <p className="text-green-500 text-[10px] mt-1.5 text-center">🎯 esami · % superati · record errori · visibile a tutti i giocatori</p>
        </div>
      )}
    </div>
  );
}

function ExamMode({ player, onFinish, onExit }) {
  const questions = useMemo(() => buildExam(), []);
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState({});
  const [left, setLeft] = useState(EXAM_TIME);
  const [phase, setPhase] = useState("quiz");

  // L'esame è concluso se consegnato manualmente (phase === "review") OPPURE se il
  // tempo è scaduto (left <= 0): stato derivato, niente setState dentro l'effetto.
  const finished = phase === "review" || left <= 0;

  // Timer: scorre solo finché l'esame è in corso. A consegna/scadenza l'effetto si
  // ferma e "left" resta congelato (così il tempo impiegato a fine esame è corretto).
  useEffect(() => {
    if (finished) return;
    const t = setTimeout(() => setLeft(l => l - 1), 1000);
    return () => clearTimeout(t);
  }, [finished, left]);

  const q = questions[idx];
  const answered = Object.keys(answers).length;
  const pick = (opt) => { setAnswers(a => ({ ...a, [idx]: opt })); };
  const go = (d) => { setIdx(i => Math.min(questions.length - 1, Math.max(0, i + d))); };

  if (finished) {
    const finalWrong = questions.filter((qq, i) => answers[i] !== qq.correct).length;
    const finalCorrect = questions.length - finalWrong;
    return <ExamResults player={player} questions={questions} answers={answers}
      correct={finalCorrect} wrong={finalWrong} passed={finalWrong <= MAX_ERRORS} timeUsed={EXAM_TIME - left}
      onFinish={() => onFinish({ player, score: finalCorrect, total: questions.length, errors: finalWrong, passed: finalWrong <= MAX_ERRORS })} />;
  }

  const danger = left <= 120;
  const sel = answers[idx];
  return (
    <div className="min-h-screen bg-gradient-to-br from-green-950 to-emerald-900 flex flex-col items-center p-4">
      <div className="w-full max-w-lg mt-5 mb-3">
        <div className="flex justify-between items-center mb-2">
          <button onClick={onExit} className="text-green-400 hover:text-white text-sm font-bold transition-colors">← Esci</button>
          <span className="text-green-300 text-sm font-bold">Domanda {idx + 1} / {questions.length}</span>
          <span className={"font-black text-lg tabular-nums px-3 py-0.5 rounded-lg " + (danger ? "bg-red-500 text-white animate-pulse" : "text-amber-300")}>⏱ {fmtTime(left)}</span>
        </div>
        <ProgressBar current={answered} total={questions.length} color="bg-green-500" />
        <div className="flex justify-between mt-1.5 text-xs">
          <span className="text-green-400 font-bold">Risposte: {answered}/{questions.length}</span>
          <span className="text-amber-300 font-bold">Max {MAX_ERRORS} errori consentiti</span>
        </div>
      </div>
      <div className="w-full max-w-lg mb-3"><SectionBadge section={q.section} /></div>
      <div className="w-full max-w-lg bg-white rounded-3xl shadow-xl p-6 mb-4">
        <p className="text-gray-900 text-lg font-semibold leading-snug">{q.question}</p>
      </div>
      <div className="w-full max-w-lg flex flex-col gap-3 mb-5">
        {["a", "b", "c"].map(opt => (
          <button key={opt} onClick={() => pick(opt)} aria-pressed={sel === opt}
            className={"w-full text-left px-5 py-4 rounded-2xl transition-all duration-100 text-sm leading-snug border-2 " +
              (sel === opt ? "bg-green-600 border-green-400 text-white font-bold" : "bg-white border-gray-200 hover:border-amber-400 hover:bg-amber-50 text-gray-800")}>
            <span className="font-black mr-2 text-base">{opt.toUpperCase()}.</span>{q.options[opt]}
          </button>
        ))}
      </div>
      <div className="w-full max-w-lg flex gap-3">
        <button onClick={() => go(-1)} disabled={idx === 0}
          className="flex-1 bg-white/15 hover:bg-white/25 disabled:opacity-30 text-white font-bold rounded-2xl py-4 transition-all">← Indietro</button>
        {idx < questions.length - 1
          ? <button onClick={() => go(1)} className="flex-1 bg-amber-500 hover:bg-amber-400 text-green-950 font-black rounded-2xl py-4 transition-all shadow-lg">Avanti →</button>
          : <button onClick={() => setPhase("review")} className="flex-1 bg-green-700 hover:bg-green-600 text-white font-black rounded-2xl py-4 transition-all shadow-lg">Consegna ✓</button>
        }
      </div>
      {answered < questions.length && idx === questions.length - 1 &&
        <p className="text-amber-300 text-xs mt-3 text-center">Hai {questions.length - answered} domande senza risposta (contano come errore).</p>}
    </div>
  );
}

function ExamResults({ player, questions, answers, correct, wrong, passed, timeUsed, onFinish }) {
  const [showReview, setShowReview] = useState(false);
  return (
    <div className="min-h-screen bg-gradient-to-br from-green-950 to-emerald-900 flex flex-col items-center p-4 py-8">
      <div className="w-full max-w-lg bg-white rounded-3xl shadow-2xl p-7 text-center mb-4">
        <div className="text-6xl mb-2">{passed ? "🎉" : "😔"}</div>
        <h2 className={"text-3xl font-black mb-1 " + (passed ? "text-green-600" : "text-red-600")}>{passed ? "PROMOSSO!" : "NON SUPERATO"}</h2>
        <p className="text-gray-500 mb-5">{player || "Giocatore"} · {wrong} errori {passed ? "(≤4 ✓)" : "(>4 ✗)"}</p>
        <div className="grid grid-cols-3 gap-3 mb-5">
          <div className="bg-green-50 rounded-2xl p-3"><div className="text-2xl font-black text-green-600">{correct}</div><div className="text-green-700 text-xs">Corrette</div></div>
          <div className="bg-red-50 rounded-2xl p-3"><div className="text-2xl font-black text-red-600">{wrong}</div><div className="text-red-700 text-xs">Errate</div></div>
          <div className="bg-amber-50 rounded-2xl p-3"><div className="text-2xl font-black text-amber-600">{fmtTime(timeUsed || 0)}</div><div className="text-amber-700 text-xs">Tempo</div></div>
        </div>
        <button onClick={() => setShowReview(s => !s)} className="w-full bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold rounded-2xl py-3 mb-3 transition-all">
          {showReview ? "Nascondi correzione" : "📋 Rivedi le risposte"}
        </button>
        <button onClick={onFinish} className="w-full bg-green-700 hover:bg-green-600 text-white font-black text-lg rounded-2xl py-4 transition-all">Torna alla Home</button>
      </div>
      {showReview && (
        <div className="w-full max-w-lg flex flex-col gap-2">
          {questions.map((q, i) => {
            const a = answers[i], ok = a === q.correct;
            return (
              <div key={i} className={"bg-white rounded-2xl p-4 border-l-4 " + (ok ? "border-green-500" : "border-red-500")}>
                <div className="flex items-start gap-2 mb-1"><span className="text-lg">{ok ? "✅" : "❌"}</span>
                  <p className="text-gray-900 text-sm font-semibold flex-1">{i + 1}. {q.question}</p></div>
                <p className="text-xs text-green-700 ml-7"><b>Corretta:</b> {q.correct.toUpperCase()}. {q.options[q.correct]}</p>
                {!ok && <p className="text-xs text-red-600 ml-7"><b>Tua:</b> {a ? a.toUpperCase() + ". " + q.options[a] : "— nessuna risposta"}</p>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function PracticeMode({ title, emoji, pool, onFinish }) {
  const questions = useMemo(() => uniqueByStem(shuffle(pool)), [pool]);
  const [idx, setIdx] = useState(0);
  const [selected, setSelected] = useState(null);
  const [correct, setCorrect] = useState(0);
  const [wrong, setWrong] = useState(0);
  const [done, setDone] = useState(false);
  const q = questions[idx];

  if (!questions.length) return (
    <div className="min-h-screen bg-gradient-to-br from-green-950 to-emerald-900 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl p-8 text-center max-w-md w-full">
        <div className="text-5xl mb-3">📭</div>
        <p className="text-gray-700 font-bold mb-5">Nessuna domanda disponibile per questa sezione.</p>
        <button onClick={onFinish} className="bg-green-700 hover:bg-green-600 text-white font-black rounded-2xl py-3 px-6 transition-all">Torna alla Home</button>
      </div>
    </div>
  );

  const answer = (opt) => {
    if (selected) return;
    setSelected(opt);
    if (opt === q.correct) setCorrect(c => c + 1); else setWrong(c => c + 1);
  };
  const next = () => {
    if (idx + 1 >= questions.length) setDone(true);
    else { setIdx(i => i + 1); setSelected(null); }
  };

  if (done) {
    const total = correct + wrong || 1;
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-950 to-emerald-900 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl shadow-2xl p-8 max-w-md w-full text-center">
          <div className="text-6xl mb-3">{correct / total >= 0.85 ? "🎉" : correct / total >= 0.6 ? "👍" : "📚"}</div>
          <h2 className="text-2xl font-black text-green-900 mb-1">{title} completata</h2>
          <p className="text-gray-500 mb-5">{correct + wrong} domande</p>
          <div className="grid grid-cols-3 gap-3 mb-5">
            <div className="bg-green-50 rounded-2xl p-3"><div className="text-2xl font-black text-green-600">{correct}</div><div className="text-green-700 text-xs">Corrette</div></div>
            <div className="bg-red-50 rounded-2xl p-3"><div className="text-2xl font-black text-red-600">{wrong}</div><div className="text-red-700 text-xs">Errate</div></div>
            <div className="bg-amber-50 rounded-2xl p-3"><div className="text-2xl font-black text-amber-600">{Math.round(correct / total * 100)}%</div><div className="text-amber-700 text-xs">Precisione</div></div>
          </div>
          <button onClick={onFinish} className="w-full bg-green-700 hover:bg-green-600 text-white font-black text-lg rounded-2xl py-4 transition-all">Torna alla Home</button>
        </div>
      </div>
    );
  }

  const optStyle = (opt) => {
    if (!selected) return "bg-white border-gray-200 hover:border-amber-400 hover:bg-amber-50 text-gray-800";
    if (opt === q.correct) return "bg-green-500 border-green-600 text-white font-bold";
    if (opt === selected) return "bg-red-500 border-red-600 text-white font-bold";
    return "bg-gray-100 border-gray-200 text-gray-400";
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-950 to-emerald-900 flex flex-col items-center p-4">
      <div className="w-full max-w-lg mt-5 mb-3">
        <div className="flex justify-between items-center mb-2">
          <button onClick={onFinish} className="text-green-400 hover:text-white text-sm font-bold">← Esci</button>
          <span className="text-white text-sm font-black flex items-center gap-1">{emoji} {title}</span>
          <div className="flex gap-2 text-sm"><span className="text-green-400 font-bold">✓{correct}</span><span className="text-red-400 font-bold">✗{wrong}</span></div>
        </div>
        <ProgressBar current={idx + 1} total={questions.length} color="bg-amber-500" />
        <p className="text-green-300 text-xs mt-1 text-right">{idx + 1} / {questions.length}</p>
      </div>
      <div className="w-full max-w-lg mb-3"><SectionBadge section={q.section} /></div>
      <div className="w-full max-w-lg bg-white rounded-3xl shadow-xl p-6 mb-4">
        <p className="text-gray-900 text-lg font-semibold leading-snug">{q.question}</p>
      </div>
      <div className="w-full max-w-lg flex flex-col gap-3 mb-4">
        {["a", "b", "c"].map(opt => (
          <button key={opt} onClick={() => answer(opt)}
            className={"w-full text-left px-5 py-4 rounded-2xl transition-all duration-100 text-sm leading-snug border-2 " + optStyle(opt)}>
            <span className="font-black mr-2 text-base">{opt.toUpperCase()}.</span>{q.options[opt]}
          </button>
        ))}
      </div>
      {selected && (
        <div className="w-full max-w-lg">
          <div className={"rounded-2xl px-5 py-3 mb-3 text-center font-bold " + (selected === q.correct ? "bg-green-500 text-white" : "bg-red-500 text-white")}>
            {selected === q.correct ? "✓ Corretta!" : "✗ Errata — risposta giusta: " + q.correct.toUpperCase()}
          </div>
          <button onClick={next} className="w-full bg-amber-500 hover:bg-amber-400 text-green-950 font-black text-lg rounded-2xl py-4 transition-all shadow-lg">
            {idx + 1 < questions.length ? "Prossima →" : "Termina"}
          </button>
        </div>
      )}
    </div>
  );
}

export default function App() {
  const [view, setView] = useState("home");
  const [player, setPlayer] = useState("");
  const [history, setHistory] = useState(() => loadHistory());   // storico esami persistente (locale)
  const [section, setSection] = useState(null);
  const [ipHash, setIpHash] = useState(null);                    // hash IP (identificatore, mai mostrato)
  const [leaderboard, setLeaderboard] = useState(null);          // classifica globale: null=in attesa, []=vuota

  // All'avvio: calcola l'hash dell'IP e iscriviti alla classifica globale (realtime).
  useEffect(() => {
    if (!cloudEnabled) return;
    hashIp().then(setIpHash);
    const unsub = subscribeLeaderboard(setLeaderboard);
    return () => { if (unsub) unsub(); };
  }, []);

  // Registra/aggiorna nome + hash IP sul backend quando l'utente conferma il nome.
  const registerName = (name) => {
    if (cloudEnabled && name.trim()) registerPlayer(name, ipHash);
  };

  const recordExam = (res) => {
    const now = new Date();
    const entry = {
      ...res,
      ts: now.toISOString(),
      date: now.toLocaleString("it-IT", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }),
    };
    setHistory(h => {
      const updated = [...h, entry];
      saveHistory(updated);
      return updated;
    });
    // Aggiorna anche la classifica globale (best-effort, non blocca la UI).
    if (cloudEnabled) recordExamResult(res, res.player || player, ipHash);
    setView("home");
  };

  const resetHistory = () => { clearHistory(); setHistory([]); };

  if (view === "exam") return <ExamMode player={player || "Giocatore"} onFinish={recordExam} onExit={() => setView("home")} />;
  if (view === "study") return <PracticeMode title="Studio" emoji="📖" pool={QUESTIONS} onFinish={() => setView("home")} />;
  if (view === "section" && section) return <PracticeMode title={section.label} emoji={section.emoji} pool={POOLS[section.key] || []} onFinish={() => setView("home")} />;

  return <HomeScreen player={player} setPlayer={setPlayer} onRegister={registerName}
    history={history} onResetHistory={resetHistory}
    cloudEnabled={cloudEnabled} leaderboard={leaderboard}
    onExam={() => setView("exam")} onStudy={() => setView("study")}
    onSection={(s) => { setSection(s); setView("section"); }} />;
}

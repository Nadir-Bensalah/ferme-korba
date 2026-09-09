import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Lang } from '@ferme/core';
import { t } from '@/i18n';

interface Props {
  lang: Lang;
  recipeId: string;
  ingredients: string[];
  steps: string[];
  baseServings: number;
}

const CHOICES = [2, 4, 6, 8];

/* ------------------------------------------------------------------
   Recalcul des quantités.
   On ne touche qu'au nombre écrit en tête d'un ingrédient. En français,
   le mot qui suit passe au pluriel (ou au singulier) tant qu'on est sur
   des mots simples : « 1 citron » devient « 2 citrons », « 1 kg de
   pommes de terre » garde son « kg ». En arabe, seul le chiffre change :
   le pluriel y est irrégulier, on ne le devine pas.
   ------------------------------------------------------------------ */

/** Mots après lesquels on arrête d'accorder. */
const STOP = new Set(['de', 'du', 'des', 'à', 'a', 'au', 'aux', 'en', 'et', 'ou', 'pour', 'avec', 'sans', 'le', 'la', 'les', 'un', 'une', 'sur', 'dans', 'par']);
/** Unités : elles ne s'accordent pas et ferment l'accord. */
const UNITS = new Set(['kg', 'g', 'mg', 'l', 'cl', 'ml', 'dl']);

function formatNumber(v: number, lang: Lang): string {
  const rounded = v >= 10 ? Math.round(v) : Math.round(v * 4) / 4;
  const s = rounded
    .toFixed(2)
    .replace(/0+$/, '')
    .replace(/\.$/, '');
  return lang === 'ar' ? s : s.replace('.', ',');
}

function toPlural(word: string): string {
  if (/[sxz]$/i.test(word)) return word;
  if (/al$/i.test(word)) return `${word.slice(0, -2)}aux`;
  return `${word}s`;
}

function toSingular(word: string): string {
  if (word.length > 3 && /[^s]s$/i.test(word)) return word.slice(0, -1);
  return word;
}

/** Accorde les mots qui suivent le nombre, tant qu'ils sont accordables. */
function agree(rest: string, plural: boolean): string {
  const parts = rest.split(/(\s+)/);
  const out: string[] = [];
  let stop = false;
  for (const part of parts) {
    if (stop || /^\s+$/.test(part)) {
      out.push(part);
      continue;
    }
    const m = part.match(/^([\p{L}]+)([,.;:]?)$/u);
    const word = m?.[1];
    if (!word || word.includes('.') || STOP.has(word.toLowerCase()) || UNITS.has(word.toLowerCase())) {
      stop = true;
      out.push(part);
      continue;
    }
    out.push((plural ? toPlural(word) : toSingular(word)) + (m?.[2] ?? ''));
  }
  return out.join('');
}

export function scaleIngredient(text: string, factor: number, lang: Lang): string {
  if (factor === 1) return text;
  const m = text.match(/^(\d+(?:[.,]\d+)?)(\s+)([\s\S]*)$/);
  if (!m) return text;
  const base = Number((m[1] ?? '').replace(',', '.'));
  if (!Number.isFinite(base) || base <= 0) return text;
  const value = base * factor;
  const shown = formatNumber(value, lang);
  const rest = m[3] ?? '';
  if (lang === 'ar') return `${shown}${m[2]}${rest}`;
  const wasPlural = base >= 2;
  const isPlural = Number(shown.replace(',', '.')) >= 2;
  const agreed = wasPlural === isPlural ? rest : agree(rest, isPlural);
  return `${shown}${m[2]}${agreed}`;
}

/* ------------------------------------------------------------------
   Minuteur : on lit la durée écrite dans l'étape.
   ------------------------------------------------------------------ */

/** Minutes trouvées dans une étape, ou null. La première durée l'emporte. */
export function findMinutes(text: string, lang: Lang): number | null {
  const found: { at: number; min: number }[] = [];
  const push = (re: RegExp, toMin: (m: RegExpMatchArray) => number) => {
    const m = text.match(re);
    if (m && m.index !== undefined) found.push({ at: m.index, min: toMin(m) });
  };
  if (lang === 'ar') {
    push(/ساعة\s*وربع/, () => 75);
    push(/ساعة\s*ونصف/, () => 90);
    push(/(\d+)\s*ساعات?/, (m) => Number(m[1]) * 60);
    push(/(\d+)\s*(?:دقيقة|دقائق)/, (m) => Number(m[1]));
  } else {
    push(/(\d+)\s*h(?:eures?)?(?:\s*(\d{1,2}))?\b/i, (m) => Number(m[1]) * 60 + Number(m[2] ?? 0));
    push(/(\d+)\s*min(?:ute)?s?\b/i, (m) => Number(m[1]));
  }
  found.sort((a, b) => a.at - b.at);
  const first = found[0];
  if (!first || !Number.isFinite(first.min)) return null;
  if (first.min < 1 || first.min > 240) return null;
  return first.min;
}

function clock(seconds: number): string {
  const s = Math.max(0, seconds);
  const m = Math.floor(s / 60);
  const r = Math.floor(s % 60);
  return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`;
}

/* ------------------------------------------------------------------
   Le bloc « en cuisine » : portions, ingrédients, étapes, minuteurs.
   Rendu aussi sans JavaScript : le serveur écrit la liste complète.
   ------------------------------------------------------------------ */
export default function RecipeKitchen({ lang, recipeId, ingredients, steps, baseServings }: Props) {
  const d = t(lang);
  const keyIng = `ferme-korba:recipe:${recipeId}`;
  const keySteps = `${keyIng}:steps`;
  const keyServ = `${keyIng}:servings`;

  const [mounted, setMounted] = useState(false);
  const [servings, setServings] = useState(baseServings);
  const [checked, setChecked] = useState<number[]>([]);
  const [done, setDone] = useState<number[]>([]);
  const [timer, setTimer] = useState<{ step: number; endsAt: number; total: number } | null>(null);
  const [left, setLeft] = useState(0);
  const [rang, setRang] = useState(false);
  const audio = useRef<AudioContext | null>(null);

  /* Mémoire de l'appareil : cases cochées, étapes faites, portions. */
  useEffect(() => {
    setMounted(true);
    const read = (k: string): number[] => {
      try {
        const v = JSON.parse(localStorage.getItem(k) ?? '[]');
        return Array.isArray(v) ? v.filter((n) => Number.isInteger(n)) : [];
      } catch {
        return [];
      }
    };
    setChecked(read(keyIng));
    setDone(read(keySteps));
    try {
      const s = Number(localStorage.getItem(keyServ));
      if (CHOICES.includes(s)) setServings(s);
    } catch {
      /* stockage indisponible : on continue sans mémoire */
    }
  }, [keyIng, keySteps, keyServ]);

  const save = useCallback((k: string, v: number[]) => {
    try {
      if (v.length) localStorage.setItem(k, JSON.stringify(v));
      else localStorage.removeItem(k);
    } catch {
      /* stockage indisponible : on continue sans mémoire */
    }
  }, []);

  const factor = servings / baseServings;
  const lines = useMemo(() => ingredients.map((ing) => scaleIngredient(ing, factor, lang)), [ingredients, factor, lang]);
  const durations = useMemo(() => steps.map((s) => findMinutes(s, lang)), [steps, lang]);
  const doneCount = done.length;
  const pct = steps.length ? Math.round((doneCount / steps.length) * 100) : 0;

  /* Compte à rebours : on relit l'heure de fin, jamais un compteur qui dérive. */
  useEffect(() => {
    if (!timer) return;
    const tick = () => {
      const s = Math.round((timer.endsAt - Date.now()) / 1000);
      setLeft(s);
      if (s <= 0) {
        setTimer(null);
        setRang(true);
        ring(audio.current);
      }
    };
    tick();
    const id = window.setInterval(tick, 250);
    return () => window.clearInterval(id);
  }, [timer]);

  /* Le mot « le temps est écoulé » s'efface tout seul. */
  useEffect(() => {
    if (!rang) return;
    const id = window.setTimeout(() => setRang(false), 12000);
    return () => window.clearTimeout(id);
  }, [rang]);

  const startTimer = (step: number, minutes: number) => {
    // Le son n'existe qu'après ce clic : c'est le geste qui ouvre l'audio.
    try {
      const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (Ctx) {
        if (!audio.current) audio.current = new Ctx();
        void audio.current.resume();
      }
    } catch {
      /* pas de son : le minuteur reste visuel */
    }
    setRang(false);
    setTimer({ step, endsAt: Date.now() + minutes * 60000, total: minutes * 60 });
  };

  const toggleIngredient = (i: number) => {
    const next = checked.includes(i) ? checked.filter((n) => n !== i) : [...checked, i];
    setChecked(next);
    save(keyIng, next);
  };

  const toggleStep = (i: number) => {
    const next = done.includes(i) ? done.filter((n) => n !== i) : [...done, i];
    setDone(next);
    save(keySteps, next);
  };

  const pickServings = (n: number) => {
    setServings(n);
    try {
      localStorage.setItem(keyServ, String(n));
    } catch {
      /* stockage indisponible */
    }
  };

  const durationLabel = (min: number) => {
    if (min < 60) return `${min} ${d.common.minutes}`;
    const h = Math.floor(min / 60);
    const r = min % 60;
    return r ? `${h} ${d.recipes.hourShort} ${r}` : `${h} ${d.recipes.hourShort}`;
  };

  return (
    <div className="kitchen-root mt-12 grid gap-10 lg:mt-16 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:gap-16">
      {/* Ingrédients, portions, impression */}
      <section className="kitchen-ing lg:sticky lg:top-24 lg:self-start" aria-labelledby="ingredients">
        <div className="rounded-lg bg-cream p-5 sm:p-6">
          <div className="flex items-end justify-between gap-3">
            <h2 id="ingredients" className="text-2xl font-extrabold">
              {d.recipes.ingredients}
            </h2>
            {checked.length > 0 ? (
              <button
                type="button"
                className="no-print min-h-12 text-sm font-bold text-prairie hover:text-prairie-deep"
                onClick={() => {
                  setChecked([]);
                  save(keyIng, []);
                }}
              >
                {d.recipes.uncheck}
              </button>
            ) : null}
          </div>

          {/* Portions : quatre pastilles, les quantités suivent. */}
          <div className="no-print mt-5 rounded-md bg-paper p-3.5 shadow-card">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <p className="text-sm font-extrabold">{d.recipes.servingsTitle}</p>
              <p className="text-xs text-ink-3">{d.recipes.servingsHelp}</p>
            </div>
            <div className="mt-2.5 flex gap-2" role="group" aria-label={d.recipes.servingsTitle}>
              {CHOICES.map((n) => {
                const on = n === servings;
                return (
                  <button
                    key={n}
                    type="button"
                    aria-pressed={on}
                    aria-label={d.recipes.servingsSet(n)}
                    onClick={() => pickServings(n)}
                    className={`flex min-h-12 flex-1 flex-col items-center justify-center gap-0.5 rounded-md border-2 leading-none transition-colors ${
                      on ? 'border-prairie bg-prairie text-paper' : 'border-line bg-paper text-ink-2 hover:border-prairie/50'
                    }`}
                  >
                    <span className="tabular text-lg font-extrabold">{n}</span>
                    <span className="text-[0.65rem] font-semibold opacity-80">{d.common.servings}</span>
                  </button>
                );
              })}
            </div>
            <p className="mt-2.5 flex items-center gap-1.5 text-xs text-ink-3" aria-live="polite">
              {factor !== 1 ? (
                <>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="text-prairie">
                    <path d="M5 12.5 10 17.5 19 7" />
                  </svg>
                  {d.recipes.servingsAdjusted}
                </>
              ) : (
                d.recipes.servingsBase(baseServings)
              )}
            </p>
          </div>

          <p className="no-print mt-4 text-sm text-ink-3">{d.recipes.checkHint}</p>
          <ul className="mt-3 flex flex-col divide-y divide-line-2/60">
            {lines.map((ing, i) => (
              <li className="ingredient" key={i}>
                <label className="flex min-h-12 cursor-pointer items-center gap-3 py-2.5">
                  <input type="checkbox" className="h-5 w-5 shrink-0 accent-prairie" checked={mounted ? checked.includes(i) : false} onChange={() => toggleIngredient(i)} />
                  <span className="ingredient-label text-base text-ink transition-colors">{ing}</span>
                </label>
              </li>
            ))}
          </ul>

          <button type="button" className="no-print btn-soft mt-5 w-full bg-paper" onClick={() => window.print()} aria-label={d.recipes.printLabel}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M7 9V3h10v6" />
              <path d="M7 18H5a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2" />
              <path d="M7 15h10v6H7z" />
            </svg>
            {d.recipes.print}
          </button>
        </div>
      </section>

      {/* Étapes : avancement, cases à cocher, minuteurs */}
      <section aria-labelledby="steps">
        <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
          <h2 id="steps" className="text-2xl font-extrabold">
            {d.recipes.steps}
          </h2>
          {doneCount > 0 ? (
            <button
              type="button"
              className="no-print min-h-12 text-sm font-bold text-prairie hover:text-prairie-deep"
              onClick={() => {
                setDone([]);
                save(keySteps, []);
              }}
            >
              {d.recipes.stepsReset}
            </button>
          ) : null}
        </div>

        {/* Barre d'avancement : elle ne dit rien de plus que le compte, elle le montre. */}
        <div className="no-print mt-4">
          <div className="flex items-center justify-between gap-3 text-sm font-semibold text-ink-2">
            <span aria-live="polite">{doneCount === steps.length && steps.length > 0 ? d.recipes.stepsAllDone : d.recipes.stepsProgress(doneCount, steps.length)}</span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-pill bg-cream" role="progressbar" aria-valuenow={doneCount} aria-valuemin={0} aria-valuemax={steps.length} aria-label={d.recipes.steps}>
            <div className="kitchen-bar h-full rounded-pill bg-prairie" style={{ width: `${pct}%` }} />
          </div>
          <p className="mt-2 text-sm text-ink-3">{d.recipes.stepsHint}</p>
        </div>

        <ol className="mt-6 flex flex-col gap-3">
          {steps.map((s, i) => {
            const isDone = mounted && done.includes(i);
            const minutes = durations[i] ?? null;
            const running = timer?.step === i;
            return (
              <li key={i} className="kitchen-step rounded-lg" data-done={isDone ? '1' : undefined}>
                <button type="button" className="flex w-full items-start gap-4 rounded-lg p-2 text-start transition-colors hover:bg-cream/70" aria-pressed={isDone} aria-label={d.recipes.stepToggle(i + 1)} onClick={() => toggleStep(i)}>
                  <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-pill font-display text-base font-extrabold transition-colors ${isDone ? 'bg-prairie text-paper' : 'bg-ink text-yolk'}`} aria-hidden="true">
                    {isDone ? (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="animate-pop">
                        <path d="M5 12.5 10 17.5 19 7" />
                      </svg>
                    ) : (
                      i + 1
                    )}
                  </span>
                  <span className="step-text pt-1.5 text-lg leading-relaxed text-ink-2">{s}</span>
                </button>

                {minutes ? (
                  <div className="no-print ms-14 pb-1 ps-2">
                    {running ? (
                      <div className="inline-flex items-center gap-3 rounded-pill bg-prairie px-3 py-1.5 text-paper">
                        <span className="relative flex h-6 w-6 items-center justify-center" aria-hidden="true">
                          <span className="kitchen-pulse absolute inset-0 rounded-pill bg-paper/30" />
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M7 3h10M7 21h10M8 3v4a4 4 0 0 0 8 0V3M8 21v-4a4 4 0 0 1 8 0v4" />
                          </svg>
                        </span>
                        <span className="tabular text-base font-extrabold" dir="ltr" role="timer" aria-live="off">
                          {clock(left)}
                        </span>
                        <button type="button" className="min-h-12 rounded-pill px-2 text-sm font-bold text-paper/90 underline underline-offset-2 hover:text-paper" onClick={() => setTimer(null)} aria-label={d.recipes.timerStopLabel}>
                          {d.recipes.timerStop}
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        className="inline-flex min-h-12 items-center gap-2 rounded-pill border border-yolk-deep/30 bg-yolk-soft px-3.5 py-1.5 text-sm font-bold text-yolk-deep transition-colors hover:bg-yolk hover:text-ink"
                        onClick={() => startTimer(i, minutes)}
                        aria-label={d.recipes.timerStartLabel(durationLabel(minutes))}
                      >
                        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <path d="M7 3h10M7 21h10M8 3v4a4 4 0 0 0 8 0V3M8 21v-4a4 4 0 0 1 8 0v4" />
                          <path d="M12 11v2" />
                        </svg>
                        {d.recipes.timerStart} · {durationLabel(minutes)}
                      </button>
                    )}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ol>

        {/* Fin du minuteur : un mot, un bip. Rien qui saute à l'écran. */}
        {rang ? (
          <p className="no-print mt-4 flex items-center gap-2 rounded-md bg-prairie-soft px-4 py-3 font-bold text-prairie-deep" role="status">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="animate-pop">
              <path d="M18 8a6 6 0 1 0-12 0c0 7-3 8-3 8h18s-3-1-3-8" />
              <path d="M10.5 21a2 2 0 0 0 3 0" />
            </svg>
            {d.recipes.timerDone}
          </p>
        ) : null}
        <p className="no-print mt-3 text-sm text-ink-3">{d.recipes.timerHint}</p>
      </section>
    </div>
  );
}

/** Trois brèves notes, montées puis coupées en douceur : ça suffit à prévenir. */
function ring(ctx: AudioContext | null) {
  if (!ctx) return;
  try {
    const start = ctx.currentTime + 0.02;
    for (let i = 0; i < 3; i++) {
      const at = start + i * 0.28;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, at);
      gain.gain.setValueAtTime(0.0001, at);
      gain.gain.exponentialRampToValueAtTime(0.14, at + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.22);
      osc.connect(gain).connect(ctx.destination);
      osc.start(at);
      osc.stop(at + 0.24);
    }
  } catch {
    /* pas de son : le minuteur reste visuel */
  }
}

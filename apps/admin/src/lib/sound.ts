/**
 * Son bref à la nouvelle commande, deux notes, en WebAudio.
 * Les navigateurs refusent tout son avant un geste de l'utilisateur :
 * on crée le contexte au premier clic ou à la première touche, jamais avant.
 */
let ctx: AudioContext | null = null;
let armed = false;

export function armAudio(): void {
  if (armed || typeof window === 'undefined') return;
  armed = true;
  const unlock = () => {
    try {
      ctx ??= new AudioContext();
      if (ctx.state === 'suspended') void ctx.resume();
    } catch {
      ctx = null;
    }
  };
  window.addEventListener('pointerdown', unlock, { once: true, passive: true });
  window.addEventListener('keydown', unlock, { once: true, passive: true });
}

export function audioReady(): boolean {
  return ctx !== null && ctx.state === 'running';
}

function note(freq: number, at: number, dur: number): void {
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(0.25, at + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  osc.connect(gain).connect(ctx.destination);
  osc.start(at);
  osc.stop(at + dur + 0.05);
}

/** Joue le carillon. Retourne faux si le navigateur ne l'a pas encore autorisé. */
export function playChime(): boolean {
  if (!audioReady() || !ctx) return false;
  const t = ctx.currentTime;
  note(880, t, 0.18);
  note(1174.66, t + 0.16, 0.28);
  return true;
}

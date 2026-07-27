/**
 * Short chat "buzz" via Web Audio API — no audio asset required.
 * Safe to call from browsers that block autoplay until a user gesture;
 * failures are swallowed so messaging never breaks.
 */

let sharedContext: AudioContext | null = null;
let lastBuzzAt = 0;

const BUZZ_COOLDOWN_MS = 900;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const AudioCtx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtx) return null;
  if (!sharedContext || sharedContext.state === "closed") {
    sharedContext = new AudioCtx();
  }
  return sharedContext;
}

function tone(
  ctx: AudioContext,
  startAt: number,
  frequency: number,
  duration: number,
  gainValue: number
) {
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();
  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(frequency, startAt);
  gain.gain.setValueAtTime(0.0001, startAt);
  gain.gain.exponentialRampToValueAtTime(gainValue, startAt + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);
  oscillator.connect(gain);
  gain.connect(ctx.destination);
  oscillator.start(startAt);
  oscillator.stop(startAt + duration + 0.02);
}

/** Play a soft two-tone buzz for an incoming chat message. */
export function playChatBuzz(): void {
  if (typeof window === "undefined") return;

  const now = Date.now();
  if (now - lastBuzzAt < BUZZ_COOLDOWN_MS) return;
  lastBuzzAt = now;

  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const start = () => {
      const t0 = ctx.currentTime;
      tone(ctx, t0, 880, 0.09, 0.08);
      tone(ctx, t0 + 0.11, 1175, 0.12, 0.07);
    };

    if (ctx.state === "suspended") {
      void ctx.resume().then(start).catch(() => {
        // Autoplay still blocked — ignore.
      });
      return;
    }

    start();
  } catch {
    // Ignore audio failures.
  }
}

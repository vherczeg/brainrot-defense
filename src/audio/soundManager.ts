export type SoundName =
  | 'click'
  | 'buy'
  | 'merge'
  | 'error'
  | 'laser'
  | 'lightning'
  | 'hit'
  | 'victory'
  | 'defeat'
  | 'reward';

interface Tone {
  readonly frequency: number;
  readonly duration: number;
  readonly type: OscillatorType;
  readonly volume: number;
  readonly delay?: number;
  readonly slideTo?: number;
}

const TONES: Readonly<Record<SoundName, readonly Tone[]>> = {
  click: [{ frequency: 620, duration: 0.05, type: 'triangle', volume: 0.05 }],
  buy: [
    { frequency: 524, duration: 0.08, type: 'triangle', volume: 0.07 },
    { frequency: 784, duration: 0.1, type: 'triangle', volume: 0.06, delay: 0.06 },
  ],
  merge: [
    { frequency: 440, duration: 0.09, type: 'sine', volume: 0.08, slideTo: 880 },
    { frequency: 990, duration: 0.14, type: 'triangle', volume: 0.05, delay: 0.06 },
  ],
  error: [{ frequency: 220, duration: 0.12, type: 'sawtooth', volume: 0.05, slideTo: 160 }],
  laser: [{ frequency: 1200, duration: 0.06, type: 'square', volume: 0.025, slideTo: 420 }],
  lightning: [
    { frequency: 900, duration: 0.05, type: 'sawtooth', volume: 0.025, slideTo: 300 },
    { frequency: 500, duration: 0.06, type: 'square', volume: 0.02, delay: 0.03 },
  ],
  hit: [{ frequency: 180, duration: 0.04, type: 'square', volume: 0.018 }],
  victory: [
    { frequency: 523, duration: 0.12, type: 'triangle', volume: 0.07 },
    { frequency: 659, duration: 0.12, type: 'triangle', volume: 0.07, delay: 0.1 },
    { frequency: 784, duration: 0.2, type: 'triangle', volume: 0.07, delay: 0.2 },
    { frequency: 1046, duration: 0.3, type: 'sine', volume: 0.06, delay: 0.32 },
  ],
  defeat: [
    { frequency: 330, duration: 0.2, type: 'sine', volume: 0.06, slideTo: 220 },
    { frequency: 220, duration: 0.3, type: 'sine', volume: 0.05, delay: 0.16, slideTo: 150 },
  ],
  reward: [
    { frequency: 880, duration: 0.07, type: 'triangle', volume: 0.05 },
    { frequency: 1174, duration: 0.12, type: 'triangle', volume: 0.05, delay: 0.07 },
  ],
};

export class SoundManager {
  private context: AudioContext | null = null;
  private enabled = true;
  private lastPlayed = new Map<SoundName, number>();

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled && this.context) {
      void this.context.suspend().catch(() => undefined);
    }
  }

  private ensureContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    const AudioContextClass = window.AudioContext;
    if (!AudioContextClass) return null;
    if (!this.context) {
      try {
        this.context = new AudioContextClass();
      } catch {
        return null;
      }
    }
    if (this.context.state === 'suspended') {
      void this.context.resume().catch(() => undefined);
    }
    return this.context;
  }

  play(name: SoundName): void {
    if (!this.enabled) return;
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const last = this.lastPlayed.get(name) ?? 0;
    if (name !== 'victory' && name !== 'defeat' && now - last < 55) return;
    this.lastPlayed.set(name, now);
    const context = this.ensureContext();
    if (!context) return;
    const tones = TONES[name];
    const baseTime = context.currentTime;
    for (const tone of tones) {
      const start = baseTime + (tone.delay ?? 0);
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = tone.type;
      oscillator.frequency.setValueAtTime(tone.frequency, start);
      if (tone.slideTo !== undefined) {
        oscillator.frequency.exponentialRampToValueAtTime(
          Math.max(30, tone.slideTo),
          start + tone.duration,
        );
      }
      gain.gain.setValueAtTime(tone.volume, start);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + tone.duration);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start(start);
      oscillator.stop(start + tone.duration + 0.02);
    }
  }
}

"use client";

export type MusicEngine = {
  context: AudioContext;
  master: GainNode;
  musicBus: GainNode;
  delay: DelayNode;
  timer: number | null;
  step: number;
  nextNoteTime: number;
};

export function audioContextClass() {
  return window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
}

const AMBIENT_CHORDS = [
  [130.81, 164.81, 196, 246.94],
  [110, 130.81, 164.81, 196],
  [87.31, 110, 130.81, 164.81],
  [98, 123.47, 146.83, 196],
  [82.41, 98, 123.47, 146.83],
  [110, 130.81, 164.81, 220],
] as const;
const AMBIENT_MELODY = [0, 2, 1, -1, 3, 2, 1, 0, 2, -1, 3, 1, 0, 2, 3, -1] as const;

function scheduleTone(engine: MusicEngine, frequency: number, when: number, duration: number, gainValue: number, type: OscillatorType, detune = 0) {
  const oscillator = engine.context.createOscillator();
  const envelope = engine.context.createGain();
  const filter = engine.context.createBiquadFilter();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, when);
  oscillator.detune.setValueAtTime(detune, when);
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(type === "sine" ? 850 : 1850, when);
  filter.Q.setValueAtTime(0.8, when);
  envelope.gain.setValueAtTime(0.0001, when);
  envelope.gain.exponentialRampToValueAtTime(gainValue, when + Math.min(0.08, duration * 0.2));
  envelope.gain.exponentialRampToValueAtTime(0.0001, when + duration);
  oscillator.connect(filter);
  filter.connect(envelope).connect(engine.musicBus);
  oscillator.start(when);
  oscillator.stop(when + duration + 0.03);
}

function scheduleAmbientStep(engine: MusicEngine, when: number) {
  const step = engine.step;
  const chord = AMBIENT_CHORDS[Math.floor(step / 8) % AMBIENT_CHORDS.length];
  const motif = AMBIENT_MELODY[step % AMBIENT_MELODY.length];
  const variation = Math.floor(step / 32) % 2;
  if (step % 8 === 0) chord.slice(1).forEach((note, index) => scheduleTone(engine, note, when, 3.2, 0.025, "sine", index * 3 - 3));
  if (step % 4 === 0) scheduleTone(engine, chord[0] / 2, when, 1.25, 0.055, "sine");
  scheduleTone(engine, chord[step % chord.length] * 2, when, 0.34, 0.026, "triangle", step % 2 ? 4 : -4);
  if (motif >= 0 && (step + variation) % 3 !== 1) {
    const melodyNote = chord[motif as 0 | 1 | 2 | 3];
    scheduleTone(engine, melodyNote * (variation ? 4 : 3), when + 0.04, 0.72, 0.02, "sine");
  }
  engine.step += 1;
}

function runMusicScheduler(engine: MusicEngine) {
  const horizon = engine.context.currentTime + 0.14;
  while (engine.nextNoteTime < horizon) {
    scheduleAmbientStep(engine, engine.nextNoteTime);
    engine.nextNoteTime += 0.42;
  }
}

export function beginAmbientLoop(engine: MusicEngine) {
  if (engine.timer !== null) return;
  engine.nextNoteTime = engine.context.currentTime + 0.03;
  runMusicScheduler(engine);
  engine.timer = window.setInterval(() => runMusicScheduler(engine), 25);
}

export function stopMusicEngine(engine: MusicEngine | null) {
  if (!engine) return;
  if (engine.timer !== null) window.clearInterval(engine.timer);
  engine.timer = null;
  const now = engine.context.currentTime;
  engine.master.gain.cancelScheduledValues(now);
  engine.master.gain.setTargetAtTime(0.0001, now, 0.04);
  window.setTimeout(() => { if (engine.context.state !== "closed") void engine.context.close(); }, 180);
}

export function playMergeTone(gained: number, engine: MusicEngine | null) {
  try {
    if (!engine || engine.context.state !== "running") return;
    const context = engine.context;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = "sine";
    oscillator.frequency.value = Math.min(720, 260 + Math.log2(gained) * 42);
    gain.gain.setValueAtTime(0.085, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.09);
    oscillator.connect(gain).connect(engine.master);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.1);
  } catch { /* audio is optional */ }
}

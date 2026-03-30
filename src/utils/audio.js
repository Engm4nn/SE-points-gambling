import * as Tone from 'tone';

let initialized = false;
let masterVol;
let spinSynth, winSynth, lossSynth, bonusSynth, jackpotSynth, reelClickSynth;
let spinNoise, spinFilter;

async function init() {
  if (initialized) return;
  await Tone.start();

  masterVol = new Tone.Volume(-6).toDestination();

  // Reel click — short percussive tick
  reelClickSynth = new Tone.MembraneSynth({
    pitchDecay: 0.008,
    octaves: 2,
    envelope: { attack: 0.001, decay: 0.05, sustain: 0, release: 0.01 },
  }).connect(masterVol);

  // Spin noise — filtered white noise
  spinNoise = new Tone.Noise('white');
  spinFilter = new Tone.AutoFilter({
    frequency: 8,
    baseFrequency: 400,
    octaves: 4,
  }).connect(masterVol);
  spinNoise.connect(spinFilter);

  // Win — bright ascending arpeggio
  winSynth = new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: 'triangle' },
    envelope: { attack: 0.01, decay: 0.3, sustain: 0.1, release: 0.5 },
  }).connect(masterVol);

  // Loss — low thud
  lossSynth = new Tone.Synth({
    oscillator: { type: 'sine' },
    envelope: { attack: 0.01, decay: 0.4, sustain: 0, release: 0.3 },
  }).connect(masterVol);

  // Bonus fanfare
  const bonusReverb = new Tone.Reverb(1.5).connect(masterVol);
  bonusSynth = new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: 'sawtooth' },
    envelope: { attack: 0.05, decay: 0.3, sustain: 0.3, release: 1 },
  }).connect(bonusReverb);

  // Jackpot — massive layered fanfare
  const jackpotReverb = new Tone.Reverb(3).connect(masterVol);
  jackpotSynth = new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: 'square' },
    envelope: { attack: 0.02, decay: 0.5, sustain: 0.4, release: 2 },
    volume: -3,
  }).connect(jackpotReverb);

  initialized = true;
}

export const audio = {
  async ensure() {
    await init();
  },

  reelClick() {
    if (!initialized) return;
    reelClickSynth.triggerAttackRelease('C2', '32n', undefined, 0.3);
  },

  startSpin() {
    if (!initialized) return;
    spinFilter.start();
    spinNoise.start();
    spinNoise.volume.value = -12;
  },

  stopSpin() {
    if (!initialized) return;
    try { spinNoise.stop(); } catch {}
    try { spinFilter.stop(); } catch {}
  },

  reelStop() {
    if (!initialized) return;
    reelClickSynth.triggerAttackRelease('G2', '16n', undefined, 0.6);
  },

  win(multiplier = 1) {
    if (!initialized) return;
    const now = Tone.now();
    const notes = multiplier >= 10
      ? ['C5', 'E5', 'G5', 'C6', 'E6']
      : ['C4', 'E4', 'G4', 'C5'];
    notes.forEach((note, i) => {
      winSynth.triggerAttackRelease(note, '8n', now + i * 0.1);
    });
  },

  loss() {
    if (!initialized) return;
    lossSynth.triggerAttackRelease('C2', '8n', undefined, 0.3);
  },

  bonus() {
    if (!initialized) return;
    const now = Tone.now();
    const fanfare = ['C4', 'E4', 'G4', 'C5', 'E5', 'G5', 'C6'];
    fanfare.forEach((note, i) => {
      bonusSynth.triggerAttackRelease(note, '4n', now + i * 0.12, 0.5);
    });
  },

  jackpot() {
    if (!initialized) return;
    const now = Tone.now();
    // Epic ascending chord progression
    const chords = [
      ['C4', 'E4', 'G4'],
      ['D4', 'F#4', 'A4'],
      ['E4', 'G#4', 'B4'],
      ['F4', 'A4', 'C5'],
      ['G4', 'B4', 'D5'],
      ['C5', 'E5', 'G5'],
    ];
    chords.forEach((chord, i) => {
      jackpotSynth.triggerAttackRelease(chord, '2n', now + i * 0.3, 0.6);
    });
  },

  bonusSpin() {
    if (!initialized) return;
    const now = Tone.now();
    winSynth.triggerAttackRelease('E5', '16n', now, 0.3);
    winSynth.triggerAttackRelease('G5', '16n', now + 0.05, 0.3);
  },
};

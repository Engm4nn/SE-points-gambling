import * as Tone from 'tone';

let initialized = false;
let masterVol;
let clickSynth, winSynth, lossSynth, bonusSynth, jackpotSynth;
let plinkoSynth, cardSynth, rouletteSynth;
let lastClickTime = 0;

async function init() {
  if (initialized) return;
  await Tone.start();

  masterVol = new Tone.Volume(-4).toDestination();

  // Reel stop click
  clickSynth = new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: 'triangle' },
    envelope: { attack: 0.001, decay: 0.04, sustain: 0, release: 0.02 },
    volume: -6,
  }).connect(masterVol);

  // Win arpeggio
  winSynth = new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: 'triangle' },
    envelope: { attack: 0.01, decay: 0.25, sustain: 0.05, release: 0.4 },
  }).connect(masterVol);

  // Loss thud
  lossSynth = new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: 'sine' },
    envelope: { attack: 0.01, decay: 0.3, sustain: 0, release: 0.2 },
    volume: -8,
  }).connect(masterVol);

  // Bonus fanfare
  const bonusReverb = new Tone.Reverb(1.2).connect(masterVol);
  bonusSynth = new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: 'sawtooth' },
    envelope: { attack: 0.03, decay: 0.2, sustain: 0.2, release: 0.8 },
    volume: -4,
  }).connect(bonusReverb);

  // Jackpot
  const jackpotReverb = new Tone.Reverb(2.5).connect(masterVol);
  jackpotSynth = new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: 'square' },
    envelope: { attack: 0.02, decay: 0.4, sustain: 0.3, release: 1.5 },
    volume: -6,
  }).connect(jackpotReverb);

  // Plinko peg hit — short high-pitched tick, varies pitch
  plinkoSynth = new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: 'sine' },
    envelope: { attack: 0.001, decay: 0.03, sustain: 0, release: 0.01 },
    volume: -12,
  }).connect(masterVol);

  // Card deal/flip sound
  cardSynth = new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: 'triangle' },
    envelope: { attack: 0.001, decay: 0.05, sustain: 0, release: 0.03 },
    volume: -8,
  }).connect(masterVol);

  // Roulette tick sound (ball clicking past numbers)
  rouletteSynth = new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: 'square' },
    envelope: { attack: 0.001, decay: 0.02, sustain: 0, release: 0.01 },
    volume: -14,
  }).connect(masterVol);

  initialized = true;
}

export const audio = {
  async ensure() {
    await init();
  },

  reelStop() {
    if (!initialized) return;
    try {
      const now = Tone.now();
      const time = Math.max(now, lastClickTime + 0.06);
      lastClickTime = time;
      const notes = ['C5', 'E5', 'G5'];
      const noteIdx = Math.min(2, Math.round((time - now) / 0.06));
      clickSynth.triggerAttackRelease(notes[noteIdx] || 'G5', '64n', time, 0.4);
    } catch {}
  },

  win(multiplier = 1) {
    if (!initialized) return;
    try {
      const now = Tone.now();
      const notes = multiplier >= 10
        ? ['E5', 'G5', 'B5', 'E6']
        : ['C5', 'E5', 'G5'];
      notes.forEach((note, i) => {
        winSynth.triggerAttackRelease(note, '8n', now + i * 0.08, 0.4);
      });
    } catch {}
  },

  loss() {
    if (!initialized) return;
    try {
      lossSynth.triggerAttackRelease('E3', '16n', Tone.now(), 0.2);
    } catch {}
  },

  bonus() {
    if (!initialized) return;
    try {
      const now = Tone.now();
      ['C4', 'E4', 'G4', 'C5', 'E5', 'G5'].forEach((note, i) => {
        bonusSynth.triggerAttackRelease(note, '4n', now + i * 0.1, 0.4);
      });
    } catch {}
  },

  jackpot() {
    if (!initialized) return;
    try {
      const now = Tone.now();
      const chords = [
        ['C4', 'E4', 'G4'],
        ['E4', 'G#4', 'B4'],
        ['G4', 'B4', 'D5'],
        ['C5', 'E5', 'G5'],
      ];
      chords.forEach((chord, i) => {
        jackpotSynth.triggerAttackRelease(chord, '2n', now + i * 0.25, 0.5);
      });
    } catch {}
  },

  // Plinko: ball hits peg — random high pitch
  plinkoHit() {
    if (!initialized) return;
    try {
      const notes = ['C6', 'D6', 'E6', 'F6', 'G6', 'A6', 'B6'];
      const note = notes[Math.floor(Math.random() * notes.length)];
      plinkoSynth.triggerAttackRelease(note, '64n', Tone.now(), 0.3);
    } catch {}
  },

  // Plinko: ball lands in winning bucket
  plinkoWin() {
    if (!initialized) return;
    try {
      const now = Tone.now();
      ['G5', 'B5', 'D6'].forEach((note, i) => {
        winSynth.triggerAttackRelease(note, '16n', now + i * 0.06, 0.4);
      });
    } catch {}
  },

  // Blackjack: card dealt
  cardDeal() {
    if (!initialized) return;
    try {
      cardSynth.triggerAttackRelease('A5', '64n', Tone.now(), 0.3);
    } catch {}
  },

  // Blackjack: card flip (dealer reveals)
  cardFlip() {
    if (!initialized) return;
    try {
      cardSynth.triggerAttackRelease('E5', '32n', Tone.now(), 0.4);
    } catch {}
  },

  // Roulette: ball ticking past numbers
  rouletteTick() {
    if (!initialized) return;
    try {
      rouletteSynth.triggerAttackRelease('C7', '128n', Tone.now(), 0.2);
    } catch {}
  },

  // Roulette: ball landing
  rouletteLand() {
    if (!initialized) return;
    try {
      const now = Tone.now();
      clickSynth.triggerAttackRelease('G4', '16n', now, 0.5);
      clickSynth.triggerAttackRelease('C5', '16n', now + 0.1, 0.3);
    } catch {}
  },

  // Gates of Olympus: symbols popping/exploding
  cascadePop() {
    if (!initialized) return;
    try {
      const now = Tone.now();
      clickSynth.triggerAttackRelease('A5', '64n', now, 0.3);
      clickSynth.triggerAttackRelease('C6', '64n', now + 0.04, 0.25);
    } catch {}
  },

  // Gates of Olympus: multiplier orb collected
  orbCollect() {
    if (!initialized) return;
    try {
      const now = Tone.now();
      winSynth.triggerAttackRelease('E5', '16n', now, 0.3);
      winSynth.triggerAttackRelease('A5', '16n', now + 0.06, 0.3);
      winSynth.triggerAttackRelease('C#6', '16n', now + 0.12, 0.35);
    } catch {}
  },

  // Gates of Olympus: new symbols landing after cascade
  cascadeLand() {
    if (!initialized) return;
    try {
      clickSynth.triggerAttackRelease('C4', '32n', Tone.now(), 0.3);
    } catch {}
  },
};

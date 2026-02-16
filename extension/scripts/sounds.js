/**
 * QuestTube - Sound Manager
 * Retro audio via Web Audio API: SFX, quiz BGM, and mode preview themes
 */

class SoundManager {
  constructor() {
    this.ctx = null;
    this.bgmNodes = [];
    this.isPlayingMusic = false;
    this._currentMode = null;

    // localStorage can throw in some browser privacy modes/content contexts.
    try {
      this.muted = localStorage.getItem('ytq-muted') === 'true';
    } catch (error) {
      console.warn('QuestTube: Failed to read mute preference', error);
      this.muted = false;
    }
  }

  init() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  toggleMute() {
    this.muted = !this.muted;
    try {
      localStorage.setItem('ytq-muted', String(this.muted));
    } catch (error) {
      console.warn('QuestTube: Failed to persist mute preference', error);
    }

    if (this.muted) {
      this.stopMusic();
    } else {
      this.playMusic();
    }
    return this.muted;
  }

  playTone(freq, type, duration, startTime = 0, volume = 0.05) {
    // Only init on user interaction if needed, but here we assume init() called on click
    if (this.muted || !this.ctx) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, this.ctx.currentTime + startTime);

    gain.gain.setValueAtTime(volume, this.ctx.currentTime + startTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + startTime + duration);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(this.ctx.currentTime + startTime);
    osc.stop(this.ctx.currentTime + startTime + duration);
  }

  playCorrect() {
    this.init();
    // Retro Coin Sound: High B -> High E
    this.playTone(987.77, 'square', 0.1, 0, 0.05);
    this.playTone(1318.51, 'square', 0.4, 0.1, 0.05);
  }

  playIncorrect() {
    this.init();
    // Low Damage Sound: Sawtooth descent
    this.playTone(150, 'sawtooth', 0.2, 0, 0.08);
    this.playTone(100, 'sawtooth', 0.2, 0.1, 0.08);
  }

  playLevelUp() {
    this.init();
    // Victory Fanfare: C-E-G-C
    const now = 0;
    this.playTone(523.25, 'square', 0.2, now, 0.05);
    this.playTone(659.25, 'square', 0.2, now + 0.15, 0.05);
    this.playTone(783.99, 'square', 0.2, now + 0.3, 0.05);
    this.playTone(1046.50, 'square', 0.6, now + 0.45, 0.05);
  }

  playClick() {
    this.init();
    this.playTone(800, 'sine', 0.05, 0, 0.02);
  }

  playQuestChime() {
    this.init();
    if (!this.ctx) return;
    // Retro RPG "quest accepted" jingle: rising arpeggio with sparkle
    this.playTone(523.25, 'square', 0.08, 0, 0.04);      // C5
    this.playTone(659.25, 'square', 0.08, 0.07, 0.04);    // E5
    this.playTone(783.99, 'square', 0.08, 0.14, 0.04);    // G5
    this.playTone(1046.50, 'square', 0.25, 0.21, 0.04);   // C6 (hold)
    this.playTone(1318.51, 'sine', 0.3, 0.28, 0.02);      // E6 sparkle
  }

  playSelect() {
    // UI feedback sound — always plays regardless of battle-mute state
    this.init();
    if (!this.ctx) return;
    const t = this.ctx.currentTime;

    // Chunky two-note confirmation chime (Pokémon menu select)
    [[523.25, 'square', 0.08, 0, 0.06],
     [784.00, 'square', 0.25, 0.08, 0.06],
     [130.81, 'triangle', 0.15, 0, 0.08]].forEach(([freq, type, dur, delay, vol]) => {
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = type;
      o.frequency.value = freq;
      g.gain.setValueAtTime(vol, t + delay);
      g.gain.exponentialRampToValueAtTime(0.001, t + delay + dur);
      o.connect(g); g.connect(this.ctx.destination);
      o.start(t + delay); o.stop(t + delay + dur);
    });
  }

  playMusic(mode) {
    if (mode) this._currentMode = mode;
    if (this.muted || this.isPlayingMusic) return;
    this.init();
    this.isPlayingMusic = true;

    // Skyrim-inspired ambient theme for quiz gameplay
    const tempo = 66;
    const eighthNote = 60 / tempo / 2;
    let nextTime = this.ctx.currentTime;
    let step = 0;

    const loop = () => {
      if (!this.isPlayingMusic) return;
      while (nextTime < this.ctx.currentTime + 0.1) {
        this._skyrimNote(step, nextTime);
        nextTime += eighthNote;
        step = (step + 1) % 32;
      }
      this.timerID = setTimeout(loop, 25);
    };

    loop();
  }

  // --- Quiz: "Dragonborn's Rest" — Skyrim-inspired ambient ---
  // D Dorian, 66 BPM, ethereal sine pads, sparse harp, deep bass drone
  _skyrimNote(step, t) {
    if (!this.ctx) return;

    // Pad — ethereal sustained sine chords (Dm → Am → C → G)
    if (step % 8 === 0) {
      const padChords = [
        [293.66, 349.23, 440.00],  // Dm: D4, F4, A4
        [220.00, 261.63, 329.63],  // Am: A3, C4, E4
        [261.63, 329.63, 392.00],  // C:  C4, E4, G4
        [196.00, 246.94, 293.66],  // G:  G3, B3, D4
      ];
      const chord = padChords[step / 8 | 0];
      chord.forEach(freq => {
        const o = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        o.type = 'sine';
        o.frequency.value = freq;
        // Slow swell in, gentle sustain, slow fade
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(0.018, t + 0.6);
        g.gain.linearRampToValueAtTime(0.012, t + 2.8);
        g.gain.exponentialRampToValueAtTime(0.001, t + 3.6);
        o.connect(g); g.connect(this.ctx.destination);
        o.start(t); o.stop(t + 3.6);
      });
    }

    // Harp — sparse, delicate sine plucks (like a distant lute)
    const harp = [
      587.33, 0, 0, 0, 440.00, 0, 523.25, 0,
      0, 0, 392.00, 0, 0, 0, 329.63, 0,
      523.25, 0, 0, 0, 659.25, 0, 0, 0,
      392.00, 0, 0, 293.66, 0, 0, 349.23, 0,
    ];
    const hf = harp[step];
    if (hf) {
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = 'sine';
      o.frequency.value = hf;
      g.gain.setValueAtTime(0.04, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.9);
      o.connect(g); g.connect(this.ctx.destination);
      o.start(t); o.stop(t + 0.9);
    }

    // Bass drone — deep triangle, one per bar
    if (step % 8 === 0) {
      const bassNotes = [73.42, 55.00, 65.41, 49.00]; // D2, A1, C2, G1
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = 'triangle';
      o.frequency.value = bassNotes[step / 8 | 0];
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.035, t + 0.4);
      g.gain.linearRampToValueAtTime(0.025, t + 2.8);
      g.gain.exponentialRampToValueAtTime(0.001, t + 3.6);
      o.connect(g); g.connect(this.ctx.destination);
      o.start(t); o.stop(t + 3.6);
    }

    // Fifth harmony — open fifths layered on pad for Nordic feel
    if (step % 8 === 2) {
      const fifths = [440.00, 329.63, 392.00, 293.66]; // A4, E4, G4, D4
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = 'sine';
      o.frequency.value = fifths[step / 8 | 0];
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.012, t + 0.3);
      g.gain.exponentialRampToValueAtTime(0.001, t + 2.0);
      o.connect(g); g.connect(this.ctx.destination);
      o.start(t); o.stop(t + 2.0);
    }

    // High shimmer — distant bells, very rare
    if (step === 4 || step === 20) {
      const shimmerFreqs = [1760.00, 2093.00]; // A6, C7
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = 'sine';
      o.frequency.value = shimmerFreqs[step === 4 ? 0 : 1];
      g.gain.setValueAtTime(0.006, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 2.5);
      o.connect(g); g.connect(this.ctx.destination);
      o.start(t); o.stop(t + 2.5);
    }
  }

  stopMusic() {
    this.isPlayingMusic = false;
    if (this.timerID) clearTimeout(this.timerID);
    this.ctx = null; // Reset context
    this.bgmNodes.forEach(node => {
      try { node.stop(); } catch (e) { }
      try { node.disconnect(); } catch (e) { }
    });
    this.bgmNodes = [];
  }

  // ============ MODE PREVIEW MUSIC ============

  /**
   * Play a preview theme for the difficulty mode selection screen.
   * Each mode has its own Pokémon-inspired loop that gets progressively
   * more intense: meadow → dungeon → boss.
   */
  playModePreview(mode) {
    // Stop any current music without destroying context for fast switching
    this.isPlayingMusic = false;
    if (this.timerID) {
      clearTimeout(this.timerID);
      this.timerID = null;
    }

    // Mode preview ignores the battle-mute flag — there's no mute
    // toggle on the mode-select screen, so preview should always play.
    this.init();
    this.isPlayingMusic = true;

    const configs = {
      easy:         { tempo: 120, fn: '_meadowNote' },
      intermediate: { tempo: 128, fn: '_dungeonNote' },
      boss:         { tempo: 162, fn: '_bossNote' },
    };

    const cfg = configs[mode];
    if (!cfg) return;

    const eighthNote = 60 / cfg.tempo / 2;
    let nextTime = this.ctx.currentTime;
    let step = 0;

    const loop = () => {
      if (!this.isPlayingMusic) return;
      while (nextTime < this.ctx.currentTime + 0.1) {
        this[cfg.fn](step, nextTime);
        nextTime += eighthNote;
        step = (step + 1) % 32;
      }
      this.timerID = setTimeout(loop, 25);
    };

    loop();
  }

  // --- Easy: "Slime Meadow" — Pokémon town / route theme ---
  // C Major, 120 BPM, bouncy sine lead, bright harmony, staccato bass
  _meadowNote(step, t) {
    if (!this.ctx) return;

    // Melody — every 8th note filled, no rests, happy bouncy arpeggios
    const melody = [
      // Bar 1: C major bounce
      523.25, 392.00, 523.25, 659.25, 783.99, 659.25, 523.25, 659.25,
      // Bar 2: F major lift
      698.46, 523.25, 698.46, 880.00, 698.46, 523.25, 440.00, 523.25,
      // Bar 3: G major sparkle
      783.99, 587.33, 783.99, 987.77, 783.99, 587.33, 493.88, 587.33,
      // Bar 4: C resolve with trill
      1046.50, 987.77, 1046.50, 783.99, 659.25, 523.25, 659.25, 523.25,
    ];

    const freq = melody[step];
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = 'sine';
    o.frequency.value = freq;
    g.gain.setValueAtTime(0.055, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
    o.connect(g); g.connect(this.ctx.destination);
    o.start(t); o.stop(t + 0.12);

    // Harmony — bright triangle chord tones on every beat
    if (step % 4 === 0) {
      const chords = [
        329.63, 329.63, 440.00, 440.00, 493.88, 493.88, 329.63, 329.63
      ]; // E4, A4, B4, E4
      const ho = this.ctx.createOscillator();
      const hg = this.ctx.createGain();
      ho.type = 'triangle';
      ho.frequency.value = chords[step / 4 | 0];
      hg.gain.setValueAtTime(0.03, t);
      hg.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
      ho.connect(hg); hg.connect(this.ctx.destination);
      ho.start(t); ho.stop(t + 0.25);
    }

    // Counter-melody — chirpy high sine on off-beats
    if (step % 2 === 1) {
      const counter = [
        1318.51, 0, 1174.66, 0, 1318.51, 0, 1046.50, 0,
        1396.91, 0, 1174.66, 0, 1396.91, 0, 1046.50, 0,
      ];
      const cf = counter[step >> 1];
      if (cf) {
        const co = this.ctx.createOscillator();
        const cg = this.ctx.createGain();
        co.type = 'sine';
        co.frequency.value = cf;
        cg.gain.setValueAtTime(0.015, t);
        cg.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
        co.connect(cg); cg.connect(this.ctx.destination);
        co.start(t); co.stop(t + 0.06);
      }
    }

    // Bass — bouncy staccato triangle
    if (step % 2 === 0) {
      const bass = [
        130.81, 130.81, 130.81, 130.81,
        174.61, 174.61, 174.61, 174.61,
        196.00, 196.00, 196.00, 196.00,
        130.81, 130.81, 130.81, 130.81,
      ];
      const bo = this.ctx.createOscillator();
      const bg = this.ctx.createGain();
      bo.type = 'triangle';
      bo.frequency.value = bass[step >> 1];
      bg.gain.setValueAtTime(0.05, t);
      bg.gain.linearRampToValueAtTime(0.0, t + 0.08);
      bo.connect(bg); bg.connect(this.ctx.destination);
      bo.start(t); bo.stop(t + 0.08);
    }
  }

  // --- Medium: "Dungeon Crawl" — Pokémon cave / rival route ---
  // A Minor, 128 BPM, square lead, triangle bass, light hi-hat
  _dungeonNote(step, t) {
    if (!this.ctx) return;

    // Lead — square wave, 8-bit adventurous
    const melody = [
      // Bar 1: Am arpeggio
      440.00, 0, 523.25, 0, 659.25, 0, 523.25, 0,
      // Bar 2: F major lift
      349.23, 0, 440.00, 0, 523.25, 0, 698.46, 0,
      // Bar 3: G resolve
      392.00, 0, 493.88, 0, 587.33, 0, 493.88, 0,
      // Bar 4: E → Am descent
      659.25, 0, 587.33, 0, 523.25, 0, 440.00, 0,
    ];

    const freq = melody[step];
    if (freq) {
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = 'square';
      o.frequency.value = freq;
      g.gain.setValueAtTime(0.035, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
      o.connect(g); g.connect(this.ctx.destination);
      o.start(t); o.stop(t + 0.14);
    }

    // Counter-melody — quiet triangle on off-beats
    if (step % 2 === 1 && step % 4 !== 3) {
      const counter = [
        220, 220, 220, 220, 174.61, 174.61, 174.61, 174.61,
        196, 196, 196, 196, 164.81, 164.81, 164.81, 164.81,
      ];
      const cf = counter[step >> 1];
      if (cf) {
        const o = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        o.type = 'triangle';
        o.frequency.value = cf;
        g.gain.setValueAtTime(0.02, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
        o.connect(g); g.connect(this.ctx.destination);
        o.start(t); o.stop(t + 0.1);
      }
    }

    // Bass — driving triangle 8th notes
    if (step % 2 === 0) {
      const bass = [
        110, 110, 110, 110, 87.31, 87.31, 87.31, 87.31,
        98, 98, 98, 98, 82.41, 82.41, 82.41, 82.41,
      ];
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = 'triangle';
      o.frequency.value = bass[step >> 1];
      g.gain.setValueAtTime(0.06, t);
      g.gain.linearRampToValueAtTime(0.0, t + 0.14);
      o.connect(g); g.connect(this.ctx.destination);
      o.start(t); o.stop(t + 0.14);
    }

    // Hi-hat — light ticks
    if (step % 4 === 0) {
      const len = this.ctx.sampleRate * 0.03;
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      const n = this.ctx.createBufferSource();
      n.buffer = buf;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.025, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.03);
      n.connect(g); g.connect(this.ctx.destination);
      n.start(t);
    }
  }

  // --- Boss: "Boss Arena" — Pokémon gym leader / Elite Four ---
  // E Minor, 162 BPM, sawtooth lead, sawtooth bass, full drums
  _bossNote(step, t) {
    if (!this.ctx) return;

    // Lead — aggressive sawtooth, every 8th note (no rests!)
    const melody = [
      // Bar 1: Em shred
      659.25, 493.88, 659.25, 783.99, 659.25, 493.88, 392.00, 493.88,
      // Bar 2: Dm power
      587.33, 440.00, 587.33, 739.99, 587.33, 440.00, 369.99, 440.00,
      // Bar 3: C tension
      523.25, 392.00, 523.25, 659.25, 523.25, 392.00, 329.63, 392.00,
      // Bar 4: B → Em resolve
      493.88, 369.99, 493.88, 587.33, 659.25, 587.33, 493.88, 392.00,
    ];

    const freq = melody[step];
    // Random octave jump for chaos
    const f = (Math.random() > 0.85) ? freq * 2 : freq;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = 'sawtooth';
    o.frequency.value = f;
    g.gain.setValueAtTime(0.035, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
    o.connect(g); g.connect(this.ctx.destination);
    o.start(t); o.stop(t + 0.08);

    // Bass — heavy sawtooth, sub-octave drop on downbeats
    const bassRoots = [82.41, 82.41, 73.42, 73.42, 65.41, 65.41, 61.74, 61.74];
    let bf = bassRoots[step >> 2];
    if (step % 8 === 0) bf /= 2; // Sub drop on bar starts
    const bo = this.ctx.createOscillator();
    const bg = this.ctx.createGain();
    bo.type = 'sawtooth';
    bo.frequency.value = bf;
    bg.gain.setValueAtTime(0.06, t);
    bg.gain.linearRampToValueAtTime(0.0, t + 0.1);
    bo.connect(bg); bg.connect(this.ctx.destination);
    bo.start(t); bo.stop(t + 0.1);

    // Drums — full kit: kick, snare, hi-hat
    if (step % 2 === 0) {
      const len = this.ctx.sampleRate * 0.05;
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      const n = this.ctx.createBufferSource();
      n.buffer = buf;
      const ng = this.ctx.createGain();

      if (step % 8 === 0) {            // Kick
        ng.gain.setValueAtTime(0.12, t);
      } else if (step % 8 === 4) {     // Snare
        ng.gain.setValueAtTime(0.07, t);
      } else {                          // Hi-hat
        ng.gain.setValueAtTime(0.02, t);
      }

      ng.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
      n.connect(ng); ng.connect(this.ctx.destination);
      n.start(t);
    }
  }
}

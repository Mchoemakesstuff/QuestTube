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

  /**
   * Descending transition — simple chromatic descent, one note at a time,
   * looping until stopTransition() is called.
   */
  playDescend() {
    this.stopTransition();
    this.init();
    if (!this.ctx) return;
    this._transitionPlaying = true;

    this._descendFreq = 659.25; // Start at E5

    const tick = () => {
      if (!this._transitionPlaying || !this.ctx) return;
      const now = this.ctx.currentTime;

      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = 'sine';
      o.frequency.value = this._descendFreq;
      g.gain.setValueAtTime(0.045, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
      o.connect(g); g.connect(this.ctx.destination);
      o.start(now); o.stop(now + 0.5);

      // Step down one semitone
      this._descendFreq *= 0.94387; // 2^(-1/12)
      if (this._descendFreq < 65) this._descendFreq *= 2;

      this._transitionTimer = setTimeout(tick, 400);
    };

    tick();
  }

  /**
   * Ascending transition — simple chromatic ascent, one note at a time,
   * looping until stopTransition() is called.
   */
  playAscend() {
    this.stopTransition();
    this.init();
    if (!this.ctx) return;
    this._transitionPlaying = true;

    this._ascendFreq = 130.81; // Start at C3

    const tick = () => {
      if (!this._transitionPlaying || !this.ctx) return;
      const now = this.ctx.currentTime;

      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = 'sine';
      o.frequency.value = this._ascendFreq;
      g.gain.setValueAtTime(0.045, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
      o.connect(g); g.connect(this.ctx.destination);
      o.start(now); o.stop(now + 0.5);

      // Step up one semitone
      this._ascendFreq *= 1.05946; // 2^(1/12)
      if (this._ascendFreq > 2100) this._ascendFreq *= 0.5;

      this._transitionTimer = setTimeout(tick, 400);
    };

    tick();
  }

  /**
   * Stop any running transition jingle (descend or ascend).
   */
  stopTransition() {
    this._transitionPlaying = false;
    if (this._transitionTimer) {
      clearTimeout(this._transitionTimer);
      this._transitionTimer = null;
    }
  }

  playSelect() {
    this.init();
    if (this.muted || !this.ctx) return;
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

  /** Short descending note — moving to next floor/question */
  playNextFloor() {
    this.init();
    if (this.muted || !this.ctx) return;
    const t = this.ctx.currentTime;
    // Quick two-note descend: high → low
    [[440, 0.05, 0], [330, 0.12, 0.06]].forEach(([freq, dur, delay]) => {
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = 'triangle';
      o.frequency.value = freq;
      g.gain.setValueAtTime(0.04, t + delay);
      g.gain.exponentialRampToValueAtTime(0.001, t + delay + dur);
      o.connect(g); g.connect(this.ctx.destination);
      o.start(t + delay); o.stop(t + delay + dur);
    });
  }

  /** Achievement unlock chime — Dark Souls "bonfire lit" vibe */
  playAchievement() {
    this.init();
    if (this.muted || !this.ctx) return;
    const t = this.ctx.currentTime;
    // Ethereal rising triad: D5 → F#5 → A5 with long reverb tail
    [[587.33, 0], [739.99, 0.12], [880.00, 0.24]].forEach(([freq, delay]) => {
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = 'sine';
      o.frequency.value = freq;
      g.gain.setValueAtTime(0.06, t + delay);
      g.gain.exponentialRampToValueAtTime(0.001, t + delay + 1.2);
      o.connect(g); g.connect(this.ctx.destination);
      o.start(t + delay); o.stop(t + delay + 1.2);
    });
    // High shimmer on top — confirms the moment
    const so = this.ctx.createOscillator();
    const sg = this.ctx.createGain();
    so.type = 'sine';
    so.frequency.value = 1760.00;
    sg.gain.setValueAtTime(0.02, t + 0.36);
    sg.gain.exponentialRampToValueAtTime(0.001, t + 2.0);
    so.connect(sg); sg.connect(this.ctx.destination);
    so.start(t + 0.36); so.stop(t + 2.0);
  }

  /** Tiny tick for hovering over options */
  playTick() {
    this.init();
    if (this.muted || !this.ctx) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = 'square';
    o.frequency.value = 660;
    g.gain.setValueAtTime(0.015, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.03);
    o.connect(g); g.connect(this.ctx.destination);
    o.start(t); o.stop(t + 0.03);
  }

  playMusic(mode) {
    if (mode) this._currentMode = mode;
    if (this.muted || this.isPlayingMusic) return;
    this.init();
    this.isPlayingMusic = true;
    this.intensity = 0;

    const configs = {
      easy: { tempo: 120, fn: '_meadowNote' },
      intermediate: { tempo: 108, fn: '_dungeonNote' },
      boss: { tempo: 88, fn: '_bossNote' },
    };
    const cfg = configs[this._currentMode] || { tempo: 66, fn: '_skyrimNote' };
    this._baseTempo = cfg.tempo;
    this._eighthNote = 60 / cfg.tempo / 2;

    const fn = cfg.fn;
    let nextTime = this.ctx.currentTime;
    let step = 0;

    const loop = () => {
      if (!this.isPlayingMusic) return;
      while (nextTime < this.ctx.currentTime + 0.1) {
        this[fn](step, nextTime);
        nextTime += this._eighthNote;
        step = (step + 1) % 32;
      }
      this.timerID = setTimeout(loop, 25);
    };

    loop();
  }

  /**
   * Escalate music intensity (called on wrong answers).
   * Caps: easy/intermediate = 3, boss = 5.
   */
  raiseIntensity() {
    const caps = { easy: 3, intermediate: 3, boss: 5 };
    const max = caps[this._currentMode];
    if (max == null) return;
    this.intensity = Math.min((this.intensity || 0) + 1, max);
    this._eighthNote = 60 / (this._baseTempo + this.intensity * 6) / 2;
  }

  /**
   * De-escalate music intensity (called on correct answers).
   * Floors at 0 — if already at base level, does nothing.
   */
  lowerIntensity() {
    if (!this.intensity) return;
    this.intensity = Math.max(this.intensity - 1, 0);
    this._eighthNote = 60 / (this._baseTempo + this.intensity * 6) / 2;
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

  _playResultsTheme(fn, tempo) {
    // Stop quiz music, transition to results theme
    this.isPlayingMusic = false;
    if (this.timerID) {
      clearTimeout(this.timerID);
      this.timerID = null;
    }

    if (this.muted) return;
    this.init();
    this.isPlayingMusic = true;

    this._eighthNote = 60 / tempo / 2;
    let nextTime = this.ctx.currentTime;
    let step = 0;

    const loop = () => {
      if (!this.isPlayingMusic) return;
      while (nextTime < this.ctx.currentTime + 0.1) {
        this[fn](step, nextTime);
        nextTime += this._eighthNote;
        step = (step + 1) % 32;
      }
      this.timerID = setTimeout(loop, 25);
    };

    loop();
  }

  playVictory() {
    this._playResultsTheme('_victoryNote', 130);
  }

  playDefeat() {
    this._playResultsTheme('_defeatNote', 56);
  }

  stopMusic() {
    this.isPlayingMusic = false;
    if (this.timerID) {
      clearTimeout(this.timerID);
      this.timerID = null;
    }
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

    if (this.muted) return;
    this.init();
    this.isPlayingMusic = true;

    const configs = {
      easy: { tempo: 120, fn: '_meadowNote' },
      intermediate: { tempo: 108, fn: '_dungeonNote' },
      boss: { tempo: 88, fn: '_bossNote' },
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
  //
  // Intensity levels (this.intensity):
  //   0: Base — happy bouncy arpeggios, sine lead, bright chords
  //   1: Lead detunes, soft kick on downbeats — tension creeps in
  //   2: Square wave shadow on melody, counter-melody harshens, snare added
  //   3: Minor-key corruption (Eb/Bb), ominous drone — the meadow darkens
  _meadowNote(step, t) {
    if (!this.ctx) return;
    const I = this.intensity || 0;

    // Melody — every 8th note filled, happy bouncy arpeggios
    const melody = [
      523.25, 392.00, 523.25, 659.25, 783.99, 659.25, 523.25, 659.25,
      698.46, 523.25, 698.46, 880.00, 698.46, 523.25, 440.00, 523.25,
      783.99, 587.33, 783.99, 987.77, 783.99, 587.33, 493.88, 587.33,
      1046.50, 987.77, 1046.50, 783.99, 659.25, 523.25, 659.25, 523.25,
    ];

    const freq = melody[step];
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = 'sine';
    o.frequency.value = freq;
    if (I >= 1) o.detune.value = (step % 2 === 0 ? 1 : -1) * I * 4;
    g.gain.setValueAtTime(0.055, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
    o.connect(g); g.connect(this.ctx.destination);
    o.start(t); o.stop(t + 0.12);

    // Level 2+: square wave shadow — same melody, darker timbre
    if (I >= 2) {
      const so = this.ctx.createOscillator();
      const sg = this.ctx.createGain();
      so.type = 'square';
      so.frequency.value = freq;
      so.detune.value = -6;
      sg.gain.setValueAtTime(0.012, t);
      sg.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
      so.connect(sg); sg.connect(this.ctx.destination);
      so.start(t); so.stop(t + 0.1);
    }

    // Harmony — bright triangle chord tones on every beat
    // Level 3: minor-key corruption (E→Eb, B→Bb)
    if (step % 4 === 0) {
      const major = [329.63, 329.63, 440.00, 440.00, 493.88, 493.88, 329.63, 329.63];
      const minor = [311.13, 311.13, 415.30, 415.30, 466.16, 466.16, 311.13, 311.13];
      const chords = I >= 3 ? minor : major;
      const ho = this.ctx.createOscillator();
      const hg = this.ctx.createGain();
      ho.type = 'triangle';
      ho.frequency.value = chords[step / 4 | 0];
      hg.gain.setValueAtTime(0.03, t);
      hg.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
      ho.connect(hg); hg.connect(this.ctx.destination);
      ho.start(t); ho.stop(t + 0.25);
    }

    // Counter-melody — chirpy high on off-beats
    // Level 2+: switches from sine to square (harsher)
    if (step % 2 === 1) {
      const counter = [
        1318.51, 0, 1174.66, 0, 1318.51, 0, 1046.50, 0,
        1396.91, 0, 1174.66, 0, 1396.91, 0, 1046.50, 0,
      ];
      const cf = counter[step >> 1];
      if (cf) {
        const co = this.ctx.createOscillator();
        const cg = this.ctx.createGain();
        co.type = I >= 2 ? 'square' : 'sine';
        co.frequency.value = cf;
        cg.gain.setValueAtTime(0.015, t);
        cg.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
        co.connect(cg); cg.connect(this.ctx.destination);
        co.start(t); co.stop(t + 0.06);
      }
    }

    // Bass — bouncy staccato triangle (sustains longer with intensity)
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
      const bv = Math.min(0.05 + I * 0.01, 0.08);
      const dur = 0.08 + I * 0.03;
      bg.gain.setValueAtTime(bv, t);
      bg.gain.linearRampToValueAtTime(0.0, t + dur);
      bo.connect(bg); bg.connect(this.ctx.destination);
      bo.start(t); bo.stop(t + dur);
    }

    // Level 1+: soft kick on downbeats — tension building
    if (I >= 1 && step % 8 === 0) {
      const kick = this.ctx.createOscillator();
      const kg = this.ctx.createGain();
      kick.type = 'sine';
      kick.frequency.setValueAtTime(80, t);
      kick.frequency.exponentialRampToValueAtTime(35, t + 0.1);
      kg.gain.setValueAtTime(0.04 + I * 0.015, t);
      kg.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
      kick.connect(kg); kg.connect(this.ctx.destination);
      kick.start(t); kick.stop(t + 0.12);
    }

    // Level 2+: snare on backbeat — rhythm gets serious
    if (I >= 2 && step % 8 === 4) {
      const len = this.ctx.sampleRate * 0.06;
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      const n = this.ctx.createBufferSource();
      n.buffer = buf;
      const ng = this.ctx.createGain();
      ng.gain.setValueAtTime(0.03, t);
      ng.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
      n.connect(ng); ng.connect(this.ctx.destination);
      n.start(t);
    }

    // Level 3: ominous low drone — the meadow darkens
    if (I >= 3 && step % 16 === 0) {
      const dr = this.ctx.createOscillator();
      const dg = this.ctx.createGain();
      dr.type = 'triangle';
      dr.frequency.value = 65.41;
      dg.gain.setValueAtTime(0, t);
      dg.gain.linearRampToValueAtTime(0.02, t + 0.5);
      dg.gain.exponentialRampToValueAtTime(0.001, t + 3.0);
      dr.connect(dg); dg.connect(this.ctx.destination);
      dr.start(t); dr.stop(t + 3.0);
    }
  }

  // --- Medium: "Echoing Depths" — eerie dungeon crawl ---
  // A minor / chromatic, 108 BPM, ghostly sine lead with cave echo,
  // square counter-melody, walking bass, skitter bleeps, heartbeat
  //
  // Intensity levels (this.intensity):
  //   0: Base — ghostly lead, sparse echo, heartbeat, water drips
  //   1: Extra skitters, more whispers, heartbeat louder
  //   2: Second cave echo, counter-melody louder, drips double, heartbeat x2
  //   3: Bass drops octave, groans more frequent, sub-bass rumble
  _dungeonNote(step, t) {
    if (!this.ctx) return;
    const I = this.intensity || 0;

    // Lead — ghostly sine, sparse with long decay
    const melody = [
      440.00, 0, 0, 0, 415.30, 0, 0, 0,
      349.23, 0, 0, 329.63, 0, 0, 0, 0,
      349.23, 0, 0, 0, 0, 0, 311.13, 0,
      329.63, 0, 293.66, 0, 0, 0, 0, 0,
    ];

    const freq = melody[step];
    if (freq) {
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = 'sine';
      o.frequency.value = freq;
      if (I >= 2) o.detune.value = I * 3;
      g.gain.setValueAtTime(0.045 + I * 0.005, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.8);
      o.connect(g); g.connect(this.ctx.destination);
      o.start(t); o.stop(t + 0.8);

      // Cave echo — delayed, slightly detuned, wavering
      const eo = this.ctx.createOscillator();
      const eg = this.ctx.createGain();
      eo.type = 'sine';
      eo.frequency.value = freq * (1.003 + I * 0.002);
      eg.gain.setValueAtTime(0.018 + I * 0.005, t + 0.2);
      eg.gain.exponentialRampToValueAtTime(0.001, t + 0.9);
      eo.connect(eg); eg.connect(this.ctx.destination);
      eo.start(t + 0.2); eo.stop(t + 0.9);

      // Level 2+: second echo — the cave gets deeper
      if (I >= 2) {
        const eo2 = this.ctx.createOscillator();
        const eg2 = this.ctx.createGain();
        eo2.type = 'sine';
        eo2.frequency.value = freq * 0.997;
        eg2.gain.setValueAtTime(0.01, t + 0.4);
        eg2.gain.exponentialRampToValueAtTime(0.001, t + 1.1);
        eo2.connect(eg2); eg2.connect(this.ctx.destination);
        eo2.start(t + 0.4); eo2.stop(t + 1.1);
      }
    }

    // Counter-melody — square wave, fills gaps (louder with intensity)
    const counter = [
      0, 0, 220.00, 0, 0, 0, 207.65, 0,
      0, 174.61, 0, 0, 0, 164.81, 0, 0,
      0, 0, 174.61, 0, 164.81, 0, 0, 155.56,
      0, 0, 0, 146.83, 0, 0, 0, 0,
    ];
    const cf = counter[step];
    if (cf) {
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = 'square';
      o.frequency.value = cf;
      g.gain.setValueAtTime(Math.min(0.018 + I * 0.004, 0.03), t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
      o.connect(g); g.connect(this.ctx.destination);
      o.start(t); o.stop(t + 0.2);
    }

    // Walking bass — triangle, quarter notes (drops octave at level 3)
    if (step % 4 === 0) {
      const bass = [
        110.00, 103.83, 87.31, 82.41,
        87.31, 82.41, 77.78, 82.41,
      ];
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = 'triangle';
      const bf = bass[step / 4 | 0];
      o.frequency.value = I >= 3 ? bf * 0.5 : bf;
      const bv = Math.min(0.04 + I * 0.008, 0.065);
      g.gain.setValueAtTime(bv, t);
      g.gain.linearRampToValueAtTime(bv * 0.5, t + 0.4);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.6);
      o.connect(g); g.connect(this.ctx.destination);
      o.start(t); o.stop(t + 0.6);
    }

    // Skitter — quick descending square bleeps (more frequent at I=1+)
    const skitterSteps = I >= 1 ? [10, 18, 26] : [10, 26];
    if (skitterSteps.includes(step)) {
      const notes = step === 10
        ? [880.00, 659.25, 440.00]
        : step === 18
          ? [932.33, 698.46, 466.16]
          : [783.99, 587.33, 392.00];
      notes.forEach((sf, i) => {
        const o = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        o.type = 'square';
        o.frequency.value = sf;
        g.gain.setValueAtTime(0.012 + I * 0.002, t + i * 0.06);
        g.gain.exponentialRampToValueAtTime(0.001, t + i * 0.06 + 0.05);
        o.connect(g); g.connect(this.ctx.destination);
        o.start(t + i * 0.06); o.stop(t + i * 0.06 + 0.05);
      });
    }

    // Deep groan — pitch-bending sine (more frequent + deeper at I=2+)
    const groanHit = I >= 2 ? (step === 12 || step === 28) : (step === 12);
    if (groanHit) {
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = 'sine';
      const startF = I >= 3 ? 82.41 : 110;
      o.frequency.setValueAtTime(startF, t);
      o.frequency.exponentialRampToValueAtTime(startF * 0.5, t + 2.0);
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.025 + I * 0.005, t + 0.4);
      g.gain.exponentialRampToValueAtTime(0.001, t + 2.0);
      o.connect(g); g.connect(this.ctx.destination);
      o.start(t); o.stop(t + 2.0);
    }

    // High whispers — dissonant shimmers (more frequent at I=1+)
    const whisperSteps = I >= 1 ? [6, 14, 22] : [6, 22];
    if (whisperSteps.includes(step)) {
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = 'sine';
      const wf = step === 6 ? 1864.66 : step === 14 ? 1975.53 : 1760.00;
      o.frequency.value = wf;
      g.gain.setValueAtTime(0.007 + I * 0.003, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 2.0);
      o.connect(g); g.connect(this.ctx.destination);
      o.start(t); o.stop(t + 2.0);
    }

    // Water drips — irregular noise ticks (doubles at I=2+)
    const dripSteps = I >= 2 ? [3, 5, 9, 14, 19, 23] : [5, 14, 23];
    if (dripSteps.includes(step)) {
      const len = this.ctx.sampleRate * 0.012;
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      const n = this.ctx.createBufferSource();
      n.buffer = buf;
      const ng = this.ctx.createGain();
      ng.gain.setValueAtTime(0.02, t);
      ng.gain.exponentialRampToValueAtTime(0.001, t + 0.012);
      n.connect(ng); ng.connect(this.ctx.destination);
      n.start(t);
    }

    // Heartbeat — double pulse (doubles to twice per cycle at I=2+)
    const hbSteps = I >= 2 ? [0, 2, 16, 18] : [0, 2];
    if (hbSteps.includes(step)) {
      const kick = this.ctx.createOscillator();
      const kg = this.ctx.createGain();
      kick.type = 'sine';
      kick.frequency.setValueAtTime(65, t);
      kick.frequency.exponentialRampToValueAtTime(25, t + 0.12);
      const primary = step === 0 || step === 16;
      kg.gain.setValueAtTime((primary ? 0.06 : 0.035) + I * 0.01, t);
      kg.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
      kick.connect(kg); kg.connect(this.ctx.destination);
      kick.start(t); kick.stop(t + 0.15);
    }

    // Soft tick — subtle rhythmic pulse on off-beats
    if (step % 4 === 2) {
      const len = this.ctx.sampleRate * 0.008;
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      const n = this.ctx.createBufferSource();
      n.buffer = buf;
      const ng = this.ctx.createGain();
      ng.gain.setValueAtTime(0.01, t);
      ng.gain.exponentialRampToValueAtTime(0.001, t + 0.008);
      n.connect(ng); ng.connect(this.ctx.destination);
      n.start(t);
    }

    // Level 3: rumbling sub-bass on bar starts — something massive approaches
    if (I >= 3 && step % 16 === 0) {
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = 'sine';
      o.frequency.value = 36.71;
      g.gain.setValueAtTime(0.06, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.8);
      o.connect(g); g.connect(this.ctx.destination);
      o.start(t); o.stop(t + 0.8);
    }
  }

  // --- Victory: "Quest Complete" — triumphant RPG fanfare ---
  // C Major, 130 BPM, bright detuned square lead, triangle pad chords,
  // bouncy bass, kick/hi-hat groove, sparkle tinkles
  _victoryNote(step, t) {
    if (!this.ctx) return;

    // Lead — custom catchy retro fanfare (da-da-da-da-da-da-da-ba-ba-ba-ba-da-ba-ba)
    const melody = [
      // Bar 1: da-da-da-da-da-da-da (7 fast notes, C5)
      523.25, 523.25, 523.25, 523.25, 523.25, 523.25, 523.25, 0,
      // Bar 2: ba-ba-ba-ba (4 fast notes, G4)
      392.00, 392.00, 392.00, 392.00, 0, 0, 0, 0,
      // Bar 3: da... ba... ba! (G5, D5, C6)
      783.99, 0, 587.33, 0, 1046.50, 0, 0, 0,
      // Bar 4: let it ring out
      0, 0, 0, 0, 0, 0, 0, 0,
    ];

    const freq = melody[step];
    if (freq) {
      [-3, 3].forEach(d => {
        const o = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        o.type = 'square';
        o.frequency.value = freq;
        o.detune.value = d;
        g.gain.setValueAtTime(0.03, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
        o.connect(g); g.connect(this.ctx.destination);
        o.start(t); o.stop(t + 0.2);
      });
    }

    // Chords — bright triangle pads matching the new melody
    if (step % 8 === 0) {
      const chords = [
        [392.00, 523.25, 659.25],  // Bar 1: C Major
        [293.66, 392.00, 493.88],  // Bar 2: G Major
        [392.00, 587.33, 783.99],  // Bar 3: G Major (higher)
        [523.25, 659.25, 1046.50], // Bar 4: C Major (sparkle resolve)
      ];
      chords[(step / 8 | 0) % 4].forEach(f => {
        const o = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        o.type = 'triangle';
        o.frequency.value = f;
        g.gain.setValueAtTime(0.02, t);
        g.gain.linearRampToValueAtTime(0.015, t + 0.8);
        g.gain.exponentialRampToValueAtTime(0.001, t + 1.5);
        o.connect(g); g.connect(this.ctx.destination);
        o.start(t); o.stop(t + 1.5);
      });
    }

    // Bass — bouncy staccato triangle on eighth notes
    if (step % 2 === 0) {
      const bass = [
        130.81, 130.81, 130.81, 130.81,
        196.00, 196.00, 196.00, 196.00,
        110.00, 110.00, 110.00, 110.00,
        174.61, 174.61, 174.61, 174.61,
      ];
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = 'triangle';
      o.frequency.value = bass[step >> 1];
      g.gain.setValueAtTime(0.045, t);
      g.gain.linearRampToValueAtTime(0.0, t + 0.1);
      o.connect(g); g.connect(this.ctx.destination);
      o.start(t); o.stop(t + 0.1);
    }

    // Kick — on downbeats
    if (step % 4 === 0) {
      const kick = this.ctx.createOscillator();
      const kg = this.ctx.createGain();
      kick.type = 'sine';
      kick.frequency.setValueAtTime(100, t);
      kick.frequency.exponentialRampToValueAtTime(40, t + 0.08);
      kg.gain.setValueAtTime(0.1, t);
      kg.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
      kick.connect(kg); kg.connect(this.ctx.destination);
      kick.start(t); kick.stop(t + 0.12);
    }

    // Hi-hat — on off-beats
    if (step % 2 === 1) {
      const len = this.ctx.sampleRate * 0.02;
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      const n = this.ctx.createBufferSource();
      n.buffer = buf;
      const ng = this.ctx.createGain();
      ng.gain.setValueAtTime(0.015, t);
      ng.gain.exponentialRampToValueAtTime(0.001, t + 0.02);
      n.connect(ng); ng.connect(this.ctx.destination);
      n.start(t);
    }

    // Sparkle tinkles — high sine at irregular intervals
    if (step === 3 || step === 11 || step === 19 || step === 27) {
      const sparkle = [2093.00, 2637.02, 3135.96, 2349.32];
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = 'sine';
      o.frequency.value = sparkle[(step / 8 | 0) % 4];
      g.gain.setValueAtTime(0.012, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
      o.connect(g); g.connect(this.ctx.destination);
      o.start(t); o.stop(t + 0.3);
    }

    // Snare — backbeat for energy
    if (step % 8 === 4) {
      const len = this.ctx.sampleRate * 0.06;
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      const n = this.ctx.createBufferSource();
      n.buffer = buf;
      const ng = this.ctx.createGain();
      ng.gain.setValueAtTime(0.04, t);
      ng.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
      n.connect(ng); ng.connect(this.ctx.destination);
      n.start(t);
    }
  }

  // --- Defeat: "Fallen Knight" — somber, heavy, melancholic ---
  // D minor, 56 BPM, low detuned sine pads, sparse tolling bell,
  // mournful triangle lead, deep bass drone, distant wind noise
  _defeatNote(step, t) {
    if (!this.ctx) return;

    // Lead — mournful triangle, sparse descending melody
    const melody = [
      // Bar 1: Slow D minor lament
      587.33, 0, 0, 0, 0, 0, 523.25, 0,
      // Bar 2: Falling away
      493.88, 0, 0, 0, 440.00, 0, 0, 0,
      // Bar 3: Brief rise — false hope
      523.25, 0, 0, 0, 0, 0, 493.88, 0,
      // Bar 4: Final descent into silence
      440.00, 0, 0, 0, 392.00, 0, 0, 0,
    ];

    const freq = melody[step];
    if (freq) {
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = 'triangle';
      o.frequency.value = freq;
      o.detune.value = -5;
      g.gain.setValueAtTime(0.04, t);
      g.gain.linearRampToValueAtTime(0.025, t + 0.8);
      g.gain.exponentialRampToValueAtTime(0.001, t + 2.0);
      o.connect(g); g.connect(this.ctx.destination);
      o.start(t); o.stop(t + 2.0);

      // Ghost echo — detuned, fading
      const eo = this.ctx.createOscillator();
      const eg = this.ctx.createGain();
      eo.type = 'sine';
      eo.frequency.value = freq * 0.998;
      eg.gain.setValueAtTime(0.015, t + 0.3);
      eg.gain.exponentialRampToValueAtTime(0.001, t + 1.8);
      eo.connect(eg); eg.connect(this.ctx.destination);
      eo.start(t + 0.3); eo.stop(t + 1.8);
    }

    // Pad — dark sustained sine chord (Dm → Bb → Gm → A)
    if (step % 8 === 0) {
      const chords = [
        [293.66, 349.23, 440.00],  // Dm
        [233.08, 293.66, 349.23],  // Bb
        [196.00, 233.08, 293.66],  // Gm
        [220.00, 277.18, 329.63],  // A (minor-tinged)
      ];
      chords[(step / 8 | 0) % 4].forEach(f => {
        const o = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        o.type = 'sine';
        o.frequency.value = f;
        o.detune.value = -8;
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(0.018, t + 0.6);
        g.gain.linearRampToValueAtTime(0.012, t + 3.0);
        g.gain.exponentialRampToValueAtTime(0.001, t + 4.5);
        o.connect(g); g.connect(this.ctx.destination);
        o.start(t); o.stop(t + 4.5);
      });
    }

    // Tolling bell — low sine with pitch drop, once per two bars
    if (step === 0 || step === 16) {
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = 'sine';
      o.frequency.setValueAtTime(196.00, t);  // G3
      o.frequency.exponentialRampToValueAtTime(185.00, t + 3.0);
      g.gain.setValueAtTime(0.06, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 3.0);
      o.connect(g); g.connect(this.ctx.destination);
      o.start(t); o.stop(t + 3.0);

      // Bell overtone
      const o2 = this.ctx.createOscillator();
      const g2 = this.ctx.createGain();
      o2.type = 'sine';
      o2.frequency.value = 392.00;  // G4
      g2.gain.setValueAtTime(0.02, t);
      g2.gain.exponentialRampToValueAtTime(0.001, t + 1.5);
      o2.connect(g2); g2.connect(this.ctx.destination);
      o2.start(t); o2.stop(t + 1.5);
    }

    // Bass drone — deep triangle, constant presence
    if (step % 16 === 0) {
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = 'triangle';
      o.frequency.value = 73.42;  // D2
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.025, t + 1.0);
      g.gain.linearRampToValueAtTime(0.02, t + 5.0);
      g.gain.exponentialRampToValueAtTime(0.001, t + 7.0);
      o.connect(g); g.connect(this.ctx.destination);
      o.start(t); o.stop(t + 7.0);
    }

    // Wind — filtered noise, slow swell
    if (step === 4 || step === 20) {
      const len = this.ctx.sampleRate * 1.5;
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      const n = this.ctx.createBufferSource();
      n.buffer = buf;
      const ng = this.ctx.createGain();
      ng.gain.setValueAtTime(0, t);
      ng.gain.linearRampToValueAtTime(0.012, t + 0.5);
      ng.gain.exponentialRampToValueAtTime(0.001, t + 1.5);
      n.connect(ng); ng.connect(this.ctx.destination);
      n.start(t);
    }

    // Heartbeat — very slow, fading (the fallen warrior's last beats)
    if (step === 0 || step === 3) {
      const kick = this.ctx.createOscillator();
      const kg = this.ctx.createGain();
      kick.type = 'sine';
      kick.frequency.setValueAtTime(50, t);
      kick.frequency.exponentialRampToValueAtTime(20, t + 0.2);
      kg.gain.setValueAtTime(step === 0 ? 0.05 : 0.025, t);
      kg.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
      kick.connect(kg); kg.connect(this.ctx.destination);
      kick.start(t); kick.stop(t + 0.25);
    }
  }

  // --- Boss: "Dread Colosseum" — slow, heavy, cinematic ---
  // E Phrygian, 88+ BPM, detuned square power chords, half-time drums,
  // sub-bass impacts, ominous drone — escalates with each wrong answer
  //
  // Intensity levels (this.bossIntensity):
  //   0: Base — power chords, half-time drums, sparse hi-hat
  //   1: Detune widens, kick louder, crash cymbal on bar 1
  //   2: Sawtooth grit layer, bass doubles to half-bar, hi-hat doubles
  //   3: Dissonant minor-2nd shadow, snare doubles, sub-bass every bar
  //   4: Double-time kick, maximum detune, everything cranked
  //   5: Chaos cap
  _bossNote(step, t) {
    if (!this.ctx) return;
    const I = this.intensity || 0;

    // Lead — detune widens with intensity: ±3 → ±6 → ±9 → ±12 → ±15 → ±18
    const melody = [
      659.25, 0, 587.33, 0, 523.25, 0, 493.88, 0,
      523.25, 0, 493.88, 0, 466.16, 0, 493.88, 0,
      659.25, 659.25, 0, 0, 783.99, 783.99, 0, 0,
      880.00, 0, 783.99, 0, 739.99, 0, 659.25, 659.25,
    ];

    const freq = melody[step];
    if (freq) {
      const detune = 3 + I * 3;
      const vol = Math.min(0.025 + I * 0.003, 0.04);
      [-detune, detune].forEach(d => {
        const o = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        o.type = 'square';
        o.frequency.value = freq;
        o.detune.value = d;
        g.gain.setValueAtTime(vol, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.32);
        o.connect(g); g.connect(this.ctx.destination);
        o.start(t); o.stop(t + 0.32);
      });

      // Level 2+: sawtooth grit layer
      if (I >= 2) {
        const o = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        o.type = 'sawtooth';
        o.frequency.value = freq;
        o.detune.value = -7;
        g.gain.setValueAtTime(0.012, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
        o.connect(g); g.connect(this.ctx.destination);
        o.start(t); o.stop(t + 0.25);
      }

      // Level 3+: dissonant minor-2nd shadow (one semitone up = dread)
      if (I >= 3) {
        const o = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        o.type = 'square';
        o.frequency.value = freq * 1.0595; // minor 2nd
        g.gain.setValueAtTime(0.01, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
        o.connect(g); g.connect(this.ctx.destination);
        o.start(t); o.stop(t + 0.15);
      }
    }

    // Bass — drives harder at intensity 2+ (every half-bar instead of full bar)
    const bassInterval = I >= 2 ? 4 : 8;
    if (step % bassInterval === 0) {
      const bassNotes = [82.41, 65.41, 82.41, 61.74];
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = 'sawtooth';
      o.frequency.value = bassNotes[(step / bassInterval | 0) % 4];
      const bv = Math.min(0.055 + I * 0.005, 0.08);
      g.gain.setValueAtTime(bv, t);
      g.gain.linearRampToValueAtTime(bv * 0.5, t + 1.5);
      g.gain.exponentialRampToValueAtTime(0.001, t + 2.5);
      o.connect(g); g.connect(this.ctx.destination);
      o.start(t); o.stop(t + 2.5);
    }

    // Sub-bass — more frequent at high intensity
    const subHit = I >= 3
      ? (step % 8 === 0)       // every bar
      : (step === 0 || step === 16); // bars 1 & 3
    if (subHit) {
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = 'sine';
      o.frequency.value = 41.20;
      g.gain.setValueAtTime(0.08, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.7);
      o.connect(g); g.connect(this.ctx.destination);
      o.start(t); o.stop(t + 0.7);
    }

    // Drone — ominous low triangle (constant across all levels)
    if (step % 16 === 0) {
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = 'triangle';
      o.frequency.value = 82.41;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.02, t + 0.8);
      g.gain.linearRampToValueAtTime(0.015, t + 4.0);
      g.gain.exponentialRampToValueAtTime(0.001, t + 5.0);
      o.connect(g); g.connect(this.ctx.destination);
      o.start(t); o.stop(t + 5.0);
    }

    // Kick — louder with intensity, double-time at level 4+
    const kickHit = I >= 4 ? (step % 4 === 0) : (step % 8 === 0);
    if (kickHit) {
      const kick = this.ctx.createOscillator();
      const kg = this.ctx.createGain();
      kick.type = 'sine';
      kick.frequency.setValueAtTime(120, t);
      kick.frequency.exponentialRampToValueAtTime(40, t + 0.15);
      const kv = Math.min(0.15 + I * 0.015, 0.22);
      kg.gain.setValueAtTime(kv, t);
      kg.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
      kick.connect(kg); kg.connect(this.ctx.destination);
      kick.start(t); kick.stop(t + 0.2);
    }

    // Snare — doubles at intensity 3+ (every half-bar backbeat)
    const snareHit = I >= 3 ? (step % 4 === 2) : (step % 8 === 4);
    if (snareHit) {
      const len = this.ctx.sampleRate * 0.1;
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      const n = this.ctx.createBufferSource();
      n.buffer = buf;
      const ng = this.ctx.createGain();
      ng.gain.setValueAtTime(0.07, t);
      ng.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
      n.connect(ng); ng.connect(this.ctx.destination);
      n.start(t);
    }

    // Hi-hat — gets denser with intensity
    const hihatHit = I >= 2 ? (step % 2 === 1) : (step % 4 === 2);
    if (hihatHit) {
      const len = this.ctx.sampleRate * 0.025;
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      const n = this.ctx.createBufferSource();
      n.buffer = buf;
      const ng = this.ctx.createGain();
      ng.gain.setValueAtTime(0.015, t);
      ng.gain.exponentialRampToValueAtTime(0.001, t + 0.025);
      n.connect(ng); ng.connect(this.ctx.destination);
      n.start(t);
    }

    // Level 1+: crash cymbal on bar 1 downbeat
    if (I >= 1 && step === 0) {
      const len = this.ctx.sampleRate * 0.3;
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      const n = this.ctx.createBufferSource();
      n.buffer = buf;
      const ng = this.ctx.createGain();
      ng.gain.setValueAtTime(0.035 + I * 0.005, t);
      ng.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
      n.connect(ng); ng.connect(this.ctx.destination);
      n.start(t);
    }
  }
}

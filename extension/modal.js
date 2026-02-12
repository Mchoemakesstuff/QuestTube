/**
 * Sound Manager for Retro Audio (Web Audio API)
 */

function extractExtensionBaseUrl(value) {
  if (!value) return '';
  const match = String(value).match(/(chrome-extension|moz-extension):\/\/([a-zA-Z0-9_-]+)\//);
  if (!match) return '';
  return `${match[1]}://${match[2]}/`;
}

const EXTENSION_BASE_URL = (() => {
  try {
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id) {
      return `chrome-extension://${chrome.runtime.id}/`;
    }
  } catch (error) {
    console.warn('QuestTube: Failed to read chrome runtime id', error);
  }

  try {
    if (typeof browser !== 'undefined' && browser.runtime && browser.runtime.id) {
      return `moz-extension://${browser.runtime.id}/`;
    }
  } catch (error) {
    console.warn('QuestTube: Failed to read browser runtime id', error);
  }

  try {
    const fromCurrentScript = extractExtensionBaseUrl(document?.currentScript?.src);
    if (fromCurrentScript) {
      return fromCurrentScript;
    }
  } catch (error) {
    console.warn('QuestTube: Failed to read current script URL', error);
  }

  try {
    const fromStack = extractExtensionBaseUrl(new Error().stack || '');
    if (fromStack) {
      return fromStack;
    }
  } catch (error) {
    console.warn('QuestTube: Failed to read stack URL', error);
  }

  return '';
})();

function getAssetUrl(path) {
  const normalized = String(path || '').replace(/^\/+/, '');
  return EXTENSION_BASE_URL ? `${EXTENSION_BASE_URL}${normalized}` : normalized;
}

class SoundManager {
  constructor() {
    this.ctx = null;
    this.bgmNodes = [];
    this.isPlayingMusic = false;

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

  playMusic() {
    if (this.muted || this.isPlayingMusic) return;
    this.init();
    this.isPlayingMusic = true;

    // Pokemon-style Battle Loop
    // Tempo: 150 BPM
    const tempo = 150;
    const secondsPerBeat = 60 / tempo;
    const counter = 0;

    // Simple Sequencer using AudioContext time
    const scheduleAheadTime = 0.1;
    let nextNoteTime = this.ctx.currentTime;
    let timerID;
    let step = 0;

    const notes = [
      // Measure 1
      { pitch: 220, type: 'sawtooth', dur: 0.25 }, // A3
      { pitch: 0, type: 'rest', dur: 0.25 },
      { pitch: 220, type: 'sawtooth', dur: 0.25 },
      { pitch: 261.63, type: 'sawtooth', dur: 0.25 }, // C4
      // Measure 2
      { pitch: 329.63, type: 'sawtooth', dur: 0.25 }, // E4
      { pitch: 0, type: 'rest', dur: 0.25 },
      { pitch: 329.63, type: 'sawtooth', dur: 0.25 },
      { pitch: 261.63, type: 'sawtooth', dur: 0.25 },
      // Measure 3
      { pitch: 196.00, type: 'sawtooth', dur: 0.25 }, // G3
      { pitch: 0, type: 'rest', dur: 0.25 },
      { pitch: 246.94, type: 'sawtooth', dur: 0.25 }, // B3
      { pitch: 293.66, type: 'sawtooth', dur: 0.25 }, // D4
      // Measure 4
      { pitch: 329.63, type: 'sawtooth', dur: 0.25 }, // E4
      { pitch: 0, type: 'rest', dur: 0.25 },
      { pitch: 329.63, type: 'sawtooth', dur: 0.25 },
      { pitch: 392.00, type: 'sawtooth', dur: 0.25 }, // G4
    ];

    // Bass Line: Driving 8th notes
    // A2 (110Hz) -> G2 (98Hz)

    const scheduler = () => {
      if (!this.isPlayingMusic) return;

      while (nextNoteTime < this.ctx.currentTime + scheduleAheadTime) {
        this.scheduleNote(step, nextNoteTime);
        nextNoteTime += secondsPerBeat / 2; // 8th notes
        step++;
        if (step >= 32) step = 0; // 4 bars of 8th notes
      }
      timerID = setTimeout(scheduler, 25);
    };

    this.timerID = timerID; // Store to clear later
    scheduler();
  }

  scheduleNote(step, time) {
    if (this.muted) return;

    // LEAD (Square wave for 8-bit feel)
    const leadOsc = this.ctx.createOscillator();
    const leadGain = this.ctx.createGain();
    leadOsc.type = 'square';
    leadOsc.connect(leadGain);
    leadGain.connect(this.ctx.destination);

    // Melody sequence (Pokemon-ish Arpeggios)
    // Pattern: A minor -> G Major
    let freq = 0;
    if (step < 8) { // Bar 1: Am
      if (step % 2 === 0) freq = 440; // A4
      else freq = 523.25; // C5
    } else if (step < 16) { // Bar 2: Am
      if (step % 2 === 0) freq = 329.63; // E4
      else freq = 440; // A4
    } else if (step < 24) { // Bar 3: G
      if (step % 2 === 0) freq = 392.00; // G4
      else freq = 493.88; // B4
    } else { // Bar 4: G
      if (step % 2 === 0) freq = 293.66; // D4
      else freq = 392.00; // G4
    }

    // Add random variation for "battle chaos"
    if (Math.random() > 0.8) freq *= 2; // Octave jump

    leadOsc.frequency.value = freq;
    leadGain.gain.setValueAtTime(0.03, time);
    leadGain.gain.exponentialRampToValueAtTime(0.001, time + 0.1);

    leadOsc.start(time);
    leadOsc.stop(time + 0.1);

    // BASS (Triangle/Sawtooth driving)
    const bassOsc = this.ctx.createOscillator();
    const bassGain = this.ctx.createGain();
    bassOsc.type = 'sawtooth';
    bassOsc.connect(bassGain);
    bassGain.connect(this.ctx.destination);

    let bassFreq = (step < 16) ? 110 : 98; // A2 -> G2
    if (step % 4 === 0) bassFreq /= 2; // Down octave on beat

    bassOsc.frequency.value = bassFreq;
    bassGain.gain.setValueAtTime(0.05, time);
    bassGain.gain.linearRampToValueAtTime(0.0, time + 0.15);

    bassOsc.start(time);
    bassOsc.stop(time + 0.15);

    // DRUMS (Noise) - Kick on 1, Snare on 2
    // Simple noise burst
    if (step % 4 === 0 || step % 4 === 2) {
      const bufferSize = this.ctx.sampleRate * 0.05; // 50ms
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }

      const noise = this.ctx.createBufferSource();
      noise.buffer = buffer;
      const noiseGain = this.ctx.createGain();

      // Kick vs Snare
      if (step % 8 === 0) { // Kick
        noiseGain.gain.setValueAtTime(0.1, time);
        // Low pass filter logic omitted for brevity, just volume
      } else if (step % 8 === 4) { // Snare
        noiseGain.gain.setValueAtTime(0.05, time);
      } else { // Hi-hat
        noiseGain.gain.setValueAtTime(0.01, time);
      }

      noiseGain.gain.exponentialRampToValueAtTime(0.001, time + 0.05);
      noise.connect(noiseGain);
      noiseGain.connect(this.ctx.destination);
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
}

/**
 * Particle System for Visual Effects (Confetti/Sparkles)
 */
class ParticleSystem {
  constructor() {
    this.container = null;
  }

  ensureContainer() {
    if (!this.container) {
      this.container = document.createElement('div');
      this.container.className = 'ytq-particles';
      this.container.style.position = 'fixed';
      this.container.style.top = '0';
      this.container.style.left = '0';
      this.container.style.width = '100%';
      this.container.style.height = '100%';
      this.container.style.pointerEvents = 'none';
      this.container.style.zIndex = '10001';
      document.body.appendChild(this.container);
    }
    return this.container;
  }

  burst(count = 30) {
    const container = this.ensureContainer();
    const colors = ['#f472b6', '#60a5fa', '#34d399', '#fcd34d', '#ffffff'];

    const x = window.innerWidth / 2;
    const y = window.innerHeight / 2;

    for (let i = 0; i < count; i++) {
      const p = document.createElement('div');
      p.className = 'ytq-particle';

      const color = colors[Math.floor(Math.random() * colors.length)];
      const size = Math.random() * 8 + 4;
      const angle = Math.random() * Math.PI * 2;
      const velocity = Math.random() * 150 + 50;

      p.style.backgroundColor = color;
      p.style.width = `${size}px`;
      p.style.height = `${size}px`;
      p.style.position = 'absolute';
      p.style.left = `${x}px`;
      p.style.top = `${y}px`;
      p.style.borderRadius = Math.random() > 0.5 ? '50%' : '0';

      const duration = Math.random() * 1 + 0.5;
      const tx = Math.cos(angle) * velocity;
      const ty = Math.sin(angle) * velocity;

      p.style.transition = `all ${duration}s cubic-bezier(0.25, 0.46, 0.45, 0.94)`;
      p.style.opacity = '1';

      container.appendChild(p);

      requestAnimationFrame(() => {
        p.style.transform = `translate(${tx}px, ${ty}px) rotate(${Math.random() * 360}deg)`;
        p.style.opacity = '0';
      });

      setTimeout(() => p.remove(), duration * 1000);
    }
  }
}

/**
 * QuestTube - Modal UI
 * Renders and manages the quiz modal overlay
 */

class QuizModal {
  constructor() {
    this.overlay = null;
    this.currentQuiz = null;
    this.userAnswers = {};
    this.userConfidence = {};
    this.currentQuestionIndex = 0;
    this.combo = 0;
    this.state = 'idle'; // idle, loading, quiz, results, error
    this.sound = new SoundManager();
    this.particles = new ParticleSystem();
    this.loadingInterval = null; // Track interval for clearing

    // Game State
    this.heroMaxHP = 3;
    this.heroHP = this.heroMaxHP;
    this.enemyMaxHP = 100;
    this.enemyHP = this.enemyMaxHP;
  }

  /**
   * Show the modal with loading state
   */
  show() {
    if (this.overlay) return;

    this.overlay = document.createElement('div');
    this.overlay.className = 'ytq-overlay';
    this.overlay.innerHTML = this.renderLoading();
    document.body.appendChild(this.overlay);
    this.startLoadingAnimation();

    // Trigger animation
    requestAnimationFrame(() => {
      this.overlay.classList.add('visible');
    });

    // Close on escape
    this.escHandler = (e) => {
      if (e.key === 'Escape') this.hide();
    };
    document.addEventListener('keydown', this.escHandler);

    // Attach click listeners once
    this.attachEventListeners();
  }

  /**
   * Hide the modal
   */
  hide() {
    this.stopLoadingAnimation();
    if (!this.overlay) return;

    this.overlay.classList.remove('visible');
    setTimeout(() => {
      if (this.overlay && this.overlay.parentNode) {
        document.body.removeChild(this.overlay);
      }
      this.overlay = null;
    }, 300);

    document.removeEventListener('keydown', this.escHandler);
    this.reset();
    this.sound.stopMusic();
  }

  /**
   * Clean up
   */
  remove() {
    if (this.overlay) {
      this.overlay.remove();
      this.overlay = null;
    }
    this.sound.stopMusic();
  }

  /**
   * Reset state
   */
  reset() {
    this.currentQuiz = null;
    this.userAnswers = {};
    this.userConfidence = {};
    this.state = 'idle';
    this.heroHP = this.heroMaxHP;
    this.enemyHP = this.enemyMaxHP;
  }

  /**
   * Update modal content
   */
  updateContent(html) {
    this.stopLoadingAnimation(); // Ensure animation stops when content changes
    if (!this.overlay) return;
    this.overlay.innerHTML = html;
    // Listeners are already attached to overlay in show()
  }

  /**
   * Show quiz questions
   */
  showQuiz(quiz) {
    this.currentQuiz = quiz;
    this.userAnswers = {};
    this.userConfidence = {};
    this.heroHP = this.heroMaxHP;
    this.enemyHP = this.enemyMaxHP;
    this.state = 'quiz';
    this.updateContent(this.renderQuiz(quiz));
    this.updateHealthUI();
    this.sound.playMusic();
  }

  /**
   * Show results
   */
  showResults(results) {
    this.state = 'results';
    this.updateContent(this.renderResults(results));
    if (results.xpResult && results.xpResult.leveledUp) {
      this.sound.playLevelUp();
    }
  }

  /**
   * Show error
   */
  showError(message) {
    this.state = 'error';
    this.updateContent(this.renderError(message));
  }

  // ============================================
  // Render Methods
  // ============================================

  renderLoading() {
    // Initial message
    const msg = "Initiating quest...";

    return `
      <div class="ytq-loading">
        <img src="${getAssetUrl('assets/portal.png')}" class="ytq-loading-portal" alt="Loading...">
        <p class="ytq-loading-text" id="ytq-loading-text">${msg}</p>
      </div>
    `;
  }

  startLoadingAnimation() {
    const messages = [
      "Initiating quest...",
      "Forging your destiny...",
      "Consulting the archives...",
      "Summoning enemies...",
      "Opening knowledge rift...",
      "Calculated risk...",
      "Rolling for initiative..."
    ];

    const textEl = document.getElementById('ytq-loading-text');
    if (!textEl) return;

    let index = 0;
    this.stopLoadingAnimation();

    this.loadingInterval = setInterval(() => {
      index = (index + 1) % messages.length;
      textEl.innerText = messages[index];
      textEl.style.animation = 'none';
      textEl.offsetHeight; /* trigger reflow */
      textEl.style.animation = 'pulse 1.5s infinite';
    }, 2500);
  }

  stopLoadingAnimation() {
    if (this.loadingInterval) {
      clearInterval(this.loadingInterval);
      this.loadingInterval = null;
    }
  }

  renderQuiz(quiz) {
    this.currentQuestionIndex = 0;
    this.combo = 0;
    const heroHearts = Array.from({ length: this.heroMaxHP }, () => '<span class="ytq-heart"></span>').join('');

    return `
      <div class="ytq-modal">
        <div class="ytq-header">
          <div>
            <h2 class="ytq-title">Battle: ${this.escapeHtml(quiz.title)}</h2>
          </div>
          <div class="ytq-header-controls">
            <button class="ytq-icon-btn" data-action="toggle-mute">
                <img class="ytq-icon-img" src="${getAssetUrl(`assets/speaker-${this.sound.muted ? 'off' : 'on'}.png`)}" alt="Mute">
            </button>
            <button class="ytq-close" data-action="close">&times;</button>
          </div>
        </div>
        
        <!-- Battle Scene -->
        <div class="ytq-battle-scene" style="background: url('${getAssetUrl('assets/battle_bg.png')}') center bottom / cover no-repeat; border-radius: 8px 8px 0 0; border: 3px solid var(--border); border-bottom: none; box-shadow: inset 0 0 30px rgba(0, 0, 0, 0.5);">
            <div class="ytq-combatant hero-wrapper">
              <div class="ytq-health-container ytq-hero-health">${heroHearts}</div>
              <img src="${getAssetUrl('assets/hero.png')}" class="ytq-hero" alt="Hero">
            </div>
            <div class="ytq-combatant enemy-wrapper">
              <div class="ytq-health-container ytq-enemy-health">
                <div id="ytq-enemy-hp-bar" class="ytq-health-fill"></div>
              </div>
              <img src="${getAssetUrl('assets/enemy.png')}" class="ytq-enemy" alt="Enemy">
            </div>
        </div>

        <div class="ytq-content">
          <div id="ytq-question-container">
            ${this.renderQuestion(0)}
          </div>
        </div>
      </div>
    `;
  }

  triggerBattleAnimation(isCorrect) {
    const hero = this.overlay.querySelector('.ytq-hero');
    const enemy = this.overlay.querySelector('.ytq-enemy');

    if (!hero || !enemy) return;

    // Remove classes first to re-trigger if needed
    hero.classList.remove('attacking', 'damaged');
    enemy.classList.remove('attacking', 'damaged');

    // Force reflow
    void hero.offsetWidth;

    if (isCorrect) {
      // User Correct -> Hero Attacks -> Enemy Damaged
      hero.classList.add('attacking');
      setTimeout(() => enemy.classList.add('damaged'), 200);
    } else {
      // User Wrong -> Enemy Attacks -> Hero Damaged
      enemy.classList.add('attacking');
      setTimeout(() => hero.classList.add('damaged'), 200);
    }
  }

  renderQuestion(index) {
    const question = this.currentQuiz.questions[index];
    const typeLabel = {
      'free_recall': 'Free Recall',
      'multiple_choice': 'Multiple Choice',
      'short_answer': 'Short Answer',
    };

    let answerHtml = '';
    let checkButtonHtml = '';

    if (question.type === 'multiple_choice' && question.options) {
      answerHtml = `
        <div class="ytq-options">
          ${question.options.map(opt => `
            <div class="ytq-option" data-question="${index}" data-value="${opt.label}">
              <span class="ytq-option-label">${opt.label}</span>
              <span class="ytq-option-text">${this.escapeHtml(opt.text)}</span>
            </div>
          `).join('')}
        </div>
      `;
    } else {
      answerHtml = `
        <textarea 
          class="ytq-textarea" 
          data-question="${index}" 
          placeholder="Type your answer here..."
        ></textarea>
      `;
      checkButtonHtml = `
        <button class="ytq-check-btn" data-action="check" data-question="${index}">Check Answer</button>
      `;
    }

    // Combo Badge (only show if > 1)
    const comboHtml = this.combo > 1 ? `
      <div class="ytq-combo-badge ytq-bounce">
        <span class="ytq-combo-count">${this.combo}x</span>
        <span class="ytq-combo-label">COMBO!</span>
      </div>
    ` : '';
    const confidenceHtml = this.renderConfidenceSelector(index);

    return `
      <div class="ytq-question ytq-dialog-box slide-in-right" data-index="${index}">
        ${comboHtml}
        <div class="ytq-question-header">
          <span class="ytq-question-number">Question ${index + 1} of ${this.currentQuiz.questions.length}</span>
          <span class="ytq-question-type ${question.type}">${typeLabel[question.type] || question.type}</span>
        </div>
        <p class="ytq-question-text">${this.escapeHtml(question.text)}</p>
        ${answerHtml}
        ${confidenceHtml}
        ${checkButtonHtml}
        <div class="ytq-instant-feedback hidden" id="feedback-${index}">
          <div class="ytq-feedback-status"></div>
          <div class="ytq-feedback-details"></div>
          <button class="ytq-next-btn" data-action="next-question">
            ${index === this.currentQuiz.questions.length - 1 ? 'Finish Quiz 🏁' : 'Next Question ➜'}
          </button>
        </div>
      </div>
    `;
  }

  renderConfidenceSelector(index) {
    const selected = this.userConfidence[index] || '';
    const options = [
      { value: 'low', label: 'Low' },
      { value: 'medium', label: 'Medium' },
      { value: 'high', label: 'High' },
    ];

    return `
      <div class="ytq-confidence" data-question="${index}">
        <div class="ytq-confidence-label">Confidence</div>
        <div class="ytq-confidence-options">
          ${options.map((option) => `
            <button
              type="button"
              class="ytq-confidence-btn ${selected === option.value ? 'selected' : ''}"
              data-action="set-confidence"
              data-question="${index}"
              data-value="${option.value}"
            >${option.label}</button>
          `).join('')}
        </div>
      </div>
    `;
  }

  setConfidence(index, value) {
    this.userConfidence[index] = value;
    const container = this.overlay?.querySelector(`.ytq-confidence[data-question="${index}"]`);
    if (!container) return;

    container.querySelectorAll('.ytq-confidence-btn').forEach((btn) => {
      if (btn.dataset.value === value) {
        btn.classList.add('selected');
      } else {
        btn.classList.remove('selected');
      }
    });
  }

  ensureConfidenceSelected(index) {
    const selected = this.userConfidence[index];
    if (selected === 'low' || selected === 'medium' || selected === 'high') {
      return true;
    }

    const questionEl = this.overlay?.querySelector(`.ytq-question[data-index="${index}"]`);
    const confidenceEl = questionEl?.querySelector(`.ytq-confidence[data-question="${index}"]`);
    confidenceEl?.classList.add('ytq-confidence-error');
    setTimeout(() => confidenceEl?.classList.remove('ytq-confidence-error'), 600);
    return false;
  }

  renderResults(results) {
    const safeResults = results && typeof results === 'object' ? results : {};
    const score = Number(safeResults.score || 0);
    const rank = score >= 95 ? 'S' : score >= 85 ? 'A' : score >= 70 ? 'B' : score >= 50 ? 'C' : 'D';
    const rankClass = rank.toLowerCase();
    const feedbackList = Array.isArray(safeResults.questionFeedback) ? safeResults.questionFeedback : [];
    const weakConcepts = Array.isArray(safeResults.weakConcepts) ? safeResults.weakConcepts.filter(Boolean) : [];
    const xpEarned = safeResults?.xpResult?.xpEarned ?? Math.round(score);
    const coinsEarned = Number(safeResults.coinsEarned || 0);
    const correctCount = Number(safeResults.correctCount || 0);
    const totalQuestions = Number(safeResults.totalQuestions || feedbackList.length || 0);

    const normalizedFeedbackList = feedbackList
      .map((fb, i) => {
        if (!fb || typeof fb !== 'object') return null;
        return {
          questionIndex: Number.isInteger(fb.questionIndex) ? fb.questionIndex : i,
          isCorrect: Boolean(fb.isCorrect),
          userAnswer: typeof fb.userAnswer === 'string' ? fb.userAnswer : '',
          correctAnswer: typeof fb.correctAnswer === 'string' ? fb.correctAnswer : '',
          feedback: typeof fb.feedback === 'string' ? fb.feedback : '',
        };
      })
      .filter(Boolean);

    const feedbackHtml = normalizedFeedbackList.map((fb, i) => `
      <div class="ytq-feedback-item ${fb.isCorrect ? 'correct' : 'incorrect'}">
        <div class="ytq-feedback-question">Q${i + 1}: ${fb.isCorrect ? '✓ Correct' : '✗ Incorrect'}</div>
        <div class="ytq-feedback-answer">
          Your answer: <span class="${fb.isCorrect ? 'ytq-feedback-correct' : 'ytq-feedback-incorrect'}">${this.escapeHtml(fb.userAnswer)}</span>
        </div>
        ${!fb.isCorrect ? `<div class="ytq-feedback-answer">Correct: <span class="ytq-feedback-correct">${this.escapeHtml(fb.correctAnswer)}</span></div>` : ''}
        <div class="ytq-feedback-answer" style="color: #888; margin-top: 8px;">${this.escapeHtml(fb.feedback)}</div>
      </div>
    `).join('');

    const weakConceptsHtml = weakConcepts.length
      ? weakConcepts.map((concept) => `
          <span class="ytq-concept-tag">${this.escapeHtml(concept)}</span>
        `).join('')
      : '<div class="ytq-victory-empty">No weak concepts detected. Momentum maintained.</div>';

    return `
      <div class="ytq-modal ytq-victory-modal">
        <div class="ytq-header ytq-victory-header">
          <div>
            <h2 class="ytq-title">Victory Report</h2>
            <div class="ytq-subtitle">Battle Complete</div>
          </div>
          <button class="ytq-close" data-action="close">&times;</button>
        </div>
        <div class="ytq-results ytq-victory-results">
          <section class="ytq-victory-summary">
            <div class="ytq-victory-scene" style="background: url('${getAssetUrl('assets/battle_bg.png')}') center bottom / cover no-repeat;">
              <img src="${getAssetUrl('assets/hero.png')}" class="ytq-victory-character ytq-victory-hero-img" alt="Hero">
              <img src="${getAssetUrl('assets/enemy.png')}" class="ytq-victory-character ytq-victory-enemy-img" alt="Enemy">
              <div class="ytq-rank-badge ${rankClass}">
                <span class="ytq-rank-label">Rank</span>
                <span class="ytq-rank-value">${rank}</span>
              </div>
            </div>

            <div class="ytq-score-card">
              <div class="ytq-score-value">${score}%</div>
              <div class="ytq-score-label">${correctCount} of ${totalQuestions} correct</div>
              <div class="ytq-victory-kpis">
                <div class="ytq-victory-kpi">
                  <span class="ytq-victory-kpi-label">XP</span>
                  <span class="ytq-victory-kpi-value">+${xpEarned}</span>
                </div>
                <div class="ytq-victory-kpi">
                  <span class="ytq-victory-kpi-label">Coins</span>
                  <span class="ytq-victory-kpi-value">${coinsEarned > 0 ? `+${coinsEarned}` : '0'}</span>
                </div>
              </div>
            </div>

            ${safeResults.xpResult?.leveledUp ? `
              <div class="ytq-level-up-banner">
                <div class="ytq-level-up-text">LEVEL UP!</div>
                <div class="ytq-level-up-details">${safeResults.xpResult.oldLevel} ➜ ${safeResults.xpResult.newLevel}</div>
              </div>
            ` : ''}

            <div class="ytq-victory-concepts">
              <h4 class="ytq-feedback-title">Weak Concepts</h4>
              <div class="ytq-weak-concepts">${weakConceptsHtml}</div>
            </div>
          </section>

          <section class="ytq-victory-log">
            <h4 class="ytq-feedback-title">Battle Log</h4>
            <div class="ytq-victory-log-list">
              ${feedbackHtml}
            </div>

            <div class="ytq-schedule">
              <span class="ytq-schedule-text">📅 Schedule spaced review</span>
              <div class="ytq-schedule-toggle active" data-action="toggle-schedule"></div>
            </div>
          </section>
        </div>
      </div>
    `;
  }

  renderError(message) {
    return `
      <div class="ytq-modal">
        <div class="ytq-header">
          <div>
            <h2 class="ytq-title">Error</h2>
          </div>
          <button class="ytq-close" data-action="close">&times;</button>
        </div>
        <div class="ytq-error">
          <div class="ytq-error-icon">⚠️</div>
          <div class="ytq-error-message">${this.escapeHtml(message)}</div>
          <button class="ytq-retry-btn" data-action="retry">Try Again</button>
        </div>
      </div>
    `;
  }

  // ============ HEALTH SYSTEM ============

  updateHealthUI() {
    if (!this.overlay) return;

    // Update Enemy Bar
    const enemyBar = this.overlay.querySelector('#ytq-enemy-hp-bar');
    if (enemyBar) {
      const pct = Math.max(0, (this.enemyHP / this.enemyMaxHP) * 100);
      enemyBar.style.width = `${pct}%`;
    }

    // Update Hero Hearts
    const hearts = this.overlay.querySelector('.ytq-hero-health')?.querySelectorAll('.ytq-heart');
    if (hearts) {
      hearts.forEach((heart, i) => {
        if (i < this.heroHP) {
          heart.classList.remove('lost');
        } else {
          heart.classList.add('lost');
        }
      });
    }

    // Low Health Pulse
    const heroWrapper = this.overlay.querySelector('.hero-wrapper');
    if (this.heroHP === 1) {
      heroWrapper?.classList.add('low-health-pulse');
    } else {
      heroWrapper?.classList.remove('low-health-pulse');
    }
  }

  showDamageNumber(targetEl, text) {
    if (!targetEl) return;
    const num = document.createElement('div');
    num.className = 'damage-number';
    num.innerText = text;
    targetEl.appendChild(num);
    setTimeout(() => num.remove(), 1000);
  }

  showGameOver() {

    this.state = 'game_over';
    // Play fail sound (descending tone)
    this.sound.playTone(150, 'sawtooth', 0.4, 0, 0.1);
    this.sound.playTone(100, 'sawtooth', 0.4, 0.4, 0.1);

    const html = `
      <div class="ytq-modal">
        <div class="ytq-header">
            <div><h2 class="ytq-title" style="color: #ef4444">GAME OVER</h2></div>
            <button class="ytq-close" data-action="close">&times;</button>
        </div>
        <div class="ytq-error">
            <div class="ytq-gameover-sprite-wrap">
                <img
                  src="${getAssetUrl('assets/hero-dead.png')}"
                  class="ytq-gameover-sprite"
                  alt="Fallen hero"
                  onerror="this.onerror=null;this.src='${getAssetUrl('assets/hero.png')}';this.classList.add('fallback');"
                >
            </div>
            <div class="ytq-error-message">
                You ran out of hearts!<br>
                The quest has failed.
            </div>
            <button class="ytq-retry-btn" data-action="retry">Try Again</button>
        </div>
      </div>
    `;
    this.updateContent(html);
  }

  // ============ INSTANT FEEDBACK LOGIC ============


  checkAnswer(index, userAnswer) {
    // Prevent multiple checks
    if (this.userAnswers[index] !== undefined) return; // Already answered

    const question = this.currentQuiz.questions[index];
    const feedbackEl = this.overlay.querySelector(`#feedback-${index}`);
    const questionEl = this.overlay.querySelector(`.ytq-question[data-index="${index}"]`);
    if (!feedbackEl || !questionEl) return;
    if (!this.ensureConfidenceSelected(index)) return;

    // Normalize and compare
    const normalize = (str) => String(str).toLowerCase().trim().replace(/[.,!?;:]/g, '');
    let isCorrect = normalize(userAnswer) === normalize(question.correctAnswer);
    let statusText = '';
    let detailsText = '';
    let feedbackClass = '';
    const isFreeRecall = question.type === 'free_recall';
    const damagePerQuestion = this.enemyMaxHP / this.currentQuiz.questions.length;

    if (isFreeRecall) {
      this.combo++;
      statusText = 'Response Recorded';
      detailsText = `Model Answer: <span class="ytq-correct-text">${this.escapeHtml(question.correctAnswer)}</span><br><br><small>Self-check your answer against the model.</small>`;
      feedbackClass = 'correct';
    } else if (isCorrect) {
      // Damage Enemy
      this.enemyHP = Math.max(0, this.enemyHP - damagePerQuestion);

      // Show Damage
      const enemyWrapper = this.overlay.querySelector('.enemy-wrapper');
      this.showDamageNumber(enemyWrapper, `-${Math.round(damagePerQuestion)}`);

      this.combo++;
      this.sound.playCorrect();
      this.triggerBattleAnimation(true);
      // Particle Explosion
      this.createParticles(feedbackEl);

      statusText = `Correct! <img src="${getAssetUrl('assets/coin.png')}" class="ytq-coin" alt="Coin">`;
      detailsText = 'Great job!';
      if (this.combo > 1) {
        detailsText += ` <br><span class="ytq-combo-text">${this.combo}x COMBO!</span>`;
      }
      feedbackClass = 'correct';
    } else {
      this.combo = 0;
      this.heroHP = Math.max(0, this.heroHP - 1);
      this.sound.playIncorrect();
      this.triggerBattleAnimation(false);
      statusText = 'Incorrect';
      detailsText = `The correct answer is: <span class="ytq-correct-text">${this.escapeHtml(question.correctAnswer)}</span>`;
      feedbackClass = 'incorrect';
      const heroWrapper = this.overlay.querySelector('.hero-wrapper');
      this.showDamageNumber(heroWrapper, '-1');

      // Shake animation on the whole question container
      if (questionEl) {
        questionEl.classList.remove('slide-in-right');
        void questionEl.offsetWidth; // trigger reflow
        questionEl.classList.add('shake-hard');
        questionEl.addEventListener('animationend', () => {
          questionEl.classList.remove('shake-hard');
        }, { once: true });
      }
    }

    // Save answer
    this.userAnswers[index] = userAnswer;

    // Update UI
    feedbackEl.classList.remove('hidden');
    feedbackEl.className = `ytq-instant-feedback ${feedbackClass} visible`;

    const statusEl = feedbackEl.querySelector('.ytq-feedback-status');
    const detailsEl = feedbackEl.querySelector('.ytq-feedback-details');

    statusEl.innerHTML = statusText;
    detailsEl.innerHTML = detailsText;

    // Disable inputs
    const options = questionEl.querySelectorAll('.ytq-option');
    options.forEach(opt => {
      opt.style.pointerEvents = 'none';
      if (opt.dataset.value === userAnswer) {
        opt.classList.add(isCorrect ? 'correct' : 'incorrect');
      } else if (!isCorrect && opt.dataset.value === question.correctAnswer) {
        opt.classList.add('correct');
      } else {
        opt.classList.add('dimmed');
      }
    });

    const textarea = questionEl.querySelector('.ytq-textarea');
    if (textarea) textarea.disabled = true;

    const checkBtn = questionEl.querySelector('.ytq-check-btn');
    if (checkBtn) checkBtn.style.display = 'none';
    const confidenceButtons = questionEl.querySelectorAll('.ytq-confidence-btn');
    confidenceButtons.forEach((btn) => {
      btn.disabled = true;
    });

    this.updateHealthUI();

    if (!isFreeRecall && this.enemyHP <= 0) {
      this.state = 'loading';
      setTimeout(() => this.handleSubmit(), 450);
      return;
    }

    if (!isFreeRecall && this.heroHP <= 0) {
      setTimeout(() => this.showGameOver(), 450);
    }
  }

  // Helper to handle next question
  nextQuestion() {
    if (this.currentQuestionIndex < this.currentQuiz.questions.length - 1) {
      this.currentQuestionIndex++;
      const container = this.overlay.querySelector('#ytq-question-container');
      container.innerHTML = this.renderQuestion(this.currentQuestionIndex);
      // Listeners are delegated to overlay, no need to re-attach
    } else {
      this.handleSubmit();
    }
  }

  // ============================================
  // Event Handling
  // ============================================

  attachEventListeners() {
    if (!this.overlay) return;

    // Delegate click events for dynamic content
    this.overlay.addEventListener('click', (e) => {
      const target = e.target;

      // Close
      if (target.closest('[data-action="close"]')) {
        this.hide();
      }

      // Retry
      if (target.closest('[data-action="retry"]')) {
        if (this.onRetry) this.onRetry();
      }

      // MCQ Option
      const option = target.closest('.ytq-option');
      if (option) {
        const index = parseInt(option.dataset.question);
        if (this.userAnswers[index] === undefined) {
          this.checkAnswer(index, option.dataset.value);
        }
      }

      // Confidence Selection
      const confidenceBtn = target.closest('[data-action="set-confidence"]');
      if (confidenceBtn) {
        const index = parseInt(confidenceBtn.dataset.question);
        const value = confidenceBtn.dataset.value;
        if (!Number.isNaN(index) && value) {
          this.setConfidence(index, value);
        }
      }

      // Check Button
      const checkBtn = target.closest('.ytq-check-btn');
      if (checkBtn) {
        const index = parseInt(checkBtn.dataset.question);
        const textarea = this.overlay.querySelector(`.ytq-textarea[data-question="${index}"]`);
        if (textarea && textarea.value.trim()) {
          this.checkAnswer(index, textarea.value.trim());
        }
      }

      // Next Question
      const nextBtn = target.closest('.ytq-next-btn');
      if (nextBtn) {
        this.nextQuestion();
      }

      // Toggle Mute
      const muteBtn = target.closest('[data-action="toggle-mute"]');
      if (muteBtn) {
        const isMuted = this.sound.toggleMute();
        const iconImg = muteBtn.querySelector('.ytq-icon-img');
        if (iconImg) iconImg.src = getAssetUrl(`assets/speaker-${isMuted ? 'off' : 'on'}.png`);
      }

      // Schedule Toggle
      const toggle = target.closest('[data-action="toggle-schedule"]');
      if (toggle) {
        toggle.classList.toggle('active');
      }
    });
  }

  createParticles(target) {
    if (!target) return;
    const rect = target.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    for (let i = 0; i < 30; i++) { // More particles!
      const p = document.createElement('div');
      p.className = 'ytq-particle';
      const colors = ['#fbbf24', '#ffffff', '#f59e0b', '#ef4444'];
      p.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
      p.style.left = centerX + 'px';
      p.style.top = centerY + 'px';

      const angle = Math.random() * Math.PI * 2;
      const velocity = 50 + Math.random() * 100; // Explode distance

      p.style.setProperty('--tx', `${Math.cos(angle) * velocity}px`);
      p.style.setProperty('--ty', `${Math.sin(angle) * velocity}px`);

      document.body.appendChild(p);

      // Cleanup
      setTimeout(() => p.remove(), 1000);
    }
  }

  async handleSubmit() {
    if (!this.currentQuiz || !this.onSubmit) return;

    const answers = this.currentQuiz.questions.map((_, i) => ({
      questionIndex: i,
      answer: this.userAnswers[i] || '',
      confidence: this.userConfidence[i] || 'medium',
    }));

    this.updateContent(this.renderLoading());
    this.startLoadingAnimation();

    try {
      await this.onSubmit(answers);
    } catch (error) {
      this.showError(error.message || 'Failed to submit quiz');
    }
  }

  escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
}

// Export
window.YouTubeQuizzerModal = QuizModal;

/**
 * QuestTube - Modal UI
 * Renders and manages the quiz modal overlay
 * Depends on: utils.js (getAssetUrl), sounds.js (SoundManager), particles.js (ParticleSystem)
 */

class QuizModal {
  constructor() {
    this.overlay = null;
    this.currentQuiz = null;
    this.userAnswers = {};
    this.currentQuestionIndex = 0;
    this.combo = 0;
    this.maxCombo = 0;
    this.score = 0;
    this.state = 'idle'; // idle, loading, quiz, results, error
    this.sound = new SoundManager();
    this.particles = new ParticleSystem();
    this.pendingModeResolver = null;
    this._hoveredMode = null;
    this._selectedMode = null;
    this._startFloor = 1; // Starting dungeon floor based on difficulty
    this._zone = { name: 'Meadow', zone: 'meadow', color: '#4ade80' };
    this.answerCorrectness = {}; // tracks per-question results for progress dots
  }

  /**
   * Show the modal with loading state
   */
  show() {
    if (this.overlay) return;

    this.overlay = document.createElement('div');
    this.overlay.className = 'ytq-overlay';
    document.body.appendChild(this.overlay);

    // Trigger animation
    requestAnimationFrame(() => {
      this.overlay.classList.add('visible');
    });

    // Keyboard handler — Escape to close, A/B/C/D to pick MCQ answers
    this.escHandler = (e) => {
      if (e.key === 'Escape') this.hide();

      // MCQ keyboard shortcuts: A/B/C/D or 1/2/3/4
      if (this.state === 'quiz' && this.currentQuiz) {
        const keyMap = { a: 'A', b: 'B', c: 'C', d: 'D', '1': 'A', '2': 'B', '3': 'C', '4': 'D' };
        const label = keyMap[e.key.toLowerCase()];
        if (label && this.userAnswers[this.currentQuestionIndex] === undefined) {
          const option = this.overlay?.querySelector(
            `.ytq-option[data-question="${this.currentQuestionIndex}"][data-value="${label}"]`
          );
          if (option) option.click();
        }
      }

      // Enter/Space to advance to next question when feedback is showing
      if (this.state === 'quiz' && (e.key === 'Enter' || e.key === ' ')) {
        const feedbackEl = this.overlay?.querySelector(`#feedback-${this.currentQuestionIndex}`);
        if (feedbackEl?.classList.contains('visible')) {
          e.preventDefault();
          this.nextQuestion();
        }
      }
    };
    document.addEventListener('keydown', this.escHandler);

    // Attach click listeners once
    this.attachEventListeners();
  }

  /**
   * Hide the modal
   */
  hide() {
    if (!this.overlay) return;

    if (this.pendingModeResolver) {
      this.pendingModeResolver(null);
      this.pendingModeResolver = null;
    }

    this.overlay.classList.remove('visible');
    setTimeout(() => {
      if (this.overlay && this.overlay.parentNode) {
        document.body.removeChild(this.overlay);
      }
      this.overlay = null;
    }, 300);

    document.removeEventListener('keydown', this.escHandler);
    // Remove dungeon drop/rise if still showing
    if (this._dungeonDrop) {
      this._dungeonDrop.remove();
      this._dungeonDrop = null;
    }
    if (this._dungeonRise) {
      this._dungeonRise.remove();
      this._dungeonRise = null;
    }
    this.reset();
    this.sound.stopTransition();
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
    this.answerCorrectness = {};
    this.score = 0;
    this.combo = 0;
    this.state = 'idle';
    this.pendingModeResolver = null;
  }

  /**
   * Update modal content
   */
  updateContent(html) {
    if (!this.overlay) return;
    this.overlay.innerHTML = html;
    // Apply zone-specific frame border and atmosphere to quiz modal
    const quizModal = this.overlay.querySelector('.ytq-dlg-modal');
    if (quizModal) {
      const zone = this._zone.zone;
      const frameMap = {
        meadow:  { asset: 'assets/meadow_frame.png',  slice: '30%', width: '140px', outset: '30px' },
        cave:    { asset: 'assets/cavern_frame.png',   slice: '30%', width: '140px', outset: '30px' },
        dungeon: { asset: 'assets/dungeon_frame.png',  slice: '30%', width: '140px', outset: '30px' },
        abyss:   { asset: 'assets/abyss_frame.png',    slice: '30%', width: '140px', outset: '30px' },
      };
      const frame = frameMap[zone] || { asset: 'assets/stone_frame.png', slice: '20%', width: '30px', outset: '0' };
      const frameAsset = frame.asset;
      const frameSlice = frame.slice;
      const frameWidth = frame.width;
      const frameOutset = frame.outset || '0';
      quizModal.style.borderImage = `url(${getAssetUrl(frameAsset)}) ${frameSlice} / ${frameWidth} / ${frameOutset} round`;
      quizModal.classList.add(`zone-${this._zone.zone}`);
    }
    // Listeners are already attached to overlay in show()
  }

  /**
   * Show quiz questions
   */
  showQuiz(quiz) {
    this.currentQuiz = quiz;
    this.userAnswers = {};
    this.state = 'quiz';
    this.updateContent(this.renderQuiz(quiz));
    this.sound.playMusic(this._selectedMode);
    this.dismissDungeonDrop();
    this._spawnZoneParticles();
  }

  /**
   * Spawn ambient zone particles inside the quiz modal.
   * Each zone gets its own particle style via CSS class.
   */
  _spawnZoneParticles() {
    const modal = this.overlay?.querySelector('.ytq-dlg-modal');
    if (!modal) return;

    const zone = this._zone.zone;
    const count = zone === 'abyss' ? 18 : zone === 'dungeon' ? 12 : zone === 'cave' ? 10 : 14;

    for (let i = 0; i < count; i++) {
      const p = document.createElement('span');
      p.className = `ytq-zone-particle zone-p-${zone}`;
      p.style.left = `${Math.random() * 100}%`;
      p.style.animationDelay = `${Math.random() * 6}s`;
      p.style.animationDuration = `${3 + Math.random() * 4}s`;
      if (zone === 'meadow') {
        // Grass blades sway at the bottom
        p.style.bottom = `${Math.random() * 4}%`;
      } else {
        // Floating particles rise from various heights
        p.style.bottom = `${-5 + Math.random() * 10}%`;
      }
      modal.appendChild(p);
    }
  }

  getModeConfig(mode) {
    const normalized = String(mode || '').toLowerCase();
    if (normalized === 'easy') {
      return {
        mode: 'easy',
        difficulty: 'easy',
        questionCount: 5,
        title: 'Slime Meadow',
      };
    }
    if (normalized === 'boss') {
      return {
        mode: 'boss',
        difficulty: 'boss',
        questionCount: 12,
        title: 'Boss Arena',
      };
    }
    return {
      mode: 'intermediate',
      difficulty: 'intermediate',
      questionCount: 8,
      title: 'Dungeon Crawl',
    };
  }

  async showModeSelection() {
    this.state = 'mode_select';
    // Pre-warm AudioContext while we're still in the user-gesture call chain
    // (browsers block AudioContext.resume() outside of click/tap handlers)
    this.sound.init();

    // Fetch streak and floor for banner display
    let streak = 0;
    let streakTier = 0;
    let floor = 1;
    let floorZone = { name: 'Meadow', zone: 'meadow', color: '#4ade80' };
    try {
      if (window.QuestTubeStorage) {
        const stats = await window.QuestTubeStorage.getPlayerStats();
        streak = stats.streak || 0;
        streakTier = window.QuestTubeStorage.getStreakTier(streak);
        floor = stats.floor || 1;
        floorZone = window.QuestTubeStorage.getFloorZone(floor);
      }
    } catch (_) { /* ignore */ }

    this.updateContent(this.renderModeSelection(streak, streakTier, floor, floorZone));
    return new Promise((resolve) => {
      this.pendingModeResolver = resolve;
    });
  }

  /**
   * Show results
   */
  showResults(results) {
    this.state = 'results';
    const score = Number(results?.score || 0);
    if (score >= 50) {
      this.sound.playVictory();
    } else {
      this.sound.playDefeat();
    }
    this.updateContent(this.renderResults(results));
    this.dismissDungeonRise();
    // Start the score counter animation after render
    requestAnimationFrame(() => this._animateScoreCounter());
    if (results.xpResult && results.xpResult.leveledUp) {
      this.sound.playLevelUp();
    }
    // Achievement toasts — show after score animation completes (~2.5s)
    if (results.newAchievements && results.newAchievements.length > 0) {
      setTimeout(() => this.showAchievementToasts(results.newAchievements), 2500);
    }
  }

  /**
   * Show error
   */
  showError(message) {
    this.state = 'error';
    this.updateContent(this.renderError(message));
    this.dismissDungeonDrop();
  }

  // ============================================
  // Render Methods
  // ============================================


  renderModeSelection(streak = 0, streakTier = 0, floor = 1, floorZone = null) {
    const zone = floorZone || { name: 'Meadow', zone: 'meadow', color: '#4ade80' };
    const streakBanner = streak >= 1
      ? `<div class="ytq-streak-badge">
           <div class="ytq-streak-flame tier-${streakTier}"></div>
           <span class="ytq-streak-count">${streak} Day Streak</span>
         </div>`
      : '';
    return `
      <div class="ytq-modal ytq-mode-select-modal zone-${zone.zone}">
        <button class="ytq-close ytq-mode-close" data-action="close">&times;</button>
        <div class="ytq-mode-header">
          <span class="ytq-mode-zone" style="--floor-color: ${zone.color}">${zone.name}</span>
          <span class="ytq-mode-heading">SELECT DIFFICULTY</span>
          <span class="ytq-mode-floor" style="--floor-color: ${zone.color}">FLOOR ${floor}</span>
        </div>
        <div class="ytq-pick">
          <button class="ytq-pick__btn ytq-pick__btn--easy" data-action="start-mode" data-mode="easy">
            <span class="ytq-pick__icon ytq-pick__icon--easy"></span>
            <span class="ytq-pick__name">Slime Meadow</span>
            <span class="ytq-pick__info">Patrol</span>
          </button>
          <button class="ytq-pick__btn ytq-pick__btn--mid" data-action="start-mode" data-mode="intermediate">
            <span class="ytq-pick__icon ytq-pick__icon--mid"></span>
            <span class="ytq-pick__name">Dungeon Crawl</span>
            <span class="ytq-pick__info">Descent</span>
          </button>
          <button class="ytq-pick__btn ytq-pick__btn--boss" data-action="start-mode" data-mode="boss">
            <span class="ytq-pick__icon ytq-pick__icon--boss"></span>
            <span class="ytq-pick__name">Boss Arena</span>
            <span class="ytq-pick__info">Rock Bottom</span>
          </button>
        </div>
        <div class="ytq-mode-footer">
          <label class="ytq-demo-toggle">
            <input type="checkbox" id="ytq-demo-mode" />
            <span>DEMO (skip API)</span>
          </label>
          <div class="ytq-dev-controls">
            <button class="ytq-floor-cycle-btn" data-action="cycle-floor-down">&lt;&lt;</button>
            <span class="ytq-floor-cycle-label">CYCLE FLOOR</span>
            <button class="ytq-floor-cycle-btn" data-action="cycle-floor-up">&gt;&gt;</button>
          </div>
          ${streakBanner}
        </div>
      </div>
    `;
  }

  renderQuiz(quiz) {
    this.currentQuestionIndex = 0;
    this.combo = 0;
    this.score = 0;
    this.answerCorrectness = {};
    const heartsHtml = quiz.questions.map((_, i) =>
      `<span class="ytq-hrt${i === 0 ? ' current' : ''}" data-hrt="${i}"><span class="ytq-hrt-px"></span></span>`
    ).join('');
    return `
      <div class="ytq-modal ytq-dlg-modal">
        <div class="ytq-header ytq-dlg-header">
          <div class="ytq-dlg-header-left">
            <h2 class="ytq-title">${this.escapeHtml(quiz.title)}</h2>
          </div>
          <div class="ytq-header-controls">
            <button class="ytq-mute-btn ${this.sound.muted ? 'muted' : ''}" data-action="toggle-mute" title="Toggle sound"></button>
            <button class="ytq-close" data-action="close">&times;</button>
          </div>
        </div>
        <div class="ytq-hud">
          <div class="ytq-hud-left">
            <div class="ytq-combo-hud hidden" id="ytq-combo-hud">
              <span class="ytq-combo-num" id="ytq-combo-num">2</span><span class="ytq-combo-x">x</span>
            </div>
          </div>
          <div class="ytq-hud-center">
            <div class="ytq-hrt-row">${heartsHtml}</div>
          </div>
          <div class="ytq-hud-right">
            <span class="ytq-score-hud" id="ytq-score-hud">0</span>
            <span class="ytq-score-label-hud">PTS</span>
          </div>
        </div>
        <div class="ytq-content">
          <div id="ytq-question-container">${this.renderQuestion(0)}</div>
        </div>
      </div>`;
  }

  updateProgressHearts(animate) {
    if (!this.overlay || !this.currentQuiz) return;
    const total = this.currentQuiz.questions.length;
    for (let i = 0; i < total; i++) {
      const hrt = this.overlay.querySelector(`.ytq-hrt[data-hrt="${i}"]`);
      if (!hrt) continue;
      hrt.className = 'ytq-hrt';
      if (i === this.currentQuestionIndex) hrt.classList.add('current');
      const result = this.answerCorrectness[i];
      if (result === 'correct') {
        hrt.classList.add('filled');
        if (animate && i === this.currentQuestionIndex) hrt.classList.add('pop');
      } else if (result === 'incorrect') {
        hrt.classList.add('broken');
        if (animate && i === this.currentQuestionIndex) hrt.classList.add('pop');
      } else if (result === 'recall') {
        hrt.classList.add('recall');
        if (animate && i === this.currentQuestionIndex) hrt.classList.add('pop');
      }
    }
  }

  /**
   * Dungeon drop — persistent black gate that stays during quiz loading.
   * Dismissed by showQuiz() or showError() when content is ready.
   */
  async showDungeonDrop(mode) {
    this.dismissDungeonDrop(); // clean up any existing drop

    // Use persistent floor from storage (or zone override for preview)
    let persistentFloor = 1;
    let zone = { name: 'Meadow', zone: 'meadow', color: '#4ade80' };
    try {
      if (window.QuestTubeStorage) {
        const stats = await window.QuestTubeStorage.getPlayerStats();
        persistentFloor = stats.floor || 1;
        zone = window.QuestTubeStorage.getFloorZone(persistentFloor);
      }
    } catch (_) {}

    // Dev override: set window._ytqZoneOverride = 'cave' | 'dungeon' | 'abyss' | 'meadow'
    const override = window._ytqZoneOverride;
    if (override) {
      const overrides = {
        meadow:  { name: 'Meadow',  zone: 'meadow',  color: '#4ade80' },
        cave:    { name: 'Caverns', zone: 'cave',     color: '#fbbf24' },
        dungeon: { name: 'Dungeon', zone: 'dungeon',  color: '#a78bfa' },
        abyss:   { name: 'Abyss',   zone: 'abyss',    color: '#ef4444' },
      };
      if (overrides[override]) zone = overrides[override];
    }

    this._startFloor = persistentFloor;
    this._zone = zone;

    const drop = document.createElement('div');
    drop.className = `ytq-dungeon-drop zone-${zone.zone}`;
    drop.innerHTML = `
      <div class="ytq-drop-gate"></div>
      <div class="ytq-drop-text">
        <span class="ytq-drop-floor">FLOOR ${this._startFloor}</span>
        <span class="ytq-drop-name">${zone.name}</span>
        <span class="ytq-drop-status">Descending<span class="ytq-drop-loader"><span class="ytq-loader-block"></span><span class="ytq-loader-block"></span><span class="ytq-loader-block"></span></span></span>
      </div>
    `;
    document.body.appendChild(drop);
    this._dungeonDrop = drop;

    // Play descending jingle (music already stopped by click handler)
    this.sound.playDescend();

    // Gate slams down (0.4s), then reveal text
    setTimeout(() => drop.classList.add('show-text'), 400);
    // Show loading status after a beat
    setTimeout(() => drop.classList.add('show-status'), 1000);
  }

  /**
   * Dismiss the dungeon drop — gate rises from bottom revealing content underneath.
   */
  dismissDungeonDrop() {
    const drop = this._dungeonDrop;
    if (!drop) return;
    this._dungeonDrop = null;

    this.sound.stopTransition();
    drop.classList.remove('show-text', 'show-status');
    drop.classList.add('reveal');
    setTimeout(() => drop.remove(), 600);
  }

  /**
   * Dungeon rise — ascending transition shown while results load.
   * Mirror of dungeon drop but gate closes upward and opens downward.
   */
  showDungeonRise() {
    this.dismissDungeonRise();

    const depthMap = { easy: 'Surface Level', intermediate: 'The Descent', boss: 'Rock Bottom' };
    const depth = depthMap[this._selectedMode] || 'Unknown';

    const rise = document.createElement('div');
    rise.className = 'ytq-dungeon-rise';
    rise.innerHTML = `
      <div class="ytq-rise-gate"></div>
      <div class="ytq-rise-text">
        <span class="ytq-rise-title">DAYBREAK</span>
        <span class="ytq-rise-subtitle">${depth}</span>
        <span class="ytq-rise-status">Emerging from the dark...</span>
      </div>
    `;
    document.body.appendChild(rise);
    this._dungeonRise = rise;

    // Stop quiz music, then play ascending jingle
    this.sound.stopMusic();
    this.sound.playAscend();

    setTimeout(() => rise.classList.add('show-text'), 400);
    setTimeout(() => rise.classList.add('show-status'), 1000);
  }

  /**
   * Dismiss the dungeon rise — gate drops downward revealing results.
   */
  dismissDungeonRise() {
    const rise = this._dungeonRise;
    if (!rise) return;
    this._dungeonRise = null;

    this.sound.stopTransition();
    rise.classList.remove('show-text', 'show-status');
    rise.classList.add('reveal');
    setTimeout(() => rise.remove(), 600);
  }

  triggerDialogFlash(isCorrect) {
    const modal = this.overlay?.querySelector('.ytq-dlg-modal');
    if (!modal) return;
    modal.classList.remove('flash-correct', 'flash-incorrect');
    void modal.offsetWidth;
    modal.classList.add(isCorrect ? 'flash-correct' : 'flash-incorrect');
  }

  triggerBattleAnimation(isCorrect) {
    this.triggerDialogFlash(isCorrect);
    this._spawnHeartFeedback(isCorrect);

    if (!isCorrect) {
      this._shakeScreen();
    }
  }

  /**
   * Screen shake — shakes the entire modal overlay.
   * Intensity scales with consecutive wrong answers or combo break.
   */
  _shakeScreen(intensity = 1) {
    if (!this.overlay) return;
    const modal = this.overlay.querySelector('.ytq-dlg-modal') || this.overlay.querySelector('.ytq-modal');
    if (!modal) return;

    // Remove any existing shake classes
    modal.classList.remove('screen-shake', 'screen-shake-heavy');
    void modal.offsetWidth; // force reflow

    modal.classList.add(intensity >= 2 ? 'screen-shake-heavy' : 'screen-shake');
    modal.addEventListener('animationend', () => {
      modal.classList.remove('screen-shake', 'screen-shake-heavy');
    }, { once: true });

    // Red vignette flash on wrong
    this._flashVignette();
  }

  /**
   * Flash a red vignette overlay on wrong answers for visceral feedback.
   */
  _flashVignette() {
    if (!this.overlay) return;
    let vignette = this.overlay.querySelector('.ytq-vignette');
    if (!vignette) {
      vignette = document.createElement('div');
      vignette.className = 'ytq-vignette';
      this.overlay.appendChild(vignette);
    }
    vignette.classList.remove('flash');
    void vignette.offsetWidth;
    vignette.classList.add('flash');
    vignette.addEventListener('animationend', () => {
      vignette.classList.remove('flash');
    }, { once: true });
  }

  _triggerTorchReaction(isCorrect) {
    if (!this.overlay) return;
    const torches = this.overlay.querySelectorAll('.ytq-torch');
    const cls = isCorrect ? 'flare' : 'dimmed';
    torches.forEach(t => {
      t.classList.remove('flare', 'dimmed');
      void t.offsetWidth; // force reflow for re-triggering
      t.classList.add(cls);
      t.addEventListener('animationend', () => t.classList.remove(cls), { once: true });
    });
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
        <button class="ytq-check-btn" data-action="check" data-question="${index}" disabled>Check Answer</button>
      `;
    }

    return `
      <div class="ytq-question ytq-dialog-box slide-in-right" data-index="${index}">
        <div class="ytq-question-header">
          <span class="ytq-question-number">FLOOR ${this._startFloor + index}</span>
          <span class="ytq-question-type ${question.type}">${typeLabel[question.type] || question.type}</span>
        </div>
        <p class="ytq-question-text">${this.escapeHtml(question.text)}</p>
        ${answerHtml}
        ${checkButtonHtml}
        <div class="ytq-fb-bar hidden" id="feedback-${index}">
          <div class="ytq-fb-left">
            <span class="ytq-fb-icon"></span>
            <span class="ytq-fb-text"></span>
          </div>
          <button class="ytq-next-btn" data-action="next-question">
            ${index === this.currentQuiz.questions.length - 1 ? 'Finish' : 'Next'}
          </button>
        </div>
      </div>
    `;
  }

  _getTier(score) {
    if (score >= 95) return { name: 'Dungeon Master', cls: 'tier-master' };
    if (score >= 85) return { name: 'Knight', cls: 'tier-knight' };
    if (score >= 70) return { name: 'Adventurer', cls: 'tier-adventurer' };
    if (score >= 50) return { name: 'Squire', cls: 'tier-squire' };
    return { name: 'Fallen', cls: 'tier-fallen' };
  }

  renderResults(results) {
    const safeResults = results && typeof results === 'object' ? results : {};
    const score = Number(safeResults.score || 0);
    const tier = this._getTier(score);
    const xpEarned = Number(safeResults?.xpResult?.xpEarned ?? Math.round(score));
    const coinsEarned = Number(safeResults.coinsEarned || 0);
    const correctCount = Number(safeResults.correctCount || 0);
    const totalQuestions = Number(safeResults.totalQuestions || 0);

    // Build heart recap from answer correctness
    const heartsHtml = Array.from({ length: totalQuestions }, (_, i) => {
      const result = this.answerCorrectness[i];
      const cls = result === 'correct' ? 'filled' : result === 'incorrect' ? 'broken' : '';
      return `<span class="ytq-hrt ${cls}"><span class="ytq-hrt-px"></span></span>`;
    }).join('');

    // Build wrong-answer review rows
    const feedback = Array.isArray(safeResults.questionFeedback) ? safeResults.questionFeedback : [];
    const wrongAnswers = feedback.filter(fb => !fb.isCorrect);
    let reviewHtml = '';
    if (wrongAnswers.length > 0) {
      const rows = wrongAnswers.map(fb => {
        const qi = fb.questionIndex;
        const question = this.currentQuiz?.questions?.[qi];
        const qText = question?.text || `Question ${qi + 1}`;
        const truncated = qText.length > 60 ? qText.slice(0, 57) + '...' : qText;
        const ts = question?.timestampSeconds;
        const hasTimestamp = typeof ts === 'number' && ts >= 0;
        const timeLabel = hasTimestamp
          ? `${Math.floor(ts / 60)}:${String(Math.floor(ts % 60)).padStart(2, '0')}`
          : null;
        const seekBtn = hasTimestamp
          ? `<button class="ytq-review-seek" data-action="seek-timestamp" data-seconds="${ts}" title="Jump to ${timeLabel}">${timeLabel}</button>`
          : '';
        return `
          <div class="ytq-review-row">
            <span class="ytq-review-q">${this.escapeHtml(truncated)}</span>
            ${seekBtn}
          </div>`;
      }).join('');
      reviewHtml = `
        <section class="ytq-review-section">
          <h3 class="ytq-review-title">REVIEW MISTAKES</h3>
          <div class="ytq-review-list">${rows}</div>
          <p class="ytq-review-hint">These are also saved in your QuestTube popup for later.</p>
        </section>`;
    } else if (totalQuestions > 0) {
      reviewHtml = `
        <section class="ytq-review-section">
          <p class="ytq-review-hint" style="text-align:center; margin:0;">No mistakes — flawless run!</p>
        </section>`;
    }

    // Streak result line
    const streakEvent = safeResults.streakEvent || 'maintained';
    const streakCount = Number(safeResults.streakCount || 0);
    const streakTier = window.QuestTubeStorage?.getStreakTier?.(streakCount) || 0;
    let streakHtml = '';
    if (streakEvent === 'incremented' || streakEvent === 'started') {
      streakHtml = `<div class="ytq-result-streak streak-up"><div class="ytq-streak-flame tier-${streakTier}"></div><span>${streakCount} Day Streak!</span></div>`;
    } else if (streakEvent === 'frozen') {
      streakHtml = `<div class="ytq-result-streak streak-frozen"><span class="ytq-shield-icon"></span><span>Streak Saved! (Shield Used)</span></div>`;
    } else if (streakEvent === 'reset') {
      streakHtml = `<div class="ytq-result-streak streak-reset"><span>Streak Reset</span></div>`;
    } else if (streakEvent === 'maintained' && streakCount >= 1) {
      streakHtml = `<div class="ytq-result-streak streak-maintained"><div class="ytq-streak-flame tier-${streakTier}"></div><span>${streakCount} Day Streak</span></div>`;
    }

    // Floor advancement display
    const floorResult = safeResults.floorResult;
    let floorHtml = '';
    if (floorResult) {
      const { oldFloor, newFloor, floorsAdvanced } = floorResult;
      const newZone = window.QuestTubeStorage?.getFloorZone?.(newFloor) || { name: 'Meadow', color: '#4ade80' };
      if (floorsAdvanced > 0) {
        floorHtml = `
          <div class="ytq-floor-advance floor-up">
            <span class="ytq-floor-label">FLOOR ${oldFloor}</span>
            <span class="ytq-floor-arrow">&gt;&gt;</span>
            <span class="ytq-floor-label highlight">${newFloor}</span>
            <span class="ytq-floor-zone zone-${newZone.zone || 'meadow'}" style="color:${newZone.color}">${newZone.name}</span>
          </div>`;
      } else if (floorsAdvanced < 0) {
        floorHtml = `
          <div class="ytq-floor-advance floor-down">
            <span class="ytq-floor-label">FLOOR ${oldFloor}</span>
            <span class="ytq-floor-arrow">&gt;&gt;</span>
            <span class="ytq-floor-label">${newFloor}</span>
            <span class="ytq-floor-zone zone-${newZone.zone || 'meadow'}" style="color:${newZone.color}">${newZone.name}</span>
          </div>`;
      } else {
        floorHtml = `
          <div class="ytq-floor-advance floor-hold">
            <span class="ytq-floor-label">FLOOR ${newFloor}</span>
            <span class="ytq-floor-zone zone-${newZone.zone || 'meadow'}" style="color:${newZone.color}">${newZone.name}</span>
          </div>`;
      }
    }

    // Headline text — Dark Souls style
    const headline = score >= 50 ? 'QUEST COMPLETE' : 'YOU FELL';

    // Compact summary line: "7/10 · +45 XP · +2 coins"
    const summaryParts = [
      `<span class="ytq-summary-stat">${correctCount}/${totalQuestions}</span>`,
      `<span class="ytq-summary-stat xp">+${xpEarned} XP</span>`,
    ];
    if (coinsEarned > 0) {
      summaryParts.push(`<span class="ytq-summary-stat coins">+${coinsEarned} <img class="ytq-reward-coin-img" src="${getAssetUrl('assets/coin.png')}" alt="coins"></span>`);
    }
    const summaryHtml = summaryParts.join('<span class="ytq-summary-sep">&middot;</span>');

    return `
      <div class="ytq-modal ytq-victory-modal">
        <button class="ytq-close ytq-close-float" data-action="close">&times;</button>
        <div class="ytq-results">
          <section class="ytq-victory-stage">
            <div class="ytq-result-main">
              <div class="ytq-result-headline">${headline}</div>
              <div class="ytq-score-counter" data-target="${score}">0%</div>
              <div class="ytq-tier-emblem ${tier.cls}">
                <span class="ytq-tier-pip"></span>
                <span class="ytq-tier-name">${tier.name}</span>
              </div>
            </div>

            <div class="ytq-result-details">
              <div class="ytq-heart-recap">${heartsHtml}</div>
              <div class="ytq-result-summary">${summaryHtml}</div>
              ${floorHtml}
              ${streakHtml}
              ${safeResults.xpResult?.leveledUp ? `
                <div class="ytq-level-up-banner">
                  <div class="ytq-level-up-text">LEVEL UP!</div>
                  <div class="ytq-level-up-details">${safeResults.xpResult.oldLevel} &gt;&gt; ${safeResults.xpResult.newLevel}</div>
                </div>
              ` : ''}
            </div>

            <div class="ytq-result-actions">
              <button class="ytq-btn-resume" data-action="close">Resume Video</button>
              <button class="ytq-btn-retry" data-action="retry">Play Again</button>
            </div>
          </section>
          ${reviewHtml}
        </div>
      </div>
    `;
  }

  _animateScoreCounter() {
    const el = this.overlay?.querySelector('.ytq-score-counter');
    if (!el) return;
    const target = parseInt(el.dataset.target, 10) || 0;
    const duration = 1800;
    const start = performance.now();

    const tick = (now) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(eased * target);
      el.textContent = `${current}%`;
      if (progress < 1) {
        requestAnimationFrame(tick);
      } else {
        el.classList.add('done');

        // Confetti burst on passing scores
        if (target >= 50) {
          const count = target >= 95 ? 60 : target >= 70 ? 40 : 25;
          this.particles.burst(count);
        }

        // Staggered reveal — Dark Souls style
        const emblem = this.overlay?.querySelector('.ytq-tier-emblem');
        if (emblem) emblem.classList.add('visible');
        // Details (hearts + summary) after tier
        setTimeout(() => {
          const details = this.overlay?.querySelector('.ytq-result-details');
          if (details) details.classList.add('visible');
        }, 400);
        // Action buttons last
        setTimeout(() => {
          const actions = this.overlay?.querySelector('.ytq-result-actions');
          if (actions) actions.classList.add('visible');
        }, 700);
      }
    };
    requestAnimationFrame(tick);
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
          <div class="ytq-error-icon">!</div>
          <div class="ytq-error-message">${this.escapeHtml(message)}</div>
          <button class="ytq-retry-btn" data-action="retry">Try Again</button>
        </div>
      </div>
    `;
  }

  showDamageNumber(targetEl, text) {
    if (!targetEl) return;
    const num = document.createElement('div');
    num.className = 'damage-number';
    num.innerText = text;
    targetEl.appendChild(num);
    setTimeout(() => num.remove(), 1000);
  }

  // ============ INSTANT FEEDBACK LOGIC ============


  checkAnswer(index, userAnswer) {
    // Prevent multiple checks
    if (this.userAnswers[index] !== undefined) return;

    const question = this.currentQuiz.questions[index];
    const feedbackEl = this.overlay.querySelector(`#feedback-${index}`);
    const questionEl = this.overlay.querySelector(`.ytq-question[data-index="${index}"]`);
    if (!feedbackEl || !questionEl) return;

    const normalize = (str) => String(str).toLowerCase().trim().replace(/[.,!?;:]/g, '');
    const normUser = normalize(userAnswer);
    const normCorrect = normalize(question.correctAnswer);
    let isCorrect = question.type === 'short_answer'
      ? (normUser === normCorrect || normUser.includes(normCorrect) || normCorrect.includes(normUser))
      : normUser === normCorrect;
    const isFreeRecall = question.type === 'free_recall';
    const hadCombo = this.combo >= 2;

    if (isFreeRecall) {
      this.combo++;
      this.maxCombo = Math.max(this.maxCombo, this.combo);
    } else if (isCorrect) {
      this.combo++;
      this.maxCombo = Math.max(this.maxCombo, this.combo);
      this.sound.playCorrect();
      this.triggerBattleAnimation(true);

      // De-escalate music intensity on correct answer
      this.sound.lowerIntensity();

      // Score: base 100 + combo bonus
      const points = 100 + (this.combo > 1 ? this.combo * 25 : 0);
      this.score += points;
      this._animateScoreUp();

      // Floating XP
      const selectedOpt = questionEl.querySelector(`.ytq-option[data-value="${userAnswer}"]`);
      this._spawnFloatingXP(selectedOpt || questionEl, `+${points}`);

      // Floating damage number on the modal (boss takes damage)
      this._spawnDamageNumber(`-${points}`, 'hit');

      // Combo milestone announcement
      if (this.combo === 3) this._spawnComboText('ON FIRE!');
      else if (this.combo === 5) this._spawnComboText('UNSTOPPABLE!');
      else if (this.combo === 8) this._spawnComboText('GODLIKE!');
    } else {
      const brokenCombo = this.combo;
      this.combo = 0;
      this.sound.playIncorrect();
      this.triggerBattleAnimation(false);

      // Escalate music intensity on every wrong answer
      this.sound.raiseIntensity();

      // Floating damage number — boss retaliates
      this._spawnDamageNumber('MISS', 'miss');

      // Heavy screen shake on combo break
      if (hadCombo) {
        this._shakeScreen(2);
        this._animateComboBreak();
        this._spawnComboText(`${brokenCombo}x BROKEN`);
      }
    }

    // Update combo display with escalating intensity
    this._updateComboDisplay();

    // Save answer
    this.userAnswers[index] = userAnswer;
    this.answerCorrectness[index] = isFreeRecall ? 'recall' : (isCorrect ? 'correct' : 'incorrect');
    this.updateProgressHearts(true);

    // --- Highlight options (Duolingo-style) ---
    const options = questionEl.querySelectorAll('.ytq-option');
    options.forEach(opt => {
      opt.style.pointerEvents = 'none';
      const val = opt.dataset.value;
      if (val === userAnswer && isCorrect) {
        opt.classList.add('correct');
      } else if (val === userAnswer && !isCorrect) {
        opt.classList.add('incorrect');
      }
      if (!isCorrect && val === question.correctAnswer) {
        opt.classList.add('correct');
      }
      // Dim unrelated options
      if (val !== userAnswer && val !== question.correctAnswer) {
        opt.classList.add('dimmed');
      }
    });

    // Disable textarea / hide check button for non-MC
    const textarea = questionEl.querySelector('.ytq-textarea');
    if (textarea) textarea.disabled = true;
    const checkBtn = questionEl.querySelector('.ytq-check-btn');
    if (checkBtn) checkBtn.style.display = 'none';

    // --- Floating coin reward + particles on correct ---
    if (isCorrect && !isFreeRecall) {
      const selectedOpt = questionEl.querySelector(`.ytq-option[data-value="${userAnswer}"]`);
      const anchor = selectedOpt || questionEl;
      this._spawnFloatingReward(anchor);
      this.createParticles(anchor, this.combo);
    }

    // --- Slim feedback bar ---
    const fbIcon = feedbackEl.querySelector('.ytq-fb-icon');
    const fbText = feedbackEl.querySelector('.ytq-fb-text');

    const isShortAnswer = question.type === 'short_answer';
    const shortAnswerPraise = ['Well done, adventurer!', 'Nailed it!', 'Sharp mind!', 'Knowledge is power!'];
    const shortAnswerFail = ['Not quite...', 'The tome says otherwise.', 'Close, but no loot.', 'The dungeon claims another.'];

    if (isFreeRecall) {
      feedbackEl.className = 'ytq-fb-bar correct visible';
      fbIcon.textContent = '';
      fbText.innerHTML = `Model answer: <strong>${this.escapeHtml(question.correctAnswer)}</strong>`;
    } else if (isCorrect && isShortAnswer) {
      feedbackEl.className = 'ytq-fb-bar correct visible';
      fbIcon.innerHTML = `<img src="${getAssetUrl('assets/coin.png')}" class="ytq-fb-coin" alt="">`;
      const praise = shortAnswerPraise[Math.floor(Math.random() * shortAnswerPraise.length)];
      let text = praise;
      if (this.combo > 1) text += ` &middot; ${this.combo}x Combo`;
      fbText.innerHTML = text;
    } else if (isCorrect) {
      feedbackEl.className = 'ytq-fb-bar correct visible';
      fbIcon.innerHTML = `<img src="${getAssetUrl('assets/coin.png')}" class="ytq-fb-coin" alt="">`;
      let text = '+1 Coin';
      if (this.combo > 1) text += ` &middot; ${this.combo}x Combo`;
      fbText.innerHTML = text;
    } else if (!isCorrect && isShortAnswer) {
      feedbackEl.className = 'ytq-fb-bar incorrect visible';
      const fail = shortAnswerFail[Math.floor(Math.random() * shortAnswerFail.length)];
      fbIcon.textContent = '';
      fbText.innerHTML = `${fail} Answer: <strong>${this.escapeHtml(question.correctAnswer)}</strong>`;
    } else {
      feedbackEl.className = 'ytq-fb-bar incorrect visible';
      fbIcon.textContent = '';
      fbText.innerHTML = `Correct: <strong>${this.escapeHtml(question.correctAnswer)}</strong>`;

      // Shake on wrong
      if (questionEl) {
        questionEl.classList.remove('slide-in-right');
        void questionEl.offsetWidth;
        questionEl.classList.add('shake-hard');
        questionEl.addEventListener('animationend', () => {
          questionEl.classList.remove('shake-hard');
        }, { once: true });
      }
    }
  }

  /**
   * Spawn a floating "+1 coin" animation above the given element
   */
  _spawnFloatingReward(anchor) {
    const el = document.createElement('div');
    el.className = 'ytq-float-reward';
    el.innerHTML = `<img src="${getAssetUrl('assets/coin.png')}" class="ytq-float-coin" alt=""> +1`;

    // Position relative to the anchor
    const rect = anchor.getBoundingClientRect();
    el.style.position = 'fixed';
    el.style.left = `${rect.left + rect.width / 2}px`;
    el.style.top = `${rect.top}px`;
    el.style.zIndex = '10002';
    document.body.appendChild(el);

    el.addEventListener('animationend', () => el.remove());
  }

  // ============ HUD HELPERS ============

  _spawnHeartFeedback(isCorrect) {
    const modal = this.overlay?.querySelector('.ytq-dlg-modal');
    if (!modal) return;
    const el = document.createElement('div');
    el.className = `ytq-heart-feedback ${isCorrect ? 'correct' : 'incorrect'}`;
    el.innerHTML = `<span class="ytq-hrt-big"><span class="${isCorrect ? 'ytq-hrt-px' : 'ytq-hrt-broken-px'}"></span></span>`;
    modal.appendChild(el);
    el.addEventListener('animationend', () => el.remove(), { once: true });
  }

  _updateComboDisplay() {
    if (!this.overlay) return;
    const hud = this.overlay.querySelector('#ytq-combo-hud');
    const num = this.overlay.querySelector('#ytq-combo-num');
    if (!hud || !num) return;

    if (this.combo >= 2) {
      num.textContent = this.combo;
      hud.classList.remove('hidden', 'pulse', 'fire', 'inferno', 'breaking');
      void hud.offsetWidth;
      hud.classList.add('pulse');

      // Escalating intensity tiers
      if (this.combo >= 8) {
        hud.classList.add('inferno');
      } else if (this.combo >= 5) {
        hud.classList.add('fire');
      }
    } else {
      hud.classList.add('hidden');
      hud.classList.remove('fire', 'inferno', 'pulse');
    }

    // Escalate modal intensity based on combo
    const modal = this.overlay.querySelector('.ytq-dlg-modal');
    if (modal) {
      modal.classList.remove('combo-tier-1', 'combo-tier-2', 'combo-tier-3');
      if (this.combo >= 8) modal.classList.add('combo-tier-3');
      else if (this.combo >= 5) modal.classList.add('combo-tier-2');
      else if (this.combo >= 3) modal.classList.add('combo-tier-1');
    }
  }

  _animateComboBreak() {
    if (!this.overlay) return;
    const hud = this.overlay.querySelector('#ytq-combo-hud');
    if (!hud || hud.classList.contains('hidden')) return;
    hud.classList.remove('pulse', 'fire', 'inferno');
    hud.classList.add('breaking');
    hud.addEventListener('animationend', () => {
      hud.classList.add('hidden');
      hud.classList.remove('breaking');
    }, { once: true });
  }

  _animateScoreUp() {
    if (!this.overlay) return;
    const el = this.overlay.querySelector('#ytq-score-hud');
    if (!el) return;
    el.textContent = this.score;
    el.classList.remove('ticking');
    void el.offsetWidth;
    el.classList.add('ticking');
  }

  _spawnFloatingXP(anchor, text) {
    if (!anchor) return;
    const el = document.createElement('div');
    el.className = 'ytq-float-xp';
    el.textContent = text;
    const rect = anchor.getBoundingClientRect();
    el.style.left = `${rect.left + rect.width / 2}px`;
    el.style.top = `${rect.top - 10}px`;
    document.body.appendChild(el);
    el.addEventListener('animationend', () => el.remove());
  }

  /**
   * Floating damage number on the modal — RPG-style hit numbers.
   * type: 'hit' (green, boss takes damage), 'miss' (red, player whiffed)
   */
  _spawnDamageNumber(text, type = 'hit') {
    const modal = this.overlay?.querySelector('.ytq-dlg-modal') || this.overlay?.querySelector('.ytq-modal');
    if (!modal) return;

    const el = document.createElement('div');
    el.className = `ytq-dmg-number ytq-dmg-${type}`;
    el.textContent = text;

    // Slight random horizontal offset for variety
    const offsetX = (Math.random() - 0.5) * 60;
    el.style.setProperty('--dmg-x', `${offsetX}px`);

    // Scale with combo for escalating intensity
    if (this.combo >= 5) el.classList.add('dmg-crit');

    modal.appendChild(el);
    el.addEventListener('animationend', () => el.remove(), { once: true });
  }

  /**
   * Floating combo milestone text — big announcement that fades out.
   */
  _spawnComboText(text) {
    const modal = this.overlay?.querySelector('.ytq-dlg-modal') || this.overlay?.querySelector('.ytq-modal');
    if (!modal) return;

    const el = document.createElement('div');
    el.className = 'ytq-combo-announce';
    el.textContent = text;

    // Color based on content
    if (text.includes('BROKEN')) el.classList.add('combo-broken');
    else if (text.includes('GODLIKE')) el.classList.add('combo-godlike');

    modal.appendChild(el);
    el.addEventListener('animationend', () => el.remove(), { once: true });
  }

  // Helper to handle next question
  nextQuestion() {
    if (this.currentQuestionIndex < this.currentQuiz.questions.length - 1) {
      const container = this.overlay.querySelector('#ytq-question-container');
      const currentQ = container.querySelector('.ytq-question');

      this.sound.playNextFloor();

      // Animate out, then animate in
      if (currentQ) {
        currentQ.classList.add('fall-down');
        currentQ.addEventListener('animationend', () => {
          this.currentQuestionIndex++;
          container.innerHTML = this.renderQuestion(this.currentQuestionIndex);
          this.updateProgressHearts(false);
        }, { once: true });
      } else {
        this.currentQuestionIndex++;
        container.innerHTML = this.renderQuestion(this.currentQuestionIndex);
        this.updateProgressHearts(false);
      }
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
    this.overlay.addEventListener('click', async (e) => {
      const target = e.target;

      // Close
      if (target.closest('[data-action="close"]')) {
        this.hide();
      }

      // Retry
      if (target.closest('[data-action="retry"]')) {
        if (this.onRetry) this.onRetry();
      }

      // Floor cycling — dev testing
      const cycleUp = target.closest('[data-action="cycle-floor-up"]');
      const cycleDown = target.closest('[data-action="cycle-floor-down"]');
      if (cycleUp || cycleDown) {
        const presetFloors = [1, 3, 8, 12, 20, 25, 35, 50];
        try {
          const stats = await window.QuestTubeStorage.getPlayerStats();
          const currentFloor = stats.floor || 1;
          const idx = presetFloors.findIndex(f => f >= currentFloor);
          let nextIdx;
          if (cycleUp) {
            nextIdx = idx === -1 || idx >= presetFloors.length - 1 ? 0 : idx + 1;
          } else {
            nextIdx = idx <= 0 ? presetFloors.length - 1 : idx - 1;
          }
          stats.floor = presetFloors[nextIdx];
          stats.deepestFloor = Math.max(stats.deepestFloor || 1, stats.floor);
          await chrome.storage.local.set({ playerStats: stats });
          // Re-render mode select UI WITHOUT creating a new promise
          // (showModeSelection() would orphan the original promise content.js is awaiting)
          const wasDevMode = this.overlay?.querySelector('.ytq-mode-select-modal')?.classList.contains('ytq-dev-mode') || false;
          const wasDemo = this.overlay?.querySelector('#ytq-demo-mode')?.checked || false;
          const newFloor = stats.floor;
          const newZone = window.QuestTubeStorage?.getFloorZone?.(newFloor) || { name: 'Meadow', zone: 'meadow', color: '#4ade80' };
          const streak = stats.streak || 0;
          const streakTier = window.QuestTubeStorage?.getStreakTier?.(streak) || 0;
          this.updateContent(this.renderModeSelection(streak, streakTier, newFloor, newZone));
          if (wasDevMode) {
            const modal = this.overlay?.querySelector('.ytq-mode-select-modal');
            if (modal) modal.classList.add('ytq-dev-mode');
          }
          if (wasDemo) {
            const cb = this.overlay?.querySelector('#ytq-demo-mode');
            if (cb) cb.checked = true;
          }
        } catch (_) {}
        return;
      }

      // Start quiz mode
      const modeBtn = target.closest('[data-action="start-mode"]');
      if (modeBtn) {
        const mode = modeBtn.dataset.mode;
        const modeConfig = this.getModeConfig(mode);
        // Check demo toggle
        const demoCheck = this.overlay?.querySelector('#ytq-demo-mode');
        if (demoCheck?.checked) modeConfig.demo = true;
        this._selectedMode = mode;
        this._hoveredMode = null;
        this.state = 'loading'; // Prevent mouseout from killing audio
        this.sound.stopMusic();
        this.sound.playSelect();
        // Visual press feedback before dungeon drop
        modeBtn.classList.add('ytq-pick__btn--pressed');
        if (this.pendingModeResolver) {
          const resolveMode = this.pendingModeResolver;
          this.pendingModeResolver = null;
          // Dungeon drop fetches persistent floor then covers screen
          await this.showDungeonDrop(mode);
          resolveMode(modeConfig);
        }
      }

      // MCQ Option
      const option = target.closest('.ytq-option');
      if (option) {
        const index = parseInt(option.dataset.question);
        if (this.userAnswers[index] === undefined) {
          this.checkAnswer(index, option.dataset.value);
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
        muteBtn.classList.toggle('muted', isMuted);
      }

      // Schedule Toggle
      const toggle = target.closest('[data-action="toggle-schedule"]');
      if (toggle) {
        toggle.classList.toggle('active');
      }

      // Timestamp seek — jump video to the relevant moment
      const seekBtn = target.closest('[data-action="seek-timestamp"]');
      if (seekBtn) {
        const seconds = Number(seekBtn.dataset.seconds);
        if (!isNaN(seconds) && seconds >= 0) {
          const video = document.querySelector('video.html5-main-video');
          if (video) {
            video.currentTime = seconds;
            video.play().catch(() => {});
          }
          this.hide();
        }
      }
    });

    // Enable/disable Check Answer button based on textarea content
    this.overlay.addEventListener('input', (e) => {
      const textarea = e.target.closest('.ytq-textarea');
      if (!textarea) return;
      const idx = textarea.dataset.question;
      const btn = this.overlay.querySelector(`.ytq-check-btn[data-question="${idx}"]`);
      if (btn) btn.disabled = !textarea.value.trim();
    });

    // Triple-click on floor badge toggles dev controls
    let floorClickCount = 0;
    let floorClickTimer = null;
    this.overlay.addEventListener('click', (e) => {
      if (!e.target.closest('.ytq-mode-header')) return;
      floorClickCount++;
      clearTimeout(floorClickTimer);
      floorClickTimer = setTimeout(() => { floorClickCount = 0; }, 400);
      if (floorClickCount >= 3) {
        floorClickCount = 0;
        const modal = this.overlay.querySelector('.ytq-mode-select-modal');
        if (modal) modal.classList.toggle('ytq-dev-mode');
      }
    });

    // Option hover tick during quiz
    this.overlay.addEventListener('mouseover', (e) => {
      if (this.state === 'quiz') {
        const opt = e.target.closest('.ytq-option');
        if (opt && !opt.classList.contains('correct') && !opt.classList.contains('incorrect') && !opt.classList.contains('dimmed')) {
          this.sound.playTick();
        }
      }

      // Mode preview music on hover
      if (this.state !== 'mode_select') return;
      const btn = e.target.closest('[data-mode]');
      if (btn) {
        const mode = btn.dataset.mode;
        if (mode !== this._hoveredMode) {
          this._hoveredMode = mode;
          this.sound.playModePreview(mode);
        }
      }
    });

    this.overlay.addEventListener('mouseout', (e) => {
      if (this.state !== 'mode_select') return;
      const btn = e.target.closest('[data-mode]');
      if (!btn) return;
      // Only stop if we're leaving to something that isn't another mode button
      const related = e.relatedTarget;
      if (!related || !related.closest('[data-mode]')) {
        this._hoveredMode = null;
        this.sound.stopMusic();
      }
    });
  }

  createParticles(target, comboLevel = 0) {
    if (!target) return;
    const rect = target.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    // Escalate particle count and velocity with combo
    const baseCount = 30;
    const count = Math.min(baseCount + comboLevel * 12, 80);
    const baseVelocity = 50;
    const velocityBonus = Math.min(comboLevel * 20, 80);

    // Color palettes escalate with combo
    const colorSets = [
      ['#fbbf24', '#ffffff', '#f59e0b', '#ef4444'],                    // default gold
      ['#fbbf24', '#ffffff', '#f59e0b', '#4ade80', '#86efac'],         // 2x green gold
      ['#fbbf24', '#ff6b6b', '#a78bfa', '#4ade80', '#fef08a'],        // 3x rainbow
      ['#ff0000', '#ff4400', '#ff8800', '#ffcc00', '#ffffff', '#fef08a'], // 5x fire
    ];
    const palette = colorSets[Math.min(Math.max(comboLevel - 1, 0), colorSets.length - 1)];

    for (let i = 0; i < count; i++) {
      const p = document.createElement('div');
      p.className = 'ytq-particle';
      if (comboLevel >= 5) p.classList.add('particle-fire');
      p.style.backgroundColor = palette[Math.floor(Math.random() * palette.length)];
      p.style.left = centerX + 'px';
      p.style.top = centerY + 'px';

      // Bigger particles at higher combos
      const size = comboLevel >= 3 ? 6 + Math.random() * 6 : 6 + Math.random() * 4;
      p.style.width = size + 'px';
      p.style.height = size + 'px';

      const angle = Math.random() * Math.PI * 2;
      const velocity = baseVelocity + velocityBonus + Math.random() * (100 + velocityBonus);

      p.style.setProperty('--tx', `${Math.cos(angle) * velocity}px`);
      p.style.setProperty('--ty', `${Math.sin(angle) * velocity}px`);

      document.body.appendChild(p);
      setTimeout(() => p.remove(), 1200);
    }
  }

  /**
   * Dark Souls-style achievement toast — slides up from the bottom.
   * Staggered if multiple badges unlocked at once.
   */
  showAchievementToasts(badges) {
    if (!Array.isArray(badges) || badges.length === 0) return;
    badges.forEach((badge, i) => {
      setTimeout(() => {
        this.sound.playAchievement();
        const toast = document.createElement('div');
        toast.className = `ytq-achievement-toast${badge.tier === 'legendary' ? ' tier-legendary' : ''}`;
        toast.innerHTML = `
          <span class="ytq-toast-pip tier-${badge.tier}"></span>
          <span class="ytq-toast-body">
            <span class="ytq-toast-label">Achievement Unlocked</span>
            <span class="ytq-toast-name">${this.escapeHtml(badge.name)}</span>
            <span class="ytq-toast-desc">${this.escapeHtml(badge.desc)}</span>
          </span>
        `;
        document.body.appendChild(toast);
        // Auto-dismiss after 3.5s
        setTimeout(() => {
          toast.classList.add('dismissing');
          toast.addEventListener('animationend', () => toast.remove(), { once: true });
        }, 3500);
      }, i * 1800); // stagger each toast by 1.8s
    });
  }

  async handleSubmit() {
    if (!this.currentQuiz || !this.onSubmit) return;

    const answers = this.currentQuiz.questions.map((_, i) => ({
      questionIndex: i,
      answer: this.userAnswers[i] || '',
      confidence: 'medium',
    }));

    // Ascending transition while results load
    this.showDungeonRise();

    try {
      await this.onSubmit(answers);
    } catch (error) {
      this.dismissDungeonRise();
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

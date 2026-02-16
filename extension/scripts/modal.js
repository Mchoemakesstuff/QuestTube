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
    this.state = 'idle'; // idle, loading, quiz, results, error
    this.sound = new SoundManager();
    this.particles = new ParticleSystem();
    this.loadingInterval = null; // Track interval for clearing
    this.pendingModeResolver = null;
    this._hoveredMode = null;
    this._selectedMode = null;
    this.answerCorrectness = {}; // tracks per-question results for progress dots
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
    this.answerCorrectness = {};
    this.state = 'idle';
    this.pendingModeResolver = null;
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
    this.state = 'quiz';
    this.updateContent(this.renderQuiz(quiz));
    this.sound.playMusic(this._selectedMode);
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

  showModeSelection() {
    this.state = 'mode_select';
    // Pre-warm AudioContext while we're still in the user-gesture call chain
    // (browsers block AudioContext.resume() outside of click/tap handlers)
    this.sound.init();
    this.updateContent(this.renderModeSelection());
    return new Promise((resolve) => {
      this.pendingModeResolver = resolve;
    });
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

  renderModeSelection() {
    return `
      <div class="ytq-modal ytq-mode-select-modal">
        <button class="ytq-close ytq-mode-close" data-action="close">&times;</button>
        <div class="ytq-mode-header">
          <h2 class="ytq-mode-heading">SELECT DIFFICULTY</h2>
        </div>
        <div class="ytq-pick">
          <button class="ytq-pick__btn ytq-pick__btn--easy" data-action="start-mode" data-mode="easy">
            <span class="ytq-pick__icon ytq-pick__icon--easy"></span>
            <span class="ytq-pick__name">Slime Meadow</span>
            <span class="ytq-pick__info">5 encounters &middot; Warm-Up</span>
          </button>
          <button class="ytq-pick__btn ytq-pick__btn--mid" data-action="start-mode" data-mode="intermediate">
            <span class="ytq-pick__icon ytq-pick__icon--mid"></span>
            <span class="ytq-pick__name">Dungeon Crawl</span>
            <span class="ytq-pick__info">8 encounters &middot; Gauntlet</span>
          </button>
          <button class="ytq-pick__btn ytq-pick__btn--boss" data-action="start-mode" data-mode="boss">
            <span class="ytq-pick__icon ytq-pick__icon--boss"></span>
            <span class="ytq-pick__name">Boss Arena</span>
            <span class="ytq-pick__info">12 encounters &middot; Final Stand</span>
          </button>
        </div>
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

  // ---- LAYOUT SWITCH ----
  // To revert to battle scene: return this._renderQuiz_withBattleScene(quiz);
  renderQuiz(quiz) { return this._renderQuiz_dialogBox(quiz); }

  _renderQuiz_withBattleScene(quiz) {
    this.currentQuestionIndex = 0;
    this.combo = 0;
    this.answerCorrectness = {};
    return `
      <div class="ytq-modal">
        <div class="ytq-header">
          <div><h2 class="ytq-title">Battle: ${this.escapeHtml(quiz.title)}</h2></div>
          <div class="ytq-header-controls">
            <button class="ytq-icon-btn" data-action="toggle-mute">
                <img class="ytq-icon-img" src="${getAssetUrl(`assets/speaker-${this.sound.muted ? 'off' : 'on'}.png`)}" alt="Mute">
            </button>
            <button class="ytq-close" data-action="close">&times;</button>
          </div>
        </div>
        <div class="ytq-battle-scene" style="background: url('${getAssetUrl('assets/battle_bg.png')}') center bottom / cover no-repeat;">
            <div class="ytq-combatant hero-wrapper">
              <img src="${getAssetUrl('assets/hero.png')}" class="ytq-hero" alt="Hero">
            </div>
            <div class="ytq-combatant enemy-wrapper">
              <img src="${getAssetUrl('assets/enemy.png')}" class="ytq-enemy" alt="Enemy">
            </div>
        </div>
        <div class="ytq-content">
          <div id="ytq-question-container">${this.renderQuestion(0)}</div>
        </div>
      </div>`;
  }

  _renderQuiz_dialogBox(quiz) {
    this.currentQuestionIndex = 0;
    this.combo = 0;
    this.answerCorrectness = {};
    const total = quiz.questions.length;
    const dots = quiz.questions.map((_, i) =>
      `<span class="ytq-pdot${i === 0 ? ' current' : ''}" data-dot="${i}"></span>`
    ).join('');
    return `
      <div class="ytq-modal ytq-dlg-modal">
        <div class="ytq-header ytq-dlg-header">
          <div class="ytq-dlg-header-left">
            <img src="${getAssetUrl('assets/hero.png')}" class="ytq-dlg-portrait" alt="">
            <span class="ytq-dlg-vs">VS</span>
            <img src="${getAssetUrl('assets/enemy.png')}" class="ytq-dlg-portrait" alt="">
            <h2 class="ytq-title">${this.escapeHtml(quiz.title)}</h2>
          </div>
          <div class="ytq-header-controls">
            <button class="ytq-icon-btn" data-action="toggle-mute">
              <img class="ytq-icon-img" src="${getAssetUrl(`assets/speaker-${this.sound.muted ? 'off' : 'on'}.png`)}" alt="Mute">
            </button>
            <button class="ytq-close" data-action="close">&times;</button>
          </div>
        </div>
        <div class="ytq-dlg-progress">
          <div class="ytq-pdots">${dots}</div>
          <span class="ytq-dlg-count" id="ytq-dlg-count">1 / ${total}</span>
        </div>
        <div class="ytq-content">
          <div id="ytq-question-container">${this.renderQuestion(0)}</div>
        </div>
      </div>`;
  }

  updateProgressDots() {
    if (!this.overlay || !this.currentQuiz) return;
    const total = this.currentQuiz.questions.length;
    for (let i = 0; i < total; i++) {
      const dot = this.overlay.querySelector(`.ytq-pdot[data-dot="${i}"]`);
      if (!dot) continue;
      dot.className = 'ytq-pdot';
      if (i === this.currentQuestionIndex) dot.classList.add('current');
      if (this.answerCorrectness[i] === 'correct') dot.classList.add('correct');
      else if (this.answerCorrectness[i] === 'incorrect') dot.classList.add('incorrect');
      else if (this.answerCorrectness[i] === 'recall') dot.classList.add('recall');
    }
    const counter = this.overlay.querySelector('#ytq-dlg-count');
    if (counter) counter.textContent = `${this.currentQuestionIndex + 1} / ${total}`;
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
    const hero = this.overlay.querySelector('.ytq-hero');
    const enemy = this.overlay.querySelector('.ytq-enemy');
    if (!hero || !enemy) return;
    hero.classList.remove('attacking', 'damaged');
    enemy.classList.remove('attacking', 'damaged');
    void hero.offsetWidth;
    if (isCorrect) {
      hero.classList.add('attacking');
      setTimeout(() => enemy.classList.add('damaged'), 200);
    } else {
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

    return `
      <div class="ytq-question ytq-dialog-box slide-in-right" data-index="${index}">
        <div class="ytq-question-header">
          <span class="ytq-question-number">Question ${index + 1} of ${this.currentQuiz.questions.length}</span>
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

  renderResults(results) {
    const safeResults = results && typeof results === 'object' ? results : {};
    const score = Number(safeResults.score || 0);
    const rank = score >= 95 ? 'S' : score >= 85 ? 'A' : score >= 70 ? 'B' : score >= 50 ? 'C' : 'D';
    const xpEarned = Number(safeResults?.xpResult?.xpEarned ?? Math.round(score));
    const coinsEarned = Number(safeResults.coinsEarned || 0);
    const correctCount = Number(safeResults.correctCount || 0);
    const totalQuestions = Number(safeResults.totalQuestions || 0);

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
    }

    return `
      <div class="ytq-modal ytq-victory-modal">
        <div class="ytq-header">
          <div>
            <h2 class="ytq-title">Victory Report</h2>
          </div>
          <button class="ytq-close" data-action="close">&times;</button>
        </div>
        <div class="ytq-results">
          <section class="ytq-victory-stage" style="background: url('${getAssetUrl('assets/battle_bg.png')}') center bottom / cover no-repeat;">
            <div class="ytq-terraria-badge">
              <div class="ytq-terraria-rank">${rank}</div>
              <div class="ytq-terraria-stat">XP +${xpEarned}</div>
              <div class="ytq-terraria-stat">Coins +${coinsEarned}</div>
            </div>

            <div class="ytq-score-center">
              <div class="ytq-score-core">${score}%</div>
              <div class="ytq-score-sub">${correctCount} of ${totalQuestions} correct</div>
              <button class="ytq-next-btn ytq-play-again-btn" data-action="retry">Play Again</button>
            </div>
          </section>
          ${safeResults.xpResult?.leveledUp ? `
            <div class="ytq-level-up-banner">
              <div class="ytq-level-up-text">LEVEL UP!</div>
              <div class="ytq-level-up-details">${safeResults.xpResult.oldLevel} ➜ ${safeResults.xpResult.newLevel}</div>
            </div>
          ` : ''}
          ${reviewHtml}
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
    let isCorrect = normalize(userAnswer) === normalize(question.correctAnswer);
    const isFreeRecall = question.type === 'free_recall';

    if (isFreeRecall) {
      this.combo++;
    } else if (isCorrect) {
      this.combo++;
      this.sound.playCorrect();
      this.triggerBattleAnimation(true);
    } else {
      this.combo = 0;
      this.sound.playIncorrect();
      this.triggerBattleAnimation(false);
    }

    // Save answer
    this.userAnswers[index] = userAnswer;
    this.answerCorrectness[index] = isFreeRecall ? 'recall' : (isCorrect ? 'correct' : 'incorrect');
    this.updateProgressDots();

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

    // --- Floating reward animation on correct ---
    if (isCorrect && !isFreeRecall) {
      const selectedOpt = questionEl.querySelector(`.ytq-option[data-value="${userAnswer}"]`);
      const anchor = selectedOpt || questionEl;
      this._spawnFloatingReward(anchor);
      this.createParticles(anchor);
    }

    // --- Slim feedback bar ---
    const fbIcon = feedbackEl.querySelector('.ytq-fb-icon');
    const fbText = feedbackEl.querySelector('.ytq-fb-text');

    if (isFreeRecall) {
      feedbackEl.className = 'ytq-fb-bar correct visible';
      fbIcon.textContent = '';
      fbText.innerHTML = `Model answer: <strong>${this.escapeHtml(question.correctAnswer)}</strong>`;
    } else if (isCorrect) {
      feedbackEl.className = 'ytq-fb-bar correct visible';
      fbIcon.textContent = '';
      let text = '+1 Coin';
      if (this.combo > 1) text += ` &middot; ${this.combo}x Combo`;
      fbText.innerHTML = text;
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

  // Helper to handle next question
  nextQuestion() {
    if (this.currentQuestionIndex < this.currentQuiz.questions.length - 1) {
      this.currentQuestionIndex++;
      const container = this.overlay.querySelector('#ytq-question-container');
      container.innerHTML = this.renderQuestion(this.currentQuestionIndex);
      this.updateProgressDots();
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

      // Start quiz mode
      const modeBtn = target.closest('[data-action="start-mode"]');
      if (modeBtn) {
        const mode = modeBtn.dataset.mode;
        const modeConfig = this.getModeConfig(mode);
        this._selectedMode = mode;
        this._hoveredMode = null;
        this.sound.stopMusic();
        this.sound.playSelect();
        if (this.pendingModeResolver) {
          const resolveMode = this.pendingModeResolver;
          this.pendingModeResolver = null;
          this.updateContent(this.renderLoading());
          this.startLoadingAnimation();
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
        const iconImg = muteBtn.querySelector('.ytq-icon-img');
        if (iconImg) iconImg.src = getAssetUrl(`assets/speaker-${isMuted ? 'off' : 'on'}.png`);
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

    // Mode preview music on hover
    this.overlay.addEventListener('mouseover', (e) => {
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
      confidence: 'medium',
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

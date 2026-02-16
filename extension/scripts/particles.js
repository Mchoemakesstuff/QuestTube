/**
 * QuestTube - Particle System
 * Visual effects: confetti bursts and sparkles
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

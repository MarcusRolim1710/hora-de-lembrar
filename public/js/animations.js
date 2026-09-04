// Animações reutilizáveis com GSAP
const Animations = {
  // Entrada do tabuleiro
  boardEntrance(boardEl) {
    const cards = boardEl.querySelectorAll('.card');
    gsap.from(cards, {
      opacity: 0,
      scale: 0,
      rotation: 180,
      stagger: {
        amount: 0.6,
        grid: [5, 4],
        from: 'center'
      },
      duration: 0.5,
      ease: 'back.out(1.4)'
    });
  },

  // Virar carta
  flipCard(cardEl) {
    gsap.to(cardEl, {
      rotationY: 180,
      duration: 0.5,
      ease: 'power2.inOut'
    });
  },

  // Desvirar carta
  unflipCard(cardEl) {
    gsap.to(cardEl, {
      rotationY: 0,
      duration: 0.5,
      ease: 'power2.inOut'
    });
  },

  // Acerto (par encontrado)
  matchSuccess(cardEls) {
    cardEls.forEach((card, i) => {
      gsap.to(card, {
        scale: 1.15,
        duration: 0.2,
        delay: i * 0.05,
        yoyo: true,
        repeat: 1,
        ease: 'power2.inOut'
      });
      
      gsap.to(card, {
        boxShadow: '0 0 30px #10b981',
        duration: 0.3
      });
    });
  },

  // Erro (shake)
  matchError(cardEls) {
    gsap.to(cardEls, {
      x: -8,
      duration: 0.08,
      yoyo: true,
      repeat: 5,
      ease: 'power1.inOut',
      onComplete: () => {
        gsap.to(cardEls, { x: 0, duration: 0.1 });
      }
    });
  },

  // Modal entrada
  modalIn(modalEl) {
    gsap.fromTo(modalEl.querySelector('.modal-content'), 
      { scale: 0.5, opacity: 0, y: 50 },
      { scale: 1, opacity: 1, y: 0, duration: 0.6, ease: 'back.out(1.4)' }
    );
  },

  // Confete (simples)
  confetti(element) {
    for (let i = 0; i < 20; i++) {
      const conf = document.createElement('div');
      conf.textContent = ['🎉', '✨', '⭐', '🏆'][Math.floor(Math.random() * 4)];
      conf.style.cssText = `
        position: absolute;
        font-size: 1.5rem;
        pointer-events: none;
        left: ${Math.random() * 100}%;
        top: 50%;
      `;
      element.appendChild(conf);
      
      gsap.to(conf, {
        y: -200 - Math.random() * 200,
        x: (Math.random() - 0.5) * 400,
        rotation: Math.random() * 720,
        opacity: 0,
        duration: 1.5 + Math.random(),
        ease: 'power2.out',
        onComplete: () => conf.remove()
      });
    }
  }
};

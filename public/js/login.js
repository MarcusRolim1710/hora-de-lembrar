const form = document.getElementById('loginForm');
const input = document.getElementById('playerName');
const errorMsg = document.getElementById('errorMsg');

// Animação de entrada
gsap.from('.login-card', {
  opacity: 0,
  y: 30,
  duration: 0.8,
  ease: 'power2.out'
});

gsap.from('.brand-logo', {
  scale: 0,
  rotation: -12,
  duration: 1,
  delay: 0.3,
  ease: 'back.out(1.7)'
});

form.addEventListener('submit', (e) => {
  e.preventDefault();
  
  const name = input.value.trim();
  
  if (!name) {
    showError('Por favor, digite seu nome');
    return;
  }
  
  if (name.length < 2) {
    showError('Nome muito curto');
    return;
  }
  
  // Salvar nome e ir para lobby
  sessionStorage.setItem('playerName', name);
  
  // Animação de saída
  gsap.to('.login-card', {
    opacity: 0,
    y: -30,
    duration: 0.4,
    onComplete: () => {
      window.location.href = '/lobby';
    }
  });
});

function showError(msg) {
  errorMsg.textContent = msg;
  errorMsg.classList.remove('hidden');
  gsap.fromTo(errorMsg, 
    { x: -10 }, 
    { x: 10, duration: 0.05, repeat: 5, yoyo: true }
  );
  setTimeout(() => errorMsg.classList.add('hidden'), 3000);
}

// Foco automático
input.focus();

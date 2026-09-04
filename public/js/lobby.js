const socket = io();
const playerName = sessionStorage.getItem('playerName');

if (!playerName) {
  window.location.href = '/';
}

document.getElementById('playerNameDisplay').textContent = playerName;

const backBtn = document.getElementById('backBtn');
const createBtn = document.getElementById('createBtn');
const joinBtn = document.getElementById('joinBtn');
const roomCodeInput = document.getElementById('roomCode');
const roomsList = document.getElementById('roomsList');

// Animação de entrada
gsap.from('.lobby-card', {
  opacity: 0,
  y: 30,
  duration: 0.6,
  ease: 'power2.out'
});

// Voltar
backBtn.addEventListener('click', () => {
  gsap.to('.lobby-card', {
    opacity: 0,
    x: -30,
    duration: 0.3,
    onComplete: () => {
      window.location.href = '/';
    }
  });
});

// Criar sala
createBtn.addEventListener('click', () => {
  const mode = document.querySelector('input[name="mode"]:checked').value;
  socket.emit('create-room', { playerName, mode });
});

function saveSessionAndGo({ roomId, mode, playerId, isHost }) {
  sessionStorage.setItem('roomId', roomId);
  sessionStorage.setItem('mode', mode);
  sessionStorage.setItem('playerId', playerId);
  sessionStorage.setItem('isHost', isHost ? 'true' : 'false');
  window.location.href = '/waiting';
}

socket.on('room-created', (payload) => {
  saveSessionAndGo({ ...payload, isHost: true });
});

// Novo: confirmação privada de quem entrou (antes faltava e nunca redirecionava)
socket.on('joined-room', (payload) => {
  saveSessionAndGo(payload);
});

// Entrar em sala
joinBtn.addEventListener('click', joinRoom);
roomCodeInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') joinRoom();
});

function joinRoom() {
  const code = roomCodeInput.value.trim().toUpperCase();
  if (code.length !== 4) {
    alert('❌ Código deve ter 4 letras');
    return;
  }

  // Reaproveita playerId se já existe (evita duplicar player no refresh)
  const existingPlayerId = sessionStorage.getItem('playerId') || undefined;
  socket.emit('join-room', { roomId: code, playerName, playerId: existingPlayerId });
}

socket.on('error', ({ message }) => {
  alert('❌ ' + message);
});

// Listar salas
socket.emit('list-rooms');
setInterval(() => socket.emit('list-rooms'), 3000);

socket.on('rooms-list', (rooms) => {
  if (rooms.length === 0) {
    roomsList.innerHTML = '<p class="empty-msg">Nenhuma sala disponível</p>';
    return;
  }
  
  roomsList.innerHTML = '';
  rooms.forEach(room => {
    const div = document.createElement('div');
    div.className = 'room-item';
    div.innerHTML = `
      <div>
        <strong>${room.id}</strong>
        <span style="color: var(--text-muted); font-size: 0.85rem;">
          ${room.playerCount}/4 • ${room.mode === 'best-of-3' ? '🏆 Melhor de 3' : '⚡ Rodada Única'}
        </span>
      </div>
      <span>→</span>
    `;
    div.addEventListener('click', () => {
      roomCodeInput.value = room.id;
      joinRoom();
    });
    roomsList.appendChild(div);
  });
});

// Input uppercase
roomCodeInput.addEventListener('input', (e) => {
  e.target.value = e.target.value.toUpperCase();
});

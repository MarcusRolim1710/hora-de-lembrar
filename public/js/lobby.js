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
const lockCheck = document.getElementById('lockCheck');
const lockSlider = document.querySelector('.lock-slider');
const pinCreateWrap = document.getElementById('pinCreateWrap');
const createPin = document.getElementById('createPin');
// Modal PIN
const pinModal = document.getElementById('pinModal');
const pinRoomId = document.getElementById('pinRoomId');
const joinPin = document.getElementById('joinPin');
const pinError = document.getElementById('pinError');
const pinCancelBtn = document.getElementById('pinCancelBtn');
const pinConfirmBtn = document.getElementById('pinConfirmBtn');

let cachedRooms = [];
let pendingRoomCode = null;

// Animação de entrada
if (window.gsap) {
  gsap.from('.lobby-card', {
    opacity: 0,
    y: 30,
    duration: 0.6,
    ease: 'power2.out'
  });
}

// Voltar
backBtn.addEventListener('click', () => {
  const go = () => { window.location.href = '/'; };
  if (window.gsap) {
    gsap.to('.lobby-card', { opacity: 0, x: -30, duration: 0.3, onComplete: go });
  } else go();
});

// Toggle cadeado
lockCheck.addEventListener('change', () => {
  const locked = lockCheck.checked;
  lockSlider.textContent = locked ? '🔒' : '🔓';
  pinCreateWrap.classList.toggle('hidden', !locked);
  if (locked) createPin.focus();
});

// Só dígitos no PIN
[createPin, joinPin].forEach(el => {
  if (!el) return;
  el.addEventListener('input', (e) => {
    e.target.value = e.target.value.replace(/\D/g, '').slice(0, 4);
  });
});

// Criar sala (com PIN opcional)
createBtn.addEventListener('click', () => {
  const mode = document.querySelector('input[name="mode"]:checked').value;
  let password;
  if (lockCheck.checked) {
    if (!/^\d{4}$/.test(createPin.value)) {
      alert('❌ Digite um PIN de 4 dígitos para proteger a sala');
      createPin.focus();
      return;
    }
    password = createPin.value;
  }
  socket.emit('create-room', { playerName, mode, password });
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
  closePinModal();
  saveSessionAndGo(payload);
});

// Entrar em sala
joinBtn.addEventListener('click', () => joinRoom());
roomCodeInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') joinRoom();
});

function joinRoom(password) {
  const code = roomCodeInput.value.trim().toUpperCase();
  if (code.length !== 4) {
    alert('❌ Código deve ter 4 letras');
    return;
  }

  const known = cachedRooms.find(r => r.id === code);
  // Se a sala tem cadeado e o PIN não foi informado, abre o modal
  if (known && known.hasPassword && password === undefined) {
    openPinModal(code);
    return;
  }

  // Reaproveita playerId se já existe (evita duplicar player no refresh)
  const existingPlayerId = sessionStorage.getItem('playerId') || undefined;
  socket.emit('join-room', { roomId: code, playerName, playerId: existingPlayerId, password });
}

// Modal PIN
function openPinModal(code) {
  pendingRoomCode = code;
  pinRoomId.textContent = code;
  joinPin.value = '';
  pinError.classList.add('hidden');
  pinModal.classList.remove('hidden');
  setTimeout(() => joinPin.focus(), 50);
}

function closePinModal() {
  pinModal.classList.add('hidden');
  pendingRoomCode = null;
}

pinCancelBtn.addEventListener('click', closePinModal);
pinModal.addEventListener('click', (e) => {
  if (e.target === pinModal) closePinModal();
});
joinPin.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') confirmPin();
});
pinConfirmBtn.addEventListener('click', confirmPin);

function confirmPin() {
  if (!/^\d{4}$/.test(joinPin.value)) {
    showPinError('Digite o PIN de 4 dígitos');
    return;
  }
  roomCodeInput.value = pendingRoomCode;
  joinRoom(joinPin.value);
}

function showPinError(msg) {
  pinError.textContent = msg;
  pinError.classList.remove('hidden');
}

socket.on('error', ({ message }) => {
  // Erro de PIN aparece dentro do modal, não em alert
  if (message === 'Senha incorreta' && !pinModal.classList.contains('hidden')) {
    showPinError('❌ PIN incorreto, tente de novo');
    joinPin.value = '';
    joinPin.focus();
    return;
  }
  alert('❌ ' + message);
});

// Listar salas
socket.emit('list-rooms');
setInterval(() => {
  if (!document.hidden) socket.emit('list-rooms');
}, 3000);

socket.on('rooms-list', (rooms) => {
  cachedRooms = rooms;
  if (rooms.length === 0) {
    roomsList.innerHTML = '<p class="empty-msg">Nenhuma sala disponível</p>';
    return;
  }

  roomsList.innerHTML = '';
  rooms.forEach(room => {
    const div = document.createElement('div');
    div.className = 'room-item' + (room.hasPassword ? ' locked' : '');
    div.innerHTML = `
      <div>
        <strong>${room.hasPassword ? '🔒 ' : ''}${room.id}</strong>
        <span style="color: var(--text-muted); font-size: 0.85rem;">
          ${room.playerCount}/4 • ${room.mode === 'best-of-3' ? '🏆 Melhor de 3' : '⚡ Rodada Única'}
        </span>
      </div>
      <span>${room.hasPassword ? '🔒' : '→'}</span>
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

const socket = io();
const roomId = sessionStorage.getItem('roomId');
const playerName = sessionStorage.getItem('playerName');
const playerId = sessionStorage.getItem('playerId');
let mode = sessionStorage.getItem('mode') || 'single';
let hostId = null;
let amIHost = sessionStorage.getItem('isHost') === 'true';

if (!roomId || !playerName || !playerId) {
  window.location.href = '/';
}

const roomCodeDisplay = document.getElementById('roomCodeDisplay');
const modeDisplay = document.getElementById('modeDisplay');
const playersList = document.getElementById('playersList');
const playerCount = document.getElementById('playerCount');
const startBtn = document.getElementById('startBtn');
const waitingMsg = document.getElementById('waitingMsg');
const copyBtn = document.getElementById('copyBtn');
const leaveBtn = document.getElementById('leaveBtn');

roomCodeDisplay.textContent = roomId;
modeDisplay.textContent = mode === 'best-of-3' ? '🏆 Melhor de 3' : '⚡ Rodada Única';

// Animações
if (window.gsap) {
  gsap.from('.waiting-card', {
    opacity: 0,
    scale: 0.95,
    duration: 0.6,
    ease: 'power2.out'
  });

  gsap.from('.room-code-display', {
    scale: 0,
    duration: 0.8,
    delay: 0.3,
    ease: 'back.out(1.7)'
  });
}

function refreshHostUI() {
  if (amIHost) {
    startBtn.classList.remove('hidden');
    waitingMsg.classList.add('hidden');
  } else {
    startBtn.classList.add('hidden');
    waitingMsg.classList.remove('hidden');
  }
}
refreshHostUI();

// Rebind: socket.id muda a cada página, então reanexa via playerId persistente
function doRejoin() {
  socket.emit('rejoin-room', { roomId, playerId });
}
if (socket.connected) {
  doRejoin();
} else {
  socket.on('connect', doRejoin);
}

startBtn.addEventListener('click', () => {
  socket.emit('start-game', { roomId, playerId });
});

copyBtn.addEventListener('click', () => {
  const done = () => {
    copyBtn.textContent = '✅';
    setTimeout(() => copyBtn.textContent = '📋', 2000);
  };
  if (navigator.clipboard) {
    navigator.clipboard.writeText(roomId).then(done).catch(done);
  } else {
    done();
  }
});

leaveBtn.addEventListener('click', () => {
  socket.emit('leave-room', { roomId, playerId });
  sessionStorage.removeItem('roomId');
  sessionStorage.removeItem('isHost');
  sessionStorage.removeItem('playerId');
  sessionStorage.removeItem('mode');
  window.location.href = '/lobby';
});

socket.on('rejoined', ({ players, hostId: h, mode: m, isHost }) => {
  hostId = h;
  if (m) {
    mode = m;
    sessionStorage.setItem('mode', m);
    modeDisplay.textContent = m === 'best-of-3' ? '🏆 Melhor de 3' : '⚡ Rodada Única';
  }
  if (typeof isHost === 'boolean') {
    amIHost = isHost;
    sessionStorage.setItem('isHost', isHost ? 'true' : 'false');
    refreshHostUI();
  }
  updatePlayersList(players, hostId);
});

socket.on('player-joined', ({ players, hostId: h }) => {
  if (h) hostId = h;
  updatePlayersList(players, hostId);
});

socket.on('player-left', ({ players, hostId: h }) => {
  if (h) hostId = h;
  // Se eu fui removido de verdade (não só refresh), a lista não me contém
  if (players && !players.some(p => p.id === playerId)) {
    // Fui removido — volta ao lobby (caso de limpeza)
    // Mas ignora flapping temporário de disconnect: servidor mantém slot, então geralmente ainda estou lá
  }
  updatePlayersList(players, hostId);
});

socket.on('host-changed', ({ players, hostId: h }) => {
  hostId = h;
  amIHost = (h === playerId);
  sessionStorage.setItem('isHost', amIHost ? 'true' : 'false');
  refreshHostUI();
  updatePlayersList(players, hostId);
});

socket.on('error', ({ message }) => {
  if (message && /Sessão expirada|não está nesta sala/i.test(message)) {
    alert('❌ ' + message + ' — voltando ao lobby');
    window.location.href = '/lobby';
  } else if (message) {
    alert('❌ ' + message);
  }
});

function updatePlayersList(players, currentHostId) {
  if (!players) return;
  const h = currentHostId || hostId;
  playerCount.textContent = players.length;
  playersList.innerHTML = '';

  players.forEach((player) => {
    const li = document.createElement('li');
    li.className = 'player-item';
    const isCurrentHost = h ? player.id === h : false;
    const offline = player.connected === false ? ' <span style="opacity:.6;font-size:.8em">(offline)</span>' : '';
    const escName = String(player.name || '').replace(/</g, '&lt;');
    li.innerHTML = `
      <div class="player-avatar">${escName.charAt(0).toUpperCase()}</div>
      <span class="player-name">${escName}${offline}</span>
      ${isCurrentHost ? '<span class="host-badge">Host</span>' : ''}
    `;
    playersList.appendChild(li);
  });

  if (window.gsap && players.length) {
    gsap.from('.player-item:last-child', {
      opacity: 0,
      x: -20,
      duration: 0.4,
      ease: 'power2.out'
    });
  }
}

// Quando o jogo começar
socket.on('round-started', () => {
  window.location.href = '/game';
});

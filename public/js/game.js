const socket = io();
const roomId = sessionStorage.getItem('roomId');
// CORREÇÃO: usa playerId persistente, não socket.id (que muda a cada página e era undefined no load)
const myPlayerId = sessionStorage.getItem('playerId');
const playerName = sessionStorage.getItem('playerName');

if (!roomId || !myPlayerId) {
  window.location.href = '/lobby';
}

const boardEl = document.getElementById('board');
const roundDisplay = document.getElementById('roundDisplay');
const pairsDisplay = document.getElementById('pairsDisplay');
const timerDisplay = document.getElementById('timerDisplay');
const scoreList = document.getElementById('scoreList');
const roundModal = document.getElementById('roundModal');
const gameOverModal = document.getElementById('gameOverModal');
const roundWinnerText = document.getElementById('roundWinnerText');
const roundScoreText = document.getElementById('roundScoreText');
const gameWinnerText = document.getElementById('gameWinnerText');
const finalScoreEl = document.getElementById('finalScore');
const backToLobbyBtn = document.getElementById('backToLobbyBtn');

let myBoard = [];
let myPairs = 0;
let totalPairs = 10;
let timerInterval = null;
let startTime = null;
let canFlip = true;
let lastProgress = [];

// Rebind ao entrar no jogo (novo socket.id)
function doRejoin() {
  socket.emit('rejoin-room', { roomId, playerId: myPlayerId });
}
if (socket.connected) {
  doRejoin();
} else {
  socket.on('connect', doRejoin);
}

// ===== TIMER =====
function startTimer() {
  stopTimer();
  startTime = Date.now();
  timerDisplay.textContent = '00:00';
  timerInterval = setInterval(() => {
    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    const mins = String(Math.floor(elapsed / 60)).padStart(2, '0');
    const secs = String(elapsed % 60).padStart(2, '0');
    timerDisplay.textContent = `${mins}:${secs}`;
  }, 1000);
}

function stopTimer() {
  if (timerInterval) clearInterval(timerInterval);
  timerInterval = null;
}

// ===== RENDERIZAR TABULEIRO =====
function renderBoard(board) {
  boardEl.innerHTML = '';
  board.forEach((card, index) => {
    const cardEl = document.createElement('div');
    cardEl.className = 'card';
    cardEl.dataset.index = index;
    cardEl.innerHTML = `
      <div class="card-face card-front"></div>
      <div class="card-face card-back">
        <img src="/images/${card.image}" alt="carta" loading="lazy">
      </div>
    `;

    if (card.flipped) cardEl.classList.add('flipped');
    if (card.matched) cardEl.classList.add('matched');

    cardEl.addEventListener('click', () => flipCard(index));
    boardEl.appendChild(cardEl);
  });
}

function updateBoard(board) {
  if (!board || !board.length) return;
  // Se tamanho divergir (ex: outro board), re-renderiza para não corromper
  const cards = boardEl.querySelectorAll('.card');
  if (cards.length !== board.length) {
    myBoard = board;
    renderBoard(board);
    return;
  }
  board.forEach((card, index) => {
    const cardEl = cards[index];
    if (!cardEl) return;

    if (card.matched) {
      cardEl.classList.add('flipped');
      cardEl.classList.add('matched');
    } else if (card.flipped) {
      cardEl.classList.add('flipped');
      cardEl.classList.remove('matched');
    } else {
      cardEl.classList.remove('flipped', 'matched');
    }
  });
}

// ===== VIRAR CARTA =====
function flipCard(index) {
  if (!canFlip) return;

  const card = myBoard[index];
  if (!card || card.matched || card.flipped) return;

  // Contar quantas já estão viradas
  const flippedCount = myBoard.filter(c => c.flipped && !c.matched).length;
  if (flippedCount >= 2) return;

  card.flipped = true;
  updateBoard(myBoard);
  canFlip = false;

  if (window.Animations) Animations.flipCard(boardEl.children[index]);
  socket.emit('flip-card', { roomId, playerId: myPlayerId, cardIndex: index });

  // Reabilitar rápido (servidor confere em ~200ms + folga da rede)
  setTimeout(() => { canFlip = true; }, 350);
}

// ===== SOCKET EVENTS =====
socket.on('round-started', ({ round, totalRounds, board, players }) => {
  myBoard = board;
  myPairs = 0;
  totalPairs = board.length / 2;
  canFlip = true;

  roundDisplay.textContent = `${round}/${totalRounds}`;
  pairsDisplay.textContent = `0/${totalPairs}`;

  renderBoard(myBoard);
  if (window.Animations) Animations.boardEntrance(boardEl);
  startTimer();

  if (players) updateScoreboard(players, lastProgress);
  roundModal.classList.add('hidden');
  gameOverModal.classList.add('hidden');
});

// Servidor agora manda board só para o dono (privado) — sem playerId
socket.on('card-flipped', ({ board }) => {
  if (board) {
    myBoard = board;
    // Não re-renderiza tudo aqui para não quebrar animação; o otimista já virou
  }
});

// CORREÇÃO: só atualiza próprio board quando sou o dono; antes sobrescrevia com board do adversário
socket.on('match-found', ({ pairs, board }) => {
  myPairs = pairs;
  pairsDisplay.textContent = `${myPairs}/${totalPairs}`;
  if (board) {
    myBoard = board;
    updateBoard(board);
  }

  const flippedCards = boardEl.querySelectorAll('.card.flipped:not(.matched)');
  // As classes matched já foram aplicadas via updateBoard; anima
  if (window.Animations) Animations.matchSuccess(Array.from(flippedCards));
});

socket.on('no-match', ({ board }) => {
  if (board) {
    // Erro rápido: shake imediato e desvira sem delay extra (servidor já segurou ~200ms)
    if (window.Animations) {
      Animations.matchError(Array.from(boardEl.querySelectorAll('.card.flipped:not(.matched)')));
    }
    myBoard = board;
    updateBoard(board);
  }
});

// Placar ao vivo: quem está na frente (requisito "ver quem termina primeiro")
socket.on('progress-updated', ({ players }) => {
  if (!players) return;
  lastProgress = players;
  const me = players.find(p => p.id === myPlayerId);
  if (me) {
    myPairs = me.pairs;
    totalPairs = me.totalPairs || totalPairs;
    pairsDisplay.textContent = `${myPairs}/${totalPairs}`;
  }
  updateScoreboard(players, players);
});

socket.on('round-ended', ({ winner, roundWins }) => {
  stopTimer();
  canFlip = false;
  const wName = winner ? winner.name : '—';
  roundWinnerText.textContent = `🏆 ${wName} venceu a rodada!`;
  roundScoreText.innerHTML = (roundWins || []).map(p =>
    `<strong>${p.name}</strong>: ${p.wins} ${p.wins === 1 ? 'rodada' : 'rodadas'}`
  ).join(' • ');
  roundModal.classList.remove('hidden');
  if (window.Animations) {
    Animations.modalIn(roundModal);
    Animations.confetti(roundModal);
  }
});

socket.on('game-ended', ({ winner, finalScore }) => {
  stopTimer();
  canFlip = false;
  gameWinnerText.textContent = `${winner.name} venceu! 🎉`;
  finalScoreEl.innerHTML = (finalScore || []).map(p => `
    <div class="final-score-item">
      <span>${p.name}${p.id === myPlayerId ? ' (você)' : ''}</span>
      <strong>${p.wins} ${p.wins === 1 ? 'vitória' : 'vitórias'}</strong>
    </div>
  `).join('');
  roundModal.classList.add('hidden');
  gameOverModal.classList.remove('hidden');
  if (window.Animations) {
    Animations.modalIn(gameOverModal);
    Animations.confetti(gameOverModal);
  }
});

socket.on('rejoined', ({ started }) => {
  // Se reentrei no meio do jogo, o servidor vai mandar round-started com resumed:true
  if (!started) {
    // Sala ainda no lobby mas estou em /game (ex: host ainda não iniciou) — volta para espera
    // Mantém em /game aguardando round-started; não força redirect para evitar loop
  }
});

socket.on('error', ({ message }) => {
  if (message && /Sessão expirada|não está nesta sala/i.test(message)) {
    alert('❌ ' + message);
    window.location.href = '/lobby';
  }
});

function updateScoreboard(players, progress) {
  if (!players || !players.length) return;
  // progress tem {id,name,pairs,totalPairs,finished,wins,connected}
  const progMap = new Map((progress || []).map(p => [p.id, p]));
  scoreList.innerHTML = '';
  // Ordena por pares desc (quem termina primeiro no topo)
  const sorted = [...players].sort((a, b) => {
    const pa = progMap.get(a.id)?.pairs || 0;
    const pb = progMap.get(b.id)?.pairs || 0;
    return pb - pa;
  });
  sorted.forEach(player => {
    const prog = progMap.get(player.id) || {};
    const pairs = prog.pairs ?? player.pairs ?? 0;
    const tp = prog.totalPairs ?? totalPairs;
    const wins = prog.wins ?? player.wins ?? 0;
    const finished = prog.finished ?? player.finished ?? false;
    const offline = (prog.connected === false || player.connected === false) ? ' ⚪' : '';
    const li = document.createElement('li');
    li.className = `score-item ${player.id === myPlayerId ? 'you' : ''}`;
    const pct = tp ? Math.round((pairs / tp) * 100) : 0;
    li.innerHTML = `
      <span class="score-name">${player.name}${player.id === myPlayerId ? ' (você)' : ''}${offline}${finished ? ' ✅' : ''}</span>
      <span class="score-wins" style="display:flex;gap:8px;align-items:center">
        <span style="font-size:.8em;color:var(--text-secondary)">${pairs}/${tp} (${pct}%)</span>
        <span>${wins} 🏆</span>
      </span>
    `;
    scoreList.appendChild(li);
  });
}

backToLobbyBtn.addEventListener('click', () => {
  socket.emit('leave-room', { roomId, playerId: myPlayerId });
  sessionStorage.removeItem('roomId');
  sessionStorage.removeItem('isHost');
  sessionStorage.removeItem('playerId');
  sessionStorage.removeItem('mode');
  window.location.href = '/lobby';
});

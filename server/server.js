const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const GameLogic = require('./gameLogic');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" }
});

const PORT = process.env.PORT || 3000;

// Servir arquivos estáticos
app.use(express.static(path.join(__dirname, '../public')));

// Listar imagens disponíveis
app.get('/api/images', (req, res) => {
  const imagesDir = path.join(__dirname, '../public/images');
  fs.readdir(imagesDir, (err, files) => {
    if (err) {
      return res.status(500).json({ error: 'Erro ao ler imagens' });
    }
    const images = files.filter(file =>
      /\.(webp|jpg|jpeg|png|svg|gif)$/i.test(file)
    );
    res.json(images);
  });
});

// Rotas para páginas
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

app.get('/lobby', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/lobby.html'));
});

app.get('/waiting', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/waiting.html'));
});

app.get('/game', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/game.html'));
});

// ===== SOCKET.IO - Lógica multiplayer =====
// roomId -> { id, hostId (playerId persistente), mode, players, started, currentRound, images }
const rooms = new Map(); // roomId -> room

function generateUniqueRoomCode() {
  let code;
  do {
    code = GameLogic.generateRoomCode();
  } while (rooms.has(code));
  return code;
}

function newPlayerId() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return crypto.randomBytes(16).toString('hex');
}

function normalizeRoomCode(code) {
  return String(code || '').trim().toUpperCase();
}

// ===== Senha da sala (PIN 4 dígitos, opcional) =====
function normalizePin(pin) {
  const s = String(pin ?? '').trim();
  return /^\d{4}$/.test(s) ? s : null;
}

function hashPin(pin, roomId) {
  return crypto.createHash('sha256').update(`${roomId}:${pin}`).digest();
}

function verifyPin(pin, room) {
  if (!room.hasPassword) return true;
  const clean = normalizePin(pin);
  if (!clean || !room.passwordHash) return false;
  try {
    const candidate = hashPin(clean, room.id);
    const expected = Buffer.from(room.passwordHash, 'hex');
    if (candidate.length !== expected.length) return false;
    return crypto.timingSafeEqual(candidate, expected);
  } catch {
    return false;
  }
}

function publicPlayers(room) {
  return room.players.map(p => ({
    id: p.id,
    name: p.name,
    connected: p.connected !== false,
    pairs: p.pairs || 0,
    finished: !!p.finished,
    wins: p.roundWins || 0
  }));
}

function progressPayload(room) {
  const totalPairs = room.images ? room.images.length : 10;
  return {
    players: room.players.map(p => ({
      id: p.id,
      name: p.name,
      pairs: p.pairs || 0,
      totalPairs,
      finished: !!p.finished,
      wins: p.roundWins || 0,
      connected: p.connected !== false
    }))
  };
}

function bindSocketToPlayer(socket, roomId, playerId) {
  socket.join(roomId);
  socket.data.roomId = roomId;
  socket.data.playerId = playerId;
  const room = rooms.get(roomId);
  if (room) {
    const p = room.players.find(x => x.id === playerId);
    if (p) {
      p.socketId = socket.id;
      p.connected = true;
    }
  }
}

function findRoomBySocket(socket) {
  const { roomId, playerId } = socket.data || {};
  if (!roomId) return {};
  const room = rooms.get(roomId);
  if (!room) return {};
  const player = room.players.find(p => p.id === playerId);
  return { room, player, roomId, playerId };
}

io.on('connection', (socket) => {
  console.log(`✅ Jogador conectado: ${socket.id}`);

  // Criar sala (senha opcional: PIN 4 dígitos)
  socket.on('create-room', ({ playerName, mode, password }) => {
    const cleanName = String(playerName || '').trim().slice(0, 15);
    if (!cleanName || cleanName.length < 2) {
      return socket.emit('error', { message: 'Nome inválido' });
    }
    // PIN opcional: se enviado, deve ser exatamente 4 dígitos
    let pin = null;
    if (password !== undefined && password !== null && String(password).trim() !== '') {
      pin = normalizePin(password);
      if (!pin) {
        return socket.emit('error', { message: 'Senha deve ter 4 dígitos (ex: 1234)' });
      }
    }
    const roomId = generateUniqueRoomCode();
    const playerId = newPlayerId();
    rooms.set(roomId, {
      id: roomId,
      hostId: playerId,
      mode: mode === 'best-of-3' ? 'best-of-3' : 'single',
      hasPassword: !!pin,
      passwordHash: pin ? hashPin(pin, roomId).toString('hex') : null,
      players: [{
        id: playerId,
        socketId: socket.id,
        name: cleanName,
        board: [],
        pairs: 0,
        finished: false,
        finishTime: null,
        roundWins: 0,
        locked: false,
        connected: true
      }],
      started: false,
      currentRound: 0,
      images: []
    });
    bindSocketToPlayer(socket, roomId, playerId);
    const room = rooms.get(roomId);
    socket.emit('room-created', {
      roomId,
      mode: room.mode,
      playerId,
      players: publicPlayers(room),
      hostId: room.hostId,
      hasPassword: room.hasPassword,
      isHost: true
    });
    console.log(`🎮 Sala criada: ${roomId} por ${cleanName}${room.hasPassword ? ' 🔒' : ''}`);
  });

  // Entrar em sala existente (senha obrigatória se a sala tem cadeado)
  socket.on('join-room', ({ roomId, playerName, playerId: existingPlayerId, password }) => {
    const code = normalizeRoomCode(roomId);
    const room = rooms.get(code);
    if (!room) {
      return socket.emit('error', { message: 'Sala não encontrada' });
    }
    if (room.started) {
      return socket.emit('error', { message: 'Jogo já iniciado' });
    }

    // Rejoin com mesmo playerId (ex: refresh): só reativa, sem pedir senha de novo
    if (existingPlayerId) {
      const existing = room.players.find(p => p.id === existingPlayerId);
      if (existing) {
        bindSocketToPlayer(socket, code, existing.id);
        socket.emit('joined-room', {
          roomId: code,
          mode: room.mode,
          playerId: existing.id,
          players: publicPlayers(room),
          hostId: room.hostId,
          hasPassword: !!room.hasPassword,
          isHost: room.hostId === existing.id
        });
        io.to(code).emit('player-joined', {
          players: publicPlayers(room),
          hostId: room.hostId
        });
        return;
      }
    }

    if (room.players.length >= 4) {
      return socket.emit('error', { message: 'Sala cheia (máx 4)' });
    }

    // Senha antes de validar o nome (não vaza lista de nomes sem o PIN)
    if (room.hasPassword && !verifyPin(password, room)) {
      return socket.emit('error', { message: 'Senha incorreta' });
    }

    const cleanName = String(playerName || '').trim().slice(0, 15);
    if (!cleanName || cleanName.length < 2) {
      return socket.emit('error', { message: 'Nome inválido' });
    }
    // Evita nome duplicado na sala
    if (room.players.some(p => p.name.toLowerCase() === cleanName.toLowerCase())) {
      return socket.emit('error', { message: 'Nome já usado nesta sala' });
    }

    const playerId = newPlayerId();
    room.players.push({
      id: playerId,
      socketId: socket.id,
      name: cleanName,
      board: [],
      pairs: 0,
      finished: false,
      finishTime: null,
      roundWins: 0,
      locked: false,
      connected: true
    });

    bindSocketToPlayer(socket, code, playerId);

    // Confirmação privada para quem entrou (corrige bug: antes nunca redirecionava)
    socket.emit('joined-room', {
      roomId: code,
      mode: room.mode,
      playerId,
      players: publicPlayers(room),
      hostId: room.hostId,
      hasPassword: !!room.hasPassword,
      isHost: false
    });

    // Notificar todos na sala
    io.to(code).emit('player-joined', {
      players: publicPlayers(room),
      hostId: room.hostId
    });

    console.log(`👥 ${cleanName} entrou na sala ${code}`);
  });

  // Re-entrar após troca de página (waiting/game têm socket.id novo)
  // Corrige bug crítico: socket.id muda a cada HTML, então rebind via playerId persistente.
  socket.on('rejoin-room', ({ roomId, playerId }) => {
    const code = normalizeRoomCode(roomId);
    const room = rooms.get(code);
    if (!room || !playerId) {
      return socket.emit('error', { message: 'Sessão expirada, volte ao lobby' });
    }
    const player = room.players.find(p => p.id === playerId);
    if (!player) {
      return socket.emit('error', { message: 'Jogador não está nesta sala' });
    }
    bindSocketToPlayer(socket, code, playerId);

    socket.emit('rejoined', {
      roomId: code,
      mode: room.mode,
      playerId,
      players: publicPlayers(room),
      hostId: room.hostId,
      hasPassword: !!room.hasPassword,
      isHost: room.hostId === playerId,
      started: room.started,
      currentRound: room.currentRound
    });

    // Atualiza lista para os outros (reconectou)
    io.to(code).emit('player-joined', {
      players: publicPlayers(room),
      hostId: room.hostId
    });

    // Se jogo já começou, manda estado privado (board só do dono)
    if (room.started && player.board && player.board.length) {
      const totalRounds = room.mode === 'best-of-3' ? 3 : 1;
      socket.emit('round-started', {
        round: room.currentRound,
        totalRounds,
        board: player.board,
        players: publicPlayers(room),
        hostId: room.hostId,
        resumed: true
      });
      // Manda progresso atual para todos se atualizarem placar
      io.to(code).emit('progress-updated', progressPayload(room));
    }
  });

  // Sair explicitamente da sala
  socket.on('leave-room', ({ roomId, playerId }) => {
    const code = normalizeRoomCode(roomId);
    const room = rooms.get(code);
    if (!room) return;
    const pid = playerId || (socket.data || {}).playerId;
    const idx = room.players.findIndex(p => p.id === pid);
    if (idx === -1) return;
    const [left] = room.players.splice(idx, 1);
    socket.leave(code);
    if (socket.data && socket.data.roomId === code) {
      socket.data.roomId = null;
      socket.data.playerId = null;
    }
    if (room.players.length === 0) {
      rooms.delete(code);
      console.log(`🗑️ Sala ${code} removida (vazia)`);
      return;
    }
    if (room.hostId === pid) {
      // Migra host para primeiro conectado
      const next = room.players.find(p => p.connected !== false) || room.players[0];
      room.hostId = next.id;
      io.to(code).emit('host-changed', {
        players: publicPlayers(room),
        hostId: room.hostId
      });
    }
    io.to(code).emit('player-left', {
      players: publicPlayers(room),
      hostId: room.hostId,
      leftPlayerId: pid,
      leftName: left ? left.name : ''
    });
  });

  // Listar salas disponíveis
  socket.on('list-rooms', () => {
    const availableRooms = [];
    rooms.forEach((room, id) => {
      if (!room.started && room.players.length < 4) {
        availableRooms.push({
          id,
          playerCount: room.players.length,
          mode: room.mode,
          hasPassword: !!room.hasPassword
        });
      }
    });
    socket.emit('rooms-list', availableRooms);
  });

  // Iniciar jogo (apenas host, via playerId persistente)
  socket.on('start-game', ({ roomId, playerId }) => {
    const code = normalizeRoomCode(roomId);
    const room = rooms.get(code);
    if (!room) return socket.emit('error', { message: 'Sala não encontrada' });
    const pid = playerId || (socket.data || {}).playerId;
    if (room.hostId !== pid) {
      return socket.emit('error', { message: 'Apenas o host pode iniciar' });
    }
    const connectedCount = room.players.filter(p => p.connected !== false).length;
    if (connectedCount < 1) {
      return socket.emit('error', { message: 'Precisa de pelo menos 1 jogador' });
    }
    startRound(room, 1);
  });

  // Virar carta (autoritativo, com lock anti-race)
  socket.on('flip-card', ({ roomId, playerId, cardIndex }) => {
    const code = normalizeRoomCode(roomId);
    const room = rooms.get(code);
    if (!room || !room.started) return;

    const pid = playerId || (socket.data || {}).playerId;
    const player = room.players.find(p => p.id === pid);
    if (!player || player.finished) return;
    if (player.locked) return;

    const card = player.board[cardIndex];
    if (!card || card.matched || card.flipped) return;

    // Conta viradas antes de virar
    const flippedBefore = player.board.filter(c => c.flipped && !c.matched).length;
    if (flippedBefore >= 2) return;

    card.flipped = true;

    // Confirmação privada: só o dono recebe o board (corrige vazamento)
    const ownerSocketId = player.socketId;
    if (ownerSocketId) {
      io.to(ownerSocketId).emit('card-flipped', { board: player.board });
    }

    const flippedCards = player.board.filter(c => c.flipped && !c.matched);

    // Se 2 cartas viradas, trava e agenda verificação (ritmo rápido: ~200ms)
    if (flippedCards.length === 2) {
      player.locked = true;
      setTimeout(() => checkMatch(room, player.id, code), 200);
    }
  });

  // Desconexão: marca offline mas mantém slot para rejoin (refresh de página)
  socket.on('disconnect', () => {
    console.log(`❌ Socket desconectou: ${socket.id}`);
    const { roomId, playerId } = socket.data || {};
    if (!roomId || !playerId) return;
    const room = rooms.get(roomId);
    if (!room) return;
    const player = room.players.find(p => p.id === playerId);
    if (!player) return;
    // Só marca offline se este socket era o atual do player
    if (player.socketId !== socket.id) return;
    player.connected = false;
    player.socketId = null;

    if (!room.started) {
      // No lobby, avisa os outros mas mantém vaga por um tempo para refresh
      io.to(roomId).emit('player-left', {
        players: publicPlayers(room),
        hostId: room.hostId,
        leftPlayerId: playerId,
        temporary: true
      });
      // Migra host se host caiu e há outro conectado
      if (room.hostId === playerId) {
        const next = room.players.find(p => p.connected !== false);
        if (next) {
          room.hostId = next.id;
          io.to(roomId).emit('host-changed', {
            players: publicPlayers(room),
            hostId: room.hostId
          });
        }
      }
      // Limpeza: se todos offline por 60s, apaga sala
      setTimeout(() => {
        const r = rooms.get(roomId);
        if (!r) return;
        if (r.players.every(p => p.connected === false) && !r.started) {
          rooms.delete(roomId);
          console.log(`🗑️ Sala ${roomId} removida (todos offline)`);
        }
      }, 60000);
    } else {
      // Em jogo, mantém board e avisa progresso (para placar mostrar offline)
      io.to(roomId).emit('progress-updated', progressPayload(room));
    }
  });
});

// ===== FUNÇÕES DO JOGO =====
function startRound(room, roundNumber) {
  room.currentRound = roundNumber;
  room.started = true;
  try {
    room.images = GameLogic.getImages();
  } catch (e) {
    console.error('Erro ao ler imagens:', e);
    room.images = [];
  }

  room.players.forEach(player => {
    player.board = GameLogic.generateBoard(room.images);
    player.pairs = 0;
    player.finished = false;
    player.finishTime = null;
    player.locked = false;
  });

  const totalRounds = room.mode === 'best-of-3' ? 3 : 1;

  // Enviar estado inicial privado para cada jogador (board diferente)
  room.players.forEach(player => {
    if (player.socketId) {
      io.to(player.socketId).emit('round-started', {
        round: roundNumber,
        totalRounds,
        board: player.board,
        players: publicPlayers(room),
        hostId: room.hostId
      });
    }
  });
  // Progresso inicial para placar ao vivo
  io.to(room.id).emit('progress-updated', progressPayload(room));

  console.log(`🎯 Rodada ${roundNumber} iniciada na sala ${room.id}`);
}

function checkMatch(room, playerId, roomId) {
  const player = room.players.find(p => p.id === playerId);
  if (!player) return;

  const flipped = player.board.filter(c => c.flipped && !c.matched);

  // Se não há exatamente 2 (race/refresh), destrava e sincroniza dono
  if (flipped.length !== 2) {
    player.locked = false;
    if (player.socketId) {
      io.to(player.socketId).emit('no-match', { board: player.board });
    }
    return;
  }

  const isMatch = flipped[0].image === flipped[1].image;

  if (isMatch) {
    flipped[0].matched = true;
    flipped[1].matched = true;
    player.pairs++;
    player.locked = false;

    if (player.socketId) {
      io.to(player.socketId).emit('match-found', {
        pairs: player.pairs,
        board: player.board
      });
    }

    // Progresso ao vivo para todos (sem vazar board)
    io.to(roomId).emit('progress-updated', progressPayload(room));

    // Vitória individual (terminou seu board)!
    if (player.pairs === room.images.length) {
      player.finished = true;
      player.finishTime = Date.now();
      handleRoundEnd(room, roomId);
    }
  } else {
    flipped[0].flipped = false;
    flipped[1].flipped = false;
    player.locked = false;

    if (player.socketId) {
      io.to(player.socketId).emit('no-match', {
        board: player.board
      });
    }
  }
}

function handleRoundEnd(room, roomId) {
  // Ordenar por quem terminou primeiro
  const finished = room.players
    .filter(p => p.finished)
    .sort((a, b) => a.finishTime - b.finishTime);

  if (finished.length === 0) return;
  const winner = finished[0];
  winner.roundWins = (winner.roundWins || 0) + 1;

  io.to(roomId).emit('round-ended', {
    winner: { name: winner.name, id: winner.id },
    roundWins: room.players.map(p => ({ id: p.id, name: p.name, wins: p.roundWins || 0 })),
    round: room.currentRound
  });
  io.to(roomId).emit('progress-updated', progressPayload(room));

  const needsMoreRounds = room.mode === 'best-of-3'
    && room.currentRound < 3
    && !room.players.some(p => (p.roundWins || 0) >= 2); // encerra cedo em 2x0 / 2x1

  // Modo melhor de 3: continuar se ninguém ganhou 2 ainda e há rounds restantes
  if (needsMoreRounds) {
    setTimeout(() => {
      // Só continua se sala ainda existe e jogo não foi resetado
      if (rooms.get(roomId) === room) {
        startRound(room, room.currentRound + 1);
      }
    }, 3000);
  } else {
    // Fim de jogo
    setTimeout(() => {
      if (rooms.get(roomId) !== room) return;
      const gameWinner = room.players.reduce((prev, curr) =>
        (curr.roundWins || 0) > (prev.roundWins || 0) ? curr : prev
      );
      io.to(roomId).emit('game-ended', {
        winner: { name: gameWinner.name, id: gameWinner.id },
        finalScore: room.players.map(p => ({ id: p.id, name: p.name, wins: p.roundWins || 0 }))
      });
      room.started = false;
    }, 2000);
  }
}

server.listen(PORT, () => {
  console.log(`🎮 Servidor rodando em http://localhost:${PORT}`);
});

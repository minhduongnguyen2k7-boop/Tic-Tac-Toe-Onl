// server.js
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { nanoid } = require('nanoid');
const {
  createEmptyBoard,
  checkBoard,
  botTurn
} = require('./gamelogic');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

app.use(express.static('client'));

// Rooms: code -> state
// status: waiting|playing|finished
// mode: 'pvp' or 'bot'
const rooms = {};

io.on('connection', (socket) => {
  // Create room (pvp or bot)
  socket.on('createRoom', ({ boxes, mode }) => {
    const n = Math.max(5, Number(boxes) || 10);
    const roomCode = nanoid(6).toUpperCase();
    const roomMode = mode === 'bot' ? 'bot' : mode === 'local' ? 'local' : 'pvp';

    rooms[roomCode] = {
   players: [socket.id],
   boxes: n,
   board: createEmptyBoard(n),
   turn: 1,
   status: roomMode === 'pvp' ? 'waiting' : 'playing',
   count: 0,
   mode: roomMode
  };

    socket.join(roomCode);
    socket.emit('roomCreated', { roomCode, boxes: n, mode: roomMode });

    // If bot mode, start immediately (no second player)
    if (roomMode === 'bot' || roomMode === 'local') {
  rooms[roomCode].status = 'playing';
  io.to(roomCode).emit('gameStarted', {
    roomCode,
    boxes: n,
    turn: 1,
    players: roomMode === 'bot' ? [socket.id, 'BOT'] : [socket.id],
    board: rooms[roomCode].board,
    mode: roomMode
  });
}
});

  // Join room (only for pvp)
  socket.on('joinRoom', ({ roomCode }) => {
    const code = (roomCode || '').toUpperCase();
    const room = rooms[code];
    if (!room) {
      socket.emit('errorMessage', { message: 'Room not found' });
      return;
    }
    if (room.mode === 'bot') {
      socket.emit('errorMessage', { message: 'This room is bot mode. Create a PvP room.' });
      return;
    }
    if (room.players.length >= 2) {
      socket.emit('errorMessage', { message: 'Room is full' });
      return;
    }

    room.players.push(socket.id);
    socket.join(code);
    room.status = 'playing';

    io.to(code).emit('gameStarted', {
      roomCode: code,
      boxes: room.boxes,
      turn: room.turn,
      players: room.players,
      board: room.board,
      mode: room.mode
    });
  });

  // Handle a move
  socket.on('makeMove', ({ roomCode, row, col }) => {
    const code = (roomCode || '').toUpperCase();
    const room = rooms[code];
    if (!room || room.status !== 'playing') return;

    const n = room.boxes;
    if (row < 0 || row >= n || col < 0 || col >= n) {
      socket.emit('errorMessage', { message: 'Out of bounds' });
      return;
    }
    if (room.board[row][col] !== 0) {
      socket.emit('errorMessage', { message: 'Cell occupied' });
      return;
    }

    // Determine who is making the move
    const isBotMode = room.mode === 'bot';
    let playerNumber = 1;

if (room.mode === 'pvp') {
  const idx = room.players.indexOf(socket.id);
  if (idx === -1) return;
  playerNumber = idx + 1;
  if (playerNumber !== room.turn) {
    socket.emit('errorMessage', { message: 'Not your turn' });
    return;
  }
} else if (room.mode === 'bot') {
  // In bot mode, only player 1 is human
  if (socket.id !== room.players[0]) {
    socket.emit('errorMessage', { message: 'Not your game' });
    return;
  }
  if (room.turn !== 1) {
    socket.emit('errorMessage', { message: 'Wait for your turn' });
    return;
  }
  playerNumber = 1;
} else if (room.mode === 'local') {
  // Local mode: both players share device, alternate turns
  playerNumber = room.turn;
}

    // Apply human move
    room.board[row][col] = playerNumber;
    room.count++;

    io.to(code).emit('boardUpdated', {
      board: room.board,
      lastMove: { row, col, player: playerNumber }
    });

    // Win/draw after human move
    const resultHuman = checkBoard(playerNumber, room.board, room.count);
    if (resultHuman === 1) {
      room.status = 'finished';
      io.to(code).emit('gameFinished', { winner: playerNumber });
      return;
    }
    if (resultHuman === 2) {
      room.status = 'finished';
      io.to(code).emit('gameFinished', { winner: 0 });
      return;
    }

    if (room.mode === 'pvp' || room.mode === 'local') {
   // PvP or Local: switch turn
   room.turn = room.turn === 1 ? 2 : 1;
   io.to(code).emit('turnChanged', { turn: room.turn });
   return;   // stop here, don’t fall into bot logic
}


    // Bot mode: bot responds
    room.turn = 2;
    const botRes = botTurn(room.board); // writes board cell = 2
    if (botRes && botRes.placed) {
      room.count++;
      io.to(code).emit('boardUpdated', {
        board: room.board,
        lastMove: { row: botRes.row, col: botRes.col, player: 2 }
      });

      const resultBot = checkBoard(2, room.board, room.count);
      if (resultBot === 1) {
        room.status = 'finished';
        io.to(code).emit('gameFinished', { winner: 2 });
        return;
      }
      if (resultBot === 2) {
        room.status = 'finished';
        io.to(code).emit('gameFinished', { winner: 0 });
        return;
      }
    }

    // Back to human
    room.turn = 1;
    io.to(code).emit('turnChanged', { turn: room.turn });
  });

  // Rematch
  socket.on('requestRematch', ({ roomCode }) => {
    const code = (roomCode || '').toUpperCase();
    const room = rooms[code];
    if (!room) return;
    if (room.mode === 'pvp' && room.players.length < 2) return;

    room.board = createEmptyBoard(room.boxes);
    room.turn = 1;
    room.status = 'playing';
    room.count = 0;

    io.to(code).emit('rematchStarted', {
      board: room.board,
      turn: room.turn
    });
  });

  // Disconnect cleanup
  socket.on('disconnect', () => {
    for (const [code, room] of Object.entries(rooms)) {
      const idx = room.players.indexOf(socket.id);
      if (idx !== -1) {
        room.players.splice(idx, 1);
        io.to(code).emit('opponentLeft');
        room.status = 'finished';
      }
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
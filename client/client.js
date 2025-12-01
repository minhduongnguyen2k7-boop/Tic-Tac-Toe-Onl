// public/client.js
const socket = io();

let myPlayerNumber = null;
let roomCode = null;
let boxes = 10;
let turn = 1;
let board = [];
let mode = 'pvp'; // 'pvp' or 'bot'

const boxesInput = document.getElementById('boxes');
const createLocalBtn = document.getElementById('createLocalBtn');
const createPvpBtn = document.getElementById('createPvpBtn');
const createBotBtn = document.getElementById('createBotBtn');
const joinBtn = document.getElementById('joinBtn');
const roomCodeInput = document.getElementById('roomCode');
const statusEl = document.getElementById('status');
const boardEl = document.getElementById('board');
const rematchBtn = document.getElementById('rematchBtn');

function setStatus(text) { statusEl.textContent = text; }

function renderBoard() {
  boardEl.innerHTML = '';
  boardEl.style.gridTemplateColumns = `repeat(${boxes}, 36px)`;
  board.forEach((row, r) => {
    row.forEach((cell, c) => {
      const div = document.createElement('div');
      div.className = 'cell' + (cell === 1 ? ' p1' : cell === 2 ? ' p2' : '');
      div.textContent = cell === 0 ? '' : cell === 1 ? 'X' : 'O';
      console.log(`Cell [${r},${c}] =`, div.textContent);
      div.addEventListener('click', () => onCellClick(r, c));
      boardEl.appendChild(div);
    });
  });
}

function onCellClick(r, c) {
  if (!roomCode) return;
  if (board[r][c] !== 0) { setStatus('Cell occupied'); return; }

  if (mode === 'pvp') {
    if (myPlayerNumber !== turn) { setStatus('Wait for your turn'); return; }
  } else if (mode === 'bot') {
    if (turn !== 1) { setStatus('Wait for your turn'); return; }
  } else if (mode === 'local') {
    // In local mode, allow whichever player's turn it is
    // No need to check socket.id
  }

  socket.emit('makeMove', { roomCode, row: r, col: c });
}

createLocalBtn.addEventListener('click', () => {
  boxes = Math.max(5, Number(boxesInput.value) || 10);
  socket.emit('createRoom', { boxes, mode: 'local' });
});

createPvpBtn.addEventListener('click', () => {
  boxes = Math.max(5, Number(boxesInput.value) || 10);
  socket.emit('createRoom', { boxes, mode: 'pvp' });
});
createBotBtn.addEventListener('click', () => {
  boxes = Math.max(5, Number(boxesInput.value) || 10);
  socket.emit('createRoom', { boxes, mode: 'bot' });
});

joinBtn.addEventListener('click', () => {
  const code = roomCodeInput.value.trim();
  if (!code) return;
  socket.emit('joinRoom', { roomCode: code });
});

rematchBtn.addEventListener('click', () => {
  if (roomCode) socket.emit('requestRematch', { roomCode });
});

// Socket events
socket.on('roomCreated', (data) => {
  roomCode = data.roomCode;
  boxes = data.boxes;
  mode = data.mode;
  setStatus(`Room ${mode === 'bot' ? 'BOT' : 'PVP'} created. Code: ${roomCode}. ${mode === 'bot' ? 'Game starts now.' : 'Waiting for opponent...'}`);
});

  socket.on('gameStarted', (data) => {
  roomCode = data.roomCode;
  boxes = data.boxes;
  board = data.board;
  turn = data.turn;
  mode = data.mode;

  if (mode === 'pvp') {
    const me = socket.id;
    const idx = data.players.indexOf(me);
    myPlayerNumber = idx + 1;
    setStatus(`PvP game ${roomCode}. You are Player ${myPlayerNumber}. Turn: Player ${turn}`);
  } else if (mode === 'bot') {
    myPlayerNumber = 1;
    setStatus(`Bot game ${roomCode}. You are Player 1. Turn: Player ${turn}`);
  } else if (mode === 'local') {
    myPlayerNumber = null; // both players share device
    setStatus(`Local game ${roomCode}. Turn: Player ${turn}`);
  }

  renderBoard();
  rematchBtn.style.display = 'none';
});

socket.on('turnChanged', ({ turn: t }) => {
  turn = t;
  setStatus(`Turn: Player ${turn}`);
});

socket.on('gameFinished', ({ winner }) => {
  if (winner === 0) setStatus('Game over: Draw');
  else setStatus(`Game over: Player ${winner} wins`);
  rematchBtn.style.display = 'inline-block';
});

socket.on('rematchStarted', ({ board: b, turn: t }) => {
  board = b; turn = t;
  setStatus(`Rematch started. Turn: Player ${turn}`);
  renderBoard();
  rematchBtn.style.display = 'none';
});

socket.on('opponentLeft', () => {
  setStatus('Opponent left. Game ended.');
  rematchBtn.style.display = 'none';
});

socket.on('errorMessage', ({ message }) => setStatus(`Error: ${message}`));
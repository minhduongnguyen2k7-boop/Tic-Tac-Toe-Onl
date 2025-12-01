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

const canvas = document.getElementById('boardCanvas');
const ctx = canvas.getContext('2d');
let cellSize = 40; // pixels per cell

function renderBoard() {
  const n = board.length;
  const maxCanvasWidth = window.innerWidth * 0.9;
  cellSize = Math.floor(maxCanvasWidth / board.length);
  canvas.width = n * cellSize;
  canvas.height = n * cellSize;
  canvas.style.width = '100%';
  canvas.style.height = 'auto';

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      // draw grid
      ctx.strokeStyle = '#d1d5db'; // gray-300
      ctx.strokeRect(c * cellSize, r * cellSize, cellSize, cellSize);

      // draw pieces
      if (board[r][c] === 1) {
        ctx.fillStyle = '#1e3a8a'; // blue-800
        ctx.font = `${cellSize * 0.6}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('X', c * cellSize + cellSize/2, r * cellSize + cellSize/2);
      } else if (board[r][c] === 2) {
        ctx.fillStyle = '#166534'; // green-800
        ctx.font = `${cellSize * 0.6}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('O', c * cellSize + cellSize/2, r * cellSize + cellSize/2);
      }
    }
  }
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
  console.log('Sending move', r, c, 'room', roomCode);
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

canvas.addEventListener('click', (e) => {
  const rect = canvas.getBoundingClientRect();

  // Get click position relative to displayed size
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;

  // Scale back to internal resolution
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;

  const col = Math.floor(x * scaleX / cellSize);
  const row = Math.floor(y * scaleY / cellSize);

  onCellClick(row, col);
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

socket.on('boardUpdated', ({ board: b }) => {
  board = b;
  renderBoard();
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
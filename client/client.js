// public/client.js
const socket = io();

let zoom = 1;        // current zoom factor
let offsetX = 0;     // pan offset X
let offsetY = 0;     // pan offset Y
let isDragging = false;
let dragStartX = 0;
let dragStartY = 0;
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
  window.requestAnimationFrame(() => {
    const n = board.length;
    canvas.width = window.innerWidth * 0.9;
    canvas.height = window.innerHeight * 0.8;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        const x = (c * cellSize + offsetX) * zoom;
        const y = (r * cellSize + offsetY) * zoom;
        const size = cellSize * zoom;

        ctx.strokeStyle = '#d1d5db';
        ctx.strokeRect(x, y, size, size);

        if (board[r][c] === 1 || board[r][c] === 2) {
          ctx.fillStyle = board[r][c] === 1 ? '#1e3a8a' : '#166534';
          ctx.font = `${Math.max(size * 0.6, 12)}px sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(board[r][c] === 1 ? 'X' : 'O', x + size / 2, y + size / 2);
        }
      }
    }
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

  // 🔥 Correct for zoom and pan
  const trueX = x * scaleX / zoom - offsetX;
  const trueY = y * scaleY / zoom - offsetY;

  const col = Math.floor(trueX / cellSize);
  const row = Math.floor(trueY / cellSize);

  onCellClick(row, col);
});

canvas.addEventListener('wheel', (e) => {
  e.preventDefault();

  const zoomStep = 0.1;
  const boardPixelSize = board.length * cellSize;
  const minZoomX = canvas.width / boardPixelSize;
  const minZoomY = canvas.height / boardPixelSize;
  const minZoom = Math.max(minZoomX, minZoomY); // allow full board to fit
  const maxZoom = 3;

  if (e.deltaY < 0) {
    zoom = Math.min(zoom + zoomStep, maxZoom);   // scroll up → zoom in
  } else {
    zoom = Math.max(zoom - zoomStep, minZoom);   // scroll down → zoom out
  }

  renderBoard();
});

canvas.addEventListener('mousemove', (e) => {
  if (isDragging) {
    const dx = (e.clientX - dragStartX) / zoom;
    const dy = (e.clientY - dragStartY) / zoom;

    offsetX += dx;
    offsetY += dy;   // ✅ vertical pan added

    dragStartX = e.clientX;
    dragStartY = e.clientY;

    renderBoard();
  }
});
rematchBtn.addEventListener('click', () => {
  if (roomCode) socket.emit('requestRematch', { roomCode });
});

canvas.addEventListener('mousedown', (e) => {
  isDragging = true;
  dragStartX = e.clientX;
  dragStartY = e.clientY;
});

canvas.addEventListener('mouseup', () => {
  isDragging = false;
});

canvas.addEventListener('mouseleave', () => {
  isDragging = false;
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
  // Auto zoom so 5x5 cells fill canvas width
board = createBoard(size);
// Zoom so 5x5 cells fill canvas width
zoom = canvas.width / (cellSize * 5);
// Center the view on the middle of the board
const centerCol = board.length / 2 - 2.5;
const centerRow = board.length / 2 - 2.5;
offsetX = -centerCol * cellSize;
offsetY = -centerRow * cellSize;

renderBoard();
  rematchBtn.style.display = 'none';
});

socket.on('turnChanged', ({ turn: t }) => {
  turn = t;
  setStatus(`Turn: Player ${turn}`);
});

socket.on('boardUpdated', ({ board: b }) => {
  board = b;
  board = createBoard(size);

// Zoom so 5x5 cells fill canvas width
zoom = canvas.width / (cellSize * 5);

// Center the view on the middle of the board
const centerCol = board.length / 2 - 2.5;
const centerRow = board.length / 2 - 2.5;
offsetX = -centerCol * cellSize;
offsetY = -centerRow * cellSize;
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
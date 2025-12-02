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
const canvas = document.getElementById('boardCanvas');
const ctx = canvas.getContext('2d');
let scale = 1;
let translateX = 0;
let translateY = 0;
let isDragging = false;
let dragStartX = 0;
let dragStartY = 0;
const DRAG_THRESHOLD = 6; // pixels
let dragMoved = false;
let lastDragTime = 0;
const DRAG_SUPPRESS_MS = 200; // suppress clicks for 200ms after drag

function updateTransform() {
  ctx.setTransform(scale, 0, 0, scale, translateX, translateY);
  renderBoard(); // redraw with new transform
}

function setStatus(text) { statusEl.textContent = text; }

function renderBoard() {
  // Set canvas size based on board dimensions
  const cellSize = 36; // adjust as needed
  canvas.width = boxes * cellSize;
  canvas.height = boxes * cellSize;

  // Clear canvas
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Draw grid + pieces
  for (let r = 0; r < boxes; r++) {
    for (let c = 0; c < boxes; c++) {
      const x = c * cellSize;
      const y = r * cellSize;

      // Grid cell border
      ctx.strokeStyle = '#d1d5db';
      ctx.strokeRect(x, y, cellSize, cellSize);

      // Draw X or O
      if (board[r][c] === 1) {
        ctx.fillStyle = '#1e3a8a';
        ctx.font = `${cellSize * 0.6}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('X', x + cellSize / 2, y + cellSize / 2);
      } else if (board[r][c] === 2) {
        ctx.fillStyle = '#166534';
        ctx.font = `${cellSize * 0.6}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('O', x + cellSize / 2, y + cellSize / 2);
      }
    }
  }
}

canvas.addEventListener('click', (e) => {
  // Suppress clicks if dragging or just finished a drag
  if (isDragging) return;
  if (Date.now() - lastDragTime < DRAG_SUPPRESS_MS) return;

  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;

  // Reverse transform: account for pan + zoom
  const transformedX = (x - translateX) / scale;
  const transformedY = (y - translateY) / scale;

  const cellSize = 36; // must match renderBoard
  const col = Math.floor(transformedX / cellSize);
  const row = Math.floor(transformedY / cellSize);

  if (row < 0 || row >= boxes || col < 0 || col >= boxes) return;

  onCellClick(row, col);
});

canvas.addEventListener('mousedown', (e) => {
  isDragging = true;
  dragMoved = false;
  dragStartX = e.clientX - translateX;
  dragStartY = e.clientY - translateY;
});

document.addEventListener('mousemove', (e) => {
  if (!isDragging) return;

  const dx = e.clientX - (dragStartX + translateX);
  const dy = e.clientY - (dragStartY + translateY);

  if (!dragMoved && (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD)) {
    dragMoved = true;
  }

  translateX = e.clientX - dragStartX;
  translateY = e.clientY - dragStartY;
  updateTransform();
});

document.addEventListener('mouseup', () => {
  if (isDragging && dragMoved) {
    lastDragTime = Date.now();
  }
  isDragging = false;
});

canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  const zoomFactor = 0.1;
  if (e.deltaY < 0) {
    scale += zoomFactor; // zoom in
  } else {
    scale = Math.max(0.2, scale - zoomFactor); // zoom out
  }
  updateTransform();
});

function onCellClick(r, c) {
  // Suppress taps if dragging or right after a drag
if (isDragging) return;
if (Date.now() - lastDragTime < DRAG_SUPPRESS_MS) return;
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

socket.on('boardUpdated', ({ board: b, lastMove }) => {
  board = b;

  if (lastMove) {
    const { row, col, player } = lastMove;
    const cellEl = document.querySelector(`[data-row="${row}"][data-col="${col}"]`);

    if (cellEl) {
      cellEl.textContent = player === 1 ? 'X' : 'O';
      cellEl.classList.add(player === 1 ? 'p1' : 'p2');
    }
  }
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
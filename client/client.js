     // public/client.js
const socket = io();


let myPlayerNumber = null;
let roomCode = null;
let boxes = 10;
let turn = 1;
let board = [];
let mode = 'pvp'; // 'pvp' or 'bot'


let isDragging = false;
let dragStartX = 0;
let dragStartY = 0;
let translateX = 0;
let translateY = 0;
let scale = 1;


// Drag detection
const DRAG_THRESHOLD = 6; // pixels
let dragMoved = false;
let lastDragTime = 0;
const DRAG_SUPPRESS_MS = 200; // suppress taps for this long after a drag


const boardWrapper = document.getElementById('boardWrapper');


function updateTransform() {
  boardWrapper.style.transform = `translate(${translateX}px, ${translateY}px) scale(${scale})`;
  boardWrapper.style.transformOrigin = '0 0';
}


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
  // Use a fragment for faster DOM building
  const fragment = document.createDocumentFragment();


  boardEl.style.gridTemplateColumns = `repeat(${boxes}, 36px)`;


  board.forEach((row, r) => {
    row.forEach((cell, c) => {
      const div = document.createElement('div');
      div.dataset.row = r;
      div.dataset.col = c;


      div.className = 'cell' + (cell === 1 ? ' p1' : cell === 2 ? ' p2' : '');
      div.textContent = cell === 0 ? '' : cell === 1 ? 'X' : 'O';


      div.addEventListener('click', () => onCellClick(r, c));
      fragment.appendChild(div);
    });
  });


  // Clear once, then append all cells
  boardEl.innerHTML = '';
  boardEl.appendChild(fragment);
}


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


boardWrapper.addEventListener('mousedown', (e) => {
  isDragging = true;
  dragMoved = false;
  dragStartX = e.clientX - translateX;
  dragStartY = e.clientY - translateY;
});


document.addEventListener('mousemove', (e) => {
  if (!isDragging) return;


  const dx = e.clientX - (dragStartX + translateX);
  const dy = e.clientY - (dragStartY + translateY);


  // If movement exceeds threshold, consider it a drag
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


boardWrapper.addEventListener('touchstart', (e) => {
  if (e.touches.length !== 1) return;
  e.preventDefault(); // avoid synthetic click
  const t = e.touches[0];
  isDragging = true;
  dragMoved = false;
  dragStartX = t.clientX - translateX;
  dragStartY = t.clientY - translateY;
}, { passive: false });


boardWrapper.addEventListener('touchmove', (e) => {
  if (e.touches.length !== 1) return;
  e.preventDefault();
  const t = e.touches[0];


  const dx = t.clientX - (dragStartX + translateX);
  const dy = t.clientY - (dragStartY + translateY);
  if (!dragMoved && (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD)) {
    dragMoved = true;
  }


  translateX = t.clientX - dragStartX;
  translateY = t.clientY - dragStartY;
  updateTransform();
}, { passive: false });


boardWrapper.addEventListener('touchend', (e) => {
  e.preventDefault();
  if (isDragging && dragMoved) {
    lastDragTime = Date.now();
  }
  isDragging = false;
}, { passive: false });


boardWrapper.addEventListener('wheel', (e) => {
  e.preventDefault();
  const zoomFactor = 0.1;
  if (e.deltaY < 0) {
    scale += zoomFactor; // zoom in
  } else {
    scale = Math.max(0.2, scale - zoomFactor); // zoom out, min 0.2
  }
  updateTransform();
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


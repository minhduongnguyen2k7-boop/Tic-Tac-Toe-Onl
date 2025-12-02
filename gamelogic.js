// === Game state ===
let boxes = 15;               // default; set via initGame
let board = [];               // 2D array boxes x boxes, 0 empty, 1 player, 2 bot/human
let count = 0;                // placed moves
let win = 0;                  // 0 playing, 1 someone won, 2 draw
let currentPlayer = 1;        // 1 starts
let gameMode = "bot";         // "bot" or "human"

// Direction helpers (equivalent of your C nameless arrays)
const nameless = [
  [0, 0, 0, 0, 0],           // base
  [0, -1, -2, -3, -4],       // shift negative
  [0, -2, -4, -6, -8]        // double shift negative (for left diag in your logic)
];

// Bot helper scratch state
let possibleWin = 0;
let tempx = 0;
let tempy = 0;
let zeroValue = 0;

// === Public API for UI integration ===
function initGame(size, mode) {
  boxes = Math.max(5, Number(size) || 15);
  gameMode = mode === "human" ? "human" : "bot";

  board = Array.from({ length: boxes }, () => Array(boxes).fill(0));
  count = 0;
  win = 0;
  currentPlayer = 1;

  if (typeof renderBoard === "function") renderBoard();
}

function resetGame() {
  initGame(boxes, gameMode);
}

// Used by canvas click handler
function onCellClick(row, col) {
  if (win !== 0) return;
  if (!inBounds(row, col) || board[row][col] !== 0) return;

  // Player 1 move
  applyMove(row, col, 1);
  if (win !== 0) return;

  // Next turn logic
  if (gameMode === "human") {
    currentPlayer = currentPlayer === 1 ? 2 : 1;
    return;
  }

  // Bot move (player 2)
  botTurn();
  checkBoard(2);
  if (typeof renderBoard === "function") renderBoard();
}

// Optional helpers to expose state to UI
function getBoard() {
  return board;
}
function getStatus() {
  return { boxes, win, count, currentPlayer, gameMode };
}

// === Core game mechanics ===
function applyMove(row, col, player) {
  board[row][col] = player;
  count++;
  checkBoard(player);
  if (typeof renderBoard === "function") renderBoard();
}

function inBounds(r, c) {
  return r >= 0 && r < boxes && c >= 0 && c < boxes;
}

// Win/draw check: five-in-a-row
function checkBoard(move) {
  // Horizontal, Vertical, Right Diagonal, Left Diagonal
  for (let i = 0; i < boxes; i++) {
    for (let j = 0; j < boxes; j++) {
      // Horizontal (j..j+4)
      if (j <= boxes - 5 &&
          board[i][j] === move &&
          board[i][j + 1] === move &&
          board[i][j + 2] === move &&
          board[i][j + 3] === move &&
          board[i][j + 4] === move) {
        win = 1;
        return;
      }
      // Vertical (i..i+4)
      if (i <= boxes - 5 &&
          board[i][j] === move &&
          board[i + 1][j] === move &&
          board[i + 2][j] === move &&
          board[i + 3][j] === move &&
          board[i + 4][j] === move) {
        win = 1;
        return;
      }
      // Right diagonal
      if (i <= boxes - 5 && j <= boxes - 5 &&
          board[i][j] === move &&
          board[i + 1][j + 1] === move &&
          board[i + 2][j + 2] === move &&
          board[i + 3][j + 3] === move &&
          board[i + 4][j + 4] === move) {
        win = 1;
        return;
      }
      // Left diagonal
      if (i <= boxes - 5 && j >= 4 &&
          board[i][j] === move &&
          board[i + 1][j - 1] === move &&
          board[i + 2][j - 2] === move &&
          board[i + 3][j - 3] === move &&
          board[i + 4][j - 4] === move) {
        win = 1;
        return;
      }
    }
  }

  // Draw
  if (count === boxes * boxes) {
    win = 2;
  }
}

// === Bot AI (ported from your C code) ===
// Note: Since JS doesn’t guard array bounds like C, we add explicit bounds checks before indexing.

function botTurnFramework(move, compare, nmls, secondNmls, threeBoxesInARow,
                          xRange, yRange, checkXMin, checkYMin, checkXMax, checkYMax) {
  if (threeBoxesInARow) {
    for (let i = 0; i < xRange; i++) {
      for (let j = 0; j < yRange; j++) {
        const c1x = i + checkXMin;
        const c1y = j + checkYMin;
        const c2x = i + checkXMax;
        const c2y = j + checkYMax;

        if (!inBounds(i, j) || !inBounds(c1x, c1y) || !inBounds(c2x, c2y)) continue;

        if (board[i][j] === move &&
            board[c1x][c1y] === 0 &&
            board[c2x][c2y] === 0) {

          for (let k = 0; k < 5; k++) {
            const x = i + k + nmls[k];
            const y = j + k + secondNmls[k];
            if (!inBounds(x, y)) { possibleWin = tempx = tempy = zeroValue = 0; break; }

            if (board[x][y] === move) {
              possibleWin++;
            } else if (board[x][y] === 0) {
              zeroValue++;
              if (zeroValue === 1) {
                tempx = x;
                tempy = y;
              }
            }
          }

          if (possibleWin === compare && zeroValue === 5 - compare) {
            board[tempx][tempy] = 2;
            count++;
            possibleWin = tempx = tempy = zeroValue = 0;
            return true;
          }
          possibleWin = tempx = tempy = zeroValue = 0;
        }
      }
    }
  } else {
    for (let i = 0; i < boxes; i++) {
      for (let j = 0; j < boxes - 4; j++) {
        for (let k = 0; k < 5; k++) {
          const x = i + k + nmls[k];
          const y = j + k + secondNmls[k];
          if (!inBounds(x, y)) { possibleWin = tempx = tempy = zeroValue = 0; break; }

          if (board[x][y] === move) {
            possibleWin++;
          } else if (board[x][y] === 0) {
            tempx = x;
            tempy = y;
            zeroValue++;
          }
        }

        if (possibleWin === compare && zeroValue === 5 - compare) {
          board[tempx][tempy] = 2;
          count++;
          possibleWin = tempx = tempy = zeroValue = 0;
          return true;
        }
        possibleWin = tempx = tempy = zeroValue = 0;
      }
    }
  }
  return false;
}

function botTurnFrameworkCompilation(move, compare, nmls, secondNmls,
                                     threeBoxesInARow, checkXMin, checkYMin, checkXMax, checkYMax) {
  // Horizontal
  if (botTurnFramework(move, compare, nmls[1], secondNmls[0], threeBoxesInARow,
                       boxes, boxes - 5, checkXMin, checkYMin, checkXMax, checkYMax)) return true;
  // Vertical
  if (botTurnFramework(move, compare, nmls[0], secondNmls[1], threeBoxesInARow,
                       boxes - 5, boxes, checkXMin, checkYMin, checkXMax, checkYMax)) return true;
  // Right diagonal
  if (botTurnFramework(move, compare, nmls[0], secondNmls[0], threeBoxesInARow,
                       boxes - 5, boxes - 5, checkXMin, checkYMin, checkXMax, checkYMax)) return true;
  // Left diagonal
  if (botTurnFramework(move, compare, nmls[0], secondNmls[2], threeBoxesInARow,
                       boxes - 5, boxes, checkXMin, checkYMin, checkXMax, checkYMax)) return true;

  return false;
}

function botTurn() {
  // Winning moves first
  if (botTurnFrameworkCompilation(2, 4, nameless, nameless, false, 0, 0, 0, 0)) return;

  // Block opponent winning moves
  if (botTurnFrameworkCompilation(1, 4, nameless, nameless, false, 0, 0, 0, 0)) return;

  // Block 3-in-a-row with open ends
  if (botTurnFramework(1, 3, nameless[1], nameless[0], true, boxes, boxes - 5, 0, -1, 0, 4)) return; // Horizontal
  if (botTurnFramework(1, 3, nameless[0], nameless[1], true, boxes - 5, boxes, -1, 0, 4, 0)) return; // Vertical
  if (botTurnFramework(1, 3, nameless[0], nameless[0], true, boxes - 5, boxes - 5, -1, -1, 4, 4)) return; // Right diagonal
  if (botTurnFramework(1, 3, nameless[0], nameless[2], true, boxes - 5, boxes, -1, 1, 4, -4)) return; // Left diagonal

  // Build or block weaker sequences
  if (botTurnFrameworkCompilation(1, 3, nameless, nameless, false, 0, 0, 0, 0)) return;
  if (botTurnFrameworkCompilation(2, 3, nameless, nameless, false, 0, 0, 0, 0)) return;
  if (botTurnFrameworkCompilation(2, 2, nameless, nameless, false, 0, 0, 0, 0)) return;
  if (botTurnFrameworkCompilation(2, 1, nameless, nameless, false, 0, 0, 0, 0)) return;

  // Fallback random move
  let ri, rj;
  do {
    ri = Math.floor(Math.random() * boxes);
    rj = Math.floor(Math.random() * boxes);
  } while (board[ri][rj] !== 0);

  board[ri][rj] = 2;
  count++;
}

// === Attach to window for UI usage ===
if (typeof window !== "undefined") {
  window.initGame = initGame;
  window.resetGame = resetGame;
  window.onCellClick = onCellClick;
  window.getBoard = getBoard;
  window.getStatus = getStatus;
}

// Node.js export
if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    initGame,
    resetGame,
    onCellClick,
    getBoard,
    getStatus
  };
}

// gameLogic.js
// Port of your C logic: win check and bot move framework

// Direction offset helpers mirroring your C arrays
const nameless = [
  [0, 0, 0, 0, 0],     // base
  [0, -1, -2, -3, -4], // left/up offsets
  [0, -2, -4, -6, -8]  // stronger left/up offsets
];

// Create an empty board
function createEmptyBoard(n) {
  return Array.from({ length: n }, () => Array(n).fill(0));
}

// Win/draw check (five in a row)
function checkBoard(player, board, count) {
  const n = board.length;

  // Horizontal
  for (let i = 0; i < n; i++) {
    for (let j = 0; j <= n - 5; j++) {
      if ([0, 1, 2, 3, 4].every(k => board[i][j + k] === player)) return 1;
    }
  }

  // Vertical
  for (let i = 0; i <= n - 5; i++) {
    for (let j = 0; j < n; j++) {
      if ([0, 1, 2, 3, 4].every(k => board[i + k][j] === player)) return 1;
    }
  }

  // Diagonal ↘
  for (let i = 0; i <= n - 5; i++) {
    for (let j = 0; j <= n - 5; j++) {
      if ([0, 1, 2, 3, 4].every(k => board[i + k][j + k] === player)) return 1;
    }
  }

  // Diagonal ↙
  for (let i = 0; i <= n - 5; i++) {
    for (let j = 4; j < n; j++) {
      if ([0, 1, 2, 3, 4].every(k => board[i + k][j - k] === player)) return 1;
    }
  }

  // Draw
  if (count === n * n) return 2;
  return 0;
}

// Safely read a cell, returning undefined if out of bounds
function read(board, r, c) {
  const n = board.length;
  if (r < 0 || r >= n || c < 0 || c >= n) return undefined;
  return board[r][c];
}

// Core bot framework (ported from your C "botturn_framework")
function botturnFramework({
  move, board, compare, namelessArr, secondArr,
  threeBoxesInARow, xRange, yRange,
  checkXMin, checkYMin, checkXMax, checkYMax
}) {
  const n = board.length;

  const tryBlock = (i, j) => {
    let possible_win = 0;
    let zero_value = 0;
    let tempx = 0, tempy = 0;

    for (let k = 0; k < 5; k++) {
      const rr = i + k + namelessArr[k];
      const cc = j + k + secondArr[k];
      const cell = read(board, rr, cc);
      if (cell === move) {
        possible_win++;
      } else if (cell === 0) {
  zero_value++;
  if (zero_value === 1) {
    tempx = rr;
    tempy = cc;
  }
} else {
        // opponent piece breaks this segment
      }
    }

    if (possible_win === compare && zero_value === (5 - compare) && tempx !== -1) {
      board[tempx][tempy] = 2;
      return { placed: true, row: tempx, col: tempy };
    }
    return { placed: false };
  };

  if (threeBoxesInARow) {
    for (let i = 0; i < xRange; i++) {
      for (let j = 0; j < yRange; j++) {
        const a = read(board, i, j);
        const b = read(board, i + checkXMin, j + checkYMin);
        const c = read(board, i + checkXMax, j + checkYMax);
        if (a === move && b === 0 && c === 0) {
          const res = tryBlock(i, j);
          if (a === undefined || b === undefined || c === undefined) continue;
          if (res.placed) return res;
        }
      }
    }
  } else {
    // scan all segments in the allowed ranges
    for (let i = 0; i < n; i++) {
      for (let j = 0; j <n; j++) {
        const res = tryBlock(i, j);
        if (res.placed) return res;
      }
    }
  }
  return { placed: false };
}

// Compile calls (ported from "botturn_framework_compilation")
function botturnFrameworkCompilation(move, board, compare, threeBoxesInARow,
  checkXMin, checkYMin, checkXMax, checkYMax) {

  // Horizontal
  {
    const res = botturnFramework({
      move, board, compare,
      namelessArr: nameless[1], secondArr: nameless[0],
      threeBoxesInARow, xRange: board.length, yRange: board.length - 5,
      checkXMin, checkYMin, checkXMax, checkYMax
    });
    if (res.placed) return res;
  }

  // Vertical
  {
    const res = botturnFramework({
      move, board, compare,
      namelessArr: nameless[0], secondArr: nameless[1],
      threeBoxesInARow, xRange: board.length - 5, yRange: board.length,
      checkXMin, checkYMin, checkXMax, checkYMax
    });
    if (res.placed) return res;
  }

  // Right diagonal
  {
    const res = botturnFramework({
      move, board, compare,
      namelessArr: nameless[0], secondArr: nameless[0],
      threeBoxesInARow, xRange: board.length - 5, yRange: board.length - 5,
      checkXMin, checkYMin, checkXMax, checkYMax
    });
    if (res.placed) return res;
  }

  // Left diagonal
  {
    const res = botturnFramework({
      move, board, compare,
      namelessArr: nameless[0], secondArr: nameless[2],
      threeBoxesInARow, xRange: board.length - 5, yRange: board.length,
      checkXMin, checkYMin, checkXMax, checkYMax
    });
    if (res.placed) return res;
  }

  return { placed: false };
}

// Full bot turn (ported from your "botturn" decision order)
function botTurn(board) {
  // Try to win: 4 in line for bot (move=2)
  let res =
    botturnFrameworkCompilation(2, board, 4, false, 0, 0, 0, 0);
  if (res.placed) return res;

  // Block player 1: 4 in line for opponent (move=1)
  res = botturnFrameworkCompilation(1, board, 4, false, 0, 0, 0, 0);
  if (res.placed) return res;

  // Advanced three-in-a-row cases (endpoints open)
  // Horizontal: check ends [0, -1] and [0, 4]
  res = botturnFramework({
    move: 1, board, compare: 3,
    namelessArr: nameless[1], secondArr: nameless[0],
    threeBoxesInARow: true, xRange: board.length, yRange: board.length - 5,
    checkXMin: 0, checkYMin: -1, checkXMax: 0, checkYMax: 4
  });
  if (res.placed) return res;

  // Vertical: ends [-1, 0] and [4, 0]
  res = botturnFramework({
    move: 1, board, compare: 3,
    namelessArr: nameless[0], secondArr: nameless[1],
    threeBoxesInARow: true, xRange: board.length - 5, yRange: board.length,
    checkXMin: -1, checkYMin: 0, checkXMax: 4, checkYMax: 0
  });
  if (res.placed) return res;

  // Right diagonal: ends [-1, -1] and [4, 4]
  res = botturnFramework({
    move: 1, board, compare: 3,
    namelessArr: nameless[0], secondArr: nameless[0],
    threeBoxesInARow: true, xRange: board.length - 5, yRange: board.length - 5,
    checkXMin: -1, checkYMin: -1, checkXMax: 4, checkYMax: 4
  });
  if (res.placed) return res;

  // Left diagonal: ends [-1, 1] and [4, -4]
  res = botturnFramework({
    move: 1, board, compare: 3,
    namelessArr: nameless[0], secondArr: nameless[2],
    threeBoxesInARow: true, xRange: board.length - 5, yRange: board.length,
    checkXMin: -1, checkYMin: 1, checkXMax: 4, checkYMax: -4
  });
  if (res.placed) return res;

  // Extra horizontal three-in-a-row with open ends
 res = botturnFrameworkCompilation(1, board, 3, false, 0, 0, 0, 0);
  if (res.placed) return res;

  // Build bot sequences: 3, 2, 1
  res = botturnFrameworkCompilation(2, board, 3, false, 0, 0, 0, 0);
  if (res.placed) return res;
  res = botturnFrameworkCompilation(2, board, 2, false, 0, 0, 0, 0);
  if (res.placed) return res;
  res = botturnFrameworkCompilation(2, board, 1, false, 0, 0, 0, 0);
  if (res.placed) return res;

  // Fallback: pick a random empty cell
  const empties = [];
  for (let i = 0; i < board.length; i++) {
    for (let j = 0; j < board.length; j++) {
      if (board[i][j] === 0) empties.push([i, j]);
    }
  }
  if (empties.length > 0) {
    const [r, c] = empties[Math.floor(Math.random() * empties.length)];
    board[r][c] = 2;
    return { placed: true, row: r, col: c };
  }
  return { placed: false };
}

module.exports = {
  createEmptyBoard,
  checkBoard,
  botTurn
};
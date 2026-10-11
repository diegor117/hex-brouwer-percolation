/* Checks for the core claims the site makes. Run with: node test/logic.test.js */

"use strict";

const Hex = require("../js/hex.js");
const { Board, BLACK, WHITE } = Hex;

let failures = 0;
function assert(cond, msg) {
  if (!cond) {
    failures++;
    console.error("FAIL: " + msg);
  }
}

// 1. Exact enumeration on small boards: every full board has exactly one
//    winner, and by symmetry exactly half of all colourings have a black
//    crossing. This is the "1/2" result, verified exhaustively.
function enumerate(n) {
  const total = 1 << (n * n);
  let blackWins = 0, whiteWins = 0;
  const b = new Board(n);
  for (let mask = 0; mask < total; mask++) {
    for (let i = 0; i < n * n; i++) b.cells[i] = (mask >> i) & 1 ? BLACK : WHITE;
    const w = Hex.winner(b);
    assert(w === BLACK || w === WHITE, `n=${n} mask=${mask}: board has no winner`);
    if (w === BLACK) blackWins++;
    if (w === WHITE) whiteWins++;
  }
  assert(blackWins + whiteWins === total, `n=${n}: some board had no winner`);
  assert(blackWins === total / 2,
    `n=${n}: black crossings = ${blackWins}, expected exactly ${total / 2}`);
  console.log(`n=${n}: ${total} boards, black crossing in exactly ${blackWins} (= half)`);
}
enumerate(2);
enumerate(3);
enumerate(4);

// 2. Both crossings never coexist (at most one winner), checked on random
//    boards by testing each colour's crossing independently.
function hasCrossing(board, color) {
  const n = board.n;
  const seen = new Set();
  const stack = [];
  for (let i = 0; i < n; i++) {
    const [r, c] = color === BLACK ? [0, i] : [i, 0];
    if (board.get(r, c) === color) { stack.push([r, c]); seen.add(r + "," + c); }
  }
  while (stack.length) {
    const [r, c] = stack.pop();
    if (color === BLACK ? r === n - 1 : c === n - 1) return true;
    for (const [nr, nc] of board.neighbors(r, c)) {
      const key = nr + "," + nc;
      if (!seen.has(key) && board.get(nr, nc) === color) {
        seen.add(key);
        stack.push([nr, nc]);
      }
    }
  }
  return false;
}

for (let t = 0; t < 2000; t++) {
  const n = 5 + (t % 7);
  const b = Hex.randomFullBoard(n);
  const black = hasCrossing(b, BLACK);
  const white = hasCrossing(b, WHITE);
  assert(black !== white, `random board n=${n} trial=${t}: expected exactly one crossing, got black=${black} white=${white}`);
  const w = Hex.winner(b);
  assert((w === BLACK) === black, `union-find disagrees with BFS, n=${n} trial=${t}`);
}
console.log("random boards: exactly one crossing in all 2000 trials, union-find agrees with BFS");

// 3. The Gale path trace: on every full board the walk from the NW corner
//    terminates at another corner, and the cells of the winning colour that
//    touch the path contain a full crossing for that colour.
function cellsContainCrossing(board, cellList, color) {
  const n = board.n;
  const set = new Set(cellList.map(([r, c]) => r + "," + c));
  const seen = new Set();
  const stack = [];
  for (const [r, c] of cellList) {
    if (color === BLACK ? r === 0 : c === 0) { stack.push([r, c]); seen.add(r + "," + c); }
  }
  while (stack.length) {
    const [r, c] = stack.pop();
    if (color === BLACK ? r === n - 1 : c === n - 1) return true;
    for (const [nr, nc] of board.neighbors(r, c)) {
      const key = nr + "," + nc;
      if (set.has(key) && !seen.has(key)) { seen.add(key); stack.push([nr, nc]); }
    }
  }
  return false;
}

let endpointStats = {};
for (let t = 0; t < 1000; t++) {
  const n = 4 + (t % 6);
  const b = Hex.randomFullBoard(n);
  const trace = Hex.tracePath(b, 1);
  assert(trace !== null, `trace missing, n=${n} trial=${t}`);
  const g = trace.graph;
  assert(g.endpoints.length === 4, `expected 4 path endpoints, got ${g.endpoints.length}, n=${n} trial=${t}`);
  assert(g.endpoints.includes(trace.endKey) && trace.endKey !== trace.vertices[0],
    `path did not end at another corner, n=${n} trial=${t}`);
  const w = Hex.winner(b);
  const winnerCells = (w === BLACK ? trace.sideCells.black : trace.sideCells.white)
    .filter(cell => cell.r >= 0 && cell.r < n && cell.c >= 0 && cell.c < n)
    .map(cell => [cell.r, cell.c]);
  assert(cellsContainCrossing(b, winnerCells, w),
    `winning side of the path is not a crossing, n=${n} trial=${t}`);
  // Record which corner the path ends at, split by winner, to sanity-check
  // the relationship is consistent.
  const p = g.coords.get(trace.endKey);
  const label = (w === BLACK ? "B" : "W") + ":" + (p[0] + p[1] > 0 ? "far" : "near");
  endpointStats[label] = (endpointStats[label] || 0) + 1;
}
console.log("gale trace: 1000 boards, path always corner-to-corner, winning side always a crossing");
console.log("endpoint stats:", endpointStats);

// 4. Monte Carlo at p = 0.5 on an 11x11 board: frequency of a black crossing
//    should be very close to 1/2 (it is exactly 1/2; this checks the sampler).
{
  const n = 11, trials = 20000;
  let blackWins = 0;
  for (let t = 0; t < trials; t++) {
    if (Hex.winner(Hex.randomFullBoard(n)) === BLACK) blackWins++;
  }
  const freq = blackWins / trials;
  const sigma = Math.sqrt(0.25 / trials); // ~0.0035
  assert(Math.abs(freq - 0.5) < 5 * sigma,
    `11x11 Monte Carlo frequency ${freq} too far from 0.5`);
  console.log(`11x11 Monte Carlo: ${blackWins}/${trials} = ${freq.toFixed(4)} (expected 0.5000)`);
}

// 5. Rectangular boards are not fair at p = 0.5, which shows that the
//    symmetry argument needs a square board. Enumerate every colouring of an
//    R x C board (R rows, C columns) with the same adjacency as the Hex board.
//    Black crosses R rows, White crosses C columns; with R < C Black has the
//    shorter distance and should cross in more than half of the colourings.
function rectCrossing(cells, R, C, color) {
  const seen = new Uint8Array(R * C);
  const stack = [];
  for (let i = 0; i < (color === BLACK ? C : R); i++) {
    const [r, c] = color === BLACK ? [0, i] : [i, 0];
    if (cells[r * C + c] === color) { stack.push([r, c]); seen[r * C + c] = 1; }
  }
  while (stack.length) {
    const [r, c] = stack.pop();
    if (color === BLACK ? r === R - 1 : c === C - 1) return true;
    for (const [dr, dc] of Hex.DIRS) {
      const nr = r + dr, nc = c + dc;
      if (nr < 0 || nr >= R || nc < 0 || nc >= C) continue;
      const k = nr * C + nc;
      if (!seen[k] && cells[k] === color) { seen[k] = 1; stack.push([nr, nc]); }
    }
  }
  return false;
}
for (const [R, C] of [[2, 3], [3, 4], [4, 5]]) {
  const total = 2 ** (R * C);
  const cells = new Int8Array(R * C);
  let black = 0, white = 0;
  for (let mask = 0; mask < total; mask++) {
    for (let i = 0; i < R * C; i++) cells[i] = (mask >> i) & 1 ? BLACK : WHITE;
    const b = rectCrossing(cells, R, C, BLACK), w = rectCrossing(cells, R, C, WHITE);
    assert(b !== w, `${R}x${C} mask=${mask}: expected exactly one crossing`);
    if (b) black++; else white++;
  }
  assert(black > total / 2, `${R}x${C}: black crossings ${black} should exceed half of ${total}`);
  console.log(`${R}x${C} board: black (shorter side) crosses in ${black}/${total} = ${(black / total).toFixed(4)}`);
}

// 6. The Brouwer colouring (Gale's argument), checked on a real Hex board.
//    Colour an n x n Hex board from a continuous self-map f of the unit
//    square by the rule in the paper (Lemma 3.2):
//        White  if |f1(x) - x1| >= eps   (White joins left to right)
//        Black  else if |f2(x) - x2| >= eps   (Black joins top to bottom)
//        blank  otherwise.
//    The proof claims neither player can have a crossing, so at least one
//    cell must be left blank, and that blank cell is an approximate fixed
//    point. We verify the hypothesis numerically (adjacent centres really do
//    land within eps of each other under f) and then assert the conclusion
//    using the same win detection the site uses.
{
  const Maps = require("../js/maps.js");
  // Cell (r, c) of the board sits at this point of the unit square;
  // row 0 is the top, column 0 is the left.
  const pointOf = (r, c, n) => [(c + 0.5) / n, 1 - (r + 0.5) / n];

  let cases = 0;
  for (const name of Object.keys(Maps)) {
    const f = Maps[name];
    for (const n of [40, 60, 80]) {
      for (const eps of [0.15, 0.25, 0.4]) {
        const b = new Board(n);

        // Check the uniform-continuity hypothesis on every adjacent pair:
        // |f(x) - f(y)| < eps. If it fails, the proof does not apply and the
        // case is not a valid test of the conclusion.
        let hypothesisHolds = true;
        let maxJump = 0;
        for (let r = 0; r < n && hypothesisHolds; r++) {
          for (let c = 0; c < n && hypothesisHolds; c++) {
            const [x1, x2] = pointOf(r, c, n);
            const fx = f(x1, x2);
            for (const [nr, nc] of b.neighbors(r, c)) {
              const [y1, y2] = pointOf(nr, nc, n);
              const fy = f(y1, y2);
              const jump = Math.hypot(fx[0] - fy[0], fx[1] - fy[1]);
              if (jump > maxJump) maxJump = jump;
              if (jump >= eps) { hypothesisHolds = false; break; }
            }
          }
        }
        if (!hypothesisHolds) continue;

        let blanks = 0;
        for (let r = 0; r < n; r++) {
          for (let c = 0; c < n; c++) {
            const [x1, x2] = pointOf(r, c, n);
            const fx = f(x1, x2);
            if (Math.abs(fx[0] - x1) >= eps) b.set(r, c, WHITE);
            else if (Math.abs(fx[1] - x2) >= eps) b.set(r, c, BLACK);
            else blanks++;
          }
        }

        const w = Hex.winner(b);
        assert(w === 0,
          `${name} n=${n} eps=${eps}: colouring produced a winner (${w === BLACK ? "Black" : "White"}), ` +
          `but Gale's argument says neither player can cross`);
        assert(blanks > 0, `${name} n=${n} eps=${eps}: no blank cell, so no approximate fixed point`);

        // Every blank cell really is moved less than eps*sqrt(2).
        for (let r = 0; r < n; r++) {
          for (let c = 0; c < n; c++) {
            if (b.get(r, c) !== Hex.EMPTY) continue;
            const [x1, x2] = pointOf(r, c, n);
            const fx = f(x1, x2);
            const d = Math.hypot(fx[0] - x1, fx[1] - x2);
            assert(d < eps * Math.SQRT2,
              `${name} n=${n} eps=${eps}: blank cell at (${r},${c}) moves ${d}, not < eps*sqrt(2)`);
          }
        }
        cases++;
      }
    }
  }
  assert(cases > 0, "no Brouwer colouring case satisfied the hypothesis, so the test is vacuous");
  console.log(`brouwer colouring: ${cases} (map, mesh, eps) cases: neither player ever crosses, blanks always exist`);
}

// 7. The assignment of directions matters. With the reversed rule (cells with
//    large horizontal displacement given to Black) the argument breaks, and
//    for the "fold" map the colouring does contain a black crossing.
{
  const Maps = require("../js/maps.js");
  const f = Maps.fold;
  for (const n of [40, 60, 80]) {
    for (const eps of [0.15, 0.25, 0.4]) {
      const b = new Board(n);
      for (let r = 0; r < n; r++) {
        for (let c = 0; c < n; c++) {
          const x1 = (c + 0.5) / n, x2 = 1 - (r + 0.5) / n;
          const fx = f(x1, x2);
          if (Math.abs(fx[0] - x1) >= eps) b.set(r, c, BLACK);
          else if (Math.abs(fx[1] - x2) >= eps) b.set(r, c, WHITE);
        }
      }
      assert(Hex.winner(b) === BLACK,
        `fold n=${n} eps=${eps}: reversed rule was expected to give a black crossing`);
    }
  }
  console.log("reversed rule: fold gives a black crossing for all 9 (mesh, eps) cases");
}

// Computer opponent (js/bot.js): takes a win in one, blocks a loss in one,
// and beats a uniformly random player from either side.
{
  global.Hex = Hex;
  const Bot = require("../js/bot.js");
  const { EMPTY } = Hex;

  let b = new Board(7);
  for (let c = 0; c < 7; c++) if (c !== 4) b.set(3, c, WHITE);
  for (let c = 0; c < 6; c++) b.set(1, c, BLACK);
  let mv = Bot.chooseMove(b, WHITE);
  assert(mv[0] === 3 && mv[1] === 4, `bot missed a win in one (played ${mv})`);

  b = new Board(7);
  for (let r = 0; r < 7; r++) if (r !== 5) b.set(r, 2, BLACK);
  for (let r = 0; r < 4; r++) b.set(r, 5, WHITE);
  mv = Bot.chooseMove(b, WHITE);
  assert(mv[0] === 5 && mv[1] === 2, `bot did not block a loss in one (played ${mv})`);

  let seed = 11;
  const rng = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  let games = 0, wins = 0;
  for (const n of [7, 11]) {
    for (const botColor of [BLACK, WHITE]) {
      for (let g = 0; g < 10; g++) {
        const bd = new Board(n);
        let turn = BLACK, w = 0;
        while (!w) {
          let m;
          if (turn === botColor) m = Bot.chooseMove(bd, turn, rng);
          else {
            const empty = [];
            for (let i = 0; i < n * n; i++) if (bd.cells[i] === EMPTY) empty.push(i);
            const i = empty[Math.floor(rng() * empty.length)];
            m = [Math.floor(i / n), i % n];
          }
          bd.set(m[0], m[1], turn);
          w = Hex.winner(bd);
          turn = turn === BLACK ? WHITE : BLACK;
        }
        games++;
        if (w === botColor) wins++;
      }
    }
  }
  assert(wins === games, `bot won only ${wins}/${games} games against a random player`);
  console.log(`bot: wins in one, blocks in one, beat a random player in ${wins}/${games} games`);

}

if (failures === 0) {
  console.log("\nAll checks passed.");
} else {
  console.error(`\n${failures} check(s) FAILED.`);
  process.exit(1);
}

/* Generates the figures and data used by paper/hex-brouwer.tex.
   Everything is computed with the same code the web page and the tests use
   (js/hex.js, js/maps.js), with a seeded random generator so that the output
   is reproducible.

     node scripts/make-figures.js            figures + fast data
     node scripts/make-figures.js --n5       also enumerate all 2^25 boards for n = 5

   Output: paper/figures/*.tex (TikZ code) and paper/data/*.csv */

"use strict";

const fs = require("fs");
const path = require("path");
const Hex = require("../js/hex.js");
const Maps = require("../js/maps.js");
const { Board, BLACK, WHITE, EMPTY } = Hex;

const ROOT = path.join(__dirname, "..");
const FIG = path.join(ROOT, "paper", "figures");
const DATA = path.join(ROOT, "paper", "data");
fs.mkdirSync(FIG, { recursive: true });
fs.mkdirSync(DATA, { recursive: true });

function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const fmt = (v) => (Math.abs(v) < 5e-4 ? "0" : v.toFixed(3));
// hex.js uses screen coordinates (y down); TikZ uses y up.
const pt = (p) => `(${fmt(p[0])},${fmt(-p[1])})`;
const poly = (pts) => pts.map(pt).join("--") + "--cycle";

/* ------------------------------------------------------------------------
   Figure 1: Gale's walk on a framed 7 x 7 board.
   Panel (a): board, frame and all fence edges.  Panel (b): the walk from
   the top-left corner and the winning chain along one side of it.        */

function walkFigure() {
  const n = 7;
  // Pick, among a fixed range of seeds, the board whose walk is longest,
  // so that the figure shows a non-trivial path.
  let best = null;
  for (let seed = 1; seed <= 400; seed++) {
    const b = Hex.randomFullBoard(n, 0.5, mulberry32(seed));
    const tr = Hex.tracePath(b, 1);
    if (!best || tr.vertices.length > best.tr.vertices.length) best = { seed, b, tr };
  }
  const { b, tr, seed } = best;
  const g = tr.graph;
  const w = Hex.winner(b);

  const cells = [];
  for (let r = 0; r < n; r++)
    for (let c = 0; c < n; c++) cells.push({ r, c, color: b.get(r, c), frame: false });
  Hex.borderCells(n).forEach((x) => cells.push({ r: x.r, c: x.c, color: x.color, frame: true }));

  function tiles() {
    return cells.map((cell) => {
      const style = cell.frame
        ? (cell.color === BLACK ? "frameblack" : "framewhite")
        : (cell.color === BLACK ? "stoneblack" : "stonewhite");
      return `\\filldraw[${style}] ${poly(Hex.polygonPoints(cell.r, cell.c, 1))};`;
    }).join("\n");
  }

  const fences = [];
  const seen = new Set();
  g.adj.forEach((arcs, from) => arcs.forEach((arc) => {
    const key = from < arc.to ? from + "|" + arc.to : arc.to + "|" + from;
    if (seen.has(key)) return;
    seen.add(key);
    fences.push(`\\draw[fence] ${pt(g.coords.get(from))}--${pt(g.coords.get(arc.to))};`);
  }));
  const ends = g.endpoints.map((k) => `\\fill[endpoint] ${pt(g.coords.get(k))} circle (0.22);`);

  const side = (w === BLACK ? tr.sideCells.black : tr.sideCells.white)
    .filter((cell) => cell.r >= 0 && cell.r < n && cell.c >= 0 && cell.c < n);
  const chain = side.map((cell) => {
    const ctr = Hex.center(cell.r, cell.c, 1);
    return `\\fill[chainmark] ${pt(ctr)} circle (0.3);`;
  });

  const walk = `\\draw[walk] ${tr.points.map(pt).join("--")};`;
  const start = `\\node[label] at ${pt([g.coords.get(tr.vertices[0])[0] - 0.9, g.coords.get(tr.vertices[0])[1] - 0.6])} {$s$};`;

  const panelA = [tiles(), fences.join("\n"), ends.join("\n")].join("\n");
  const panelB = [tiles(), walk, ends.join("\n"), chain.join("\n"), start].join("\n");
  fs.writeFileSync(path.join(FIG, "walk-a.tex"), panelA + "\n");
  fs.writeFileSync(path.join(FIG, "walk-b.tex"), panelB + "\n");
  console.log(`walk figure: n=${n}, seed=${seed}, walk length ${tr.vertices.length - 1} edges, winner ${w === BLACK ? "Black" : "White"}`);
  return { winner: w === BLACK ? "Black" : "White", seed };
}

/* ------------------------------------------------------------------------
   Figure 2: the two cases at a vertex where three tiles meet.             */

function vertexFigure() {
  const cases = [
    { colors: [BLACK, WHITE, BLACK], dx: 0 },
    { colors: [BLACK, BLACK, BLACK], dx: 4.4 },
  ];
  const triple = [[0, 0], [0, 1], [1, 0]];
  const out = [];
  cases.forEach((cs) => {
    const polys = triple.map(([r, c]) =>
      Hex.polygonPoints(r, c, 1).map((p) => [p[0] + cs.dx, p[1]]));
    polys.forEach((pts, i) =>
      out.push(`\\filldraw[${cs.colors[i] === BLACK ? "stoneblack" : "stonewhite"}] ${poly(pts)};`));
    for (let i = 0; i < 3; i++) for (let j = i + 1; j < 3; j++) {
      if (cs.colors[i] === cs.colors[j]) continue;
      const shared = [];
      polys[i].forEach((p) => polys[j].forEach((q) => {
        if (Math.abs(p[0] - q[0]) < 1e-6 && Math.abs(p[1] - q[1]) < 1e-6) shared.push(p);
      }));
      if (shared.length === 2) out.push(`\\draw[walk] ${pt(shared[0])}--${pt(shared[1])};`);
    }
    out.push(`\\fill[endpoint] ${pt([Math.sqrt(3) / 2 + cs.dx, 0.5])} circle (0.12);`);
  });
  fs.writeFileSync(path.join(FIG, "vertex.tex"), out.join("\n") + "\n");
}

/* ------------------------------------------------------------------------
   Figure 3: Gale's colouring of the lattice for the three sample maps.
   Same placement of cells as test/logic.test.js: cell (r, c) of an n x n
   board sits at ((c + 1/2)/n, 1 - (r + 1/2)/n); row 0 is the top.          */

function nearFixedPoint(f) {
  // Coarse grid search, then local refinement of |f(x) - x|.
  let best = [0.5, 0.5], bd = Infinity;
  const K = 400;
  for (let i = 0; i <= K; i++) for (let j = 0; j <= K; j++) {
    const x = [i / K, j / K], y = f(x[0], x[1]);
    const d = Math.hypot(y[0] - x[0], y[1] - x[1]);
    if (d < bd) { bd = d; best = x; }
  }
  let h = 1 / K;
  for (let it = 0; it < 60; it++) {
    let improved = false;
    for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const x = [best[0] + a * h, best[1] + b * h];
      if (x[0] < 0 || x[0] > 1 || x[1] < 0 || x[1] > 1) continue;
      const y = f(x[0], x[1]);
      const d = Math.hypot(y[0] - x[0], y[1] - x[1]);
      if (d < bd) { bd = d; best = x; improved = true; }
    }
    if (!improved) h /= 2;
  }
  return { x: best, residual: bd };
}

function galeFigure(name, n, eps) {
  const f = Maps[name];
  const pointOf = (r, c) => [(c + 0.5) / n, 1 - (r + 0.5) / n];
  const b = new Board(n);
  let maxJump = 0, blanks = 0;
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
    const [x1, x2] = pointOf(r, c);
    const fx = f(x1, x2);
    for (const [nr, nc] of b.neighbors(r, c)) {
      const fy = f(...pointOf(nr, nc));
      maxJump = Math.max(maxJump, Math.hypot(fx[0] - fy[0], fx[1] - fy[1]));
    }
    if (Math.abs(fx[0] - x1) >= eps) b.set(r, c, WHITE);
    else if (Math.abs(fx[1] - x2) >= eps) b.set(r, c, BLACK);
    else blanks++;
  }
  if (maxJump >= eps) throw new Error(`${name}: hypothesis fails (max jump ${maxJump})`);
  if (Hex.winner(b) !== 0) throw new Error(`${name}: colouring has a crossing`);

  // Draw on a 6 x 6 unit canvas; merge horizontal runs of equal colour.
  const S = 6, h = S / n;
  const out = [];
  for (let r = 0; r < n; r++) {
    let c = 0;
    while (c < n) {
      const v = b.get(r, c);
      let e = c;
      while (e + 1 < n && b.get(r, e + 1) === v) e++;
      const style = v === BLACK ? "gblack" : v === WHITE ? "gwhite" : "gblank";
      const y0 = S - (r + 1) * h, y1 = S - r * h;
      out.push(`\\fill[${style}] (${fmt(c * h)},${fmt(y0)}) rectangle (${fmt((e + 1) * h)},${fmt(y1)});`);
      c = e + 1;
    }
  }
  out.push(`\\draw[gframe] (0,0) rectangle (${S},${S});`);
  const fp = nearFixedPoint(f);
  out.push(`\\draw[fixed] (${fmt(fp.x[0] * S)},${fmt(fp.x[1] * S)}) circle (0.16);`);
  fs.writeFileSync(path.join(FIG, `gale-${name}.tex`), out.join("\n") + "\n");
  console.log(`gale ${name}: n=${n} eps=${eps} max jump ${maxJump.toFixed(4)}, blank cells ${blanks}, ` +
    `fixed point ~ (${fp.x[0].toFixed(4)}, ${fp.x[1].toFixed(4)}), residual ${fp.residual.toExponential(1)}`);
  return { name, maxJump, blanks, fp };
}

/* ------------------------------------------------------------------------
   Table 1: exhaustive enumeration.                                         */

function enumerate(n) {
  const total = 2 ** (n * n);
  const b = new Board(n);
  let black = 0, none = 0;
  for (let mask = 0; mask < total; mask++) {
    for (let i = 0; i < n * n; i++) b.cells[i] = (mask / 2 ** i) & 1 ? BLACK : WHITE;
    const w = Hex.winner(b);
    if (w === BLACK) black++;
    else if (w !== WHITE) none++;
  }
  return { n, total, black, none };
}

/* ------------------------------------------------------------------------
   Figure 4: crossing probability against p, Monte Carlo.                  */

function crossingCurves() {
  const sizes = [5, 11, 21, 35];
  const samples = 20000;
  const rng = mulberry32(20261010);
  const rows = ["p," + sizes.map((n) => `theta${n},se${n}`).join(",")];
  for (let k = 0; k <= 20; k++) {
    const p = 0.3 + 0.02 * k;
    const vals = sizes.map((n) => {
      let black = 0;
      for (let t = 0; t < samples; t++)
        if (Hex.winner(Hex.randomFullBoard(n, p, rng)) === BLACK) black++;
      const th = black / samples;
      return [th, Math.sqrt(th * (1 - th) / samples)];
    });
    rows.push([p.toFixed(2)].concat(...vals.map(([a, s]) => [a.toFixed(4), s.toFixed(4)])).join(","));
  }
  fs.writeFileSync(path.join(DATA, "crossing.csv"), rows.join("\n") + "\n");
  console.log("crossing.csv written");
}

walkFigure();
vertexFigure();
for (const name of ["swirl", "shear", "fold"]) galeFigure(name, 40, 0.15);

const sizes = process.argv.includes("--n5") ? [2, 3, 4, 5] : [2, 3, 4];
const enumRows = ["n,total,black,none"];
for (const n of sizes) {
  const t0 = Date.now();
  const e = enumerate(n);
  enumRows.push(`${e.n},${e.total},${e.black},${e.none}`);
  console.log(`enumerate n=${n}: ${e.black}/${e.total} black, ${e.none} with no winner (${Date.now() - t0} ms)`);
}
fs.writeFileSync(path.join(DATA, "enumeration.csv"), enumRows.join("\n") + "\n");

crossingCurves();

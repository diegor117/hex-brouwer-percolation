/* Core Hex logic: board state, win detection, and the Gale path trace.
   No DOM code here, so the same file runs in the browser and under Node (test/). */

(function (root) {
  "use strict";

  var EMPTY = 0, BLACK = 1, WHITE = 2;

  // Axial neighbour offsets for a rhombus board.
  var DIRS = [[0, 1], [0, -1], [1, 0], [-1, 0], [-1, 1], [1, -1]];

  function Board(n) {
    this.n = n;
    this.cells = new Int8Array(n * n); // EMPTY
  }

  Board.prototype.idx = function (r, c) { return r * this.n + c; };
  Board.prototype.get = function (r, c) { return this.cells[r * this.n + c]; };
  Board.prototype.set = function (r, c, v) { this.cells[r * this.n + c] = v; };
  Board.prototype.inside = function (r, c) {
    return r >= 0 && r < this.n && c >= 0 && c < this.n;
  };
  Board.prototype.neighbors = function (r, c) {
    var out = [];
    for (var i = 0; i < 6; i++) {
      var nr = r + DIRS[i][0], nc = c + DIRS[i][1];
      if (this.inside(nr, nc)) out.push([nr, nc]);
    }
    return out;
  };
  Board.prototype.isFull = function () {
    for (var i = 0; i < this.cells.length; i++) if (this.cells[i] === EMPTY) return false;
    return true;
  };
  Board.prototype.clone = function () {
    var b = new Board(this.n);
    b.cells.set(this.cells);
    return b;
  };

  // --- Union-find with virtual border nodes ---------------------------------

  function UnionFind(size) {
    this.parent = new Int32Array(size);
    for (var i = 0; i < size; i++) this.parent[i] = i;
  }
  UnionFind.prototype.find = function (x) {
    var p = this.parent;
    while (p[x] !== x) { p[x] = p[p[x]]; x = p[x]; }
    return x;
  };
  UnionFind.prototype.union = function (a, b) {
    var ra = this.find(a), rb = this.find(b);
    if (ra !== rb) this.parent[ra] = rb;
  };

  // BLACK connects row 0 to row n-1 (top to bottom).
  // WHITE connects column 0 to column n-1 (left to right).
  // Returns BLACK, WHITE, or 0 if neither side has a crossing yet.
  function winner(board) {
    var n = board.n;
    var TOP = n * n, BOT = n * n + 1, LEFT = n * n + 2, RIGHT = n * n + 3;
    var uf = new UnionFind(n * n + 4);
    for (var r = 0; r < n; r++) {
      for (var c = 0; c < n; c++) {
        var v = board.get(r, c);
        if (v === EMPTY) continue;
        var i = board.idx(r, c);
        if (v === BLACK) {
          if (r === 0) uf.union(i, TOP);
          if (r === n - 1) uf.union(i, BOT);
        } else {
          if (c === 0) uf.union(i, LEFT);
          if (c === n - 1) uf.union(i, RIGHT);
        }
        var nb = board.neighbors(r, c);
        for (var k = 0; k < nb.length; k++) {
          if (board.get(nb[k][0], nb[k][1]) === v) uf.union(i, board.idx(nb[k][0], nb[k][1]));
        }
      }
    }
    if (uf.find(TOP) === uf.find(BOT)) return BLACK;
    if (uf.find(LEFT) === uf.find(RIGHT)) return WHITE;
    return 0;
  }

  // Shortest chain of the winning colour between its two sides (for highlighting).
  function winningChain(board, color) {
    var n = board.n;
    var startSide = function (r, c) { return color === BLACK ? r === 0 : c === 0; };
    var endSide = function (r, c) { return color === BLACK ? r === n - 1 : c === n - 1; };
    var prev = new Int32Array(n * n).fill(-2); // -2 unvisited, -1 source
    var queue = [];
    for (var r = 0; r < n; r++) {
      for (var c = 0; c < n; c++) {
        if (board.get(r, c) === color && startSide(r, c)) {
          prev[board.idx(r, c)] = -1;
          queue.push([r, c]);
        }
      }
    }
    var head = 0;
    while (head < queue.length) {
      var cur = queue[head++];
      if (endSide(cur[0], cur[1])) {
        var chain = [], i = board.idx(cur[0], cur[1]);
        while (i !== -1) {
          chain.push([Math.floor(i / n), i % n]);
          i = prev[i];
        }
        return chain;
      }
      var nb = board.neighbors(cur[0], cur[1]);
      for (var k = 0; k < nb.length; k++) {
        var j = board.idx(nb[k][0], nb[k][1]);
        if (prev[j] === -2 && board.get(nb[k][0], nb[k][1]) === color) {
          prev[j] = board.idx(cur[0], cur[1]);
          queue.push(nb[k]);
        }
      }
    }
    return null;
  }

  // --- Geometry (pointy-top hexagons, axial layout) -------------------------

  var SQRT3 = Math.sqrt(3);

  function center(r, c, size) {
    return [size * SQRT3 * (c + r / 2), size * 1.5 * r];
  }

  // Corner k of a pointy-top hexagon, k = 0..5, angles 30deg + 60deg*k.
  function corner(cx, cy, size, k) {
    var a = (Math.PI / 180) * (60 * k + 30);
    return [cx + size * Math.cos(a), cy + size * Math.sin(a)];
  }

  function polygonPoints(r, c, size) {
    var ctr = center(r, c, size), pts = [];
    for (var k = 0; k < 6; k++) pts.push(corner(ctr[0], ctr[1], size, k));
    return pts;
  }

  // --- Gale's path trace -----------------------------------------------------
  //
  // Augment the board with border cells (two black rows, two white columns),
  // build the graph of tile edges that separate a black cell from a white cell,
  // and walk it. Interior vertices of that subgraph have degree 0 or 2, so the
  // walk never branches; the four degree-1 vertices sit at the board's corners.

  function vkey(x, y) { return Math.round(x * 1000) + "," + Math.round(y * 1000); }

  // Border cells for an n x n board.
  function borderCells(n) {
    var out = [];
    for (var c = 0; c < n; c++) {
      out.push({ r: -1, c: c, color: BLACK });
      out.push({ r: n, c: c, color: BLACK });
    }
    for (var r = 0; r < n; r++) {
      out.push({ r: r, c: -1, color: WHITE });
      out.push({ r: r, c: n, color: WHITE });
    }
    return out;
  }

  // Build the separating-edge graph for a fully coloured board.
  // Returns { adj: Map vertexKey -> [{to, cells}], endpoints: [vertexKey],
  //           coords: Map vertexKey -> [x,y] }
  function buildSeparatingGraph(board, size) {
    var n = board.n;
    var cells = [];
    for (var r = 0; r < n; r++)
      for (var c = 0; c < n; c++)
        cells.push({ r: r, c: c, color: board.get(r, c) });
    cells = cells.concat(borderCells(n));

    // edge key -> { v1, v2, cells: [cell, cell?] }
    var edges = new Map();
    var coords = new Map();
    for (var i = 0; i < cells.length; i++) {
      var cell = cells[i];
      var pts = polygonPoints(cell.r, cell.c, size);
      for (var k = 0; k < 6; k++) {
        var p1 = pts[k], p2 = pts[(k + 1) % 6];
        var k1 = vkey(p1[0], p1[1]), k2 = vkey(p2[0], p2[1]);
        coords.set(k1, p1);
        coords.set(k2, p2);
        var ekey = k1 < k2 ? k1 + "|" + k2 : k2 + "|" + k1;
        var e = edges.get(ekey);
        if (!e) { e = { v1: k1, v2: k2, cells: [] }; edges.set(ekey, e); }
        e.cells.push(cell);
      }
    }

    var adj = new Map();
    function addArc(a, b, pair) {
      if (!adj.has(a)) adj.set(a, []);
      adj.get(a).push({ to: b, cells: pair });
    }
    edges.forEach(function (e) {
      if (e.cells.length !== 2) return;               // outer rim, not traversable
      var c1 = e.cells[0].color, c2 = e.cells[1].color;
      if (c1 === c2 || c1 === EMPTY || c2 === EMPTY) return;
      addArc(e.v1, e.v2, e.cells);
      addArc(e.v2, e.v1, e.cells);
    });

    var endpoints = [];
    adj.forEach(function (list, key) {
      if (list.length === 1) endpoints.push(key);
    });
    return { adj: adj, endpoints: endpoints, coords: coords };
  }

  // Walk from a degree-1 vertex to the degree-1 vertex at the other end.
  // Returns { vertices: [key], points: [[x,y]], sideCells: {black:[], white:[]} }
  function tracePath(board, size, startKey) {
    var g = buildSeparatingGraph(board, size);
    if (g.endpoints.length === 0) return null;
    var start = startKey || pickNorthWestEndpoint(g);
    var visited = new Set([start]);
    var vertices = [start];
    var blackSide = new Map(), whiteSide = new Map();
    var cur = start;
    for (;;) {
      var options = g.adj.get(cur) || [];
      var next = null;
      for (var i = 0; i < options.length; i++) {
        if (!visited.has(options[i].to)) { next = options[i]; break; }
      }
      if (!next) break;
      for (var j = 0; j < 2; j++) {
        var cell = next.cells[j];
        var key = cell.r + "," + cell.c;
        if (cell.color === BLACK) blackSide.set(key, cell);
        else whiteSide.set(key, cell);
      }
      visited.add(next.to);
      vertices.push(next.to);
      cur = next.to;
    }
    return {
      vertices: vertices,
      points: vertices.map(function (k) { return g.coords.get(k); }),
      endKey: cur,
      sideCells: {
        black: Array.from(blackSide.values()),
        white: Array.from(whiteSide.values())
      },
      graph: g
    };
  }

  // The endpoint nearest the board's north-west corner.
  function pickNorthWestEndpoint(g) {
    var best = null, bestScore = Infinity;
    g.endpoints.forEach(function (key) {
      var p = g.coords.get(key);
      var score = p[0] + p[1];
      if (score < bestScore) { bestScore = score; best = key; }
    });
    return best;
  }

  // --- Random boards ---------------------------------------------------------

  function randomFullBoard(n, p, rng) {
    rng = rng || Math.random;
    p = (p === undefined) ? 0.5 : p;
    var b = new Board(n);
    for (var i = 0; i < n * n; i++) b.cells[i] = rng() < p ? BLACK : WHITE;
    return b;
  }

  var Hex = {
    EMPTY: EMPTY, BLACK: BLACK, WHITE: WHITE,
    DIRS: DIRS,
    Board: Board,
    winner: winner,
    winningChain: winningChain,
    center: center,
    polygonPoints: polygonPoints,
    borderCells: borderCells,
    buildSeparatingGraph: buildSeparatingGraph,
    tracePath: tracePath,
    randomFullBoard: randomFullBoard
  };

  if (typeof module !== "undefined" && module.exports) module.exports = Hex;
  else root.Hex = Hex;
})(typeof self !== "undefined" ? self : this);

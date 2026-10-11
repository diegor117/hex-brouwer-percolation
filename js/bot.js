/* A simple computer opponent for the Hex board.
   No DOM code, so it also runs under Node (test/).

   Heuristic: for each empty cell, place the stone and measure each player's
   shortest remaining path (number of empty cells still needed to connect
   their two sides; own stones are free, opponent stones are walls). The bot
   plays the move that maximises (opponent distance - own distance). Ties are
   broken by how many alternative shortest paths each side keeps, then by
   closeness to the centre. It wins immediately when it can and blocks
   immediate threats, but it does not read ahead, so a careful player can
   beat it. */

(function (root) {
  "use strict";

  var Hex = root.Hex || (typeof require !== "undefined" ? require("./hex.js") : null);
  var EMPTY = Hex.EMPTY, BLACK = Hex.BLACK, WHITE = Hex.WHITE;
  var INF = 1 << 20;

  function other(p) { return p === BLACK ? WHITE : BLACK; }

  // Shortest-path distances from one side of `player` (Dijkstra with a
  // bucket queue; edge weights are 0 for own stones and 1 for empty cells).
  // The distance of a cell counts the empty cells on the best route that
  // reaches it, including the cell itself.
  function sideDistances(board, player, fromStart) {
    var n = board.n, N = n * n;
    var dist = new Int32Array(N).fill(INF);
    var buckets = [];
    function cost(i) {
      var v = board.cells[i];
      return v === player ? 0 : v === EMPTY ? 1 : INF;
    }
    function push(i, d) {
      dist[i] = d;
      (buckets[d] || (buckets[d] = [])).push(i);
    }
    for (var k = 0; k < n; k++) {
      var r, c;
      if (player === BLACK) { r = fromStart ? 0 : n - 1; c = k; }
      else { c = fromStart ? 0 : n - 1; r = k; }
      var i = r * n + c, w = cost(i);
      if (w < dist[i]) push(i, w);
    }
    for (var d = 0; d < buckets.length; d++) {
      var b = buckets[d];
      if (!b) continue;
      for (var q = 0; q < b.length; q++) {        // b may grow (0-weight edges)
        var cur = b[q];
        if (dist[cur] !== d) continue;            // stale entry
        var cr = (cur / n) | 0, cc = cur % n;
        for (var t = 0; t < 6; t++) {
          var nr = cr + Hex.DIRS[t][0], nc = cc + Hex.DIRS[t][1];
          if (nr < 0 || nr >= n || nc < 0 || nc >= n) continue;
          var j = nr * n + nc, wj = cost(j);
          if (wj < INF && d + wj < dist[j]) push(j, d + wj);
        }
      }
    }
    return dist;
  }

  // { dist: empty cells still needed, paths: empty cells on some shortest path }
  function measure(board, player) {
    var n = board.n;
    var fwd = sideDistances(board, player, true);
    var bwd = sideDistances(board, player, false);
    var best = INF;
    for (var k = 0; k < n; k++) {
      var i = player === BLACK ? (n - 1) * n + k : k * n + (n - 1);
      if (fwd[i] < best) best = fwd[i];
    }
    if (best >= INF) return { dist: INF, paths: 0 };
    var paths = 0;
    for (var c = 0; c < n * n; c++) {
      if (board.cells[c] === EMPTY && fwd[c] < INF && bwd[c] < INF &&
          fwd[c] + bwd[c] - 1 === best) paths++;
    }
    return { dist: best, paths: paths };
  }

  // Returns [r, c] for `player` to move, or null if the board is full.
  function chooseMove(board, player, rng) {
    rng = rng || Math.random;
    var n = board.n, opp = other(player);
    var mid = (n - 1) / 2;
    var bestScore = -Infinity, best = [];
    var trial = board.clone();
    for (var i = 0; i < n * n; i++) {
      if (board.cells[i] !== EMPTY) continue;
      trial.cells[i] = player;
      var me = measure(trial, player), them = measure(trial, opp);
      trial.cells[i] = EMPTY;

      var score;
      if (me.dist === 0) score = 1e9;                 // winning move
      else if (them.dist >= INF) score = 1e8;         // opponent fully cut off
      else score = 1e4 * (them.dist - me.dist) + 10 * (me.paths - them.paths);

      var r = (i / n) | 0, c = i % n;
      // Centre preference in hex distance on the rhombus.
      var dr = r - mid, dc = c - mid;
      var hexDist = (Math.abs(dr) + Math.abs(dc) + Math.abs(dr + dc)) / 2;
      score -= hexDist;

      if (score > bestScore + 1e-9) { bestScore = score; best = [[r, c]]; }
      else if (Math.abs(score - bestScore) <= 1e-9) best.push([r, c]);
    }
    if (!best.length) return null;
    return best[Math.floor(rng() * best.length)];
  }

  var HexBot = { chooseMove: chooseMove, measure: measure };

  if (typeof module !== "undefined" && module.exports) module.exports = HexBot;
  else root.HexBot = HexBot;
})(typeof self !== "undefined" ? self : this);

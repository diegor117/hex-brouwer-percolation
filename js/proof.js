/* The guided proof that a full Hex board always has a winner (Gale 1979). */

(function () {
  "use strict";

  var N = 6;
  var boardEl = document.getElementById("proof-board");
  var textEl = document.getElementById("proof-text");
  var countEl = document.getElementById("proof-count");
  var backBtn = document.getElementById("proof-back");
  var nextBtn = document.getElementById("proof-next");
  var shuffleBtn = document.getElementById("proof-shuffle");
  var figureEl = document.getElementById("proof-figure");
  var figureSvgEl = document.getElementById("proof-figure-svg");
  var figureCapEl = document.getElementById("proof-figure-caption");

  var reduceMotion = window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  var board, trace, step = 0, animToken = 0;

  var steps = [
    {
      text: "<p>A completely filled board with a random colouring.</p>",
      borders: false
    },
    {
      text: "<p>Add the frame: black rows above and below the board, white columns on the left and right.</p>",
      borders: true
    },
    {
      text: "<p>Draw every fence, that is, every tile edge between a black cell and a white cell, including the frame cells.</p>",
      borders: true, sep: true
    },
    {
      text: "<p>Three cells meet at each vertex. If their colours split two against one, exactly two fences meet there; if all three agree, none do. So an interior vertex has 0 or 2 fences.</p>",
      borders: true, sep: true, figure: true
    },
    {
      text: "<p>Exactly four vertices have one fence, one near each corner. The walk starts at the one in the top-left corner.</p>",
      borders: true, animate: true
    },
    {
      text: "<p>The walk cannot branch and cannot revisit a vertex, and the board is finite, so it ends at one of the other three corners.</p>",
      borders: true, path: true
    },
    {
      text: "<p>The cells of one colour along the walk form a connected set that joins that colour's two edges. It contains a crossing for that player, outlined in red.</p>",
      borders: true, path: true, chain: true
    }
  ];

  function lemmaFigure() {
    var NS = BoardSVG.NS;
    var svg = BoardSVG.el("svg", { viewBox: "-1.3 -1.6 7.4 4.2", width: 330 });
    var cases = [
      { colors: [Hex.BLACK, Hex.WHITE, Hex.BLACK], dx: 0 },
      { colors: [Hex.BLACK, Hex.BLACK, Hex.BLACK], dx: 4.4 }
    ];
    var cells = [[0, 0], [0, 1], [1, 0]];
    cases.forEach(function (cs) {
      var polys = cells.map(function (rc) {
        return Hex.polygonPoints(rc[0], rc[1], 1).map(function (p) {
          return [p[0] + cs.dx, p[1]];
        });
      });
      polys.forEach(function (pts, i) {
        var poly = BoardSVG.el("polygon", {
          points: pts.map(function (p) { return p[0].toFixed(3) + "," + p[1].toFixed(3); }).join(" "),
          "class": "cell noplay " + (cs.colors[i] === Hex.BLACK ? "black" : "white")
        });
        svg.appendChild(poly);
      });
      // Fences: shared edges between differently-coloured cells.
      for (var i = 0; i < 3; i++) {
        for (var j = i + 1; j < 3; j++) {
          if (cs.colors[i] === cs.colors[j]) continue;
          var shared = [];
          polys[i].forEach(function (p) {
            polys[j].forEach(function (q) {
              if (Math.abs(p[0] - q[0]) < 1e-6 && Math.abs(p[1] - q[1]) < 1e-6) shared.push(p);
            });
          });
          if (shared.length === 2) {
            svg.appendChild(BoardSVG.el("line", {
              x1: shared[0][0], y1: shared[0][1], x2: shared[1][0], y2: shared[1][1],
              "class": "trace"
            }));
          }
        }
      }
      // The meeting point of the three tiles.
      svg.appendChild(BoardSVG.el("circle", {
        cx: 0.866 + cs.dx, cy: 0.5, r: 0.13, "class": "corner-dot"
      }));
    });
    return svg;
  }

  function drawSeparatingEdges(view, graph) {
    var drawn = new Set();
    graph.adj.forEach(function (arcs, from) {
      arcs.forEach(function (arc) {
        var key = from < arc.to ? from + "|" + arc.to : arc.to + "|" + from;
        if (drawn.has(key)) return;
        drawn.add(key);
        var p = graph.coords.get(from), q = graph.coords.get(arc.to);
        view.overlay.appendChild(BoardSVG.el("line", {
          x1: p[0], y1: p[1], x2: q[0], y2: q[1], "class": "sep-edge"
        }));
      });
    });
  }

  function drawPath(view, points, animate, done) {
    var poly = BoardSVG.el("polyline", { "class": "trace", points: "" });
    view.overlay.appendChild(poly);
    var token = ++animToken;
    if (!animate || reduceMotion) {
      poly.setAttribute("points", points.map(function (p) { return p[0] + "," + p[1]; }).join(" "));
      if (done) done();
      return;
    }
    var i = 0;
    function tick() {
      if (token !== animToken) return;
      i = Math.min(points.length, i + 2);
      poly.setAttribute("points",
        points.slice(0, i).map(function (p) { return p[0] + "," + p[1]; }).join(" "));
      if (i < points.length) requestAnimationFrame(tick);
      else if (done) done();
    }
    requestAnimationFrame(tick);
  }

  function markCorners(view, graph) {
    graph.endpoints.forEach(function (key) {
      var p = graph.coords.get(key);
      view.overlay.appendChild(BoardSVG.el("circle", {
        cx: p[0], cy: p[1], r: 0.22, "class": "corner-dot"
      }));
    });
  }

  function render() {
    var s = steps[step];
    countEl.textContent = "Step " + (step + 1) + " of " + steps.length;
    textEl.innerHTML = s.text;
    figureEl.hidden = !s.figure;
    if (s.figure) {
      figureSvgEl.textContent = "";
      figureSvgEl.appendChild(lemmaFigure());
      figureCapEl.textContent =
        "Left: colours split two against one, two fences. Right: all three alike, no fence.";
    }
    backBtn.disabled = step === 0;
    nextBtn.disabled = step === steps.length - 1;

    var view = BoardSVG.renderBoard(boardEl, board, {
      borders: s.borders, width: 440,
      label: "A completely filled 6 by 6 Hex board used in the proof"
    });

    if (s.sep || s.animate || s.path) {
      if (s.sep) drawSeparatingEdges(view, trace.graph);
      if (s.animate || s.path) markCorners(view, trace.graph);
      if (s.animate) drawPath(view, trace.points, true);
      if (s.path) drawPath(view, trace.points, false);
    }
    if (s.chain) {
      var w = Hex.winner(board);
      var side = w === Hex.BLACK ? trace.sideCells.black : trace.sideCells.white;
      side.forEach(function (cell) {
        if (cell.r < 0 || cell.r >= N || cell.c < 0 || cell.c >= N) return;
        var poly = view.cellAt(cell.r, cell.c);
        if (poly) poly.classList.add("chain");
      });
    }
  }

  function shuffle() {
    board = Hex.randomFullBoard(N);
    trace = Hex.tracePath(board, 1);
    render();
  }

  backBtn.addEventListener("click", function () { if (step > 0) { step--; render(); } });
  nextBtn.addEventListener("click", function () { if (step < steps.length - 1) { step++; render(); } });
  shuffleBtn.addEventListener("click", shuffle);
  shuffle();
})();

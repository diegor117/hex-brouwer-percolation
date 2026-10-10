/* The percolation simulator: random boards, a running tally, and a
   convergence chart for the frequency of a black crossing. */

(function () {
  "use strict";

  var sizeSel = document.getElementById("perc-size");
  var pSlider = document.getElementById("perc-p");
  var pLabel = document.getElementById("perc-p-label");
  var oneBtn = document.getElementById("perc-one");
  var runBtn = document.getElementById("perc-run");
  var stopBtn = document.getElementById("perc-stop");
  var resetBtn = document.getElementById("perc-reset");
  var boardEl = document.getElementById("perc-board");
  var boardStatus = document.getElementById("perc-board-status");
  var readoutEl = document.getElementById("perc-readout");
  var chartCanvas = document.getElementById("perc-chart");
  var ctx = chartCanvas.getContext("2d");

  var css = function (name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  };
  var COL = {
    accent: css("--accent") || "#c62828",
    ink: css("--text") || "#222222",
    muted: css("--muted") || "#6e6a5d",
    grid: css("--border-soft") || "#e5e5e5"
  };

  var tally = { trials: 0, black: 0, series: [] }; // series: [trials, freq]
  var running = false;
  var lastBoardDrawn = 0;

  function p() { return parseInt(pSlider.value, 10) / 100; }
  function n() { return parseInt(sizeSel.value, 10); }

  function resetTally() {
    tally = { trials: 0, black: 0, series: [] };
    updateReadout();
    drawChart();
  }

  function sampleOne(render) {
    var board = Hex.randomFullBoard(n(), p());
    var w = Hex.winner(board);
    tally.trials++;
    if (w === Hex.BLACK) tally.black++;
    if (tally.series.length < 4000 || tally.trials % 25 === 0) {
      tally.series.push([tally.trials, tally.black / tally.trials]);
    }
    if (render) renderBoard(board, w);
    return w;
  }

  function renderBoard(board, w) {
    var view = BoardSVG.renderBoard(boardEl, board, {
      borders: true, width: 380,
      label: "A randomly coloured " + board.n + " by " + board.n + " Hex board"
    });
    var chain = Hex.winningChain(board, w);
    if (chain) chain.forEach(function (rc) {
      var poly = view.cellAt(rc[0], rc[1]);
      if (poly) poly.classList.add("chain");
    });
    boardStatus.innerHTML = w === Hex.BLACK
      ? "<strong>Black</strong> crosses top to bottom on this board."
      : "<strong>White</strong> crosses left to right on this board.";
  }

  function updateReadout() {
    var freq = tally.trials ? tally.black / tally.trials : NaN;
    var se = tally.trials ? Math.sqrt(freq * (1 - freq) / tally.trials) : NaN;
    var exact = Math.abs(p() - 0.5) < 1e-9
      ? "1/2 exactly (Theorem 4.1)"
      : "no closed form; \u03b8(p) + \u03b8(1 \u2212 p) = 1";
    var row = function (k, v) { return "<tr><td>" + k + "</td><td>" + v + "</td></tr>"; };
    readoutEl.innerHTML = "<table>" +
      row("boards sampled", tally.trials.toLocaleString()) +
      row("with a black crossing", tally.black.toLocaleString()) +
      row("frequency", tally.trials ? freq.toFixed(4) + " \u00b1 " + se.toFixed(4) : "n/a") +
      row("exact probability", exact) +
      "</table>";
  }

  function drawChart() {
    var W = chartCanvas.width, H = chartCanvas.height;
    var padL = 44, padR = 12, padT = 10, padB = 28;
    var plotW = W - padL - padR, plotH = H - padT - padB;
    ctx.clearRect(0, 0, W, H);

    ctx.font = "13px ui-monospace, Menlo, monospace";
    ctx.fillStyle = COL.muted;
    ctx.strokeStyle = COL.grid;
    ctx.lineWidth = 1;
    [0, 0.25, 0.5, 0.75, 1].forEach(function (v) {
      var y = padT + (1 - v) * plotH;
      ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(W - padR, y); ctx.stroke();
      ctx.fillText(v.toFixed(2), 4, y + 4);
    });

    // Reference line at 1/2.
    var yHalf = padT + 0.5 * plotH;
    ctx.save();
    ctx.setLineDash([6, 5]);
    ctx.strokeStyle = COL.ink;
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(padL, yHalf); ctx.lineTo(W - padR, yHalf); ctx.stroke();
    ctx.restore();
    ctx.fillStyle = COL.ink;
    ctx.fillText("1/2", W - padR - 26, yHalf - 6);

    var maxT = Math.max(100, tally.trials);
    ctx.fillStyle = COL.muted;
    ctx.fillText("0", padL, H - 8);
    var maxLabel = maxT.toLocaleString() + " boards";
    ctx.fillText(maxLabel, W - padR - ctx.measureText(maxLabel).width, H - 8);

    if (tally.series.length > 1) {
      ctx.strokeStyle = COL.accent;
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (var i = 0; i < tally.series.length; i++) {
        var x = padL + (tally.series[i][0] / maxT) * plotW;
        var y = padT + (1 - tally.series[i][1]) * plotH;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  }

  function runBatch(remaining) {
    if (!running) return;
    var chunk = Math.min(remaining, n() >= 30 ? 60 : 250);
    var lastBoard = null, lastW = null;
    for (var i = 0; i < chunk; i++) {
      lastBoard = Hex.randomFullBoard(n(), p());
      lastW = Hex.winner(lastBoard);
      tally.trials++;
      if (lastW === Hex.BLACK) tally.black++;
      if (tally.series.length < 4000 || tally.trials % 25 === 0) {
        tally.series.push([tally.trials, tally.black / tally.trials]);
      }
    }
    var now = performance.now();
    if (now - lastBoardDrawn > 400 && lastBoard) {
      renderBoard(lastBoard, lastW);
      lastBoardDrawn = now;
    }
    updateReadout();
    drawChart();
    remaining -= chunk;
    if (remaining > 0) requestAnimationFrame(function () { runBatch(remaining); });
    else stopRun();
  }

  function startRun() {
    running = true;
    runBtn.disabled = true;
    stopBtn.disabled = false;
    runBatch(10000);
  }
  function stopRun() {
    running = false;
    runBtn.disabled = false;
    stopBtn.disabled = true;
  }

  pSlider.addEventListener("input", function () {
    pLabel.textContent = p().toFixed(2);
    stopRun();
    resetTally();
  });
  sizeSel.addEventListener("change", function () { stopRun(); resetTally(); });
  oneBtn.addEventListener("click", function () { sampleOne(true); updateReadout(); drawChart(); });
  runBtn.addEventListener("click", startRun);
  stopBtn.addEventListener("click", stopRun);
  resetBtn.addEventListener("click", function () { stopRun(); resetTally(); });

  sampleOne(true);
  updateReadout();
  drawChart();
})();

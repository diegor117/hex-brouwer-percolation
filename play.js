/* The playable board. Black moves first. Two people at one computer, or
   one person against the computer (js/bot.js). */

(function () {
  "use strict";

  var boardEl = document.getElementById("play-board");
  var statusEl = document.getElementById("play-status");
  var sizeSel = document.getElementById("play-size");
  var oppSel = document.getElementById("play-opponent");
  var newBtn = document.getElementById("play-new");
  var undoBtn = document.getElementById("play-undo");

  var board, turn, history, finished, view, botColor, botTimer = null;

  function playerName(p) { return p === Hex.BLACK ? "Black" : "White"; }
  function other(p) { return p === Hex.BLACK ? Hex.WHITE : Hex.BLACK; }

  function setStatus(html) { statusEl.innerHTML = html; }

  function botTurn() { return !finished && botColor === turn; }

  function render() {
    view = BoardSVG.renderBoard(boardEl, board, {
      interactive: !finished && !botTurn(),
      borders: true,
      width: Math.min(560, 52 * board.n + 80),
      label: "Hex board, " + board.n + " by " + board.n,
      onCellClick: humanMove
    });
    if (history.length) {
      var last = history[history.length - 1];
      var lastPoly = view.cellAt(last[0], last[1]);
      if (lastPoly) lastPoly.classList.add("last");
    }
    if (finished) {
      var w = Hex.winner(board);
      var chain = Hex.winningChain(board, w);
      if (chain) chain.forEach(function (rc) {
        var poly = view.cellAt(rc[0], rc[1]);
        if (poly) poly.classList.add("chain");
      });
    }
  }

  function describeTurn() {
    if (botColor && turn === botColor) return "Computer (" + playerName(turn) + ") is thinking…";
    if (botColor) return "Your move (" + playerName(turn) + ").";
    return playerName(turn) + " to move.";
  }

  function place(r, c) {
    board.set(r, c, turn);
    history.push([r, c]);
    var w = Hex.winner(board);
    if (w) {
      finished = true;
      var who = !botColor ? playerName(w)
        : w === botColor ? "The computer (" + playerName(w) + ")"
        : "You (" + playerName(w) + ")";
      setStatus("<strong>" + who + " win" + (who.indexOf("You") === 0 ? "" : "s") +
                ".</strong> The winning chain is outlined.");
    } else {
      turn = other(turn);
      setStatus(describeTurn());
    }
    render();
    scheduleBot();
  }

  function humanMove(r, c) {
    if (finished || botTurn() || board.get(r, c) !== Hex.EMPTY) return;
    place(r, c);
  }

  function scheduleBot() {
    if (botTimer) { clearTimeout(botTimer); botTimer = null; }
    if (!botTurn()) return;
    botTimer = setTimeout(function () {
      botTimer = null;
      if (!botTurn()) return;
      var mv = HexBot.chooseMove(board, turn);
      if (mv) place(mv[0], mv[1]);
    }, 350);
  }

  function readOpponent() {
    var v = oppSel ? oppSel.value : "human";
    botColor = v === "bot-white" ? Hex.WHITE : v === "bot-black" ? Hex.BLACK : 0;
  }

  function newGame() {
    readOpponent();
    var n = parseInt(sizeSel.value, 10);
    board = new Hex.Board(n);
    turn = Hex.BLACK;
    history = [];
    finished = false;
    setStatus(describeTurn());
    render();
    scheduleBot();
  }

  function undoOne() {
    var last = history.pop();
    board.set(last[0], last[1], Hex.EMPTY);
    if (finished) finished = false;
    // After a win `turn` still holds the winner, i.e. the player who moved last.
    else turn = other(turn);
  }

  function undo() {
    if (botTimer) { clearTimeout(botTimer); botTimer = null; }
    if (!history.length) return;
    undoOne();
    // Against the computer, rewind until it is the person's move again.
    while (botColor && turn === botColor && history.length) undoOne();
    setStatus(describeTurn());
    render();
    scheduleBot();   // e.g. computer plays Black and the board is now empty
  }

  sizeSel.addEventListener("change", newGame);
  if (oppSel) oppSel.addEventListener("change", newGame);
  newBtn.addEventListener("click", newGame);
  undoBtn.addEventListener("click", undo);
  newGame();
})();

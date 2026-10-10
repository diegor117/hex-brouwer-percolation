/* The playable board. Hot-seat, Black moves first. */

(function () {
  "use strict";

  var boardEl = document.getElementById("play-board");
  var statusEl = document.getElementById("play-status");
  var sizeSel = document.getElementById("play-size");
  var newBtn = document.getElementById("play-new");
  var undoBtn = document.getElementById("play-undo");

  var board, turn, history, finished, view;

  function playerName(p) { return p === Hex.BLACK ? "Black" : "White"; }

  function setStatus(html) { statusEl.innerHTML = html; }

  function render() {
    view = BoardSVG.renderBoard(boardEl, board, {
      interactive: !finished,
      borders: true,
      width: Math.min(560, 52 * board.n + 80),
      label: "Hex board, " + board.n + " by " + board.n,
      onCellClick: move
    });
    if (finished) {
      var w = Hex.winner(board);
      var chain = Hex.winningChain(board, w);
      if (chain) chain.forEach(function (rc) {
        var poly = view.cellAt(rc[0], rc[1]);
        if (poly) poly.classList.add("chain");
      });
    }
  }

  function move(r, c) {
    if (finished || board.get(r, c) !== Hex.EMPTY) return;
    board.set(r, c, turn);
    history.push([r, c]);
    var w = Hex.winner(board);
    if (w) {
      finished = true;
      setStatus("<strong>" + playerName(w) + " wins.</strong> The winning chain is outlined.");
    } else {
      turn = turn === Hex.BLACK ? Hex.WHITE : Hex.BLACK;
      setStatus(playerName(turn) + " to move.");
    }
    render();
  }

  function newGame() {
    var n = parseInt(sizeSel.value, 10);
    board = new Hex.Board(n);
    turn = Hex.BLACK;
    history = [];
    finished = false;
    setStatus("Black to move.");
    render();
  }

  function undo() {
    if (!history.length) return;
    var last = history.pop();
    board.set(last[0], last[1], Hex.EMPTY);
    if (finished) finished = false;
    else turn = turn === Hex.BLACK ? Hex.WHITE : Hex.BLACK;
    setStatus(playerName(turn) + " to move.");
    render();
  }

  sizeSel.addEventListener("change", newGame);
  newBtn.addEventListener("click", newGame);
  undoBtn.addEventListener("click", undo);
  newGame();
})();

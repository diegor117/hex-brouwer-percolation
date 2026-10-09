/* Shared SVG rendering for Hex boards. */

(function () {
  "use strict";

  var NS = "http://www.w3.org/2000/svg";

  function el(name, attrs) {
    var node = document.createElementNS(NS, name);
    for (var k in attrs) node.setAttribute(k, attrs[k]);
    return node;
  }

  // Draw a board into `container`, replacing previous content.
  // opts: { size, borders (bool), onCellClick(r,c), interactive (bool), pad }
  // Returns { svg, cellAt(r,c) -> polygon element, overlay (a <g> for extras),
  //           toView([x,y]) -> same coords (logic units = view units) }
  function renderBoard(container, board, opts) {
    opts = opts || {};
    var size = opts.size || 1;
    var n = board.n;

    var cells = [];
    for (var r = 0; r < n; r++)
      for (var c = 0; c < n; c++)
        cells.push({ r: r, c: c, color: board.get(r, c), border: false });
    if (opts.borders) {
      Hex.borderCells(n).forEach(function (b) {
        cells.push({ r: b.r, c: b.c, color: b.color, border: true });
      });
    }

    var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    cells.forEach(function (cell) {
      Hex.polygonPoints(cell.r, cell.c, size).forEach(function (p) {
        minX = Math.min(minX, p[0]); maxX = Math.max(maxX, p[0]);
        minY = Math.min(minY, p[1]); maxY = Math.max(maxY, p[1]);
      });
    });
    var pad = (opts.pad !== undefined ? opts.pad : 0.25) * size;

    var svg = el("svg", {
      viewBox: (minX - pad) + " " + (minY - pad) + " " +
               (maxX - minX + 2 * pad) + " " + (maxY - minY + 2 * pad),
      width: opts.width || 520,
      role: "img"
    });
    if (opts.label) svg.setAttribute("aria-label", opts.label);

    var cellLayer = el("g", {});
    svg.appendChild(cellLayer);
    var overlay = el("g", {});

    var cellMap = {};
    cells.forEach(function (cell) {
      var pts = Hex.polygonPoints(cell.r, cell.c, size)
        .map(function (p) { return p[0].toFixed(3) + "," + p[1].toFixed(3); })
        .join(" ");
      var poly = el("polygon", { points: pts });
      var cls;
      if (cell.border) {
        cls = "border-cell";
        poly.setAttribute("fill", cell.color === Hex.BLACK
          ? "var(--stone-black)" : "var(--stone-white)");
      } else {
        cls = "cell " + (cell.color === Hex.BLACK ? "black"
                       : cell.color === Hex.WHITE ? "white" : "empty");
        if (!opts.interactive) cls += " noplay";
      }
      poly.setAttribute("class", cls);
      if (!cell.border && opts.interactive && opts.onCellClick) {
        (function (r, c) {
          poly.addEventListener("click", function () { opts.onCellClick(r, c); });
        })(cell.r, cell.c);
      }
      cellLayer.appendChild(poly);
      if (!cell.border) cellMap[cell.r + "," + cell.c] = poly;
    });

    svg.appendChild(overlay);
    container.textContent = "";
    container.appendChild(svg);

    return {
      svg: svg,
      overlay: overlay,
      cellAt: function (r, c) { return cellMap[r + "," + c]; },
      el: el
    };
  }

  window.BoardSVG = { renderBoard: renderBoard, el: el, NS: NS };
})();

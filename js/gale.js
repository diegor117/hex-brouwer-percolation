/* Gale's colouring, drawn live. For a chosen continuous map f of the unit
   square and a chosen epsilon, each cell is classified exactly as the proof
   classifies it:
     white  - |f1(x) - x1| >= eps   (White joins left to right)
     black  - else |f2(x) - x2| >= eps   (Black joins top to bottom)
     blank  - neither: an approximate fixed point.
   The proof says White can never span left-right and Black can never span
   top-bottom, so blank cells must exist. */

(function () {
  "use strict";

  var canvas = document.getElementById("gale-canvas");
  var ctx = canvas.getContext("2d");
  var mapSel = document.getElementById("gale-map");
  var meshSel = document.getElementById("gale-mesh");
  var epsSlider = document.getElementById("gale-eps");
  var epsLabel = document.getElementById("gale-eps-label");
  var statusEl = document.getElementById("gale-status");

  var maps = Maps;

  function css(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }
  var COLORS = {
    black: css("--stone-black") || "#1c1e22",
    white: css("--stone-white") || "#ffffff",
    gold: css("--gold-fill") || "#e8c45a",
    line: css("--line") || "#d4cebe",
    ink: css("--ink") || "#191b1f"
  };

  function eps() { return parseInt(epsSlider.value, 10) / 1000; }

  function draw() {
    var f = maps[mapSel.value];
    var m = parseInt(meshSel.value, 10);
    var e = eps();
    var W = canvas.width, H = canvas.height;
    var cw = W / m, ch = H / m;

    var blanks = 0, minDisp = Infinity, minCell = null;
    // Largest distance f moves two adjacent centres apart. The argument
    // needs this below eps (that is the mesh condition delta < eps); when it
    // is not, the colouring simply is not covered by the proof.
    var maxJump = 0;
    var at = function (i, j) {
      var x = (i + 0.5) / m, y = (j + 0.5) / m;
      return f(x, y);
    };
    for (var jj = 0; jj < m; jj++) {
      for (var ii = 0; ii < m; ii++) {
        var a = at(ii, jj);
        if (ii + 1 < m) {
          var rgt = at(ii + 1, jj);
          maxJump = Math.max(maxJump, Math.hypot(a[0] - rgt[0], a[1] - rgt[1]));
        }
        if (jj + 1 < m) {
          var up = at(ii, jj + 1);
          maxJump = Math.max(maxJump, Math.hypot(a[0] - up[0], a[1] - up[1]));
        }
      }
    }
    var hypothesisHolds = maxJump < e;

    ctx.clearRect(0, 0, W, H);
    for (var j = 0; j < m; j++) {
      for (var i = 0; i < m; i++) {
        var x = (i + 0.5) / m, y = (j + 0.5) / m;
        var fx = f(x, y);
        var dx = fx[0] - x, dy = fx[1] - y;
        var d = Math.sqrt(dx * dx + dy * dy);
        if (d < minDisp) { minDisp = d; minCell = [i, j]; }

        var color;
        if (Math.abs(dx) >= e) color = COLORS.white;
        else if (Math.abs(dy) >= e) color = COLORS.black;
        else { color = COLORS.gold; blanks++; }

        ctx.fillStyle = color;
        // y flipped so the unit square reads the usual way up.
        ctx.fillRect(i * cw, H - (j + 1) * ch, Math.ceil(cw), Math.ceil(ch));
      }
    }

    ctx.strokeStyle = COLORS.line;
    ctx.lineWidth = 1;
    for (var k = 0; k <= m; k++) {
      ctx.beginPath(); ctx.moveTo(k * cw, 0); ctx.lineTo(k * cw, H); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, k * ch); ctx.lineTo(W, k * ch); ctx.stroke();
    }

    var px = (minCell[0] + 0.5) * cw, py = H - (minCell[1] + 0.5) * ch;
    ctx.beginPath();
    ctx.arc(px, py, Math.max(cw, 14), 0, 2 * Math.PI);
    ctx.lineWidth = 3;
    ctx.strokeStyle = COLORS.ink;
    ctx.stroke();

    if (!hypothesisHolds) {
      statusEl.innerHTML = "Mesh too coarse for this \u03b5: adjacent centres land " +
        "<span class=\"num\">" + maxJump.toFixed(3) + "</span> apart under " +
        "<i>f</i>, which must stay below \u03b5. Refine the mesh or raise \u03b5 \u2014 " +
        "the argument says nothing here.";
    } else {
      statusEl.innerHTML = "Mesh fine enough (<span class=\"num\">" + maxJump.toFixed(3) +
        "</span> &lt; \u03b5). Blank cells: <span class=\"num\">" + blanks +
        "</span> \u2014 the argument guarantees at least one.";
    }
  }

  epsSlider.addEventListener("input", function () {
    epsLabel.textContent = eps().toFixed(3);
    draw();
  });
  mapSel.addEventListener("change", draw);
  meshSel.addEventListener("change", draw);
  epsLabel.textContent = eps().toFixed(3);
  draw();
})();

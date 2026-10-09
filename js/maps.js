/* Sample continuous self-maps of the unit square, shared by the Brouwer
   widget and the test suite so that what is tested is what is displayed. */

(function (root) {
  "use strict";

  function clamp01(t) { return Math.max(0, Math.min(1, t)); }

  var Maps = {
    swirl: function (x, y) {
      var dx = x - 0.5, dy = y - 0.5;
      var r = Math.sqrt(dx * dx + dy * dy);
      var a = Math.atan2(dy, dx) + 0.9;
      var r2 = r * 0.75;
      return [clamp01(0.5 + r2 * Math.cos(a)), clamp01(0.5 + r2 * Math.sin(a))];
    },
    shear: function (x, y) {
      return [clamp01(0.15 + 0.7 * x + 0.25 * (y - 0.5)),
              clamp01(0.5 + 0.55 * (y - 0.5) - 0.3 * (x - 0.5))];
    },
    fold: function (x, y) {
      return [clamp01(0.85 - 0.6 * Math.abs(x - 0.35) + 0.1 * y),
              clamp01(0.8 - 0.55 * y + 0.12 * Math.sin(5 * x))];
    }
  };

  if (typeof module !== "undefined" && module.exports) module.exports = Maps;
  else root.Maps = Maps;
})(typeof self !== "undefined" ? self : this);

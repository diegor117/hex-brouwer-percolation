# Hex, Brouwer, and the fairest coin

An interactive explainer connecting three pieces of classical mathematics:

1. **The Hex theorem** — a completely filled Hex board always has exactly one
   winner; the game cannot end in a draw.
2. **Gale's equivalence** — David Gale's 1979 observation that the Hex theorem
   and Brouwer's fixed-point theorem (in the plane) follow from each other by
   elementary arguments.
3. **An exact probability** — on a square n × n board where each cell is
   independently black with probability ½, the probability of a black
   top-to-bottom crossing is exactly ½, for every n. The proof is two lines
   once the Hex theorem is in hand.

The site lets you play Hex, walks through Gale's path-following proof of the
no-draw theorem step by step on a live board, visualises the colouring at the
heart of the Brouwer argument, and ends with a Monte Carlo simulator whose
frequency pins itself to the line at ½.

This is exposition of existing mathematics, not new research. Nothing here is
original except the presentation.

## Running it

No build step, no dependencies. Open `index.html` in a browser, or serve the
directory with anything (`python3 -m http.server`).

To publish on GitHub Pages: push this repository, then in the repository
settings enable Pages from the `main` branch, root folder. The site is static
and works as-is.

## Structure

```
index.html          the whole write-up and all four interactive sections
css/style.css       one light theme
js/hex.js           board logic: state, win detection, Gale path trace
                    (no DOM code — the same file runs under Node for tests)
js/maps.js          the sample continuous self-maps of the square, shared by
                    the Brouwer widget and the tests
js/board-svg.js     shared SVG board renderer
js/play.js          the playable board (hot-seat)
js/proof.js         the guided no-draw proof
js/gale.js          the Brouwer colouring widget
js/percolation.js   random boards, tally, convergence chart
test/logic.test.js  the checks described below
```

## What the tests verify

Run with:

```
node test/logic.test.js
```

- **Exhaustive enumeration** of all 2^(n²) colourings for n = 2, 3, 4:
  every full board has exactly one winner, and exactly half of all colourings
  contain a black crossing. This verifies both the Hex theorem and the ½
  result exactly, with no sampling, on small boards.
- **Random full boards** (2 000 boards, n = 5…11): a black crossing exists
  if and only if a white crossing does not, checked by two independent
  methods (union-find and BFS) that must agree.
- **The Gale path trace** (1 000 boards, n = 4…9): the separating-edge walk
  always has exactly four possible endpoints, always terminates corner to
  corner, and the cells of the winning colour along the path always contain a
  full crossing — i.e. the constructive proof the site animates really does
  produce a winning chain on every board.
- **Monte Carlo sanity** (20 000 boards, 11 × 11, p = ½): the sampled
  crossing frequency lies within 5 standard errors of ½.
- **The Brouwer colouring** (27 combinations of map, mesh and ε): a real
  Hex board is coloured from a real continuous self-map of the square by the
  rule in the write-up. The test first verifies the hypothesis numerically —
  adjacent cell centres really do land within ε of each other under f — and
  then asserts the conclusion with the same win detection used everywhere
  else: *neither* player has a crossing, and so at least one cell is left
  blank. Each blank cell is checked to move less than ε√2, i.e. to be a
  genuine approximate fixed point.

## Status of each mathematical claim

- *No draws* (at least one winner): proven in full on the site, following
  Gale (1979).
- *At most one winner*: argued informally on the site (the "wall" intuition)
  and cited to Huneke (2014), who gives a short inductive proof. This is the
  one claim the site leans on a citation for.
- *Hex ⇒ Brouwer*: proven in full on the site. The mesh condition (δ < ε)
  that both steps depend on is stated explicitly, and
  the pairing of players with directions — the horizontal pushers are given
  the *horizontal* crossing — is called out, because the argument is false
  without it. An earlier draft of this page had that pairing backwards; the
  test suite now contains a case (the "fold" map) that produces a winning
  crossing under the wrong pairing, so the error cannot silently return.
- *Crossing probability exactly ½ on square boards at p = ½*: proven in full
  on the site (no-draw theorem + transpose-and-swap symmetry), and verified
  exhaustively by the test suite for n ≤ 4.
- *p = ½ is the critical probability of this lattice; Cardy's formula
  (Smirnov 2001)*: stated as cited context only; nothing on the site depends
  on it.

## Sources

- David Gale, *The Game of Hex and the Brouwer Fixed-Point Theorem*,
  The American Mathematical Monthly 86 (10), 1979, pp. 818–827.
- Craig Huneke, *An Inductive Proof of Hex Uniqueness*, The American
  Mathematical Monthly 121 (1), 2014, pp. 78–80.
- Martin Gardner, Mathematical Games, Scientific American, July 1957;
  reprinted in *The Scientific American Book of Mathematical Puzzles and
  Diversions*, 1959.
- Ryan B. Hayward and Bjarne Toft, *Hex: The Full Story*, CRC Press, 2019.
- Stanislav Smirnov, *Critical percolation in the plane*, C. R. Acad. Sci.
  Paris Sér. I Math. 333 (3), 2001, pp. 239–244.
- Béla Bollobás and Oliver Riordan, *Percolation*, Cambridge University
  Press, 2006.

## Authors

- Diego Rapini
- Luigi Lanni
- Massimiliano Iorio

The mathematics is classical; the exposition is ours. Built with AI assistance (Claude).

## License

MIT — see `LICENSE`.

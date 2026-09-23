/* STUB (Phase 1 step 1): a hardcoded grid spec. Replaced in Phase 2 by
   js/generators/, which produce the same shape from validated config.
   Values are the reference `2 x 1 addition` grid in docs/generation.md
   (row walk start 12, columns 7 5 9 4 6) so later steps can verify against it. */

window.SOM = window.SOM || {};

window.SOM.stubSpec = {
  name: "2 x 1 addition",
  operator: "add",
  answerFormat: "integer",
  seconds: 300,
  rows: [12, 49, 76, 33, 60, 97, 24, 51],
  cols: [7, 5, 9, 4, 6],
  answers: [
    [19, 17, 21, 16, 18],
    [56, 54, 58, 53, 55],
    [83, 81, 85, 80, 82],
    [40, 38, 42, 37, 39],
    [67, 65, 69, 64, 66],
    [104, 102, 106, 101, 103],
    [31, 29, 33, 28, 30],
    [58, 56, 60, 55, 57]
  ]
};

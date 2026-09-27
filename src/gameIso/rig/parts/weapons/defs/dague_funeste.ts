import type { WeaponDef } from '../types';

export const weapon: WeaponDef = {
  slug: "dague_funeste",
  label: "Dague Funeste",
  type: "melee",
  group: "Base",
  target: "dague à lame courbe en serre de cockatrice, métal verdâtre maladif",
  art: "<path d=\"M-2 4 L2 4 L2.4 -3 L-2.4 -3 Z\" fill=\"@cuir\" stroke=\"@cuirO\" stroke-width=\"0.4\"/><path d=\"M-1.6 4 q-1 2 0 3.6 q1.6 2 0 3.4 q-1 0.6 0 1.4 M1.6 4 q1 2 0 3.6 q-1.6 2 0 3.4 q1 0.6 0 1.4\" stroke=\"@cuirO\" stroke-width=\"0.5\" fill=\"none\"/><circle cx=\"0\" cy=\"10\" r=\"2.6\" fill=\"@accentO\" stroke=\"@metalO\" stroke-width=\"0.5\"/><circle cx=\"0\" cy=\"10\" r=\"1\" fill=\"@accent\"/><!-- garde griffue, branches recourbees vers le haut --><path d=\"M-8 -2 Q-9 -5 -7 -6 Q-5 -3 -2 -2 L2 -2 Q5 -3 7 -6 Q9 -5 8 -2 Q4 -4 0 -4 Q-4 -4 -8 -2 Z\" fill=\"@metal\" stroke=\"@metalO\" stroke-width=\"0.5\"/><!-- lame COURBE en serre, concave, pointe crochue verdatre --><path d=\"M-2.6 -4 Q-3.4 -16 -1 -26 Q2 -34 1 -22 Q0.6 -10 2 -4 Z\" fill=\"@metal\" stroke=\"@metalO\" stroke-width=\"0.5\"/><!-- ourlet verdatre maladif le long du tranchant --><path d=\"M-2.4 -5 Q-3.2 -16 -0.8 -25 Q1.6 -32 0.8 -23\" fill=\"none\" stroke=\"@venin\" stroke-width=\"0.9\" opacity=\"0.85\"/><!-- reflet central --><path d=\"M-0.6 -6 Q-1 -16 0.4 -24\" fill=\"none\" stroke=\"@metalH\" stroke-width=\"0.5\" opacity=\"0.55\"/>",
  palette: {"metalO":"#1e2a22","metalH":"#cfe6d2","metal":"#8ca896","cuir":"#3a4a30","cuirO":"#1c2418","accentO":"#4a6a40","accent":"#9ad06a","venin":"#7ad24a"},
};

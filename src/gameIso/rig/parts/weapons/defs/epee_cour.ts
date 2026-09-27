import type { WeaponDef } from '../types';

export const weapon: WeaponDef = {
  slug: "epee_cour",
  label: "Épée de cour",
  type: "melee",
  group: "Escrime",
  target: "épée de cour fine et sobre, simple coquille, plus courte qu'une rapière",
  art: "<!-- Epee de cour : smallsword sobre, coquille simple, lame courte --><!-- pommeau spherique --><circle cx=\"0\" cy=\"6.5\" r=\"2.4\" fill=\"@metalO\" stroke=\"@metalO\" stroke-width=\"0.5\"/><ellipse cx=\"-0.8\" cy=\"5.6\" rx=\"0.8\" ry=\"1.1\" fill=\"@metalH\" opacity=\"0.6\"/><!-- poignee filee courte --><rect x=\"-1.4\" y=\"-1\" width=\"2.8\" height=\"7\" rx=\"1.1\" fill=\"@cuirO\" stroke=\"#2a1a0c\" stroke-width=\"0.4\"/><line x1=\"-1.3\" y1=\"0.8\" x2=\"1.3\" y2=\"1.8\" stroke=\"@cuirH\" stroke-width=\"0.5\"/><line x1=\"-1.3\" y1=\"3\" x2=\"1.3\" y2=\"4\" stroke=\"@cuirH\" stroke-width=\"0.5\"/><!-- coquille simple (petite valve unique, pas de panier ouvrage) --><path d=\"M-1.4 -2 Q-6 -2.6 -6 -7 Q-6 -10 -1.4 -10 Z\" fill=\"@accent\" fill-opacity=\"0.4\" stroke=\"@accentO\" stroke-width=\"0.6\"/><path d=\"M1.4 -2 Q5.6 -2.4 6 -7 Q6.2 -10 1.4 -10\" fill=\"none\" stroke=\"@accentO\" stroke-width=\"0.9\" stroke-linecap=\"round\"/><!-- quillon droit court et fin --><path d=\"M-3.2 -2 Q0 -3 3.2 -2 L3 -0.8 Q0 -1.6 -3 -0.8 Z\" fill=\"@accent\" stroke=\"@cuirO\" stroke-width=\"0.4\"/><!-- lame COURTE, fine, triangulaire, pointe aigue --><path d=\"M-1.1 -3 L-0.6 -30 L0 -33 L0.6 -30 L1.1 -3 Z\" fill=\"@metal\" stroke=\"@metalO\" stroke-width=\"0.4\"/><line x1=\"0\" y1=\"-4\" x2=\"0\" y2=\"-31\" stroke=\"@metalH\" stroke-width=\"0.5\" opacity=\"0.8\"/>",
  palette: {"cuir":"#5a3f24","metalO":"#2a3038","metalH":"#cfd8e6","metal":"#9aa6b8","cuirO":"#4a3018","cuirH":"#caa46a","accentO":"#9a8038","accent":"#c0b070"},
};

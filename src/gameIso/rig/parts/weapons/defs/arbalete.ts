import type { WeaponDef } from '../types';

export const weapon: WeaponDef = {
  slug: "arbalete",
  label: "Arbalète",
  type: "ranged",
  group: "Arbalète",
  target: "arbalète : arc transversal + fût + étrier",
  art: "<path d=\"M-3.4 -28 Q-3 6 -2.4 6 L2.4 6 Q3 6 3.4 -28 Q2.4 -34 0 -34 Q-2.4 -34 -3.4 -28 Z\" fill=\"@cuir\" stroke=\"@cuirO\" stroke-width=\"0.6\"/><rect x=\"-0.9\" y=\"-31\" width=\"1.8\" height=\"35\" rx=\"0.6\" fill=\"@cuirO\" opacity=\"0.7\"/><rect x=\"-5.4\" y=\"-31\" width=\"10.8\" height=\"6.4\" rx=\"2.2\" fill=\"@cuir\" stroke=\"@cuirO\" stroke-width=\"0.6\"/><rect x=\"-5.4\" y=\"-30\" width=\"10.8\" height=\"1.6\" fill=\"@cuirH\" opacity=\"0.7\"/><path d=\"M-16 -23 Q-12 -30 -5 -29 L5 -29 Q12 -30 16 -23\" stroke=\"#2f2114\" stroke-width=\"5\" fill=\"none\" stroke-linecap=\"round\"/><path d=\"M-15.6 -23.8 Q-12 -30.6 -5 -29.7 L5 -29.7 Q12 -30.6 15.6 -23.8\" stroke=\"@metal\" stroke-width=\"1.7\" fill=\"none\" stroke-linecap=\"round\"/><path d=\"M-16 -22 L-0.3 -27.4\" stroke=\"@accent\" stroke-width=\"1.1\" fill=\"none\" stroke-linecap=\"round\"/><path d=\"M16 -22 L0.3 -27.4\" stroke=\"@accent\" stroke-width=\"1.1\" fill=\"none\" stroke-linecap=\"round\"/><circle cx=\"0\" cy=\"-27.6\" r=\"2.3\" fill=\"@metalH\" stroke=\"@metalO\" stroke-width=\"0.5\"/><rect x=\"-0.9\" y=\"-46\" width=\"1.8\" height=\"19\" fill=\"@cuir\"/><path d=\"M0 -50 L2.4 -43.5 L-2.4 -43.5 Z\" fill=\"@metalH\" stroke=\"@metalO\" stroke-width=\"0.4\"/><path d=\"M0 -30.5 l3.4 1.7 -3.4 1.5 z M0 -30.5 l-3.4 1.7 3.4 1.5 z\" fill=\"@or\"/><path d=\"M-2 -16 Q-5 -14 -4.4 -10 L-2 -11 Z\" fill=\"@metal\" stroke=\"@metalO\" stroke-width=\"0.4\"/><path d=\"M-5.6 4.5 Q-6.2 5 -6.2 8 Q-6.2 15 0 15 Q6.2 15 6.2 8 Q6.2 5 5.6 4.5\" stroke=\"@metal\" stroke-width=\"2.8\" fill=\"none\" stroke-linecap=\"round\"/><line x1=\"-4.4\" y1=\"7.5\" x2=\"4.4\" y2=\"7.5\" stroke=\"@metal\" stroke-width=\"1.4\" stroke-linecap=\"round\"/>",
  palette: {"metalO":"#2a3038","metal":"#676f80","metalH":"#9aa6b8","cuir":"#5a3f24","cuirO":"#33241a","cuirH":"#8a6a3a","accent":"#ece3cf","or":"#caa64a"},
};

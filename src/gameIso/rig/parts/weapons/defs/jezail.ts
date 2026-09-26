import type { WeaponDef } from '../types';

export const weapon: WeaponDef = {
  slug: "jezail",
  label: "Jezaïl à malepierre",
  type: "ranged",
  group: "Poudre noire",
  target: "long mousquet à crosse recourbée + reflets verts de malepierre (warpstone)",
  art: "<g stroke=\"#2a2018\" stroke-width=\"0.5\"><path d=\"M-3 -8 L4 -8 L5 6 Q6 12 0 13 Q-9 14 -11 6 Q-12 1 -7 -2 L-5 -3 Z\" fill=\"@cuirO\"/><path d=\"M-7 2 Q-2 -1 3 -4\" fill=\"none\" stroke=\"@cuir\" stroke-width=\"0.8\"/><path d=\"M-3 -8 L4 -8 L3.4 -16 L-2.4 -16 Z\" fill=\"@cuir\"/><rect x=\"-3\" y=\"-50\" width=\"5.4\" height=\"35\" rx=\"1.6\" fill=\"@cuir\"/><rect x=\"-2.6\" y=\"-58\" width=\"4.4\" height=\"50\" rx=\"1.8\" fill=\"@metal\"/><rect x=\"-1.7\" y=\"-58\" width=\"1.3\" height=\"50\" fill=\"@metalH\" opacity=\"0.75\" stroke=\"none\"/><ellipse cx=\"-0.4\" cy=\"-58\" rx=\"2.5\" ry=\"1.5\" fill=\"#1a1a20\"/></g><g stroke=\"#1a1a20\" stroke-width=\"0.4\"><rect x=\"3\" y=\"-17\" width=\"4.6\" height=\"3.4\" rx=\"0.6\" fill=\"@metalO\"/><path d=\"M5 -17 q6 -2 4.5 -8 q-1.3 -3.5 -4 -1.8\" fill=\"none\" stroke=\"@metalO\" stroke-width=\"1.6\"/><path d=\"M-1 -4 q-1.4 4 1 5.4\" fill=\"none\" stroke=\"@metalO\" stroke-width=\"1.3\"/></g><g stroke=\"none\"><ellipse cx=\"-0.4\" cy=\"-59\" rx=\"3\" ry=\"2.4\" fill=\"@lueur\" opacity=\"0.55\"/><circle cx=\"5.4\" cy=\"-23\" r=\"1.4\" fill=\"@lueur\" opacity=\"0.7\"/><circle cx=\"-0.4\" cy=\"-58\" r=\"1.3\" fill=\"@lueurH\" opacity=\"0.9\"/></g>",
  palette: {"metalH":"#aeb6c0","metalO":"#3a3a42","metal":"#5a6258","cuirO":"#2a2a1a","cuir":"#4a4a30","lueur":"#5ad13a","lueurH":"#caff8a"},
};

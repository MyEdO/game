import type { WeaponDef } from '../types';

export const weapon: WeaponDef = {
  slug: "pistolet_malepierre",
  label: "Pistolet à malepierre",
  type: "ranged",
  group: "Poudre noire",
  target: "pistolet skaven grossier et bricolé + lueur verte de malepierre (warpstone)",
  art: "<path d=\"M-3 -2 Q-7 6 -8 14 Q-10 22 -5 24 Q-12 25 -13 17 Q-14 7 -8 -3 Z\" fill=\"@cuir\" stroke=\"#181410\" stroke-width=\"0.8\"/><circle cx=\"-8.5\" cy=\"22.5\" r=\"2\" fill=\"@cuirH\" stroke=\"#181410\" stroke-width=\"0.6\"/><path d=\"M-5 -4 Q-5.4 3 -4 10 L5 11 Q6 2 4 -5 Z\" fill=\"@cuirH\" stroke=\"@cuir\" stroke-width=\"0.8\"/><path d=\"M-3.6 -26 L-3.3 -4 Q-3.3 -1 0 -1 Q3.3 -1 3.6 -4 L4 -26 L1.2 -31 L-1.8 -30 Z\" fill=\"@metalH\" stroke=\"#222018\" stroke-width=\"0.9\"/><line x1=\"0.2\" y1=\"-30\" x2=\"-0.2\" y2=\"-3\" stroke=\"@metalO\" stroke-width=\"0.8\" opacity=\"0.6\"/><path d=\"M-2.8 -16 L3 -15\" stroke=\"@metalO\" stroke-width=\"1\" opacity=\"0.7\"/><circle cx=\"0\" cy=\"-30\" r=\"3.4\" fill=\"#15151b\" stroke=\"@metalO\" stroke-width=\"0.7\"/><circle cx=\"0\" cy=\"-30\" r=\"1.6\" fill=\"@lueur\"/><path d=\"M3.4 -3 q5 -1 5.5 4 q0.4 4.6 -4.6 4.8 q3 -4 -0.9 -8.8 z\" fill=\"@metalO\" stroke=\"#15151a\" stroke-width=\"0.7\"/><circle cx=\"7\" cy=\"1\" r=\"1.3\" fill=\"@lueur\"/><path d=\"M3.2 -7 q5 -3 6 -9 q2 4 -1 8 q3 0 4 3 q-5 1 -9 -2 z\" fill=\"@metal\" stroke=\"#15191e\" stroke-width=\"0.7\"/><path d=\"M-0.5 10 q1.6 4 -0.4 7\" stroke=\"#181410\" stroke-width=\"1.6\" fill=\"none\"/><g stroke=\"none\"><ellipse cx=\"0\" cy=\"-31\" rx=\"3.6\" ry=\"3\" fill=\"@lueur\" opacity=\"0.5\"/><circle cx=\"7\" cy=\"1\" r=\"2.4\" fill=\"@lueur\" opacity=\"0.45\"/><circle cx=\"0\" cy=\"-30\" r=\"1\" fill=\"@lueurH\" opacity=\"0.9\"/></g>",
  palette: {"metalH":"#9aa6a0","metalO":"#262a26","metal":"#3a3e38","cuir":"#33291c","cuirH":"#4a3c26","lueur":"#5ad13a","lueurH":"#caff8a"},
};

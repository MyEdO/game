import type { WeaponDef } from '../types';

export const weapon: WeaponDef = {
  slug: "sabre",
  label: "Sabre",
  type: "melee",
  group: "Cavalerie",
  target: "lame courbe à un seul tranchant + garde à pontet (arceau)",
  art: "<!-- Sabre : repere local os 'arme', poignee a (0,0), lame courbe vers -y, pommeau +y --><circle cx=\"0\" cy=\"7\" r=\"2.6\" fill=\"@metalO\" stroke=\"@metalO\" stroke-width=\"0.6\"/><ellipse cx=\"-0.8\" cy=\"6\" rx=\"0.9\" ry=\"1.2\" fill=\"@metalH\" opacity=\"0.6\"/><rect x=\"-1.5\" y=\"-1\" width=\"3\" height=\"8\" rx=\"1.2\" fill=\"@cuirO\" stroke=\"#2a1a0c\" stroke-width=\"0.4\"/><line x1=\"-1.4\" y1=\"0.6\" x2=\"1.4\" y2=\"1.6\" stroke=\"@cuirH\" stroke-width=\"0.5\"/><line x1=\"-1.4\" y1=\"3\" x2=\"1.4\" y2=\"4\" stroke=\"@cuirH\" stroke-width=\"0.5\"/><!-- pontet / arceau de garde (knuckle-bow) --><path d=\"M3 -2 Q8 -2 8.5 4 Q8.5 8 4 8\" fill=\"none\" stroke=\"@accentO\" stroke-width=\"1.8\" stroke-linecap=\"round\"/><path d=\"M3 -2 Q7 -2 7.4 4 Q7.4 7 4.5 7\" fill=\"none\" stroke=\"@accent\" stroke-width=\"1\" stroke-linecap=\"round\"/><!-- quillon court --><path d=\"M-3.5 -2 Q0 -3.2 4 -2 L3.6 -0.6 Q0 -1.6 -3.3 -0.6 Z\" fill=\"@accent\" stroke=\"@cuirO\" stroke-width=\"0.5\"/><!-- lame COURBE a un seul tranchant (dos epais, tranchant exterieur) --><path d=\"M-1 -3 Q4 -20 9 -38 Q9.8 -41 8 -42 Q4.5 -38 1.5 -22 Q0 -12 -1.4 -3 Z\" fill=\"@metal\" stroke=\"@metalO\" stroke-width=\"0.5\"/><!-- reflet le long du dos --><path d=\"M-0.6 -4 Q4 -20 8.6 -39\" fill=\"none\" stroke=\"@metalH\" stroke-width=\"0.6\" opacity=\"0.8\"/>",
  palette: {"cuir":"#5a3f24","metalO":"#2a3038","metalH":"#cfd8e6","metal":"#9aa6b8","cuirO":"#4a3018","cuirH":"#caa46a","accentO":"#b89038","accent":"#caa64a"},
};

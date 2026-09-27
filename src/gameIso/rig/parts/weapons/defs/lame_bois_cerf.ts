import type { WeaponDef } from '../types';

export const weapon: WeaponDef = {
  slug: "lame_bois_cerf",
  label: "Lame à poignée en bois de cerf",
  type: "melee",
  group: "Base",
  target: "couteau à poignée en bois de cerf ramifié, lame courte",
  art: "<!-- poignee en bois de cerf : fut central + andouillers ramifies --><path d=\"M-1.6 6 L1.6 6 L1.9 -1 L-1.9 -1 Z\" fill=\"@os\" stroke=\"@osO\" stroke-width=\"0.4\"/><!-- ramure : branche basse gauche --><path d=\"M-1.6 4.5 Q-5 4 -6.5 6.5 Q-7.5 8 -7 9.5\" fill=\"none\" stroke=\"@os\" stroke-width=\"1.5\" stroke-linecap=\"round\"/><path d=\"M-6.5 6.5 Q-8.5 6 -9.5 7\" fill=\"none\" stroke=\"@os\" stroke-width=\"1.1\" stroke-linecap=\"round\"/><!-- ramure : branche basse droite --><path d=\"M1.6 4.8 Q5 4.4 6.2 7 Q7 8.4 6.4 10\" fill=\"none\" stroke=\"@os\" stroke-width=\"1.5\" stroke-linecap=\"round\"/><path d=\"M6.2 7 Q8.2 6.6 9.2 7.8\" fill=\"none\" stroke=\"@os\" stroke-width=\"1.1\" stroke-linecap=\"round\"/><!-- petit andouiller haut --><path d=\"M-1.8 1.5 Q-4.5 1 -5.5 -1\" fill=\"none\" stroke=\"@os\" stroke-width=\"1.2\" stroke-linecap=\"round\"/><!-- nodosites de l'andouiller (meule) --><circle cx=\"0\" cy=\"5\" r=\"2.1\" fill=\"@osH\" stroke=\"@osO\" stroke-width=\"0.4\"/><circle cx=\"-0.6\" cy=\"2\" r=\"0.5\" fill=\"@osO\"/><circle cx=\"0.6\" cy=\"3\" r=\"0.5\" fill=\"@osO\"/><!-- ferrure / virole --><ellipse cx=\"0\" cy=\"-1.6\" rx=\"2.4\" ry=\"1.2\" fill=\"@accent\" stroke=\"@cuirO\" stroke-width=\"0.4\"/><!-- lame courte --><path d=\"M-1.9 -2 L1.9 -2 L1.9 -15 Q1.7 -19 -0.4 -20 Q-1.9 -16 -1.9 -11 Z\" fill=\"@metal\" stroke=\"@metalO\" stroke-width=\"0.4\"/><path d=\"M-0.7 -3 L-0.6 -17\" stroke=\"@metalH\" stroke-width=\"0.5\" opacity=\"0.55\"/>",
  palette: {"cuir":"#5a3f24","metalO":"#2a3038","metalH":"#cfd8e6","metal":"#9aa6b8","osO":"#8a7a5a","osH":"#f2e8cf","os":"#d6c6a0","cuirO":"#3a2a1a","accent":"#caa64a"},
};

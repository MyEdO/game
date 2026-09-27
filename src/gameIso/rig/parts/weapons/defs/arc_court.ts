import type { WeaponDef } from '../types';

export const weapon: WeaponDef = {
  slug: "arc_court",
  label: "Arc court",
  type: "ranged",
  group: "Arc",
  target: "arc court compact (plus petit que l'avant-bras du tireur)",
  art: "<path d=\"M-3 -21 Q3 -19 1 -14 Q-12 -3 -12 0 Q-12 3 1 14 Q3 19 -3 21\" stroke=\"@cuirO\" stroke-width=\"3.4\" fill=\"none\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/><path d=\"M-3 -21 Q2.4 -19 0.4 -14 Q-10.4 -3 -10.4 0 Q-10.4 3 0.4 14 Q2.4 19 -3 21\" stroke=\"@cuir\" stroke-width=\"1\" fill=\"none\" stroke-linecap=\"round\" opacity=\"0.7\"/><line x1=\"-3\" y1=\"-21.5\" x2=\"-3\" y2=\"21.5\" stroke=\"@accent\" stroke-width=\"1\"/><rect x=\"-3.4\" y=\"-5.5\" width=\"4.8\" height=\"11\" rx=\"1.8\" fill=\"@cuirO\" stroke=\"#2e2014\" stroke-width=\"0.4\"/><line x1=\"-3\" y1=\"0\" x2=\"-16\" y2=\"0\" stroke=\"@cuirH\" stroke-width=\"1.6\"/><path d=\"M-16 0 l4.6 -2.4 v4.8 z\" fill=\"@metal\" stroke=\"@metalO\" stroke-width=\"0.3\"/><path d=\"M-3 -0.1 l3.4 -2.4 0 4.8 z\" fill=\"@or\" opacity=\"0.95\"/><path d=\"M-3 -2.4 l2.6 0.9 -2.6 0.9 z M-3 0 l2.6 0.9 -2.6 0.9 z\" fill=\"@cuir\" opacity=\"0.9\"/>",
  palette: {"metal":"#b8c0cc","metalO":"#5a626c","cuirO":"#5a3f24","cuir":"#8a6238","cuirH":"#caa882","accent":"#ece4d4","or":"#caa64a"},
};

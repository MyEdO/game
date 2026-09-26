import type { WeaponDef } from '../types';

export const weapon: WeaponDef = {
  slug: "arc_long",
  label: "Arc long",
  type: "ranged",
  group: "Arc",
  target: "grand arc long (≈ hauteur de l'archer)",
  art: "<path d=\"M4 -48 Q-13 -10 4 8\" stroke=\"@cuirO\" stroke-width=\"3.4\" fill=\"none\" stroke-linecap=\"round\"/><path d=\"M4 -48 Q-12 -10 4 8\" stroke=\"@cuir\" stroke-width=\"1.2\" fill=\"none\" stroke-linecap=\"round\"/><line x1=\"4\" y1=\"-48\" x2=\"4\" y2=\"8\" stroke=\"@accent\" stroke-width=\"1\"/><line x1=\"4\" y1=\"-20\" x2=\"-16\" y2=\"-20\" stroke=\"@cuirH\" stroke-width=\"1.7\"/><path d=\"M-16 -20 l5.5 -2.6 v5.2 z\" fill=\"@metal\" stroke=\"@metalO\" stroke-width=\"0.3\"/><path d=\"M4 -19 l3.4 1.4 -3.4 1.4 z\" fill=\"@or\"/><circle cx=\"4\" cy=\"-48\" r=\"1.6\" fill=\"@cuirO\"/><circle cx=\"4\" cy=\"8\" r=\"1.6\" fill=\"@cuirO\"/>",
  palette: {"metal":"#cfd8e6","metalO":"#3a4048","cuirO":"#4a3320","cuir":"#8a6a40","cuirH":"#caa882","accent":"#e8e0d0","or":"#caa64a"},
};

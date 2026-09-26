import type { WeaponDef } from '../types';

export const weapon: WeaponDef = {
  slug: "bombe",
  label: "Bombe",
  type: "ranged",
  group: "Explosifs",
  target: "sphère noire de fonte + mèche allumée (étincelle)",
  art: "<ellipse cx=\"1\" cy=\"-1\" rx=\"9\" ry=\"3\" fill=\"#050507\" opacity=\"0.5\"/><circle cx=\"0\" cy=\"-13\" r=\"13\" fill=\"#15151a\" stroke=\"#050507\" stroke-width=\"1\"/><path d=\"M-12.6 -10 a13 13 0 0 1 11 -15.6 a11 11 0 0 0 -8.6 13 a13 13 0 0 0 10 12.4 a13 13 0 0 1 -12.4 -9.8 z\" fill=\"@metal\" opacity=\"0.6\"/><ellipse cx=\"-4.8\" cy=\"-17.5\" rx=\"4\" ry=\"2.6\" fill=\"@metalH\" opacity=\"0.85\"/><ellipse cx=\"-2.6\" cy=\"-15\" rx=\"1.6\" ry=\"1.1\" fill=\"@metalH\" opacity=\"0.7\"/><path d=\"M-4 -24 Q0 -28 4 -24 L3 -30 Q0 -32 -3 -30 Z\" fill=\"@metal\" stroke=\"#0c0c10\" stroke-width=\"0.7\"/><rect x=\"-3.4\" y=\"-31\" width=\"6.8\" height=\"3\" rx=\"1\" fill=\"@metalO\" stroke=\"#0c0c10\" stroke-width=\"0.5\"/><path d=\"M0 -30 Q1 -36 -4 -39 Q-9 -41 -7 -44\" fill=\"none\" stroke=\"@cuir\" stroke-width=\"2.6\" stroke-linecap=\"round\"/><path d=\"M0 -30 Q1 -36 -4 -39 Q-9 -41 -7 -44\" fill=\"none\" stroke=\"@cuirO\" stroke-width=\"1\" stroke-dasharray=\"1.5 1.8\"/><path d=\"M-7 -50 l1.5 4 -3 0 z\" fill=\"@etincelle\" opacity=\"0.9\"/><circle cx=\"-7\" cy=\"-45\" r=\"5\" fill=\"url(#g_eye)\"/><path d=\"M-7 -50.5 l1.4 3.4 -2.8 0 z M-7 -38 l1.4 -3.4 -2.8 0 z M-14.3 -45 l3.4 1.4 0 -2.8 z M0.3 -45 l-3.4 1.4 0 -2.8 z M-12.3 -50.3 l3 1 -2 2 z M-1.7 -50.3 l-3 1 2 2 z\" fill=\"@accentO\" opacity=\"0.95\"/><circle cx=\"-7\" cy=\"-45\" r=\"2\" fill=\"@accent\"/>",
  palette: {"metal":"#2c2c34","metalH":"#6a6a76","metalO":"#26262c","cuir":"#6a4a2a","cuirO":"#3a2818","accentO":"#ffd24a","accent":"#fff6d2","etincelle":"#ffb02a"},
};

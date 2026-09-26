import type { WeaponDef } from '../types';

export const weapon: WeaponDef = {
  slug: "flechette",
  label: "Fléchette",
  type: "ranged",
  group: "Lancer",
  target: "dard/fléchette empennée à lancer, petite",
  art: "<rect x=\"-1\" y=\"-22\" width=\"2\" height=\"30\" rx=\"0.8\" fill=\"@cuir\"/><path d=\"M0 -34 L3.2 -23 L1.4 -20 L-1.4 -20 L-3.2 -23 Z\" fill=\"@metal\" stroke=\"@metalO\" stroke-width=\"0.5\"/><path d=\"M0 -23 L0.7 -20 L-0.7 -20 Z\" fill=\"@metalH\" opacity=\"0.6\"/><path d=\"M0 -2 L7.5 5 L6 9 L0 5 Z\" fill=\"@empennage\" stroke=\"@empennageO\" stroke-width=\"0.4\"/><path d=\"M0 -2 L-7.5 5 L-6 9 L0 5 Z\" fill=\"@empennage\" stroke=\"@empennageO\" stroke-width=\"0.4\"/><line x1=\"0\" y1=\"-2\" x2=\"0\" y2=\"8\" stroke=\"@cuir\" stroke-width=\"1.4\"/><line x1=\"2.4\" y1=\"-0.2\" x2=\"4.6\" y2=\"5\" stroke=\"@cuir\" stroke-width=\"0.4\"/><line x1=\"-2.4\" y1=\"-0.2\" x2=\"-4.6\" y2=\"5\" stroke=\"@cuir\" stroke-width=\"0.4\"/>",
  palette: {"metalO":"#2a3038","metalH":"#cfd8e6","metal":"#9aa6b8","cuir":"#6a4a2a","empennage":"#b54a3a","empennageO":"#5a2018"},
};

import type { WeaponDef } from '../types';

export const weapon: WeaponDef = {
  slug: "poing",
  label: "Coup-de-poing",
  type: "melee",
  group: "Bagarre",
  target: "coup-de-poing/cestes sur le poing fermé",
  art: "<g stroke=\"@metalO\" stroke-width=\"0.5\"><path d=\"M-8 4 Q-9 -8 -7 -14 Q-5 -19 1 -19 Q8 -19 10 -13 Q11 -5 10 3 Q9 9 2 10 Q-6 11 -8 4 Z\" fill=\"url(#dg-v-@peauH-@peauO)\"/></g><g fill=\"url(#dg-v-@peauH-@peauO)\" stroke=\"@metalO\" stroke-width=\"0.5\"><path d=\"M-7 -13 q-1 -6 3 -6 q3 0 3 6 q0 4 -3 5 q-3 0 -3 -5 z\"/><path d=\"M-1.5 -15 q-1 -6 3 -6 q3 0 3 6 q0 4 -3 5 q-3 0 -3 -5 z\"/><path d=\"M4 -14 q-1 -6 3 -6 q3 0 3 5 q0 4 -3 5 q-3 0 -3 -4 z\"/></g><g stroke=\"@cuir\" stroke-width=\"0.7\" fill=\"none\" opacity=\"0.7\"><path d=\"M-4 -9 Q-4 -3 -5 3\"/><path d=\"M1.5 -10 Q1.5 -3 0.5 4\"/><path d=\"M7 -9 Q7 -3 6 3\"/></g><path d=\"M-11 -3 Q-13 -8 -10 -11 Q-7 -12 -6 -8 L-6 1 Q-9 3 -11 -3 Z\" fill=\"url(#dg-v-@peauH-@peauO)\" stroke=\"@metalO\" stroke-width=\"0.5\"/><path d=\"M-8 -11 Q1 -16 11 -10 L11 -4 Q1 -9 -8 -5 Z\" fill=\"@metal\" stroke=\"@metalO\" stroke-width=\"0.6\"/><rect x=\"-8\" y=\"-9.4\" width=\"19\" height=\"1.2\" rx=\"0.5\" fill=\"@metalH\" opacity=\"0.8\"/><g fill=\"@metal\" stroke=\"@metalO\" stroke-width=\"0.4\"><path d=\"M-6 -11 l1.8 -3.4 1.8 3.4 z\"/><path d=\"M-1 -13 l1.8 -3.4 1.8 3.4 z\"/><path d=\"M4 -12 l1.8 -3.4 1.8 3.4 z\"/></g>",
  palette: {"metalO":"#2a3038","metalH":"#dfe6ef","metal":"#9aa6b8","cuir":"#8a5e3c"},
};

import type { WeaponDef } from '../types';

export const weapon: WeaponDef = {
  slug: "vision_vie",
  label: "Vision de Vie",
  type: "melee",
  group: "Base",
  target: "dague légendaire pâle et lumineuse, lame blanche, halo de lumière",
  art: "<!-- halo lumineux diffus derriere la lame --><path d=\"M0 -2 L4.5 -20 L0 -28 L-4.5 -20 Z\" fill=\"@lueur\" opacity=\"0.4\"/><path d=\"M0 -3 L2.6 -19 L0 -25 L-2.6 -19 Z\" fill=\"@lueur\" opacity=\"0.5\"/><path d=\"M-2 4 L2 4 L2.4 -3 L-2.4 -3 Z\" fill=\"@cuir\" stroke=\"@cuirO\" stroke-width=\"0.4\"/><path d=\"M-1.6 4 q-1 2 0 3.6 q1.6 2 0 3.4 q-1 0.6 0 1.4 M1.6 4 q1 2 0 3.6 q-1.6 2 0 3.4 q1 0.6 0 1.4\" stroke=\"@cuirO\" stroke-width=\"0.5\" fill=\"none\"/><circle cx=\"0\" cy=\"10\" r=\"2.6\" fill=\"@accent\" stroke=\"@metalO\" stroke-width=\"0.5\"/><circle cx=\"0\" cy=\"10\" r=\"1\" fill=\"@lueur\"/><!-- garde claire --><path d=\"M-9 -2 L9 -2 L9.5 -4 Q9.8 -5 8.6 -5 L-8.6 -5 Q-9.8 -5 -9.5 -4 Z\" fill=\"@metal\" stroke=\"@metalO\" stroke-width=\"0.5\"/><circle cx=\"-8.6\" cy=\"-3.5\" r=\"1.5\" fill=\"@accent\" stroke=\"@lueur\" stroke-width=\"0.3\"/><circle cx=\"8.6\" cy=\"-3.5\" r=\"1.5\" fill=\"@accent\" stroke=\"@lueur\" stroke-width=\"0.3\"/><!-- lame blanche luminescente --><path d=\"M-3 -5 L3 -5 L2.4 -19 L0 -24 L-2.4 -19 Z\" fill=\"@metal\" stroke=\"@metalO\" stroke-width=\"0.5\"/><!-- reflet lumineux vif --><path d=\"M0 -7 L0 -22\" stroke=\"@lueur\" stroke-width=\"0.8\" opacity=\"0.9\"/>",
  palette: {"metalO":"#9aa6c0","metal":"#e8eef8","cuir":"#cdd6e8","cuirO":"#9aa6c0","accent":"#d8e4f4","lueur":"#f4faff"},
};

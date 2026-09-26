import type { WeaponDef } from '../types';

export const weapon: WeaponDef = {
  slug: 'cimeterre',
  label: 'Cimeterre',
  type: 'melee',
  group: 'Base',
  target: 'lame LARGE et fortement courbe (scimitar), ventre marque, pommeau crochu',
  art: '<!-- Cimeterre : repere local os arme, poignee (0,0), large lame fortement courbe vers -y --><!-- pommeau crochu (style oriental) --><path d="M-1.4 6 Q-5.5 6.5 -4.5 10.5 Q-2.8 9.5 -1.4 8.5 Z" fill="@accentO" stroke="@cuirO" stroke-width="0.4"/><circle cx="-1.4" cy="7.4" r="1.4" fill="@accent" stroke="@accentO" stroke-width="0.4"/><!-- poignee gainee --><rect x="-1.6" y="-1" width="3.2" height="8" rx="1.2" fill="@cuirO" stroke="#2a1a0c" stroke-width="0.4"/><line x1="-1.5" y1="0.8" x2="1.5" y2="1.8" stroke="@cuirH" stroke-width="0.5"/><line x1="-1.5" y1="3" x2="1.5" y2="4" stroke="@cuirH" stroke-width="0.5"/><!-- garde droite a boutons --><path d="M-4.2 -2 Q0 -3.3 5 -2 L4.6 -0.4 Q0 -1.6 -3.8 -0.4 Z" fill="@accent" stroke="@cuirO" stroke-width="0.5"/><circle cx="-4.2" cy="-1.2" r="1.15" fill="@accent" stroke="@accentO" stroke-width="0.4"/><circle cx="5" cy="-1.2" r="1.15" fill="@accent" stroke="@accentO" stroke-width="0.4"/><!-- LAME : large croissant a tranchant exterieur convexe, dos interieur concave --><path d="M-1 -2 C 8 -6 15 -16 14 -28 C 13 -38 9 -44 5 -46 C 4.4 -41 4 -33 3 -22 C 2.2 -13 1 -6 -1 -2 Z" fill="@metal" stroke="@metalO" stroke-width="0.6"/><!-- reflet interne suivant le ventre --><path d="M1 -4 C 8 -10 13 -18 12.4 -27 C 12 -34 9 -39 6 -42" fill="none" stroke="@metalH" stroke-width="0.5" opacity="0.5"/><!-- arete lumineuse pres du dos/pointe --><path d="M3.4 -22 C 4.1 -33 5 -40 5 -44" fill="none" stroke="@metalH" stroke-width="0.6" opacity="0.7"/>',
  palette: { cuir: '#5a3f24', metalO: '#2a3038', metalH: '#cfd8e6', metal: '#9aa6b8', cuirO: '#4a3018', cuirH: '#caa46a', accentO: '#b89038', accent: '#caa64a' },
};

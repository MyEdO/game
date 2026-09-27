import type { PartArt } from '../types';

// Botte de cuir SYSTÈME (#736 Lot 1) — HABIT du pied (repère os `pied`, origine = cheville, +y
// descend) : une botte n'est pas un repli de chair — elle ne vit pas avec le corps (`bodies/`), c'est
// l'équipement par défaut de toute tenue chaussée (piloté par `TenueSet.pied`, cf. `types.ts`).
// Dessinée par-dessus le bas de jambe → un pied de profil pointe vers l'avant (botte de côté),
// de face un bout arrondi, de dos un talon.
// Peinte en JETONS de la famille `botte` (cuir `@botte` + contour `@botteO`, `@semelle`, et
// `@botteDos`/`@botteDosO` pour le cuir dorsal que l'art assombrit à la main) — une tenue pilote
// donc la couleur de ses bottes par sa `palette` (`botte`, cf. tenues/types.ts). Défauts (art
// d'origine) et clés suiveuses `semelle`/`botteDos` : table des clés de palette (`clesDePalette.ts`).
export const BOTTE_CUIR: PartArt = {
  front: `<path d="M-2.9 -1 Q-3.3 2.5 -3.4 5 Q-3.5 7.2 -2.4 7.8 Q0 8.5 2.4 7.8 Q3.5 7.2 3.4 5 Q3.3 2.5 2.9 -1 Z" fill="@botte" stroke="@botteO" stroke-width="0.6"/><path d="M-3.4 6.9 Q0 8.4 3.4 6.9 L3.2 8.4 Q0 9.7 -3.2 8.4 Z" fill="@semelle"/><path d="M-2.9 0.6 Q0 1.4 2.9 0.6" fill="none" stroke="@botteO" stroke-width="0.5" opacity="0.7"/><path d="M-3.3 5.1 Q0 6.1 3.3 5.1" fill="none" stroke="@botteO" stroke-width="0.4" opacity="0.5"/>`,
  back: `<path d="M-2.8 -1 Q-3.2 2.5 -3.3 5 Q-3.4 7 -2.3 7.7 Q0 8.3 2.3 7.7 Q3.4 7 3.3 5 Q3.2 2.5 2.8 -1 Z" fill="@botteDos" stroke="@botteDosO" stroke-width="0.5"/><path d="M-3.3 6.8 Q0 8.2 3.3 6.8 L3.1 8.3 Q0 9.5 -3.1 8.3 Z" fill="@semelle"/><path d="M0 0.2 Q0.4 4 0 7.5" fill="none" stroke="@botteDosO" stroke-width="0.4" opacity="0.6"/><path d="M-2.8 0.4 Q0 1.2 2.8 0.4" fill="none" stroke="@botteDosO" stroke-width="0.5" opacity="0.6"/>`,
  profile: `<path d="M-2.6 -1 L1.9 -1 Q5.8 1.2 8.2 5 Q9.2 6.4 8.5 7.6 L-2.4 7.6 Q-3.2 4.4 -2.6 -1 Z" fill="@botte" stroke="@botteO" stroke-width="0.6"/><path d="M-2.7 7 L8.7 7 Q9.4 7.3 8.9 8.5 L-0.4 8.5 L-0.4 9.4 L-2.9 9.4 Q-3.3 7.8 -2.7 7 Z" fill="@semelle"/><path d="M-2.6 0 Q-0.3 0.9 1.9 0" fill="none" stroke="@botteO" stroke-width="0.5" opacity="0.7"/><path d="M-2.1 1.2 Q-2.5 4 -2.1 6.6" fill="none" stroke="@botteO" stroke-width="0.4" opacity="0.5"/><path d="M6.4 4.3 Q7.7 5.5 7.6 7.3" fill="none" stroke="@botteO" stroke-width="0.4" opacity="0.5"/>`,
};

import type { PartArt } from '../types';

// Extrémités de CHAIR (pied nu, main, cou) — Nu d'ESPÈCE servant de repli aux zones que resolve.ts
// résout par table de priorité (override → armure → tenue → repli), au même titre que
// tete/torse/jambes. Une tenue/armure PEUT piloter ces zones (parts/*/types.ts). La botte
// (HABIT, pas un repli de chair) vit dans `tenues/botte-gabarit.ts` (BOTTE_CUIR, #736).

// Pied NU GRIFFU (espèces nues : squelette/goule/troll…) — chair/os/pelage `@peau` + griffes
// `@griffe` (au lieu de la botte, incohérente sur un monstre nu).
export const CLAWFOOT: PartArt = {
  front: `<path d="M-2.7 -1 Q-3.6 4 -3.4 6.2 Q-3.3 7.3 0 7.5 Q3.3 7.3 3.4 6.2 Q3.6 4 2.7 -1 Z" fill="@peau" stroke="@peauO" stroke-width="0.5"/><path d="M-2.7 6.4 Q-2.6 8.8 -2 9.6 Q-1.7 8.4 -1.3 6.8 Z M-1.1 6.7 Q-0.9 9.1 -0.4 9.8 Q-0.1 8.6 0.1 6.9 Z M0.1 6.9 Q0.4 9.1 0.9 9.8 Q1.1 8.6 1.3 6.7 Z M1.3 6.8 Q1.7 8.8 2.3 9.6 Q2.9 8.4 2.7 6.4 Z" fill="@griffe" stroke="@peauO" stroke-width="0.25"/>`,
  back: `<path d="M-2.6 -1 Q-3.2 4 -3 6.2 Q-2.8 7.6 0 7.7 Q2.8 7.6 3 6.2 Q3.2 4 2.6 -1 Z" fill="@peauO" stroke="@peauO" stroke-width="0.4"/><path d="M-1.4 6.9 Q-1.2 8.7 -0.7 9.3 Q-0.4 8.3 -0.3 7 Z M0.3 7 Q0.4 8.7 0.9 9.3 Q1.3 8.5 1.4 6.9 Z" fill="@griffe" stroke="@peauO" stroke-width="0.25"/>`,
  profile: `<path d="M-2.6 -1 L2 -1 Q4.4 1.4 6.4 4.4 Q7.5 5.8 7.3 6.9 Q6 7.5 3.6 7.6 Q1 7.7 -0.6 7.5 Q-2.7 7.3 -2.7 5 Q-2.8 2 -2.6 -1 Z" fill="@peau" stroke="@peauO" stroke-width="0.5"/><path d="M6.2 4.6 Q9 5.6 9.7 8.4 Q8.4 6.8 5.8 6 Z M4.8 5.8 Q7.2 6.8 7.7 9.4 Q6.6 7.6 4.2 6.9 Z M3 6.6 Q4.8 7.6 5 9.7 Q4.2 8 2.4 7.3 Z" fill="@griffe" stroke="@peauO" stroke-width="0.25"/><path d="M-2.2 6.5 Q-3.4 7.4 -3.7 9 Q-2.7 7.7 -1.6 7.1 Z" fill="@griffe" stroke="@peauO" stroke-width="0.25"/>`,
};
// Pied NU LISSE (civilisés va-nu-pieds : halfling, humain sans chaussure…) — chair `@peau` :
// talon arrondi, voûte plantaire, orteils SUGGÉRÉS en douceur (courbes molles), SANS griffe
// (#481 : un civilisé nu-pieds n'est pas un monstre — contraste net avec les serres de CLAWFOOT).
export const PLAINFOOT: PartArt = {
  front: `<path d="M-2.6 -1 Q-3.5 4 -3.5 6.2 Q-3.4 7.2 -2.5 7.5 Q-1.9 8.3 -1.2 7.6 Q-0.5 8.3 0.2 7.6 Q0.9 8.2 1.6 7.5 Q2.4 8.1 3.1 7.3 Q3.6 6.8 3.5 6.2 Q3.5 4 2.6 -1 Z" fill="@peau" stroke="@peauO" stroke-width="0.5"/><path d="M-1.9 6.6 q0 0.7 0 1 M-0.5 6.6 q0 0.7 0 1 M0.9 6.6 q0 0.7 0 1 M2.2 6.5 q0 0.6 0 0.9" stroke="@peauO" stroke-width="0.3" opacity="0.4" fill="none"/><path d="M-2.4 1 Q0 1.8 2.4 1" fill="none" stroke="@peauH" stroke-width="0.4" opacity="0.35"/>`,
  back: `<path d="M-2.5 -1 Q-3.1 4 -2.9 6.3 Q-2.7 7.7 0 7.8 Q2.7 7.7 2.9 6.3 Q3.1 4 2.5 -1 Z" fill="@peauO" stroke="@peauO" stroke-width="0.4"/><path d="M0 -0.4 Q0.4 3 0 6" fill="none" stroke="@peau" stroke-width="0.4" opacity="0.3"/>`,
  profile: `<path d="M-2.4 -1 L2 -1 Q4.8 1.4 7.4 4.6 Q8.9 5.8 8.9 6.7 Q8.8 7.4 7.5 7.5 L3.8 7.6 Q1 7.7 -0.5 7.5 Q-2.6 7.3 -2.7 5.1 Q-2.8 2 -2.4 -1 Z" fill="@peau" stroke="@peauO" stroke-width="0.5"/><path d="M-0.2 7.3 Q2.4 6.2 5 7.2" fill="none" stroke="@peauO" stroke-width="0.4" opacity="0.4"/><path d="M6.6 4.9 Q7.3 5.7 7 6.9 M7.6 5.5 Q8.2 6.2 8 7.1" fill="none" stroke="@peauO" stroke-width="0.3" opacity="0.4"/><path d="M0 -0.2 Q3 1.6 6 4.4" fill="none" stroke="@peauH" stroke-width="0.4" opacity="0.3"/>`,
};

// Main (poing) orientée, repère os `main` (origine = poignet, +y descend). VRAIE main ancrée
// au poignet réel (#633 D1) : le pivot main* = 18 (bout de l'avant-bras, skeletons.ts) — l'art
// d'avant-bras (0..16) finit au poignet, le poing s'y emboîte. y=-2 (haut du poignet) rejoint le
// bas de l'art d'avant-bras (18-2=16) sans trou ; +7.7 = doigts refermés. AUCUNE remontée sous le
// coude (le cylindre-moignon est mort). Peinte SOUS l'avant-bras (zOverride main*, composeRig) :
// une manche qui atteint le poignet recouvre le haut du poing.
export const HAND: PartArt = {
  front: `<path d="M-2.8 -2 Q0 -2.8 2.8 -2 Q3.3 1.6 3 4.7 Q2.6 7.1 0 7.7 Q-2.6 7.1 -3 4.7 Q-3.3 1.6 -2.8 -2 Z" fill="@peau" stroke="@peauO" stroke-width="0.5"/><path d="M-2 1.7 h4.1 M-2 3.5 h4 M-1.8 5.2 h3.6" stroke="@peauO" stroke-width="0.35" opacity="0.55"/><path d="M-2.9 0.5 Q-3.8 1.7 -3.1 3.6" fill="none" stroke="@peauO" stroke-width="0.4" opacity="0.5"/>`,
  back: `<path d="M-2.8 -2 Q0 -2.8 2.8 -2 Q3.3 1.6 3 4.7 Q2.6 7.1 0 7.7 Q-2.6 7.1 -3 4.7 Q-3.3 1.6 -2.8 -2 Z" fill="@peauO" stroke="@peauO" stroke-width="0.5"/><path d="M-1.8 1.6 h3.6 M-1.6 3.4 h3.2" stroke="@peauO" stroke-width="0.3" opacity="0.5"/>`,
  profile: `<path d="M-2.4 -2 Q0.4 -2.8 2.6 -1.9 Q3.2 1.5 2.8 4.7 Q2.4 7.2 -0.2 7.5 Q-2.4 6.9 -2.6 4.5 Q-2.8 1.4 -2.4 -2 Z" fill="@peau" stroke="@peauO" stroke-width="0.5"/><path d="M2.2 0.6 Q1.2 2 1.8 4.1" fill="none" stroke="@peauO" stroke-width="0.4" opacity="0.5"/>`,
};

// Main NUE GRIFFUE (patte/poing de bête : espèces `griffues`, #736) — MÊME ancrage/empreinte
// que HAND (poignet y=-2, doigts refermés +7.7, largeur ±3) pour un câblage trivial (repli de main
// des griffues). Chair `@peau`/`@peauO` + 4 GRIFFES `@griffe` recourbées à l'avant (débordent le
// bout des doigts, y 6→10.1 — symétrique de la logique de serres de CLAWFOOT). Doit lire « main de
// bête », distincte du poing lisse HAND. `@peauH` non employé (rendu net, sans reflet doux).
export const MAIN_GRIFFUE: PartArt = {
  front: `<path d="M-2.8 -2 Q0 -2.8 2.8 -2 Q3.2 1.6 2.9 4.4 Q2.5 6.6 0 7 Q-2.5 6.6 -2.9 4.4 Q-3.2 1.6 -2.8 -2 Z" fill="@peau" stroke="@peauO" stroke-width="0.5"/><path d="M-2 1.7 h4.1 M-1.9 3.5 h3.8" stroke="@peauO" stroke-width="0.35" opacity="0.55" fill="none"/><path d="M-2.5 6 Q-2.8 8.5 -2 9.8 Q-1.6 8.3 -1.5 6.2 Z M-1.2 6.4 Q-1.3 8.9 -0.5 10.1 Q-0.1 8.7 0 6.6 Z M0 6.6 Q0.5 8.9 1.2 10.1 Q1.3 8.7 1.2 6.4 Z M1.5 6.2 Q1.6 8.5 2.4 9.8 Q2.8 8.3 2.5 6 Z" fill="@griffe" stroke="@peauO" stroke-width="0.25"/>`,
  back: `<path d="M-2.8 -2 Q0 -2.8 2.8 -2 Q3.2 1.6 2.9 4.4 Q2.5 6.6 0 7 Q-2.5 6.6 -2.9 4.4 Q-3.2 1.6 -2.8 -2 Z" fill="@peauO" stroke="@peauO" stroke-width="0.5"/><path d="M-1.8 1.6 h3.6 M-1.6 3.4 h3.2" stroke="@peauO" stroke-width="0.3" opacity="0.5" fill="none"/><path d="M-1.4 6.3 Q-1.5 8.3 -0.8 9.3 Q-0.4 8.2 -0.3 6.5 Z M0.3 6.5 Q0.4 8.3 1 9.3 Q1.4 8.2 1.4 6.3 Z" fill="@griffe" stroke="@peauO" stroke-width="0.25"/>`,
  profile: `<path d="M-2.4 -2 Q0.4 -2.8 2.6 -1.9 Q3.2 1.5 2.8 4.7 Q2.4 7.2 -0.2 7.5 Q-2.4 6.9 -2.6 4.5 Q-2.8 1.4 -2.4 -2 Z" fill="@peau" stroke="@peauO" stroke-width="0.5"/><path d="M2.2 0.6 Q1.2 2 1.8 4.1" fill="none" stroke="@peauO" stroke-width="0.4" opacity="0.5"/><path d="M2.2 4.4 Q3.6 5.8 3.4 8.2 Q2.8 6.6 1.8 5.4 Z M1.4 5.4 Q2.5 6.9 2.3 9 Q1.8 7.3 1 6.3 Z M0.2 6.2 Q1 7.6 0.8 9.4 Q0.4 8 -0.4 7.1 Z" fill="@griffe" stroke="@peauO" stroke-width="0.25"/>`,
};

// Cou SYSTÈME (os `cou`, #633) : cylindre de chair `@peau` couvrant TOUT l'os cou du canon
// (`rig/SKELETON-CONTRACT.md`) — de +4.5 (plongé dans le col du torse, qui le recouvre par z) au bas
// du crâne (y≈−16.4, attache de `tete` à −16). Le visage en couvre le haut ; la tranche visible
// (menton→col) fait ~4 unités + les flancs derrière la mâchoire.
// TOUJOURS peint en sous-couche (#633) ; un col de tenue/armure vient PAR-DESSUS via la table de
// priorité (resolve.ts) — z sous le torse (skeletons.ts) : le col couvre naturellement.
export const NECK: PartArt = {
  front: '<path d="M-3.3 4.5 Q-3.8 -6 -2.9 -16.4 Q0 -17.4 2.9 -16.4 Q3.8 -6 3.3 4.5 Q0 5.6 -3.3 4.5 Z" fill="@peau"/>' +
    '<path d="M-3.3 4.5 Q-3.8 -6 -2.9 -16.4 Q-3.6 -6 -3.4 4.2Z" fill="@peauO" opacity="0.35"/>' +
    '<path d="M3.3 4.5 Q3.8 -6 2.9 -16.4 Q3.6 -6 3.4 4.2Z" fill="@peauO" opacity="0.35"/>' +
    '<path d="M-0.9 -16.6 Q0 -17.1 0.9 -16.6 Q1 -8 0.6 1 L-0.6 1 Q-1 -8 -0.9 -16.6Z" fill="@peauH" opacity="0.35"/>',
  back: '<path d="M-3.4 4.5 Q-3.9 -6 -3 -16.4 Q0 -17.4 3 -16.4 Q3.9 -6 3.4 4.5 Q0 5.6 -3.4 4.5 Z" fill="@peau"/>' +
    '<path d="M-2.5 -0.8 Q0 0 2.5 -0.8" stroke="@peauO" stroke-width="0.4" fill="none" opacity="0.35"/>' +
    '<path d="M-0.7 -15.6 Q0 -15.2 0.7 -15.6 Q0.8 -8 0.5 0.6 L-0.5 0.6 Q-0.8 -8 -0.7 -15.6Z" fill="@peauH" opacity="0.3"/>',
  profile: '<path d="M-2.8 4.5 Q-3.2 -6 -2.3 -16.4 Q0.4 -17.3 3.1 -15.8 Q4 -6 3.4 4.5 Q0 5.6 -2.8 4.5 Z" fill="@peau"/>' +
    '<path d="M-2.8 4.5 Q-3.2 -6 -2.3 -16.4 Q-1.1 -14 -0.7 -6 Q-1 0 -1.5 4.3Z" fill="@peauO" opacity="0.35"/>' +
    '<path d="M1.7 -16.2 Q3.2 -13 3.3 -6 Q3.2 0 2.8 4.3" fill="none" stroke="@peauH" stroke-width="0.5" opacity="0.4"/>',
};

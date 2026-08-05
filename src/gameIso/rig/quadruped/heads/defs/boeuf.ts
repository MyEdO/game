import type { QuadHeadDef } from '../types';
import { eyeF } from '../kit';

/**
 * Tête de BŒUF (EDOC 7 l.54, créature #611) — étalon d'ART du quadrupède (#1082 P1b).
 *
 * ORDRE DU PEINTRE, IDENTIQUE SUR LES TROIS VUES — c'est le contrat de la tête :
 *
 *     OREILLES  →  CORNES  →  CRÂNE  →  MUFLE
 *
 * Verdict utilisateur du Lot 2 (2026-08-05, verbatim) : « Les cornes sont derrieres les oreilles
 * en sur la vue avant et sur la vue arriere. » La cause était de GRANULARITÉ : l'art de tête était
 * monolithique (crâne+oreilles+mufle en un bloc) et les cornes vivaient dans le canal `deco`, dont
 * le plan est RELATIF À L'OS — donc derrière le bloc ENTIER, oreilles comprises. La tête se dessine
 * désormais en FRAGMENTS nommés, et le plan relatif de chacun est son RANG dans la chaîne
 * ci-dessus : la corne naît DERRIÈRE le crâne (sa racine est couverte par la calotte, comme la
 * cheville osseuse d'un bovin) et DEVANT l'oreille (le fût passe par-dessus le pavillon, qui
 * s'implante plus bas et plus en arrière). Aucun `deco` de tête ne subsiste sur le bœuf : le canal
 * de fragments à plans reste pour ce qu'on RAPPORTE sur une bête (harnais, bride), pas pour son
 * anatomie.
 *
 * MATIÈRE (contrat de l'étalon, en-tête de `parts/tenues/defs/Chevalier-du-loup-blanc.ts`) :
 *  · Le VOLUME est une STRUCTURE DE VALEUR, jamais une texture. Les creux se posent au jeton QUASI
 *    NOIR `@corpsO` (#140c06, L≈5) par son OPACITÉ — jamais une teinte dérivée claire : le
 *    recoloriage joueur (#632) redérive la famille depuis la base choisie et les creux survivent.
 *  · Une surface n'est ÉCLAIRÉE que si elle franchit la mi-distance base↔lumière de sa matière
 *    (`@corps` #6b4526 L≈29,3 ; `@corpsH` #c99a5c L≈62,5 → seuil L≈45,9). Sur cette robe, un voile
 *    `@corpsH` à 0,5 rend L≈46,7 : il FRÔLE le seuil. Toute plage qui doit COMPTER comme surface
 *    éclairée est donc posée à ≥ 0,6 (front, chanfrein, bourrelet du mufle, arête d'oreille,
 *    arête de corne) ; les opacités basses ne sont que du modelé secondaire, jamais l'éclairage.
 *  · Les plages claires SUIVENT le contour (front plat, chanfrein, joue, dessus du mufle) — jamais
 *    une dalle à bord droit, qui lit « patch collé » (verdict de la ronde 1 du bovin).
 *  · Hachures GROUPÉES et courtes dans le sens du poil, jamais semées, jamais sous 0,6 u de
 *    `stroke-width` (plancher dur : 1 u = 0,33 px à la vignette 40 px).
 *
 * VIGNETTE 40 px — les CORNES sont l'identifiant n°1 : envergure ±24 u dans le repère de l'art,
 * soit 48 u, × `headScale` 1,2 (échelle d'os des vues de bout) ≈ 58 u de large sur une boîte de 120
 * (≈ 19 px à 40 px de rendu). Le crâne fait ±10,4 (25 u de boîte, ≈ 8,3 px) : le rapport
 * corne/crâne vaut ≈ 2,3 — le crâne bovin est LARGE, et c'est cette largeur qui interdit la lecture
 * « deux ailes et un bâton » que donnait le crâne étroit de l'équin.
 *
 * MATÉRIAU DE CORNE : famille de jetons custom `corne`/`corneO`/`corneH`, STOCKÉE par l'espèce
 * porteuse (`creatures/defs/Boeuf.ts`, `quad.stored`). Une espèce qui adopterait cette tête sans
 * stocker de base `corne` laisserait le jeton non résolu — `buildTokenMap` ne dérive que les
 * familles présentes dans `stored` (palette.ts).
 */

// ── OREILLES ──────────────────────────────────────────────────────────────────────────────────
// Bovin : pavillon LARGE porté à l'HORIZONTALE, en dehors du crâne, conque creusée. C'est le
// deuxième tell après les cornes (le cheval porte des oreilles courtes et DRESSÉES).
const oreilleFace = (s: number): string => {
  const P = (n: number) => (n * s).toFixed(1);
  return `<g>` +
    `<path d="M${P(6)} -11 Q${P(13)} -14.6 ${P(19.4)} -10.6 Q${P(21)} -7.4 ${P(18.4)} -4.4 Q${P(12)} -1.6 ${P(5.6)} -3.6 Z" fill="@corps" stroke="@corpsO" stroke-width="0.6"/>` +
    `<path d="M${P(7.6)} -9.2 Q${P(13)} -11 ${P(17.6)} -8.4 Q${P(18.4)} -6.6 ${P(15.6)} -5.2 Q${P(10.4)} -3.6 ${P(7.2)} -5.2 Z" fill="@corpsO" opacity="0.72"/>` + // conque CREUSÉE
    `<path d="M${P(6.6)} -10.4 Q${P(13)} -13.4 ${P(18.6)} -9.8" fill="none" stroke="@corpsH" stroke-width="1.7" opacity="0.75" stroke-linecap="round"/>` + // arête éclairée du dessus
    `</g>`;
};
const OREILLES_FACE = `<g data-part="oreilles">${oreilleFace(-1)}${oreilleFace(1)}</g>`;

// De DOS, le pavillon se voit par son DOS (uni, pas de conque) : masse pleine à arête claire.
const oreilleDos = (s: number): string => {
  const P = (n: number) => (n * s).toFixed(1);
  return `<g>` +
    `<path d="M${P(6)} -10.6 Q${P(13)} -14 ${P(19)} -10 Q${P(20.6)} -7 ${P(18)} -4 Q${P(11.6)} -1.4 ${P(5.6)} -3.4 Z" fill="@corps" stroke="@corpsO" stroke-width="0.6"/>` +
    `<path d="M${P(8.4)} -5.4 Q${P(13.6)} -6.4 ${P(18)} -4.4 Q${P(14)} -1.8 ${P(8)} -3.2 Z" fill="@corpsO" opacity="0.55"/>` + // dessous du pavillon dans l'ombre
    `<path d="M${P(6.8)} -10 Q${P(13)} -12.8 ${P(18.2)} -9.2" fill="none" stroke="@corpsH" stroke-width="1.6" opacity="0.7" stroke-linecap="round"/>` +
    `</g>`;
};
const OREILLES_DOS = `<g data-part="oreilles">${oreilleDos(-1)}${oreilleDos(1)}</g>`;

// De PROFIL le pavillon part vers l'ARRIÈRE-bas (−x) et il est COURT : vu de côté, une oreille
// bovine est fortement raccourcie (elle pointe vers le spectateur-côté, pas vers l'arrière). Une
// première passe la faisait courir jusqu'à −16,6 u : elle montait sur l'encolure et son arête
// claire lisait « aileron ». Le lointain d'abord, en robe d'ombre.
// IMPLANTATION : la base est portée DANS le crâne (x ≥ 0), pas contre son bord. Posé à la limite,
// le pavillon fermait son propre contour hors du crâne et lisait, au gros plan, comme une ANSE
// accrochée au-dessus de l'encolure. Le crâne étant peint après, seule la moitié qui dépasse se
// voit — et elle se voit comme une oreille implantée, jamais comme une pièce posée.
const oreilleProfil = (near: boolean): string => {
  // La LOINTAINE n'est plus un aplat `@corpsO` : deux pavillons quasi noirs empilés faisaient, sur
  // l'épaule, une DALLE anguleuse sombre (lecture d'image) au lieu d'une paire d'oreilles. Elle est
  // désormais de la robe, voilée d'ombre — une forme qui se devine DERRIÈRE, jamais un trou noir.
  return `<g transform="translate(${near ? 0 : 1.28} ${near ? 0 : 2.33})">` +
    `<path d="M-4.89 2.4 Q-8.1 -0.81 -11.32 0.88 Q-12.38 2.97 -10.37 4.7 Q-7.34 6.37 -4.31 5.15Z" fill="@corps" stroke="@corpsO" stroke-width="0.5"/>` +
    (near
      ? `<path d="M-6 3.3 Q-8.67 1.33 -10.64 2.47 Q-10.95 3.79 -9.35 4.64 Q-6.93 5.73 -5.51 5.04Z" fill="@corpsO" opacity="0.52"/>` + // conque creusée
        `<path d="M-5.43 2.68 Q-8.21 0.2 -10.87 1.44" fill="none" stroke="@corpsH" stroke-width="1.18" opacity="0.7" stroke-linecap="round"/>`
      : `<path d="M-4.89 2.4 Q-8.1 -0.81 -11.32 0.88 Q-12.38 2.97 -10.37 4.7 Q-7.34 6.37 -4.31 5.15Z" fill="@corpsO" opacity="0.45"/>`) +
    `</g>`;
};

// ── CORNES ────────────────────────────────────────────────────────────────────────────────────
// Lyre bovine : la cheville osseuse sort du sommet du crâne, balaie vers le DEHORS presque à plat,
// puis la pointe se REDRESSE. Cône plein : arête éclairée sur le dessus, dessous creusé au jeton
// quasi noir, pointe noircie (la corne noircit au bout).
const corneFace = (s: number): string => {
  const P = (n: number) => (n * s).toFixed(1);
  return `<g>` +
    `<path d="M${P(4.4)} -14.6 Q${P(13)} -19.6 ${P(20)} -18 Q${P(24)} -16.8 ${P(23.4)} -26.6 ` +
    `Q${P(21.6)} -18.4 ${P(18.6)} -14.2 Q${P(12.4)} -10.6 ${P(6.6)} -9.6 Z" fill="@corne" stroke="@corneO" stroke-width="0.6"/>` +
    `<path d="M${P(5.4)} -14 Q${P(13.2)} -18.4 ${P(19.6)} -17 Q${P(22.6)} -16 ${P(22.8)} -22.4" fill="none" stroke="@corneH" stroke-width="1.7" opacity="0.95" stroke-linecap="round"/>` +
    `<path d="M${P(7.4)} -10.8 Q${P(13)} -11.8 ${P(18.4)} -14.6 Q${P(21.4)} -16.4 ${P(22.4)} -20.6" fill="none" stroke="@corneO" stroke-width="1.9" opacity="0.6" stroke-linecap="round"/>` +
    `<path d="M${P(23.4)} -26.6 Q${P(22.4)} -21.6 ${P(21.8)} -19.4 Q${P(23.4)} -19.8 ${P(24)} -22.4 Z" fill="@corneO" opacity="0.95"/>` +
    `</g>`;
};
const CORNES_FACE = `<g data-part="cornes">${corneFace(-1)}${corneFace(1)}</g>`;

// De PROFIL la corne est un CROISSANT COURT et EFFILÉ : racine épaisse au sommet-arrière du crâne,
// balayage vers l'AVANT-haut, pointe SOMBRE et fine. Deux bornes se sont révélées à la lecture
// d'image et tiennent la forme :
//  · l'ÉPAISSEUR (≤ 3,4 u à la racine, ~2,5 au milieu, 0 à la pointe, repère NU). La passe
//    précédente gardait toute sa largeur jusqu'aux trois quarts : posée à plat sur la calotte, elle
//    lisait HOUPPE, et la lointaine, à peine décalée, ajoutait un coin noir — un plumet, pas des
//    cornes.
//  · la CORDE : 14,6 u (coin bas de racine → pointe) dans le repère NU, soit 22,8 u de boîte après
//    l'échelle d'OS du profil (1,56), ≈ 7,6 px à 40 px de rendu — au-dessus du plancher de 2,5 px,
//    et jamais la corne-sabre de 21 u de boîte.
// La LOINTAINE est la MÊME forme, raccourcie et posée en ombre : un second fût qui se devine
// derrière le crâne, jamais une pointe noire indépendante.
const corneProfil = (near: boolean): string => {
  const c = near ? '@corne' : '@corneO';
  return `<g transform="translate(${near ? 0 : 1.2} ${near ? 0 : 3.2})${near ? '' : ' scale(0.85)'}" opacity="${near ? 1 : 0.85}">` +
    // Bord EXTÉRIEUR (arrière-haut) : racine → pointe ; bord INTÉRIEUR (avant-bas) : pointe →
    // racine. La RACINE est calée SOUS la calotte (bord haut du crâne à y ≈ −3,7 en x = −4,2) :
    // elle y disparaît, le crâne étant peint après — la corne naît DERRIÈRE lui, comme une
    // cheville osseuse. Descendue de 4 u, elle serait avalée aux trois quarts (masque nul).
    // La racine s'épaissit vers le BAS (second coin à y = −0,7), jamais vers le haut : une racine
    // remontée à −5 dépasserait de la calotte en BARRETTE noire rectiligne au-dessus du front
    // (lecture d'image de la sonde de tête).
    // RONDE 5 (juge v2 : « dégager le croissant de la ligne de nuque, l'écarter d'un cran et
    // l'épaissir d'environ 1/5 ») : la POINTE se redresse (de y −14,2 à −15,8 pour 0,8 u de recul —
    // le croissant se dresse au lieu de coucher son fût sur la nuque) et la RACINE s'épaissit de
    // 5,3 à 6,3 u, +19 %, vers le BAS. La corde ne gagne que 8 % : la borne, c'est le retour de la
    // corne-sabre écartée à la ronde précédente. La LOINTAINE est en même temps ramenée derrière
    // (décalage 2,14 → 1,2, échelle 0,9 → 0,85) : elle dépassait la proche en lame sombre du côté
    // du toupet, et la paire lisait « une corne claire + un éclat noir » au lieu d'une lyre.
    `<path d="M-3.55 -4.03 Q-2.4 -12.9 6.9 -15.8 Q2.6 -10.2 1.8 -0.7Z" fill="${c}" stroke="@corneO" stroke-width="0.46"/>` +
    (near
      ? `<path d="M6.9 -15.8 Q2.5 -11 1.3 -1.4 L0 -2 Q1.6 -10 5.7 -14.9Z" fill="@corneO" opacity="0.45"/>` + // face d'OMBRE (dessous du fût)
        `<path d="M-2.7 -5.1 Q-1.5 -12 5.9 -15.2" fill="none" stroke="@corneH" stroke-width="1.26" opacity="0.95" stroke-linecap="round"/>` + // arête éclairée (dos du fût)
        `<path d="M6.9 -15.8 Q4.2 -14.8 2.6 -13.2 Q4.2 -12.8 5.6 -13.7 Q6.7 -14.7 6.9 -15.8Z" fill="@corneO"/>` // POINTE SOMBRE, franche
      : '') +
    `</g>`;
};

// ── CRÂNE ─────────────────────────────────────────────────────────────────────────────────────
// FACE : front PLAT et LARGE (±10,4) entre les chevilles, joues pleines, resserrement court sur la
// racine du mufle. Le toupet frontal (@cheveux) est le troisième tell bovin.
const CRANE_FACE =
  `<g data-part="crane">` +
  `<path d="M-10.4 -12.2 Q-11.6 -1.4 -9 6.6 Q-8 10.6 -6.8 14.4 Q0 17.2 6.8 14.4 Q8 10.6 9 6.6 Q11.6 -1.4 10.4 -12.2 Q5.8 -16.4 0 -16.8 Q-5.8 -16.4 -10.4 -12.2 Z" fill="@corps" stroke="@corpsO" stroke-width="0.7"/>` +
  // FRONT + chanfrein ÉCLAIRÉS : une seule plage qui SUIT le contour du crâne, de la ligne des
  // chevilles à la racine du mufle (0,66 → au-dessus du seuil de surface éclairée).
  `<path d="M-6.6 -13.4 Q0 -15.6 6.6 -13.4 Q7.2 -3.6 5.4 5.6 Q0 7.6 -5.4 5.6 Q-7.2 -3.6 -6.6 -13.4 Z" fill="@corpsH" opacity="0.66"/>` +
  // joues ENROULÉES dans l'ombre profonde (la droite plus creusée : elle fuit la lumière)
  `<path d="M-10.4 -10.4 Q-11.4 -1.4 -8.6 7.6 L-6.8 6.2 Q-9.2 -1.4 -8.4 -9.4 Z" fill="@corpsO" opacity="0.62"/>` +
  `<path d="M10.4 -10.4 Q11.4 -1.4 8.6 7.6 L6.8 6.2 Q9.2 -1.4 8.4 -9.4 Z" fill="@corpsO" opacity="0.8"/>` +
  // arcades sourcilières lourdes + creux temporal
  `<path d="M-9 -8.6 Q-6 -11 -3.4 -8.8 M9 -8.6 Q6 -11 3.4 -8.8" fill="none" stroke="@corpsO" stroke-width="1.3" opacity="0.7" stroke-linecap="round"/>` +
  // toupet frontal en mèches courtes entre les chevilles
  `<path d="M-5.6 -13.6 Q-4.4 -17 -2.2 -14.6 Q-0.8 -17.6 1 -14.8 Q2.8 -17.4 4 -14.4 Q5.4 -16.4 6 -13.8" fill="none" stroke="@cheveux" stroke-width="1.5" opacity="0.9" stroke-linecap="round"/>` +
  // hachures groupées de joue (sens du poil, vers le bas-avant)
  `<path d="M-8.4 -3 q0.8 3.6 0.4 6.6 M-6.2 -2 q0.8 3.6 0.4 6.6 M8.4 -3 q-0.8 3.6 -0.4 6.6 M6.2 -2 q-0.8 3.6 -0.4 6.6" fill="none" stroke="@corpsO" stroke-width="0.75" opacity="0.34" stroke-linecap="round"/>` +
  `${eyeF(-7.4, -4.6, 2)}${eyeF(7.4, -4.6, 2)}` +
  `</g>`;

// PROFIL : front PLAT (le chanfrein bovin est droit, pas busqué), ganache PROFONDE, joue pleine,
// crâne COURT (le museau effilé de l'équin est le défaut nommé au ticket).
// Le contour est OUVERT sur le bord ARRIÈRE (racine des cornes → ganache) : c'est par là que la
// tête entre dans l'encolure. Fermé, ce trait quasi noir courait EN PLEIN FLANC derrière la tête
// (constat utilisateur au zoom : « un trait noir de contour de tête traverse le flanc ») — un os
// ne se ferme jamais sur lui-même à une couture. Le remplissage, lui, reste un tracé CLOS.
//
// CONTRAT D'EMBOÎTEMENT (tête ↔ encolure, #1082) : la GANACHE est la ligne où la tête finit, et
// c'est la TÊTE qui va la chercher — son remplissage descend en arrière jusqu'à y ≈ 23 pour
// x ≈ −8 → 0, au-delà du pivot de gorge, sur la robe de l'encolure qu'elle recouvre (plan 9 contre
// 8). Une couture de DEUX parts se ferme par ces deux parts : toute pièce de raccord posée entre
// elles serait une troisième, dessinée dans un repère qui n'est celui d'aucune des deux, et
// multiplierait les coutures au lieu d'en fermer une. Le contour ouvert meurt DANS la gorge, là où
// la ligne de gorge de l'encolure le relaie.
const CRANE_PROFIL =
  `<g data-part="crane">` +
  `<path d="M-4.69 -3.64 Q-9.1 3.1 -8.5 11.4 Q-7.7 19.4 -1.2 23 Q4.4 24.8 9.99 22.23 Q13.62 21.42 15.01 17.85 Q16.32 13.43 14.94 8.89 Q13.01 3.12 8.37 -0.92 Q2.27 -5.61 -4.69 -3.64Z" fill="@corps"/>` +
  `<path d="M-4.4 20.6 Q-1.2 23 4.4 24.8 Q9.6 23.4 13.62 21.42 Q15.6 19.4 15.01 17.85 Q16.32 13.43 14.94 8.89 Q13.01 3.12 8.37 -0.92 Q2.27 -5.61 -4.69 -3.64" fill="none" stroke="@corpsO" stroke-width="0.59" stroke-linecap="round"/>` +
  // FRONT + chanfrein ÉCLAIRÉS : un COIN, large au front (4,5 u) et effilé sur la racine du mufle
  // (2,4 u), pas une bande d'épaisseur constante — à épaisseur constante elle décollait du crâne et
  // lisait « courroie de bride » en travers de la face (lecture d'image du gros plan, ronde 4).
  `<path d="M-4.16 -3.92 Q2.1 -5.63 7.98 -0.45 Q12.14 3.36 14.29 8.66 L12.16 9.62 Q9.59 5.12 5.71 1.84 Q1.18 -1.67 -4.13 0.64Z" fill="@corpsH" opacity="0.7"/>` +
  // JOUE : GALBE secondaire (0,34), pas une seconde source de lumière — le disque pâle à 0,64 se
  // détachait du crâne en « plaque » et, doublé des hachures, lisait branchie. La lumière de la
  // tête tient dans le coin du front ; la joue n'en est que le versant qui s'éteint.
  `<path d="M-1.72 3.43 Q3.47 2.28 7.21 6.9 Q8.12 11.05 5.69 13.33 Q1.42 13.72 -1.57 10.03 Q-2.72 6.53 -1.72 3.43Z" fill="@corpsH" opacity="0.34"/>` +
  // GANACHE + gorge CREUSÉES au jeton quasi noir — l'ombre court jusqu'au bout du remplissage, sur
  // l'encolure : c'est elle qui fait TOURNER le dessous de la tête vers le cou. Arrêtée au contour
  // du crâne, elle laissait le pan de robe qui enjambe la couture en plage de base sans
  // profondeur (écart de luminance de la tête mesuré à 27 contre 32 quand l'ombre allait au bout).
  `<path d="M-6.6 8.4 Q-6.2 16.4 -1 21.2 Q4.4 23.6 10.24 21.41 L9.84 18.83 Q4.6 20.4 0.4 17.8 Q-4 14.6 -4.7 8Z" fill="@corpsO" opacity="0.62"/>` +
  // arcade lourde + creux temporal
  `<path d="M-2.45 -0.87 Q1.08 -2.36 4.18 0.33" fill="none" stroke="@corpsO" stroke-width="1.26" opacity="0.6" stroke-linecap="round"/>` +
  // toupet sur le front, entre les chevilles
  `<path d="M-3.59 -2.85 q1.6 -2.37 3.15 -1.02 q1.4 -2.05 2.88 -0.04" fill="none" stroke="@cheveux" stroke-width="1.26" opacity="0.85" stroke-linecap="round"/>` +
  `<g data-eye="D" data-ec="3.38 3.12"><ellipse cx="3.38" cy="3.12" rx="1.68" ry="1.85" fill="#15100a"/><circle cx="3.85" cy="2.66" r="0.6" fill="#fff" opacity="0.7"/></g>` +
  // PAUPIÈRE (juge v2) — un œil de bovin n'est pas une bille posée sur la joue : le globe est
  // COIFFÉ d'une paupière lourde et frangée de cils. Elle est peinte APRÈS l'ancre `data-eye`, donc
  // elle coiffe aussi bien l'œil de catalogue qui viendrait s'y substituer. Deux traits seulement :
  // le bourrelet de robe qui mord sur le haut du globe, et son ourlet sombre.
  `<path d="M1.5 2.4 Q3.4 0.2 5.4 2.3 Q3.4 1.7 1.5 2.4Z" fill="@corps"/>` +
  `<path d="M1.4 2.5 Q3.4 0.4 5.5 2.4" fill="none" stroke="@corpsO" stroke-width="0.75" opacity="0.85" stroke-linecap="round"/>` +
  `</g>`;

// DOS : calotte LARGE + nuque qui descend entre les épaules. La ligne y=0 est la coupe
// crâne/nuque (`rigCutQuad*`, quadParts.ts) : au-dessus le crâne passe SUR le tronc, au-dessous la
// nuque passe DESSOUS. Oreilles et cornes vivent donc entièrement au-dessus de y=0.
const CRANE_DOS =
  `<g data-part="crane">` +
  `<path d="M-10.4 -12 Q-11.8 -1.6 -9 6.4 Q-7.4 12.6 -6 18.6 L6 18.6 Q7.4 12.6 9 6.4 Q11.8 -1.6 10.4 -12 Q5.8 -16.2 0 -16.6 Q-5.8 -16.2 -10.4 -12 Z" fill="@corps" stroke="@corpsO" stroke-width="0.7"/>` +
  // calotte ÉCLAIRÉE : arc qui suit le dôme et se referme en pointes sur les tempes
  `<path d="M-8 -11.4 Q0 -15 8 -11.4 Q7.4 -6.6 6 -2.6 Q0 -5.4 -6 -2.6 Q-7.4 -6.6 -8 -11.4 Z" fill="@corpsH" opacity="0.68"/>` +
  // épi de nuque éclairé qui file vers le garrot (raccord crâne→encolure)
  `<path d="M-3.6 -1.6 Q0 -3.4 3.6 -1.6 Q3 8 2.2 18 L-2.2 18 Q-3 8 -3.6 -1.6 Z" fill="@corpsH" opacity="0.6"/>` +
  // tempes enroulées dans l'ombre + sillon central de nuque
  `<path d="M-10.4 -10.2 Q-11.4 -1.6 -8.6 7 L-6.8 5.6 Q-9.2 -1.6 -8.4 -9.2 Z" fill="@corpsO" opacity="0.6"/>` +
  `<path d="M10.4 -10.2 Q11.4 -1.6 8.6 7 L6.8 5.6 Q9.2 -1.6 8.4 -9.2 Z" fill="@corpsO" opacity="0.8"/>` +
  `<path d="M0 -3 Q1.4 8 0 18.4 Q-1.4 8 0 -3 Z" fill="@corpsO" opacity="0.45"/>` +
  `<path d="M-6.4 2.6 q-0.8 4.4 -0.4 8.4 M6.4 2.6 q0.8 4.4 0.4 8.4" fill="none" stroke="@corpsO" stroke-width="0.8" opacity="0.34" stroke-linecap="round"/>` +
  // toupet vu de dos, entre les chevilles
  `<path d="M-5 -13.4 q1.4 -3 3.2 -1.2 q1.4 -2.6 3.2 -0.6 q1.6 -2.4 3 0.2" fill="none" stroke="@cheveux" stroke-width="1.4" opacity="0.85" stroke-linecap="round"/>` +
  `</g>`;

// ── MUFLE ─────────────────────────────────────────────────────────────────────────────────────
// Le tell n°2 après les cornes : plaque CARRÉE plus large que la racine du museau, narines en
// virgule bien écartées, bourrelet clair sur le DESSUS seulement (un anneau clair complet lit
// « gueule béante » — verdict de la ronde 2). Reposée en teinte de BASE, puis modelée : un simple
// voile d'ombre sur un aplat sombre ferait un TROU NOIR.
const MUFLE_FACE =
  `<g data-part="mufle">` +
  `<path d="M-8 6.6 Q0 4.6 8 6.6 Q9 12.8 7.4 17.6 Q0 20.8 -7.4 17.6 Q-9 12.8 -8 6.6 Z" fill="@corps" stroke="@corpsO" stroke-width="0.6"/>` +
  `<path d="M-6.8 11.8 Q0 10.4 6.8 11.8 Q7.4 15.6 5.6 17.8 Q0 20 -5.6 17.8 Q-7.4 15.6 -6.8 11.8 Z" fill="@corpsO" opacity="0.5"/>` + // dessous MOUILLÉ
  `<path d="M-7 7.4 Q0 5.4 7 7.4 Q7.2 9.6 6.8 10.8 Q0 8.8 -6.8 10.8 Q-7.2 9.6 -7 7.4 Z" fill="@corpsH" opacity="0.72"/>` + // bourrelet clair du DESSUS
  `<path d="M-5.2 12.2 Q-2.6 11.2 -1.6 13.2 Q-3 15.2 -5.4 14.6 Z M5.2 12.2 Q2.6 11.2 1.6 13.2 Q3 15.2 5.4 14.6 Z" fill="#0b0603"/>` + // narines
  `<path d="M-4.4 17.8 Q0 19.2 4.4 17.8" fill="none" stroke="#0b0603" stroke-width="0.9" opacity="0.9" stroke-linecap="round"/>` +
  `</g>`;

// Le MUFLE doit rester une MASSE PROPRE, détachée de l'ombre de gorge : à la ronde 3 les deux
// zones sombres se rejoignaient en une bande continue sous la tête et la bête portait un COLLIER
// (verdict). D'où l'ourlet clair de la lèvre inférieure (0,6), qui coupe la bande en deux, et un
// dessous de mufle allégé (0,5 → 0,38) : le noir franc est réservé au naseau et à la fente.
const MUFLE_PROFIL =
  `<g data-part="mufle">` +
  `<path d="M11.83 11.1 Q16.54 12.95 17.25 17.41 Q17.11 21.96 13.29 22.91 Q9.4 23.01 8.76 19.39 Q8.92 14.68 10.64 11.15Z" fill="@corps" stroke="@corpsO" stroke-width="0.5"/>` +
  `<path d="M10.57 16.71 Q14.49 17.97 16.6 20.39 Q16.22 22.37 13.29 22.91 Q9.8 22.37 9.25 19.61Z" fill="@corpsO" opacity="0.38"/>` +
  `<path d="M11.61 11.58 Q15.65 13.36 16.62 17.01" fill="none" stroke="@corpsH" stroke-width="1.6" opacity="0.72" stroke-linecap="round"/>` + // bourrelet clair du dessus
  `<path d="M9.22 21.47 Q11.42 23.05 14 22.65" fill="none" stroke="@corpsH" stroke-width="1.18" opacity="0.6" stroke-linecap="round"/>` + // OURLET de la lèvre : sépare mufle et gorge
  // NASEAU : trou FRANC, pas une virgule suggérée — à 40 px c'est le seul point noir du museau,
  // et un mufle sans naseau lit « groin ». 2 u de rayon dans le repère NU de l'art, × 1,56
  // d'échelle d'os au profil (`headScale` 1,2 × `TETE_PROFIL` 1,3) ≈ 1,05 px à 40 px.
  `<ellipse cx="14.46" cy="16.61" rx="2.02" ry="1.6" transform="rotate(32 14.46 16.61)" fill="#0b0603"/>` +
  `<path d="M12.95 14.93 Q15.58 15.63 16.11 17.8 Q14.16 17.85 12.86 16.61Z" fill="#0b0603"/>` +
  `<path d="M12.6 14.22 Q15.57 14.87 16.41 17.33" fill="none" stroke="@corpsH" stroke-width="0.84" opacity="0.62" stroke-linecap="round"/>` + // lèvre claire au-dessus : le naseau CREUSE
  `<path d="M9.53 20.15 Q11.9 21.75 14.84 21.05" fill="none" stroke="#0b0603" stroke-width="0.76" opacity="0.9" stroke-linecap="round"/>` + // fente de bouche
  `</g>`;

export const quadHead: QuadHeadDef = {
  key: 'boeuf',
  label: 'Bœuf',
  art: {
    // La chaîne de concaténation EST l'ordre du peintre : oreilles → cornes → crâne → mufle.
    front: `<g>${OREILLES_FACE}${CORNES_FACE}${CRANE_FACE}${MUFLE_FACE}</g>`,
    back: `<g>${OREILLES_DOS}${CORNES_FACE}${CRANE_DOS}</g>`,
    // PROFIL — l'art n'enveloppe RIEN : ses coordonnées sont celles de l'OS, comme au front et au
    // dos. L'os porte à lui seul l'échelle (`headScale` 1,2 × `TETE_PROFIL` 1,3 = 1,56, appliquée
    // par `composeQuad`) et `quadAnchor` est l'identité sur `tete`. Le port de tête (6° vers
    // l'avant) est cuit dans les coordonnées avec le reste : un `rotate` d'art, même rigide, laisse
    // le décor de tête et l'œil de catalogue (`data-ec`) arriver TOURNÉS d'un angle qu'aucun d'eux
    // ne connaît. Une seule unité, un seul repère, du crâne au naseau.
    profile: `<g>` +
      `<g data-part="oreilles">${oreilleProfil(false)}${oreilleProfil(true)}</g>` +
      `<g data-part="cornes">${corneProfil(false)}${corneProfil(true)}</g>` +
      `${CRANE_PROFIL}${MUFLE_PROFIL}</g>`,
  },
  // Bête de TRAIT : le poitrail et la croupe du gabarit (17/22 par défaut, taillés pour un équin)
  // sont trop étroits — la masse vue de bout se déclare ici, à l'échelle de l'ursidé.
  bodyWidth: { front: 22, back: 26 },
};

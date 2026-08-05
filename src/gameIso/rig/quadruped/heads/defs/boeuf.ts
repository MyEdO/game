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
 * VIGNETTE 40 px — les CORNES sont l'identifiant n°1 : envergure ±23,5 u dans le repère de l'art,
 * soit 58 u × `headScale` 1,24 ≈ 72 u de large sur une boîte de 120 (≈ 24 px à 40 px de rendu). Le
 * crâne fait ±10,4 (≈ 8,6 px) : le rapport corne/crâne tombe à ≈ 2,8 (il était de 3,7 quand le
 * bœuf portait le crâne étroit du 'cheval' — la bête lisait « deux ailes et un bâton »).
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
const oreilleProfil = (near: boolean): string => {
  // La LOINTAINE n'est plus un aplat `@corpsO` : deux pavillons quasi noirs empilés faisaient, sur
  // l'épaule, une DALLE anguleuse sombre (lecture d'image) au lieu d'une paire d'oreilles. Elle est
  // désormais de la robe, voilée d'ombre — une forme qui se devine DERRIÈRE, jamais un trou noir.
  return `<g transform="translate(${near ? 0 : 1.8} ${near ? 0 : 2.6})">` +
    `<path d="M-5.2 -4 Q-9.4 -7.4 -13 -5 Q-14 -2.4 -11.4 -0.6 Q-7.6 1 -4.4 -0.8 Z" fill="@corps" stroke="@corpsO" stroke-width="0.6"/>` +
    (near
      ? `<path d="M-6.4 -2.8 Q-9.8 -4.8 -12 -3.2 Q-12.2 -1.6 -10.2 -0.8 Q-7.2 0.2 -5.6 -0.8 Z" fill="@corpsO" opacity="0.52"/>` + // conque creusée
        `<path d="M-5.8 -3.6 Q-9.4 -6.2 -12.4 -4.4" fill="none" stroke="@corpsH" stroke-width="1.4" opacity="0.7" stroke-linecap="round"/>`
      : `<path d="M-5.2 -4 Q-9.4 -7.4 -13 -5 Q-14 -2.4 -11.4 -0.6 Q-7.6 1 -4.4 -0.8 Z" fill="@corpsO" opacity="0.45"/>`) +
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
//  · l'ÉPAISSEUR (≤ 4 u à la racine, ~3 au milieu, 0 à la pointe). La passe précédente gardait
//    5 u de large jusqu'aux trois quarts : posée à plat sur la calotte, elle lisait HOUPPE, et la
//    lointaine, à peine décalée, ajoutait un coin noir — la bête portait un plumet, pas des cornes.
//  · la CORDE : 14,3 u (racine → pointe), soit 18,7 u de boîte après l'ancre de profil (×1,31),
//    ≈ 6,2 px à 40 px de rendu — au-dessus du plancher de 2,5 px, et jamais la corne-sabre de 21 u.
// La LOINTAINE est la MÊME forme, raccourcie et posée en ombre : un second fût qui se devine
// derrière le crâne, jamais une pointe noire indépendante.
const corneProfil = (near: boolean): string => {
  const c = near ? '@corne' : '@corneO';
  return `<g transform="translate(${near ? 0 : 2.6} ${near ? 0 : 2.6})${near ? '' : ' scale(0.9)'}" opacity="${near ? 1 : 0.85}">` +
    // Bord EXTÉRIEUR (arrière-haut) : racine → pointe ; bord INTÉRIEUR (avant-bas) : pointe →
    // racine. La RACINE est calée SOUS la calotte (bord haut du crâne à y≈−10,4 en x=−7) : elle y
    // disparaît, le crâne étant peint après — la corne naît DERRIÈRE lui, comme une cheville
    // osseuse. Descendue de 5 u, elle serait avalée aux trois quarts (masque de corne nul).
    // RONDE 5 (juge v2 : « dégager le croissant de la ligne de nuque, épaissir d'environ 1/5 ») :
    // la pointe se REDRESSE de 2,8 u et la racine s'épaissit de 5,3 → 6,3 u (+19 %). La CORDE passe
    // de 16,2 à 17,4 u (+7 %) : le croissant reste court — la borne, c'est le retour de la
    // corne-sabre de 21 u, écartée à la ronde précédente.
    // La racine s'épaissit vers le BAS (second coin porté de −8,4 à −7,3), jamais vers le haut : le
    // bord haut du crâne passe à y≈−10 en x=−7,7, et une racine remontée à −11,5 dépassait de la
    // calotte en BARRETTE noire rectiligne au-dessus du front (lecture d'image de la sonde de tête).
    `<path d="M-7.7 -10 Q-7.2 -20 4.4 -23.4 Q-1.2 -17.4 -2 -7.3 Z" fill="${c}" stroke="@corneO" stroke-width="0.55"/>` +
    (near
      ? `<path d="M4.4 -23.4 Q-1.4 -18.4 -2.6 -8 L-4.2 -8.6 Q-2.6 -17.4 3 -22.2 Z" fill="@corneO" opacity="0.45"/>` + // face d'OMBRE (dessous du fût)
        `<path d="M-6.8 -11.4 Q-6 -18.8 3.2 -22.6" fill="none" stroke="@corneH" stroke-width="1.5" opacity="0.95" stroke-linecap="round"/>` + // arête éclairée (dos du fût)
        `<path d="M4.4 -23.4 Q1 -22 -0.8 -20 Q1.2 -19.6 2.8 -20.8 Q4.2 -22.2 4.4 -23.4 Z" fill="@corneO"/>` // POINTE SOMBRE, franche
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
const CRANE_PROFIL =
  `<g data-part="crane">` +
  `<path d="M-9 -9.4 Q-11.2 -1.4 -8.4 6.6 Q-6 14.4 0.6 18 Q6.2 20.6 11.6 19.4 Q15.8 18 17 13.6 Q18 8.2 15.8 3 Q12.8 -3.6 6.8 -7.8 Q-1 -12.6 -9 -9.4 Z" fill="@corps"/>` +
  `<path d="M-7.6 9.4 Q-6 14.4 0.6 18 Q6.2 20.6 11.6 19.4 Q15.8 18 17 13.6 Q18 8.2 15.8 3 Q12.8 -3.6 6.8 -7.8 Q-1 -12.6 -9 -9.4" fill="none" stroke="@corpsO" stroke-width="0.7" stroke-linecap="round"/>` +
  // FRONT + chanfrein ÉCLAIRÉS : un COIN, large au front (5,4 u) et effilé sur la racine du mufle
  // (2,8 u), pas une bande d'épaisseur constante — à épaisseur constante elle décollait du crâne et
  // lisait « courroie de bride » en travers de la face (lecture d'image du gros plan, ronde 4).
  `<path d="M-8.4 -9.8 Q-1.2 -12.6 6.4 -7.2 Q11.8 -3.2 15 2.8 L12.6 4.2 Q9 -0.8 4 -4.2 Q-1.8 -7.8 -7.8 -4.4 Z" fill="@corpsH" opacity="0.7"/>` +
  // JOUE : GALBE secondaire (0,34), pas une seconde source de lumière — le disque pâle à 0,64 se
  // détachait du crâne en « plaque » et, doublé des hachures, lisait branchie. La lumière de la
  // tête tient dans le coin du front ; la joue n'en est que le versant qui s'éteint.
  `<path d="M-4.6 -1.4 Q1.4 -3.4 6.4 1.6 Q8 6.4 5.4 9.4 Q0.4 10.4 -3.6 6.4 Q-5.4 2.4 -4.6 -1.4 Z" fill="@corpsH" opacity="0.34"/>` +
  // ganache + gorge CREUSÉES au jeton quasi noir
  `<path d="M-8.2 4.4 Q-5.4 13 1.4 17 Q7 19.6 11.8 18.4 L11 15.4 Q6.4 16.6 1.6 14.2 Q-3.8 11 -6 3.6 Z" fill="@corpsO" opacity="0.62"/>` +
  // arcade lourde + creux temporal
  `<path d="M-6 -6.4 Q-2 -8.6 2 -5.8" fill="none" stroke="@corpsO" stroke-width="1.5" opacity="0.6" stroke-linecap="round"/>` +
  // toupet sur le front, entre les chevilles
  `<path d="M-7.6 -8.6 q1.6 -3 3.6 -1.6 q1.4 -2.6 3.4 -0.4" fill="none" stroke="@cheveux" stroke-width="1.5" opacity="0.85" stroke-linecap="round"/>` +
  `<g data-eye="D" data-ec="1.4 -2.4"><ellipse cx="1.4" cy="-2.4" rx="2" ry="2.2" fill="#15100a"/><circle cx="1.9" cy="-3" r="0.72" fill="#fff" opacity="0.7"/></g>` +
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
  `<path d="M12.4 6 Q18.2 7.6 19.6 12.8 Q20 18.2 15.6 19.8 Q11 20.4 9.8 16.2 Q9.4 10.6 11 6.2 Z" fill="@corps" stroke="@corpsO" stroke-width="0.6"/>` +
  `<path d="M11.6 12.8 Q16.4 13.8 19.2 16.4 Q19 18.8 15.6 19.8 Q11.4 19.6 10.4 16.4 Z" fill="@corpsO" opacity="0.38"/>` +
  `<path d="M12.2 6.6 Q17.2 8.2 18.8 12.4" fill="none" stroke="@corpsH" stroke-width="1.9" opacity="0.72" stroke-linecap="round"/>` + // bourrelet clair du dessus
  `<path d="M10.6 18.6 Q13.4 20.2 16.4 19.4" fill="none" stroke="@corpsH" stroke-width="1.4" opacity="0.6" stroke-linecap="round"/>` + // OURLET de la lèvre : sépare mufle et gorge
  // NASEAU : trou FRANC, pas une virgule suggérée — à 40 px c'est le seul point noir du museau,
  // et un mufle sans naseau lit « groin ». 2,4 u de rayon × 1,31 d'ancre ≈ 1,05 px à 40 px.
  `<ellipse cx="16.2" cy="12.2" rx="2.4" ry="1.9" transform="rotate(26 16.2 12.2)" fill="#0b0603"/>` +
  `<path d="M14.2 10.4 Q17.4 10.9 18.3 13.4 Q16 13.7 14.3 12.4 Z" fill="#0b0603"/>` +
  `<path d="M13.7 9.6 Q17.3 10 18.6 12.8" fill="none" stroke="@corpsH" stroke-width="1" opacity="0.62" stroke-linecap="round"/>` + // lèvre claire au-dessus : le naseau CREUSE
  `<path d="M10.8 17 Q13.8 18.6 17.2 17.4" fill="none" stroke="#0b0603" stroke-width="0.9" opacity="0.9" stroke-linecap="round"/>` + // fente de bouche
  `</g>`;

export const quadHead: QuadHeadDef = {
  key: 'boeuf',
  label: 'Bœuf',
  art: {
    // La chaîne de concaténation EST l'ordre du peintre : oreilles → cornes → crâne → mufle.
    front: `<g>${OREILLES_FACE}${CORNES_FACE}${CRANE_FACE}${MUFLE_FACE}</g>`,
    back: `<g>${OREILLES_DOS}${CORNES_FACE}${CRANE_DOS}</g>`,
    // PROFIL — `scale(0,84)` : l'ancre de profil applique déjà un `scale(1.3)` propre au socle
    // (`quadAnchor`) EN PLUS de `headScale`, soit 1,56 pour le bœuf. Sans compensation, la tête
    // faisait 56 u de long pour un tronc de 110 (la moitié du corps). À 0,84 elle en fait 47,
    // et le rapport tête/tronc rejoint celui des vues de bout.
    profile: `<g transform="translate(2 5) rotate(6) scale(0.84)">` +
      `<g data-part="oreilles">${oreilleProfil(false)}${oreilleProfil(true)}</g>` +
      `<g data-part="cornes">${corneProfil(false)}${corneProfil(true)}</g>` +
      `${CRANE_PROFIL}${MUFLE_PROFIL}</g>`,
  },
  // Bête de TRAIT : le poitrail et la croupe du gabarit (17/22 par défaut, taillés pour un équin)
  // sont trop étroits — la masse vue de bout se déclare ici, à l'échelle de l'ursidé.
  bodyWidth: { front: 22, back: 26 },
};

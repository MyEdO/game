import type { CreatureDef } from '../types';
import type { QuadProps } from '../../quadruped/quadSkeleton';
import { BOEUF_PROFIL_COMPILE } from '../../quadruped/boeufProfilCompile';

// Bœuf (EDOC 7 l.54, créature #611) — BÊTE DE TRAIT : masse basse et lourde portée sur des
// pattes-poteaux courtes, encolure COURTE et épaisse fondue dans un garrot bossu, tête large au
// mufle CARRÉ, fanon pendant, et surtout des CORNES en lyre largement écartées — l'identifiant
// n°1 à la vignette. Morphologie explicitement ≠ équine (ticket #630) : build 'ursine' (barillet
// profond, bosse d'épaule, arrière lourd) sur sabots, là où le Cheval est 'equine' haut sur
// pattes à longue encolure — les deux silhouettes se séparent à 40 px par la masse, le cou,
// la coiffe et la ligne de dos.
//
// LA TÊTE EST UNE PART (#1082 P1b) : `head: 'boeuf'` → `quadruped/heads/defs/boeuf.ts`, qui porte
// crâne / oreilles / cornes / mufle en FRAGMENTS et leur ordre du peintre (les cornes s'insèrent
// entre crâne et oreilles sur les trois vues), plus la largeur de masse vue de bout (`bodyWidth`
// 22/26 — le poitrail et la croupe de l'équin étaient trop étroits pour une bête de trait). Ce
// fichier ne décore donc plus l'os `tete` : il ne garde que ce qui appartient à la BÊTE, pas à sa
// tête — fanon d'encolure et modelé du tronc. Le slot natif `headgear: 'cornes'` reste NON posé
// (deux crochets de chèvre montant droit, ~16 u d'envergure : ce n'est pas la lyre bovine, et les
// deux coiffes se superposeraient).
//
// VOLUME : les ombres se construisent au jeton QUASI NOIR `@corpsO` (#140c06) posé à l'OPACITÉ,
// jamais par une teinte dérivée claire — le recoloriage joueur (#632) redérive la famille depuis
// la base choisie et les creux survivent. Les surfaces éclairées sont de vraies PLAGES `@corpsH`
// qui SUIVENT le contour (ligne de dos, épaule, croupe), jamais des dalles à bord droit : sans
// surface éclairée un écart de luminance ne prouve rien (ancrage du contrat d'art #635), et une
// dalle rectangulaire lit « patch collé » (verdict de la ronde 1). Sur cette robe, la mi-distance
// base↔lumière vaut L≈45,9 (`@corps` L≈29,3, `@corpsH` L≈62,5) : une plage à 0,5 la FRÔLE — toute
// surface qui doit COMPTER comme éclairée est posée à ≥ 0,6. Les hachures sont GROUPÉES et
// COURTES dans le sens du poil (épaule, flanc, cuisse), jamais semées.
//
// PLANS : chaque fragment de `deco` déclare son `plan` RELATIF au plan de son os (#1082 Lot 2).
// Ici tous valent 0 : ce sont des calques de MODELÉ, peints avec l'art de leur os, dans l'ordre
// d'apposition — ils ne s'intercalent devant/derrière aucun autre os.
// GABARIT de la bête — déclaré AVANT l'art, parce que l'art en dépend : les lignes d'interface
// ci-dessous sont des FONCTIONS de ces scalaires, lues sur le squelette réel (`quadInterfaces`).
const QUAD: QuadProps = {
  sl: 1.06,
  build: 'bovin', // garrot bossu, creux de rein, croupe haute et charnue, ventre plein (quadParts)
  // ENCOLURE : courte (0,42) mais portée en AVANT — l'angle stocké négatif est penché de +40° par
  // le socle, ce qui sort la tête DEVANT le poitrail au lieu de la poser SUR le garrot (« moignon
  // soudé »). L'angle est ignoré de face/dos (`quadSkeletonForView` y refige 0) : ces deux vues
  // restent au pixel près celles de l'étalon, ce que `neckLen` — lu par les trois vues — aurait
  // déplacé.
  girth: 1.2, bodyLen: 1.04, neckLen: 0.42, neckAngle: -40, legLen: 0.8,
  // POSTURE de repos, PROFIL seulement (`quadSkeletonForView` refige les angles de face/dos, donc
  // ces deltas n'y entrent pas) : une bête de trait au repos est d'APLOMB. Le socle donne à tout
  // quadrupède un arrière angulé (cuisse en avant, jarret cassé) — juste pour un canidé, mais le
  // bœuf y « fléchissait du postérieur », et l'antérieur penché portait le pied sous la gorge.
  // Les deltas redressent les quatre membres sans toucher au socle.
  stance: {
    hautAvD: 1, basAvD: -6, piedAvD: 5, hautAvG: -3, basAvG: -4, piedAvG: 4,
    hautArD: 5, basArD: -9, piedArD: 4, hautArG: 4, basArG: -8, piedArG: 4,
  },
  head: 'boeuf', headScale: 1.2, tail: 'touffe-basse', tailLen: 1.05, mane: 'sans',
  ears: 'courtes', foot: 'sabot',
  palette: {
    corps: '#6b4526', corpsO: '#140c06', corpsH: '#c99a5c', // robe brune, ombre QUASI NOIRE, lumière franche
    cheveux: '#33210f', cheveuxO: '#0f0904', // touffe de queue + toupet frontal sombres
    cuir: '#241a12', // sabots
    corne: '#cfc0a0', corneO: '#2a2013', corneH: '#efe6cd', // corne crème à pointe sombre
  },
};
// LE PROFIL EST UN DESSIN, PAS UNE COMPOSITION (étalon #1082) : la bête entière est tracée d'un
// trait dans le repère du monde (`quadruped/atelier/boeuf-profil.dessin.mts`) puis compilée par os
// (`boeufProfilCompile.ts`) — silhouette, robe et modélé des 16 os y vivent ensemble. FACE et DOS
// se composent, elles, au socle + `deco` ci-dessous.

// FACE : le poitrail est désormais LARGE au socle (`bodyWidth.front = 22`, déclaré par la def de
// tête) — ce calque ne le REDESSINE plus, il le MODÈLE : ligne d'épaule éclairée qui suit le haut
// de la masse, sternum bombé, flancs enroulés dans l'ombre profonde, et le FANON pendant sous la
// gorge (le tell bovin de face, LARGE et COURT à festons ronds — étroit, long et à pointes il
// lisait « barbe/gland » pendu au menton, ronde 2).
const TRONC_FACE =
  `<g data-deco="poitrail">` +
  `<path d="M-13.6 -25.4 Q-6.4 -29.6 0 -30.2 Q6.4 -29.6 13.6 -25.4 L12 -21.4 Q6 -25.4 0 -26 Q-6 -25.4 -12 -21.4 Z" fill="@corpsH" opacity="0.78"/>` + // ligne d'épaule ÉCLAIRÉE
  `<path d="M-22 -6 Q-23.4 -22 -10.4 -28.6 L-11.4 -23 Q-18.4 -18 -19.4 -6 Q-19.4 8 -12.6 17.4 L-11 19 Q-21 10.4 -22 -6 Z" fill="@corpsO" opacity="0.5"/>` + // flanc gauche enroulé
  `<path d="M22 -6 Q23.4 -22 10.4 -28.6 L11.4 -23 Q18.4 -18 19.4 -6 Q19.4 8 12.6 17.4 L11 19 Q21 10.4 22 -6 Z" fill="@corpsO" opacity="0.68"/>` + // flanc droit, plus creusé
  `<ellipse cx="-1.4" cy="-6" rx="8.4" ry="15.6" fill="@corpsH" opacity="0.4"/>` + // sternum bombé (modelé)
  `<path d="M-13 -11.6 Q0 -14.6 13 -11.6 Q14.2 -3 12.4 4.6 Q12.8 9.4 9 12.4 Q4.6 14.6 0 14.8 Q-4.6 14.6 -9 12.4 Q-12.8 9.4 -12.4 4.6 Q-14.2 -3 -13 -11.6 Z" fill="@corps" stroke="@corpsO" stroke-width="0.6"/>` + // FANON
  `<path d="M-7.4 -11.4 Q0 -13.4 7.4 -11.4 Q8.4 -3 7 4.4 Q7.2 8.4 4.4 10.6 Q0 12.2 -4.4 10.6 Q-7.2 8.4 -7 4.4 Q-8.4 -3 -7.4 -11.4 Z" fill="@corpsH" opacity="0.66"/>` + // arête éclairée du fanon
  `<path d="M-10.4 -10.4 Q-11.4 0 -9.6 9 M10.4 -10.4 Q11.4 0 9.6 9" fill="none" stroke="@corpsO" stroke-width="1.1" opacity="0.5"/>` +
  `<path d="M-8.6 12 Q-4.4 14.4 0 14.8 Q4.4 14.4 8.6 12" fill="none" stroke="@corpsO" stroke-width="1" opacity="0.45"/>` + // ourlet bas du pli
  `<path d="M-16.4 -14 q-0.8 3.6 -0.4 6.8 M-17 -6.6 q-0.6 3.6 -0.2 6.8 M15.4 -14 q0.8 3.6 0.4 6.8" fill="none" stroke="@corpsO" stroke-width="0.85" opacity="0.3" stroke-linecap="round"/>` + // hachures groupées
  `</g>`;

// Les quatre membres de PROFIL (arête éclairée du canon, ombre de tendon) sont portés par le dessin
// entier, dans le repère de chaque os.
// DOS : la croupe est LARGE au socle (`bodyWidth.back = 26`) — ce calque la MODÈLE : dessus
// éclairé qui suit le dôme et se referme en pointes sur les hanches (des bouts coupés droit
// lisaient « épaulettes » posées sur les angles, ronde 2), sillon creusé, dessous dans l'ombre.
const TRONC_DOS =
  `<g data-deco="croupe">` +
  `<path d="M-21.6 -8.6 Q-19.4 -19.4 0 -23.4 Q19.4 -19.4 21.6 -8.6 Q17.4 -16.4 0 -19.4 Q-17.4 -16.4 -21.6 -8.6 Z" fill="@corpsH" opacity="0.84"/>` +
  `<path d="M-20.4 -4.4 Q-17.6 -15.4 0 -19 Q17.6 -15.4 20.4 -4.4 Q15.6 -12.4 0 -15 Q-15.6 -12.4 -20.4 -4.4 Z" fill="@corpsH" opacity="0.34"/>` + // seconde passe feutrée
  `<ellipse cx="-13.4" cy="-1" rx="10.4" ry="15.6" fill="@corpsH" opacity="0.62"/>` + // hanche gauche (surface éclairée)
  `<ellipse cx="13.4" cy="-1" rx="10.4" ry="15.6" fill="@corpsH" opacity="0.34"/>` + // hanche droite (modelé)
  // SILLON central creusé d'un ton : c'est lui qui sépare les DEUX masses de croupe en gris à
  // 40 px — à 0,45 les deux hanches se refermaient en une seule bosse.
  `<path d="M0 -20 Q3 0 0 22 Q-3 0 0 -20 Z" fill="@corpsO" opacity="0.62"/>` +
  `<path d="M0 -19 Q1.5 1 0 21" fill="none" stroke="@corpsO" stroke-width="1.6" opacity="0.8"/>` +
  `<path d="M-26 -4 Q-26 12.6 -13 23 L-14.6 19.4 Q-23.4 10.4 -23.6 -3 Z" fill="@corpsO" opacity="0.5"/>` + // flancs enroulés
  `<path d="M26 -4 Q26 12.6 13 23 L14.6 19.4 Q23.4 10.4 23.6 -3 Z" fill="@corpsO" opacity="0.7"/>` +
  `<ellipse cx="0" cy="21.4" rx="16.4" ry="5.6" fill="@corpsO" opacity="0.45"/>` + // dessous de croupe
  `<path d="M-17 -7 q-1.2 4.4 -0.8 8.4 M-11.6 -5 q-0.8 4.6 -0.4 8.6 M11.6 -5 q0.8 4.6 0.4 8.6 M17 -7 q1.2 4.4 0.8 8.4" fill="none" stroke="@corpsO" stroke-width="0.85" opacity="0.3" stroke-linecap="round"/>` +
  `</g>`;

export const creature: CreatureDef = {
  label: 'Bœuf',
  id: 'boeuf',
  plan: 'quadruped',
  // Le GABARIT est déclaré plus haut (`QUAD`) : l'art de FACE et de DOS en dépend, donc il ne peut
  // pas attendre la fin du fichier. Ici on ne fait que lui adjoindre son art de vue et son décor.
  quad: {
    ...QUAD,
    // ── ÉTALON « BÊTE ENTIÈRE PAR VUE » (#1082, validé utilisateur le 2026-08-06) ─────────────
    // Le PROFIL est DESSINÉ d'un trait dans le repère du monde, réparti en groupes d'os, puis
    // COMPILÉ dans le repère local de chaque os (coordonnées cuites). Cet art tient les 16 os qu'il
    // déclare — carrure, encolure, tête, queue et les douze os de membre. FACE et DOS se composent
    // au socle (+ `deco` ci-dessous) : la direction d'art épurée n'a été jugée que sur la vue de
    // profil, et le modèle suit ce qui a été mesuré.
    viewArt: { profile: BOEUF_PROFIL_COMPILE },
    deco: {
      // Seules les deux vues laissées au socle portent un décor : de profil, le dessin entier est
      // déjà l'art de chaque os.
      'tronc#front': [{ svg: TRONC_FACE, plan: 0 }],
      'tronc#back': [{ svg: TRONC_DOS, plan: 0 }],
    },
  },
};

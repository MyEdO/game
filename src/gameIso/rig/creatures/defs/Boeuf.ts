import type { CreatureDef } from '../types';

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
const BL = 1.04; // = quad.bodyLen — les decos de tronc suivent le même étirement que barrel()/X()
const X = (n: number): string => (n * BL).toFixed(1);

// ── FANON (encolure, PROFIL) ──────────────────────────────────────────────────────────────────
// L = 30 × neckLen = 12,6 : encolure COURTE. Le fanon pend de la gorge au poitrail en festons
// larges — le tell bovin de profil. L'os encolure n'a d'art qu'en profil : les vues de bout
// retombent proprement sur le nu (le fanon de face vit dans le deco de tronc).
// L'os porte DEUX natures d'art et elles ne se transforment pas pareil (cf. commentaires en place).
const FANON =
  `<g data-deco="fanon">` +
  // RACCORD DE GARROT : la base de l'encolure du socle (`quadParts.neck`) plonge dans le corps et
  // porte, sur tout son pourtour bas, le trait de crête et le pli de gorge. L'encolure étant peinte
  // APRÈS le tronc (plan 6 > 5), ces traits couraient en DIAGONALE en travers de l'épaule : à
  // l'image, une balafre claire-sombre au milieu du dos. Ce pan de robe pleine, sans contour, les
  // éteint là où l'encolure entre dans la masse — le cou FOND dans le garrot au lieu d'y être posé.
  `<path d="M-9 -4 Q-13 4 -15 19 L6 21 Q0 8 -2 -3 Z" fill="@corps"/>` +
  // CE QUI APPARTIENT À L'OS suit l'os : crête d'encolure éclairée (dessus du cou, côté −x) et
  // hachures du sens du poil. La crête s'ARRÊTE court (−12,4 → −4,4) et s'amincit : prolongée, elle
  // traversait l'épaule en diagonale (COURROIE DE HARNAIS), et même écourtée elle dépassait du
  // crâne en CROCHET clair — deux lectures d'image successives. Elle ne dit plus que le dessus du
  // cou, entre la nuque et le garrot où la lentille de dos prend le relais.
  `<path d="M-8.2 -12.4 Q-9.8 -8.4 -10.4 -4.4" fill="none" stroke="@corpsH" stroke-width="2.2" opacity="0.62" stroke-linecap="round"/>` +
  `<path d="M-5.6 -8.4 q1.8 2.2 1.6 5 M-2.8 -9.6 q1.8 2.4 1.6 5.2 M0 -10 q1.6 2.2 1.4 4.8" fill="none" stroke="@corpsO" stroke-width="0.8" opacity="0.32" stroke-linecap="round"/>` + // hachures groupées (sens du poil)
  // CE QUI PEND ne suit pas l'os : le `rotate(-32)` dé-tourne le fanon du surcroît de pente de
  // l'encolure (−8° → −40° stockés, soit +8° → +40° au monde) — un fanon PEND sous la gorge. Sans
  // cette contre-rotation la nappe part en biais vers l'avant et referme la gorge en COLLIER.
  `<g transform="rotate(-32)">` +
  `<path d="M8.8 -12.4 Q13.6 -9.6 14.2 -4 Q17.8 -1.4 16.6 2.2 Q20.2 4.6 18.4 8.4 Q21 11.4 18.6 15.2 Q13.6 19.4 8 16.6 Q7.2 3.4 8 -11 Z" fill="@corps" stroke="@corpsO" stroke-width="0.6"/>` +
  `<path d="M10.4 -9.6 Q11.2 2.4 11.6 13.8" fill="none" stroke="@corpsO" stroke-width="1.6" opacity="0.5"/>` + // creux du pli
  `<path d="M13.6 -6.6 Q15.4 2.4 16 11.4" fill="none" stroke="@corpsH" stroke-width="2.2" opacity="0.72" stroke-linecap="round"/>` + // arête éclairée du fanon
  `</g>` +
  `</g>`;

// ── TRONC ─────────────────────────────────────────────────────────────────────────────────────
// PROFIL : la SILHOUETTE (dos éclairé en lentille, nappe ventrale) appartient désormais à la
// CARRURE 'bovin' du socle (`quadParts.barrel`) — ce calque ne la redouble plus. Il ne pose que le
// MODELÉ que la carrure ne peut pas connaître : les trois plans du corps (épaule, flanc, cuisse) et
// leurs plis. Les grandes plages claires qui traversaient le flanc à la ronde 3 lisaient
// « barbouillage beige » (verdict) : ici, aucune valeur claire ne quitte le plan qu'elle décrit.
const TRONC_PROFIL =
  `<g data-deco="dos">` +
  // ÉPAULE : le plan de l'omoplate descend du garrot vers la pointe d'épaule. Nappe d'OMBRE en
  // coin le long du bord arrière (c'est la marche), LÈVRE claire devant elle sur le plan qui
  // regarde la lumière — un pli est une marche d'ombre bordée de lumière, jamais trois stries.
  `<path d="M${X(19.8)} -19.4 Q${X(14.6)} -9.6 ${X(15.6)} 5.4 Q${X(12.2)} 9.4 ${X(9.6)} 5.4 ` +
  `Q${X(9.6)} -9.4 ${X(14.8)} -19.4 Z" fill="@corpsO" opacity="0.2"/>` +
  `<path d="M${X(19)} -18.4 Q${X(15.6)} -9.4 ${X(16.2)} 4.4 Q${X(13.8)} 7.4 ${X(12.2)} 4.4 ` +
  `Q${X(12)} -8.4 ${X(15.6)} -18.4 Z" fill="@corpsO" opacity="0.22"/>` +
  `<path d="M${X(20.6)} -18.4 Q${X(17.6)} -10.4 ${X(18)} 2.4" fill="none" stroke="@corpsH" stroke-width="1.8" opacity="0.62" stroke-linecap="round"/>` +
  `<path d="M${X(24.4)} -22.6 Q${X(27.6)} -14.4 ${X(28.4)} -4.4 Q${X(27.6)} 4.4 ${X(24.4)} 10.4 ` +
  `Q${X(25)} 1.4 ${X(23.4)} -7.6 Q${X(22.6)} -15.6 ${X(24.4)} -22.6 Z" fill="@corpsH" opacity="0.62"/>` + // bombé du poitrail
  // CUISSE : un BOMBÉ rond sur la pointe de hanche, qui s'éteint AVANT le contour — poussé jusqu'au
  // bord, il lisait « bande beige peinte sur la croupe » (lecture d'image, ronde 4). Devant lui, le
  // CREUX DE FLANC : une crease étroite et douce, pas un second bandeau. Sans ce creux, cuisse et
  // barillet fondent en une seule masse-œuf ; trop marqué, il fait un pansement.
  `<ellipse cx="${X(-30)}" cy="-5.6" rx="${X(6.6)}" ry="12.4" transform="rotate(-8 ${X(-30)} -5.6)" fill="@corpsH" opacity="0.56"/>` +
  `<path d="M${X(-21.6)} -19.4 Q${X(-19.6)} -8.4 ${X(-20.4)} 4.4 Q${X(-21.8)} 10.4 ${X(-23.6)} 12.4 ` +
  `Q${X(-22.6)} 3.4 ${X(-22.6)} -6.6 Q${X(-23.2)} -13.4 ${X(-23.8)} -18.6 Z" fill="@corpsO" opacity="0.3"/>` +
  // GARROT : AUCUN calque ici. La bosse est déjà dite par la CARRURE — le contour la porte et la
  // lentille de dos y monte. Un dôme clair de plus, posé en travers de cette lentille, ne se lisait
  // pas comme un relief mais comme une TRAÎNÉE diagonale sur la robe (deux lectures d'image
  // successives) : deux valeurs claires voisines sur un même plan ne font pas un volume, elles font
  // une salissure. Idem pour l'ombre de rein qui l'accompagnait.
  // seconde passe FEUTRÉE sous la nappe ventrale de la carrure (fond l'ombre dans la robe, jamais
  // d'arête franche) + les deux plis courts qui disent le poids : aine et arrière du coude.
  `<path d="M${X(23)} 8.4 Q${X(4)} 16.6 ${X(-16)} 14.6 Q${X(-30)} 15.2 ${X(-38)} 9.6 ` +
  `Q${X(-28)} 12.4 ${X(-15)} 11.8 Q${X(3)} 13.6 ${X(23)} 5.4 Z" fill="@corpsO" opacity="0.54"/>` +
  `<path d="M${X(-19.6)} 3 Q${X(-17.2)} 9.4 ${X(-19)} 14.4" fill="none" stroke="@corpsO" stroke-width="1.1" opacity="0.45" stroke-linecap="round"/>` + // pli de l'aine
  `<path d="M${X(14.4)} 9.4 Q${X(16.4)} 13.4 ${X(15.4)} 17.4" fill="none" stroke="@corpsO" stroke-width="1.1" opacity="0.42" stroke-linecap="round"/>` + // pli d'arrière-coude
  // Le PROFIL ne porte AUCUNE hachure : posées sur la cuisse, les trois traits groupés lisaient
  // « griffures sur un bandeau » à la lecture d'image (rondes 3 et 4) — sur un flanc de 78 u de
  // long vu à 40 px, seule la VALEUR dit le poil. Les hachures restent là où elles décrivent une
  // vraie arête serrée : la joue de la tête, le fanon, les vues de bout.
  `</g>`;

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
  quad: {
    sl: 1.06,
    build: 'bovin', // garrot bossu, creux de rein, croupe haute et charnue, ventre plein (quadParts)
    // ENCOLURE : courte (0,42) mais portée en AVANT — l'angle stocké négatif est penché de +40° par
    // le socle, ce qui sort la tête DEVANT le poitrail au lieu de la poser SUR le garrot (« moignon
    // soudé »). L'angle est ignoré de face/dos (`quadSkeletonForView` y refige 0) : ces deux vues
    // restent au pixel près celles de l'étalon, ce que `neckLen` — lu par les trois vues — aurait
    // déplacé.
    girth: 1.2, bodyLen: BL, neckLen: 0.42, neckAngle: -40, legLen: 0.8,
    head: 'boeuf', headScale: 1.2, tail: 'touffe-basse', tailLen: 1.05, mane: 'sans',
    ears: 'courtes', foot: 'sabot',
    deco: {
      encolure: [{ svg: FANON, plan: 0 }],
      'tronc#profile': [{ svg: TRONC_PROFIL, plan: 0 }],
      'tronc#front': [{ svg: TRONC_FACE, plan: 0 }],
      'tronc#back': [{ svg: TRONC_DOS, plan: 0 }],
    },
    stored: {
      corps: '#6b4526', corpsO: '#140c06', corpsH: '#c99a5c', // robe brune, ombre QUASI NOIRE, lumière franche
      cheveux: '#33210f', cheveuxO: '#0f0904', // touffe de queue + toupet frontal sombres
      cuir: '#241a12', // sabots
      corne: '#cfc0a0', corneO: '#2a2013', corneH: '#efe6cd', // corne crème à pointe sombre
    },
  },
};

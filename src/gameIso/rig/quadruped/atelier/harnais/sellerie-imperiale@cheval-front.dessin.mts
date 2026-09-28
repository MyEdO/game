/**
 * ATELIER — LA SELLERIE IMPÉRIALE de FACE, cuite au gabarit CHEVAL (#1128) : ce que le harnachement
 * montre de BOUT, poitrail vers le spectateur — la bretelle de poitrail en cuir barrant le
 * poitrail, son médaillon doré, et les deux bords du caparaçon rouge qui dépassent de chaque côté
 * du garrot. C'est un SET D'ÉQUIPEMENT : il s'ajoute à la bête (canal `deco`), il ne la remplace
 * pas — le cheval est dessiné NU par le gabarit, robe et anatomie comprises.
 *
 *   npx tsx scripts/rig/compile-dessin-quad.mts sellerie-imperiale     (--check = porte)
 *
 * FIT-PAR-GABARIT : coordonnées MONDE (canevas 120×150, sol y=150), squelette du CHEVAL en vue
 * `front` — d'où le suffixe `@cheval` que le compilateur lit pour choisir le gabarit.
 *
 * UN SEUL OS : `tronc`. De face, le gabarit n'émet d'art que pour le tronc, la tête et les membres
 * (`encolure`, `croupe` et `queue` n'y portent rien) ; le harnais ne chevauche donc que le tronc,
 * seul os de bout où un fragment se peint. `plan: 0` = le plan de l'os — le fragment vient APRÈS
 * l'art de la robe.
 *
 * PILE DE PLANS (`quadZ.ts`, front) : la tête est DEVANT le tronc (9 > 5) et couvre la colonne
 * x∈[48..63] jusqu'à y≈55 ; les quatre membres sont DERRIÈRE (4 et 2 < 5). Les fragments occupent
 * donc les flancs (x ≤ 45 et x ≥ 66) au-dessus de y=55, et toute la largeur en dessous.
 *
 * SILHOUETTE MESURÉE (sonde sur le rendu du tronc nu, unité monde) : y=50 → x 39..72,
 * y=60 → x 38..73, y=70 → x 39..72, bas du barillet y=90. Chaque forme tient DANS ces bornes.
 *
 * DIRECTION D'ART ÉPURÉE, jugée à 40/64/128 px (arbitrage utilisateur du 2026-08-06) : CINQ formes,
 * trois taches — deux amorces rouges aux flancs, une barre de cuir en travers du poitrail, un seul
 * point d'or au centre. Aucune nappe à bord visible, aucun feston qui deviendrait du grésil à 40 px.
 *
 * JETONS : `@drap` (caparaçon), `@harnaisCuir` (cuirs), `@accent` (or) — jamais `@cuir`, jeton du
 * SABOT chez le cheval, qu'un recoloriage de robe ne doit pas traîner jusqu'au harnais.
 *
 * LANGAGE RESTREINT : uniquement des `<path>` en commandes ABSOLUES (M/L/C/Q/Z), aucun `<circle>`
 * (d'où le disque en quatre courbes de Bézier), aucun `<g transform>` enveloppant.
 */

/** Un groupe du dessin = un os du gabarit quadrupède. */
export interface GroupeDessin { bone: string; svg: string }

// ── outils d'écriture ────────────────────────────────────────────────────────────────────────
const F = (d: string, fill: string, op?: number) => `<path d="${d}" fill="${fill}"${op != null ? ` opacity="${op}"` : ''}/>`;
const S = (d: string, stroke: string, w: number, op?: number) =>
  `<path d="${d}" fill="none" stroke="${stroke}" stroke-width="${w}"${op != null ? ` opacity="${op}"` : ''} stroke-linecap="round"/>`;
const FS = (d: string, fill: string, stroke: string, w: number) => `<path d="${d}" fill="${fill}" stroke="${stroke}" stroke-width="${w}"/>`;
/** Disque en QUATRE courbes de Bézier (k = 0.5523) — le langage restreint n'a pas de `<circle>`. */
function disque(cx: number, cy: number, r: number): string {
  const k = +(r * 0.5523).toFixed(2);
  const n = (v: number) => +v.toFixed(2);
  return `M${n(cx - r)} ${n(cy)} C${n(cx - r)} ${n(cy - k)} ${n(cx - k)} ${n(cy - r)} ${n(cx)} ${n(cy - r)} ` +
    `C${n(cx + k)} ${n(cy - r)} ${n(cx + r)} ${n(cy - k)} ${n(cx + r)} ${n(cy)} ` +
    `C${n(cx + r)} ${n(cy + k)} ${n(cx + k)} ${n(cy + r)} ${n(cx)} ${n(cy + r)} ` +
    `C${n(cx - k)} ${n(cy + r)} ${n(cx - r)} ${n(cy + k)} ${n(cx - r)} ${n(cy)} Z`;
}
/** Médaillon doré de harnais : disque plein cerclé + rivet central. Un seul, au centre du poitrail. */
const medaillon = (cx: number, cy: number, r: number): string =>
  FS(disque(cx, cy, r), '@accent', '@accentO', 0.5) + F(disque(cx, cy, r * 0.36), '@accentO');

// ═════════════════════════════════════════════════════════════════════════════════════════════
// TRONC — le poitrail vu de bout. Ordre du peintre : les bords du caparaçon d'abord (ils viennent
// de derrière l'épaule), leur liseré doré, puis la bretelle qui passe PAR-DESSUS, et son médaillon.
// ═════════════════════════════════════════════════════════════════════════════════════════════
const TRONC = [
  // ── BORDS DU CAPARAÇON : deux amorces rouges ÉTROITES épousant le flanc de part et d'autre du
  //    garrot, du haut de l'épaule jusque sous la bretelle. Elles disent « la bête porte un tapis »
  //    sans dessiner le tapis, que la vue de bout ne montre pas — le poitrail est devant lui.
  //    Étroites et LONGUES : à largeur égale à leur hauteur, elles se lisaient en timbres collés
  //    sur l'épaule au lieu d'un bord d'étoffe qui file le long du flanc (vu au rendu 480).
  FS('M39.6 52.6 C38.4 57 38.6 66 40.4 73.4 L43.8 72.6 C42.2 66 42.4 57.6 42.9 53.4 Z', '@drap', '@drapO', 0.6),
  FS('M71.4 52.6 C72.6 57 72.4 66 70.6 73.4 L67.2 72.6 C68.8 66 68.6 57.6 68.1 53.4 Z', '@drap', '@drapO', 0.6),
  // liseré doré du caparaçon, sur le bord INTERNE des deux amorces (un seul path, deux sous-tracés).
  // Un FIL, pas une bande : à 1,1 u il pesait autant que l'étoffe qu'il borde.
  S('M42.9 53.4 C42.4 57.6 42.2 66 43.8 72.6 M68.1 53.4 C68.6 57.6 68.8 66 67.2 72.6', '@accent', 0.7),
  // ── BRETELLE DE POITRAIL : la barre de cuir en travers, la forme qui SIGNE la vue de face. Elle
  //    plonge au milieu comme une bricole attelée aux deux épaules.
  F('M41 60.6 C48 66.6 63 66.6 70 60.6 L70 65.4 C63 71.4 48 71.4 41 65.4 Z', '@harnaisCuir'),
  medaillon(55.5, 67.5, 2.4),
].join('');

export const DESSIN: GroupeDessin[] = [
  { bone: 'tronc', svg: TRONC },
];

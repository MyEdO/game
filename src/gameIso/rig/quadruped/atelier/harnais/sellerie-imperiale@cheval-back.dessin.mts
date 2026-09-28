/**
 * ATELIER — LA SELLERIE IMPÉRIALE de DOS, cuite au gabarit CHEVAL (#1128) : ce que le harnachement
 * montre par l'arrière — le troussequin vert de la selle posé au sommet de la croupe, la croupière
 * de cuir qui en descend vers la queue avec ses médaillons dorés, et les deux bords arrière du
 * caparaçon rouge qui dépassent aux flancs. C'est un SET D'ÉQUIPEMENT : il s'ajoute à la bête
 * (canal `deco`), il ne la remplace pas.
 *
 *   npx tsx scripts/rig/compile-dessin-quad.mts sellerie-imperiale     (--check = porte)
 *
 * FIT-PAR-GABARIT : coordonnées MONDE (canevas 120×150, sol y=150), squelette du CHEVAL en vue
 * `back` — d'où le suffixe `@cheval` que le compilateur lit pour choisir le gabarit.
 *
 * UN SEUL OS : `tronc`. De dos, le gabarit émet aussi `tete`, `nuque` et `queue`, mais le
 * harnachement ne chevauche aucun d'eux (la bride est hors champ derrière le crâne, et la queue est
 * un art de bête que le harnais n'habille pas) ; `croupe` et `encolure` ne portent pas d'art.
 * `plan: 0` = le plan de l'os — le fragment vient APRÈS l'art de la robe.
 *
 * PILE DE PLANS (`quadZ.ts`, back) : la QUEUE est DEVANT le tronc (6 > 5) et couvre la colonne
 * x∈[47..57] à partir de y≈60 ; la croupière plonge donc DERRIÈRE elle, comme le cuir passe sous
 * le crin. Les membres sont derrière le tronc (4 et 2 < 5), la nuque aussi (4,5).
 *
 * SILHOUETTE MESURÉE (sonde sur le rendu du tronc nu, unité monde) : sommet de croupe y=45
 * (x 51..60), y=48 → x 40..71, y=53 → x 35..76, plus large à y=59..66 (x 33..78), y=74 → x 35..76.
 * Chaque forme tient DANS ces bornes — le troussequin affleure la ligne de dos sans la dépasser.
 *
 * DIRECTION D'ART ÉPURÉE, jugée à 40/64/128 px (arbitrage utilisateur du 2026-08-06) : CINQ formes,
 * trois taches — vert au sommet, rouge aux deux flancs, deux points d'or sur les cuirs de croupe.
 * Aucune nappe à bord visible.
 *
 * JETONS : `@sangle` (selle), `@drap` (caparaçon), `@harnaisCuir` (cuirs), `@accent` (or) — jamais
 * `@cuir`, jeton du SABOT chez le cheval.
 *
 * LANGAGE RESTREINT : uniquement des `<path>` en commandes ABSOLUES (M/L/C/Q/Z), aucun `<circle>`,
 * aucun `<g transform>` enveloppant.
 */

/** Un groupe du dessin = un os du gabarit quadrupède. */
export interface GroupeDessin { bone: string; svg: string }

// ── outils d'écriture ────────────────────────────────────────────────────────────────────────
const F = (d: string, fill: string, op?: number) => `<path d="${d}" fill="${fill}"${op != null ? ` opacity="${op}"` : ''}/>`;
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
/** Médaillon doré de harnais : disque plein cerclé + rivet central. Deux, sur la croupière. */
const medaillon = (cx: number, cy: number, r: number): string =>
  FS(disque(cx, cy, r), '@accent', '@accentO', 0.5) + F(disque(cx, cy, r * 0.36), '@accentO');

// ═════════════════════════════════════════════════════════════════════════════════════════════
// TRONC — la croupe vue de bout. Ordre du peintre : les bords du caparaçon (les plus bas, aux
// flancs), puis le troussequin au sommet, puis la croupière qui en descend et ses médaillons.
// ═════════════════════════════════════════════════════════════════════════════════════════════
const TRONC = [
  // ── BORDS ARRIÈRE DU CAPARAÇON : deux amorces rouges ÉTROITES aux flancs, à l'aplomb de la
  //    selle. La vue de dos ne montre pas le tapis lui-même (la croupe est devant lui) : elle en
  //    montre les deux angles qui débordent du barillet. Étroites et longues, elles filent le long
  //    du flanc au lieu de se lire en timbres posés sur la croupe (vu au rendu 480).
  FS('M34.4 57.6 C33.4 62 33.4 71 35 79 L38.6 78.2 C37 71 37 62.6 37.7 58.4 Z', '@drap', '@drapO', 0.6),
  FS('M76.6 57.6 C77.6 62 77.6 71 76 79 L72.4 78.2 C74 71 74 62.6 73.3 58.4 Z', '@drap', '@drapO', 0.6),
  // ── TROUSSEQUIN : le dossier de la selle, coiffant le sommet de la croupe. Sa courbe suit la
  //    ligne de dos mesurée (sommet y=45) et l'affleure sans la franchir.
  FS('M45.6 53 C46.4 47.6 50.4 45.4 55.5 45.4 C60.6 45.4 64.6 47.6 65.4 53 C59 55 52 55 45.6 53 Z',
    '@sangle', '@sangleO', 0.7),
  // ── CROUPIÈRE : les deux sangles de cuir qui descendent du troussequin en s'écartant vers les
  //    hanches, de part et d'autre de la naissance de la queue. Un brin unique au CENTRE serait
  //    entièrement recouvert : de dos, la queue passe DEVANT le tronc (plan 6 > 5) et occupe
  //    x∈[47..57] dès y=60 — mesuré au rendu, il n'en restait que le médaillon.
  F('M52.6 54 L55 54.4 L45.4 73.4 L42.4 71.8 Z M58.4 54 L56 54.4 L65.6 73.4 L68.6 71.8 Z', '@harnaisCuir'),
  medaillon(55.5, 57, 2.4),
  //    Second point d'or, BAS sur le brin gauche (t≈0.80 le long de la sangle, centre du brin
  //    mesuré à cette hauteur : x∈[44.1..47.7]) : monté, le cavalier assis couvre le haut de la
  //    croupe et n'en laissait qu'un éclat — celui-ci tombe sous cette zone. Rayon 1.7 (< 2.4 du
  //    médaillon de jonction) : le brin est plus étroit ici, le clou s'y pose sans l'avaler.
  medaillon(45.9, 68.9, 1.7),
].join('');

export const DESSIN: GroupeDessin[] = [
  { bone: 'tronc', svg: TRONC },
];

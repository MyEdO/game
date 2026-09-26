/**
 * ATELIER — LA SELLERIE IMPÉRIALE de PROFIL, cuite au gabarit CHEVAL (#1128) : le harnachement
 * complet d'une monture de l'Empire — croupière à panneaux olive et médaillons dorés, caparaçon
 * rouge liseré d'or, selle matelassée verte à pommeau et troussequin, étrivière et étrier doré,
 * sangle de ventre, bride à ferret, muserolle, anneau de mors et rêne. C'est un SET
 * D'ÉQUIPEMENT : il s'ajoute à la bête (canal `deco`), il ne la remplace pas — le cheval est
 * dessiné NU dans `atelier/cheval-profil.dessin.mts`, robe, crinière et anatomie comprises.
 *
 *   npx tsx scripts/rig/compile-dessin-quad.mts sellerie-imperiale     (--check = porte)
 *
 * FIT-PAR-GABARIT : les coordonnées MONDE (canevas 120×150, sol y=150, bête tournée à DROITE) sont
 * celles du squelette du CHEVAL (`bodyLen` 1,05 / `neckLen` 1,12 cuits dans l'art de tronc et de
 * tête) — d'où le suffixe `@cheval` du nom de fichier, que le compilateur lit pour choisir le
 * gabarit. `quadruped/harnais/defs/sellerie-imperiale.ts` déclare la même espèce ; posé sur une
 * autre carrure, ce set glisserait.
 *
 * DEUX OS SEULEMENT, aux plans où le harnais chevauche la bête : `tronc` (croupière, caparaçon,
 * selle, sangle) et `tete` (bride). Chaque fragment est apposé APRÈS l'art de l'os, au MÊME plan
 * (`plan: 0`) : c'est l'ordre du peintre du dessin d'origine — la croupière derrière, le caparaçon
 * dessus, la selle et ses cuirs par-dessus tout.
 *
 * PILE DE PLANS (`quadZ.ts`, profil) — la carrure `equine` ne déclare PAS `sousTronc` : les membres
 * PROCHES se peignent DEVANT le barillet (9 > 5). Conséquence ici : le harnachement du tronc reste
 * en ARRIÈRE de l'épaule (x ≤ 78) — ce que le membre proche recouvre, il le recouvre légitimement
 * (la jambe passe devant le caparaçon).
 *
 * DIRECTION D'ART ÉPURÉE, jugée à 40/64/128 px (arbitrage utilisateur du 2026-08-06) : le harnais
 * se lit en TROIS taches — olive sur la croupe, vert sur le dos, rouge sur le flanc — plus une
 * seule tache d'or par pièce (médaillons, liserés, mors, étrier). Aucune nappe à bord visible.
 *
 * JETONS : la sellerie a ses cuirs PROPRES (`@sellerieCuir`), jamais `@cuir` — ce dernier est le
 * jeton du SABOT chez le cheval, et un recoloriage de robe ne doit pas traîner le harnais avec lui.
 * `@drap` (caparaçon), `@sangle` (selle et panneaux olive) et `@accent` (or) lui sont déjà exclusifs.
 *
 * LANGAGE RESTREINT : uniquement des `<path>` en commandes ABSOLUES (M/L/C/Q/Z) — c'est ce que le
 * compilateur sait ré-exprimer en cuisant les coordonnées dans le repère de l'os. Aucun `<circle>`
 * ni `<ellipse>` (d'où le disque en quatre courbes de Bézier), aucun `<g transform>` enveloppant.
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
/** Médaillon doré de harnais : disque plein cerclé + rivet central. Trois sur la croupière. */
const medaillon = (cx: number, cy: number, r: number): string =>
  FS(disque(cx, cy, r), '@accent', '@accentO', 0.5) + F(disque(cx, cy, r * 0.36), '@accentO');

// ═════════════════════════════════════════════════════════════════════════════════════════════
// TRONC — TROIS taches lisibles à la vignette : olive sur la croupe (croupière à panneaux), vert
// sur le dos (selle matelassée), rouge sur le flanc (caparaçon liseré d'or).
// C'est l'ordre du peintre : la croupière derrière, le caparaçon dessus, la selle et ses cuirs
// par-dessus tout.
// ═════════════════════════════════════════════════════════════════════════════════════════════
const TRONC = [
  // ── CROUPIÈRE : trois panneaux olive pendants sur la croupe, une bande de cuir en travers et
  //    trois médaillons dorés (la signature de l'artwork officiel).
  FS('M10.6 51.6 C13 47.6 16.6 45 20.6 45 L21 76.6 C17.4 77.6 14 76.6 11.6 73.6 Z', '@sangle', '@sangleO', 0.6),
  FS('M20.6 45 C24 45 27.4 46 30.6 47.6 L30.4 78 C27 79 23.8 78.4 21 76.6 Z', '@sangle', '@sangleO', 0.6),
  FS('M30.6 47.6 C33.6 49 36.6 50.4 40 50.6 L39.6 78.6 C36.4 79.4 33.2 79.2 30.4 78 Z', '@sangle', '@sangleO', 0.6),
  // dessus des panneaux éclairé (ils suivent la rondeur de la croupe) + creux entre les panneaux
  F('M10.6 51.6 C13 47.6 16.6 45 20.6 45 C26 45 33.6 48.6 40 50.6 L39.8 54.6 ' +
    'C33.6 52.6 26 49 20.8 49 C17.4 49 14.6 51 12.6 54.4 Z', '@sangleH', 0.62),
  S('M21 50 L21 76', '@sangleO', 1, 0.5),
  S('M30.5 51.6 L30.4 77.6', '@sangleO', 1, 0.5),
  F('M10.8 66 C16.6 68.6 24.6 70.6 32.6 70.6 C35 70.6 37.6 70.4 39.8 70 L39.7 74 ' +
    'C37.4 74.4 34.8 74.6 32.4 74.6 C24.2 74.6 16 72.6 10.9 70 Z', '@sangleO', 0.5),
  // bande de cuir + médaillons
  F('M11 61 C17.6 63.6 25.6 65.4 33.4 65.4 C35.6 65.4 37.8 65.2 39.9 64.9 L39.85 68.4 ' +
    'C37.6 68.7 35.4 68.9 33.2 68.9 C25 68.9 16.6 67 10.95 64.4 Z', '@sellerieCuir'),
  medaillon(15.6, 64, 2.6) + medaillon(25, 66.4, 2.6) + medaillon(34.4, 67, 2.6),
  // ── CAPARAÇON rouge liseré d'or : la grande tache du flanc. Son bord bas est FRANC (un feston
  //    y devient du grésil à 40 px), son liseré doré ne court que sur ce bord et le bord arrière.
  FS('M41.6 50.6 C52 51.6 64 50.6 74.6 47.6 L78 81.6 C66 85.6 52 86.4 41 83.6 Z', '@drap', '@drapO', 0.7),
  F('M41.6 50.6 C52 51.6 64 50.6 74.6 47.6 L75.4 55.6 C64.4 58.6 52.4 59.4 42 58.4 Z', '@drapH', 0.42),
  S('M41.4 83 C52.4 85.6 66 84.8 77.8 81', '@accent', 1.3),
  S('M41.2 51 L40.9 83.4', '@accent', 1.1, 0.85),
  S('M54 52.4 L53.4 85 M66 51.6 L65.6 84', '@drapO', 0.9, 0.4),
  // emblème doré au centre du drap (une seule tache d'or : à 40 px c'est un point, à 128 un cimier)
  F('M60 64 L63.4 69.6 L60 75.4 L56.6 69.6 Z', '@accent', 0.9),
  // ── QUARTIER de selle en cuir sur le caparaçon + étrivière et ÉTRIER doré. L'étrivière est
  //    reculée sous le MILIEU du quartier (x≈63) et la sangle avancée à son bord avant (x≈71) :
  //    superposées, la sangle sombre coupait l'anneau d'or de l'étrier en deux (vu 2 de l'épure).
  FS('M60.6 49.6 C66.6 49.6 72 48.6 76.6 47 L77.4 62.6 C71.6 65.4 65 66 61.4 64.6 Z', '@sangleO', '#2a2a14', 0.5),
  F('M62.4 63.6 L65 63.4 L65.8 80 L63.2 80.2 Z', '@sellerieCuir'),
  FS('M61.4 79.8 C60.4 84.8 62.4 88.8 64.6 88.8 C67 88.8 68.6 84.8 67.6 79.8 L65.6 79.9 ' +
    'C66.4 83.8 65.6 86 64.6 86 C63.6 86 62.8 83.8 63.4 79.9 Z', '@accent', '@accentO', 0.5),
  // sangle de ventre : elle sort du caparaçon et passe sous le barillet, en ARRIÈRE de l'avant-bras
  // proche — dessinée sous lui (x ≥ 74), elle disparaissait entièrement au rendu.
  F('M70.4 63 L74 62.4 L75.8 85.6 L72.2 86.4 Z', '@sellerieCuir'),
  // ── SELLE matelassée VERTE : troussequin arrière + pommeau avant, capitonnage, liseré doré.
  FS('M47.6 49.6 C45.6 44 47 39 51 38 C54.4 37.4 55.6 40.6 58.6 41.6 ' +
    'C62 42.6 65.6 41.6 68 38.6 C70 36 73.4 36.4 74.6 40 ' +
    'C76 44 75.6 47.4 74.6 48.4 C65.6 51.6 56 52.4 47.6 49.6 Z', '@sangle', '@sangleO', 0.7),
  F('M47.6 49.6 C45.6 44 47 39 51 38 C54.4 37.4 55.6 40.6 58.6 41.6 ' +
    'C60.6 42.2 62.6 42.2 64.4 41.6 C61.6 45.6 55.6 46.6 51.6 45 ' +
    'C50 47.6 49 48.6 47.6 49.6 Z', '@sangleH', 0.5),
  S('M50.6 43.6 C56 46.6 63.6 46.6 71.6 43.6 M53 40 C56 44.6 60.6 46.4 66 45.6', '@sangleO', 0.7, 0.55),
  S('M47.4 39.6 C48.6 37.6 50.6 37.4 51.6 38.6 M69.4 37.6 C71 36 73.4 36.6 74.4 39.4', '@accent', 1.1),
  // BRETELLE DE POITRAIL — écartée après mesure au rendu, pas par oubli : le devant de l'épaule est
  // occupé sur toute sa hauteur par l'ENCOLURE (plan 6, base jusqu'à y≈71) puis par l'avant-bras
  // PROCHE (plan 9, jusqu'à x≈89) ; il ne reste au tronc qu'un liséré de 2 u de large où une
  // bretelle se lit seulement en tiret. Un accessoire qu'on ne verrait pas est du bruit dans le
  // fichier ; l'artwork officiel le montre d'ailleurs largement masqué par le membre proche.
].join('');

// ═════════════════════════════════════════════════════════════════════════════════════════════
// TÊTE — la BRIDE : têtière le long de la joue, frontal à ferret doré, muserolle, anneau de mors,
// rêne qui S'ÉTEINT sur l'encolure (une rêne menée jusqu'à la main du cavalier absent flotte).
// Portée par l'os que le harnais chevauche : la bride suit la tête quand elle tourne.
// ═════════════════════════════════════════════════════════════════════════════════════════════
const TETE = [
  S('M104.6 37 C105.6 44 107 52 109.6 60', '@sellerieCuir', 1.8),
  S('M103.4 38.6 C106 36.6 109.6 36.6 112.2 38.8', '@sellerieCuir', 1.6),
  medaillon(107.8, 37, 1.6),
  S('M107.4 57.6 C110.4 55.6 113.6 55 116.4 55.8', '@sellerieCuir', 1.6),
  FS(disque(111.2, 62.2, 2.4) + disque(111.2, 62.2, 1.2), '@accent', '@accentO', 0.4),
  S('M109.4 62.6 C104.6 60.4 100.4 56.6 97.6 52', '@sellerieCuir', 1.3, 0.9),
].join('');

export const DESSIN: GroupeDessin[] = [
  { bone: 'tronc', svg: TRONC },
  { bone: 'tete', svg: TETE },
];

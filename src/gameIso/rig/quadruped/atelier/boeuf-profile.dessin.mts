/**
 * ATELIER — LE DESSIN du bœuf de PROFIL (#1082, étalon « bête entière par vue ») : la bête
 * ENTIÈRE, dans le repère du MONDE (canevas 120×150, sol y=150, bête tournée à DROITE). Une seule
 * illustration : la ligne de dos, l'épaule, la cuisse et la gorge sont tracées d'un trait, PUIS
 * réparties en groupes d'os. C'est la SOURCE de l'art ; `boeufCompile.ts` en est la sortie.
 *
 *   npx tsx scripts/rig/compile-dessin-quad.mts        (relance la compilation ; --check = porte)
 *
 * REPÈRES DU SQUELETTE RÉEL (boeuf, profil, repos — lus sur `resolveQuadFromProps`) :
 *   tronc (56, 89.4)  croupe (26.9, 87.4)  garrot/encolure (85.1, 77.4)  tête (93.2, 67.8)
 *   queue (10.9, 81.4)
 *   antérieur PROCHE  épaule (81.0, 99.4) genou (81.0, 123.4) boulet (80.3, 141.0) sol 150
 *   antérieur LOIN    (87.0, 97.4) (87.0, 121.4) (86.3, 139.0) sol 148
 *   postérieur PROCHE (20.6, 97.4) (21.5, 121.4) (19.9, 138.9) sol 147.9
 *   postérieur LOIN   (26.6, 95.4) (26.6, 119.4) (25.1, 136.9) sol 145.9
 *
 * VALEURS — les jetons de robe de la def : @corps (L≈29,3), @corpsO quasi noir posé à l'OPACITÉ,
 * @corpsH (L≈62,5). Mi-distance base↔lumière L≈45,9 : une surface qui doit COMPTER comme éclairée
 * est posée à ≥ 0,6.
 * LUMIÈRE : d'AU-DESSUS, légèrement de l'AVANT (droite du canevas). Plans du dessus éclairés,
 * flanc en mi-ton, ventre en ombre, mince rebond de sol sous le ventre.
 * DIRECTION D'ART ÉPURÉE, jugée à 40/64/128 px (arbitrage utilisateur du 2026-08-06) : silhouette
 * forte, identifiants d'espèce, 2-3 grands plans de valeur — aucune nappe à bord visible.
 *
 * LANGAGE RESTREINT : uniquement des `<path>` en commandes ABSOLUES (M/L/C/Q/Z) — c'est ce que le
 * compilateur sait ré-exprimer en cuisant les coordonnées dans le repère de l'os (aucun `<g
 * transform>` enveloppant : le cliquet `REPERES_ART_PROPRES` du dépôt l'interdit).
 */

/** Un groupe du dessin = un os du gabarit quadrupède. */
export interface GroupeDessin { bone: string; svg: string }

// ── outils d'écriture ────────────────────────────────────────────────────────────────────────
const F = (d: string, fill: string, op?: number) => `<path d="${d}" fill="${fill}"${op != null ? ` opacity="${op}"` : ''}/>`;
const S = (d: string, stroke: string, w: number, op?: number) =>
  `<path d="${d}" fill="none" stroke="${stroke}" stroke-width="${w}"${op != null ? ` opacity="${op}"` : ''} stroke-linecap="round"/>`;
const FS = (d: string, fill: string, stroke: string, w: number) => `<path d="${d}" fill="${fill}" stroke="${stroke}" stroke-width="${w}"/>`;
/**
 * DÉCALAGE d'AUTHORING — translate un fragment déjà écrit, en RÉÉCRIVANT ses coordonnées (les
 * nombres du `d` sont des paires x y en absolu : c'est l'invariant du langage restreint). Aucun
 * `<g transform>` n'en sort : le fragment reste en coordonnées cuites.
 */
const decale = (svg: string, dx: number, dy: number): string =>
  svg.replace(/d="([^"]+)"/g, (_m, d: string) => {
    let i = 0;
    return `d="${d.replace(/-?\d+(?:\.\d+)?/g, (n) => (+(+n + (i++ % 2 === 0 ? dx : dy)).toFixed(2)).toString())}"`;
  });

/**
 * MEMBRE en tube (segment d'axe + largeurs) — écrit dans le MONDE. Le membre est un cylindre :
 * une arête ÉCLAIRÉE sur son bord avant, une ombre de tendon sur son bord arrière, et rien
 * d'autre — au zoom de jeu, seule la valeur dit le poil.
 */
function tube(x0: number, y0: number, x1: number, y1: number, wTop: number, wBot: number, loin: boolean): string {
  const dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy);
  const nx = -dy / L, ny = dx / L; // normale (vers l'avant = +x du monde si le membre descend)
  const P = (t: number, k: number, w: number) => `${(x0 + dx * t + nx * k * w).toFixed(1)} ${(y0 + dy * t + ny * k * w).toFixed(1)}`;
  const corps = loin ? '@corpsO' : '@corps';
  const silhouette = `M${P(0, -0.5, wTop)} L${P(1, -0.5, wBot)} C${P(1.06, -0.3, wBot)} ${P(1.06, 0.3, wBot)} ${P(1, 0.5, wBot)} L${P(0, 0.5, wTop)} Z`;
  const art = [FS(silhouette, corps, '@corpsO', 0.6)];
  if (loin) {
    // Le membre LOINTAIN est plus SOMBRE — c'est ma valeur, pas un jeton automatique : un voile
    // d'ombre sur toute sa largeur, pour qu'il recule sans devenir une découpe noire.
    art.push(F(silhouette, '@corpsO', 0.34));
  } else {
    // arête éclairée du devant (bord +) — 0,62, au-dessus du seuil de surface éclairée
    art.push(F(`M${P(0.08, 0.16, wTop)} C${P(0.4, 0.34, wTop)} ${P(0.7, 0.34, wBot)} ${P(0.95, 0.2, wBot)} ` +
      `C${P(0.7, 0.1, wBot)} ${P(0.4, 0.1, wTop)} ${P(0.08, 0.16, wTop)} Z`, '@corpsH', 0.62));
    // ombre du tendon derrière (bord −)
    art.push(F(`M${P(0.1, -0.2, wTop)} C${P(0.45, -0.34, wTop)} ${P(0.75, -0.34, wBot)} ${P(0.96, -0.24, wBot)} ` +
      `C${P(0.75, -0.14, wBot)} ${P(0.45, -0.16, wTop)} ${P(0.1, -0.2, wTop)} Z`, '@corpsO', 0.36));
  }
  return art.join('');
}
/** SABOT : bloc trapézoïdal net, pince fendue, couronne claire — le seul élément non-robe du bas. */
function sabot(x: number, y: number, loin: boolean): string {
  const c = loin ? '@cuirO' : '@cuir';
  const h = loin ? 8.4 : 9;
  return FS(`M${x - 4.4} ${y} C${x - 4.8} ${y + h * 0.5} ${x - 4.6} ${y + h * 0.86} ${x - 4} ${y + h} ` +
    `L${x + 4} ${y + h} C${x + 4.6} ${y + h * 0.86} ${x + 4.8} ${y + h * 0.5} ${x + 4.4} ${y} ` +
    `C${x + 2} ${y - 1.4} ${x - 2} ${y - 1.4} ${x - 4.4} ${y} Z`, c, '#0e0b07', 0.5) +
    F(`M${x - 4.4} ${y + 0.4} C${x - 2} ${y - 1} ${x + 2} ${y - 1} ${x + 4.4} ${y + 0.4} ` +
      `L${x + 4} ${y + 2.2} C${x + 1.6} ${y + 0.8} ${x - 1.6} ${y + 0.8} ${x - 4} ${y + 2.2} Z`, '@corpsH', loin ? 0.16 : 0.32) +
    S(`M${x} ${y + 2.4} L${x} ${y + h - 0.6}`, '#0e0b07', 0.5, 0.55);
}

// ═════════════════════════════════════════════════════════════════════════════════════════════
// TRONC — la MASSE : dos, croupe, flanc, ventre, poitrail, épaule. Une seule silhouette continue.
// ═════════════════════════════════════════════════════════════════════════════════════════════
// Silhouette (sens horaire depuis le poitrail haut). Deux LOBES descendent sur les membres proches
// (x≈81 devant, x≈21 derrière) : c'est le corps qui enveloppe le haut du membre, pas le membre qui
// se plante devant le flanc.
const SILHOUETTE_TRONC =
  'M92.2 88 ' +
  'C90 78 86.5 68 79 61.5 ' +          // montée du garrot (bord avant, sous l'encolure)
  'C76.5 58.5 73 56.6 69.5 57.6 ' +    // BOSSE DE GARROT
  'C62 59.8 56 62.4 51 63.2 ' +        // creux de rein
  'C44 62 36 57.6 29.5 57.4 ' +        // remontée de croupe
  'C21 57.2 13.5 63.4 10 72 ' +        // pointe de la hanche → naissance de queue
  'C7.6 78.6 7.2 87 9.6 95 ' +
  'C11.6 101.8 14.4 108.6 17.8 114.4 ' + // fesse
  'C19.6 117.6 23.2 118.6 25.6 115.6 ' + // LOBE du postérieur proche
  'C27.6 113 29 110 30.2 106.8 ' +       // grasset
  'C34.6 114.2 41 119.6 49.6 121.6 ' +   // ventre
  'C58 123.4 65.4 122 70.8 118.6 ' +
  'C73 121.4 75.4 123.2 78.6 123 ' +     // LOBE de l antérieur proche
  'C82.4 122.6 85 119 86.6 114 ' +       // pointe du coude
  'C88.8 107 90.8 99 92 92.6 ' +         // poitrail
  'C92.4 90.6 92.4 89.2 92.2 88 Z';

// SURFACE ÉPURÉE (arbitrage de direction d'art, 2026-08-06 : « juste ces plaques moches ») — la
// bête est JUGÉE à 40-64 px. Le flanc porte DEUX grands plans et rien d'autre : la lumière du
// dessus (croupe → dos → épaule) et l'ombre du dessous (ventre → creux d'aisselle). Chacun est
// posé en TROIS passes emboîtées de faible opacité : le pas de valeur d'un bord vaut alors ~8 L,
// invisible à l'échelle du jeu, tandis que le cœur de la nappe atteint sa valeur pleine. C'est le
// FONDU qui remplace la découpe : aucune frontière ne se lit comme une forme posée.
// Le bord HAUT de la lumière est la ligne de dos elle-même (repris point pour point de la
// silhouette) — un bord qui coïncide avec le contour ne peut pas devenir une plaque ; le bord BAS
// de l'ombre est le contour du ventre, pour la même raison.
const TRONC = [
  FS(SILHOUETTE_TRONC, '@corps', '@corpsO', 0.7),

  // 1. LE GRAND PLAN ÉCLAIRÉ — croupe, dos, garrot, puis descente sur l'épaule. Une seule masse.
  F('M10 72 C13.5 63.4 21 57.2 29.5 57.4 C36 57.6 44 62 51 63.2 ' +
    'C56 62.4 62 59.8 69.5 57.6 C73 56.6 76.5 58.5 79 61.5 ' +
    'C86.5 68 90 78 92.2 88 C90.6 97 89 105 86.6 112 ' +
    'C80.6 104 75 93.6 71 83.6 C64 80.6 57.6 80 51 80.2 ' +
    'C43 79 36 77.6 29.6 77.4 C21.6 77.6 15.4 82.6 12.4 88.6 ' +
    'C10.4 82.6 9.6 77 10 72 Z', '@corpsH', 0.25),
  F('M12.6 71.6 C16.6 64.6 22.6 60.6 29.6 60.8 C36 61 43.6 65 51 66.2 ' +
    'C56.6 65.4 62.6 62.8 69.6 60.6 C73 59.6 76 61.4 78.2 64.4 ' +
    'C84.6 70.6 88 79.6 89.6 88.6 C88.6 96 87.4 102.6 85.6 108 ' +
    'C80.6 100.6 76 92 73 84 C65.6 81.6 58.6 81 51.6 81.2 ' +
    'C43.6 80.2 36.6 79 30.6 79 C23.6 79.2 17.6 82.6 14.6 88 ' +
    'C13.4 82.6 12.6 76.6 12.6 71.6 Z', '@corpsH', 0.25),
  F('M16.6 72.4 C20 66.6 24.6 63.6 30 63.8 C36.6 64 43.6 68 51 69 ' +
    'C57 68.2 62.6 65.6 69.6 63.6 C72.6 62.8 75.4 64.4 77.4 67 ' +
    'C82.6 72.6 85.6 80 87 87.6 C86.2 93.6 85.2 99 83.8 103.6 ' +
    'C79.8 96.6 76.2 89 73.8 82.4 C66.6 80.2 59 79.6 52 79.8 ' +
    'C44.6 79 38 78 32 78 C26 78.2 21 80.6 18 84.6 ' +
    'C17 80.6 16.6 76 16.6 72.4 Z', '@corpsH', 0.25),

  // 2. LE GRAND PLAN D'OMBRE — dessous du barillet, ventre, creux d'aisselle sous le poitrail.
  //    Son bord BAS est le contour du ventre repris point pour point (aucune arête possible), son
  //    bord HAUT est une SEULE courbe monotone : vu 1 de l'épure, un bord haut qui ondulait sur les
  //    attaches de membre rouvrait un chevron sombre au grasset — l'accident revenait par la nappe.
  F('M9.6 95 C11.6 101.8 14.4 108.6 17.8 114.4 C19.6 117.6 23.2 118.6 25.6 115.6 ' +
    'C27.6 113 29 110 30.2 106.8 C34.6 114.2 41 119.6 49.6 121.6 ' +
    'C58 123.4 65.4 122 70.8 118.6 C73 121.4 75.4 123.2 78.6 123 ' +
    'C82.4 122.6 85 119 86.6 114 C88.8 107 90.8 99 92 92.6 ' +
    'C89.6 100.6 86.6 107 82.6 111.6 C76.6 117.4 68.6 120.4 59.6 120.6 ' +
    'C48.6 120.6 38.6 116.6 31 109.6 C25 104 20.6 97.6 17.6 90.6 ' +
    'C14.6 91.6 11.8 93 9.6 95 Z', '@corpsO', 0.28),
  F('M13.6 106.6 C15 109.6 16.4 112.4 17.8 114.4 C19.6 117.6 23.2 118.6 25.6 115.6 ' +
    'C27.6 113 29 110 30.2 106.8 C34.6 114.2 41 119.6 49.6 121.6 ' +
    'C58 123.4 65.4 122 70.8 118.6 C73 121.4 75.4 123.2 78.6 123 ' +
    'C82.4 122.6 85 119 86.6 114 C87.8 110 89 105.6 89.8 101.6 ' +
    //  vu 2 : ce bord de retour passait par y≈123 — SOUS la courbe du ventre — et la nappe
    //  débordait du contour en un halo gris (le noir de robe à 28 % sur le fond). Il remonte.
    'C87 108 83 113 78 116 C71.6 120 63.6 121.6 55.6 121 ' +
    'C46.6 120.4 38 116.6 31 110.6 C25.6 105.6 21.6 100 19 94 ' +
    'C17 98 15.2 102.6 13.6 106.6 Z', '@corpsO', 0.28),
  //    creux d'AISSELLE : le poitrail surplombe le coude, c'est l'ombre la plus profonde de la
  //    bête — elle appartient au même plan, elle n'en est que le fond.
  //    Elle s'arrête à y≈121, DANS le lobe de l'antérieur : au-delà elle repassait sous la courbe
  //    du coude et laissait le même halo gris que la nappe (même cause, même correction).
  F('M74.6 110.6 C79.6 113.6 84 113 87.4 109 C87.8 114 86.6 118 84.4 120.6 ' +
    'C81.4 122 78.6 121.4 76 119.4 C73.6 117 72.6 114.6 74.6 110.6 Z', '@corpsO', 0.26),
].join('');

// ═════════════════════════════════════════════════════════════════════════════════════════════
// ENCOLURE — le cou COURT et épais + le FANON. Peinte APRÈS le tronc (plan 6 > 5) : sous la ligne
// de garrot elle n a droit qu à de la ROBE, jamais à une ligne — un contour qui y descend court en
// travers de l épaule et s y lit en balafre diagonale.
// ═════════════════════════════════════════════════════════════════════════════════════════════
const ENCOLURE = [
  // MASSE — de la nuque au garrot, débordant SOUS la ligne de coupe (recouvrement contracté) :
  // c est ce débord qui interdit toute couture visible quand la tête tourne. Elle est peinte SANS
  // AUCUN TRAIT ; le contour ne revient que sur les deux arêtes qui sont vraiment une silhouette
  // (crête du dessus, gorge), en traits OUVERTS qui MEURENT au garrot.
  // GARDE DE COUTURE (`quad-couture.test.ts`, corde ≥ 40 % de l épaisseur de l os couvert) : le cou
  // avance jusque SOUS la ganache, de quoi laisser la tête MORDRE dans les huit poses. Ce débord
  // est invisible (la tête le recouvre au plan 7) et c est lui qui tient la gorge fermée.
  F('M99.6 62.6 C92.6 61 84 63 79 67.6 C75.6 70.6 73.4 75 72.4 80 ' +
    'C77.6 89.6 84 97.6 90.6 104.6 C95.4 100 99 93 100.6 85 ' +
    'C102.6 77.6 102.4 68.6 99.6 62.6 Z', '@corps'),
  S('M96.6 63.6 C90.6 61.6 84 63 79 67.6 C76.4 69.8 74.6 72.6 73.4 76', '@corpsO', 0.7), // crête
  S('M98.2 82 C97.4 88.6 96 94.6 93.6 99.6', '@corpsO', 0.7, 0.55), // gorge, éteinte avant le poitrail
  // CRÊTE d encolure ÉCLAIRÉE (dessus du cou) : elle NAÎT à la nuque et MEURT avant le garrot —
  // prolongée, elle traverse l épaule en courroie de harnais.
  F('M95.6 65 C89.6 62.6 83 64 78.4 68.4 C76.4 70.2 74.8 72.4 73.6 75 ' +
    'L77 78 C78 75.6 79.4 73.6 81.2 72 C85.4 68.2 90.6 67 96 68.6 Z', '@corpsH', 0.62),
  // gorge en ombre (le cou tourne vers le poitrail)
  F('M97.6 84 C96.6 91 94.6 97.6 91.6 102.6 L88.4 99 C91 94.6 92.6 88.6 93.6 82 Z', '@corpsO', 0.32),
  // FANON — il PEND sous la gorge en trois festons larges et ronds : le tell bovin de profil.
  // Lui garde son contour : c est une VRAIE silhouette, détachée sur le poitrail.
  FS('M97.6 76.6 C101 81 100.4 85.6 97.6 88.6 C101.4 91.6 100.6 96.4 97.4 99 ' +
    'C100.4 102.6 99.4 107 95.6 109.4 C92 111 88.4 109.4 86.6 106 ' +
    'C85 99.6 84.8 92 86.2 84.4 C88.6 78 93.2 74.4 97.6 76.6 Z', '@corps', '@corpsO', 0.6),
  S('M96.4 79.6 C98.6 85 98 91.6 97 98 C96.4 102.4 95 106 92.6 108.4', '@corpsH', 2.4, 0.68), // arête éclairée
  S('M90.6 82 C89.2 89.6 89.2 98 90.6 106.6', '@corpsO', 1.8, 0.46), // creux du pli
].join('');

// ═════════════════════════════════════════════════════════════════════════════════════════════
// TÊTE — crâne large, mufle CARRÉ, ganache lourde, oreille, et les CORNES en croissant dégagé
// (l identifiant n°1 à la vignette). Peinte au plan 7 : elle recouvre l encolure.
// La tête bovine est un COIN à trois arêtes DROITES (front plat → chanfrein rectiligne → mufle
// carré à bord avant vertical), ganache creusée en angle net, oreille repliée en une feuille COURTE
// qui plonge sous la ligne de cou, corne en vrai CROISSANT à dessous CONCAVE. Toute courbure de
// crâne ramenée au rond fait lire « ours » à la vignette ; une oreille dressée mange les 14 u de
// cou visible ; une corne à dessous droit lit « aileron ».
// ═════════════════════════════════════════════════════════════════════════════════════════════
const TETE = [
  // OREILLE d abord (la corne naît devant elle, le crâne devant les deux) — courte, plongeante.
  // Une oreille vue de profil regarde de l autre côté : elle est presque ENTIÈREMENT dans l ombre,
  // seul son bord supérieur prend la lumière. C est le CONTRASTE qui la fait exister, pas sa
  // taille — à la valeur du cou derrière elle, elle disparaît.
  FS('M96.4 73 C91.6 72.6 87 75.6 84.2 81.4 C87.2 85 91.6 86 95.4 83.8 ' +
    'C98 82.2 99.4 78.8 99.2 75 Z', '@corps', '@corpsO', 0.6),
  F('M95.6 74.6 C91.4 74.6 87.4 77.4 85 82.4 C87.8 85 91.6 85.6 95 83.4 ' +
    'C97.2 81.8 98.4 79 98.2 76 Z', '@corpsO', 0.55),
  S('M96.2 73.4 C91.6 73.2 87.4 75.8 84.8 80.6', '@corpsH', 1.6, 0.55),
  // CORNE LOINTAINE (derrière le crâne, plus sombre, plus courte)
  FS('M94.6 64.6 C98.6 59.6 103.4 55.6 108.6 53 C106 57.6 103 62.4 100.6 67.6 ' +
    'C98 67.4 95.8 66.4 94.6 64.6 Z', '@corneO', '#2a2013', 0.4),
  // CORNE PROCHE en CROISSANT : racine ÉPAISSE au poll, dessous CONCAVE, pointe redressée vers
  // l avant-haut. C est l identifiant n°1 de la bête à la vignette.
  FS('M96.6 68.6 C99.6 60.6 105.6 53.6 114 48.6 C116.6 47 117.6 48 116 50.6 ' +
    'C110.6 57.6 106.6 65 104 73 C100.6 73.4 97.8 71.6 96.6 68.6 Z', '@corne', '@corneO', 0.5),
  F('M99.6 67.6 C102.4 61.6 107 56 113 51.6 C108.6 57.6 105.4 63.6 103.2 70 ' +
    'C101.6 69.6 100.4 68.8 99.6 67.6 Z', '@corneH', 0.62),

  // CRÂNE + face : une seule masse continue du poll à la ganache. Trois arêtes DROITES — front,
  // chanfrein, mandibule — et un bord ARRIÈRE OUVERT qui va chercher l encolure sous lui (aucun
  // contour ne se referme sur la couture).
  FS('M95 65.6 C99.6 65.4 103.6 67.4 106.4 71.6 L112 85.6 ' +
    'C113.4 88.6 113.6 91.6 112.4 94.6 L110.6 99.6 ' +
    'C109.4 101.6 106.6 102.6 103 102.4 L96.6 101.6 ' +
    'C94 100.4 92.4 97 91.6 92 C90.8 86 90.8 79.6 91.6 74 ' +
    'C92 70.4 93.2 67.2 95 65.6 Z', '@corps', '@corpsO', 0.7),
  // plan clair du front et du CHANFREIN : une seule surface du poll au mufle — c est elle qui
  // donne à la face son arête. Elle s arrête AVANT le bord (sinon bec clair sur le contour).
  F('M96 68 C100 67.6 103.4 69.4 105.6 73 L110.6 86 ' +
    'C111.6 88.6 111.8 91 111 93.4 L107.6 92.6 C108.2 90.6 108 88.6 107.2 86.6 ' +
    'L102.6 74.6 C101 71.4 98.6 69.6 95.6 70 Z', '@corpsH', 0.64),
  // ARCADE de l orbite (creux) puis l œil — l œil bovin est GROS et posé bas sur le côté du crâne.
  F('M99 74.6 C102.4 74.4 105 76.4 105.8 79.6 C104.8 82.4 102 83.6 99.4 82.8 ' +
    'C97 82 95.8 80 96 77.6 C96.2 75.8 97.4 74.8 99 74.6 Z', '@corpsO', 0.46),
  FS('M100.4 76.4 C102.6 76.2 104.2 77.6 104.4 79.4 C104.2 81.2 102.6 82.4 100.6 82.2 ' +
    'C98.8 82 97.6 80.6 97.8 79 C98 77.4 99.2 76.5 100.4 76.4 Z', '#120c06', '@corpsO', 0.3),
  F('M101.8 77.6 C102.8 77.6 103.4 78.2 103.4 79 C103.2 79.8 102.4 80.2 101.6 79.8 ' +
    'C101 79.6 100.8 79 101 78.4 Z', '#ffffff', 0.74),
  // GANACHE — l angle de la mandibule, creusé : c est lui qui sépare la tête du cou en gris.
  F('M92.6 82 C91.6 87.6 92 93 94 97.6 C95.4 100.6 97.6 102 100.4 102.2 ' +
    'C97.6 99 96 94.6 95.4 89 C95.2 86.4 95.2 84 95.6 81.6 Z', '@corpsO', 0.38),
  // MUFLE CARRÉ : bord avant presque VERTICAL et coins nets (un rond lit « museau de chien »).
  FS('M104.6 89.6 L112.6 90.6 C114.6 91.4 115.6 93 115.4 95.4 L115 99.4 ' +
    'C114.4 101.6 112.4 102.8 109 103.2 L103.4 103.4 ' +
    'C101 103 99.6 101.4 99.6 99 L100.2 93.6 C100.8 91.2 102.4 89.8 104.6 89.6 Z', '@corps', '@corpsO', 0.6),
  F('M105.6 90.6 L112 91.6 C113.6 92.2 114.4 93.4 114.4 95.2 ' +
    'C111.6 96.6 107.6 97 103.6 96 C102 95.4 101.4 94.4 101.8 93.2 ' +
    'C102.4 91.4 103.6 90.6 105.6 90.6 Z', '@corpsH', 0.46),
  F('M109.6 93.6 C111.4 93.4 112.6 94.4 112.6 95.8 C112.4 97.4 111 98.4 109.4 98.2 ' +
    'C108 98 107.2 97 107.4 95.8 C107.6 94.4 108.6 93.7 109.6 93.6 Z', '#120c06', 0.74),
  S('M101.6 100.6 C105.6 102.4 110.4 102 114 99.6', '@corpsO', 1.2, 0.6), // fente de la bouche
].join('');

// ═════════════════════════════════════════════════════════════════════════════════════════════
// QUEUE — courte, tombante, avec son fouet noir. Plan 3 : derrière tout le corps.
// ═════════════════════════════════════════════════════════════════════════════════════════════
// Le fouet est une mèche POINTUE et le tronçon charnu MORD sur la croupe (son haut entre dans la
// fesse de 5 u) : détachée de la fesse, la queue lit en SAC posé à côté de la bête.
const QUEUE = [
  FS('M13.6 78 C10.6 83.6 8.6 90.6 8 98.6 C7.6 104 8 108.6 9 112.4 ' +
    'L12.6 111.6 C11.6 108 11.4 103.6 11.8 98.6 C12.4 91.6 14 85.6 16.4 81 Z', '@corps', '@corpsO', 0.6),
  S('M12.4 82.6 C10.6 88.6 9.6 95.6 9.6 102.6', '@corpsH', 1.4, 0.4),
  // FOUET : mèche qui s effile en POINTE (un ovale plein lit « sac »)
  F('M9 110.6 C11.6 115.6 12.4 121.6 11 127.6 C10.2 131.6 8.6 134.6 6.6 136.6 ' +
    'C5.4 132.6 5 127.6 5.6 122.6 C6 118 7.2 114 9 110.6 Z', '@cheveux'),
  F('M9.4 113 C10.8 116.6 11.2 120.6 10.6 124.6 C10.2 128.4 9 131.4 7.4 133.4 ' +
    'C7 129.6 7.2 125 7.8 120.6 C8.2 117.4 8.8 115 9.4 113 Z', '@cheveuxO', 0.62),
].join('');

// ═════════════════════════════════════════════════════════════════════════════════════════════
// LES 12 OS DE MEMBRE — dessinés dans le monde, aux axes RÉELS du squelette.
// ═════════════════════════════════════════════════════════════════════════════════════════════
// Le HAUT du membre proche démarre 12 u AU-DESSUS de son pivot : il est enveloppé par la
// silhouette du tronc (plan sous le barillet). C est ce recouvrement — et lui seul — qui tient la
// couture quand le membre balance.
export const DESSIN: GroupeDessin[] = [
  { bone: 'queue', svg: QUEUE },
  { bone: 'tronc', svg: TRONC },
  { bone: 'encolure', svg: ENCOLURE },
  // La tête est portée 5 u plus haut et 1 u plus en avant que son pivot : plus bas, elle pose sur
  // le poitrail et referme la gorge. Le décalage est cuit dans les coordonnées, jamais un repère
  // propre à la part.
  { bone: 'tete', svg: decale(TETE, 1, -5) },
  // antérieur LOINTAIN (x≈87)
  { bone: 'hautAvG', svg: tube(87.0, 88.4, 87.0, 121.4, 13.6, 10.4, true) },
  { bone: 'basAvG', svg: tube(87.0, 118.4, 86.3, 141.0, 9.6, 8, true) },
  { bone: 'piedAvG', svg: sabot(86.3, 139.6, true) },
  // postérieur LOINTAIN (x≈26.6)
  { bone: 'hautArG', svg: tube(26.6, 86.4, 26.6, 119.4, 14.6, 10.4, true) },
  { bone: 'basArG', svg: tube(26.6, 116.4, 25.1, 136.9, 9.6, 8, true) },
  { bone: 'piedArG', svg: sabot(25.1, 137.5, true) },
  // postérieur PROCHE (x≈21) — la cuisse est LARGE en haut (elle fond dans la fesse)
  { bone: 'hautArD', svg: tube(20.6, 85.4, 21.5, 121.4, 16.6, 11, false) },
  { bone: 'basArD', svg: tube(21.5, 118.4, 19.9, 138.9, 10.4, 8.6, false) },
  { bone: 'piedArD', svg: sabot(19.9, 139.5, false) },
  // antérieur PROCHE (x≈81)
  { bone: 'hautAvD', svg: tube(81.0, 87.4, 81.0, 123.4, 15.6, 11, false) },
  { bone: 'basAvD', svg: tube(81.0, 120.4, 80.3, 141.0, 10.4, 8.6, false) },
  { bone: 'piedAvD', svg: sabot(80.3, 141.6, false) },
];

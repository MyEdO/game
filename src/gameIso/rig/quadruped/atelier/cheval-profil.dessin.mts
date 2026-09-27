/**
 * ATELIER — LE DESSIN du cheval de PROFIL (#1082, vague P1b-MASSE, patron de l'étalon bovin) : la
 * bête ENTIÈRE et NUE, dans le repère du MONDE (canevas 120×150, sol y=150, bête tournée à
 * DROITE). Une seule illustration : ligne de dos, croupe, poitrail, encolure et gorge sont tracées
 * d'un trait, PUIS réparties en groupes d'os. Robe, crinière, queue, sabots et modelé des 16 os y
 * vivent ensemble — le HARNACHEMENT, lui, est un SET D'ÉQUIPEMENT porté par la DONNÉE (#1128 :
 * `atelier/harnais/sellerie-imperiale@cheval-profil.dessin.mts`, servi au canal `deco` par le
 * registre `quadruped/harnais/`) : un cheval de labour n'est pas sellé, un destrier l'est.
 * C'est la SOURCE de l'art ; `chevalProfilCompile.ts` en est la sortie.
 *
 *   npx tsx scripts/rig/compile-dessin-quad.mts cheval     (--check = porte)
 *
 * REPÈRES DU SQUELETTE RÉEL (cheval, profil, repos — lus sur `resolveQuadFromProps`) :
 *   tronc (56, 68.8)  croupe (26.6, 66.8)  garrot/encolure (85.4, 56.8)  tête/nuque (111.1, 35.2)
 *   queue (10.6, 60.8)
 *   antérieur PROCHE  épaule (81.2, 78.8) genou (81.8, 114.8) boulet (78.6, 141.0)
 *   antérieur LOIN    (87.2, 76.8) (85.3, 112.8) (81.2, 138.8)
 *   postérieur PROCHE hanche (20.3, 76.8) jarret (24.7, 112.5) boulet (20.6, 138.6)
 *   postérieur LOIN   (26.3, 74.8) (28.8, 110.7) (24.7, 136.8)
 *
 * PILE DE PLANS (`quadZ.ts`, profil) — la carrure `equine` ne déclare PAS `sousTronc` : les membres
 * PROCHES se peignent DEVANT le barillet (9 > 5), contrairement au bœuf. Conséquence tenue ici :
 * la cuisse et l'épaule proches n'ont AUCUN contour au-dessus de la ligne de ventre — elles y sont
 * remplies de la même robe que le tronc et ne se lisent que par leur MODELÉ ; le contour ne
 * reprend qu'une fois le membre sorti du corps. Un trait qui remonterait dans le flanc s'y lirait
 * en balafre.
 *
 * VALEURS — robe GRIS POMMELÉ : @corps (L≈80) est CLAIR, l'ombre @corpsO (L≈52) porte donc la forme
 * et @corpsH (L≈95) ne fait que poser les plans du dessus. C'est l'inverse du bœuf (robe sombre) :
 * ici les grands plans se construisent à l'OMBRE, en passes emboîtées de faible opacité, et le
 * plan clair reste une bande de dos étroite. Le bas des membres est ASSOMBRI (points sombres du
 * cheval de trait) et rendu au fanon CLAIR juste au-dessus du sabot : c'est ce couple qui fait
 * lire quatre pattes distinctes du fond à la vignette.
 * LUMIÈRE : d'AU-DESSUS, légèrement de l'AVANT (droite du canevas). Dessus du dos et de la croupe
 * éclairés, face avant du poitrail et du chanfrein éclairée, ventre et arrière de la croupe en
 * ombre.
 * DIRECTION D'ART ÉPURÉE, jugée à 40/64/128 px (arbitrage utilisateur du 2026-08-06) : silhouette
 * forte, identifiants d'espèce (encolure haute, garrot, croupe ronde, membres longs et fins,
 * crinière et queue argentées, robe gris pommelé), 2-3 grands plans de valeur — aucune nappe à
 * bord visible.
 *
 * LANGAGE RESTREINT : uniquement des `<path>` en commandes ABSOLUES (M/L/C/Q/Z) — c'est ce que le
 * compilateur sait ré-exprimer en cuisant les coordonnées dans le repère de l'os. Aucun `<circle>`
 * ni `<ellipse>` : le compilateur ne cuit que les `d` (un cercle garderait ses coordonnées MONDE
 * et volerait hors de son os) — d'où le disque en quatre courbes de Bézier (`disque`). Aucun `<g
 * transform>` enveloppant : le cliquet `REPERES_ART_PROPRES` du dépôt l'interdit.
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

/**
 * CANON en tube (segment d'axe + largeurs) — écrit dans le MONDE. Le membre bas du cheval est un
 * OS SEC : une arête éclairée sur son bord avant, l'ombre du tendon derrière, et rien d'autre.
 * Le membre LOINTAIN recule par un voile d'ombre, jamais par une découpe noire.
 */
function tube(x0: number, y0: number, x1: number, y1: number, wTop: number, wBot: number, loin: boolean): string {
  const dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy);
  const nx = -dy / L, ny = dx / L;
  const P = (t: number, k: number, w: number) => `${(x0 + dx * t + nx * k * w).toFixed(1)} ${(y0 + dy * t + ny * k * w).toFixed(1)}`;
  const corps = loin ? '@corpsO' : '@corps';
  const silhouette = `M${P(0, -0.5, wTop)} L${P(1, -0.5, wBot)} C${P(1.06, -0.3, wBot)} ${P(1.06, 0.3, wBot)} ${P(1, 0.5, wBot)} L${P(0, 0.5, wTop)} Z`;
  const art = [FS(silhouette, corps, '@corpsO', 0.55)];
  if (loin) {
    // Sur une robe CLAIRE, un voile à 0,36 ne recule pas : les membres lointains restaient à la
    // valeur du corps et les quatre pattes se lisaient en une seule masse pâle. Porté à 0,55 puis
    // à 0,68 : à 64 px, c'est le SEUL séparateur des deux paires — un contour n'y survit pas.
    art.push(F(silhouette, '@corpsO', 0.68));
  } else {
    // POINTS SOMBRES : le bas du membre s'assombrit vers le boulet (robe de cheval de trait). Deux
    // passes emboîtées, la seconde ne prenant que le tiers bas — à 64 px c'est ce dégradé qui
    // détache le canon du fond et donne au fanon clair un contre-ton contre lequel se lire.
    art.push(F(`M${P(0.3, -0.5, wTop)} L${P(1, -0.5, wBot)} C${P(1.06, -0.3, wBot)} ${P(1.06, 0.3, wBot)} ${P(1, 0.5, wBot)} L${P(0.3, 0.5, wTop)} Z`, '@corpsO', 0.3));
    art.push(F(`M${P(0.66, -0.5, wBot)} L${P(1, -0.5, wBot)} C${P(1.06, -0.3, wBot)} ${P(1.06, 0.3, wBot)} ${P(1, 0.5, wBot)} L${P(0.66, 0.5, wBot)} Z`, '@corpsO', 0.26));
    // arête éclairée du devant (bord +)
    art.push(F(`M${P(0.06, 0.14, wTop)} C${P(0.4, 0.32, wTop)} ${P(0.72, 0.32, wBot)} ${P(0.96, 0.18, wBot)} ` +
      `C${P(0.72, 0.06, wBot)} ${P(0.4, 0.06, wTop)} ${P(0.06, 0.14, wTop)} Z`, '@corpsH', 0.6));
    // ombre du tendon derrière (bord −)
    art.push(F(`M${P(0.1, -0.2, wTop)} C${P(0.45, -0.34, wTop)} ${P(0.78, -0.34, wBot)} ${P(0.97, -0.22, wBot)} ` +
      `C${P(0.78, -0.12, wBot)} ${P(0.45, -0.14, wTop)} ${P(0.1, -0.2, wTop)} Z`, '@corpsO', 0.34));
  }
  return art.join('');
}
/**
 * FANON du boulet — la touffe CLAIRE qui retombe sur le sabot. Avec les points sombres du canon
 * juste au-dessus, c'est le couple de valeurs qui détache les quatre pattes du fond à 40 px.
 */
const fanon = (x: number, y: number, loin: boolean): string =>
  F(`M${x - 4.4} ${y - 3.6} C${x - 5.4} ${y - 0.6} ${x - 5} ${y + 2.4} ${x - 3.6} ${y + 4.4} ` +
    `C${x - 1} ${y + 5.4} ${x + 2} ${y + 5.2} ${x + 4} ${y + 3.6} ` +
    `C${x + 5} ${y + 1} ${x + 4.8} ${y - 1.6} ${x + 3.8} ${y - 3.8} ` +
    `C${x + 1} ${y - 5} ${x - 2} ${y - 4.8} ${x - 4.4} ${y - 3.6} Z`, '@corpsH', loin ? 0.4 : 0.78);
/**
 * SABOT du cheval : paturon court incliné vers l'avant + boîte cornée ronde, SANS fente (la pince
 * fendue est bovine). Couronne claire à la jointure. (x, y) = pivot du pied, sole à y + 9.
 */
function sabot(x: number, y: number, loin: boolean): string {
  const c = loin ? '@corpsO' : '@corps';
  const cuir = loin ? '@cuirO' : '@cuir';
  const h = loin ? 8.2 : 9;
  return F(`M${x - 3.2} ${y - 1} C${x - 3.6} ${y + 1.4} ${x - 3.2} ${y + 3} ${x - 2.2} ${y + 4} ` +
    `L${x + 3.4} ${y + 4} C${x + 3.8} ${y + 2.2} ${x + 3.6} ${y + 0.4} ${x + 3} ${y - 1} Z`, c) +
    FS(`M${x - 3.4} ${y + 3.2} C${x - 4.2} ${y + 5} ${x - 4.6} ${y + h - 1.4} ${x - 4.2} ${y + h} ` +
      `L${x + 4.4} ${y + h} C${x + 4.8} ${y + h - 1.8} ${x + 4.6} ${y + 5.2} ${x + 3.8} ${y + 3.2} ` +
      `C${x + 1.4} ${y + 2.2} ${x - 1.4} ${y + 2.2} ${x - 3.4} ${y + 3.2} Z`, cuir, '#0e0b07', 0.5) +
    F(`M${x - 3.4} ${y + 3.4} C${x - 1.4} ${y + 2.4} ${x + 1.4} ${y + 2.4} ${x + 3.8} ${y + 3.4} ` +
      `L${x + 3.6} ${y + 5} C${x + 1.2} ${y + 4} ${x - 1.2} ${y + 4} ${x - 3.2} ${y + 5} Z`, '@corpsH', loin ? 0.2 : 0.42);
}

// ═════════════════════════════════════════════════════════════════════════════════════════════
// TRONC — la MASSE nue : garrot, dos, croupe ronde, poitrail profond, ventre, fesse. Une seule
// silhouette continue, qui EMBRASSE déjà la fesse et l'épaule (le membre proche ne fournit que ce
// qui sort du corps).
// ═════════════════════════════════════════════════════════════════════════════════════════════
const SILHOUETTE_TRONC =
  'M91 62 ' +
  'C90.6 54 87 48.4 79 46 ' +          // pointe d'épaule → GARROT
  'C70 44.4 60 48 48 49 ' +            // ligne de dos, léger creux de rein
  'C38 50 32 45.4 26 45 ' +            // remontée du rein → sommet de CROUPE
  'C17.4 44.6 11 51.4 8.6 62 ' +       // croupe ronde → naissance de queue
  'C7 70 8 78.6 11.4 86 ' +            // pointe de la fesse
  'C14.6 90.6 20.6 93.2 28.6 94.6 ' +  // dessous de la fesse
  'C41 96.2 56 95.6 67 92.6 ' +        // VENTRE
  'C77 89 85 83 89 75.6 ' +            // poitrail qui remonte au coude
  'C90.6 71.4 91.2 66 91 62 Z';

// SURFACE ÉPURÉE — la robe est CLAIRE : c'est l'OMBRE qui sculpte. Deux grands plans seulement, et
// chacun posé en passes EMBOÎTÉES de faible opacité (le pas de valeur d'un bord vaut ~5 L,
// invisible au zoom de jeu, tandis que le cœur atteint sa valeur pleine) : c'est le FONDU qui
// remplace la découpe. Le bord BAS de l'ombre du ventre est le contour du ventre lui-même, repris
// point pour point — un bord qui coïncide avec le contour ne peut pas devenir une plaque.
const PLANS_TRONC = [
  // 1. LE GRAND PLAN D'OMBRE — dessous du barillet, ventre, arrière de la fesse. Bord haut
  //    MONOTONE : un bord qui ondulerait sur les attaches de membre rouvre un chevron au flanc.
  F('M11.4 86 C14.6 90.6 20.6 93.2 28.6 94.6 C41 96.2 56 95.6 67 92.6 ' +
    'C77 89 85 83 89 75.6 C85.6 83.6 79 89 69.6 91.6 ' +
    'C57 94.6 43 94.6 31 92 C22.6 90 16 85.6 12.4 79.6 ' +
    'C11.4 81.6 11 83.6 11.4 86 Z', '@corpsO', 0.42),
  F('M14.6 90.6 C20.6 93.2 28.6 94.6 28.6 94.6 C41 96.2 56 95.6 67 92.6 ' +
    'C73 90.6 78.6 87.4 83 82.6 C78.6 88 72 91.4 64 92.8 ' +
    'C52.6 94.8 40 94.4 30 92 C24 90.6 19 88 15.4 84.6 ' +
    'C14.6 86.6 14.4 88.6 14.6 90.6 Z', '@corpsO', 0.32),
  // troisième passe, la plus resserrée : sur une robe claire les deux premières laissaient le
  // dessous du barillet à la valeur du dos, et la bête se lisait en masse plate à 40 px.
  F('M18 89 C23.6 92 31.6 94 40 94.6 C50 95.2 60 94.2 68 91.6 ' +
    'C64 94.4 55.6 96 46 95.8 C36.6 95.6 27.6 93.6 20.6 90.6 Z', '@corpsO', 0.3),
  // 2. LE PLAN ÉCLAIRÉ — croupe, dos, garrot : le dessus de la bête. Son bord HAUT est la ligne de
  //    dos elle-même, point pour point.
  F('M8.6 62 C11 51.4 17.4 44.6 26 45 C32 45.4 38 50 48 49 ' +
    'C60 48 70 44.4 79 46 C87 48.4 90.6 54 91 62 ' +
    'C89 56.6 85 52.6 79 51.4 C69 50 60 53 48 54 ' +
    'C38 55 32 51 26 50.6 C18.6 50.4 13 55.6 11 63.6 Z', '@corpsH', 0.3),
  F('M11 62.6 C13.4 54 19 49.4 26 49.6 C32 50 38 54 48 53 ' +
    'C60 52 69.4 49 78.6 50.6 C84.6 51.8 88.4 55.6 90 60.6 ' +
    'C88 56.6 84.6 54 79 53 C69.4 51.6 60 54.6 48 55.6 ' +
    'C38 56.6 32.6 53 26.6 52.8 C20 52.8 15 56.6 12.6 63 Z', '@corpsH', 0.3),
  // 3. Face AVANT du poitrail éclairée (la lumière vient d'au-dessus, un peu de l'avant) et
  //    arrière de la croupe dans l'ombre : les deux bouts de la bête se séparent en valeur.
  //    En LENTILLE, pointue en haut et en bas : écrite en bande d'épaisseur constante (vu 2), elle
  //    posait un bâton clair à bord droit au milieu du poitrail.
  F('M90.6 63 C91 69.6 90 75.4 87.6 80 C85.6 84 82.8 86.8 79.6 88.6 ' +
    'C82.6 84.6 85 80.6 86.6 76.4 C88.2 72 89.2 67.4 89.6 63 Z', '@corpsH', 0.6),
  F('M89.4 66 C89.4 71.6 88.4 76.4 86.4 80.4 C84.8 83.6 82.6 86 80.2 87.6 ' +
    'C82.4 84 84.2 80.4 85.4 76.6 C86.6 72.6 87.4 69 87.6 65.6 Z', '@corpsH', 0.34),
  F('M8.6 62 C7 70 8 78.6 11.4 86 C11.6 80 12 72.6 13.4 65 Z', '@corpsO', 0.34),
  // 4. POMMELURES — l'identité de la robe. QUATRE taches seules, larges et floues, posées sur le
  //    flanc devant la cuisse et sur la fesse. Vu 2 de l'épure, six taches se marchaient dessus au
  //    zoom de jeu et sous le membre proche — invisibles, donc du bruit dans le fichier.
  F(disque(35.6, 74, 3.2) + disque(41.6, 82, 2.8) +
    disque(15, 80, 3) + disque(21.6, 86.6, 2.6), '@corpsH', 0.36),
].join('');

const TRONC = [FS(SILHOUETTE_TRONC, '@corps', '@corpsO', 0.7), PLANS_TRONC].join('');

// ═════════════════════════════════════════════════════════════════════════════════════════════
// ENCOLURE — le cou LONG porté HAUT (neckAngle -50) : c'est l'identifiant n°1 du cheval à la
// vignette, avec la crinière argentée qui en couvre la crête. Plan 6 : peinte APRÈS le tronc, sa
// base PLONGE dans le poitrail (recouvrement contracté) pour qu'aucune couture ne s'ouvre quand la
// tête tourne. Sous la ligne de garrot elle n'a droit qu'à de la ROBE, jamais à une ligne.
// ═════════════════════════════════════════════════════════════════════════════════════════════
const ENCOLURE = [
  // La MASSE monte jusqu'au POLL et redescend SOUS la ganache (x≈104..112, y≈34..54) : ce lobe est
  // entièrement recouvert par la tête (plan 7 > 6) et c'est lui — et lui seul — qui tient la
  // GORGE fermée quand la tête tourne. Mesuré : sans ce lobe, la garde `quad-couture` ouvrait la
  // gorge du cheval dans les HUIT poses (corde 0 à 5,5 u pour un seuil de 5,6), la tête se
  // détachant franchement du cou en pose de morsure et de mort.
  F('M76.5 50 C86 42 94.6 35.4 101.6 30.6 ' +
    'C106.4 28.6 111.6 30.6 114 35.6 C115.4 40.6 112.6 46 108 50.8 ' +
    'C102.8 56 98.4 59.6 95.6 63.4 C93.4 66.6 90.6 69.4 89.6 71 ' +
    'L78.6 70.6 C76.6 63 75.6 56 76.5 50 Z', '@corps'),
  // les deux SEULES arêtes qui sont vraiment une silhouette : crête et gorge — en traits OUVERTS
  // qui MEURENT avant le garrot (prolongés, ils courent en courroie à travers l'épaule).
  S('M77 54 C77.6 51.6 80.6 47.6 86 43.6', '@corpsO', 0.7, 0.7),
  S('M94.6 53 C92 58 90.6 63.6 89.8 69', '@corpsO', 0.7, 0.6),
  // GORGE éclairée (la face avant du cou prend la lumière d'avant) + creux de l'auge en ombre
  F('M94.6 53 C92 58 90.6 64 89.6 71 L86.4 70.4 C87.4 63.4 88.8 57.4 91.4 51.6 Z', '@corpsH', 0.6),
  F('M78.6 70.6 C77.4 65.6 76.6 60 76.6 55 L81.4 56.6 C81.6 61.4 82.4 66.4 83.6 70.6 Z', '@corpsO', 0.3),
  // ── CRINIÈRE ARGENTÉE : une BANDE le long de la crête, à trois mèches. Vu 1 de l'épure, la masse
  //    descendait jusqu'au tiers bas de l'encolure : le cou entier virait au gris de crin et se
  //    lisait en planche à bord dentelé. Elle mord seulement le tiers HAUT — c'est le contraste
  //    crin/robe qui fait la crinière, pas sa surface. La lisière basse reste DANS la bande de cou
  //    (entre crête et gorge) : débordée, elle flotte en drapeau entre la gorge et la ganache.
  FS('M105.5 32.5 C96 35.6 86 41.6 76.5 49.6 ' +
    'C76.4 52.6 76.8 55.4 77.8 58 C79.6 55.4 81.8 53 84.4 51 ' +
    'C84.6 53.6 85.4 56 86.6 58 C88.4 54.6 90.6 51.4 93 48.4 ' +
    'C93.4 50.4 94 52 95 53.4 C98 48.6 101.6 43.4 104.4 38.4 ' +
    'C105.8 36 106.4 34 105.5 32.5 Z', '@cheveux', '@cheveuxO', 0.6),
  S('M103.4 34.8 C95 38.2 86.4 43.6 78.4 50.4', '@cheveuxH', 1.8, 0.7),
  S('M83 50.6 C81.4 53 79.6 55.6 78.4 57.4 M91.6 45.6 C89.6 49 87.6 52.6 86.4 55.4 ' +
    'M100.6 39.6 C98.4 43 96.4 46.6 95.2 49.6', '@cheveuxO', 1.3, 0.5),
  // POMMELURES de l'encolure : la bande de robe nue sous la crinière est la surface où l'identité
  // « gris pommelé » se lit le mieux — elle reste découverte quel que soit le set d'équipement posé
  // sur la bête.
  F(disque(84.6, 63, 2.4) + disque(90.6, 60, 2.2) + disque(80.6, 66.6, 2), '@corpsH', 0.28),
].join('');

// ═════════════════════════════════════════════════════════════════════════════════════════════
// TÊTE — crâne long et SEC, chanfrein rectiligne, ganache ronde, naseau ouvert, petites oreilles
// dressées : le triangle équin. Peinte au plan 7, elle recouvre l'encolure. Tête NUE : la bride est
// un SET (`harnais/sellerie-imperiale`), apposée sur ce même os par le canal `deco`.
// ═════════════════════════════════════════════════════════════════════════════════════════════
const TETE = [
  // OREILLE LOINTAINE d'abord (plus sombre, décalée en arrière), puis la proche : deux petites
  // feuilles DRESSÉES — couchées ou longues, la bête lit « âne ».
  F('M101.4 34.6 C100 30 99.6 26.4 101 23.6 C103 25 104.2 28 104.4 31.6 ' +
    'C103.4 33.4 102.4 34.4 101.4 34.6 Z', '@corpsO'),
  FS('M104.6 34.4 C103 29.4 102.6 25.4 104 22.4 C106 24 107.2 27.4 107.4 31.4 ' +
    'C106.4 33.4 105.6 34.2 104.6 34.4 Z', '@corps', '@corpsO', 0.5),
  F('M105 32.6 C104 29.4 103.8 26.6 104.6 24.6 C105.8 25.8 106.4 28 106.6 30.6 Z', '@corpsO', 0.5),
  // CRÂNE + face, une seule masse continue du toupet à la ganache ; le bord ARRIÈRE va chercher
  // l'encolure sous lui (aucun contour ne se referme sur la couture).
  // Le CRÂNE couvre le pivot de tête (111,1 · 35,2) de 3 u vers le haut et de 14 u vers l'arrière :
  // c'est cette marge — invisible, la tête étant au plan 7 — qui donne au lobe de l'encolure de
  // quoi rester CACHÉ tout en fermant la gorge dans les poses tournées (morsure, mort).
  FS('M103.4 29.6 C109.2 28.8 113.8 32.4 115 38.2 ' +
    'C115.6 43.4 116 50 116.8 58 C117.6 62 116.4 65.6 113 66.6 ' +
    'C110 67.2 107.6 65.4 106.6 62 C105 57 102 54 99 51.4 ' +
    'C95.4 48.6 94.2 42.6 96.4 37.6 C98.2 33 100.4 30 103.4 29.6 Z', '@corps', '@corpsO', 0.6),
  // CHANFREIN éclairé — une seule surface du front au naseau, arrêtée AVANT le bord (sinon bec
  // clair sur le contour) : c'est elle qui donne son arête à la face.
  F('M107 35.6 C110 35.6 112 37.6 112.8 41 C114 46.6 115.2 52 116 57.6 ' +
    'C116.4 60.4 115.6 62.6 113.6 63.6 L112 60.6 C112.8 59.6 113 58 112.6 56 ' +
    'C111.8 51 110.8 46 109.6 41.6 C108.8 38.6 107.6 36.6 106 36.4 Z', '@corpsH', 0.64),
  // GANACHE (l'angle de la mâchoire, creusé) : c'est lui qui sépare la tête du cou en gris.
  F('M101.4 40.6 C99.6 44.4 99.6 48.4 101.4 51 C103.6 53.6 105.4 57 106.6 61.4 ' +
    'C106.6 56.4 105.6 51.6 103.6 47.6 C102.6 45.4 102 43 102 40.6 Z', '@corpsO', 0.4),
  // ŒIL — gros, posé haut sur le côté du crâne, avec son arcade. ANCRÉ `data-eye`/`data-ec` comme
  // les têtes de gabarit (`heads/kit.ts`) : `swapEye` REMPLACE ce groupe par l'art du catalogue
  // d'yeux (montures mortes-vivantes à œil rouge…), centré sur `data-ec`. Sans l'ancre, l'art de
  // vue faisait taire le canal en silence sur TOUTE la famille équine — le cheval est l'espèce de
  // REPLI de `resolveQuad`. `data-ec` est en coordonnées de l'OS : le compilateur ne cuit que les
  // `d`, jamais un attribut — il se relit dans `chevalProfilCompile.ts` (début du `d` du globe,
  // décalé du rayon) si le squelette de la tête bouge.
  F(disque(108.6, 45.4, 3.4), '@corpsO', 0.4),
  `<g data-eye="D" data-ec="-0.53 8.06">` +
  FS(disque(108.6, 45.4, 2.1), '#16181c', '@corpsO', 0.3) +
  F(disque(109.4, 44.6, 0.8), '#ffffff', 0.72) +
  `</g>`,
  // NASEAU (fente ouverte) + fente de bouche
  F(disque(114.4, 60.6, 1.5), '#16181c', 0.82),
  S('M110.6 64.4 C112.6 65 114.6 64.4 116 63', '@corpsO', 1, 0.6),
  // TOUPET argenté entre les oreilles, retombant sur le front
  F('M106.6 33 C104 36 103 40 103.6 44.4 C105 41.6 106.6 38.6 108.6 36.2 ' +
    'C108.4 34.6 107.6 33.4 106.6 33 Z', '@cheveux'),
  S('M105.6 35 C104.4 38 104 41 104.2 43.4', '@cheveuxO', 0.8, 0.6),
].join('');

// ═════════════════════════════════════════════════════════════════════════════════════════════
// QUEUE — longue et FOURNIE, gris argenté, tombant sous les jarrets. Plan 3 : derrière tout le
// corps. Son haut MORD dans la croupe (jusqu'à y≈56) : détachée, elle lit en balai posé à côté.
// ═════════════════════════════════════════════════════════════════════════════════════════════
const QUEUE = [
  // La masse s'ÉVASE au milieu et s'EFFILE en pointe : vu 1 de l'épure, à largeur constante, elle
  // se lisait en planche grise posée derrière la bête. Le bord arrière ondule (le crin retombe),
  // le bord avant reste tendu — c'est cette dissymétrie qui dit le poil.
  FS('M20 56.6 C16.6 60.6 12.6 66.6 10 74.6 ' +
    'C7 84 5 95 4 106 C3.2 116 3.4 126 5 134.6 C5.6 138.6 6.6 141.6 8 143.6 ' +
    'C10.6 140.6 12.6 135.6 13.6 129 C14.6 121 14.4 112 13.4 102.6 ' +
    'C12.4 92.6 12.6 83 14.4 74.6 C15.6 68.6 17.4 63.4 19.6 59.6 Z', '@cheveux', '@cheveuxO', 0.6),
  // arête éclairée du bord avant (la lumière vient du dessus-avant)
  F('M19.6 59.6 C17.4 63.4 15.6 68.6 14.4 74.6 C12.6 83 12.4 92.6 13.4 102.6 ' +
    'C14.4 112 14.6 121 13.6 129 C13 133.6 11.8 137.4 10.2 140.4 ' +
    'C10.4 133.6 10.6 125.6 10.4 116.6 C10.2 105 9.6 94 9.6 84.6 ' +
    'C9.8 74.6 11.6 66 15.4 59.6 Z', '@cheveuxH', 0.6),
  // creux du bord arrière + deux séparations de mèche
  F('M10 74.6 C7 84 5 95 4 106 C3.2 116 3.4 126 5 134.6 C5.6 138.6 6.6 141.6 8 143.6 ' +
    'L8.6 137.6 C7.4 131.6 6.8 124 7 115.6 C7.2 102.6 8.4 89.6 11.4 78 Z', '@cheveuxO', 0.5),
  S('M12.6 82 C10.6 96 10.4 112 11.4 126 M8.6 88.6 C7.2 101.6 7 116 8 128.6', '@cheveuxO', 1.1, 0.36),
].join('');

// ═════════════════════════════════════════════════════════════════════════════════════════════
// LES 12 OS DE MEMBRE — dessinés dans le monde, aux axes RÉELS du squelette.
// ═════════════════════════════════════════════════════════════════════════════════════════════
// MEMBRES PROCHES (plan 9, DEVANT le barillet) : leur segment HAUT est rempli de la robe SANS
// contour tant qu'il est dans le corps ; le contour ne reprend qu'en OUVERT, une fois le membre
// sorti sous la ligne de ventre. C'est ce qui remplace ici le `sousTronc` du bœuf.

// Tout modelé de membre proche est une LENTILLE — pointue aux deux bouts, jamais une bande à bouts
// coupés. Vu 1 de l'épure, les plans d'épaule et de cuisse étaient écrits en quadrilatères : au
// rendu ils se lisaient en PLAQUES rectangulaires collées sur la robe (le défaut même que la
// direction d'art proscrit). Une lentille n'a pas de bord franc : ses deux pointes se fondent dans
// la robe, et seule sa panse porte la valeur.

/** ÉPAULE + AVANT-BRAS proche : masse de l'épaule (modelé seul) puis l'avant-bras qui sort du corps. */
const HAUT_AV_PROCHE = [
  // La cote AVANT est plafonnée à 88,4 : au-delà, le membre débordait du contour du poitrail
  // (x≈87,5 à cette hauteur) et posait une marche visible sur la face éclairée.
  F('M74.4 70 C73 79 73.8 88 76 96.4 C77.2 102.6 78 109 78.2 115.4 ' +
    'C80 116.8 84 116.8 85.8 115.4 C86.4 110 86.8 104 87.4 98 ' +
    'C88.2 89 88.4 79.6 87.8 70 Z', '@corps'),
  // contours OUVERTS, sous le ventre seulement
  S('M89 94 C88.4 101.6 86.8 109 86 115.6', '@corpsO', 0.6, 0.9),
  S('M75.6 95.6 C76.6 103.6 77.8 110 78.1 115.6', '@corpsO', 0.6, 0.9),
  // plan d'ÉPAULE — lentille suivant l'omoplate, du garrot au coude
  F('M76.6 69.6 C73.8 77.6 73.8 87.4 76.2 96.4 C78.6 91 79.6 83.6 79 76.6 ' +
    'C78.6 73 77.8 70.8 76.6 69.6 Z', '@corpsO', 0.2),
  F('M77.4 73.6 C75.6 79.6 75.6 87 77.2 94 C78.8 90 79.4 84.6 79 79.4 ' +
    'C78.8 76.6 78.2 74.6 77.4 73.6 Z', '@corpsO', 0.2),
  // arête éclairée de l'avant-bras (bord avant) + ombre du triceps derrière — deux lentilles
  F('M88.4 82.6 C89.2 91 89 100.6 88 110 C86.2 105.4 85.4 99 85.6 93 ' +
    'C85.8 88.6 86.8 85 88.4 82.6 Z', '@corpsH', 0.62),
  F('M75.6 87.6 C76 95.6 76.8 103.6 78 111 C79.6 107 80 101 79.4 94.6 ' +
    'C79 91 78.2 88.6 77.2 87 Z', '@corpsO', 0.3),
].join('');

/** CUISSE + JARRET proche : la fesse appartient à la silhouette du TRONC, ici la cuisse et le gaskin. */
const HAUT_AR_PROCHE = [
  F('M11.6 74 C10 84.6 11.4 94.6 14.6 102 C16.4 106.6 17.8 111 18.6 115.4 ' +
    'C20.8 116.8 25.2 116.8 27.4 115.4 C28.2 110.6 29.2 105 30.6 99.4 ' +
    'C32.6 90.6 33 81 31.4 73 Z', '@corps'),
  S('M12.4 94.6 C13.4 100.6 15.8 108 18.6 115.4', '@corpsO', 0.6, 0.9),
  S('M31.2 97.6 C30.2 103.6 28.8 109.6 27.5 115.4', '@corpsO', 0.6, 0.9),
  // plan de CUISSE — lentille sur la masse du grasset (bord avant, face à la lumière)
  F('M31.4 75.6 C33.2 84 32.6 92.6 30.2 100 C28.6 96 28 90.6 28.6 85 ' +
    'C29 81 30 77.6 31.4 75.6 Z', '@corpsH', 0.44),
  F('M29.6 80.6 C31 86.6 30.6 93 28.8 99 C27.8 95.6 27.6 91.6 28 87.6 ' +
    'C28.2 84.6 28.8 82.2 29.6 80.6 Z', '@corpsH', 0.3),
  // creux du jarret derrière (lentille d'ombre)
  F('M12.4 84.6 C12 92.6 13.4 99.6 16.2 105.6 C17.6 101 17.6 95 16.4 89.4 ' +
    'C15.6 86.6 14.4 85 12.4 84.6 Z', '@corpsO', 0.3),
].join('');

export const DESSIN: GroupeDessin[] = [
  { bone: 'queue', svg: QUEUE },
  // antérieur LOINTAIN — peint au plan 1, derrière le corps. Son AXE est ramené de x=87,2 (le
  // pivot) à x=85,5 et sa largeur de 12,6 à 9,6 : à la cote du pivot, le membre débordait de 2,5 u
  // DEVANT le poitrail (x max 91) et y posait un rectangle gris à bord franc sur la face éclairée.
  { bone: 'hautAvG', svg: tube(85.5, 84, 85.3, 112.8, 9.6, 7, true) },
  { bone: 'basAvG', svg: tube(85.3, 110, 81.2, 138.8, 6.6, 5.4, true) + fanon(81.6, 136.6, true) },
  { bone: 'piedAvG', svg: sabot(81.2, 138.8, true) },
  // postérieur LOINTAIN (x≈27)
  { bone: 'hautArG', svg: tube(26.3, 82, 28.8, 110.7, 13.6, 7, true) },
  { bone: 'basArG', svg: tube(28.8, 108, 24.7, 136.8, 6.6, 5.4, true) + fanon(25.1, 134.6, true) },
  { bone: 'piedArG', svg: sabot(24.7, 136.8, true) },
  { bone: 'tronc', svg: TRONC },
  { bone: 'encolure', svg: ENCOLURE },
  { bone: 'tete', svg: TETE },
  // postérieur PROCHE (x≈21) — plan 9, DEVANT le barillet. La largeur HAUTE du canon est calée sur
  // la largeur BASSE du segment au-dessus (8,8 et 8,6) : à valeur différente, le jarret et le genou
  // montrent une MARCHE de silhouette, visible même à 64 px.
  { bone: 'hautArD', svg: HAUT_AR_PROCHE },
  { bone: 'basArD', svg: tube(24.7, 110, 20.6, 138.6, 8.8, 5.8, false) + fanon(21, 136.4, false) },
  { bone: 'piedArD', svg: sabot(20.6, 138.6, false) },
  // antérieur PROCHE (x≈81)
  { bone: 'hautAvD', svg: HAUT_AV_PROCHE },
  { bone: 'basAvD', svg: tube(81.8, 112, 78.6, 141, 8.6, 5.8, false) + fanon(79, 138.8, false) },
  { bone: 'piedAvD', svg: sabot(78.6, 141, false) },
];

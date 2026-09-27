/**
 * Théâtre Staatsoper — carte MIGRÉE sur `buildScene(MapSpec)` (dernier îlot d'authoring unifié). La
 * géométrie des deux étages vit en BOX-DRAWING dans `floorplan.ascii.ts` (source ÉDITABLE, arêtes DANS
 * l'ASCII) et passe par `MapSpec.walled` : `buildScene` parse tuiles + murs + portes + PUITS de rampe
 * (déjà troués dans l'ASCII). Seule l'ÉLÉVATION MÉTRIQUE — non exprimable en 1 char — est déclarée en
 * `relief` : scène `S` +1 m, fosse `s` −1 m, la galerie (étage) un plein niveau au-dessus du point HAUT
 * du rez, et les 2 RAMPES d'angle (cases de hauteur croissante rejoignant la galerie, AUCUN escalier).
 * Le bâtiment lui-même est un CORPS (`architecture`) : c'est de lui que la toiture se dérive et par lui
 * que la loi de dégagement découvre l'espace du groupe. Éditer la carte = éditer l'ASCII (+ ce `relief`
 * si l'élévation change).
 */
import type { Scene, Terrain, WallOverlay } from '../../state/scene';
import { buildScene, type MapSpec } from '../../state/mapSpec';
import { METRES_PER_LEVEL } from '../../state/relief';
import { parseWalledAscii, walledRowsOf, zonesFromSeeds, type ZoneSeed } from '../../state/asciiMap';
import { terrainWalkable } from '../../state/terrain';
import { REZ_ASCII, ETAGE_ASCII } from './floorplan.ascii';

const W = 44, H = 60;
const AX = (W - 1) / 2;        // axe de symétrie (21.5)
const BX1 = W - 2;             // dernière colonne du bâti
const FACY = 58;              // seuil de façade (entrée principale)
const FOY0 = 45;             // 1re rangée du foyer (les rampes montent ici)

/** Élévation de la SCÈNE au-dessus du parterre — le point HAUT du rez. */
const SCENE_M = 1;

/** Hauteur métrique de l'ÉTAGE (loges/galeries) : un plein niveau (`METRES_PER_LEVEL`) au-dessus du
 *  point HAUT du plancher qu'il coiffe — la scène, pas le parterre. C'est l'INVARIANT D'EMPILEMENT que
 *  `validateScene` (`state/validateScene.ts`, « un étage se pose sur le dessus de celui du dessous »)
 *  mesure case par case sous l'emprise de la masse. Les rampes la rejoignent. */
const ETAGE_M = SCENE_M + METRES_PER_LEVEL;

/** Pente des 2 RAMPES d'angle, en mètres gagnés PAR RANGÉE. C'est elle qui donne leur LONGUEUR : la cote
 *  de la galerie est une hauteur, le nombre de rangées une distance — les deux ne coïncident que tant que
 *  cette pente vaut 1. */
const PENTE_RAMPE_M = 1;

/** Longueur d'une rampe en RANGÉES : elle descend de `ETAGE_M` à 1 m par pas de `PENTE_RAMPE_M`. */
const RAMPE_RANGEES = (ETAGE_M - 1) / PENTE_RAMPE_M + 1;

/** Légende des cases de l'ASCII (cf. floorplan.ascii.ts). */
export const OPERA_LEGEND: Record<string, Terrain> = { ',': 'dalle', P: 'plancher', M: 'marbre', S: 'planches', s: 'planches' };

/** Terrain de BASE (`OPERA_BASE`) des deux grilles : l'espace de l'ASCII est le HORS-BÂTIMENT (et, à l'étage, le puits),
 *  pas de l'herbe. `buildScene` le lit en `MapSpec.terrain` ; la dérivation du calque de zones doit lire
 *  le MÊME — une seule constante, jamais deux littéraux à tenir d'accord. */
export const OPERA_BASE: Terrain = 'vide';

/** Légende des ARÊTES de l'ASCII (`MapSpec.wallLegend`) : le char `w` vaut mur ET porte une APPARENCE de
 *  rendu, sans structure ni PV — les refends entre loges voisines des deux flancs de l'étage sont en bois
 *  (NADJ 08 folio 39 — plan (image) : aucun matériau n'y figure ; le bois est un choix d'authoring MAISON,
 *  révisable, comme les frontières `clip` de `ZONES_ETAGE`). UNE table pour TOUS les lecteurs de ces deux
 *  grilles, y compris `puitsRim`, dont le flood ne la lit pas : aucun lecteur sans table — cf.
 *  `zonesFromSeeds`, `state/asciiMap.ts`. */
export const OPERA_WALL_LEGEND = { w: { appearance: 'mur-en-bois' } } satisfies Record<string, WallOverlay>;

/** Colonnes des 2 PUITS de rampe (angles du foyer, anciens escaliers du plan NADJ) : la couche 0 y monte
 *  du foyer à la cote de la galerie (les cases sont déjà TROUÉES à l'étage dans l'ASCII). */
const RAMP_X: [number, number][] = [[6, 8], [35, 37]];

/** ÉLÉVATION MÉTRIQUE (`MapSpec.relief`), la seule donnée non portée par l'ASCII (1 char) :
 *  - scène `S` = +1 m (rect [13,5]→[30,14]) · fosse `s` = −1 m (rect [17,15]→[27,19]) ;
 *  - galerie (étage z1) = `ETAGE_M` sur toute la grille ;
 *  - 2 RAMPES d'angle : chaque colonne des puits descend de `ETAGE_M` à 1 m à raison de `PENTE_RAMPE_M`
 *    par rangée depuis la 1re du foyer — la pente que `surfaceLink` franchit, donc AUCUN escalier. À pente
 *    constante, une galerie plus haute allonge la rampe (`RAMPE_RANGEES`) au lieu de la redresser. */
function operaRelief(): NonNullable<MapSpec['relief']> {
  const relief: NonNullable<MapSpec['relief']> = [
    { rect: [13, 5, 30, 14], height: SCENE_M },   // scène surélevée
    { rect: [17, 15, 27, 19], height: -1 },  // fosse d'orchestre −1 m
    { rect: [0, 0, W - 1, H - 1], height: ETAGE_M, z: 1 }, // galerie (étage)
  ];
  for (const [a, b] of RAMP_X)
    for (let x = a; x <= b; x++) relief.push({ ramp: [x, FOY0 + 1, x, FOY0 + RAMPE_RANGEES], from: ETAGE_M, to: 1 });
  return relief;
}

/** Cases de SIÈGE du parterre, DÉRIVÉES de l'ASCII : toute case `plancher` (P), un rang sur deux (allée
 *  de circulation entre les rangs), fine allée centrale de 2 cases (axe 21.5). Source unique → le scénario
 *  pose un `siege` 1×1 par case (cf. furnished.ts). Éditer l'éventail dans l'ASCII met les sièges à jour. */
export function parterreSeatCells(): { x: number; y: number }[] {
  const rows = walledRowsOf(REZ_ASCII, W);
  const out: { x: number; y: number }[] = [];
  for (let y = 0; y < H; y++) {
    if (y % 2 !== 0) continue; // un rang sur deux
    for (let x = 0; x < W; x++) {
      if (x === 21 || x === 22) continue; // allée centrale
      if (rows[2 * y + 1]?.[2 * x + 1] === 'P') out.push({ x, y });
    }
  }
  return out;
}

/** Cap d'un garde-corps de rive : la face qui regarde le puits. */
type Cap = 'N' | 'S' | 'E' | 'O';

/** Les quatre voisines d'une case, avec le cap qui les vise. */
const VOISINES: readonly (readonly [Cap, number, number])[] = [['N', 0, -1], ['S', 0, 1], ['O', -1, 0], ['E', 1, 0]];

/** Cases de la RIVE du PUITS à l'étage, avec le cap de leur garde-corps — DÉRIVÉES de l'ASCII (source
 *  unique : recreuser l'ovale déplace les balustrades avec lui, cf. `furnished.ts`). Le PUITS est la plus
 *  grande composante 4-connexe de `vide` de l'étage qui ne touche AUCUN bord de grille : le hors-bâtiment,
 *  lui, borde la grille, et les trémies des deux rampes n'en sont que des lucarnes. La RIVE = toute case
 *  FOULABLE 4-adjacente à cette composante (la maçonnerie du mur de fond de scène n'en est donc pas) ; son cap
 *  vise, parmi ses voisines vides, celle du côté du CENTRE de l'ovale — ce qui tranche les cases d'angle,
 *  que l'ovale borde en marches d'escalier sur deux côtés. */
export function puitsRim(): { x: number; y: number; facing: Cap }[] {
  const { w, h, tiles } = parseWalledAscii(walledRowsOf(ETAGE_ASCII, W), OPERA_BASE, OPERA_LEGEND, { wallLegend: OPERA_WALL_LEGEND });
  const dedans = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h;
  const vu = new Uint8Array(w * h);
  let puits: number[] = [];
  for (let depart = 0; depart < w * h; depart++) {
    if (vu[depart] || tiles[depart] !== OPERA_BASE) continue;
    const pile = [depart];
    const composante: number[] = [];
    let borde = false;
    vu[depart] = 1;
    while (pile.length) {
      const i = pile.pop()!;
      composante.push(i);
      const x = i % w, y = (i - x) / w;
      if (x === 0 || y === 0 || x === w - 1 || y === h - 1) borde = true;
      for (const [, dx, dy] of VOISINES) {
        const nx = x + dx, ny = y + dy;
        if (!dedans(nx, ny) || vu[ny * w + nx] || tiles[ny * w + nx] !== OPERA_BASE) continue;
        vu[ny * w + nx] = 1;
        pile.push(ny * w + nx);
      }
    }
    if (!borde && composante.length > puits.length) puits = composante;
  }
  const vide = new Set(puits);
  const cx = puits.reduce((s, i) => s + (i % w), 0) / puits.length;
  const cy = puits.reduce((s, i) => s + Math.floor(i / w), 0) / puits.length;
  const rive: { x: number; y: number; facing: Cap }[] = [];
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      if (!terrainWalkable(tiles[y * w + x])) continue;
      const caps = VOISINES.filter(([, dx, dy]) => dedans(x + dx, y + dy) && vide.has((y + dy) * w + x + dx));
      if (!caps.length) continue;
      const [facing] = caps.reduce((a, b) => (b[1] * (cx - x) + b[2] * (cy - y) > a[1] * (cx - x) + a[2] * (cy - y) ? b : a));
      rive.push({ x, y, facing });
    }
  return rive;
}

/** Type d'une entrée de `MapSpec.zoneLegend` — une PIÈCE du plan, avec les GRAINES d'où son calque se
 *  DÉRIVE (`zonesFromSeeds` : le cloisonnement de l'ASCII est la seule source du contour). Une pièce
 *  coupée par une PORTE interne porte une graine par morceau ; `clip` borne une aire que le plan ne
 *  cloisonne pas. */
type Piece = NonNullable<MapSpec['zoneLegend']>[string] & {
  id: string;
  seeds: readonly (readonly [number, number])[];
  clip?: ZoneSeed['clip'];
};

/** Légende de pièces → graines de `zonesFromSeeds` (le char du calque EST la clé de la légende). */
function seedsOf(pieces: Record<string, Piece>): ZoneSeed[] {
  return Object.entries(pieces).map(([char, p]) => ({ char, at: p.seeds, ...(p.clip ? { clip: p.clip } : {}) }));
}

/** LÉGENDE du plan officiel, char du calque → pièce. `label` VERBATIM de l'encart « LÉGENDE » du plan
 *  (NADJ 08 folio 39 — légende du plan (image)), le NUMÉRO de l'entrée en commentaire ; `id` kebab STABLE
 *  dérivé du libellé (la logique ne lit que lui, cf. doctrine ids stables). `interior` : ce sont des
 *  pièces INTÉRIEURES — leur nom se cuit au centre et se révèle en cutaway. */
export const ZONES_REZ: Record<string, Piece> = {
  A: { id: 'salle-verte', label: 'Salle verte', presentation: 'interior', seeds: [[1, 5]] },                                               // 14
  B: { id: 'bureau-du-regisseur', label: 'Bureau du régisseur', presentation: 'interior', seeds: [[7, 5]] },                              // 15
  C: { id: 'zone-de-stockage-des-decors', label: 'Zone de stockage des décors', presentation: 'interior', seeds: [[30, 1]] },             // 20
  D: { id: 'coulisses', label: 'Coulisses', presentation: 'interior', seeds: [[13, 1]] },                                                 // 16
  E: { id: 'scene', label: 'Scène', presentation: 'interior', seeds: [[13, 5]] },                                                         // 19
  F: { id: 'fosse-d-orchestre', label: 'Fosse d’orchestre', presentation: 'interior', seeds: [[17, 15]] },                                 // 18
  G: { id: 'orchestre', label: 'Orchestre', presentation: 'interior', seeds: [[17, 20]] },                                                 // 17
  // 13 apparaît DEUX fois (deux vestiaires empilés sous 15) : même `label`, id suffixé par le rang.
  H: { id: 'vestiaire-1', label: 'Vestiaire', presentation: 'interior', seeds: [[1, 15]] },                                                // 13
  Z: { id: 'vestiaire-2', label: 'Vestiaire', presentation: 'interior', seeds: [[1, 19]] },                                                // 13
  I: { id: 'vestiaires-des-choeurs-feminin', label: 'Vestiaires des chœurs (Féminin)', presentation: 'interior', seeds: [[1, 24]] },      // 12
  J: { id: 'vestiaires-des-choeurs-masculin', label: 'Vestiaires des chœurs (Masculin)', presentation: 'interior', seeds: [[1, 34]] },    // 11
  K: { id: 'passage', label: 'Passage', presentation: 'interior', seeds: [[1, 40]] },                                                     // 10
  L: { id: 'rangements-des-costumes', label: 'Rangements des costumes', presentation: 'interior', seeds: [[28, 15]] },                     // 24
  M: { id: 'couturieres', label: 'Couturières', presentation: 'interior', seeds: [[29, 24]] },                                             // 25
  N: { id: 'charpenterie-et-decors', label: 'Charpenterie et décors', presentation: 'interior', seeds: [[32, 31]] },                       // 26
  O: { id: 'reserve-generale', label: 'Réserve générale', presentation: 'interior', seeds: [[33, 35]] },                                   // 27
  P: { id: 'bureau-du-concierge', label: 'Bureau du concierge', presentation: 'interior', seeds: [[38, 1]] },                             // 22
  Q: { id: 'bureau-du-gestionnaire-des-accessoires', label: 'Bureau du gestionnaire des accessoires', presentation: 'interior', seeds: [[38, 10]] }, // 23
  W: { id: 'stockage-des-accessoires', label: 'Stockage des accessoires', presentation: 'interior', seeds: [[38, 5]] },              // 21
  R: { id: 'salon', label: 'Salon', presentation: 'interior', seeds: [[1, 44]] },                                                         // 7
  S: { id: 'escalier-des-dames', label: 'Escalier des Dames', presentation: 'interior', seeds: [[6, 46]] },                               // 8
  T: { id: 'escalier-des-seigneurs', label: 'Escalier des Seigneurs', presentation: 'interior', seeds: [[36, 46]] },                       // 9
  // 6 apparaît DEUX fois (un guichet par angle de façade) : même `label`, id suffixé par la position.
  X: { id: 'vestiaire-et-vente-des-billets-gauche', label: 'Vestiaire et vente des billets', presentation: 'interior', seeds: [[2, 56]] }, // 6
  Y: { id: 'vestiaire-et-vente-des-billets-droit', label: 'Vestiaire et vente des billets', presentation: 'interior', seeds: [[39, 56]] },  // 6
  U: { id: 'commodites-des-dames', label: 'Commodités des Dames', presentation: 'interior', seeds: [[13, 51]] },                           // 4
  V: { id: 'commodites-des-seigneurs', label: 'Commodités des Seigneurs', presentation: 'interior', seeds: [[28, 51]] },                   // 5
};

/** Légende de l'ÉTAGE — même contrat, chars DISJOINTS de ceux du rez : `zoneLegend` est indexé par le
 *  seul char (`mapSpec.ts` : `zoneLegend[b.char].id`), un char partagé donnerait la même pièce aux deux
 *  niveaux. Tenu par un test (`floorplan.test.ts`), pas par ce commentaire. */
export const ZONES_ETAGE: Record<string, Piece> = {
  a: { id: 'antichambre-ducale', label: 'Antichambre ducale', presentation: 'interior', seeds: [[2, 3]] },            // 32
  b: { id: 'loge-royale', label: 'Loge royale', presentation: 'interior', seeds: [[8, 3]] },                          // 30
  // `clip` : au folio 39, 31 et 29 partagent UNE aire sans aucun trait entre elles (31 côté couloir, 29 côté
  // salle) — la colonne de partage est un choix d’authoring MAISON, révisable, faute de frontière au plan. Même
  // raison pour les balcons 33/34/35, fer à cheval de gradins continu, et pour les aires que le plan ouvre
  // l'une sur l'autre sans porte (couloirs 10 ↔ salon/galerie, galerie 36 ↔ bar 37).
  c: { id: 'salon-de-la-loge-gauche', label: 'Salon de la loge', presentation: 'interior', seeds: [[2, 9]], clip: { x1: 5, y1: 10 } },   // 31
  d: { id: 'loge-des-nobles-gauche', label: 'Loge des nobles', presentation: 'interior', seeds: [[8, 8]], clip: { x0: 6 } },             // 29
  e: { id: 'loge-gauche-1', label: 'Loge', presentation: 'interior', seeds: [[5, 13]] },                              // 28
  f: { id: 'loge-gauche-2', label: 'Loge', presentation: 'interior', seeds: [[5, 18]] },                              // 28
  g: { id: 'loge-des-nobles-droite-1', label: 'Loge des nobles', presentation: 'interior', seeds: [[35, 3]], clip: { x1: 37 } }, // 29
  h: { id: 'salon-de-la-loge-droite-1', label: 'Salon de la loge', presentation: 'interior', seeds: [[40, 3]], clip: { x0: 38 } },       // 31
  i: { id: 'loge-des-nobles-droite-2', label: 'Loge des nobles', presentation: 'interior', seeds: [[35, 8]], clip: { x1: 37 } },         // 29
  j: { id: 'salon-de-la-loge-droite-2', label: 'Salon de la loge', presentation: 'interior', seeds: [[40, 8]], clip: { x0: 38, y1: 10 } }, // 31
  k: { id: 'loge-droite-1', label: 'Loge', presentation: 'interior', seeds: [[38, 13]] },                             // 28
  l: { id: 'loge-droite-2', label: 'Loge', presentation: 'interior', seeds: [[38, 18]] },                             // 28
  m: { id: 'passage-gauche', label: 'Passage', presentation: 'interior', seeds: [[1, 20]], clip: { x1: 2, y0: 11, y1: 41 } },  // 10
  n: { id: 'passage-droit', label: 'Passage', presentation: 'interior', seeds: [[42, 20]], clip: { x0: 41, y0: 11, y1: 41 } }, // 10
  o: { id: 'balcons-de-gauche', label: 'Balcons de gauche', presentation: 'interior', seeds: [[5, 30]], clip: { x1: 14, y1: 41 } },   // 33
  p: { id: 'balcons-centraux', label: 'Balcons centraux', presentation: 'interior', seeds: [[21, 39]], clip: { x0: 15, x1: 28, y1: 41 } }, // 34
  q: { id: 'balcons-de-droite', label: 'Balcons de droite', presentation: 'interior', seeds: [[38, 30]], clip: { x0: 29, y1: 41 } },  // 35
  // La galerie court sur DEUX bandes (pleine largeur au droit des balcons, puis resserrée entre les deux
  // cages d'escalier) ; elle s'ouvre sans porte sur le bar par la trouée centrale de la rangée 50 (marches,
  // folio 39) — `clip` : la frontière 36|37 est un choix d’authoring MAISON, le plan n'en dessine aucune.
  r: { id: 'galerie', label: 'Galerie', presentation: 'interior', seeds: [[21, 44]], clip: { y0: 42, y1: 49 } },      // 36
  // Cages 8/9 à l'étage : le palier d'arrivée des rampes, clos entre le mur haut (rangée 46) et le mur bas
  // (rangée 50) que perce leur seule PORTE — `clip` : cette porte ferait déborder la graine sur le salon.
  // Le PUITS de rampe coupe chaque palier sur toute sa profondeur : deux paliers 4-connexes DISTINCTS
  // par cage (on passe de l'un à l'autre par la rampe, jamais à plat) — donc deux pièces, même `label`
  // verbatim, id suffixé par le côté, comme les deux « Vestiaire » du rez.
  v: { id: 'escalier-des-dames-etage-ouest', label: 'Escalier des Dames', presentation: 'interior', seeds: [[2, 47]], clip: { y1: 49 } },        // 8
  x: { id: 'escalier-des-dames-etage-est', label: 'Escalier des Dames', presentation: 'interior', seeds: [[11, 47]], clip: { y1: 49 } },         // 8
  w: { id: 'escalier-des-seigneurs-etage-est', label: 'Escalier des Seigneurs', presentation: 'interior', seeds: [[41, 47]], clip: { y1: 49 } },     // 9
  y: { id: 'escalier-des-seigneurs-etage-ouest', label: 'Escalier des Seigneurs', presentation: 'interior', seeds: [[32, 47]], clip: { y1: 49 } },   // 9
  // 38 | 37 | 39 occupent la façade COURBE du sud (rangées 50-57) — `clip` : `y0: 50` tient la frontière
  // maison avec la galerie ; `x1: 30`/`x0: 31`, celle que la porte 37↔39 de la rangée 53 franchirait.
  s: { id: 'bar-des-balcons', label: 'Bar des balcons', presentation: 'interior', seeds: [[21, 52]], clip: { y0: 50, x1: 30 } }, // 37
  t: { id: 'salon-des-dames', label: 'Salon des Dames', presentation: 'interior', seeds: [[2, 52]], clip: { y0: 50 } },  // 38
  u: { id: 'salon-des-seigneurs', label: 'Salon des Seigneurs', presentation: 'interior', seeds: [[41, 52]], clip: { y0: 50, x0: 31 } }, // 39
};

/** GRAINES du calque de zones par étage — la donnée que `scripts/map/registry.ts` cite quand un défaut
 *  de zone tombe sur une case (le calque étant DÉRIVÉ, il n'a aucune ligne de fichier à montrer). */
export const OPERA_ZONE_SEEDS: Record<string, readonly ZoneSeed[]> = { z0: seedsOf(ZONES_REZ), z1: seedsOf(ZONES_ETAGE) };

/** CALQUE de zones DÉRIVÉ, par étage — la donnée que `buildScene` consomme ET celle que `map:check`
 *  interroge pour dire dans quelle pièce tombe un défaut : une seule dérivation, faite ici, où vivent la
 *  grille, la `base` et la `legend`. La redériver côté outil rouvrirait deux lectures à tenir d'accord.
 *  Dérivé à l'appel : la dérivation lit `terrains` (#1692). */
export function operaZoneLayers(): Record<string, string> {
  return {
    z0: zonesFromSeeds(walledRowsOf(REZ_ASCII, W), OPERA_BASE, OPERA_LEGEND, OPERA_ZONE_SEEDS.z0, { wallLegend: OPERA_WALL_LEGEND }),
    z1: zonesFromSeeds(walledRowsOf(ETAGE_ASCII, W), OPERA_BASE, OPERA_LEGEND, OPERA_ZONE_SEEDS.z1, { wallLegend: OPERA_WALL_LEGEND }),
  };
}

/** CORPS architectural du théâtre — la donnée SANS laquelle aucune masse n'est dérivée (`buildScene` §9
 *  n'itère que `scene.architecture`), donc sans laquelle la loi de dégagement (`clearedSpace`,
 *  `builders/roofs.ts`) ne trouve ni pièce ni emprise autour d'un allié posé au rez : un bâtiment à deux
 *  niveaux comme La Diligence, corps UNIQUE et NON BORNÉ (aucun `parts[].foot`) — tout le plancher réel
 *  des deux couches lui revient, la dérivation le coiffe d'un toit continu par composante 4-connexe.
 *  Aucun `style` : `src/data/buildings.json` ne porte pas de type théâtre/opéra, et un corps sans type
 *  n'émet aucun ornement d'identité (`scene.ts`, `architectureBodySchema.style`). */
const OPERA_BODY: NonNullable<MapSpec['architecture']>[number] = {
  id: 'opera-staatsoper',
  label: 'Théâtre Staatsoper',
  storeys: [
    { id: 'opera-z0', z: 0, parts: [], roomZoneIds: Object.values(ZONES_REZ).map((p) => p.id) },
    { id: 'opera-z1', z: 1, parts: [], roomZoneIds: Object.values(ZONES_ETAGE).map((p) => p.id) },
  ],
  facades: [],
  masses: [],
};

/** Le Théâtre Staatsoper en DONNÉE, COMPILÉ depuis l'ASCII box-drawing par `buildScene` (`MapSpec.walled`
 *  + `relief`). Rez (z0) et étage (z1) = deux grilles box-drawing ; l'élévation = `relief`. */
export function buildOperaFloorplan(): Scene {
  return buildScene({
    id: 'opera-staatsoper',
    label: 'Théâtre Staatsoper',
    desc:
      'Opéra d’Altdorf — rez-de-chaussée (parterre en éventail, scène surélevée +1 m, fosse d’orchestre −1 m, salles latérales en colonnes subdivisées, foyer à rampes d’angle) et premier étage (loges en anneau autour du puits central ovale, à 4 m, galerie, bar des balcons et salons des Dames et des Seigneurs sur la façade, loge royale au flanc GAUCHE contre l’antichambre ducale — l’axe de la scène, lui, est le puits, fermé au nord par le mur de fond de scène). GÉNÉRÉ depuis une carte ASCII éditable (floorplan.ascii.ts) ; l’étage se rejoint par deux RAMPES (cases de hauteur croissante, plus aucun escalier).',
    ambiance: 'interieur',
    size: [W, H],
    terrain: OPERA_BASE,
    legend: OPERA_LEGEND,
    walled: { z0: REZ_ASCII, z1: ETAGE_ASCII },
    wallLegend: OPERA_WALL_LEGEND,
    architecture: [OPERA_BODY],
    zoneMap: operaZoneLayers(),
    zoneLegend: { ...ZONES_REZ, ...ZONES_ETAGE },
    relief: operaRelief(),
    entryPoints: { 'entree-principale': [Math.round(AX), FACY], 'entree-artistes': [BX1, 0] },
  });
}

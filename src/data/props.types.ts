/**
 * Contrats NEUTRES du décor : type de prop app-owned (`props.json`), recette VOLUMIQUE locale, matériaux
 * et places assises. Vivent hors de `src/data/index.ts` pour rester importables par `src/state` comme par
 * `src/gameIso` sans traverser le chargeur app-owned. PUR — aucune donnée, aucune caméra, aucun rendu.
 *
 * RÈGLE D'UNITÉ (#1507) : une recette est en MÈTRES dans son repère local ; le monde est en CASES ; la
 * traduction mètres→cases se fait par DIVISION par `metresPerTile` de la scène, et cases→mètres par
 * UNE multiplication (`gpToWorld`, `gameIso/backends/webgl/worldTris.ts`).
 * Un CONCEPT du décor = UNE couture, nommée — quatre en tout, et pas deux pour le même concept :
 *  - la GÉOMÉTRIE de la recette → `buildPropVolumes` (`gameIso/builders/propVolumes.ts`) ;
 *  - l'ANCRE d'une place assise → `placesPartielles` (`state/seating.ts`) ;
 *  - le FOYER d'une lampe (le centre de la primitive `emet`) → `foyerDe` (`state/vision.ts`) ;
 *  - le RAYON d'une source de lumière → `rayonEnCases` (`state/vision.ts`).
 * La LISTE COMPLÈTE des sites qui traduisent entre mètres et cases — décor compris, et jusqu'aux
 * portées de règle et aux cadences de rendu — est tenue NOMINATIVEMENT par
 * `state/echelle-de-scene.test.ts` : un site de plus s'y déclare, ou il sort rouge.
 *
 * Repère LOCAL d'une recette : origine à l'ANCRE du décor, `xM`/`yM` en mètres dans le plan, `hM` en
 * mètres depuis le pied de l'ancrage. L'ancre est le point MONDE que le builder déclare (`AncrageDecor`,
 * `gameIso/builders/props.ts`) : le CENTRE de l'empreinte pour un décor d'entité (donc le centre de sa
 * case quand elle est 1×1, le milieu du bloc au-delà), le point fractionnaire de l'arête pour une
 * feature de façade, le milieu de l'empreinte pour un ornement de faîte. L'orientation vient du cap
 * déclaré (`SceneEntity.facing` pour un décor posé).
 *
 * PLACES ASSISES : `state/seating.ts` ancre les `seatSlots` d'un meuble sur `decorAncre`
 * (`state/footprint.ts`), le CENTRE de son empreinte effective — la même ancre que celle sur
 * laquelle le builder pose sa recette, et que le foyer de la lampe qu'il porte. Un meuble à places
 * couvre donc autant de cases que son corps : la chaise DESSINÉE et la place où le corps s'assoit
 * tiennent au même point, quelle que soit l'étendue de l'empreinte.
 *
 * L'EMPREINTE TOURNE AVEC LE CAP (#1509) : les cases d'un décor à recette sont celles de son CORPS
 * tourné, sièges exclus (`empreinteDeriveeDuProp` ci-dessous, servie à tous les consommateurs par
 * `empreinteDuProp` puis `state/footprint.ts` `propFootTiles`). Une table 2×1 au cap E occupe 1×2.
 * Un BILLBOARD, qui n'a pas de corps, garde son empreinte DÉCLARÉE (`foot`).
 *
 * CAP D'IDENTITÉ = `S` (`CAP_IDENTITE_PROP`) — contrat de DONNÉE, à connaître pour authorer : une
 * recette (et les `seatSlots` qui l'accompagnent) s'écrit telle qu'elle se voit à l'instance SANS
 * cap, front vers `y` positif, et c'est à ce cap seul qu'elle sort telle qu'authorée. Les sept autres
 * caps la tournent de 45° par cran, en sens horaire (l'ordre de `DIR8_ORDER`). Le repère d'auteur est
 * le DÉFAUT DU MONDE (`capVolumique`) : ce que l'auteur écrit est ce que la scène montre.
 * Chaque recette le DÉCLARE (`PropVolumeRecipe.capIdentite`, requis du compilateur comme du schéma) —
 * le repère est dans la donnée, pas dans la tête de l'auteur. Matérialisé par
 * `builders/propVolumes.test.ts`.
 */
// eslint-disable-next-line no-restricted-imports -- #1506 : `DIR8_ORDER`/`estCardinal` sont des VALEURS du module FEUILLE `state/dir8` (zéro import, donc aucune contamination de graphe #421) — l'inversion de couche est tracée par ce ticket, et VISIBLE à son site.
import { DIR8_ORDER, estCardinal, type Dir4, type Dir8 } from '../state/dir8';
import type { PropMaterialData } from './materials.types';

/**
 * Le CAP d'un décor volumique, résolu et VERROUILLÉ. Une entité sans `facing` vaut `S` : le défaut du
 * monde, et le CAP D'IDENTITÉ des recettes (`CAP_IDENTITE_PROP`, cf. l'en-tête de ce module) — un
 * décor posé sans cap explicite sort donc exactement tel qu'il est authoré.
 * Ce que cette porte verrouille, c'est la DIAGONALE, refusée nominativement, pour deux raisons
 * MESURÉES : (1) l'empreinte est un RECTANGLE d'axes de grille, et la boîte englobante d'un corps
 * tourné de 45° enfle jusqu'à ×√2 par axe — une table 2×1 en diagonale muterait 2×2 cases pour un
 * corps qui n'en occupe vraiment aucune entière : du SUR-blocage, pas du débordement ; (2) le
 * cuiseur du monde LÈVE sur un cap diagonal (`gameIso/builders/props.ts`), donc une telle donnée ne
 * se rend même pas. Dernier filet d'une chaîne : le schéma de scène la refuse au parse
 * (`schemas/defs-scenes/scene.ts`), l'éditeur ne l'offre pas (`ui/editor/Inspector.tsx`) et
 * `state/validateScene.ts` la nomme à l'écran. PURE.
 */
export function capVolumique(facing: Dir8 | undefined, quoi: string): Dir4 {
  const cap = facing ?? 'S';
  if (!estCardinal(cap)) throw new Error(`${quoi} : cap ${cap} — un décor volumique ne prend qu'un cap cardinal (N/E/S/O)`);
  return cap;
}

/**
 * CAP D'IDENTITÉ d'une recette de décor : le cap auquel elle sort telle qu'authorée, et le DÉFAUT du
 * monde pour une entité sans `facing` (`capVolumique`) — les deux sont la MÊME valeur, c'est tout le
 * contrat (#1680 ligne 16). Déclaré par chaque recette (`PropVolumeRecipe.capIdentite`).
 */
export const CAP_IDENTITE_PROP = 'S' as const satisfies Dir4;

/**
 * CRANS de 45° horaires que le cap d'une instance fait subir à une recette, comptés DEPUIS le cap
 * d'identité. Source UNIQUE de ce décompte : la rotation de géométrie (`rotatePropLocal`) et celle du
 * cap d'un corps assis (`state/seating.ts`, `rotateDir8(slot.facing, crans)`) tournent du MÊME
 * nombre de crans — deux décomptes divergeraient au premier changement de repère. PURE.
 */
export const cransDepuisCapIdentite = (facing: Dir8): number =>
  (DIR8_ORDER.indexOf(facing) - DIR8_ORDER.indexOf(CAP_IDENTITE_PROP) + 8) % 8;

/**
 * Rotation d'un point du repère LOCAL d'une recette vers le repère de la scène, au cap d'auteur —
 * l'UNIQUE définition de ce que `SceneEntity.facing` fait subir à une géométrie de décor (volumes,
 * ancres de place, cases d'abord). Vit ici, à l'étage NEUTRE, pour être servie aussi bien au
 * builder volumique (`gameIso`) qu'à la résolution d'assise (`state`) : deux copies divergeraient.
 * `CAP_IDENTITE_PROP` est l'identité ; chaque cran vaut 45° horaires. PURE.
 */
export function rotatePropLocal(x: number, y: number, facing: Dir8): [number, number] {
  const a = cransDepuisCapIdentite(facing) * Math.PI / 4;
  return [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)];
}

/**
 * LE CAP DE CE DÉCOR EST-IL ADMIS ? Règle de décor, écrite UNE fois : un décor dont le type porte une
 * recette volumique ne prend qu'un cap CARDINAL (#1680 ligne 3) ; un billboard prend les huit, et une
 * entité sans cap n'en discute pas. Vit ici parce que ses deux lecteurs sont de part et d'autre de la
 * frontière des schémas — le SCHÉMA de scène (`schemas/defs-scenes/scene.ts`, refus au parse) et le
 * VALIDATEUR (`state/validateScene.ts`, signalement à l'éditeur) — et que `src/data` ne peut pas
 * dépendre de `src/state` (règle 3, #421 ; ce module est la seule couture tracée, #1506). PURE.
 */
export const capDecorAdmis = (estVolumique: boolean, facing: Dir8 | undefined): boolean =>
  !estVolumique || !facing || estCardinal(facing);

/** Id d'une matière de décor — une entrée de `materials.json` de domaine `prop`. */
export type PropMaterialId = string;

/** Point du repère local d'une recette — MÈTRES sur les trois axes (cf. la RÈGLE D'UNITÉ, en tête). */
export interface PropPoint3 { xM: number; yM: number; hM: number }
/** Dimensions dans le repère local d'une recette — MÈTRES sur les trois axes. */
export interface PropSize3 { xM: number; yM: number; hM: number }

/** Côtés admis d'un cylindre. 12 est EXCLU : ses faces latérales tombent sur l'arête de couteau du
 *  modelé de forme (4 normales à ±45°, `backends/webgl/worldTris:shadeFamily` départage alors des
 *  familles de 4/3/3/2 au lieu de 3/3/3/3) — un fût de la même recette y prend deux tons de trop. */
export type PropCylinderSides = 8 | 16;
export const PROP_CYLINDER_SIDES: readonly PropCylinderSides[] = [8, 16];

/** AXE d'un cylindre : `h` vertical, `x` est-ouest, `y` nord-sud — une valeur de la table
 *  `REPERE_D_AXE`, patron de `BAS_DE_PENTE` (#1343 lot C). */
export type PropCylinderAxis = 'h' | 'x' | 'y';

/** REPÈRE d'un cylindre selon son axe : `(a, b)` dans le plan de l'anneau, `t` le long de l'axe →
 *  décalage LOCAL depuis le centre de la primitive. `h` est l'identité. */
export const REPERE_D_AXE: Readonly<Record<PropCylinderAxis, (a: number, b: number, t: number) => PropPoint3>> = {
  h: (a, b, t) => ({ xM: a, yM: b, hM: t }),
  x: (a, b, t) => ({ xM: t, yM: a, hM: b }),
  y: (a, b, t) => ({ xM: a, yM: t, hM: b }),
};
/** Les axes admis — les clés de `REPERE_D_AXE`, seule source (schéma et validateur la lisent). */
export const PROP_CYLINDER_AXES = Object.keys(REPERE_D_AXE) as readonly PropCylinderAxis[];

/**
 * FOYER d'un décor qui éclaire : la primitive de sa recette d'où part la lumière (le lit de braises
 * d'un âtre, la coupelle d'une bougie). UNE au plus par recette (`validatePropCatalog`) — une source
 * ponctuelle a un seul foyer. Le rendu en tire la POSITION MONDE de la lampe (`state/vision.ts`
 * `mapLights` → `LightSource.foyer`), au lieu de la poser à l'aplomb de la case : elle suit donc la
 * géométrie, cap compris. Sans `emet`, le rendu applique sa hauteur par défaut (`FLAME_LIFT_M`).
 * `true` seul est admis : `emet: false` dirait la même chose que l'absence, en une seconde graphie.
 */
type PrimitiveEmettrice = { emet?: true };

/** Volume élémentaire d'une recette : caisse droite, cylindre à N faces, ou prisme en pente. */
export type PropPrimitive =
  | ({ kind: 'box'; center: PropPoint3; size: PropSize3; material: PropMaterialId } & PrimitiveEmettrice)
  | ({ kind: 'cylinder'; center: PropPoint3; axis: PropCylinderAxis; radiusM: number; longueurM: number; sides: PropCylinderSides; material: PropMaterialId } & PrimitiveEmettrice)
  | ({ kind: 'prism'; center: PropPoint3; size: PropSize3; slope: 'x+' | 'x-' | 'y+' | 'y-'; material: PropMaterialId } & PrimitiveEmettrice);

/** Recette volumique d'un prop : la liste de ses primitives, dans le repère local.
 *  `capIdentite` DÉCLARE ce repère — le cap auquel la recette sort telle qu'écrite. Une seule valeur
 *  est admise (`CAP_IDENTITE_PROP`), et elle est REQUISE : le repère d'une géométrie ne se déduit pas
 *  d'un commentaire, et une recette écrite sous un autre repère ne peut pas entrer en silence. */
export interface PropVolumeRecipe { capIdentite: typeof CAP_IDENTITE_PROP; primitives: PropPrimitive[] }

// ————————————————————————————————————————————————————————————————
// GÉOMÉTRIE LOCALE d'une primitive — UNE définition, deux consommateurs
// ————————————————————————————————————————————————————————————————
// Vit ici, à l'étage NEUTRE, pour la même raison que `rotatePropLocal` : le builder volumique
// (`gameIso/builders/propVolumes.ts`, qui la tourne et la pose dans le monde) et le validateur de
// catalogue (`validatePropCatalog`, plus bas, qui vérifie la fermeture de la coquille) lisent les
// MÊMES polygones. Deux copies divergeraient, et le contrat de fermeture ne prouverait plus rien
// sur ce qui est réellement cuit.

/** Normale (non unitaire) d'un polygone local, en convention three (X = est, Y = haut, Z = sud) — Newell. */
function normale(poly: readonly PropPoint3[]): PropPoint3 {
  let nx = 0, ny = 0, nz = 0;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    nx += (a.hM - b.hM) * (a.yM + b.yM);
    ny += (a.yM - b.yM) * (a.xM + b.xM);
    nz += (a.xM - b.xM) * (a.hM + b.hM);
  }
  return { xM: nx, yM: ny, hM: nz };
}

/** Barycentre des sommets d'une primitive : un point STRICTEMENT INTÉRIEUR à son volume, quelle que
 *  soit sa forme — le référent du dehors. Le centre de la BOÎTE n'en est pas un : pour un prisme, il
 *  tombe exactement dans le plan du rampant (mi-hauteur à mi-pente), et le produit scalaire d'une face
 *  passant par son propre référent ne décide plus rien. */
function barycentre(polys: readonly (readonly PropPoint3[])[]): PropPoint3 {
  let n = 0;
  const s = { xM: 0, yM: 0, hM: 0 };
  for (const poly of polys) for (const p of poly) { s.xM += p.xM; s.yM += p.yM; s.hM += p.hM; n++; }
  return { xM: s.xM / n, yM: s.yM / n, hM: s.hM / n };
}

/** Le polygone, tourné vers le DEHORS du point intérieur fourni (sens de parcours inversé s'il regardait
 *  dedans). */
function versLeDehors(poly: PropPoint3[], dedans: PropPoint3): PropPoint3[] {
  const n = normale(poly);
  const c = poly.reduce((acc, p) => ({ xM: acc.xM + p.xM / poly.length, yM: acc.yM + p.yM / poly.length, hM: acc.hM + p.hM / poly.length }), { xM: 0, yM: 0, hM: 0 });
  // Produit scalaire en convention three : (X, Y, Z) = (xM, hM, yM).
  const dehors = n.xM * (c.xM - dedans.xM) + n.yM * (c.hM - dedans.hM) + n.hM * (c.yM - dedans.yM);
  return dehors >= 0 ? poly : [...poly].reverse();
}

/** Les six faces d'une caisse droite, dans l'ordre −x, +x, −y, +y, bas, haut. */
function facesBoite(centre: PropPoint3, size: PropSize3): PropPoint3[][] {
  const x0 = centre.xM - size.xM / 2, x1 = centre.xM + size.xM / 2;
  const y0 = centre.yM - size.yM / 2, y1 = centre.yM + size.yM / 2;
  const h0 = centre.hM - size.hM / 2, h1 = centre.hM + size.hM / 2;
  const s = (xM: number, yM: number, hM: number): PropPoint3 => ({ xM, yM, hM });
  return [
    [s(x0, y0, h0), s(x0, y1, h0), s(x0, y1, h1), s(x0, y0, h1)],
    [s(x1, y0, h0), s(x1, y1, h0), s(x1, y1, h1), s(x1, y0, h1)],
    [s(x0, y0, h0), s(x1, y0, h0), s(x1, y0, h1), s(x0, y0, h1)],
    [s(x0, y1, h0), s(x1, y1, h0), s(x1, y1, h1), s(x0, y1, h1)],
    [s(x0, y0, h0), s(x1, y0, h0), s(x1, y1, h0), s(x0, y1, h0)],
    [s(x0, y0, h1), s(x1, y0, h1), s(x1, y1, h1), s(x0, y1, h1)],
  ];
}

/** Les `sides` faces latérales d'un cylindre, plus ses deux bouts. L'anneau se calcule dans `(a, b)`,
 *  `t` avance le long de l'axe, et chaque sommet passe par `REPERE_D_AXE[axis]`. */
function facesCylindre(centre: PropPoint3, radiusM: number, longueurM: number, sides: number, axis: PropCylinderAxis): PropPoint3[][] {
  const repere = REPERE_D_AXE[axis];
  const poser = ([a, b]: readonly [number, number], t: number): PropPoint3 => {
    const d = repere(a, b, t);
    return { xM: centre.xM + d.xM, yM: centre.yM + d.yM, hM: centre.hM + d.hM };
  };
  const t0 = -longueurM / 2, t1 = longueurM / 2;
  const anneau = Array.from({ length: sides }, (_, k) => {
    const angle = (k / sides) * 2 * Math.PI;
    return [radiusM * Math.cos(angle), radiusM * Math.sin(angle)] as const;
  });
  const out: PropPoint3[][] = [];
  for (let k = 0; k < sides; k++) {
    const a = anneau[k];
    const b = anneau[(k + 1) % sides];
    out.push([poser(a, t0), poser(b, t0), poser(b, t1), poser(a, t1)]);
  }
  out.push(anneau.map((p) => poser(p, t0)));
  out.push(anneau.map((p) => poser(p, t1)));
  return out;
}

/** Arête BASSE d'un prisme selon sa pente : la pente DESCEND vers ce côté, l'arête opposée porte la hauteur pleine. */
const BAS_DE_PENTE: Record<'x+' | 'x-' | 'y+' | 'y-', (p: { x: number; y: number }) => boolean> = {
  'x+': (p) => p.x > 0,
  'x-': (p) => p.x < 0,
  'y+': (p) => p.y > 0,
  'y-': (p) => p.y < 0,
};

/** Les cinq faces d'un prisme : semelle, rampant, dosseret vertical du haut de pente, deux joues triangulaires. */
function facesPrisme(centre: PropPoint3, size: PropSize3, slope: 'x+' | 'x-' | 'y+' | 'y-'): PropPoint3[][] {
  const dx = size.xM / 2, dy = size.yM / 2;
  const h0 = centre.hM - size.hM / 2, h1 = centre.hM + size.hM / 2;
  const bas = BAS_DE_PENTE[slope];
  // Les quatre coins de la semelle, en tour, plus la hauteur de crête que chacun porte.
  const coins = [
    { x: -dx, y: -dy }, { x: dx, y: -dy }, { x: dx, y: dy }, { x: -dx, y: dy },
  ].map((c) => ({ xM: centre.xM + c.x, yM: centre.yM + c.y, crete: bas(c) ? h0 : h1 }));
  const semelle = coins.map((c) => ({ xM: c.xM, yM: c.yM, hM: h0 }));
  const rampant = coins.map((c) => ({ xM: c.xM, yM: c.yM, hM: c.crete }));
  const hauts = coins.filter((c) => c.crete === h1);
  const dosseret = [
    { xM: hauts[0].xM, yM: hauts[0].yM, hM: h0 },
    { xM: hauts[1].xM, yM: hauts[1].yM, hM: h0 },
    { xM: hauts[1].xM, yM: hauts[1].yM, hM: h1 },
    { xM: hauts[0].xM, yM: hauts[0].yM, hM: h1 },
  ];
  const joues = [0, 1].map((k) => {
    const haut = hauts[k];
    const bas0 = coins.find((c) => c.crete === h0 && (c.xM === haut.xM || c.yM === haut.yM))!;
    return [
      { xM: haut.xM, yM: haut.yM, hM: h0 },
      { xM: bas0.xM, yM: bas0.yM, hM: h0 },
      { xM: haut.xM, yM: haut.yM, hM: h1 },
    ];
  });
  return [semelle, rampant, dosseret, ...joues];
}

/**
 * Les polygones LOCAUX d'une primitive, chacun tourné vers le DEHORS par le barycentre de la primitive
 * — une seule définition du dehors pour les trois formes, et la SEULE géométrie que le catalogue
 * possède. Le builder les tourne au cap et les pose dans le monde sans rien y ajouter ; le validateur y
 * vérifie la fermeture de la coquille. PURE.
 */
export function polygonesDePrimitive(p: PropPrimitive): PropPoint3[][] {
  const brutes = p.kind === 'box' ? facesBoite(p.center, p.size)
    : p.kind === 'cylinder' ? facesCylindre(p.center, p.radiusM, p.longueurM, p.sides, p.axis)
      : facesPrisme(p.center, p.size, p.slope);
  const dedans = barycentre(brutes);
  return brutes.map((poly) => versLeDehors(poly, dedans));
}

/**
 * Un SOMMET pour la mesure de FERMETURE : trois coordonnées, SANS unité. La fermeture est une
 * propriété TOPOLOGIQUE — elle vaut aussi bien sur la géométrie LOCALE d'une recette (mètres,
 * `PropPoint3`) que sur les faces MONDE qu'un builder en tire (cases dans le plan, mètres en
 * hauteur — `GP`, `gameIso/builders/types.ts`). Ces deux repères ne portent PLUS les mêmes noms de
 * champs depuis #1507, et c'est le verrou : le triplet est l'unique forme qu'ils partagent, et
 * chaque appelant DIT lequel des deux il mesure.
 */
export type Sommet3 = readonly [number, number, number];

/** Le sommet LOCAL d'une recette, réduit à son triplet. */
export const sommetLocal = (p: PropPoint3): Sommet3 => [p.xM, p.yM, p.hM];

/** Clé d'un sommet, arrondie au nanomètre — deux sommets calculés par des chemins différents
 *  (coin partagé de deux faces) doivent porter la MÊME clé. `+ 0` normalise le zéro négatif. */
const cléSommet = (s: Sommet3): string =>
  `${Math.round(s[0] * 1e9) / 1e9 + 0},${Math.round(s[1] * 1e9) / 1e9 + 0},${Math.round(s[2] * 1e9) / 1e9 + 0}`;

/**
 * ARÊTES NON APPARIÉES d'un jeu de polygones — le défaut de FERMETURE, nommé. Une COQUILLE CLOSE porte
 * chaque arête par EXACTEMENT deux faces, parcourues en sens OPPOSÉS (a→b sur l'une, b→a sur l'autre) :
 * c'est ce qui rend le volume étanche ET son orientation cohérente. Rend la liste des arêtes fautives
 * (clé `sommet→sommet` et le compte des deux sens), `[]` = coquille close.
 * Prend des POLYGONES de `Sommet3`, pas une primitive : le même contrat se mesure sur la géométrie
 * LOCALE du catalogue (`polygonesDePrimitive`, via `sommetLocal`) comme sur les faces MONDE que le
 * builder en tire — la transformation rigide du cap, de l'échelle et de l'ancre doit le préserver. PURE.
 */
export function aretesNonAppariees(polys: readonly (readonly Sommet3[])[]): { arete: string; sens: number; contreSens: number }[] {
  const compte = new Map<string, number>();
  for (const poly of polys)
    for (let i = 0; i < poly.length; i++) {
      const a = cléSommet(poly[i]);
      const b = cléSommet(poly[(i + 1) % poly.length]);
      const k = `${a}→${b}`;
      compte.set(k, (compte.get(k) ?? 0) + 1);
    }
  const out: { arete: string; sens: number; contreSens: number }[] = [];
  for (const [k, n] of compte) {
    const [a, b] = k.split('→');
    const inverse = compte.get(`${b}→${a}`) ?? 0;
    if (n !== 1 || inverse !== 1) out.push({ arete: k, sens: n, contreSens: inverse });
  }
  return out.sort((x, y) => (x.arete < y.arete ? -1 : x.arete > y.arete ? 1 : 0));
}

/** Place assise offerte par un prop : ancre du corps, cap du corps assis, et case d'ABORD (relative à
 *  l'ancre de l'empreinte) depuis laquelle on rejoint la place.
 *  `id` : `place-<rang>`, SANS CÔTÉ (#1680 ligne 16). Le préfixe le tient hors des homonymes de
 *  l'index GLOBAL des ids authorés (`scripts/docs/lib/structures-scan.mts`, où un mot commun résoudrait
 *  depuis un autre dataset) ; le RANG, lui, est tout ce qu'une clé d'identité a le droit de porter — le
 *  côté vit dans `anchor`/`facing`/`approach`, qui TOURNENT avec le cap de l'instance quand l'id, lui,
 *  ne tourne pas. Un id cardinal (`place-nord`) mentait dès que le repère bougeait. Il reste keyé sous
 *  son meuble dans `Scene.seatAssignments` (`propId → slotId`) : deux meubles peuvent porter `place-1`.
 *  UNITÉS — `anchor` est MÉTRIQUE (`PropPoint3`, la RÈGLE D'UNITÉ en tête) : elle est collée à la
 *  géométrie de la recette et subit la MÊME transformation qu'elle (`state/seating.ts` la tourne au cap
 *  puis la divise par le `metresPerTile` de la scène). `approach`, lui, est un offset de CASE voisine —
 *  un pas de grille, pas une longueur : il ne se divise par rien. */
export interface PropSeatSlot { id: string; anchor: PropPoint3; facing: Dir8; approach: { x: number; y: number } }

/** Matière de rendu d'une primitive : une entrée de `materials.json` de domaine `prop`. */
export type { PropMaterialData };

/**
 * Type de PROP/décor app-owned : couche SÉMANTIQUE (physique `solid`, opacité `opaque`, classe de
 * `cover`, émission de lumière `light`, empreinte `foot`) ET géométrie locale (`volume`, `seatSlots`) —
 * le rendu SVG de vignette reste au catalogue gameIso. Vérité UNIQUE des dimensions d'un
 * décor : une instance de scène ne redéclare aucune empreinte. Lu par la walkability (`sceneRules`), la
 * Ligne de Vue/couvert (`lineOfSight`), la lumière (`vision`) et le monde volumique. Édité au Codex.
 * Un prop ABSENT du dataset = passable, transparent, sans couvert, sans lumière et sans empreinte.
 */
export interface PropData {
  id: string;
  type: 'props';
  /** Nom d'auteur du décor. Miroir du `label` de la def d'ART du même id
   *  (`src/gameIso/catalog/decor/defs/<id>.ts`) — parité gardée par `src/data/props-label-parite.test.ts`. */
  label: string;
  solid?: boolean;
  opaque?: boolean;
  cover?: 'imparfaite' | 'moyenne' | 'totale';
  /** Source lumineuse : `radiusM` = le rayon éclairé en MÈTRES, la valeur RAW telle qu'elle est écrite
   *  (LDB 74 l.43/58). Le LECTEUR le divise par le `metresPerTile` de la scène pour en faire les cases
   *  d'une `LightSource` (`state/vision.ts`, `rayonEnCases`). */
  light?: { radiusM: number; tone?: string };
  foot?: { w: number; h: number };
  volume?: PropVolumeRecipe;
  seatSlots?: PropSeatSlot[];
}

/** Empreinte DÉCLARÉE d'un type de prop — défaut 1×1. Vérité des dimensions d'un décor SANS recette
 *  (billboard) ; un décor à recette tire la sienne de son CORPS (`empreinteDeriveeDuProp`). */
export const propFootOf = (prop: PropData | undefined): { w: number; h: number } => prop?.foot ?? { w: 1, h: 1 };

/** Boîte englobante d'une primitive dans le repère LOCAL, en mètres : au plan (`x0..x1`, `y0..y1`),
 *  et en hauteur (`bas..haut`) — mesurée sur `polygonesDePrimitive`, la seule géométrie que le
 *  catalogue possède. L'UNIQUE emprise d'une primitive : aucun lecteur ne la recalcule depuis ses
 *  cotes. PURE. */
export function empriseLocaleM(p: PropPrimitive): { x0: number; x1: number; y0: number; y1: number; bas: number; haut: number } {
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity, bas = Infinity, haut = -Infinity;
  for (const poly of polygonesDePrimitive(p))
    for (const s of poly) {
      x0 = Math.min(x0, s.xM); x1 = Math.max(x1, s.xM);
      y0 = Math.min(y0, s.yM); y1 = Math.max(y1, s.yM);
      bas = Math.min(bas, s.hM); haut = Math.max(haut, s.hM);
    }
  return { x0, x1, y0, y1, bas, haut };
}

/**
 * LA PLACE dont cette primitive est le SIÈGE, s'il y en a une — discriminant STRUCTUREL du tabouret,
 * jamais un nom de ref : la primitive dont l'emprise au plan CONTIENT l'ancre d'une place ET qui ne
 * monte pas plus haut que cette assise (l'assise et son fût). Un plateau qui SURVOLE l'ancre reste du
 * corps. Mesuré en MÈTRES de bout en bout (ancre et géométrie sont dans le même repère) : aucune
 * échelle n'entre ici.
 *
 * UNE définition, deux lecteurs : l'empreinte dérivée ci-dessous, qui exclut les sièges du corps qui
 * décide des cases (un tabouret n'est pas un obstacle : c'est par lui qu'on s'assoit), et le contrat
 * de catalogue `gameIso/catalog/props-volumiques.test.ts`. PURE.
 */
export function placeAssiseDe(prop: PropData, primitive: PropPrimitive): PropSeatSlot | undefined {
  const e = empriseLocaleM(primitive);
  return (prop.seatSlots ?? []).find((s) =>
    s.anchor.xM >= e.x0 - 1e-9 && s.anchor.xM <= e.x1 + 1e-9
    && s.anchor.yM >= e.y0 - 1e-9 && s.anchor.yM <= e.y1 + 1e-9
    && e.haut <= s.anchor.hM + 1e-9);
}

/** Le jeu de places VIDE, en un SEUL objet : sans lui, `prop.seatSlots ?? []` fabriquerait une clé
 *  neuve à chaque appel et le cache ne servirait jamais les décors sans place — la moitié du
 *  catalogue. */
const SANS_PLACES: readonly PropSeatSlot[] = [];

/** Cache d'empreintes dérivées, de niveau CATALOGUE (au plus une recette × 4 caps par échelle jouée),
 *  jamais de niveau scène : l'empreinte d'un TYPE ne dépend d'aucune instance.
 *  Clé COMPOSÉE des DEUX données dont le résultat dépend, chacune par IDENTITÉ de référence (patron
 *  `state/sceneMemo.ts`) : la RECETTE (le corps mesuré) ET les PLACES (ce qui en est exclu,
 *  `placeAssiseDe`). Ni l'une ni l'autre seule ne suffit — deux `PropData` peuvent partager la même
 *  recette et différer par leurs places, et rendre alors des empreintes différentes (table ronde :
 *  1×1 avec ses quatre places, 2×2 sans elles). Un cache par id du prop serait pire encore : il
 *  survivrait à la surcharge d'un dataset (`data/overrides.ts`) et rendrait l'empreinte d'un corps
 *  qui n'existe plus. Rien à invalider à la main : une donnée ré-authored est un NOUVEL objet. */
const empreintesDerivees = new WeakMap<PropVolumeRecipe, WeakMap<readonly PropSeatSlot[], Map<string, { w: number; h: number }>>>();

/**
 * EMPREINTE DÉRIVÉE d'un décor à recette : les cases que son CORPS occupe une fois TOURNÉ au cap de
 * l'instance — `w` = étendue en x arrondie au supérieur (plancher 1), `h` idem en y. Les SIÈGES sont
 * exclus du corps (`placeAssiseDe`) : la case qu'un tabouret effleure reste traversable, sinon les
 * abords d'une table ronde seraient murés par ses propres tabourets.
 *
 * C'est l'empreinte qui TOURNE : une table 2×1 au cap E occupe 1×2. La dérivation dépend de l'ÉCHELLE
 * de la scène (`metresPerTile`) — le même corps de 1,8 m tient sur une case à 2 m/case et sur deux à
 * 1 m/case —, donc elle se calcule À LA CONSOMMATION et ne se fige jamais en donnée.
 *
 * Prend les HUIT caps : cette fonction MESURE, elle n'arbitre pas. Le refus de la diagonale sur un
 * décor à recette est la porte de `capVolumique`, tenue en amont par le schéma de scène, le validateur
 * et l'émetteur ; une empreinte qui lèverait aussi ferait tomber la MARCHABILITÉ d'une scène fautive,
 * donc l'éditeur où l'auteur doit justement lire l'erreur.
 * PURE (mémoïsée par identité de recette, cap et échelle).
 */
export function empreinteDeriveeDuProp(prop: PropData, facing: Dir8, mpt: number): { w: number; h: number } {
  if (!prop.volume) return propFootOf(prop);
  let parPlaces = empreintesDerivees.get(prop.volume);
  if (!parPlaces) { parPlaces = new WeakMap(); empreintesDerivees.set(prop.volume, parPlaces); }
  const places = prop.seatSlots ?? SANS_PLACES;
  let parCap = parPlaces.get(places);
  if (!parCap) { parCap = new Map(); parPlaces.set(places, parCap); }
  const cle = `${facing}|${mpt}`;
  const connue = parCap.get(cle);
  if (connue) return connue;
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const primitive of prop.volume?.primitives ?? []) {
    if (placeAssiseDe(prop, primitive)) continue;
    for (const poly of polygonesDePrimitive(primitive))
      for (const s of poly) {
        const [rx, ry] = rotatePropLocal(s.xM, s.yM, facing);
        x0 = Math.min(x0, rx); x1 = Math.max(x1, rx);
        y0 = Math.min(y0, ry); y1 = Math.max(y1, ry);
      }
  }
  // LE site de conversion mètres → cases de ce module (#1507, déclaré par `state/echelle-de-scene.test.ts`).
  const enCases = (metres: number): number => Math.max(1, Math.ceil(metres / mpt - 1e-9));
  const val = Number.isFinite(x0) ? { w: enCases(x1 - x0), h: enCases(y1 - y0) } : propFootOf(prop);
  parCap.set(cle, val);
  return val;
}

/**
 * EMPREINTE EFFECTIVE d'un type de décor au cap d'une instance — la couture UNIQUE que lisent tous les
 * consommateurs de cases (walkability, Ligne de Vue, lumière, halo). Un décor à recette la tire de son
 * CORPS tourné ; un BILLBOARD, qui n'a pas de corps, garde son empreinte déclarée. PURE.
 */
export function empreinteDuProp(prop: PropData | undefined, facing: Dir8 | undefined, mpt: number): { w: number; h: number } {
  if (!prop?.volume) return propFootOf(prop);
  return empreinteDeriveeDuProp(prop, facing ?? CAP_IDENTITE_PROP, mpt);
}

/**
 * OFFSET de l'ANCRE dans son empreinte : du coin NO (`SceneEntity.pos`) vers le CENTRE du bloc, en
 * cases. Écrite ICI parce que `src/data` ne peut pas remonter vers `src/state` sans cycle, et qu'il
 * n'en existe qu'UNE : `state/footprint.ts` (`decorFootGeometry`, puis `decorAncre` qui la sert au
 * monde) la LIT, elle ne la refait pas. 1×1 ⇒ (0,0). PURE.
 */
export function offsetAncre(foot?: { w: number; h: number }): { x: number; y: number } {
  return { x: (Math.max(1, foot?.w ?? 1) - 1) / 2, y: (Math.max(1, foot?.h ?? 1) - 1) / 2 };
}

/** Une place d'un décor, résolue dans le repère de l'INSTANCE : des offsets depuis `SceneEntity.pos`
 *  (le coin NO), à ajouter tels quels. `ancre` est FRACTIONNAIRE (le point où le corps s'assoit) ;
 *  `siege` et `abord` sont des CASES ENTIÈRES. */
export interface PlaceLocale {
  slot: PropSeatSlot;
  ancre: { x: number; y: number };
  siege: { x: number; y: number };
  abord: { x: number; y: number };
}

/** La case ENTIÈRE qui porte un point du plan — définition UNIQUE du passage point → case pour les
 *  places (`state/seating.ts` l'importe au lieu d'en garder une copie). L'arrondi ne départage un
 *  demi-entier que pour un point posé EXACTEMENT sur la couture de deux cases ; c'est pourquoi
 *  `placesLocalesDuProp` applique l'abord depuis la CASE du siège, jamais depuis l'ancre
 *  fractionnaire du meuble, où l'empreinte paire y tomberait à chaque fois. */
export const caseDe = (x: number, y: number): { x: number; y: number } => ({ x: Math.round(x), y: Math.round(y) });

/**
 * LES PLACES D'UN DÉCOR, dans le repère de son instance — la règle d'ancrage d'une place, en UN lieu,
 * lue par la résolution d'assise (`state/seating.ts`) comme par le validateur de catalogue ci-dessous.
 * Tenue en double, elle divergeait : le validateur jugeait l'abord depuis le COIN NO pendant que le
 * runtime le posait depuis l'ANCRE — une approche refusée au catalogue tombait hors du meuble, et une
 * approche admise tombait dessus.
 *
 * Trois points, chacun dans son unité :
 *  - `ancre` = l'ancre du DÉCOR (`offsetAncre`, le centre de l'empreinte effective) plus l'ancre
 *    LOCALE de la place, en mètres au catalogue, divisée par l'échelle et tournée au cap ;
 *  - `siege` = la CASE qui porte cette ancre ;
 *  - `abord` = `approach` appliqué depuis la CASE DU SIÈGE, en cases entières. L'appliquer depuis
 *    l'ancre fractionnaire du meuble ferait tomber un arrondi sur un demi-entier dès que l'empreinte
 *    est paire, et deux places symétriques recevraient des abords asymétriques.
 * PURE.
 */
export function placesLocalesDuProp(prop: PropData | undefined, facing: Dir8 | undefined, mpt: number): PlaceLocale[] {
  const slots = prop?.seatSlots ?? [];
  if (!slots.length) return [];
  const cap = facing ?? CAP_IDENTITE_PROP;
  const centre = offsetAncre(empreinteDuProp(prop, cap, mpt));
  return slots.map((slot) => {
    // LE site de conversion mètres → cases des places (#1507, déclaré par `state/echelle-de-scene.test.ts`).
    const [ax, ay] = rotatePropLocal(slot.anchor.xM / mpt, slot.anchor.yM / mpt, cap);
    const ancre = { x: centre.x + ax, y: centre.y + ay };
    const siege = caseDe(ancre.x, ancre.y);
    const [px, py] = rotatePropLocal(slot.approach.x, slot.approach.y, cap);
    return { slot, ancre, siege, abord: caseDe(siege.x + px, siege.y + py) };
  });
}

/** Anomalies d'UNE primitive : coordonnées finies, dimensions positives, côtés et axe admis, puis,
 *  sur la géométrie, aucun sommet SOUS LE SOL de la case (`hM < 0`) et la FERMETURE en coquille close.
 *  La géométrie n'est mesurée que déjà non ambiguë — des dimensions folles n'ajouteraient qu'un
 *  bruit d'arêtes par-dessus leur propre diagnostic. `mesurable` dit si cette géométrie existe. */
function erreursDePrimitive(propId: string, primitive: PropPrimitive): { errors: string[]; mesurable: boolean } {
  const errors: string[] = [];
  const centre = [primitive.center.xM, primitive.center.yM, primitive.center.hM];
  const dimensions = primitive.kind === 'cylinder'
    ? [primitive.radiusM, primitive.longueurM]
    : [primitive.size.xM, primitive.size.yM, primitive.size.hM];
  const fini = [...centre, ...dimensions].every((n) => Number.isFinite(n));
  const positif = dimensions.every((n) => !Number.isFinite(n) || n > 0);
  // Le JSON n'est pas typé à l'EXÉCUTION : les unions `PropCylinderSides` et `PropCylinderAxis` se re-vérifient ici.
  const côtésAdmis = primitive.kind !== 'cylinder' || PROP_CYLINDER_SIDES.includes(primitive.sides);
  const axeAdmis = primitive.kind !== 'cylinder' || PROP_CYLINDER_AXES.includes(primitive.axis);
  if (!fini) errors.push(`${propId}: coordonnée non finie`);
  if (!positif) errors.push(`${propId}: dimension non positive`);
  if (!côtésAdmis) errors.push(`${propId}: cylindre à ${(primitive as { sides: number }).sides} côtés (admis : ${PROP_CYLINDER_SIDES.join(' ou ')})`);
  if (!axeAdmis) errors.push(`${propId}: cylindre d’axe « ${(primitive as { axis: unknown }).axis} » (admis : ${PROP_CYLINDER_AXES.join(', ')})`);
  if (!(fini && positif && côtésAdmis && axeAdmis)) return { errors, mesurable: false };
  const { bas } = empriseLocaleM(primitive);
  if (bas < -1e-9)
    errors.push(`${propId}: primitive ${primitive.kind} « ${primitive.material} » — descend à ${bas} m, sous le sol de sa case`);
  for (const { arete, sens, contreSens } of aretesNonAppariees(polygonesDePrimitive(primitive).map((poly) => poly.map(sommetLocal))))
    errors.push(`${propId}: primitive ${primitive.kind} « ${primitive.material} » — arête non appariée ${arete} (${sens} dans le sens, ${contreSens} à contre-sens)`);
  return { errors, mesurable: true };
}

/**
 * Invariants de CATALOGUE que le schéma seul ne peut pas voir (cohérence géométrique, FERMETURE de
 * chaque primitive en coquille close, côtés admis d'un cylindre, unicité des places). Renvoie la liste
 * des anomalies en français, `[]` = catalogue intègre. Ce validateur juge la GÉOMÉTRIE ; la RÉFÉRENCE
 * au matériau, elle, est tenue AU PARSE par le schéma, contre la sous-liste `prop` de `materials.json`
 * (`idDe('material', 'prop')`, `schemas/defs/props.ts`).
 *
 * `mpt` — l'ÉCHELLE à laquelle le catalogue est jugé. L'abord d'une place se mesure contre l'empreinte
 * EFFECTIVE (`empreinteDuProp`), qui dépend de l'échelle depuis #1509 : un catalogue intègre à 2 m/case
 * ne l'est pas forcément à 1. Un catalogue n'a pas de scène, donc l'échelle lui est DONNÉE, jamais
 * devinée — et l'anomalie la NOMME, pour qu'un verdict ne se lise jamais hors de son échelle.
 */
export function validatePropCatalog(entries: readonly PropData[], mpt: number): string[] {
  const errors: string[] = [];
  for (const prop of entries) {
    const slots = new Set<string>();
    /** Abord RÉSOLU → case de SIÈGE qui l'a posé le premier (cf. la règle d'ambiguïté plus bas). */
    const approaches = new Map<string, string>();
    // Le JSON n'est pas typé à l'EXÉCUTION (même raison que les côtés de cylindre ci-dessus) : le REPÈRE
    // déclaré par la recette doit être celui que `rotatePropLocal` implémente, sans quoi la géométrie
    // sort d'un demi-tour sans que rien ne le dise.
    if (prop.volume && prop.volume.capIdentite !== CAP_IDENTITE_PROP)
      errors.push(`${prop.id}: recette au repère « ${prop.volume.capIdentite} » (seul ${CAP_IDENTITE_PROP} est implémenté)`);
    // COUVERT D'UN DÉCOR OPAQUE — un décor qui coupe la Ligne de Vue est lu par `tileBlocksSight`
    // (`state/lineOfSight.ts:tileBlocksSight`), qui rend « bloqué » ou force « totale » au contact AVANT que la
    // classe de `cover` ne soit lue : toute autre classe déclarée sous `opaque` est une règle que le
    // moteur n'applique jamais. Le catalogue ne peut donc pas la porter.
    if (prop.opaque && prop.cover !== 'totale')
      errors.push(`${prop.id}: opaque avec cover ${prop.cover ? `« ${prop.cover} »` : 'absent'} — un décor opaque ne rend que « totale » (lineOfSight)`);
    const formes = (prop.volume?.primitives ?? []).map((primitive) => erreursDePrimitive(prop.id, primitive));
    for (const forme of formes) errors.push(...forme.errors);
    // FOYER D'UNE SOURCE VOLUMIQUE (#1680 ligne 5) — les trois anomalies sont les trois façons dont
    // `emet` et `light` peuvent se contredire, et aucune n'est rattrapable au rendu : une lumière dont
    // le foyer n'est pas DÉCLARÉ se devinerait, et deviner l'ancre d'une lampe est ce que ce lot supprime.
    const emettrices = (prop.volume?.primitives ?? []).filter((p) => p.emet);
    if (emettrices.length > 1)
      errors.push(`${prop.id}: ${emettrices.length} primitives « emet » — une source ponctuelle n’a qu’UN foyer`);
    if (emettrices.length && !prop.light)
      errors.push(`${prop.id}: primitive « emet » sans \`light\` — un foyer sans source n’éclaire rien`);
    if (prop.light && prop.volume && !emettrices.length)
      errors.push(`${prop.id}: \`light\` sur une recette volumique sans primitive « emet » — le foyer d’un volume se DÉCLARE, il ne se devine pas`);
    for (const slot of prop.seatSlots ?? []) {
      if (!slot.id.trim()) errors.push(`${prop.id}: slot sans id`);
      else if (slots.has(slot.id)) errors.push(`${prop.id}: slot dupliqué « ${slot.id} »`);
      slots.add(slot.id);
    }
    // ABORD au CAP D'IDENTITÉ : c'est le seul cap auquel `approach` (écrit par l'auteur) et l'empreinte
    // sont dans le même repère. Aux autres caps, les deux tournent ENSEMBLE — la mesure est la même.
    // La case d'abord est celle que le RUNTIME posera (`placesLocalesDuProp`, la règle unique) : une
    // formule propre au validateur jugerait dans un repère que la scène n'emploie pas.
    // L'empreinte se MESURE sur la géométrie : une primitive sans géométrie (axe inconnu, cote non
    // finie) n'en a pas, et son diagnostic est déjà rendu.
    if (formes.some((forme) => !forme.mesurable)) continue;
    const { w, h } = empreinteDuProp(prop, CAP_IDENTITE_PROP, mpt);
    for (const { slot, siege, abord } of placesLocalesDuProp(prop, CAP_IDENTITE_PROP, mpt)) {
      const key = `${abord.x},${abord.y}`;
      const siegeKey = `${siege.x},${siege.y}`;
      // AMBIGUÏTÉ D'ABORD — une case d'abord qui dessert DEUX SIÈGES DISTINCTS ne dit plus où l'on
      // s'assoit : c'est l'anomalie. Deux places qui S'EFFONDRENT dans la MÊME case de siège n'en sont
      // pas une : à une échelle grossière (la barge du sel et le Loup & Saumure sont à 10 m/case), tout
      // meuble à N places tient sur une case, et ses places n'y sont plus distinguables SPATIALEMENT.
      // Elles restent occupables une à une — `state/seating.ts` (`placesResolues`, 2ᵉ passe) réserve les
      // abords sur la SCÈNE et replie la seconde sur une voisine atteignable du siège.
      const parLeMemeAbord = approaches.get(key);
      if (parLeMemeAbord !== undefined && parLeMemeAbord !== siegeKey)
        errors.push(`${prop.id}: abord AMBIGU (${key}) — il dessert deux sièges distincts, (${parLeMemeAbord}) et (${siegeKey})`);
      else approaches.set(key, siegeKey);
      const dansEmpreinte = abord.x >= 0 && abord.x < w && abord.y >= 0 && abord.y < h;
      if (prop.solid && dansEmpreinte) errors.push(`${prop.id}: approche « ${slot.id} » (${slot.approach.x},${slot.approach.y}) tombe sur la case (${key}) de l’empreinte ${w}×${h} à ${mpt} m/case`);
    }
  }
  return errors;
}

/**
 * BUILDER de SOLS — produit les éléments `floor` du pivot (cf. ./types) : pour chaque tuile construite
 * des couches à rendre, le losange de sol (matériau = id de TerrainDef), les faces VERTICALES de relief
 * auto-dérivées des deltas de hauteur MÉTRIQUE (falaise/rampe/tablier/piliers), les wedges de raccord
 * de terrain, et les VÉRITÉS DE SCÈNE (visible/surplomb/fantôme/surplomb plein). PUR et
 * projection-agnostique : géométrie en unités de GRILLE + MÈTRES (`GP`), aucune notion de caméra.
 */
import { Scene, tileAt, isWalkable, sceneMetresPerTile, wallEnds, type CellSide, type SceneDuVolume } from '../scene';
import { estAbsent, terrainBuilt, terrainMatiere, terrainPriority, terrainSolidHeightM } from '../terrain';
import type { Face, FloorEl } from './types';
import { viewedBuilder, type Viewed } from './viewTruth';
import { dessusDe, displayHeightAt, facesDuDessus, parois, presenteDansLaGrille, profilDArete, rejointAPied } from './pente';

/** Épaisseur (mètres) de la DALLE ajourée d'un tablier de surplomb : la face de bord donnant sur le
 *  vide descend de cette hauteur seulement (pas une falaise de pleine hauteur) → on voit dessous. */
const DECK_THICKNESS_M = 0.3;

export const SIDES: CellSide[] = ['N', 'E', 'S', 'O'];
/** Déplacement de la case VOISINE que borde chaque arête cardinale (source UNIQUE, partagée POV). */
export const NEIGHBOURS: Record<CellSide, [number, number]> = {
  N: [0, -1],
  E: [1, 0],
  S: [0, 1],
  O: [-1, 0],
};

export interface EdgeBlend {
  dir: CellSide;
  terrain: string;
}

/** Voisins de plus haute précédence qui « débordent » sur la tuile (x,y) du niveau `z`. */
export function edgeBlends(scene: SceneDuVolume, x: number, y: number, z = 0): EdgeBlend[] {
  const self = terrainPriority(tileAt(scene, x, y, z));
  const out: EdgeBlend[] = [];
  for (const dir of SIDES) {
    const [dx, dy] = NEIGHBOURS[dir];
    const nt = tileAt(scene, x + dx, y + dy, z);
    if (terrainPriority(nt) > self) out.push({ dir, terrain: nt });
  }
  return out;
}

/** SURPLOMB : la case (x,y,z) d'une couche z>0 a-t-elle une surface MARCHABLE sur une couche INFÉRIEURE ?
 *  (un tablier de pont / une loge AU-DESSUS d'une route praticable). Si oui, le bord donnant sur le vide
 *  ne descend PAS jusqu'au sol (dalle fine + piliers), la couche du dessous reste visible/passable. */
export function isOverhang(scene: SceneDuVolume, x: number, y: number, z: number): boolean {
  if (z <= 0) return false;
  for (let zz = z - 1; zz >= 0; zz--) if (isWalkable(scene, x, y, zz)) return true;
  return false;
}

/** TOIT D'UN BLOC PLEIN : la case (x,y,z>0) coiffe-t-elle un terrain à BLOC PLEIN (mur) d'une couche
 *  inférieure, à hauteur d'AFFICHAGE coïncidente ? (le chemin de ronde posé sur la masse du rempart). Alors
 *  ce n'est PAS un surplomb flottant mais la surface SUPÉRIEURE d'une structure solide → il se voit d'un
 *  étage inférieur exactement comme le bloc (opaque, jamais culé/fantôme), au lieu de disparaître et de
 *  laisser le dessus BRUT du bloc à nu quand on regarde le mur d'en bas (activeZ sous z). GÉNÉRAL. */
export function capsSolid(scene: SceneDuVolume, x: number, y: number, z: number): boolean {
  if (capsSolidDirect(scene, x, y, z)) return true; // (a) posé DIRECTEMENT sur un bloc plein
  if (z <= 0 || estAbsent(tileAt(scene, x, y, z))) return false;
  const { w: W, h: H } = scene.dimensions;
  const top = displayHeightAt(scene, x, y, z);
  for (let zz = z - 1; zz >= 0; zz--) {
    if (estAbsent(tileAt(scene, x, y, zz))) continue;
    // (b) TOIT DE GATEHOUSE : le sol dessous est passable (TUNNEL de porte) mais BORDÉ par un bloc plein de
    //     même niveau montant jusqu'au dessus (le chemin de ronde ceinture la masse et coiffe le passage) →
    //     toit SOLIDE d'une structure, pas un tablier sur pilotis. Rend le rempart continu au-dessus de la porte.
    //     Voisin HORS CARTE ignoré : `tileAt` y rend le terrain du BORD DU MONDE — un tablier posé
    //     en BORD de scène n'est pas pour autant un toit de gatehouse.
    if (SIDES.some((s) => { const [dx, dy] = NEIGHBOURS[s]; const nx = x + dx, ny = y + dy; return nx >= 0 && nx < W && ny >= 0 && ny < H && terrainSolidHeightM(tileAt(scene, nx, ny, zz)) > 0 && displayHeightAt(scene, nx, ny, zz) >= top - 0.01; })) return true;
  }
  return false;
}

/** Cas (a) SEUL : la case (x,y,z>0) est-elle posée DIRECTEMENT sur un bloc plein (mur) de MÊME EMPREINTE, à
 *  hauteur coïncidente ? Alors c'est le DESSUS de ce bloc — le bloc dessine déjà TOUTES ses parois → ce sol
 *  ne redessine AUCUNE falaise (sinon redondance + à base égale la couche z1 gagne le tri et RECOUVRE une
 *  rampe z0 de même hauteur posée devant). ⊥ du cas (b) « gatehouse » (tunnel : le sol DOIT border sa dalle). */
export function capsSolidDirect(scene: SceneDuVolume, x: number, y: number, z: number): boolean {
  if (z <= 0 || estAbsent(tileAt(scene, x, y, z))) return false;
  const top = displayHeightAt(scene, x, y, z);
  for (let zz = z - 1; zz >= 0; zz--)
    if (!estAbsent(tileAt(scene, x, y, zz)) && terrainSolidHeightM(tileAt(scene, x, y, zz)) > 0 && displayHeightAt(scene, x, y, zz) >= top - 0.01) return true;
  return false;
}

/** Ce BLOC PLEIN (x,y,z) est-il COIFFÉ par un sol d'une couche supérieure à hauteur coïncidente ? Alors son
 *  propre DESSUS est REDONDANT (le sol du dessus — chemin de ronde — EST la surface) → on ne le dessine pas :
 *  deux dalles superposées « clignotent » selon le voile (l'une perçue, l'autre voilée laissant voir le
 *  dessus brut du bloc). Miroir de `capsSolid`, côté bloc. */
function cappedAbove(scene: SceneDuVolume, x: number, y: number, z: number): boolean {
  const top = displayHeightAt(scene, x, y, z);
  return scene.layers.some((l) => l.z > z && !estAbsent(tileAt(scene, x, y, l.z)) && displayHeightAt(scene, x, y, l.z) >= top - 0.01);
}

/** Hauteur d'AFFICHAGE de la surface INFÉRIEURE sous un surplomb (1ʳᵉ couche marchable en dessous), ou null. */
function overhangLowerHeight(scene: SceneDuVolume, x: number, y: number, z: number): number | null {
  for (let zz = z - 1; zz >= 0; zz--) if (isWalkable(scene, x, y, zz)) return displayHeightAt(scene, x, y, zz);
  return null;
}

/** Étage de SOL effectif sous (x,y) pour le BROUILLARD : à un trou (tuile ABSENTE) de l'étage actif, on retombe
 *  sur le premier sol en dessous → le voile reflète la visibilité du CONTREBAS (vu par le trou) au lieu
 *  d'un noir « inconnu » qui masquerait l'étage inférieur. Mono-niveau (pas de trou) ⇒ `activeZ`.
 *  Une seule vérité de voile pour le builder (surplomb PLEIN) et la teinte de visibilité du monde. */
export function fogFloorZ(scene: Scene, x: number, y: number, activeZ: number): number {
  for (let zz = activeZ; zz >= 0; zz--)
    if (scene.layers.some((l) => l.z === zz) && !estAbsent(tileAt(scene, x, y, zz))) return zz;
  return activeZ;
}

/** Coins de GRILLE (±0.5) des extrémités de l'ARÊTE `side` de la case (x,y), dans l'ordre HORAIRE de
 *  `tileEdge` (iso.ts) — même convention → un backend affine qui projette ces points retombe
 *  byte-identique sur la géométrie d'arête existante. */
function edgeCorners(x: number, y: number, side: CellSide): [{ x: number; y: number }, { x: number; y: number }] {
  const c = (gx: number, gy: number) => ({ x: gx - 0.5, y: gy - 0.5 });
  switch (side) {
    case 'N': return [c(x, y), c(x + 1, y)];
    case 'E': return [c(x + 1, y), c(x + 1, y + 1)];
    case 'S': return [c(x + 1, y + 1), c(x, y + 1)];
    default: return [c(x, y + 1), c(x, y)]; // O
  }
}

/** PORTÉE (m) au-delà de laquelle la rive libre d'un tablier reçoit un montant intermédiaire : deux cases à l'échelle
 *  de 2 m par case de toutes les scènes de jeu, la portée d'une poutre de plancher en bois entre deux poteaux. */
const PORTEE_M = 4;

/** Sens de parcours d'une arête, de son premier coin à son second (`edgeCorners`), qui mène à l'arête suivante de la
 *  même rive. */
const LONGE: Record<CellSide, [number, number]> = { N: [1, 0], E: [0, 1], S: [-1, 0], O: [0, -1] };

/** Le point `c` est-il à une case au plus du segment [a, b], sur chaque axe ? */
function aUneCase(c: { x: number; y: number }, [a, b]: readonly [{ x: number; y: number }, { x: number; y: number }]): boolean {
  const pres = (v: number, u: number, w: number) => v >= Math.min(u, w) - 1 - 1e-6 && v <= Math.max(u, w) + 1 + 1e-6;
  return pres(c.x, a.x, b.x) && pres(c.y, a.y, b.y);
}

/** MONTANTS des tabliers de la couche z (#3732), par case qui les porte (`x,y`). Un TABLIER est une case de surplomb
 *  (`overhangLowerHeight`) qui n'est pas le toit d'un bloc plein (`capsSolid` : la masse le porte, aucun montant dans le
 *  tunnel d'une porte) ; une RIVE, une suite droite de ses arêtes donnant sur le vide. Un coin de rive est PORTÉ par un
 *  mur de la couche du dessous à une case au plus (façade sous le bord, encorbellement), par une case de la couche qui
 *  n'est pas un tablier (sa paroi descend pleine) ou par un sol inférieur qui touche ce coin et monte jusqu'au dessous de
 *  la dalle (bloc plein, culée de pont). Chaque rive reçoit un montant à chacune de ses extrémités que rien ne porte, sauf
 *  dans un angle rentrant, que la dalle reprend au-delà (une trémie), puis un montant intermédiaire là où deux appuis
 *  consécutifs sont à plus de `PORTEE_M`. Un montant va du DESSOUS de la dalle jusqu'à la surface inférieure. */
export function montantsDeLaCouche(scene: SceneDuVolume, z: number): Map<string, Face[]> {
  const out = new Map<string, Face[]>();
  if (z <= 0) return out;
  const { w, h } = scene.dimensions;
  const tabliers = new Map<string, { sousDalle: number; bas: number }>();
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const bas = overhangLowerHeight(scene, x, y, z);
      if (bas == null || estAbsent(tileAt(scene, x, y, z)) || capsSolid(scene, x, y, z)) continue;
      tabliers.set(`${x},${y}`, { sousDalle: displayHeightAt(scene, x, y, z) - DECK_THICKNESS_M, bas });
    }
  const rive = (x: number, y: number, side: CellSide): boolean => {
    const [dx, dy] = NEIGHBOURS[side];
    return tabliers.has(`${x},${y}`) && estAbsent(tileAt(scene, x + dx, y + dy, z));
  };
  const murs = (scene.walls ?? []).filter((m) => (m.z ?? 0) === z - 1).map(wallEnds);
  const dessous = scene.layers.filter((l) => l.z < z).map((l) => l.z);
  const autour = (c: { x: number; y: number }): [number, number][] =>
    [[c.x - 0.5, c.y - 0.5], [c.x + 0.5, c.y - 0.5], [c.x - 0.5, c.y + 0.5], [c.x + 0.5, c.y + 0.5]];
  const porte = (c: { x: number; y: number }, sousDalle: number): boolean =>
    murs.some((m) => aUneCase(c, m))
    || autour(c).some(([x, y]) => (presenteDansLaGrille(scene, x, y, z) && !tabliers.has(`${x},${y}`))
      || dessous.some((zz) => presenteDansLaGrille(scene, x, y, zz) && displayHeightAt(scene, x, y, zz) >= sousDalle));
  const rentrant = (c: { x: number; y: number }): boolean => autour(c).filter(([x, y]) => presenteDansLaGrille(scene, x, y, z)).length === 3;
  const mpt = sceneMetresPerTile(scene);
  const poses = new Set<string>();
  for (const cle of tabliers.keys()) {
    const [x0, y0] = cle.split(',').map(Number);
    for (const side of SIDES) {
      const [tx, ty] = LONGE[side];
      if (!rive(x0, y0, side) || rive(x0 - tx, y0 - ty, side)) continue; // pas le début d'une rive
      const cases: [number, number][] = [];
      for (let x = x0, y = y0; rive(x, y, side); x += tx, y += ty) cases.push([x, y]);
      const n = cases.length;
      const coins = [edgeCorners(...cases[0], side)[0], ...cases.map(([x, y]) => edgeCorners(x, y, side)[1])];
      const porteuse = (i: number): [number, number] => cases[Math.max(0, i - 1)];
      const tablier = (i: number) => tabliers.get(porteuse(i).join(','))!;
      const portes = coins.map((c, i) => porte(c, tablier(i).sousDalle));
      const montants = [0, n].filter((i) => !portes[i] && !rentrant(coins[i]));
      const appuis = coins.flatMap((_, i) => (portes[i] || i === 0 || i === n ? [i] : []));
      for (let k = 1; k < appuis.length; k++) {
        const [a, b] = [appuis[k - 1], appuis[k]];
        const travees = Math.ceil(((b - a) * mpt) / PORTEE_M - 1e-9);
        for (let j = 1; j < travees; j++) montants.push(a + Math.round((j * (b - a)) / travees));
      }
      for (const i of montants) {
        const c = coins[i];
        const k = `${c.x},${c.y}`;
        if (poses.has(k)) continue;
        poses.add(k);
        const { sousDalle, bas } = tablier(i);
        const cleCase = porteuse(i).join(',');
        const faces = out.get(cleCase) ?? out.set(cleCase, []).get(cleCase)!;
        faces.push({
          poly: [{ ...c, h: sousDalle }, { ...c, h: bas }],
          side,
          material: { domain: 'relief', id: scene.reliefDefaults.pilier.id, part: 'pilier' },
          oriented: false, // MONTANT : deux points, aucun dehors à porter
        });
      }
    }
  }
  return out;
}

/** Faces d'une tuile de sol, dans l'ORDRE DE PEINTURE (`piliers`, les montants de la case — `montantsDeLaCouche` —,
 *  les plus en arrière, ils tombent sous la dalle, puis parois de relief qui descendent SOUS le sol, losange de base,
 *  wedges par-dessus). null si la tuile est ABSENTE (étage non construit → transparente, on voit le dessous). */
export function floorFaces(scene: SceneDuVolume, x: number, y: number, z: number, overhang: boolean, piliers: readonly Face[]): Face[] | null {
  const terrain = tileAt(scene, x, y, z);
  if (estAbsent(terrain)) return null;
  const self = displayHeightAt(scene, x, y, z); // AFFICHAGE (bloc plein `solidHeightM` compris) — jamais lu par le combat
  const solidBlock = terrainSolidHeightM(terrain) > 0; // mur (terrain à bloc plein) → flancs en PIERRE, pas en terre

  const faces: Face[] = [...piliers];

  // PAROIS : sur chaque arête, la face verticale qui comble l'écart entre le bord du dessus de la case et celui de sa
  // voisine (`profilDArete`), là où la case est la plus haute — falaise vers une voisine qu'on ne rejoint pas à pied,
  // contremarche ou talus vers une voisine qu'on rejoint (le dessus raccorde les centres, le long d'une volée sur un sol
  // bâti, `./pente`). Un bord de surplomb donnant sur le VIDE se rend en DALLE FINE (`deck`, épaisseur DECK_THICKNESS_M) :
  // la route du dessous reste visible. TOIT D'UN BLOC PLEIN (chemin de ronde posé DIRECTEMENT sur la masse `mur`) : le
  // bloc dessine déjà toutes ses parois, celles du sol du dessus seraient redondantes et recouvriraient une rampe z0
  // posée devant.
  const dessus = dessusDe(scene, x, y, z);
  const roofOfSolid = capsSolidDirect(scene, x, y, z);
  if (!roofOfSolid) for (const side of SIDES) {
    const [dx, dy] = NEIGHBOURS[side];
    const deck = overhang && estAbsent(tileAt(scene, x + dx, y + dy, z));
    const voisine = !deck && presenteDansLaGrille(scene, x + dx, y + dy, z) ? dessusDe(scene, x + dx, y + dy, z) : null;
    const plancher = displayHeightAt(scene, x + dx, y + dy, z);
    const lien = voisine != null && rejointAPied(scene, x, y, x + dx, y + dy, z);
    // La matière vient de la DONNÉE (#1691) : le flanc d'un BLOC PLEIN est celui de SON terrain (`terrains.json ›
    // matiere`), la contremarche d'un sol bâti vers une voisine qu'on rejoint est son terrain, toute autre paroi prend la
    // matière que la SCÈNE pose pour cette partie. Aucun repli : ces sources sont exigées au parse.
    const material: Face['material'] = solidBlock
      ? { domain: 'relief', id: terrainMatiere(terrain)!, part: 'cliff' }
      : lien && terrainBuilt(terrain)
        ? { domain: 'terrain', id: terrain }
        : { domain: 'relief', id: scene.reliefDefaults[deck ? 'deck' : lien ? 'ramp' : 'cliff'].id, part: deck ? 'deck' : lien ? 'ramp' : 'cliff' };
    const [A, B] = edgeCorners(x, y, side);
    const haut = profilDArete(dessus, A, B);
    const bas = deck
      ? haut.map(([a, b]): [number, number] => [a - DECK_THICKNESS_M, b - DECK_THICKNESS_M])
      : voisine ? profilDArete(voisine, A, B) : haut.map((): [number, number] => [plancher, plancher]);
    for (const poly of parois(A, B, haut, bas)) faces.push({ poly, side, material, oriented: false }); // paroi OUVERTE
  }

  // DESSUS (matériau = id du terrain) : la dalle de la case à sa hauteur, ou ses marches et sa pente (`./pente`). SAUF
  // le dessus d'un BLOC PLEIN COIFFÉ par un sol supérieur (chemin de ronde) : redondant, il créerait la « double dalle ».
  if (!(solidBlock && cappedAbove(scene, x, y, z))) faces.push(...facesDuDessus(dessus, terrain));

  // WEDGES de raccord de terrain : trapèze sur l'arête faisant face à chaque voisin de plus haute précédence, inset de
  // 0.4 vers le centre de la case, sur une dalle plate seulement.
  if (!dessus.pente) for (const { dir, terrain: nt } of edgeBlends(scene, x, y, z)) {
    const [A, B] = edgeCorners(x, y, dir);
    const in40 = (p: { x: number; y: number }) => ({ x: p.x + (x - p.x) * 0.4, y: p.y + (y - p.y) * 0.4, h: self });
    faces.push({
      poly: [{ ...A, h: self }, { ...B, h: self }, in40(B), in40(A)],
      side: dir,
      material: { domain: 'terrain', id: nt, part: 'wedge' },
      oriented: false,
    });
  }
  return faces;
}

/** Vérité de JEU pilotant la sélection des couches (PAS une caméra) : `activeZ` = étage de la zone
 *  active (combattant actif / groupe), `viewZ` = ISOLEMENT d'un seul étage — chemin de PRODUCTION (la
 *  vue du dessus et la minimap n'affichent qu'un plancher, l'appelant y passe l'étage actif) autant que
 *  d'inspection (`viewLevel`). `null` ⇒ l'étage actif et le contrebas, le contexte utile de l'iso.
 *  `allies` = positions du groupe : vérité de CUTAWAY (un ornement de faîte est masqué quand son toit
 *  est levé pour montrer l'intérieur — MÊME `roofHidden` que `buildRoofs`) ; n'active PAS le tri par
 *  couche (seuls `activeZ`/`viewZ` le font), donc le POV peut le fournir sans culler ses props d'étage. */
export interface FloorView {
  activeZ?: number;
  viewZ?: number | null;
  allies?: { x: number; y: number }[];
}

/** GÉOMÉTRIE des sols + la RÈGLE de vue de chacun (ses `visKeys`) — dérivée UNE fois par scène × étage
 *  rendu, jamais au pas (#808). Couches émises : l'ACTIVE + celles du DESSOUS (z ≤ activeZ) — d'en haut
 *  on voit le contrebas par le puits ; d'en bas on ne dessine pas les étages pleins au-dessus.
 *  AU-DESSUS de la zone active, SEULS les SURPLOMBS (tablier/loge) sont émis, tagués `ghost` (silhouette
 *  translucide côté stage), borné aux scènes multi-couches. */
function floorGeometry(scene: Scene, view: FloorView | undefined): Viewed<FloorEl>[] {
  const activeZ = view?.activeZ ?? 0;
  const viewZ = view?.viewZ ?? null;
  const { w, h } = scene.dimensions;
  const multiLayer = scene.layers.length > 1;
  const out: Viewed<FloorEl>[] = [];
  for (const lvl of scene.layers) {
    if (viewZ != null && lvl.z !== viewZ) continue; // isole : seule la couche isolée
    const layerGhost = viewZ == null && lvl.z > activeZ; // couche au-dessus de la zone active
    if (layerGhost && !multiLayer) continue;
    const montants = montantsDeLaCouche(scene, lvl.z);
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const overhang = isOverhang(scene, x, y, lvl.z);
        // Le TOIT d'un bloc plein (chemin de ronde sur le mur) n'est pas un surplomb flottant → jamais
        // fantôme : dessiné opaque comme le bloc qu'il coiffe, même vu d'un étage inférieur.
        const caps = capsSolid(scene, x, y, lvl.z);
        const ghost = layerGhost && !caps; // tablier au-dessus de la zone active → fantôme ; pas un toit de bloc
        if (ghost && !overhang) continue; // au-dessus : SEULEMENT les surplombs
        const faces = floorFaces(scene, x, y, lvl.z, overhang, montants.get(`${x},${y}`) ?? []);
        if (!faces) continue;
        // RÈGLE GÉNÉRALE du surplomb : il ne s'efface (fantôme translucide) que pour ne pas masquer une
        // SURFACE VISIBLE en dessous. Là où l'étage du dessous n'est PAS visible (occulté/brouillard),
        // rien à protéger → surplomb PLEIN : dessiné opaque comme la structure qu'on perçoit (un rempart
        // en bord de carte) et AU-DESSUS du voile, au lieu d'être mangé par l'ombre.
        //
        // BLOC SOLIDE (mur : terrain à `solidHeightM`) : OPAQUE → jamais « visible » lui-même (le rayon
        // vers lui est bloqué par lui-même, son intérieur n'est pas éclairé). Comme un WallSeg (cf.
        // `buildWalls`), on le dessine AU-DESSUS du voile — structure PERÇUE, opaque — dès qu'une case
        // OUVERTE qu'il borde est en vue ; sinon il serait grisé sous la brume alors qu'on le voit se
        // dresser devant soi. `!ghost` : au-dessus de la zone active, seul le surplomb PLEIN décide.
        // Le TOIT d'un bloc plein (`caps`) suit la même règle : perçu (opaque, au-dessus du voile) dès
        // qu'une case ouverte QU'IL BORDE — à son étage OU à celui du bloc en dessous (la cour au pied du
        // mur) — est en vue, sinon le chemin de ronde serait grisé alors qu'on voit le rempart d'en bas.
        const perceivable = terrainSolidHeightM(tileAt(scene, x, y, lvl.z)) > 0 || caps;
        const neighbourKeys: string[] = [];
        if (!ghost && perceivable)
          for (const s of SIDES) {
            const [dx, dy] = NEIGHBOURS[s];
            neighbourKeys.push(`${x + dx},${y + dy},${lvl.z}`);
            if (caps) neighbourKeys.push(`${x + dx},${y + dy},${lvl.z - 1}`);
          }
        out.push({
          off: {
            kind: 'floor',
            key: `floor:${x},${y},${lvl.z}`,
            cell: { x, y, z: lvl.z },
            faces,
            states: { visible: false, overhang, ghost, solidOverhang: false },
          },
          rule: ghost
            ? { kind: 'horsVue', key: `${x},${y},${fogFloorZ(scene, x, y, activeZ)}` }
            : neighbourKeys.length
              ? { kind: 'enVue', keys: neighbourKeys }
              : { kind: 'jamais' },
        });
      }
  }
  return out;
}

/** Éléments `floor` de la scène. `visible` absent ⇒ tout visible (éditeur/QC). La GÉOMÉTRIE est
 *  mémoïsée (`viewedBuilder`) : un pas qui ne change que le brouillard ne re-dérive AUCUNE face — il ne
 *  bascule que la vérité de vue des sols concernés, et rend le TABLEAU PRÉCÉDENT si aucun n'a bougé. */
export const buildFloors: (scene: Scene, visible?: ReadonlySet<string>, view?: FloorView) => FloorEl[] =
  viewedBuilder<FloorEl, FloorView>({
    derive: floorGeometry,
    key: (view) => `${view?.activeZ ?? 0}|${view?.viewZ ?? null}`,
    // Vérité VRAIE = dessiné AU-DESSUS du voile ; sur un FANTÔME c'est le surplomb PLEIN (opaque, il ne
    // protège plus rien en dessous), les deux vérités du sol n'en font qu'UNE (cf. géométrie ci-dessus).
    withTruth: (off) => ({
      ...off,
      states: { ...off.states, visible: true, ...(off.states.ghost ? { solidOverhang: true } : {}) },
    }),
  });

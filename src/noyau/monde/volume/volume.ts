/**
 * LE VOLUME DU MONDE d'une scène (#3476, #3948), que tout hôte du noyau dessine : les faces des builders purs,
 * triangulées (`facesGeometry`), orientées (`trianglesOrientes`) et colorées depuis la donnée, en morceaux à empreinte,
 * avec la hauteur de la surface de chaque case de chaque couche, et le masque de ce qu'un regard en retire. Repère des builders : X = est, Y = haut, Z = sud, en mètres, la case
 * (x, y) centrée sur (x·m, y·m) où m = `metresParCase`.
 */
import { CHAMPS_DES_COURONNES, CHAMPS_DES_TOITS, CHAMPS_DU_VOLUME, PREFIXE_TUILE_EFFONDREE, crenellatedAt, heightAt, piedDeLArete, sceneMetresPerTile, tileAt, tileCollapsed, tuilesEffondreesSignature, wallEnds, type CellSide, type Scene, type SceneDesCouronnes, type SceneDesToits, type SceneDuVolume, type SceneEntity, type WallSeg } from '../scene';
import { entityBlockedAt } from '../sceneRules';
import { versionDesDatasets } from '../../../data/versionDataset';
import { terrainAbsent, terrainOverlayProp, terrainsAvecGlyphe } from '../terrain';
import { garanti } from '../../../lib/garanti';
import { tableTotale } from '../../../lib/tableTotale';
import { facesDuDessus } from './pente';
import { parseHex } from '../../../lib/couleurHex';
import { MISSING_TONE } from './missing';
import { NEIGHBOURS, capsSolid, floorFaces, isOverhang, montantsDeLaCouche } from './floors';
import { facesDuDecor } from './propVolumes';
import { ancreDuDecor } from '../footprint';
import { piedDuDecor } from '../poseDuDecor';
import { matieresDe } from '../../../data';
import { hash32, hash32AuMillieme } from '../../../data/hash';
import { jsonCanonique } from '../../../lib/jsonCanonique.mjs';
import { enBase64 } from '../../../lib/base64';
import { couleurDeMatiere, recetteDeMatiere, tintVarFactor } from './matieres';
import { faceDepthM } from './profondeur';
import { crownFaces, cretesDePerimetre } from './creneaux';
import { edgeAppearance } from './structures';
import { edgeKey, facadeEdges } from '../facades';
import { WALL_H_M } from '../iso';
import { centreDeLaCarte, coplanarRanks, faceGeometry, faceQuadsOriented, facesGeometry, trianglesOrientes, type FaceGeom } from './worldTris';
import { buildRoofs, nappeKey } from './toits';
import { spaceCellKey } from './architectureVisibility';
import { aretesHorsDesNavires, provenanceDesNavires } from '../../planDeNavire';
import { memoByDeps, memoByRefDeps } from '../sceneMemo';
import { mapLights } from '../vision';
import type { Face } from './types';
import type { MaterialRef } from '../../../data/materials.types';

/** D'où viennent des faces du volume : `navire`, l'id de l'entité du navire dont les ponts les posent
 *  (`provenanceDesNavires`), que l'hôte touche sans les peindre, le navire se montrant par son modèle 3D ; `flottaison`,
 *  l'id du navire dont elles sont la mer, sur l'emprise de ses ponts à sa flottaison, que l'hôte peint hors de la coque
 *  de son modèle et que le rayon du pointeur traverse ; `luminaire`, celles d'un décor qui éclaire (`mapLights`), dont
 *  l'hôte ne porte pas l'ombre sous la lampe d'un foyer (#3811). */
interface Provenance {
  navire?: string;
  flottaison?: string;
  luminaire?: true;
}

/** Les triangles d'une matière du volume, nommée `<domaine>--<id>` (`nomDeMatiere`) : ses sommets de `debut` inclus à
 *  `fin` exclu, et leur provenance. */
interface SurfaceDuVolume extends Provenance {
  matiere: string;
  debut: number;
  fin: number;
}

/** Une face listée du volume : sa case et sa couche, celle de sa teinte, et sa provenance. */
interface FaceListee extends Provenance {
  face: Face;
  cell: { x: number; y: number; z: number };
}

/** Le genre d'un morceau du volume : `sol` (sol, relief, raccords, piliers), `pose` (mer, décors et crêtes). */
type Genre = 'sol' | 'pose';

/** Le côté, en cases, du bloc carré de cases d'une couche que couvre un morceau du volume. */
export const CASES_PAR_MORCEAU = 8;

/** Le bloc `<z>/<bx>/<by>` de la case `c` d'une couche, au grain `CASES_PAR_MORCEAU` (`MorceauDuMonde.cle`, `AreteDessinee.bloc`). */
export function blocDeLaCase(c: { x: number; y: number; z: number }): string {
  return `${c.z}/${Math.floor(c.x / CASES_PAR_MORCEAU)}/${Math.floor(c.y / CASES_PAR_MORCEAU)}`;
}

/** L'octet du masque d'une case retirée ; 0 pour une case montrée. */
const RETIREE = 255;

/** La mer qui porte un navire posé, sur sa flottaison : le terrain du glyphe `~` des plans. */
const MER = garanti(terrainsAvecGlyphe()['~'], '~', 'terrain de la mer');

/**
 * @contrat Monde
 * Des faces du monde triangulées, en tableaux plats que l'hôte charge tels quels.
 */
interface GeometrieDuMonde {
  /**
   * 3 nombres par sommet, 3 sommets par triangle, dans le sens trigonométrique vu du dehors. Chaque triangle porte le
   * dehors que lui donne la loi d'orientation (`orienterPoly`, `src/noyau/monde/volume/worldTris.ts`) : vers le haut
   * une face horizontale, hors de la carte une face verticale ouverte (une falaise, une paroi), qui peut donc tourner
   * le dos à la caméra ; le monde de Godot rend et touche le volume des deux côtés.
   */
  positions: number[];
  /** Normale unitaire de la face de chaque sommet, 3 nombres par sommet. */
  normales: number[];
  /** Couleur sRGB opaque de chaque sommet, canaux dans [0, 1], 4 nombres par sommet (rouge, vert, bleu, alpha). */
  couleurs: number[];
  /**
   * La case de chaque triangle, sa couche comprise, 3 nombres par triangle (`x`, `y`, `z`), dans l'ordre des
   * triangles : toujours sur la carte, la case de la carte la plus proche pour une face posée hors d'elle (un décor
   * hors de la carte, le pont ou la mer d'un navire posé au bord). Dans un morceau (`MorceauDuMonde`), sa couche est
   * une couche de la scène (`caseSurLaCarte`).
   */
  cases: number[];
  /**
   * une par matière (et provenance), ses sommets de `debut` à `fin` exclu, dans l'ordre des triangles. Les triangles
   * d'une même matière se suivent (`surfaces`) ; le sol et les crêtes d'une case que posent les ponts d'un navire de
   * la scène
   * (`provenanceDesNavires`, `src/noyau/planDeNavire.ts`) forment des surfaces à part, qui portent `navire`, l'id de
   * l'entité du navire : le monde les touche (`cases`, forme du rayon du pointeur et de la marche de l'œil) sans les
   * peindre (`VolumeDeScene._maillage_de`), le navire se montrant par son modèle (section « Corps d'un combattant »,
   * `navires`) ; ses décors restent peints ; sur sa flottaison, le rectangle de ses ponts à la couche de son pont le
   * plus bas, chaque case est sa mer (`MER`, le terrain du glyphe `~`) à la hauteur 0, à la place du sol de la scène
   * hors de ses ponts : des surfaces à part, qui portent `flottaison`, l'id de l'entité du navire, que le rayon du
   * pointeur traverse et que le monde peint hors de la coque du modèle posé, sous la hauteur 0
   * (`VolumeDeScene.border_la_mer`,
   * `MontageDeVehicule.contour_sous`, recette `projet/recettes/coupe-du-navire.gd`) ; les faces d'un décor qui éclaire
   * (`mapLights`, `src/noyau/monde/vision.ts`) forment des surfaces à part, qui portent `luminaire: true` : le monde
   * les peint, et n'en porte pas l'ombre sous la lampe d'un foyer, que son luminaire masquerait
   * (`VolumeDeScene._morceau`, section « Lumière ») ; une matière se nomme
   * `<domaine>--<id>` (`terrain--herbe`, `relief--pierre`).
   */
  surfaces: SurfaceDuVolume[];
}

/**
 * @contrat Monde
 * Un morceau du volume (`MorceauDuMonde`) : les faces d'un genre des cases d'un bloc de `CASES_PAR_MORCEAU` ×
 * `CASES_PAR_MORCEAU` cases d'une couche de la scène, triangulées avec tout le volume. La face d'une case va au morceau
 * de sa case sur la carte (`caseSurLaCarte`, `cases`) : le sol, la mer, le décor à sa case d'ancrage, la crête à la case
 * crénelée qu'elle ceinture (`CreteDePerimetre.case`), quand la case de son arête peut sortir de la carte ; une face
 * d'une couche absente de la scène (`Scene.layers`) va à la plus basse couche au-dessus d'elle, une face au-dessus de
 * la plus haute couche à aucun.
 */
export interface MorceauDuMonde extends GeometrieDuMonde {
  /**
   * `<genre>/<z>/<bx>/<by>` : le genre (`sol` : sol, relief, raccords, piliers ; `pose` : mer, décors et crêtes), puis
   * le bloc de sa case sur la carte (`blocDeLaCase`).
   */
  cle: string;
  /**
   * L'empreinte de son contenu (`hash32` de ses surfaces et de sa rangée, poursuivi par `hash32AuMillieme` sur ses
   * tableaux, en base 36) : elle ne bouge que si l'une de ses faces change.
   */
  empreinte: string;
  /**
   * La première rangée, dans le masque du retrait (`RetraitDuMonde`), du plan de son genre et de sa couche : la case
   * `(x, y)` y est l'octet de la rangée `rangee + y`, colonne `x`.
   */
  rangee: number;
}

/**
 * @contrat Monde
 * Le volume du monde (`volumeDuMonde`, `src/noyau/monde/volume/volume.ts`) est la géométrie que les builders purs du
 * noyau dérivent de la scène, triangulée, orientée et colorée depuis la donnée : le sol de toutes les couches (terrain
 * par case et sa variance de teinte, relief, raccords, piliers), la crête qui ceinture chaque zone crénelée
 * (`cretesDePerimetre`, `src/noyau/monde/volume/creneaux.ts`, matière `structure--<id>` de l'apparence que porte
 * `Layer.crenellated`) et les décors, chacun modelé par la recette de son type (`facesDuDecor`,
 * `src/noyau/monde/volume/propVolumes.ts`) : celui que le terrain pose sur chacune de ses cases (`terrainOverlayProp`,
 * les arbres du bois) et les entités `prop` de la scène, à la couleur de leur matériau de décor (matière `prop--<id>`).
 * Il se publie dans le repère des builders, en mètres : X à l'est, Y en haut, Z au sud, la case (x, y) centrée sur (x ·
 * `metresParCase`, y · `metresParCase`). Il ne dépend que de la scène : ce qu'un regard en retire est un masque
 * (`RetraitDuMonde`).
 *
 * Les faces verticales du volume, des nappes et des couronnes prennent l'épaisseur que leur matière authore
 * (`faceDepthM`, `src/noyau/monde/volume/profondeur.ts`).
 */
export interface VolumeDuMonde {
  /** L'échelle de la scène, en mètres par case (`sceneMetresPerTile`). */
  metresParCase: number;
  /** Hauteur (m) de la surface de chaque case, par couche : `rangees[y][x]` (`heightAt`). */
  hauteurs: { z: number; rangees: number[][] }[];
  /** Ses morceaux (`MorceauDuMonde`), aucun vide ; chaque face du volume est dans un seul. */
  morceaux: MorceauDuMonde[];
}

/**
 * @contrat Monde
 * Le masque de ce qu'un regard retire du volume (`retraitDuMonde`) : des rangées d'octets, un plan de `h` rangées par
 * couche et par genre, dans l'ordre des couches de `hauteurs`. La couche d'indice `i` a son plan `sol` aux rangées
 * `2·i·h` à `2·i·h + h − 1`, son plan `pose` aux rangées `(2·i + 1)·h` à `(2·i + 2)·h − 1`. Une case retirée vaut
 * 255, une case montrée 0. Au plan `pose`, une case est retirée si elle est au couvercle ou au-dessus de la couche
 * active ; au plan `sol`, si elle est au couvercle, ou au-dessus de la couche active sans coiffer un bloc plein
 * (`capsSolid`, `src/noyau/monde/volume/floors.ts` : le chemin de ronde reste montré). Le plan `pose` porte la mer
 * d'un navire : elle suit la couche de son pont, bloc plein dessous ou non.
 */
export interface RetraitDuMonde {
  /** Les octets du masque, rangée après rangée, en base64. */
  masque: string;
  /** La largeur d'une rangée, en octets : la largeur `w` de la scène, en cases. */
  largeur: number;
  /** Le nombre total de rangées : deux plans de `h` rangées par couche. */
  rangees: number;
}

/**
 * @contrat Monde
 * La nappe de toit d'une masse de bâtiment (`nappeKey`) : ses pans et ses pignons (`buildRoofs`), que l'hôte lève
 * quand le groupe est dessous (`toitsLeves`) ; une couronne crénelée a la même forme.
 */
export interface NappeDuMonde extends GeometrieDuMonde {
  /** Sa clé : `nappeKey` pour une nappe, `edgeKey` pour une couronne. */
  cle: string;
  /** L'empreinte de son contenu (`hash32` de ses surfaces, poursuivi par `hash32AuMillieme` sur ses tableaux, en base 36). */
  empreinte: string;
}

/** Le nom d'une matière dans le volume : son domaine et son id. */
const nomDeMatiere = ({ domain, id }: MaterialRef): string => `${domain}--${id}`;

/** Les noms des matières de décor du monde (domaine `prop` de `materials.json`), dont un modèle 3D habille ses surfaces. */
export const matieresDeDecor = (): string[] => matieresDe('prop').map(({ id }) => nomDeMatiere({ domain: 'prop', id }));

/** Trois décimales : le millimètre, et le millième d'un canal de couleur. */
const arrondi = (v: number): number => Math.round(v * 1000) / 1000 + 0;

/** L'empreinte des entités `prop` de la scène, celles que le volume pose (`volumeDepuis`), chacune entière : elle
 *  change quand un décor est ajouté, retiré ou changé en jeu. PUR. */
export function empreinteDesDecors(scene: Scene): string {
  return hash32(...scene.entities.flatMap((e) => (e.kind === 'prop' ? [jsonCanonique(e)] : []))).toString(36);
}

/** Les faces `listees` triangulées ensemble (`facesGeometry`, le rang coplanaire sur toute la liste), chacune avec sa
 *  géométrie. */
function triangulees<F extends FaceListee>(scene: Pick<Scene, 'metresPerTile'>, listees: readonly F[]): (F & { geom: FaceGeom })[] {
  const geoms = facesGeometry(listees.map((f) => f.face), sceneMetresPerTile(scene), faceDepthM);
  return listees.map((f, i) => ({ ...f, geom: geoms[i] }));
}

/** Une face triangulée (`triangulees`) et la case `surLaCarte` où elle se range sur la carte. */
type FaceRangee = FaceListee & { geom: FaceGeom; surLaCarte: { x: number; y: number; z: number } };

/** Les faces `faces` déjà triangulées et rangées (`FaceRangee`), orientées (`trianglesOrientes`) et colorées depuis la
 *  donnée, chacune à la variance de teinte de sa case, rangée à sa case `surLaCarte`, les triangles d'une même matière à la
 *  suite. */
function emballer(scene: Pick<Scene, 'dimensions' | 'metresPerTile'>, faces: readonly FaceRangee[]): GeometrieDuMonde {
  const centre = centreDeLaCarte(scene.dimensions, sceneMetresPerTile(scene));
  const parMatiere = new Map<string, Provenance & { matiere: string; faces: number[] }>();
  faces.forEach(({ face, navire, flottaison, luminaire }, i) => {
    const matiere = nomDeMatiere(face.material);
    const cle = `${navire ?? ''}|${flottaison ?? ''}|${luminaire ?? ''}|${matiere}`;
    const groupe = parMatiere.get(cle) ?? parMatiere.set(cle, { matiere, ...(navire ? { navire } : {}), ...(flottaison ? { flottaison } : {}), ...(luminaire ? { luminaire } : {}), faces: [] }).get(cle)!;
    groupe.faces.push(i);
  });
  const positions: number[] = [];
  const normales: number[] = [];
  const couleurs: number[] = [];
  const cases: number[] = [];
  const surfaces: SurfaceDuVolume[] = [];
  for (const { faces: indices, ...surface } of parMatiere.values()) {
    const debut = positions.length / 3;
    for (const i of indices) {
      const m = faces[i].face.material;
      const [r, v, b] = parseHex(couleurDeMatiere(m)) ?? parseHex(MISSING_TONE)!;
      const k = tintVarFactor(recetteDeMatiere(m), faces[i].cell) / 255;
      const couleur = [...[r, v, b].map((c) => arrondi(Math.min(1, c * k))), 1];
      const { x, y, z } = faces[i].surLaCarte;
      for (const { sommets, normale } of trianglesOrientes(faces[i].geom, centre)) {
        const n = normale ?? { x: 0, y: 1, z: 0 };
        cases.push(x, y, z);
        for (const p of sommets) {
          positions.push(arrondi(p.x), arrondi(p.y), arrondi(p.z));
          normales.push(arrondi(n.x), arrondi(n.y), arrondi(n.z));
          couleurs.push(...couleur);
        }
      }
    }
    surfaces.push({ ...surface, debut, fin: positions.length / 3 });
  }
  return { positions, normales, couleurs, cases, surfaces };
}

/** L'empreinte d'une géométrie du monde et de sa rangée au masque, s'il en a une : `hash32` de ses surfaces et de sa
 *  rangée, poursuivi par `hash32AuMillieme` sur ses positions, ses normales, ses couleurs et ses cases, en base 36. */
function empreinteDe({ positions, normales, couleurs, cases, surfaces, rangee }: GeometrieDuMonde & { rangee?: number }): string {
  const h = [positions, normales, couleurs, cases].reduce((acc, t) => hash32AuMillieme(t, acc), hash32(jsonCanonique(surfaces), rangee ?? ''));
  return h.toString(36);
}

/** La case `(x, y)` de la carte de `scene` la plus proche de `cell`, à la couche `z` de `cell`. */
const caseBornee = (scene: Pick<Scene, 'dimensions'>, { x, y, z }: { x: number; y: number; z: number }): { x: number; y: number; z: number } => {
  const { w, h } = scene.dimensions;
  return { x: Math.min(Math.max(x, 0), w - 1), y: Math.min(Math.max(y, 0), h - 1), z };
};

/** La case de la carte de `scene` la plus proche de `cell` (`caseBornee`), à la plus basse couche de la scène
 *  (`Scene.layers`) qui n'est pas sous la sienne : sa couche si la scène l'a ; `undefined` au-dessus de la plus haute. */
const caseSurLaCarte = (scene: SceneDuVolume, cell: { x: number; y: number; z: number }): { x: number; y: number; z: number } | undefined => {
  const z = Math.min(...scene.layers.map((l) => l.z).filter((lz) => lz >= cell.z));
  return Number.isFinite(z) ? { ...caseBornee(scene, cell), z } : undefined;
};

/** La rangée du masque où commence le plan du genre `genre` de la couche d'indice `i` (`scene.layers`), pour une scène
 *  de `h` rangées de cases. */
const rangeeDuPlan = (i: number, genre: Genre, h: number): number => (2 * i + (genre === 'pose' ? 1 : 0)) * h;

/** Le rayon (distance de Tchebychev, en cases) des lectures des faces de sol d'une case : `pente.ts` `dessusDe`,
 *  `traverseeLeLongDe` ; `floors.ts` `floorFaces`. */
const RAYON_DU_SOL = 2;

type Case = Readonly<{ x: number; y: number; z: number }>;

/** Une face du volume à sa place : sa case, son genre et sa provenance. */
type FacePlacee = Readonly<FaceListee & { genre: Genre }>;

/** Les quads orientés d'une face (`faceQuadsOriented`). */
type QuadsDeFace = Readonly<ReturnType<typeof faceQuadsOriented>>;

/** Une face d'un morceau : sa case sur la carte, ses quads, et le rang de chacun d'eux (`coplanarRanks`). */
type FaceDuMorceau = FacePlacee & Readonly<{ surLaCarte: Case; quads: QuadsDeFace; rangs: readonly number[] }>;

/**
 * L'état d'où le volume d'une scène se reprend (`volumeDepuis`) : la scène vue par son volume (`SceneDuVolume`) dont il
 * est issu, les montants de chaque couche (`montantsDeLaCouche`, par case `x,y`), les cases bloquées par une entité
 * (`x,y,z`), par couche et par case les faces de sol et celles du décor du terrain, par entité (son `id`) son pied et
 * les faces de son décor, par crête (sa case et son arête) ses faces, par case de flottaison sa face de mer,
 * les quads de chaque face, et par morceau ses faces, leurs rangs et le morceau.
 */
export interface EtatDuVolume {
  readonly scene: Readonly<SceneDuVolume>;
  readonly montants: ReadonlyMap<number, ReadonlyMap<string, readonly Face[]>>;
  readonly bloquees: ReadonlySet<string>;
  readonly sols: ReadonlyMap<number, readonly (readonly Face[] | null)[]>;
  readonly decorsDuTerrain: ReadonlyMap<number, readonly (readonly Face[])[]>;
  readonly decorsDEntite: ReadonlyMap<string, DecorDEntite>;
  readonly cretes: ReadonlyMap<string, Readonly<{ canon: string; faces: readonly Face[] }>>;
  readonly mer: ReadonlyMap<string, readonly Face[]>;
  readonly quads: ReadonlyMap<Face, QuadsDeFace>;
  readonly morceaux: ReadonlyMap<string, Readonly<{ faces: readonly FaceDuMorceau[]; morceau: MorceauDuMonde }>>;
}

/** Le décor d'une entité `prop` : l'entité, son pied (`piedDuDecor`) et ses faces (`facesDuDecor`). */
type DecorDEntite = Readonly<{ entite: SceneEntity; pied: number; faces: readonly Face[] }>;

/** `a` et `b` sont-ils le même objet, sinon du même contenu (`jsonCanonique`) ? */
const memeObjet = (a: unknown, b: unknown): boolean => a === b || jsonCanonique(a) === jsonCanonique(b);

const memeCase = (a: Case, b: Case): boolean => a.x === b.x && a.y === b.y && a.z === b.z;

/** La reprise de `avant` vaut-elle pour `scene` : mêmes dimensions, échelle, matières de relief et suite des couches ? */
function memeCadre(avant: EtatDuVolume, scene: Readonly<SceneDuVolume>): boolean {
  const a = avant.scene;
  return a.dimensions.w === scene.dimensions.w && a.dimensions.h === scene.dimensions.h
    && sceneMetresPerTile(a) === sceneMetresPerTile(scene)
    && memeObjet(a.reliefDefaults, scene.reliefDefaults)
    && a.layers.length === scene.layers.length && a.layers.every((l, i) => l.z === scene.layers[i].z);
}

/** Les cases `x,y,z` des couches de `scene` que bloque une entité (`entityBlockedAt`). */
function casesBloquees(scene: Readonly<SceneDuVolume>): Set<string> {
  const { w, h } = scene.dimensions;
  const out = new Set<string>();
  for (const { z } of scene.layers)
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (entityBlockedAt(scene, x, y, z)) out.add(spaceCellKey(x, y, z));
  return out;
}

/** Les segments `walls` par arête (`edgeKey`), dans leur ordre. */
function parArete(walls: readonly WallSeg[]): Map<string, WallSeg[]> {
  const out = new Map<string, WallSeg[]>();
  for (const seg of walls) (out.get(edgeKey(seg)) ?? out.set(edgeKey(seg), []).get(edgeKey(seg))!).push(seg);
  return out;
}

/** Les cases `(x, y, z)` de `scene` dont le sol est à refaire depuis `avant` : dans toutes les couches, celles à
 *  `RAYON_DU_SOL` au plus d'une case dont la tuile, la hauteur, le crénelage, un segment de `walls` (même objet, sinon
 *  même contenu) ou le blocage par une entité diffère ; et celles dont les montants diffèrent par contenu. */
function solARefaire(avant: EtatDuVolume, scene: Readonly<SceneDuVolume>, montants: EtatDuVolume['montants'], bloquees: ReadonlySet<string>): (x: number, y: number, z: number) => boolean {
  const { w, h } = scene.dimensions;
  const a = avant.scene;
  const touchees: [number, number][] = [];
  scene.layers.forEach((couche, i) => {
    const { z } = couche;
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const change = (couche !== a.layers[i] && (tileAt(a, x, y, z) !== tileAt(scene, x, y, z) || heightAt(a, x, y, z) !== heightAt(scene, x, y, z) || crenellatedAt(a, x, y, z) !== crenellatedAt(scene, x, y, z)))
          || bloquees.has(spaceCellKey(x, y, z)) !== avant.bloquees.has(spaceCellKey(x, y, z));
        if (change) touchees.push([x, y]);
      }
  });
  if (a.walls !== scene.walls) {
    const [avantA, apresA] = [parArete(a.walls ?? []), parArete(scene.walls ?? [])];
    for (const cle of new Set([...avantA.keys(), ...apresA.keys()])) {
      const [sa, sb] = [avantA.get(cle) ?? [], apresA.get(cle) ?? []];
      if (sa.length === sb.length && sa.every((s, i) => memeObjet(s, sb[i]))) continue;
      for (const seg of [...sa, ...sb]) {
        touchees.push([seg.x, seg.y]);
        const voisine = NEIGHBOURS[seg.side as CellSide];
        if (voisine) touchees.push([seg.x + voisine[0], seg.y + voisine[1]]);
      }
    }
  }
  const marquees = new Uint8Array(w * h);
  for (const [cx, cy] of touchees)
    for (let y = Math.max(0, cy - RAYON_DU_SOL); y <= Math.min(h - 1, cy + RAYON_DU_SOL); y++)
      for (let x = Math.max(0, cx - RAYON_DU_SOL); x <= Math.min(w - 1, cx + RAYON_DU_SOL); x++) marquees[y * w + x] = 1;
  const montantsChanges = new Set<string>();
  for (const [z, parCase] of montants) {
    const anciens = avant.montants.get(z)!;
    for (const cle of new Set([...anciens.keys(), ...parCase.keys()]))
      if (jsonCanonique(anciens.get(cle) ?? []) !== jsonCanonique(parCase.get(cle) ?? [])) montantsChanges.add(`${cle},${z}`);
  }
  return (x, y, z) => marquees[y * w + x] === 1 || montantsChanges.has(spaceCellKey(x, y, z));
}

/** Les faces d'un morceau sont-elles les mêmes : mêmes objets `Face` dans le même ordre, mêmes cases, même provenance,
 *  mêmes rangs de leurs quads ? */
const memesFaces = (a: readonly FaceDuMorceau[], b: readonly FaceDuMorceau[]): boolean =>
  a.length === b.length && a.every((f, i) => {
    const g = b[i];
    return f.face === g.face && memeCase(f.cell, g.cell) && memeCase(f.surLaCarte, g.surLaCarte) && f.navire === g.navire && f.flottaison === g.flottaison
      && f.rangs.length === g.rangs.length && f.rangs.every((r, j) => r === g.rangs[j]);
  });

/** Les couches de `scene` vues par son volume, retenues par couches de la scène, tuiles effondrées
 *  (`tuilesEffondreesSignature`) et version des datasets (`terrainAbsent` lit les terrains). */
const couchesRetenues = memoByRefDeps<SceneDuVolume['layers'], SceneDuVolume['layers']>();

/** Les couches de `scene` vues par son volume : une tuile d'étage effondrée (`tileCollapsed`) y est absente
 *  (`terrainAbsent`), comme une case où rien n'est bâti, et garde sa crénelure ; sans tuile effondrée, les couches mêmes
 *  de la scène, et chaque couche sans tuile effondrée elle-même. */
const couchesDuVolume = (scene: Readonly<SceneDuVolume>): SceneDuVolume['layers'] => {
  const signature = tuilesEffondreesSignature(scene);
  if (!signature) return scene.layers;
  const { w } = scene.dimensions;
  return couchesRetenues(scene.layers, [signature, versionDesDatasets()], () => scene.layers.map((couche) => {
    const effondrees = couche.z > 0 ? couche.tiles.flatMap((_, i) => (tileCollapsed(scene, i % w, Math.floor(i / w), couche.z) ? [i] : [])) : [];
    if (!effondrees.length) return couche;
    const tiles = [...couche.tiles];
    for (const i of effondrees) tiles[i] = terrainAbsent();
    return { ...couche, tiles };
  }));
};

/** Le volume du monde de `entree` (`volumeDuMonde`), ses couches vues par lui (`couchesDuVolume`), et l'état d'où le
 *  suivant se reprend, calculé depuis `precedent` : `null`, ou un état d'un autre cadre (`memeCadre`), refait tout ;
 *  sinon, seul ce que la différence touche se refait.
 *  Le sol de chaque case de chaque couche (`floorFaces`), à refaire selon `solARefaire` ; la mer de la flottaison de
 *  chaque navire (`MER`, à la hauteur 0, à la place du sol de la scène hors de ses ponts) ; les crêtes des zones
 *  crénelées (`cretesDePerimetre`), reprises à contenu égal ; le décor que son terrain pose sur chaque case
 *  (`terrainOverlayProp`), repris à décor et hauteur égaux ; celui des entités `prop`, à leur ancre (`ancreDuDecor`) et
 *  à leur cap, sur leur pied (`piedDuDecor`), repris à entité et pied égaux. Le rang coplanaire se calcule sur toutes
 *  les faces ; chaque face va au morceau de sa case sur la carte (`caseSurLaCarte`) et de son genre, aucun au-dessus de
 *  la plus haute couche ; un morceau aux mêmes faces (`memesFaces`) est repris, les autres se triangulent. Le sol et
 *  les crêtes d'une case que les ponts d'un navire posent portent ce navire (`provenanceDesNavires`) ; ses décors,
 *  non ; les décors d'entité qui éclairent (`mapLights`) portent `luminaire`. `precedent` n'est jamais modifié. PUR. */
export function volumeDepuis(entree: Readonly<SceneDuVolume>, precedent: EtatDuVolume | null): { volume: VolumeDuMonde; etat: EtatDuVolume } {
  const scene: Readonly<SceneDuVolume> = { ...entree, layers: couchesDuVolume(entree) };
  const mpt = sceneMetresPerTile(scene);
  const { w, h } = scene.dimensions;
  const provenance = provenanceDesNavires(scene);
  const luminaires = new Set(mapLights(scene).map((source) => source.srcId));
  const avant = precedent && memeCadre(precedent, scene) ? precedent : null;
  const montants = new Map(scene.layers.map(({ z }) => [z, montantsDeLaCouche(scene, z)]));
  const bloquees = casesBloquees(scene);
  const aRefaire = avant ? solARefaire(avant, scene, montants, bloquees) : () => true;
  const parCase = <T>(f: (x: number, y: number, z: number, i: number) => T) => new Map(scene.layers.map(({ z }) => [z, Array.from({ length: w * h }, (_, i) => f(i % w, Math.floor(i / w), z, i))]));
  const sols = parCase((x, y, z, i) =>
    avant && !aRefaire(x, y, z) ? avant.sols.get(z)![i] : floorFaces(scene, x, y, z, isOverhang(scene, x, y, z), montants.get(z)!.get(`${x},${y}`) ?? []));
  const decorsDuTerrain = parCase((x, y, z, i): readonly Face[] => {
    const [decor, haut] = [terrainOverlayProp(tileAt(scene, x, y, z)), heightAt(scene, x, y, z)];
    if (avant && terrainOverlayProp(tileAt(avant.scene, x, y, z)) === decor && heightAt(avant.scene, x, y, z) === haut) return avant.decorsDuTerrain.get(z)![i];
    return facesDuDecor(decor, { ancre: { x, y }, baseHeightM: haut }, mpt) ?? [];
  });
  const decors = scene.entities.flatMap((ent): DecorDEntite[] => {
    if (ent.kind !== 'prop') return [];
    const pied = piedDuDecor(scene, ent);
    const ancien = avant?.decorsDEntite.get(ent.id);
    if (ancien && ancien.pied === pied && memeObjet(ancien.entite, ent)) return [ancien];
    return [{ entite: ent, pied, faces: facesDuDecor(ent.decor?.id, { ancre: ancreDuDecor(ent, mpt), ...(ent.facing ? { facing: ent.facing } : {}), baseHeightM: pied, entId: ent.id }, mpt) ?? [] }];
  });
  const mer = new Map([...provenance.flottaison.keys()].map((cle): [string, readonly Face[]] => {
    const [x, y] = cle.split(',').map(Number);
    return [cle, avant?.mer.get(cle) ?? facesDuDessus({ x, y, h: 0, quarts: [], pente: false, marches: false, divisions: 1 }, MER)];
  }));
  const cretes = cretesDePerimetre(scene).map((c) => {
    const cle = `${spaceCellKey(c.case.x, c.case.y, c.case.z)}|${edgeKey(c.arete)}`;
    const canon = jsonCanonique(c.faces);
    const ancienne = avant?.cretes.get(cle);
    return { cle, case: c.case, canon, faces: ancienne?.canon === canon ? ancienne.faces : c.faces };
  });

  const duNavire = (cell: Case): Provenance => {
    const navire = provenance.cases.get(spaceCellKey(cell.x, cell.y, cell.z));
    return navire ? { navire } : {};
  };
  const placees: FacePlacee[] = [];
  for (const { z } of scene.layers)
    sols.get(z)!.forEach((faces, i) => {
      const cell = { x: i % w, y: Math.floor(i / w), z };
      const cle = spaceCellKey(cell.x, cell.y, z);
      if (!faces || (!provenance.cases.has(cle) && provenance.flottaison.has(cle))) return;
      for (const face of faces) placees.push({ face, cell, ...duNavire(cell), genre: 'sol' });
    });
  for (const [cle, navire] of provenance.flottaison) {
    const [x, y, z] = cle.split(',').map(Number);
    for (const face of mer.get(cle)!) placees.push({ face, cell: { x, y, z }, flottaison: navire, genre: 'pose' });
  }
  for (const c of cretes) for (const face of c.faces) placees.push({ face, cell: c.case, ...duNavire(c.case), genre: 'pose' });
  for (const { z } of scene.layers)
    decorsDuTerrain.get(z)!.forEach((faces, i) => {
      const cell = { x: i % w, y: Math.floor(i / w), z };
      for (const face of faces) placees.push({ face, cell, genre: 'pose' });
    });
  for (const { entite, faces } of decors)
    for (const face of faces) placees.push({ face, cell: { ...entite.pos, z: entite.z ?? 0 }, ...(luminaires.has(entite.id) ? { luminaire: true as const } : {}), genre: 'pose' });

  const quads = new Map<Face, QuadsDeFace>();
  for (const { face } of placees) if (!quads.has(face)) quads.set(face, avant?.quads.get(face) ?? faceQuadsOriented(face, mpt, faceDepthM(face)));
  const rangs = coplanarRanks(placees.flatMap(({ face }) => quads.get(face)!.quads));
  const indiceDe = new Map(scene.layers.map((l, i) => [l.z, i]));
  const parMorceau = new Map<string, { genre: Genre; z: number; faces: FaceDuMorceau[] }>();
  let k = 0;
  for (const f of placees) {
    const q = quads.get(f.face)!;
    const r = rangs.slice(k, (k += q.quads.length));
    const surLaCarte = caseSurLaCarte(scene, f.cell);
    if (!surLaCarte) continue;
    const cle = `${f.genre}/${blocDeLaCase(surLaCarte)}`;
    (parMorceau.get(cle) ?? parMorceau.set(cle, { genre: f.genre, z: surLaCarte.z, faces: [] }).get(cle)!).faces.push({ ...f, surLaCarte, quads: q, rangs: r });
  }
  const morceaux = new Map([...parMorceau].map(([cle, { genre, z, faces }]) => {
    const ancien = avant?.morceaux.get(cle);
    if (ancien && memesFaces(ancien.faces, faces)) return [cle, ancien];
    const rangees = faces.map((f) => ({ ...f, geom: faceGeometry(f.face, mpt, f.quads, f.rangs) }));
    const contenu = { ...emballer(scene, rangees), rangee: rangeeDuPlan(indiceDe.get(z)!, genre, h) };
    return [cle, { faces, morceau: { cle, empreinte: empreinteDe(contenu), ...contenu } }];
  }));
  const hauteurs = scene.layers.map((l) => ({ z: l.z, rangees: Array.from({ length: h }, (_, y) => Array.from({ length: w }, (_, x) => heightAt(scene, x, y, l.z))) }));
  return {
    volume: { metresParCase: mpt, hauteurs, morceaux: [...morceaux.values()].map((m) => m.morceau) },
    etat: {
      scene, montants, bloquees, sols, decorsDuTerrain,
      decorsDEntite: new Map(decors.map((d) => [d.entite.id, d])),
      cretes: new Map(cretes.map((c) => [c.cle, c])),
      mer, quads, morceaux,
    },
  };
}

/** La scène vue par son volume : les champs `CHAMPS_DU_VOLUME` de `scene`, ses drapeaux réduits aux tuiles effondrées
 *  (`PREFIXE_TUILE_EFFONDREE`). */
const projectionDuVolume = (scene: Scene): SceneDuVolume => tableTotale(CHAMPS_DU_VOLUME, (c) => c === 'flags'
  ? Object.fromEntries(Object.entries(scene.flags).filter(([cle]) => cle.startsWith(PREFIXE_TUILE_EFFONDREE)))
  : scene[c]) as SceneDuVolume;

/** Le dernier volume calculé et son état de reprise, par la version des datasets (`versionDesDatasets` : le volume lit
 *  les catalogues) et les champs de la scène que lit le volume (`CHAMPS_DU_VOLUME`), les tuiles effondrées par la
 *  chaîne triée de leurs clés (`tuilesEffondreesSignature`). */
const volumeRetenu = memoByDeps<{ volume: VolumeDuMonde; etat: EtatDuVolume }>();

/** Les volumes du monde, par scène et version des datasets (`versionDesDatasets`). */
const volumesParScene = memoByRefDeps<Scene, VolumeDuMonde>();

/** Le volume du monde de `scene`, de toutes ses couches, en morceaux (`volumeDepuis`), repris du dernier calculé.
 *  Mémoïsé par scène et version des datasets (`volumesParScene`). PUR. */
export function volumeDuMonde(scene: Scene): VolumeDuMonde {
  const version = versionDesDatasets();
  return volumesParScene(scene, [version], () => {
    const deps = [version, ...CHAMPS_DU_VOLUME.map((c) => (c === 'flags' ? tuilesEffondreesSignature(scene) : scene[c]))];
    return volumeRetenu(deps, (precedent) => volumeDepuis(projectionDuVolume(scene), precedent?.deps[0] === version ? precedent.value.etat : null)).volume;
  });
}

/** Les octets du masque de ce que le regard retire du volume de `scene` (`volumeDuMonde`, `RetraitDuMonde`) : les cases
 *  des couches au-dessus de `activeZ` (sans lui, la plus haute), hors du sol d'une case qui coiffe un bloc plein
 *  (`capsSolid`, le chemin de ronde reste montré), et celles du `couvercle` (clés `x,y,z`, `spaceCellKey`), chacune dans
 *  le plan de son genre. PUR. */
export function octetsDuRetrait(scene: Scene, activeZ = Math.max(...scene.layers.map((l) => l.z)), couvercle: ReadonlySet<string> = new Set()): Uint8Array {
  const { w, h } = scene.dimensions;
  const octets = new Uint8Array(2 * scene.layers.length * h * w);
  scene.layers.forEach(({ z }, i) => {
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const couverte = couvercle.has(spaceCellKey(x, y, z));
        const dessus = z > activeZ;
        if (couverte || dessus) octets[(rangeeDuPlan(i, 'pose', h) + y) * w + x] = RETIREE;
        if (couverte || (dessus && !capsSolid(scene, x, y, z))) octets[(rangeeDuPlan(i, 'sol', h) + y) * w + x] = RETIREE;
      }
  });
  return octets;
}

/** Le masque de ce que le regard retire du volume de `scene` (`octetsDuRetrait`), en base64. PUR. */
export function retraitDuMonde(scene: Scene, activeZ?: number, couvercle?: ReadonlySet<string>): RetraitDuMonde {
  return { masque: enBase64(octetsDuRetrait(scene, activeZ, couvercle)), largeur: scene.dimensions.w, rangees: 2 * scene.layers.length * scene.dimensions.h };
}

/** Les dernières nappes de toit calculées, par la version des datasets (`versionDesDatasets`) et les champs de la
 *  scène qu'elles lisent (`CHAMPS_DES_TOITS`). */
const toitsRetenus = memoByDeps<NappeDuMonde[]>();

/** Les nappes de toit, par scène et version des datasets (`versionDesDatasets`). */
const toitsParScene = memoByRefDeps<Scene, NappeDuMonde[]>();

/** Les nappes de toit de `scene`, une par masse de bâtiment (`nappeKey`), chacune de ses pans et de ses pignons, et son
 *  empreinte. Mémoïsées par scène et version des datasets (`toitsParScene`), puis retenues sur leurs entrées
 *  (`toitsRetenus`). PUR. */
export const toitsDuMonde = (scene: Scene): NappeDuMonde[] => toitsParScene(scene, [versionDesDatasets()], () => {
  const vue: SceneDesToits = scene;
  return toitsRetenus([versionDesDatasets(), ...CHAMPS_DES_TOITS.map((c) => vue[c])], () => {
  const parNappe = new Map<string, FaceListee[]>();
  for (const el of buildRoofs(vue)) {
    const cle = nappeKey(el.bodyId!, el.sectionId!);
    const faces = parNappe.get(cle) ?? parNappe.set(cle, []).get(cle)!;
    for (const face of el.faces) faces.push({ face, cell: el.cell });
  }
  return [...parNappe].map(([cle, listees]) => nappe(vue, cle, listees));
  });
});

/** La nappe `cle` des faces `listees` de `scene`, triangulées ensemble (`triangulees`), chacune rangée à la case de la
 *  carte la plus proche de la sienne (`caseBornee`), et son empreinte. */
const nappe = (scene: Pick<Scene, 'dimensions' | 'metresPerTile'>, cle: string, listees: readonly FaceListee[]): NappeDuMonde => {
  const geometrie = emballer(scene, triangulees(scene, listees).map((f) => ({ ...f, surLaCarte: caseBornee(scene, f.cell) })));
  return { cle, empreinte: empreinteDe(geometrie), ...geometrie };
};

/** Les nappes de toit que le groupe dégage, posé sur `allies` (`clearedSpace`, `cutawayForSection`) : celles qui
 *  couvrent l'espace où il se tient. PUR. */
export function toitsLeves(scene: Scene, allies: readonly { x: number; y: number; z?: number }[]): string[] {
  return [...new Set(buildRoofs(scene, { allies: [...allies] }).filter((el) => el.states.roofOccupied).map((el) => nappeKey(el.bodyId!, el.sectionId!)))];
}

/** Les clés (`nappeKey`) de toutes les nappes de toit de `scene` (`toitsDuMonde`). PUR. */
export function toutesLesNappes(scene: Scene): string[] {
  return [...new Set(buildRoofs(scene).map((el) => nappeKey(el.bodyId!, el.sectionId!)))];
}

/** Les dernières couronnes calculées, par la version des datasets (`versionDesDatasets`) et les champs de la scène
 *  qu'elles lisent (`CHAMPS_DES_COURONNES`). */
const couronnesRetenues = memoByDeps<NappeDuMonde[]>();

/** Les couronnes, par scène et version des datasets (`versionDesDatasets`). */
const couronnesParScene = memoByRefDeps<Scene, NappeDuMonde[]>();

/** Les couronnes crénelées des murs fortifiés de `scene` hors des ponts de ses navires (`aretesHorsDesNavires`), de
 *  toutes ses couches (`crownFaces`, apparence à `parapet`), une par arête, nommée par sa clé (`edgeKey`), posée au
 *  sommet de la face pleine du mur dressé à son pied (`piedDeLArete`, `wallHeightM`, sinon un étage) : l'hôte cache
 *  celles qui tombent avec leur mur (`couronnesAbattues`), chacune avec son empreinte. Mémoïsées par scène et version des
 *  datasets (`couronnesParScene`), puis retenues sur leurs entrées (`couronnesRetenues`). PUR. */
export const couronnesDuMonde = (scene: Scene): NappeDuMonde[] => couronnesParScene(scene, [versionDesDatasets()], () => {
  const vue: SceneDesCouronnes = scene;
  return couronnesRetenues([versionDesDatasets(), ...CHAMPS_DES_COURONNES.map((c) => vue[c])], () => {
  const facades = facadeEdges(vue);
  return aretesHorsDesNavires(vue).flatMap((seg) => {
    const app = edgeAppearance(facades.get(edgeKey(seg)), seg);
    if (!app.parapet) return [];
    const [a, b] = wallEnds(seg);
    const faces = crownFaces(app, a, b, piedDeLArete(vue, seg) + (app.wallHeightM ?? WALL_H_M));
    return [nappe(vue, edgeKey(seg), faces.map((face) => ({ face, cell: { x: seg.x, y: seg.y, z: seg.z ?? 0 } })))];
  });
  });
});

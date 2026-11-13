/**
 * LES ÉCHANTILLONS DU MONDE (#3802) : ce que le jeu dessine en 3D hors des modèles servis, famille par famille (chaque
 * décor, chaque sol, chaque matière de relief et de toit, chaque apparence de mur), chacun posé dans une scène que
 * bâtissent les écrivains de l'éditeur (`sceneEdit`) et dessiné par les lecteurs que le jeu sert à son hôte : le volume
 * (`volumeDuMonde`), les arêtes (`aretesDeLaScene`) et les couronnes tombées du plateau (`plateauDeLaScene`), les nappes de toit
 * (`toitsDuMonde`) et les couronnes crénelées (`couronnesDuMonde`).
 */
import { findPropById, matieresDe, props, structureAppearances, terrains, semencesDeScene } from '../../data';
import { structureAppearance } from './volume/structures';
import { empreinteDuProp } from '../../data/props.types';
import { parLibelle } from '../../lib/ordre.mjs';
import { PARTS_RELIEF } from '../../data/materials.types';
import { roofProfileSchema, eaveSideSchema } from '../../data/schemas/defs-scenes/scene';
import {
  addArchitectureBody,
  addBuildingMass,
  addLayer,
  fillTerrainRect,
  paintCrenellated,
  paintHeight,
  patchBuildingMass,
  patchWall,
  placeEntity,
  setEdgeWall,
  setReliefDefault,
} from '../sceneEdit';
import { emptyScene, setStructureDown, type Scene, type WallSeg, type WallSide } from './scene';
import { METRES_PER_LEVEL, STEP_MAX_M } from './relief';
import { estAbsent, terrainBuilt, terrainSolidHeightM } from './terrain';
import { aretesDeLaScene, plateauDeLaScene, type AreteDessinee } from './aretes';
import { couronnesDuMonde, toitsDuMonde, volumeDuMonde, type NappeDuMonde, type VolumeDuMonde } from './volume/volume';

/** Une famille d'échantillons : les décors (`props.json`), les sols (`terrains.json`, hors de l'absence de sol,
 *  `estAbsent`, qui ne se dessine pas), les matières de relief et de toit (`materials.json`, domaines `relief` et
 *  `roof`) et les apparences de mur (`structureAppearance.json`). */
export type FamilleDEchantillon = 'decor' | 'sol' | 'relief' | 'toit' | 'mur';

/** Une famille d'échantillons telle que l'atelier la liste : son id, son libellé, et chacune de ses entrées, l'id et le
 *  libellé de sa donnée. */
export interface FamilleDEchantillons {
  id: FamilleDEchantillon;
  libelle: string;
  entrees: { id: string; libelle: string }[];
}

/** Un échantillon dessiné : ce que le jeu sert à son hôte pour une scène, son volume, ses arêtes, ses nappes de toit,
 *  ses couronnes crénelées et celles qui tombent avec leur mur. */
export interface EchantillonDessine {
  monde: VolumeDuMonde;
  aretes: AreteDessinee[];
  toits: NappeDuMonde[];
  couronnes: NappeDuMonde[];
  couronnesAbattues: string[];
}

/** Le bord, en cases, laissé autour de ce qu'un échantillon montre. */
const BORD = 1;
/** Le côté, en cases, de la scène d'un sol. */
const COTE_DU_SOL = 5;

/** La scène d'un échantillon : `l` × `h` cases, le sol de la semence (`emptyScene`). */
const sceneVide = (l: number, h: number): Scene => emptyScene('echantillon', l, h);

/** Le décor `id` posé au centre d'une scène taillée à son empreinte (`empreinteDuProp`), bordée de `BORD`. */
function sceneDuDecor(id: string): Scene {
  const { w, h } = empreinteDuProp(findPropById(id), undefined, semencesDeScene.metresPerTile);
  const taillee = sceneVide(w + 2 * BORD, h + 2 * BORD);
  const centre = { x: (taillee.dimensions.w - 1) / 2, y: (taillee.dimensions.h - 1) / 2 };
  return placeEntity(taillee, { mode: 'entite', kind: 'prop', ref: id }, { x: BORD, y: BORD }, 0, centre).scene;
}

/** Une scène de `COTE_DU_SOL` cases de côté couverte du terrain `id`. */
function sceneDuSol(id: string): Scene {
  return fillTerrainRect(sceneVide(COTE_DU_SOL, COTE_DU_SOL), { x: 0, y: 0, w: COTE_DU_SOL, h: COTE_DU_SOL }, id);
}

/** Le premier sol bâti de `terrains.json` sans bloc plein (`terrainBuilt`, `terrainSolidHeightM`) : celui qui ne se
 *  raccorde pas en pente à la marche du sol de la semence, que borde alors une rampe (`floorFaces`). */
const solBati = (): string => terrains.find((t) => terrainBuilt(t.id) && terrainSolidHeightM(t.id) === 0)!.id;

/** Une terrasse dont chaque partie de relief (`PARTS_RELIEF`) est de la matière `id` : une case haussée d'un étage, que
 *  bordent des falaises ; une case haussée d'une marche, que borde une rampe vers le sol bâti voisin (`solBati`) ; un
 *  tablier à un étage sur la couche du dessus, au-dessus du sol, porté par ses piliers. */
function sceneDuRelief(id: string): Scene {
  const posee = PARTS_RELIEF.reduce((s, part) => setReliefDefault(s, part, { id }), sceneVide(7, 3));
  const falaise = paintHeight(posee, { x: 1, y: 1 }, METRES_PER_LEVEL, 1);
  const rampe = paintHeight(fillTerrainRect(falaise, { x: 4, y: 1, w: 1, h: 1 }, solBati()), { x: 3, y: 1 }, STEP_MAX_M, 1);
  const tablier = fillTerrainRect(addLayer(rampe, 1), { x: 5, y: 1, w: 1, h: 1 }, semencesDeScene.terrain.id, 1);
  return paintHeight(tablier, { x: 5, y: 1 }, METRES_PER_LEVEL, 1, 1);
}

/** Les quatre profils de toit (`roofProfileSchema`) côte à côte, chacun la masse non carrée d'un corps, couverte de la
 *  matière `id` ; l'appentis égoutte du premier côté que le schéma nomme (`eaveSideSchema`). */
function sceneDuToit(id: string): Scene {
  const profils = roofProfileSchema.options;
  const pied = { w: 2, h: 3 };
  const scene = sceneVide(BORD + profils.length * (pied.w + BORD), pied.h + 2 * BORD);
  return profils.reduce((s, profile, rang) => {
    const foot = { x: BORD + rang * (pied.w + BORD), y: BORD, ...pied };
    const corps = addArchitectureBody(s, undefined, foot);
    const masse = addBuildingMass(corps.scene, corps.id, foot, 0)!;
    return patchBuildingMass(masse.scene, corps.id, masse.id, { profile, material: { id }, ...(profile === 'shed' ? { eaveSide: eaveSideSchema.options[0] } : {}) });
  }, scene);
}

/** Un pan de l'enclos d'un mur : son arête canonique, et ce qui s'y pose. */
interface PanDeLEnclos {
  x: number;
  y: number;
  side: Extract<WallSide, 'N' | 'E'>;
  arete: 'wall' | 'door';
  patch: Partial<WallSeg>;
  abattu?: true;
}

/** L'enclos de deux cases d'un mur : un mur, une porte fermée, une porte ouverte, une fenêtre, une fenêtre close et une
 *  brèche (la structure de la semence, `semences-de-scene.json › facade`, abattue). */
const ENCLOS: readonly PanDeLEnclos[] = [
  { x: 1, y: 1, side: 'N', arete: 'wall', patch: {} },
  { x: 2, y: 1, side: 'N', arete: 'door', patch: { closed: true } },
  { x: 1, y: 2, side: 'N', arete: 'door', patch: {} },
  { x: 2, y: 2, side: 'N', arete: 'wall', patch: { window: true } },
  { x: 0, y: 1, side: 'E', arete: 'wall', patch: { window: true, shuttered: true } },
  { x: 2, y: 1, side: 'E', arete: 'wall', patch: {}, abattu: true },
];

/** La case crénelée d'une apparence à couronne (`parapet`), à l'écart de l'enclos : haussée d'un étage au-dessus de ses
 *  voisines, pour que sa crête la ceigne de chaque côté (`cretesDePerimetre`). */
const CRENELEE = { x: 4, y: 1 };

/** L'enclos (`ENCLOS`) dont chaque pan porte l'apparence `id`, et, pour une apparence à couronne, la case crénelée
 *  (`CRENELEE`) de cette apparence. */
function sceneDuMur(id: string): Scene {
  const crenelee = structureAppearance(id).parapet !== undefined;
  const enclos = ENCLOS.reduce((s, { x, y, side, arete, patch, abattu }) => {
    const pose = patchWall(setEdgeWall(s, x, y, side, 0, arete, abattu ? semencesDeScene.facade.id : undefined), x, y, side, 0, { ...patch, appearance: id });
    return abattu ? setStructureDown(pose, x, y, side, 0, true) : pose;
  }, sceneVide(crenelee ? CRENELEE.x + 1 + BORD : 4, 3));
  return crenelee ? paintCrenellated(paintHeight(enclos, CRENELEE, METRES_PER_LEVEL, 1), CRENELEE, id, 1) : enclos;
}

/** Chaque famille : son libellé, ses entrées, et la scène qui montre l'une d'elles. */
const FAMILLES: Record<FamilleDEchantillon, { libelle: string; entrees: () => { id: string; label: string }[]; scene: (id: string) => Scene }> = {
  decor: { libelle: 'Décor', entrees: () => props, scene: sceneDuDecor },
  sol: { libelle: 'Sol', entrees: () => terrains.filter((t) => !estAbsent(t.id)), scene: sceneDuSol },
  relief: { libelle: 'Relief', entrees: () => matieresDe('relief'), scene: sceneDuRelief },
  toit: { libelle: 'Toit', entrees: () => matieresDe('roof'), scene: sceneDuToit },
  mur: { libelle: 'Mur et ouverture', entrees: () => structureAppearances, scene: sceneDuMur },
};

/** Les familles d'échantillons, chacune ses entrées dans l'ordre de leurs libellés (`parLibelle`). PUR. */
export function famillesDEchantillons(): FamilleDEchantillons[] {
  return (Object.keys(FAMILLES) as FamilleDEchantillon[]).map((id) => ({
    id,
    libelle: FAMILLES[id].libelle,
    entrees: FAMILLES[id].entrees().map((e) => ({ id: e.id, libelle: e.label })).sort((a, b) => parLibelle(a.libelle, b.libelle)),
  }));
}

/** La scène qui montre l'entrée `id` de la famille `famille`. PUR. */
export function sceneDEchantillon(famille: FamilleDEchantillon, id: string): Scene {
  return FAMILLES[famille].scene(id);
}

/** L'échantillon de l'entrée `id` de la famille `famille`, dessiné comme le jeu dessine une scène pour son hôte, sous un
 *  regard qui ne retire rien (`immersion`). PUR. */
export function echantillonDessine(famille: FamilleDEchantillon, id: string): EchantillonDessine {
  const scene = sceneDEchantillon(famille, id);
  const { couronnesAbattues } = plateauDeLaScene(scene, [], 'immersion');
  return { monde: volumeDuMonde(scene), aretes: aretesDeLaScene(scene), toits: toitsDuMonde(scene), couronnes: couronnesDuMonde(scene), couronnesAbattues };
}

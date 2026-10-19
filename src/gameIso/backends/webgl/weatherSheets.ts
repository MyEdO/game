/**
 * BRUME VOLUMIQUE (#1247) — la seconde expression monde de la météo, à côté du semis qui tombe
 * (`weatherParticles.ts`) : des NAPPES horizontales translucides posées à des cotes fixes, que la
 * caméra traverse et qui s'ancrent à la carte quand elle tourne.
 *
 * POURQUOI PAS `THREE.Fog`. La brume de three est une rampe de PROFONDEUR CAMÉRA : sous une caméra
 * orthographique de plateau, elle sépare les coins de la carte (102 m d'écart mesuré entre deux coins
 * opposés de La Diligence) et elle TOURNE avec le lacet — le même bâtiment s'embrume ou se dégage
 * selon le cran de vue. Une nappe de brume, elle, est de la MATIÈRE dans le monde : elle a une cote,
 * elle est au même endroit à tous les crans, et le relief y entre ou en sort.
 *
 * SOUS COUVERT, la MÊME vérité qu'ailleurs (`shelterField`/`isSheltered`, `builders/roofs.ts` — «
 * deux lecteurs, une vérité ») : une colonne coiffée par une masse ne reçoit AUCUNE nappe. D'où deux
 * conséquences gratuites — l'intérieur révélé par le cutaway est propre PAR CONSTRUCTION (rien n'y a
 * jamais été posé), et la géométrie ne dépend NI de la vue NI du dégagement. Elle est RETENUE sur ce
 * qui la détermine (`retainBrumeSheets` : identité de scène, météo, emprise, échelle, et références du
 * bâti), jamais sur la référence de l'objet scène — qui, elle, change à chaque pas d'un combattant.
 *
 * VUE DU DESSUS : aucune nappe (décision de l'écran, `stage/GameStage3D.tsx`). À 90° de tangage, les
 * nappes se projettent exactement l'une sur l'autre — l'empilement dégénère en un voile plein écran,
 * là où l'arbitrage de la vue top demande une lisibilité de plateau. La météo y reste la teinte de
 * lumière et le semis.
 */
import * as THREE from 'three';
import type { WeatherBrumeDef } from '../../catalog/ambiance';
import type { Scene } from '../../../noyau/monde/scene';
import { shelterField, shelterSectionAt } from '../../builders/roofs';
import { sceneGroundSpan } from './weatherParticles';
import { withRenderRank } from './renderRanks';
import { materiauPlanTransparent } from './worldMaterials';

/** Une bande CONTINUE de colonnes à ciel ouvert sur la rangée `y` : de `x0` à `x1` INCLUS. */
export interface OpenRun {
  y: number;
  x0: number;
  x1: number;
}

/** Les bandes à CIEL OUVERT de la carte, rangée par rangée (PURE, sans three). Une colonne coiffée
 *  par une masse est exclue — c'est le verdict d'abri de la scène, pas un second calcul. La fusion en
 *  bandes est ce qui garde la géométrie petite : une carte sans bâti rend UNE bande par rangée là où
 *  un quad par case en rendrait `w`.
 *
 *  Le verdict est pris SANS cote : une colonne coiffée l'est à TOUTE hauteur pour la brume (une
 *  nappe posée au-dessus d'un toit bas passerait sinon au travers de la charpente). */
export function openSkyRuns(scene: Scene): OpenRun[] {
  const abris = shelterField(scene);
  const { w, h } = scene.dimensions;
  const runs: OpenRun[] = [];
  for (let y = 0; y < h; y++) {
    let debut = -1;
    for (let x = 0; x <= w; x++) {
      const ouvert = x < w && shelterSectionAt(abris, x, y) === null;
      if (ouvert && debut < 0) debut = x;
      if (!ouvert && debut >= 0) {
        runs.push({ y, x0: debut, x1: x - 1 });
        debut = -1;
      }
    }
  }
  return runs;
}

/** Géométrie d'une NAPPE : un quad horizontal par bande, à la cote monde `yM`. Repère three : `x` =
 *  est, `y` = haut, `z` = sud — la même convention que le semis. Deux triangles par bande, sans
 *  index (une nappe se monte une fois par scène). */
export function brumeSheetGeometry(runs: readonly OpenRun[], mpt: number, yM: number): THREE.BufferGeometry {
  const pos = new Float32Array(runs.length * 18);
  runs.forEach((run, i) => {
    const x0 = (run.x0 - 0.5) * mpt;
    const x1 = (run.x1 + 0.5) * mpt;
    const z0 = (run.y - 0.5) * mpt;
    const z1 = (run.y + 0.5) * mpt;
    const o = i * 18;
    // (x0,z0) (x1,z0) (x1,z1) — puis (x0,z0) (x1,z1) (x0,z1)
    const s = [x0, yM, z0, x1, yM, z0, x1, yM, z1, x0, yM, z0, x1, yM, z1, x0, yM, z1];
    for (let k = 0; k < 18; k++) pos[o + k] = s[k];
  });
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.computeVertexNormals();
  geo.computeBoundingBox();
  geo.computeBoundingSphere();
  return geo;
}

/** Le PLAN DE NAPPES d'une scène : ce qu'il faut pour monter les meshes, et rien qui dépende de la
 *  vue. C'est lui qui se RETIENT d'un rendu à l'autre (`retainBrumeSheets`) — les meshes, eux, se
 *  montent dans l'effet qui les possède. */
export interface BrumePlan {
  runs: readonly OpenRun[];
  mpt: number;
  groundM: number;
}

/** Un plan RETENU et ce qui le détermine — le patron du semis (`PrecipSlot`, `weatherParticles.ts`). */
export interface BrumeSlot {
  /** Identité VALEUR : la scène, sa météo, son emprise, son échelle. */
  cle: string;
  /** Identité RÉFÉRENCE du PLAN BÂTI : ce dont le couvert se déduit. Un pas de combattant produit une
   *  nouvelle référence de SCÈNE mais ne touche à aucun de ces tableaux. */
  bati: readonly unknown[];
  plan: BrumePlan;
}

/** IDENTITÉ VALEUR du plan de nappes : rien d'autre ne le détermine. */
export function brumeFieldKey(scene: Pick<Scene, 'id' | 'weather' | 'dimensions'>, mpt: number, def: WeatherBrumeDef): string {
  const { w, h } = scene.dimensions;
  return `${scene.id}|${scene.weather ?? ''}|${w}x${h}|${mpt}|${def.color}|${def.layers.map((l) => `${l.hM}:${l.alpha}`).join(',')}`;
}

/**
 * Le plan de nappes PERSISTÉ de la scène : tant que la clé ET le bâti ne changent pas, le plan rendu
 * est le MÊME objet — donc l'écran ne remonte aucune géométrie.
 *
 * POURQUOI CE N'EST PAS `[scene]`. Une référence de scène naît à CHAQUE PAS d'un combattant (c'est
 * documenté au semis, `precipFieldKey`) : keyée dessus, la nappe se reconstruisait à chaque pas —
 * `shelterField` manquait sa mémoïsation PAR RÉFÉRENCE et recalculait tout le couvert (6,9 ms mesurés
 * sur une carte 60×60 à 81 masses), pour une géométrie identique au triangle près.
 *
 * Le BÂTI se compare par RÉFÉRENCE (architecture authorée, murs, couches) plutôt que par valeur : le
 * couvert se déduit de l'architecture EFFECTIVE, qui se recalcule du plan (murs, pièces, étages) —
 * une signature de la seule `architecture` authorée serait aveugle à l'éditeur qui déplace un mur. La
 * comparaison est donc CONSERVATRICE : un tableau réécrit à contenu égal remonte les nappes (rien ne
 * change à l'écran), un tableau intact ne les remonte jamais.
 */
export function retainBrumeSheets(
  slot: BrumeSlot | null,
  scene: Scene,
  mpt: number,
  def: WeatherBrumeDef,
): BrumeSlot {
  const cle = brumeFieldKey(scene, mpt, def);
  const bati: readonly unknown[] = [scene.architecture, scene.walls, scene.layers];
  if (slot && slot.cle === cle && slot.bati.length === bati.length && slot.bati.every((r, i) => r === bati[i])) return slot;
  return { cle, bati, plan: { runs: openSkyRuns(scene), mpt, groundM: sceneGroundSpan(scene).groundM } };
}

/** Les NAPPES d'un plan — un mesh par cote, du bas vers le haut (l'ordre de la
 *  donnée, dont le schéma garantit qu'il croît). Matériau non éclairé (une brume ne s'ombre pas),
 *  translucide, qui n'écrit PAS la profondeur (deux nappes qui se croisent ne se découpent pas) et
 *  qui ne s'EMBRUME pas lui-même (`fog: false`) : ces nappes SONT la météo, la brume de distance du
 *  POV les délaverait deux fois. Aucune ombre, ni portée ni reçue. */
export function buildBrumeSheets(plan: BrumePlan, def: WeatherBrumeDef): THREE.Mesh[] {
  const { runs, mpt, groundM } = plan;
  if (!runs.length) return [];
  return def.layers.map((couche, i) => {
    const mat = materiauPlanTransparent({
      color: new THREE.Color(def.color),
      opacity: couche.alpha,
      depthWrite: false,
      fog: false,
    });
    const mesh = new THREE.Mesh(brumeSheetGeometry(runs, mpt, groundM + couche.hM), mat);
    mesh.name = `brume:${i}`;
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    return withRenderRank(mesh, 'nappe');
  });
}

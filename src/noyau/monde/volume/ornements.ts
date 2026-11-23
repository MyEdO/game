/**
 * LES ORNEMENTS DU BÂTI d'une scène (#4471) : où se posent les décors que porte son architecture, ceux de ses
 * façades (`FacadeSection.features` d'une sorte de `KINDS_DE_DECOR`, vignette `facadeFeatureViz`), les souches des
 * foyers à conduit (`PropData.conduit`) et ceux de l'identité de ses bâtiments (`buildingFeatures`, un jeu par masse
 * de `effectiveArchitecture`), et le dehors du
 * bâti d'où une arête tire son côté sortant (`dehorsDeScene`, `outwardSide`). Le volume du monde les pose
 * (`posesDuVolume`, `./volume.ts`). PUR.
 */
import type { RectDeCases } from '../../../data/schemas/grammaire/valeurs';
import { heightAt, porteNonSecrete, sceneMetresPerTile, wallEnds, type SceneDesToits, type SceneDuBati, type WallSeg } from '../scene';
import { buildingFeatures, massFootBBox, massFootprintCells } from '../buildings';
import { DEFAUTS_D_OUVERTURE, effectiveArchitecture } from '../../sceneEdit';
import { interiorCells } from '../../planDefects';
import { memoByRef } from '../sceneMemo';
import { edgeKey, facadeFeatureViz } from '../facades';
import { WALL_H_M } from '../iso';
import { DIR8_DELTA, rotateDir8, type Dir4, type Dir8 } from '../../../geometry/dir8';
import { decorEnVolume } from './propVolumes';
import { propFootTiles } from '../footprint';
import { fieldHeightAt, formeDeLaNappe, nappeKey, resolveNappes, WALL_NB, type RoofField, type RoofShapeSpec } from './toits';

type Point = { x: number; y: number };

const xyKey = (x: number, y: number) => `${x},${y}`;

/** Le DEHORS d'une case, par étage — SEULE définition du dépôt, lue par le CÔTÉ SORTANT d'une arête
 *  (`outwardSide`).
 *  Le dehors = case n'appartenant à AUCUNE case INTÉRIEURE (`interiorCells`, `noyau/planDefects.ts`,
 *  #881 — closes par les murs ET non déclarées à ciel ouvert, jamais la seule notion
 *  `SceneEffectZone.presentation: 'interior'` : une enceinte close n'est pas un bâtiment couvert) ET
 *  hors de l'emprise BÂTIE d'une masse (le VOLUME du corps, PAS sa couverture de toit — #825bis : un
 *  avant-toit déborde le mur PAR CONSTRUCTION, la case qu'il surplombe reste DEHORS ; confondre « sous
 *  un toit » et « à l'intérieur » neutralisait 31 arêtes d'étage sur 58 côté La Diligence, mur en
 *  alternance visible/invisible). Une masse à plusieurs niveaux bâtit TOUS les étages qu'elle porte
 *  (`z − levels + 1 … z`), pas seulement son plancher sommet. Mémoïsé PAR SCÈNE (`memoByRef`). */
export const dehorsDeScene = memoByRef((scene: SceneDesToits) => {
  const builtByZ = new Map<number, Set<string>>();
  const build = (z: number, x: number, y: number) => {
    const set = builtByZ.get(z) ?? (builtByZ.set(z, new Set()).get(z)!);
    set.add(xyKey(x, y));
  };
  for (const body of effectiveArchitecture(scene))
    for (const mass of body.masses) {
      const cells = massFootprintCells(mass.footprint);
      for (const key of cells) {
        const [x, y] = key.split(',').map(Number);
        for (let z = mass.z - mass.levels + 1; z <= mass.z; z++) build(z, x, y);
      }
    }
  return (x: number, y: number, z: number): boolean =>
    !interiorCells(scene, z).has(xyKey(x, y)) && !builtByZ.get(z)?.has(xyKey(x, y));
});

/** CÔTÉ SORTANT d'une arête : le cap cardinal vers lequel elle donne sur le DEHORS (`dehorsDeScene`) —
 *  ce qu'un décor de façade doit savoir pour se dresser du bon côté du mur. `null` quand aucun des deux
 *  côtés n'est le dehors (arête intérieure) et pour une arête DIAGONALE, dont `WALL_NB` rend un voisin
 *  nul : l'appelant tranche son repli. */
export function outwardSide(
  scene: SceneDesToits,
  edge: Pick<WallSeg, 'x' | 'y' | 'side'> & { z?: number },
): Dir4 | null {
  const [nx, ny] = WALL_NB[edge.side];
  if (nx === 0 && ny === 0) return null;
  const z = edge.z ?? 0;
  const isDehors = dehorsDeScene(scene);
  if (isDehors(edge.x + nx, edge.y + ny, z)) return edge.side === 'N' ? 'N' : 'E';
  if (isDehors(edge.x, edge.y, z)) return edge.side === 'N' ? 'S' : 'O';
  return null;
}

/** CAP d'un ornement de FAÎTE, lu sur la nappe RÉSOLUE : l'axe de faîtage authoré fait foi (`ridge`,
 *  `resolveMassRidge`), jamais la boîte englobante de l'empreinte. Un profil sans faîte franc (croupe,
 *  toit plat) n'oriente rien : cap canonique `S`. */
export function capDuFaite(shape: RoofShapeSpec): Dir8 {
  if (shape.profile === 'hip' || shape.profile === 'flat') return 'S';
  return shape.ridge === 'x' ? 'E' : 'S';
}

/** Ce que tout ornement du bâti déclare de sa pose. */
interface PoseDOrnement {
  /**
   * `<corps>:<section>:<ornement>` d'un ornement de façade, `<entité>` de la souche d'un foyer, `<corps>:<masse>:<rang>`
   * d'un ornement d'identité.
   */
  id: string;
  /** l'id de son type de décor (`props.json`). */
  prop: string;
  /** sa case porteuse, sa couche comprise. */
  case: { x: number; y: number; z: number };
  /** le point de la scène, en cases continues (la case centrée sur l'entier), où il se pose. */
  ancre: Point;
  /** la hauteur (m) de la surface de sa case de référence (`heightAt`). */
  solM: number;
  /** sa surélévation (m) au-dessus de `solM`. */
  sureleveM: number;
  /** son cap ; absent quand il ne sait pas s'orienter (arête diagonale ou intérieure, `outwardSide`). */
  cap?: Dir8;
  /**
   * la nappe de toit qui le porte (`nappeKey`) : celle de son faîte, ou celle dont la couverture l'assied
   * (`hauteurDeCouverture`) ; absente pour un ornement posé au sol.
   */
  nappe?: string;
}

/** Un ornement du bâti (`ornementsDuBati`) : sa pose et ce que sa source porte. */
export type OrnementDuBati = PoseDOrnement & (
  | {
    /** ornement d'une section de façade (`FacadeSection.features`). */
    source: 'architecture';
    /** l'échelle déclarée de sa vignette (`FacadeFeatureViz.scale`, défaut 1). */
    echelle: number;
    /** les deux cases que son arête sépare. */
    cotes: readonly [Point, Point];
  }
  | {
    /** souche d'un foyer à conduit (`PropData.conduit`). */
    source: 'souche';
  }
  | {
    /** ornement d'identité du type de son bâtiment (`buildingFeatures`). */
    source: 'ornament';
    /** la boîte englobante de l'empreinte de sa masse (`massFootBBox`). */
    emprise: RectDeCases;
  }
);

/**
 * La COUVERTURE à l'aplomb d'un point d'ancrage, sa hauteur (m) et sa nappe (`nappeKey`), ou `null` si aucune nappe
 * ne couvre l'une des cases candidates : les deux cases qu'une arête de façade sépare (un ornement de façade est
 * ASSIS sur le mur, la couverture qui le porte est d'un côté ou de l'autre), ou l'empreinte d'un foyer (sa souche
 * sort du toit qui le couvre). Lit le CHAMP des nappes
 * (`resolveNappes` + `fieldHeightAt`), la source unique des hauteurs de toit. Le repère du champ est celui
 * des COINS de case (coin nord-ouest de `(x,y)` = point `(x,y)`), là où l'ancre vit dans le repère des
 * cases centrées : d'où le `+0.5`. Deux nappes couvrent le point ? La PLUS HAUTE gagne.
 */
function hauteurDeCouverture(
  nappes: ReadonlyMap<string, { cells: ReadonlySet<string>; field: RoofField }>,
  cases: readonly Point[],
  ancre: Point,
): { hauteurM: number; nappe: string } | null {
  let haut: { hauteurM: number; nappe: string } | null = null;
  for (const [cle, nappe] of nappes) {
    if (!cases.some((c) => nappe.cells.has(xyKey(c.x, c.y)))) continue;
    const hauteurM = fieldHeightAt(nappe.field, { x: ancre.x + 0.5, y: ancre.y + 0.5 });
    if (haut === null || hauteurM > haut.hauteurM) haut = { hauteurM, nappe: cle };
  }
  return haut;
}

/** Ancrage EXTÉRIEUR de la PORTE d'un bâtiment (résolu depuis `scene.walls`) : case juste À L'EXTÉRIEUR de
 *  la porte + cap cardinal SORTANT. Robuste à la canonisation N/E des arêtes (une porte 'S'/'O' est
 *  stockée sur la case voisine). Une porte SECRÈTE n'est jamais l'entrée (`porteNonSecrete`). Repli :
 *  façade SUD, sous le centre bas de l'empreinte. */
function buildingDoor(scene: SceneDesToits, f: RectDeCases, z: number): { frontCell: Point; facing: Dir4 } {
  const x0 = f.x, y0 = f.y, x1 = f.x + f.w - 1, y1 = f.y + f.h - 1;
  for (const w of scene.walls ?? []) {
    if (!porteNonSecrete(w) || (w.z ?? 0) !== z) continue;
    if (w.side === 'N') {
      if (w.x >= x0 && w.x <= x1 && w.y === y0) return { frontCell: { x: w.x, y: y0 - 1 }, facing: 'N' };
      if (w.x >= x0 && w.x <= x1 && w.y === y1 + 1) return { frontCell: { x: w.x, y: y1 + 1 }, facing: 'S' };
    } else if (w.side === 'E') {
      if (w.y >= y0 && w.y <= y1 && w.x === x1) return { frontCell: { x: x1 + 1, y: w.y }, facing: 'E' };
      if (w.y >= y0 && w.y <= y1 && w.x === x0 - 1) return { frontCell: { x: x0 - 1, y: w.y }, facing: 'O' };
    }
  }
  return { frontCell: { x: f.x + Math.floor(f.w / 2), y: y1 + 1 }, facing: 'S' };
}

/** Les ornements de façade de `scene` : chaque feature d'une section dont la vignette nomme un décor
 *  (`facadeFeatureViz`), une fois, sur une arête de sa section que porte un mur (`scene.walls`). Ancrée le long de
 *  l'arête à son `offset`, tournée vers le dehors (`outwardSide`), posée sur le sol de sa case ou sur la couverture
 *  à l'aplomb de son ancre (`FacadeFeatureViz.base`), sans décalage quand aucune nappe ne la couvre ;
 *  `feature.appearance` prime sur `viz.prop`. */
function ornementsDeFacade(scene: SceneDesToits, nappes: ReturnType<typeof resolveNappes>): OrnementDuBati[] {
  const physicalEdges = new Set((scene.walls ?? []).map((wall) => edgeKey(wall)));
  const emis = new Set<string>();
  const out: OrnementDuBati[] = [];
  for (const body of scene.architecture ?? [])
    for (const section of body.facades) {
      const sectionEdges = new Set(section.edges.map((edge) => edgeKey({ ...edge, z: edge.z ?? section.z })));
      for (const feature of section.features ?? []) {
        const edge = { ...feature.edge, z: feature.edge.z ?? section.z };
        const edgeId = edgeKey(edge);
        const id = `${body.id}:${section.id}:${feature.id}`;
        if (emis.has(id) || !sectionEdges.has(edgeId) || !physicalEdges.has(edgeId)) continue;
        const viz = facadeFeatureViz(section.appearance, feature.kind);
        if (!viz) continue;
        emis.add(id);
        const offset = feature.offset ?? DEFAUTS_D_OUVERTURE.offset;
        const [a, b] = wallEnds(edge);
        const ancre = { x: a.x + (b.x - a.x) * offset, y: a.y + (b.y - a.y) * offset };
        const [nx, ny] = WALL_NB[edge.side];
        const cotes = [{ x: edge.x, y: edge.y }, { x: edge.x + nx, y: edge.y + ny }] as const;
        const sortant = outwardSide(scene, edge);
        const solM = heightAt(scene, edge.x, edge.y, edge.z);
        const couverture = viz.base === 'toit' ? hauteurDeCouverture(nappes, cotes, ancre) : null;
        const sureleveM = viz.base === 'toit' && couverture == null
          ? 0
          : (couverture != null ? couverture.hauteurM - solM : 0) + (viz.liftM ?? 0);
        out.push({
          id,
          source: 'architecture',
          prop: feature.appearance ?? viz.prop,
          case: { x: edge.x, y: edge.y, z: edge.z },
          ancre,
          solM,
          sureleveM,
          ...(sortant ? { cap: sortant } : {}),
          ...(couverture ? { nappe: couverture.nappe } : {}),
          echelle: viz.scale ?? 1,
          cotes,
        });
      }
    }
  return out;
}

/** Les ornements d'identité de `scene` : pour chaque masse d'un corps typé (`buildingFeatures(body.style)`), chaque
 *  ornement de son type. Un ornement de faîte (`ridge`) s'ancre au milieu de l'empreinte, à 60 % de la pente du
 *  champ de sa nappe (`fieldHeightAt`) entre l'égout et l'apex, au cap du faîtage de la forme que suit sa nappe
 *  (`capDuFaite`, `formeDeLaNappe`) ; un ornement de
 *  façade (`facade`) ou de devant (`front`) s'ancre à la case juste à l'extérieur de la porte (`buildingDoor`),
 *  l'enseigne une demi-case plus au large et haut sur la façade, l'étal au sol, tournés vers le dehors. */
function ornementsDIdentite(scene: SceneDesToits, nappes: ReturnType<typeof resolveNappes>): OrnementDuBati[] {
  const out: OrnementDuBati[] = [];
  for (const body of effectiveArchitecture(scene)) {
    const feats = buildingFeatures(body.style);
    if (!feats.length) continue;
    for (const mass of body.masses) {
      const z = mass.z;
      const f = massFootBBox(mass.footprint);
      const cleDeNappe = nappeKey(body.id, mass.id);
      const { cells, field } = nappes.get(cleDeNappe)!;
      const eaveM = field.shape.eaveHeightM;
      let apexM = eaveM;
      for (const key of cells) {
        const [x, y] = key.split(',').map(Number);
        for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]] as const)
          apexM = Math.max(apexM, fieldHeightAt(field, { x: x + dx, y: y + dy }));
      }
      const cx = f.x + Math.floor(f.w / 2), cy = f.y + Math.floor(f.h / 2);
      const door = buildingDoor(scene, f, z);
      feats.forEach((feat, i) => {
        const commun = { id: `${body.id}:${mass.id}:${i}`, source: 'ornament' as const, prop: feat.id, emprise: f };
        if (feat.anchor === 'ridge') {
          const solM = heightAt(scene, cx, cy, z);
          out.push({
            ...commun,
            case: { x: f.x, y: f.y, z },
            ancre: { x: f.x + (f.w - 1) / 2, y: f.y + (f.h - 1) / 2 },
            cap: capDuFaite(formeDeLaNappe(field)),
            solM,
            sureleveM: eaveM - solM + 0.6 * (apexM - eaveM),
            nappe: cleDeNappe,
          });
          return;
        }
        const { gx: ox, gy: oy } = DIR8_DELTA[door.facing];
        const facade = feat.anchor === 'facade';
        out.push({
          ...commun,
          case: { x: door.frontCell.x, y: door.frontCell.y, z },
          ancre: { x: door.frontCell.x + (facade ? ox * 0.5 : 0), y: door.frontCell.y + (facade ? oy * 0.5 : 0) },
          cap: door.facing,
          solM: heightAt(scene, door.frontCell.x, door.frontCell.y, z),
          sureleveM: facade ? WALL_H_M * 0.55 : 0,
        });
      });
    }
  }
  return out;
}

/** La souche d'un foyer : son décor, et sa surélévation (m) au-dessus de la couverture qu'elle perce, qui l'y encastre. */
export const SOUCHE = { prop: 'cheminee', liftM: -0.3 } as const;

/** Les souches de `scene` : une par entité `prop` dont le décor a un conduit (`PropData.conduit`), à l'aplomb du mur
 *  auquel il s'adosse, l'arête au dos de son empreinte (`propFootTiles`) selon son cap (`decorEnVolume`), en son milieu.
 *  Elle s'assied sur la plus haute nappe qui couvre une case de l'empreinte, à l'aplomb de son ancre
 *  (`hauteurDeCouverture`), tournée vers le dos du foyer ; un foyer qu'aucune nappe ne couvre n'en pose pas. */
function souchesDesFoyers(scene: SceneDuBati, nappes: ReturnType<typeof resolveNappes>): OrnementDuBati[] {
  const mpt = sceneMetresPerTile(scene);
  return scene.entities.flatMap((ent): OrnementDuBati[] => {
    const resolu = ent.kind === 'prop' ? decorEnVolume(ent.decor?.id, ent.facing) : null;
    if (!resolu?.prop.conduit) return [];
    const empreinte = propFootTiles(resolu.prop.id, ent.pos, resolu.cap, mpt);
    const xs = empreinte.map((c) => c.x), ys = empreinte.map((c) => c.y);
    const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
    const dos = rotateDir8(resolu.cap, 4) as Dir4;
    const { gx, gy } = DIR8_DELTA[dos];
    const ancre = {
      x: gx === 0 ? (x0 + x1) / 2 : gx > 0 ? x1 + 0.5 : x0 - 0.5,
      y: gy === 0 ? (y0 + y1) / 2 : gy > 0 ? y1 + 0.5 : y0 - 0.5,
    };
    const couverture = hauteurDeCouverture(nappes, empreinte, ancre);
    if (!couverture) return [];
    const z = ent.z ?? 0;
    const solM = heightAt(scene, ent.pos.x, ent.pos.y, z);
    return [{
      id: ent.id,
      source: 'souche',
      prop: SOUCHE.prop,
      case: { x: ent.pos.x, y: ent.pos.y, z },
      ancre,
      solM,
      sureleveM: couverture.hauteurM - solM + SOUCHE.liftM,
      cap: dos,
      nappe: couverture.nappe,
    }];
  });
}

/** Les ornements du bâti de `scene` : ceux de ses façades (`ornementsDeFacade`), les souches de ses foyers
 *  (`souchesDesFoyers`), puis ceux de l'identité de ses bâtiments (`ornementsDIdentite`), sur les nappes résolues
 *  (`resolveNappes`). PUR. */
export function ornementsDuBati(scene: SceneDuBati): OrnementDuBati[] {
  const nappes = resolveNappes(scene);
  return [...ornementsDeFacade(scene, nappes), ...souchesDesFoyers(scene, nappes), ...ornementsDIdentite(scene, nappes)];
}

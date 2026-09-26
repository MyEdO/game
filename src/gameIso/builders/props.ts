/**
 * BUILDER de PROPS — produit les éléments `prop` du pivot (cf. ./types) : le DÉCOR de scène (entités
 * `kind:'prop'` — tonneaux, cadavres, tentes…), les OVERLAYS de TERRAIN à décor (tuile `bois → 'arbre'`),
 * les FEATURES de façade authorées et les ORNEMENTS d'identité d'un bâtiment. Chaque site d'émission
 * DÉCLARE un ancrage (`AncrageDecor` : point monde, cap, sol, case porteuse) et un SEUL émetteur
 * (`elDeDecor`) tranche : un type qui porte une recette volumique (`PropData.volume`) sort en faces
 * MONDE (`propVolumes.ts`), cuites dans la masse commune ; tout autre sort en BILLBOARD du SVG
 * catalogue (`propSvg`), rendu par les DEUX backends (iso/éditeur ET POV). Un site de plus = un ancrage
 * de plus, jamais une seconde règle de rendu. Le mur PLEIN, lui, naît de `solidHeightM` via le relief
 * de `buildFloors`, pas d'ici. PUR et projection-agnostique : identité + case + empreinte + vérités de
 * scène, aucune caméra.
 * Consommé par l'hôte du monde de campagne (`stage/MondeDeCampagne`, qui le sert à SES DEUX regards)
 * et par l'éditeur — mêmes décors partout.
 */
import { Scene, tileAt, heightAt, sceneMetresPerTile, type ArchitectureRect } from '../../state/scene';
import { roofHidden, massFootBBox } from '../../state/buildings';
import { effectiveArchitecture } from '../../state/sceneEdit';
import { decorAncre, decorFootGeometry } from '../../state/footprint';
import { findPropById, refEstVolumique } from '../../data';
import { buildPropVolumes } from './propVolumes';
import { terrainOverlayProp } from '../../state/terrain';
import { buildingFeatures } from '../../state/buildings';
import { facadeFeatureViz } from '../catalog/facades';
import { WALL_H_M } from '../iso';
import { capVolumique, empreinteDuProp } from '../../data/props.types';
import type { Dir4, Dir8 } from '../../state/dir8';
import { edgeKey, fieldHeightAt, nappeKey, resolveNappes, WALL_NB, type RoofField, type RoofShapeSpec } from './roofs';
import type { FloorView } from './floors';
import type { PropEl, OrigineDecor } from './types';
import { CARD_NB, outwardSide, wallEnds } from './walls';

/** La scène porte-t-elle AU MOINS un décor volumique désignable ? Ce que le pointeur demande pour
 *  savoir si une face du monde peut nommer une entité sous le pixel — seul un décor d'ENTITÉ porte un
 *  `entId`, donc seules les entités comptent ici : une scène dont les seuls volumes sont architecturaux
 *  (feature de façade, ornement de bâtiment) n'a rien à désigner, aucun rayon à lancer. */
export const sceneAUnPropVolumique = (scene: Scene): boolean =>
  scene.entities.some((ent) => ent.kind === 'prop' && refEstVolumique(ent.ref));

/** ANCRAGE d'un décor — ce qu'un site d'émission DÉCLARE, avant que l'émetteur unique ne tranche
 *  volume ou billboard. `ancre` est le point MONDE (fractionnaire, en cases) où le décor se pose : le
 *  billboard en dérive son `foot` (décalage à la case porteuse), le volume son origine de recette. */
type AncrageDecor = AncrageDecorBase & OrigineDecor;
interface AncrageDecorBase {
  key: string;
  cell: { x: number; y: number; z: number };
  ancre: { x: number; y: number };
  /** Type de décor demandé. ABSENT = l'entité n'en NOMME aucun : le décor sort en billboard d'ERREUR
   *  (`missingPropSvg`, #877), jamais dans l'art d'un autre type — exactement le sort d'une ref morte. */
  ref: string | undefined;
  /** Altitude métrique de la SURFACE de la case porteuse (relief et couche compris). */
  solM: number;
  /** Surélévation métrique déclarée au-dessus de cette surface (défaut 0). */
  liftM?: number;
  /** Cap du décor. Absent = décor non directionnel ; le volume, lui, retombe sur le cap canonique `S`. */
  facing?: Dir8;
  /** Échelle du DESSIN billboard (défaut 1) — un volume tient ses dimensions de sa recette. */
  echelle?: number;
  architectureFeatureId?: string;
  nappe?: { sectionId: string; cells: readonly { x: number; y: number }[] };
  roomZoneIds?: string[];
  /** L'ancrage ne sait pas s'orienter (arête diagonale, côté sortant indéterminé) : repli BILLBOARD
   *  explicite, une géométrie monde mal tournée traverserait le mur qu'elle habille. */
  sansVolume?: boolean;
  states: { visible: boolean };
}

/** ÉMETTEUR UNIQUE d'un décor : c'est ICI, et nulle part ailleurs dans le rendu, que se DÉCIDE la voie
 *  d'un décor. La règle elle-même vit dans le CATALOGUE (`refEstVolumique`, `src/data/index.ts`) — cet
 *  émetteur la LIT, comme la lisent le validateur de scène (`state/validateScene.ts`) et le sélecteur
 *  d'orientation de l'éditeur (`ui/editor/Inspector.tsx`) ; aucun d'eux ne la redevine. Volume = la
 *  recette compilée sur l'ancre (`buildPropVolumes`) ; billboard = le dessin ancré aux pieds, décalé de
 *  `ancre − cell`. Les deux portent la MÊME identité, la même empreinte et les mêmes vérités de scène. */
function elDeDecor(a: AncrageDecor, mpt: number): PropEl {
  const origine: OrigineDecor = a.source === 'entity'
    ? { source: a.source, entId: a.entId, span: a.span }
    : { source: a.source };
  const commun = {
    kind: 'prop' as const,
    key: a.key,
    cell: a.cell,
    ref: a.ref,
    states: a.states,
    ...origine,
  };
  const prop = !a.sansVolume && refEstVolumique(a.ref) ? findPropById(a.ref) : undefined;
  if (a.ref !== undefined && prop?.volume) {
    const facing = capVolumique(a.facing, `décor volumique « ${a.ref} » (${a.entId ?? a.key})`);
    return {
      ...commun,
      ref: a.ref,
      facing,
      ...(a.nappe ? { nappe: a.nappe } : {}),
      ...(a.roomZoneIds?.length ? { roomZoneIds: a.roomZoneIds } : {}),
      faces: buildPropVolumes(prop, {
        ancre: a.ancre,
        facing,
        baseHeightM: a.solM + (a.liftM ?? 0),
        ...(a.entId ? { entId: a.entId } : {}),
      }, mpt),
    };
  }
  return {
    ...commun,
    ...(a.facing ? { facing: a.facing } : {}),
    ...(a.architectureFeatureId ? { architectureFeatureId: a.architectureFeatureId } : {}),
    foot: { offX: a.ancre.x - a.cell.x, offY: a.ancre.y - a.cell.y, scale: a.echelle ?? 1 },
    ...(a.liftM ? { liftM: a.liftM } : {}),
  };
}

/** CAP d'un ornement de FAÎTE, lu sur la nappe RÉSOLUE : l'axe de faîtage authoré fait foi (`ridge`,
 *  `resolveMassRidge`), jamais la boîte englobante de l'empreinte. Un profil sans faîte franc (croupe,
 *  toit plat) n'oriente rien : cap canonique `S`. */
export function capDuFaite(shape: RoofShapeSpec): Dir8 {
  if (shape.profile === 'hip' || shape.profile === 'flat') return 'S';
  return shape.ridge === 'x' ? 'E' : 'S';
}

/** Éléments `prop` de la scène — TOUTES les couches, sauf ISOLEMENT explicite d'un étage (`viewZ`,
 *  demande de l'appelant : vue du dessus, minimap, `state/viewLevel`). La VISIBILITÉ D'ÉTAGE n'est PAS
 *  une loi de builder : elle appartient à l'écran, qui l'applique APRÈS coup à la MÊME identité que la
 *  masse cuite — `loiDeDégagement` en jeu (`stage/MondeDeCampagne`), `layerHidden` à l'éditeur
 *  (`ui/editor/lowerLayerGabarit`) — cf. #1317. `visible` absent ⇒ tout visible ; un prop de scène en
 *  vue est tagué `visible` (dessiné AU-DESSUS du voile), mémorisé → dessous (grisé). Les overlays de
 *  terrain restent TOUJOURS sous le voile (décor « mémorisé », convention des sols). */
export function buildProps(scene: Scene, visible?: ReadonlySet<string>, view?: FloorView): PropEl[] {
  const mpt = sceneMetresPerTile(scene);
  const viewZ = view?.viewZ ?? null;
  const out: PropEl[] = [];
  // Overlays de TERRAIN à DÉCOR (bois → arbre) — un billboard par tuile (couche de base), MÊME chemin de
  // rendu que les props de scène. `visible` suit le brouillard comme un prop : en vue → au-dessus du voile
  // (donc VISIBLE en POV) ; mémorisé → sous le voile. Éditeur/QC (`visible` absent) → tout visible.
  const { w, h } = scene.dimensions;
  for (const lvl of scene.layers) {
    if (viewZ != null && lvl.z !== viewZ) continue;
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const ref = terrainOverlayProp(tileAt(scene, x, y, lvl.z));
        if (!ref) continue;
        out.push(elDeDecor({
          key: `ov:${x},${y},${lvl.z}`,
          cell: { x, y, z: lvl.z },
          ancre: { x, y },
          solM: heightAt(scene, x, y, lvl.z),
          source: 'terrain',
          ref,
          states: { visible: !visible || visible.has(`${x},${y},${lvl.z}`) },
        }, mpt));
      }
  }
  // Props de scène (décor) — visibles dans les deux modes (exploration ET combat).
  for (const ent of scene.entities) {
    if (ent.kind !== 'prop') continue;
    const z = ent.z ?? 0;
    if (viewZ != null && z !== viewZ) continue;
    // L'empreinte EFFECTIVE au cap de l'instance (#1509) : le corps tourné pour un décor à recette,
    // l'empreinte déclarée pour un billboard. `span` la porte jusqu'au halo d'interaction
    // (`interactHalos.ts`), qui ne connaît l'étendue d'un élément que par lui.
    const empreinte = empreinteDuProp(findPropById(ent.ref), ent.facing, mpt);
    // Le décor s'ancre au CENTRE de son empreinte (`decorFootGeometry` : une case posée y reste sur son
    // centre) — le dessin comme la recette.
    const dessin = decorFootGeometry(empreinte);
    out.push(elDeDecor({
      key: `prop:${ent.id}`,
      cell: { x: ent.pos.x, y: ent.pos.y, z },
      ancre: decorAncre(ent.pos, empreinte),
      echelle: dessin.scale,
      solM: heightAt(scene, ent.pos.x, ent.pos.y, z),
      span: { w: empreinte.w, h: empreinte.h },
      source: 'entity',
      entId: ent.id,
      ref: ent.ref,
      ...(ent.facing ? { facing: ent.facing } : {}),
      states: { visible: !visible || visible.has(`${ent.pos.x},${ent.pos.y},${z}`) },
    }, mpt));
  }
  const physicalEdges = new Set((scene.walls ?? []).map((wall) => edgeKey(wall)));
  const emittedFeatures = new Set<string>();
  const nappes = resolveNappes(scene);
  for (const body of scene.architecture ?? []) {
    for (const section of body.facades) {
      const sectionEdges = new Set(section.edges.map((edge) =>
        edgeKey({ ...edge, z: edge.z ?? section.z })));
      for (const feature of section.features ?? []) {
        const edge = { ...feature.edge, z: feature.edge.z ?? section.z };
        const z = edge.z;
        if (viewZ != null && z !== viewZ) continue;
        const edgeId = edgeKey(edge);
        const featureId = `${body.id}:${section.id}:${feature.id}`;
        if (emittedFeatures.has(featureId) || !sectionEdges.has(edgeId) || !physicalEdges.has(edgeId)) continue;
        const viz = facadeFeatureViz(section.appearance, feature.kind);
        if (!viz) continue;
        emittedFeatures.add(featureId);
        const offset = feature.offset ?? 0.5;
        const [a, b] = wallEnds(edge);
        const ancre = {
          x: a.x + (b.x - a.x) * offset,
          y: a.y + (b.y - a.y) * offset,
        };
        const [nx, ny] = WALL_NB[edge.side];
        // CÔTÉ SORTANT (`outwardSide`, l'unique lecture du dehors du dépôt) : le cap vers lequel le décor
        // habille le mur. Indéterminé (arête diagonale ou intérieure) ⇒ repli billboard déclaré.
        const sortant = outwardSide(scene, edge);
        const solM = heightAt(scene, edge.x, edge.y, z);
        // SURFACE de référence du décalage, DÉCLARÉE par la vignette (`FacadeFeatureViz.base`) : le sol
        // de la case, ou la COUVERTURE à l'aplomb de l'ancre. La surelévation totale est calculée ICI,
        // une fois, et sert les DEUX représentations — le volume la reçoit dans son pied
        // (`baseHeightM`), le billboard la porte en `liftM`.
        const couverture = viz.base === 'toit'
          ? hauteurDeCouverture(nappes, [{ x: edge.x, y: edge.y }, { x: edge.x + nx, y: edge.y + ny }], ancre)
          : null;
        const surelevation = viz.base === 'toit' && couverture == null
          ? 0 // repli DÉCLARÉ : pas de couverture, donc rien à quoi rapporter le décalage
          : (couverture != null ? couverture - solM : 0) + (viz.liftM ?? 0);
        out.push(elDeDecor({
          key: `arch:${featureId}`,
          cell: { x: edge.x, y: edge.y, z },
          ancre,
          echelle: viz.scale ?? 1,
          solM,
          ...(surelevation !== 0 ? { liftM: surelevation } : {}),
          source: 'architecture',
          architectureFeatureId: featureId,
          ref: feature.appearance ?? viz.prop,
          ...(sortant ? { facing: sortant } : { sansVolume: true }),
          states: {
            visible: !visible ||
              visible.has(`${edge.x},${edge.y},${z}`) ||
              visible.has(`${edge.x + nx},${edge.y + ny},${z}`),
          },
        }, mpt));
      }
    }
  }
  // Ornements d'IDENTITÉ par TYPE de bâtiment (clocheton/cheminée/enseigne/étal) — dérivés de
  // `buildingFeatures(body.style)`, un jeu par MASSE (#822), posés SUR (faîte/façade) ou DEVANT (étal) le
  // bâtiment. 100 % donnée : aucun cas en dur par id de scène.
  for (const body of effectiveArchitecture(scene)) {
    const feats = buildingFeatures(body.style);
    if (!feats.length) continue;
    for (const mass of body.masses) {
      const z = mass.z;
      const f = massFootBBox(mass.footprint);
      // Égout et FAÎTE lus sur le CHAMP de la nappe (`resolveNappes`) — la MÊME hauteur que les pans
      // que `buildRoofs` émet, jamais une seconde formule. Un ornement de FAÎTE se pose à ~60 % de la
      // pente sous l'apex.
      // Masse sans nappe : son ornement est OMIS (le reste des props se construit).
      const nappe = nappes.get(nappeKey(body.id, mass.id));
      if (!nappe) continue;
      const { cells, field, roomZoneIds } = nappe;
      const eaveM = field.shape.eaveHeightM;
      let apexM = eaveM;
      for (const key of cells) {
        const [x, y] = key.split(',').map(Number);
        for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]] as const)
          apexM = Math.max(apexM, fieldHeightAt(field, { x: x + dx, y: y + dy }));
      }
      const cx = f.x + Math.floor(f.w / 2), cy = f.y + Math.floor(f.h / 2);
      const vis = roofFootVisible(f, z, visible);
      // Cutaway : toit LEVÉ pour montrer l'intérieur (un allié sous l'empreinte) → un ornement de FAÎTE
      // flotterait au-dessus du vide ; on le SAUTE (MÊME `roofHidden` que `buildRoofs`). Façade/étal, au
      // sol, restent — le toit levé ne les occulte pas.
      const roofCut = !!view?.allies && roofHidden(f, view.allies);
      let door: DoorAnchor | null = null; // résolu PARESSEUSEMENT (façade/front seulement)
      feats.forEach((feat, i) => {
        const base = {
          key: `orn:${body.id}:${mass.id}:${i}`,
          source: 'ornament' as const,
          ref: feat.id,
          states: { visible: vis },
        };
        if (feat.anchor === 'ridge') {
          // REPLI BILLBOARD seulement : ce saut ne gouverne QUE le faîteau dessiné (l'appelant qui
          // passe une vue — POV, éditeur). Un faîteau VOLUMIQUE, lui, est cuit dans la masse commune
          // par un appel SANS vue et se retire par la nappe qu'il déclare (`nappePorteuse`, loi de
          // dégagement de l'hôte, parité testée dans `stage/monde-de-campagne.test.tsx`) : deux
          // représentations, deux lois.
          if (roofCut) return;
          // Faîte : ancré au MILIEU de l'empreinte du toit et surélevé sur la pente (posé, pas
          // flottant), au cap du faîtage résolu. La NAPPE porteuse est déclarée : l'ornement volumique
          // se lève et retombe avec elle (`nappePorteuse`, loi de dégagement de l'hôte).
          out.push(elDeDecor({
            ...base,
            cell: { x: f.x, y: f.y, z },
            ancre: { x: f.x + (f.w - 1) / 2, y: f.y + (f.h - 1) / 2 },
            facing: capDuFaite(field.shape),
            solM: heightAt(scene, cx, cy, z),
            liftM: eaveM - heightAt(scene, cx, cy, z) + 0.6 * (apexM - eaveM),
            nappe: { sectionId: mass.id, cells: cellsOf(cells) },
            ...(roomZoneIds?.length ? { roomZoneIds } : {}),
          }, mpt));
          return;
        }
        door ??= buildingDoor(scene, f, z);
        // 'facade' comme 'front' : ancré à la case JUSTE À L'EXTÉRIEUR de la porte (le mur PLEIN, +0.45 de
        // profondeur, masquerait un décor posé à l'intérieur). L'ENSEIGNE s'ancre une demi-case plus au
        // large — son billboard, dessiné à plat sur la case, mordrait sinon cette profondeur de mur — et
        // pend en haut de la façade ; l'ÉTAL reste plaqué au sol devant la porte. Les deux tournés vers
        // l'EXTÉRIEUR (face à qui approche).
        const [ox, oy] = CARD_NB[door.facing];
        const facade = feat.anchor === 'facade';
        out.push(elDeDecor({
          ...base,
          cell: { x: door.frontCell.x, y: door.frontCell.y, z },
          ancre: {
            x: door.frontCell.x + (facade ? ox * 0.5 : 0),
            y: door.frontCell.y + (facade ? oy * 0.5 : 0),
          },
          facing: door.facing, // Dir8 vers l'EXTÉRIEUR
          solM: heightAt(scene, door.frontCell.x, door.frontCell.y, z),
          liftM: facade ? WALL_H_M * 0.55 : 0, // enseigne : haut de la façade ; étal : au sol
        }, mpt));
      });
    }
  }
  return out;
}

/**
 * Hauteur (m) de la COUVERTURE à l'aplomb d'un point d'ancrage d'arête, ou `null` si aucune nappe ne
 * couvre l'une des cases candidates (celle de l'arête et sa voisine d'en face : une cheminée est
 * ASSISE sur le mur, la couverture qui la porte est d'un côté ou de l'autre). Lit le CHAMP des nappes
 * (`resolveNappes` + `fieldHeightAt`), la source unique des hauteurs de toit — jamais une seconde
 * formule. Le repère du champ est celui des COINS de case (coin nord-ouest de `(x,y)` = point
 * `(x,y)`), là où l'ancre vit dans le repère graphique (centre de case en `(x,y)`) : d'où le `+0.5`.
 * Deux nappes couvrent le point ? La PLUS HAUTE gagne — un décor perce la couverture qui le coiffe.
 */
function hauteurDeCouverture(
  nappes: ReadonlyMap<string, { cells: ReadonlySet<string>; field: RoofField }>,
  cases: readonly { x: number; y: number }[],
  ancre: { x: number; y: number },
): number | null {
  let haut: number | null = null;
  for (const nappe of nappes.values()) {
    if (!cases.some((c) => nappe.cells.has(`${c.x},${c.y}`))) continue;
    const h = fieldHeightAt(nappe.field, { x: ancre.x + 0.5, y: ancre.y + 0.5 });
    if (haut === null || h > haut) haut = h;
  }
  return haut;
}

/** Cellules d'une nappe (clés « x,y ») en points de grille — la forme que porte l'élément. */
const cellsOf = (cells: ReadonlySet<string>): { x: number; y: number }[] =>
  [...cells].map((key) => {
    const [x, y] = key.split(',').map(Number);
    return { x, y };
  });

/** Ancrage EXTÉRIEUR de la PORTE d'un bâtiment (résolu depuis `scene.walls`) : case juste À L'EXTÉRIEUR de
 *  la porte + cap cardinal SORTANT. Robuste à la canonisation N/E des arêtes (une porte 'S'/'O' est
 *  stockée sur la case voisine). Repli : façade SUD, sous le centre bas de l'empreinte. */
interface DoorAnchor {
  frontCell: { x: number; y: number };
  facing: Dir4;
}
function buildingDoor(scene: Scene, f: ArchitectureRect, z: number): DoorAnchor {
  const x0 = f.x, y0 = f.y, x1 = f.x + f.w - 1, y1 = f.y + f.h - 1;
  for (const w of scene.walls ?? []) {
    if (!w.door || (w.z ?? 0) !== z) continue;
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

/** Un ornement de toit est VISIBLE dès qu'une case de l'empreinte ÉLARGIE d'1 est en vue (règle IDENTIQUE
 *  à `buildRoofs` — on voit le bâtiment dès qu'on est à son pied). `visible` absent (éditeur/QC) ⇒ tout visible. */
function roofFootVisible(f: { x: number; y: number; w: number; h: number }, z: number, visible?: ReadonlySet<string>): boolean {
  if (!visible) return true;
  for (let dy = -1; dy <= f.h; dy++) for (let dx = -1; dx <= f.w; dx++) if (visible.has(`${f.x + dx},${f.y + dy},${z}`)) return true;
  return false;
}

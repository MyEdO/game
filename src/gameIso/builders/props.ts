/**
 * BUILDER de PROPS — produit les éléments `prop` du pivot (cf. ./types) : le DÉCOR de scène (entités
 * `kind:'prop'` — tonneaux, cadavres, tentes…), les OVERLAYS de TERRAIN à décor (`decorDuTerrain` : une essence du `bois`),
 * les ornements du BÂTI posés par le noyau (`ornementsDuBati` : features de façade authorées, ornements
 * d'identité d'un bâtiment). Chaque site d'émission
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
import { Scene, tileAt, heightAt, sceneMetresPerTile } from '../../noyau/monde/scene';
import { roofHidden } from '../../noyau/monde/buildings';
import { ancreDuDecor, decorFootGeometry } from '../../noyau/monde/footprint';
import { findPropById, refEstVolumique } from '../../data';
import { facesDuDecor } from '../../noyau/monde/volume/propVolumes';
import { ornementsDuBati } from '../../noyau/monde/volume/ornements';
import { resolveNappes } from '../../noyau/monde/volume/toits';
import { decorDuTerrain } from '../../noyau/monde/terrain';
import { capVolumique, empreinteDuProp } from '../../data/props.types';
import type { Dir8 } from '../../geometry/dir8';
import type { FloorView } from '../../noyau/monde/volume/floors';
import type { PropEl, OrigineDecor } from './types';

/** La scène porte-t-elle AU MOINS un décor volumique désignable ? Ce que le pointeur demande pour
 *  savoir si une face du monde peut nommer une entité sous le pixel — seul un décor d'ENTITÉ porte un
 *  `entId`, donc seules les entités comptent ici : une scène dont les seuls volumes sont architecturaux
 *  (feature de façade, ornement de bâtiment) n'a rien à désigner, aucun rayon à lancer. */
export const sceneAUnPropVolumique = (scene: Scene): boolean =>
  scene.entities.some((ent) => ent.kind === 'prop' && refEstVolumique(ent.decor?.id));

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
  /** Cap du décor. Absent = décor non orienté ; le volume, lui, retombe sur le cap canonique `S`. */
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
 *  émetteur la LIT, comme la lisent le validateur de scène (`noyau/validateScene.ts`) et le sélecteur
 *  d'orientation de l'éditeur (`ui/editor/Inspector.tsx`) ; aucun d'eux ne la redevine. Volume = la
 *  recette compilée sur l'ancre (`facesDuDecor`) ; billboard = le dessin ancré aux pieds, décalé de
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
  const faces = a.sansVolume ? null : facesDuDecor(a.ref, {
    ancre: a.ancre,
    ...(a.facing ? { facing: a.facing } : {}),
    baseHeightM: a.solM + (a.liftM ?? 0),
    ...(a.entId ? { entId: a.entId } : {}),
  }, mpt);
  if (faces) {
    return {
      ...commun,
      ref: a.ref!,
      facing: capVolumique(a.facing)!,
      ...(a.nappe ? { nappe: a.nappe } : {}),
      ...(a.roomZoneIds?.length ? { roomZoneIds: a.roomZoneIds } : {}),
      faces,
    };
  }
  return {
    ...commun,
    // Cap refusé d'un décor volumique (`capVolumique`) : billboard d'ERREUR (#877), jamais son art.
    ...(!a.sansVolume && refEstVolumique(a.ref) ? { ref: undefined } : {}),
    ...(a.facing ? { facing: a.facing } : {}),
    ...(a.architectureFeatureId ? { architectureFeatureId: a.architectureFeatureId } : {}),
    foot: { offX: a.ancre.x - a.cell.x, offY: a.ancre.y - a.cell.y, scale: a.echelle ?? 1 },
    ...(a.liftM ? { liftM: a.liftM } : {}),
  };
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
  // Overlays de TERRAIN à DÉCOR (`decorDuTerrain` : le décor et le cap de la case) — un décor par tuile, MÊME
  // chemin de rendu que les props de scène. `visible` suit le brouillard comme un prop : en vue → au-dessus du voile
  // (donc VISIBLE en POV) ; mémorisé → sous le voile. Éditeur/QC (`visible` absent) → tout visible.
  const { w, h } = scene.dimensions;
  for (const lvl of scene.layers) {
    if (viewZ != null && lvl.z !== viewZ) continue;
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const decor = decorDuTerrain(tileAt(scene, x, y, lvl.z), x, y, lvl.z);
        if (!decor) continue;
        out.push(elDeDecor({
          key: `ov:${x},${y},${lvl.z}`,
          cell: { x, y, z: lvl.z },
          ancre: { x, y },
          solM: heightAt(scene, x, y, lvl.z),
          source: 'terrain',
          ref: decor.prop,
          facing: decor.cap,
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
    const empreinte = empreinteDuProp(findPropById(ent.decor?.id), ent.facing, mpt);
    // Le décor s'ancre au CENTRE de son empreinte (`decorFootGeometry` : une case posée y reste sur son
    // centre) — le dessin comme la recette.
    const dessin = decorFootGeometry(empreinte);
    out.push(elDeDecor({
      key: `prop:${ent.id}`,
      cell: { x: ent.pos.x, y: ent.pos.y, z },
      ancre: ancreDuDecor(ent, mpt),
      echelle: dessin.scale,
      solM: heightAt(scene, ent.pos.x, ent.pos.y, z),
      span: { w: empreinte.w, h: empreinte.h },
      source: 'entity',
      entId: ent.id,
      ref: ent.decor?.id,
      ...(ent.facing ? { facing: ent.facing } : {}),
      states: { visible: !visible || visible.has(`${ent.pos.x},${ent.pos.y},${z}`) },
    }, mpt));
  }
  // Ornements du BÂTI (`ornementsDuBati`) : la pose vient du noyau, le web n'y ajoute que son affichage — repli
  // billboard d'un ornement sans cap, vérités de vue, faîte sauté sous un toit levé, nappe porteuse
  // (`nappePorteuse`).
  const nappes = resolveNappes(scene);
  for (const o of ornementsDuBati(scene)) {
    const z = o.case.z;
    const porteuse = o.nappe ? nappes.get(o.nappe) : undefined;
    const surLaNappe = porteuse ? {
      nappe: {
        sectionId: porteuse.mass.id,
        cells: [...porteuse.cells].map((k) => {
          const [x, y] = k.split(',').map(Number);
          return { x, y };
        }),
      },
      ...(porteuse.roomZoneIds.length ? { roomZoneIds: porteuse.roomZoneIds } : {}),
    } : {};
    if (o.source === 'architecture') {
      if (viewZ != null && z !== viewZ) continue;
      out.push(elDeDecor({
        key: `arch:${o.id}`,
        cell: o.case,
        ancre: o.ancre,
        echelle: o.echelle,
        solM: o.solM,
        ...(o.sureleveM !== 0 ? { liftM: o.sureleveM } : {}),
        source: 'architecture',
        architectureFeatureId: o.id,
        ref: o.prop,
        ...surLaNappe,
        ...(o.cap ? { facing: o.cap } : { sansVolume: true }),
        states: { visible: !visible || o.cotes.some((c) => visible.has(`${c.x},${c.y},${z}`)) },
      }, mpt));
      continue;
    }
    // Cutaway : un faîteau DESSINÉ (appelant qui passe une vue — POV, éditeur) flotterait au-dessus du toit levé
    // (MÊME `roofHidden` que `buildRoofs`) ; un faîteau VOLUMIQUE, cuit sans vue, se retire par la nappe qu'il
    // déclare (`nappePorteuse`, loi de dégagement de l'hôte, `stage/monde-de-campagne.test.tsx`).
    if (o.nappe && view?.allies && roofHidden(o.emprise, view.allies)) continue;
    out.push(elDeDecor({
      key: `orn:${o.id}`,
      cell: o.case,
      ancre: o.ancre,
      ...(o.cap ? { facing: o.cap } : {}),
      solM: o.solM,
      liftM: o.sureleveM,
      source: 'ornament',
      ref: o.prop,
      ...surLaNappe,
      states: { visible: roofFootVisible(o.emprise, z, visible) },
    }, mpt));
  }
  return out;
}

/** Un ornement de toit est VISIBLE dès qu'une case de l'empreinte ÉLARGIE d'1 est en vue (règle IDENTIQUE
 *  à `buildRoofs` — on voit le bâtiment dès qu'on est à son pied). `visible` absent (éditeur/QC) ⇒ tout visible. */
function roofFootVisible(f: { x: number; y: number; w: number; h: number }, z: number, visible?: ReadonlySet<string>): boolean {
  if (!visible) return true;
  for (let dy = -1; dy <= f.h; dy++) for (let dx = -1; dx <= f.w; dx++) if (visible.has(`${f.x + dx},${f.y + dy},${z}`)) return true;
  return false;
}

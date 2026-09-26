/** Fondation pure de l’éditeur : outils, calques, sélection et mutations de scène. */
import { Scene, SceneEntity, SceneEffectZone, Terrain, WallSide, ZoneArea } from '../../state/scene';
import { sceneZoneTiles, zoneAreaTiles } from '../../state/zones';
import type { Pt as ScenePt } from '../../state/path';
import { walkFlow, type Flow } from '../../state/flow';
import { nextEntityId } from '../../state/entityId';
import { PROPS } from '../../gameIso/catalog/decor';
import { creatureLabel, findCreatureById } from '../../data';
import { propRefPatch } from './propDefaults';
import { libelleDeValeur } from '../../data/schemas/grammaire/meta';
import { entityKindSchema } from '../../data/schemas/defs-scenes/scene';
import { type Rect, type Pt, type EffectZoneSeed, canonEdge, edgeWallState, rectFrom, entityAt, addEntity, editEntity, moveEntityTo, removeEntity } from '../../state/sceneEdit';

export {
  addArchitectureBody,
  addArchitectureStorey,
  addArchitecturePart,
  addFacadeSection,
  addBuildingMass,
  rectFrom,
  paintTiles,
  fillTerrainRect,
  addLayer,
  removeLayer,
  canonEdge,
  edgeWallState,
  setEdgeWall,
  toggleEdgeWall,
  toggleDiagonalWall,
  patchWall,
  paintHeight,
  paintCrenellated,
  placeEmplacement,
  setPosteCrew,
  setPosteSide,
  setPosteEngine,
  pasteEntity,
  placeEntry,
  renameEntry,
  addTrigger,
  addRestZone,
  addEffectZone,
  renameEffectZone,
  addMember,
  removeMember,
  patchMember,
  addEnemyMember,
  eraseAt,
  setMetresPerTile,
  setAmbientLight,
  setNorthDeg,
  setEnvironment,
  setSceneFlags,
  entityAt,
  editEntity,
  editEntityCombat,
} from '../../state/sceneEdit';
export type { Rect, Pt, EffectZoneSeed } from '../../state/sceneEdit';
import type { CellSide } from '../../state/scene';
export type { CellSide } from '../../state/scene';
export { planStairFlight, applyStairFlight, minFlightCells } from '../../state/stairFlight';
export type { StairCell, StairStep, StairFlightPlan } from '../../state/stairFlight';

/** Outil actif (rail de la Palette). `ref` permet la pose DIRECTE d'un décor ou d'une fiche précise.
 *  L'outil d'ENTITÉ est SCINDÉ par `kind` (#877, #1882) : un décor NOMME son type au catalogue, un
 *  personnage NOMME sa fiche au bestiaire — `ref` y est REQUISE, comme au schéma de scène
 *  (`PORTEURS_DU_TYPE`) — et le départ des héros n'a rien à référencer. */
export type Tool =
  | { mode: 'select' }
  | { mode: 'tile'; terrain: Terrain }
  | { mode: 'entity'; kind: 'prop'; ref: string }
  | { mode: 'entity'; kind: 'personnage'; ref: string }
  | { mode: 'entity'; kind: 'heroStart' }
  | { mode: 'zone'; zone: ZoneVariant }
  // EMPRISE d'une zone d'effet au PINCEAU (`SceneEffectZone.tiles`) : `zoneId` = id STABLE de la zone
  // peinte, `paint` le sens du geste — l'appui et le glissé ajoutent (ou retirent) des cases, comme le
  // pinceau de terrain pose son terrain. Corriger une pièce qui déborde se fait SUR la carte.
  | { mode: 'zoneTiles'; zoneId: string; paint: 'add' | 'remove' }
  | { mode: 'entry' }
  | { mode: 'encounter' }
  // `structure` (id de `structures.json`) = le MATÉRIAU porté par l'outil, mémorisé entre les poses
  // (comme un outil de peinture porte sa couleur) — plus besoin de repasser par l'inspecteur (#830).
  | { mode: 'wall'; paint: WallPaint; structure?: string }
  // Hauteur métrique d'une surface (porteuse : marchabilité/combat/chute, cf. `relief.ts`). On peint des
  // MÈTRES ; la traversée verticale s'auto-dérive du delta de hauteur (`surfaceLink`), sans escalier.
  | { mode: 'height'; metres: number }
  // VOLÉE d'escalier : file de cases dont les cotes montent par crans franchissables jusqu'au plancher
  // de l'étage `toZ` (invariant PARTAGÉ avec le compilateur ASCII — `state/stairFlight.ts`). L'outil ne
  // pose AUCUN décor : une volée est du relief, la traversée s'en dérive comme pour toute surface.
  | { mode: 'stair'; toZ: number }
  // Emplacement de siège : pose une SceneEntity portant un poste d'artillerie (`trappingId` = engin du
  // catalogue `armes-de-siege`). Le créneau (arc) et l'équipage s'éditent ensuite dans l'inspecteur.
  | { mode: 'emplacement'; trappingId: string }
  // Crénelage (#841 FU-H) : marque le pourtour peint comme portant un PARAPET crénelé (décoration de
  // rendu — `paintCrenellated`, orthogonal à `height`). `structure` = id de `structures.json` (le rendu en
  // dérive merlons/bandes/arase) ; `null` = gomme la marque.
  | { mode: 'crenellated'; structure: string | null }
  | { mode: 'erase' };

/** Variantes de l'outil ZONE (rail « zone » de la Palette). `room` et `effect` produisent toutes deux
 *  une `SceneEffectZone` ; ce qui les distingue est leur GRAINE ci-dessous, pas le créateur. */
export type ZoneVariant = 'room' | 'trigger' | 'rest' | 'effect';

/** Ce que chaque variante de zone d'effet DONNE à la zone qu'elle dessine — déclaré ICI, à côté du
 *  choix de la variante, et passé tel quel à `addEffectZone`. La PIÈCE naît nue : un intérieur, un nom
 *  à renommer, aucune mécanique (`isDescriptiveZone`). */
export const EFFECT_ZONE_SEEDS: Record<'room' | 'effect', EffectZoneSeed> = {
  room: { label: 'Pièce', presentation: 'interior' },
  effect: { label: 'Piège', onCross: [{ op: 'wounds', amount: 5, ignoreTB: false, ignoreAP: true }] },
};

/** Sous-mode de l'outil MURS : cloison pleine, porte (arête franchissable), ou diagonale en travers. */
export type WallPaint = 'wall' | 'door' | 'diagBack' | 'diagFwd';

/** Calques masquables du canvas (masquer débloque le clic sur ce qu'il y a dessous). `zones` porte
 *  TOUTE zone d'effet, descriptive (nom de pièce) comme mécanique (piège/barrière) — une zone qui
 *  reçoit un effet ne change pas de calque, donc ne disparaît pas. Ce qui distingue les deux natures
 *  est leur ENCRE (`zoneInk`, EditorCanvas) : la pièce n'a qu'un liseré, le piège porte l'aplat. */
export type Layers = { triggers: boolean; spawns: boolean; roofs: boolean; entries: boolean; rest: boolean; zones: boolean };
// Tout ce que la scène porte est VISIBLE et cliquable à l'ouverture : un calque éteint cache
// l'élément ET bloque son clic, et rien à l'écran ne dit qu'une case à cocher le retient.
export const DEFAULT_LAYERS: Layers = { triggers: true, spawns: true, roofs: true, entries: true, rest: true, zones: true };

/** Sélection unifiée — une seule chose sélectionnée à la fois, sur la carte comme dans les panneaux. */
export type Sel =
  | null
  | { type: 'entity' | 'trigger' | 'entry'; id: string }
  | { type: 'restZone'; idx: number }
  | { type: 'effectZone'; idx: number }
  | { type: 'architectureBody'; id: string }
  | { type: 'architectureStorey'; bodyId: string; id: string }
  | { type: 'architecturePart'; bodyId: string; storeyId: string; id: string }
  | { type: 'facadeSection'; bodyId: string; id: string }
  | { type: 'roofSection'; bodyId: string; id: string }
  // Arête de mur (cloison/porte) désignée par sa forme CANONIQUE (case + N|E + couche) — éditable dans
  // l'inspecteur (type, structure destructible). Posée par l'outil murs, sélectionnée à l'outil ↖.
  | { type: 'wall'; x: number; y: number; side: WallSide; z: number };

/** Combien d'EFFETS un Flow authoré porte-t-il, à TOUTE profondeur — les feuilles `do` nichées sous
 *  un `si`, un `test` ou un `choix` comptent autant que celles de premier niveau. C'est le nombre que
 *  l'atelier annonce (pastille du dock, bouton « Effets (N) » de l'inspecteur) : un trigger dont tout
 *  l'effet vit dans une branche est un trigger qui AGIT. Distinct de `flowEffects` (moteur), qui
 *  n'énumère que le premier niveau parce que ses index CLÉENT les interactions d'entité. */
export function flowEffectCount(flow: Flow): number {
  let n = 0;
  walkFlow(flow, (node) => {
    if (node.kind === 'do') n++;
  });
  return n;
}

/** Rect englobant l'aire d'une zone d'effet (disque → sa boîte). */
export function effectZoneRect(area: ZoneArea): Rect {
  if (area.kind === 'disc') return { x: area.cx - area.radius, y: area.cy - area.radius, w: area.radius * 2 + 1, h: area.radius * 2 + 1 };
  return { x: area.x, y: area.y, w: area.w, h: area.h };
}

/** Aire de forme `kind` occupant la boîte `r` : un disque prend le centre de la boîte et le rayon qui
 *  y tient (côté impair → boîte exacte). Conversion RÉVERSIBLE d'un aller-retour rect→disc→rect sur
 *  une boîte carrée impaire ; l'auteur reste maître du rayon exact par le champ dédié. */
export function effectZoneArea(kind: ZoneArea['kind'], r: Rect): ZoneArea {
  if (kind === 'rect') return { kind: 'rect', ...r };
  const radius = Math.max(0, Math.floor((Math.max(r.w, r.h) - 1) / 2));
  return { kind: 'disc', cx: r.x + Math.floor(r.w / 2), cy: r.y + Math.floor(r.h / 2), radius };
}

/** Clé d'appartenance d'une case à une emprise — (x,y) seuls : l'étage est celui de la ZONE. */
const tileKey = (p: Pt) => `${p.x},${p.y}`;

/** Case de l'emprise, à l'étage de la zone (`z` omis au rez, comme `zoneAreaTiles`). */
const carveTile = (p: Pt, z?: number): ScenePt => (z ? { x: p.x, y: p.y, z } : { x: p.x, y: p.y });

/** Emprise NORMALISÉE : `tiles` disparaît dès que la découpe couvre TOUTE l'aire (« pleine » n'a
 *  qu'une seule représentation) et se matérialise sinon, triée pour un document stable. */
function withCarve(zone: SceneEffectZone, tiles: ScenePt[]): SceneEffectZone {
  const full = zoneAreaTiles(zone.area, zone.z);
  const next = { ...zone };
  if (tiles.length >= full.length) delete next.tiles;
  else next.tiles = [...tiles].sort((a, b) => a.y - b.y || a.x - b.x);
  return next;
}

/** Boîte englobant la boîte de `area` ET la case `p` — support d'une emprise peinte HORS de l'aire. */
function areaCovering(area: ZoneArea, p: Pt): ZoneArea {
  const r = effectZoneRect(area);
  const x = Math.min(r.x, p.x);
  const y = Math.min(r.y, p.y);
  return { kind: 'rect', x, y, w: Math.max(r.x + r.w, p.x + 1) - x, h: Math.max(r.y + r.h, p.y + 1) - y };
}

/** PINCEAU d'emprise : met la case `p` DANS la zone (`add`) ou l'en SORT (`remove`), sans jamais
 *  basculer — repasser sur une case déjà peinte au glissé la laisse telle quelle. Peindre hors de la
 *  boîte de l'aire l'ÉTEND à la boîte englobante et matérialise l'emprise : la boîte n'est alors
 *  qu'un cadre, `sceneZoneTiles` reste exactement ce qui est peint (un disque peint au-delà de son rayon
 *  devient donc une emprise explicite dans une boîte rect). */
export function paintEffectZoneTile(zone: SceneEffectZone, p: Pt, paint: 'add' | 'remove'): SceneEffectZone {
  const cur = sceneZoneTiles(zone);
  const key = tileKey(p);
  const inside = cur.some((t) => tileKey(t) === key);
  if (inside === (paint === 'add')) return zone;
  if (paint === 'remove') return withCarve(zone, cur.filter((t) => tileKey(t) !== key));
  const full = zoneAreaTiles(zone.area, zone.z);
  const area = full.some((t) => tileKey(t) === key) ? zone.area : areaCovering(zone.area, p);
  return withCarve({ ...zone, area }, [...cur, carveTile(p, zone.z)]);
}

/** Peint l'emprise de la zone d'id STABLE `zoneId` — couture de l'outil `zoneTiles` du canevas. */
export function paintEffectZone(scene: Scene, zoneId: string, p: Pt, paint: 'add' | 'remove'): Scene {
  const zones = scene.effectZones ?? [];
  if (!zones.some((z) => z.id === zoneId)) return scene;
  return { ...scene, effectZones: zones.map((z) => (z.id === zoneId ? paintEffectZoneTile(z, p, paint) : z)) };
}

/** Rétablit l'emprise PLEINE (la zone occupe toute son aire) — retire la découpe. */
export function clearEffectZoneCarve(zone: SceneEffectZone): SceneEffectZone {
  const next = { ...zone };
  delete next.tiles;
  return next;
}

/** Change l'AIRE d'une zone en emportant sa découpe : les cases retenues SUIVENT la boîte (translation)
 *  puis sont ROGNÉES à la nouvelle aire. Sans ce recalage, déplacer ou redimensionner une zone découpée
 *  laisserait une emprise qui ne correspond plus à rien. */
export function setEffectZoneArea(zone: SceneEffectZone, area: ZoneArea): SceneEffectZone {
  if (!zone.tiles) return { ...zone, area };
  const from = effectZoneRect(zone.area);
  const to = effectZoneRect(area);
  const moved = zone.tiles.map((t) => carveTile({ x: t.x + (to.x - from.x), y: t.y + (to.y - from.y) }, zone.z));
  const inside = new Set(zoneAreaTiles(area, zone.z).map(tileKey));
  return withCarve({ ...zone, area }, moved.filter((t) => inside.has(tileKey(t))));
}

const inRect = (p: Pt, r: Rect) => p.x >= r.x && p.x < r.x + r.w && p.y >= r.y && p.y < r.y + r.h;
const clamp = (v: number, max: number) => Math.max(0, Math.min(max - 1, v));

/** Deux sélections désignent-elles le même élément ? */
export function sameSel(a: Sel, b: Sel): boolean {
  if (!a || !b || a.type !== b.type) return a === b;
  if (a.type === 'restZone' && b.type === 'restZone') return a.idx === b.idx;
  if (a.type === 'effectZone' && b.type === 'effectZone') return a.idx === b.idx;
  if (a.type === 'wall' && b.type === 'wall') return a.x === b.x && a.y === b.y && a.side === b.side && a.z === b.z;
  if (a.type === 'architecturePart' && b.type === 'architecturePart') return a.bodyId === b.bodyId && a.storeyId === b.storeyId && a.id === b.id;
  if (a.type === 'architectureBody' && b.type === 'architectureBody') return a.id === b.id;
  if (a.type === 'architectureStorey' && b.type === 'architectureStorey') return a.bodyId === b.bodyId && a.id === b.id;
  if ((a.type === 'facadeSection' && b.type === 'facadeSection') || (a.type === 'roofSection' && b.type === 'roofSection')) return a.bodyId === b.bodyId && a.id === b.id;
  return (a as { id: string }).id === (b as { id: string }).id;
}

/** Élément occupant la case p — priorité entité > entrée > trigger > zone repos > toit.
 *  Les calques masqués sont ignorés (cliquer « à travers »). Le calque `spawns` masque les entités
 *  de COMBAT cachées (embusqueurs) : on ne peut alors cliquer que les PNJ visibles. `activeBodyId` (mode
 *  Architecture, #841 FU-C) : un clic qui ne touche aucune feuille désigne le CONTENEUR actif — l'étage
 *  à `currentLayer` s'il existe, sinon le corps lui-même (seul moyen de sélectionner/supprimer un corps
 *  ou un étage encore sans partie/masse/façade au clic). Jamais hors mode architecture (undefined). */
export function hitAt(scene: Scene, p: Pt, layers: Layers, currentLayer = 0, activeBodyId?: string): Sel {
  // `entityAt` = prédicat UNIQUE position×couche (#835 FU-3) : une entité d'une AUTRE couche ne
  // masque plus le picking des couches d'annotation/toit sous-jacentes.
  const ent = entityAt(scene, p, currentLayer);
  if (ent && (layers.spawns || !ent.combat?.hiddenUntilCombat)) return { type: 'entity', id: ent.id };
  if (layers.entries)
    for (const [name, pos] of Object.entries(scene.entryPoints ?? {}))
      if (pos.x === p.x && pos.y === p.y && (pos.z ?? 0) === currentLayer) return { type: 'entry', id: name };
  if (layers.triggers) {
    const t = scene.triggers.find((t) => (t.rect.z ?? 0) === currentLayer && inRect(p, t.rect));
    if (t) return { type: 'trigger', id: t.id };
  }
  if (layers.rest) {
    const zi = (scene.restZones ?? []).findIndex((z) => (z.rect.z ?? 0) === currentLayer && inRect(p, z.rect));
    if (zi >= 0) return { type: 'restZone', idx: zi };
  }
  if (layers.zones) {
    const ei = (scene.effectZones ?? []).findIndex((z) => (z.z ?? 0) === currentLayer && inRect(p, effectZoneRect(z.area)));
    if (ei >= 0) return { type: 'effectZone', idx: ei };
  }
  if (layers.roofs) {
    for (const body of scene.architecture ?? []) {
      for (const storey of body.storeys) {
        if (storey.z !== currentLayer) continue;
        const part = storey.parts.find((candidate) => inRect(p, candidate.foot));
        if (part) return { type: 'architecturePart', bodyId: body.id, storeyId: storey.id, id: part.id };
      }
      // Seule une masse AUTHORÉE est une cible d'édition : une masse `derived` est le CALCUL de
      // `deriveArchitectureMasses` depuis le plan et `roofDefaults` — toute retouche y serait jetée
      // à la re-dérivation suivante. Son fait s'édite sur le CORPS (fold « Toiture du corps »).
      const mass = body.masses.find((candidate) => !candidate.derived && candidate.z === currentLayer && candidate.footprint.some((part) => inRect(p, part)));
      if (mass) return { type: 'roofSection', bodyId: body.id, id: mass.id };
    }
  }
  if (activeBodyId) {
    const body = scene.architecture?.find((candidate) => candidate.id === activeBodyId);
    if (body) {
      const storey = body.storeys.find((candidate) => candidate.z === currentLayer);
      return storey ? { type: 'architectureStorey', bodyId: body.id, id: storey.id } : { type: 'architectureBody', id: body.id };
    }
  }
  return null;
}

/** Rect occupé par la sélection (poignée de resize, surlignage) — null si la sélection est ponctuelle. */
export function selRect(scene: Scene, sel: Sel): Rect | null {
  if (sel?.type === 'trigger') return scene.triggers.find((t) => t.id === sel.id)?.rect ?? null;
  if (sel?.type === 'restZone') return scene.restZones?.[sel.idx]?.rect ?? null;
  if (sel?.type === 'effectZone') { const z = scene.effectZones?.[sel.idx]; return z ? effectZoneRect(z.area) : null; }
  if (sel?.type === 'architecturePart') return scene.architecture?.find((body) => body.id === sel.bodyId)?.storeys.find((storey) => storey.id === sel.storeyId)?.parts.find((part) => part.id === sel.id)?.foot ?? null;
  if (sel?.type === 'roofSection') {
    const parts = scene.architecture?.find((body) => body.id === sel.bodyId)?.masses.find((mass) => mass.id === sel.id)?.footprint;
    if (!parts?.length) return null;
    const x = Math.min(...parts.map((part) => part.x));
    const y = Math.min(...parts.map((part) => part.y));
    const maxX = Math.max(...parts.map((part) => part.x + part.w));
    const maxY = Math.max(...parts.map((part) => part.y + part.h));
    return { x, y, w: maxX - x, h: maxY - y };
  }
  return null;
}

/** COUCHE sur laquelle vit la sélection — source UNIQUE pour tout ce qui doit se poser à sa hauteur
 *  (poignée de redimensionnement, libellé de couche de l'inspecteur, synchronisation de la couche
 *  active). Chaque famille lit SON porteur de `z` — rect pour trigger/zone repos, champ `z` pour
 *  entité/zone d'effet/point d'entrée/étage/masse ; sans cette primitive chaque site redevine, et
 *  redevine faux (une poignée au sol pour une zone d'étage). */
export function selZ(scene: Scene, sel: Sel): number {
  if (!sel) return 0;
  if (sel.type === 'wall') return sel.z;
  if (sel.type === 'entity') return scene.entities.find((e) => e.id === sel.id)?.z ?? 0;
  if (sel.type === 'entry') return scene.entryPoints?.[sel.id]?.z ?? 0;
  if (sel.type === 'trigger') return scene.triggers.find((t) => t.id === sel.id)?.rect.z ?? 0;
  if (sel.type === 'restZone') return scene.restZones?.[sel.idx]?.rect.z ?? 0;
  if (sel.type === 'effectZone') return scene.effectZones?.[sel.idx]?.z ?? 0;
  if (sel.type === 'architectureStorey')
    return scene.architecture?.find((b) => b.id === sel.bodyId)?.storeys.find((s) => s.id === sel.id)?.z ?? 0;
  if (sel.type === 'architecturePart')
    return scene.architecture?.find((b) => b.id === sel.bodyId)?.storeys.find((s) => s.id === sel.storeyId)?.z ?? 0;
  if (sel.type === 'roofSection')
    return scene.architecture?.find((b) => b.id === sel.bodyId)?.masses?.find((m) => m.id === sel.id)?.z ?? 0;
  return 0;
}

/** Position d'ancrage de la sélection (coin NW pour les rects) — cible des flèches de nudge. */
export function selPos(scene: Scene, sel: Sel): Pt | null {
  if (sel?.type === 'entity') return scene.entities.find((e) => e.id === sel.id)?.pos ?? null;
  if (sel?.type === 'entry') return scene.entryPoints?.[sel.id] ?? null;
  const r = selRect(scene, sel);
  return r ? { x: r.x, y: r.y } : null;
}

/** Déplace la sélection vers `to` (clampée dans la carte). Scene inchangée si sélection invalide. */
export function moveSel(scene: Scene, sel: Sel, to: Pt): Scene {
  const { w, h } = scene.dimensions;
  if (sel?.type === 'entity') return moveEntityTo(scene, sel.id, { x: clamp(to.x, w), y: clamp(to.y, h) });
  if (sel?.type === 'entry') {
    const pos = scene.entryPoints?.[sel.id];
    if (!pos) return scene;
    return { ...scene, entryPoints: { ...scene.entryPoints, [sel.id]: { ...pos, x: clamp(to.x, w), y: clamp(to.y, h) } } };
  }
  if (sel?.type === 'trigger')
    return {
      ...scene,
      triggers: scene.triggers.map((t) =>
        t.id === sel.id ? { ...t, rect: { ...t.rect, x: clamp(to.x, w - t.rect.w + 1), y: clamp(to.y, h - t.rect.h + 1) } } : t,
      ),
    };
  if (sel?.type === 'restZone')
    return {
      ...scene,
      restZones: (scene.restZones ?? []).map((z, i) =>
        i === sel.idx ? { ...z, rect: { ...z.rect, x: clamp(to.x, w - z.rect.w + 1), y: clamp(to.y, h - z.rect.h + 1) } } : z,
      ),
    };
  if (sel?.type === 'effectZone')
    return {
      ...scene,
      effectZones: (scene.effectZones ?? []).map((z, i) => {
        if (i !== sel.idx) return z;
        const r = effectZoneRect(z.area);
        const moved = { x: clamp(to.x, w - r.w + 1), y: clamp(to.y, h - r.h + 1), w: r.w, h: r.h };
        return setEffectZoneArea(z, effectZoneArea(z.area.kind, moved));
      }),
    };
  if (sel?.type === 'architecturePart')
    return {
      ...scene,
      architecture: scene.architecture?.map((body) => body.id !== sel.bodyId ? body : {
        ...body,
        storeys: body.storeys.map((storey) => storey.id !== sel.storeyId ? storey : {
          ...storey,
          parts: storey.parts.map((part) => part.id === sel.id ? { ...part, foot: { ...part.foot, x: clamp(to.x, w - part.foot.w + 1), y: clamp(to.y, h - part.foot.h + 1) } } : part),
        }),
      }),
    };
  if (sel?.type === 'roofSection')
    return {
      ...scene,
      architecture: scene.architecture?.map((body) => body.id !== sel.bodyId ? body : {
        ...body,
        masses: body.masses.map((mass) => {
          if (mass.id !== sel.id || mass.footprint.length === 0) return mass;
          const minX = Math.min(...mass.footprint.map((part) => part.x));
          const minY = Math.min(...mass.footprint.map((part) => part.y));
          const maxX = Math.max(...mass.footprint.map((part) => part.x + part.w));
          const maxY = Math.max(...mass.footprint.map((part) => part.y + part.h));
          const dx = clamp(to.x, w - (maxX - minX) + 1) - minX;
          const dy = clamp(to.y, h - (maxY - minY) + 1) - minY;
          return { ...mass, footprint: mass.footprint.map((part) => ({ ...part, x: part.x + dx, y: part.y + dy })) };
        }),
      }),
    };
  return scene;
}

/** Redimensionne le rect de la sélection (trigger/zone repos) : coin NW fixe, coin SE = `to` (≥ NW, clampé). */
export function resizeSel(scene: Scene, sel: Sel, to: Pt): Scene {
  const r = selRect(scene, sel);
  if (!r) return scene;
  const { w, h } = scene.dimensions;
  const next = rectFrom({ x: r.x, y: r.y }, { x: Math.max(r.x, clamp(to.x, w)), y: Math.max(r.y, clamp(to.y, h)) });
  if (sel?.type === 'trigger') return { ...scene, triggers: scene.triggers.map((t) => (t.id === sel.id ? { ...t, rect: { ...next, ...(t.rect.z ? { z: t.rect.z } : {}) } } : t)) };
  if (sel?.type === 'restZone') return { ...scene, restZones: (scene.restZones ?? []).map((z, i) => (i === sel.idx ? { ...z, rect: { ...next, ...(z.rect.z ? { z: z.rect.z } : {}) } } : z)) };
  if (sel?.type === 'effectZone') return { ...scene, effectZones: (scene.effectZones ?? []).map((z, i) => (i === sel.idx ? setEffectZoneArea(z, effectZoneArea(z.area.kind, next)) : z)) };
  if (sel?.type === 'architecturePart') return {
    ...scene,
    architecture: scene.architecture?.map((body) => body.id !== sel.bodyId ? body : {
      ...body,
      storeys: body.storeys.map((storey) => storey.id !== sel.storeyId ? storey : { ...storey, parts: storey.parts.map((part) => part.id === sel.id ? { ...part, foot: next } : part) }),
    }),
  };
  if (sel?.type === 'roofSection') {
    const mass = scene.architecture?.find((body) => body.id === sel.bodyId)?.masses.find((candidate) => candidate.id === sel.id);
    // Section à UNE seule partie : le geste n'est pas ambigu, la poignée redimensionne cette partie.
    // Masse MULTI-parties : quelle partie redimensionner ? Ambigu — no-op explicite (#837), jamais une devinette.
    if (!mass || mass.footprint.length !== 1) return scene;
    return {
      ...scene,
      architecture: scene.architecture?.map((body) => body.id !== sel.bodyId ? body : {
        ...body,
        masses: body.masses.map((candidate) => candidate.id !== sel.id ? candidate : { ...candidate, footprint: [next] }),
      }),
    };
  }
  return scene;
}

/** Supprime l'élément sélectionné. Scene inchangée si rien/introuvable. Supprimer une entité retire
 *  aussi ses rattachements de rencontre (membre + toute monture qui la chevauchait). */
export function deleteSel(scene: Scene, sel: Sel): Scene {
  if (sel?.type === 'entity') {
    const encounters = scene.encounters.map((e) => {
      const members = (e.members ?? []).filter((m) => m.entityId !== sel.id);
      if (members.length === (e.members ?? []).length) return e;
      return { ...e, members: members.map((m) => (m.ridesEntityId === sel.id ? { ...m, ridesEntityId: undefined } : m)) };
    });
    return { ...removeEntity({ ...scene, encounters }, sel.id) };
  }
  if (sel?.type === 'trigger') return { ...scene, triggers: scene.triggers.filter((t) => t.id !== sel.id) };
  // #841 FU-C : les CONTENEURS (corps/étage) étaient inatteignables (audit #835 les avait
  // signalés « feuilles seules ») — le corps entier disparaît avec ses étages/parties/façades/masses ;
  // l'étage protège le DERNIER de son corps (mirroir de `removeLayer` protégeant la base de la scène).
  if (sel?.type === 'architectureBody') return { ...scene, architecture: scene.architecture?.filter((body) => body.id !== sel.id) };
  if (sel?.type === 'architectureStorey') return {
    ...scene,
    architecture: scene.architecture?.map((body) => {
      if (body.id !== sel.bodyId || body.storeys.length <= 1) return body;
      return { ...body, storeys: body.storeys.filter((storey) => storey.id !== sel.id) };
    }),
  };
  if (sel?.type === 'facadeSection') return {
    ...scene,
    architecture: scene.architecture?.map((body) => body.id === sel.bodyId ? { ...body, facades: body.facades.filter((facade) => facade.id !== sel.id) } : body),
  };
  if (sel?.type === 'roofSection') return {
    ...scene,
    architecture: scene.architecture?.map((body) => body.id === sel.bodyId ? { ...body, masses: body.masses.filter((mass) => mass.id !== sel.id) } : body),
  };
  if (sel?.type === 'architecturePart') return {
    ...scene,
    architecture: scene.architecture?.map((body) => body.id !== sel.bodyId ? body : {
      ...body,
      storeys: body.storeys.map((storey) => storey.id === sel.storeyId ? { ...storey, parts: storey.parts.filter((part) => part.id !== sel.id) } : storey),
    }),
  };
  if (sel?.type === 'restZone') return { ...scene, restZones: (scene.restZones ?? []).filter((_, i) => i !== sel.idx) };
  if (sel?.type === 'effectZone') return { ...scene, effectZones: (scene.effectZones ?? []).filter((_, i) => i !== sel.idx) };
  if (sel?.type === 'wall') {
    const others = (scene.walls ?? []).filter((w) => !(w.x === sel.x && w.y === sel.y && w.side === sel.side && (w.z ?? 0) === sel.z));
    return { ...scene, walls: others.length ? others : undefined };
  }
  if (sel?.type === 'entry') {
    const entries = { ...scene.entryPoints };
    delete entries[sel.id];
    return { ...scene, entryPoints: Object.keys(entries).length ? entries : undefined };
  }
  return scene;
}

/** Change le TYPE de décor d'une entité `prop` (avec ses défauts de pose, `propRefPatch`) et traverse
 *  le seam d'assise : le nouveau type n'offre pas les places de l'ancien, elles tombent dans la MÊME
 *  mutation. */
export function changePropRef(scene: Scene, propId: string, ref: string): Scene {
  const ent = scene.entities.find((e) => e.id === propId && e.kind === 'prop');
  return ent ? editEntity(scene, propId, propRefPatch(ref, ent.usable)) : scene;
}

/** Arête la plus proche du centre de la case, depuis l'offset (ox,oy) ∈ [-0.5,0.5] du pointeur. */
export function nearestEdge(ox: number, oy: number): CellSide {
  const d: Record<CellSide, number> = { N: 0.5 + oy, S: 0.5 - oy, O: 0.5 + ox, E: 0.5 - ox };
  return (['N', 'E', 'S', 'O'] as CellSide[]).reduce((a, b) => (d[b] < d[a] ? b : a));
}

/** Seuil de proximité (fraction de case) en deçà duquel l'outil ↖ SÉLECTIONNE une arête-mur plutôt que la
 *  tuile sous le curseur (au-delà = clic « plein centre » → picking de tuile). */
const EDGE_PICK = 0.33;

/** Arête-mur SÉLECTIONNABLE sous le point FRACTIONNAIRE (fx,fy) au niveau z : l'arête cardinale la plus
 *  proche du centre SI elle porte un segment ET que le pointeur en est assez près ; sinon null (l'appelant
 *  retombe alors sur `hitAt`). Diagonales exclues (purement visuelles, non porteuses de structure). */
export function pickWallEdge(scene: Scene, fx: number, fy: number, z: number): { x: number; y: number; side: 'N' | 'E' } | null {
  const px = Math.round(fx), py = Math.round(fy);
  const ox = fx - px, oy = fy - py;
  const side = nearestEdge(ox, oy);
  const dist: Record<CellSide, number> = { N: 0.5 + oy, S: 0.5 - oy, O: 0.5 + ox, E: 0.5 - ox };
  if (dist[side] > EDGE_PICK) return null;
  const e = canonEdge(px, py, side);
  return edgeWallState(scene, e.x, e.y, e.side, z) === 'none' ? null : e;
}

export function pickArchitectureEdge(scene: Scene, fx: number, fy: number, z: number): Extract<Sel, { type: 'facadeSection' }> | null {
  const px = Math.round(fx), py = Math.round(fy);
  const ox = fx - px, oy = fy - py;
  const side = nearestEdge(ox, oy);
  const dist: Record<CellSide, number> = { N: 0.5 + oy, S: 0.5 - oy, O: 0.5 + ox, E: 0.5 - ox };
  if (dist[side] > EDGE_PICK) return null;
  const edge = canonEdge(px, py, side);
  for (const body of scene.architecture ?? []) {
    const facade = body.facades.find((section) => section.z === z && section.edges.some((candidate) => candidate.x === edge.x && candidate.y === edge.y && candidate.side === edge.side && (candidate.z ?? section.z) === z));
    if (facade) return { type: 'facadeSection', bodyId: body.id, id: facade.id };
  }
  return null;
}

/** L'outil d'ENTITÉ seul — ce que `placeEntity` demande, dérivé de `Tool` pour qu'aucun site ne
 *  redise sa forme (la palette le construit, le canevas le transmet, la pose le consomme). */
export type EntityTool = Extract<Tool, { mode: 'entity' }>;

/** Pose une entité à p (id frais) depuis l'OUTIL tel que la palette le porte — il tient déjà le décor
 *  ou la fiche élue : aucun cas muet ne subsiste ici. Les props appliquent leurs défauts de catalogue
 *  (empreinte, interactif si fouillable) ; un personnage porte sa fiche en `ref` et le libellé de la
 *  fiche, son apparence se dérive du record (#1882). Une fiche absente du bestiaire lève. */
export function placeEntity(scene: Scene, outil: EntityTool, p: Pt, z = 0): { scene: Scene; id: string } {
  const id = nextEntityId(outil.kind, scene.entities.map((e) => e.id));
  const base: SceneEntity = { id, kind: outil.kind, pos: { ...p }, label: libelleDeValeur(entityKindSchema, outil.kind) };
  if (outil.kind === 'personnage' && !findCreatureById(outil.ref))
    throw new Error(`placeEntity : « ${outil.ref} » n'est pas une fiche du bestiaire — un personnage NOMME sa fiche par id STABLE (#1882)`);
  const ent: SceneEntity = outil.kind === 'prop'
    ? { ...base, ...propRefPatch(outil.ref, undefined), label: PROPS[outil.ref]?.label }
    : outil.kind === 'personnage'
      ? { ...base, ref: outil.ref, label: creatureLabel(outil.ref) }
      : base;
  return { scene: addEntity(scene, ent, z), id }; // l'étage se pose à la porte d'ajout
}

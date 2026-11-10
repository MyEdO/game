/**
 * LECTURES de l'édition de scène — outil actif, calques, sélection, picking, emprise du pinceau et formulaire tiré
 * du schéma de chaque porteur (`formulaireDe`). PURES,
 * Node-safe, sans import d'hôte : tout hôte qui embarque le noyau désigne par elles ce qu'il édite.
 * Les ÉCRIVAINS vivent dans `./sceneEdit` ; les deux modules sont au `BRIDGE_PATH` de
 * `scripts/guards/lib/sceneFieldEditability.mjs`.
 */
import { sceneMetresPerTile, type FaceDArete, type Scene, type SceneEffectZone, type SceneEntity, type Trigger, type WallSeg, type WallSide, type ZoneArea, type CellSide, porteAuteur } from './monde/scene';
import type { Flow } from '../data/schemas/defs-scenes/effets';
import { faceDAreteSchema, optionalDeSceneSchema, sceneEffectZoneSchema, sceneEntitySchema, triggerSchema, type Terrain } from '../data/schemas/defs-scenes/scene';
import { traitInstanceSchema } from '../data/schemas/grammaire/reference';
import { champsDeclares, choixDuNoeud, formeAuPoint, inferFields, type ChoixDuContexte, type ContexteDuChamp, type FieldDesc } from './codex/editFields';
import { variantesAChoisir } from './valeursNeuves';
import { isOptionalNote } from '../engine/statEntry';
import { jsonCanonique } from '../lib/jsonCanonique.mjs';
import { optionsDuNoeud } from '../data/schemas/grammaire/meta';
import { walkFlow } from '../engine/flowCore';
import { isDoorEdgeStructure, isWallEdgeStructure } from '../engine/structures';
import type { Combatant, StructureData } from '../engine/types';
import { creatures, estUnNavireAPonts, findCreatureById, profilsStandard, refEstVolumique, spells, structureAppearances, structures, traits, type CreatureData } from '../data';
import { listesDeSorts, refusDesSortsChoisis, sortsImprimes } from '../engine/sortsDuPnj';
import { ficheDuPersonnage, nomDEntite } from './monde/sceneNpc';
import { t } from '../i18n';
import { presetDuNarratif, type ResolveurDePreset } from './monde/resolveursDuNarratif';
import { entreesNarratives, type CleDeReferenceNarrative } from './codex/libellesNarratifs';
import { REFERENCES_NARRATIVES } from '../data/schemas/defs-scenes/registres-narratifs';
import type { NarratifBlock } from '../data/schemas/defs-scenes/narratif';
import { emptyStatblock, statblockDeLaCreature } from '../data/valeursNeuves';
import { CAP_IDENTITE_PROP, capDecorAdmis } from '../data/props.types';
import { DIR8_ORDER, estCardinal, type Dir8 } from '../geometry/dir8';
import { decorsEnCaseEtage, entitesEnCaseEtage } from './monde/decorIndex';
import { ancreDuDecor } from './monde/footprint';
import { portePar } from './monde/poseDuDecor';
import { aretesA } from './monde/wallIndex';
import type { Rect, Pt, EffectZoneSeed, Segment } from './sceneEdit';

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
  // de l'étage `toZ` (invariant PARTAGÉ avec le compilateur ASCII — `noyau/stairFlight.ts`). L'outil ne
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

/** Variantes de l'outil ZONE (rail « zone » de la Palette), la pièce d'abord. `room` et `effect` produisent toutes
 *  deux une `SceneEffectZone` ; ce qui les distingue est leur GRAINE ci-dessous, pas le créateur. */
export const ZONE_VARIANTS = ['room', 'trigger', 'rest', 'effect'] as const;
export type ZoneVariant = (typeof ZONE_VARIANTS)[number];

/** Ce que chaque variante de zone d'effet DONNE à la zone qu'elle dessine — déclaré ICI, à côté du
 *  choix de la variante, et passé tel quel à `addEffectZone`. La PIÈCE naît nue : un intérieur, un nom
 *  à renommer, aucune mécanique (`isDescriptiveZone`). */
export const EFFECT_ZONE_SEEDS: Record<'room' | 'effect', EffectZoneSeed> = {
  room: { label: 'Pièce', presentation: 'interior' },
  effect: { label: 'Piège', onCross: [{ op: 'wounds', amount: 5, ignoreTB: false, ignoreAP: true }] },
};

/** Sous-mode de l'outil MURS : cloison pleine, porte (arête franchissable), ou diagonale en travers. */
export type WallPaint = 'wall' | 'door' | 'diagBack' | 'diagFwd';

/** Les faces d'où se découvre une porte secrète, `[valeur, libellé]` (`faceDAreteSchema`, EDO 07 l.263). */
export const FACES_D_ARETE = optionsDuNoeud(faceDAreteSchema) as [FaceDArete, string][];

/** Les structures de mur dont l'apparence porte un parapet : celles que l'outil crénelage pose (#841). */
export function structuresCrenelables(): StructureData[] {
  return structures.filter((s) => isWallEdgeStructure(s) && !!structureAppearances.find((a) => a.id === s.id)?.parapet);
}

/** Les structures que l'outil murs pose au sous-mode `paint` : un mur sur une cloison, une fermeture sur une porte,
 *  aucune sur une diagonale (#830). */
export function structuresDeLArete(paint: WallPaint): StructureData[] {
  if (paint === 'wall') return structures.filter(isWallEdgeStructure);
  return paint === 'door' ? structures.filter(isDoorEdgeStructure) : [];
}

/** Calques masquables du canvas (masquer débloque le clic sur ce qu'il y a dessous). `zones` porte
 *  TOUTE zone d'effet, descriptive (nom de pièce) comme mécanique (piège/barrière) — une zone qui
 *  reçoit un effet ne change pas de calque, donc ne disparaît pas. Ce qui distingue les deux natures
 *  est leur ENCRE (`zoneInk`, EditorCanvas) : la pièce n'a qu'un liseré, le piège porte l'aplat. */
export type Layers = { triggers: boolean; spawns: boolean; roofs: boolean; entries: boolean; rest: boolean; zones: boolean };

/** Sélection unifiée — une seule chose sélectionnée à la fois, sur la carte comme dans les panneaux. */
export type Sel =
  | null
  | { type: 'entity' | 'trigger' | 'entry' | 'effectZone'; id: string }
  | { type: 'restZone'; idx: number }
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

/** La cote de l'étage qu'on ajoute au-dessus du plan (`addLayer`) : un cran au-dessus de la plus haute couche, le rez
 *  (0) sur un plan sans couche. */
export const etageSuivant = (scene: Pick<Scene, 'layers'>): number => scene.layers.reduce((z, l) => Math.max(z, l.z + 1), 0);

/** La case `p` est-elle sur la carte ? La garde de bornes de tout geste à la case. */
export function dansLaCarte(scene: Scene, p: Pt): boolean {
  return p.x >= 0 && p.y >= 0 && p.x < scene.dimensions.w && p.y < scene.dimensions.h;
}

/** Entité posée à `p` sur la couche `z` (défaut 0) — prédicat UNIQUE de picking/gomme/collision
 *  d'entités. Source unique remplaçant les comparaisons dupliquées `pos.x===p.x && pos.y===p.y`
 *  qui omettaient le filtre de couche (#835 FU-3) : `hitAt`/`eraseAt`/`addEnemyMember` et la pose
 *  directe (`entity`/`emplacement`) le partagent tous.
 *
 *  Les candidates sont les entités ANCRÉES sur la case et les décors dont l'EMPREINTE la couvre
 *  (`noyau/monde/decorIndex.ts`, la même lecture que le picking du jeu) : sans la seconde vue, la seconde case d'une
 *  table 2×1 ne se sélectionnait, ne s'effaçait et ne se déplaçait pas, et un clic y posait une entité DANS le meuble.
 *  Plusieurs choses tiennent dans une case (un coffre calé contre un mur et un tonneau dans le coin, une lettre sur la
 *  table) : celle dont l'ANCRE est la plus proche du point visé `point` (cases continues, défaut le centre de la case)
 *  se désigne, et à égalité celle qui est posée sur l'autre. Un corps debout sur une case d'empreinte se désigne donc
 *  lui-même, pas le meuble sous ses pieds. */
export function entityAt(scene: Scene, p: Pt, z = 0, point: Pt = p): SceneEntity | undefined {
  const mpt = sceneMetresPerTile(scene);
  const candidates = [...new Set([...entitesEnCaseEtage(scene, p.x, p.y, z), ...decorsEnCaseEtage(scene, p.x, p.y, z)])];
  const ecart = (e: SceneEntity) => {
    const a = e.kind === 'prop' ? ancreDuDecor(e, mpt) : e.pos;
    return Math.hypot(a.x - point.x, a.y - point.y);
  };
  const porte = (a: SceneEntity, b: SceneEntity) => (portePar(scene, a, b.id) ? -1 : portePar(scene, b, a.id) ? 1 : 0);
  return candidates.sort((a, b) => ecart(a) - ecart(b) || porte(a, b))[0];
}

/** Arête (case, side N/E/S/O) → forme CANONIQUE (case, N|E). */
export function canonEdge(x: number, y: number, side: CellSide): { x: number; y: number; side: 'N' | 'E' } {
  if (side === 'S') return { x, y: y + 1, side: 'N' };
  if (side === 'O') return { x: x - 1, y, side: 'E' };
  return { x, y, side };
}

/** État d'une arête : 'none' | 'wall' (pleine) | 'door' (franchissable), sur l'étage `z`. */
export function edgeWallState(scene: Scene, x: number, y: number, side: CellSide, z = 0): 'none' | 'wall' | 'door' {
  const e = canonEdge(x, y, side);
  const w = (scene.walls ?? []).find((w) => w.x === e.x && w.y === e.y && w.side === e.side && (w.z ?? 0) === z);
  return !w ? 'none' : porteAuteur(w) ? 'door' : 'wall';
}

/** EMPRISE du pinceau : le carré de côté `taille` centré sur `p`, rogné à la carte ; vide si `p` est hors
 *  carte. Source UNIQUE des peintres de case (`paintTiles`, `paintHeight`, `paintCrenellated`) et de
 *  l'aperçu du trait du canevas. */
export function empriseDuPinceau(dimensions: { w: number; h: number }, p: Pt, taille: number): Pt[] {
  const { w, h } = dimensions;
  if (p.x < 0 || p.y < 0 || p.x >= w || p.y >= h) return [];
  const r = Math.floor((taille - 1) / 2);
  const cases: Pt[] = [];
  for (let dy = -r; dy <= r; dy++)
    for (let dx = -r; dx <= r; dx++) {
      const x = p.x + dx, y = p.y + dy;
      if (x >= 0 && y >= 0 && x < w && y < h) cases.push({ x, y });
    }
  return cases;
}

const inRect = (p: Pt, r: Rect) => p.x >= r.x && p.x < r.x + r.w && p.y >= r.y && p.y < r.y + r.h;

/** Deux sélections désignent-elles le même élément ? */
export function sameSel(a: Sel, b: Sel): boolean {
  if (!a || !b || a.type !== b.type) return a === b;
  if (a.type === 'restZone' && b.type === 'restZone') return a.idx === b.idx;
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
export function hitAt(scene: Scene, p: Pt, layers: Layers, currentLayer = 0, activeBodyId?: string, point: Pt = p): Sel {
  // `entityAt` = prédicat UNIQUE position×couche (#835 FU-3) : une entité d'une AUTRE couche ne
  // masque plus le picking des couches d'annotation/toit sous-jacentes.
  const ent = entityAt(scene, p, currentLayer, point);
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
    const ez = scene.effectZones?.find((z) => (z.z ?? 0) === currentLayer && inRect(p, effectZoneRect(z.area)));
    if (ez) return { type: 'effectZone', id: ez.id };
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
  if (sel?.type === 'effectZone') { const z = scene.effectZones?.find((ez) => ez.id === sel.id); return z ? effectZoneRect(z.area) : null; }
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
  if (sel.type === 'effectZone') return scene.effectZones?.find((z) => z.id === sel.id)?.z ?? 0;
  if (sel.type === 'architectureStorey')
    return scene.architecture?.find((b) => b.id === sel.bodyId)?.storeys.find((s) => s.id === sel.id)?.z ?? 0;
  if (sel.type === 'architecturePart')
    return scene.architecture?.find((b) => b.id === sel.bodyId)?.storeys.find((s) => s.id === sel.storeyId)?.z ?? 0;
  if (sel.type === 'roofSection')
    return scene.architecture?.find((b) => b.id === sel.bodyId)?.masses?.find((m) => m.id === sel.id)?.z ?? 0;
  return 0;
}

/** La case de la poignée de redimensionnement de la sélection `sel` de `scene` sur la couche `z` : le coin SE de son
 *  rectangle (`selRect`), `null` pour une sélection ponctuelle ou d'une autre couche (`selZ`). */
export function poigneeDeLaSelection(scene: Scene, sel: Sel, z: number): Pt | null {
  const r = selRect(scene, sel);
  return r && selZ(scene, sel) === z ? { x: r.x + r.w - 1, y: r.y + r.h - 1 } : null;
}

/** Position d'ancrage de la sélection (coin NW pour les rects) — cible des flèches de nudge. */
export function selPos(scene: Scene, sel: Sel): Pt | null {
  if (sel?.type === 'entity') return scene.entities.find((e) => e.id === sel.id)?.pos ?? null;
  if (sel?.type === 'entry') return scene.entryPoints?.[sel.id] ?? null;
  const r = selRect(scene, sel);
  return r ? { x: r.x, y: r.y } : null;
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

/** Le libellé de la structure `id` du catalogue, `undefined` sans structure. */
export const libelleDeStructure = (id: string | undefined): string | undefined => structures.find((st) => st.id === id)?.label;

/** L'entité que la sélection `sel` désigne, `undefined` hors d'une entité sélectionnée. */
export function entiteDeLaSelection(scene: Scene, sel: Sel): SceneEntity | undefined {
  return sel?.type === 'entity' ? scene.entities.find((e) => e.id === sel.id) : undefined;
}

/** La fiche du personnage `ent` (`ficheDuPersonnage`), les presets résolus par `presetDe`, s'il est de son schéma
 *  (`sceneEntitySchema`) : un brouillon du formulaire peut ne pas l'être, il ne se vérifie qu'à l'enregistrement et à
 *  l'essai. */
export const ficheEditee = (ent: SceneEntity, presetDe: ResolveurDePreset): Combatant | undefined =>
  (sceneEntitySchema.safeParse(ent).success ? ficheDuPersonnage(ent, presetDe) : undefined);

/** Le cap de l'entité `ent` : le sien, sinon le cap d'identité (`CAP_IDENTITE_PROP`). */
export const capDeLEntite = (ent: SceneEntity): Dir8 => ent.facing ?? CAP_IDENTITE_PROP;

/** La lumière que l'entité `ent` prend quand l'auteur l'allume : la sienne, ou un rayon de 6 m. */
export const lumiereAllumee = (ent: SceneEntity): NonNullable<SceneEntity['light']> => ({ ...ent.light, radiusM: ent.light?.radiusM ?? 6 });

/** Les caps que l'entité `ent` peut prendre, dans l'ordre horaire (`DIR8_ORDER`) : ceux que son type admet, les
 *  cardinaux seuls pour un décor volumique (`capDecorAdmis`) ou un navire à ponts (`estUnNavireAPonts`). */
export function capsOfferts(ent: SceneEntity): Dir8[] {
  if (ent.kind === 'personnage' && estUnNavireAPonts(ent.vehicule?.id)) return DIR8_ORDER.filter(estCardinal);
  return DIR8_ORDER.filter((cap) => capDecorAdmis(refEstVolumique(ent.decor?.id), cap));
}

/** Les fiches qu'un personnage posé peut nommer (#1882) : les créatures du bestiaire qui ont des Blessures
 *  (`char.B`), les profils standard (`LDB 77 l.7`, `profilsStandard`) en tête. */
export function fichesDePersonnage(): CreatureData[] {
  const standard = new Set(profilsStandard());
  const fiches = creatures.filter((c) => typeof c.char.B === 'number');
  return [...fiches.filter((c) => standard.has(c.id)), ...fiches.filter((c) => !standard.has(c.id))];
}

/** Le segment de l'arête que la sélection `sel` désigne, `undefined` hors d'une arête sélectionnée. */
export function segmentDeLaSelection(scene: Scene, sel: Sel): WallSeg | undefined {
  return sel?.type === 'wall' ? aretesA(scene, sel.x, sel.y, sel.side, sel.z)[0] : undefined;
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

/** La donnée du porteur de chaque sorte de formulaire tiré du schéma. */
export interface DonneeDuPorteur { zone: SceneEffectZone; declencheur: Trigger; entite: SceneEntity }

/** La sorte d'un porteur de formulaire tiré du schéma. */
export type SorteDePorteur = keyof DonneeDuPorteur;

/** Les chemins de clés, depuis la donnée d'un porteur, des champs qu'il offre : chacun avec tout ce qu'il porte. */
type CheminsOfferts = readonly (readonly string[])[];

/** Ce qu'un porteur de formulaire tiré du schéma déclare : le nœud de sa donnée, les champs qu'il offre, et les choix que
 *  son contexte pose à un chemin de sa donnée (`choixDuChamp`), dans le narratif du projet. */
interface FormulaireDuPorteur<D> {
  schema: unknown;
  champs: (donnee: D, narratif: NarratifBlock) => CheminsOfferts;
  choix?: (donnee: D, chemin: readonly Segment[], narratif: NarratifBlock) => readonly ChoixDuContexte[] | undefined;
}

/** Les champs que le formulaire d'un personnage offre : de son rôle au combat, ses options, ses Compétences, le tirage de
 *  ses Caractéristiques et son embuscade ; son profil personnalisé ; sa contrepartie d'amateur des arts, son animation. */
const CHAMPS_DU_PERSONNAGE: CheminsOfferts = [['combat', 'optionals'], ['combat', 'skills'], ['combat', 'randomChars'], ['combat', 'hiddenUntilCombat'], ['statblock'], ['amateur'], ['anim']];

/** Les sorts que l'auteur choisit pour un personnage. */
const SORTS_CHOISIS = ['combat', 'spells'] as const;

/** Les champs que le formulaire du personnage `ent` offre (`CHAMPS_DU_PERSONNAGE`), dans le narratif `narratif` : son
 *  preset s'il en porte un ou si le narratif en déclare ; ses sorts choisis s'il en porte, ou si sa fiche (`ficheEditee`)
 *  ouvre une liste de sorts (`listesDeSorts`) sans imprimer les siens (`sortsImprimes`) ; d'une coque, son véhicule et
 *  ses Améliorations (MDG 12). */
function champsDuPersonnage(ent: SceneEntity, narratif: NarratifBlock): CheminsOfferts {
  const preset = ent.presetId !== undefined || narratif.presetsPnj.length ? [['presetId']] : [];
  const fiche = ent.combat?.spells?.length ? undefined : ficheEditee(ent, presetDuNarratif(narratif));
  const sorts = ent.combat?.spells?.length || (fiche && !sortsImprimes(fiche.porteurDeFiche).length && listesDeSorts(fiche).length) ? [SORTS_CHOISIS] : [];
  const coque = ent.vehicule ? [['vehicule'], ['upgrades']] : [];
  return [...preset, ...CHAMPS_DU_PERSONNAGE, ...sorts, ...coque];
}

/** Les choix que le contexte d'un personnage pose à ses sorts choisis (`combat.spells`) : d'un élément au rang `rang`, ou
 *  de l'élément neuf qui suit le dernier, chaque sort d'une liste que sa fiche ouvre (`listesDeSorts`), hors des autres
 *  choisis, la courante restant offerte, refusé par ce que dit `refusDesSortsChoisis` des choisis où il prend ce rang ;
 *  sans fiche (`ficheEditee`), la courante seule. */
function choixDesSorts(ent: SceneEntity, rang: number, presetDe: ResolveurDePreset): readonly ChoixDuContexte[] {
  const choisis = ent.combat?.spells ?? [];
  const fiche = ficheEditee(ent, presetDe);
  const listes = fiche ? listesDeSorts(fiche) : [];
  const avec = (id: string) => [...choisis.slice(0, rang), id, ...choisis.slice(rang + 1)];
  return spells
    .filter((sp) => sp.id === choisis[rang] || (!choisis.includes(sp.id) && listes.some((l) => l.admet(sp))))
    .map((sp) => ({ valeur: sp.id, libelle: sp.label, refus: (fiche && refusDesSortsChoisis(fiche, avec(sp.id))) ?? null }));
}

/** Le nœud de l'identifiant d'un Trait posé. */
const noeudDuTrait = () => champsDeclares(traitInstanceSchema)!.find(([cle]) => cle === 'id')![1];

/** Le rang d'offre de chaque Trait au personnage de fiche `fiche` (LDB 76 l.11, l.35) : ses Traits facultatifs, dans
 *  l'ordre de sa fiche, puis les Traits standard (drapeau `standard`), puis le reste. */
function rangDOffreDuTrait(fiche: CreatureData | undefined): (id: unknown) => number {
  const facultatifs = (fiche?.optionals ?? []).flatMap((o) => (isOptionalNote(o) ? [] : [o.id]));
  const standard = new Set(traits.filter((t) => t.standard).map((t) => t.id));
  return (id) => {
    const rang = facultatifs.indexOf(id as string);
    return rang >= 0 ? rang : facultatifs.length + (standard.has(id as string) ? 0 : 1);
  };
}

/** Les choix que le contexte d'un personnage pose à ses options (`combat.optionals`, LDB 76) : d'un élément, sa variante,
 *  le Trait, ou l'une des notes du Bestiaire de sa fiche, posée entière, verbatim (la courante restant offerte) ; de
 *  l'identifiant d'un Trait, tous les Traits, dans leur rang d'offre (`rangDOffreDuTrait`). */
function choixDesOptions(ent: SceneEntity, chemin: readonly Segment[]): readonly ChoixDuContexte[] | undefined {
  const [combat, optionals, rang, cle, ...reste] = chemin;
  if (combat !== 'combat' || optionals !== 'optionals' || typeof rang !== 'number' || reste.length) return undefined;
  const fiche = findCreatureById(ent.creature?.id);
  if (cle === 'id') {
    const rangDOffre = rangDOffreDuTrait(fiche);
    return choixDuNoeud(noeudDuTrait())!.map((o) => ({ valeur: o.valeur, libelle: o.libelle, refus: null })).sort((a, b) => rangDOffre(a.valeur) - rangDOffre(b.valeur));
  }
  if (cle !== undefined) return undefined;
  const actuelle = ent.combat?.optionals?.[rang];
  return variantesAChoisir(optionalDeSceneSchema, actuelle)!.flatMap((v) => {
    if (v.cle === '') return [{ valeur: v.valeur, libelle: v.libelle, refus: null }];
    const notes = (fiche?.optionals ?? []).filter((o) => isOptionalNote(o) && o.note === v.cle);
    const courante = v.courante && !notes.some((n) => jsonCanonique(n) === jsonCanonique(actuelle)) ? [actuelle] : [];
    return [...notes, ...courante].map((n) => ({ valeur: n, libelle: (n as { label: string }).label, refus: null }));
  });
}

/** Les profils personnalisés qu'un personnage reçoit (`statblock`) : un profil neuf à son nom (`emptyStatblock`), puis la
 *  copie de sa créature du Bestiaire (`statblockDeLaCreature`), s'il en porte une. */
function choixDuProfil(ent: SceneEntity, presetDe: ResolveurDePreset): readonly ChoixDuContexte[] {
  const creature = findCreatureById(ent.creature?.id);
  return [
    { valeur: emptyStatblock(nomDEntite(ent, presetDe)), libelle: t('ecran.editeur.profil.neuf'), refus: null },
    ...(creature ? [{ valeur: statblockDeLaCreature(creature), libelle: t('ecran.editeur.profil.copie', { fiche: creature.label }), refus: null }] : []),
  ];
}

/** Les choix que le contexte d'un personnage pose au chemin `chemin` de sa donnée, dans le narratif `narratif` : ceux de
 *  son profil personnalisé (`choixDuProfil`), d'un sort choisi (`choixDesSorts`), de ses options (`choixDesOptions`). */
function choixDuPersonnage(ent: SceneEntity, chemin: readonly Segment[], narratif: NarratifBlock): readonly ChoixDuContexte[] | undefined {
  if (chemin.length === 1 && chemin[0] === 'statblock') return choixDuProfil(ent, presetDuNarratif(narratif));
  const [rang, ...reste] = chemin.slice(SORTS_CHOISIS.length);
  const sorts = SORTS_CHOISIS.every((cle, i) => chemin[i] === cle) && typeof rang === 'number' && !reste.length;
  return sorts ? choixDesSorts(ent, rang, presetDuNarratif(narratif)) : choixDesOptions(ent, chemin);
}

/** Les formulaires tirés du schéma, par sorte de porteur (`FormulaireDuPorteur`). D'une zone d'effet, son Test de
 *  traversée, ses effets à la traversée et à chaque Round, son rendu tant qu'elle dure (#3834) ; d'un déclencheur, sa
 *  condition d'entrée ; d'une entité, la branche de son type : d'un personnage, ses champs (`champsDuPersonnage`), aux
 *  choix de son contexte (`choixDuPersonnage`). */
export const FORMULAIRES: { readonly [S in SorteDePorteur]: FormulaireDuPorteur<DonneeDuPorteur[S]> } = {
  zone: { schema: sceneEffectZoneSchema, champs: () => [['crossTest'], ['onCross'], ['perRound'], ['rendu']] },
  declencheur: { schema: triggerSchema, champs: () => [['when']] },
  entite: {
    schema: sceneEntitySchema,
    champs: (ent, narratif) => (ent.kind !== 'personnage' ? [] : champsDuPersonnage(ent, narratif)),
    choix: choixDuPersonnage,
  },
};

/** `a` est-il un préfixe du chemin `b` ? */
const prefixe = (a: readonly Segment[], b: readonly Segment[]): boolean => a.length <= b.length && a.every((p, i) => p === b[i]);

/** Le chemin `chemin` est-il offert par les champs `offerts` : sous l'un d'eux, ou sur le chemin de l'un d'eux ? */
export const cheminOffert = (offerts: CheminsOfferts, chemin: readonly Segment[]): boolean =>
  offerts.some((o) => prefixe(o, chemin) || prefixe(chemin, o));

/** Le formulaire tiré du schéma du porteur de sorte `sorte` (`FORMULAIRES`) : le nœud où s'écrit sa donnée `donnee`, à
 *  travers les unions de son schéma (`formeAuPoint`), et les champs que sa donnée offre dans le narratif `narratif`. */
export function formeDuPorteur<S extends SorteDePorteur>(sorte: S, donnee: DonneeDuPorteur[S], narratif: NarratifBlock): { noeud: unknown; champs: CheminsOfferts } {
  const formulaire: FormulaireDuPorteur<DonneeDuPorteur[S]> = FORMULAIRES[sorte];
  return { noeud: formeAuPoint(formulaire.schema, donnee)?.noeud, champs: formulaire.champs(donnee, narratif) };
}

/** La clé `cle` est-elle une référence narrative (`REFERENCES_NARRATIVES`) ? */
const estReferenceNarrative = (cle: Segment | undefined): cle is CleDeReferenceNarrative =>
  typeof cle === 'string' && Object.prototype.hasOwnProperty.call(REFERENCES_NARRATIVES, cle);

/** Les choix que le contexte du porteur de sorte `sorte`, de donnée `donnee`, pose au chemin `chemin` de sa donnée, dans
 *  leur ordre, dans le narratif `narratif` : d'une référence narrative, chaque entrée du registre qu'elle désigne
 *  (`entreesNarratives`) ; sinon ceux de son porteur (`FORMULAIRES`) ; `undefined` : ceux du nœud. */
export function choixDuChamp<S extends SorteDePorteur>(sorte: S, donnee: DonneeDuPorteur[S], chemin: readonly Segment[], narratif: NarratifBlock): readonly ChoixDuContexte[] | undefined {
  const cle = chemin[chemin.length - 1];
  if (estReferenceNarrative(cle)) return entreesNarratives(narratif, cle).map((e) => ({ valeur: e.id, libelle: e.label, refus: null }));
  const formulaire: FormulaireDuPorteur<DonneeDuPorteur[S]> = FORMULAIRES[sorte];
  return formulaire.choix?.(donnee, chemin, narratif);
}

/** Le formulaire du porteur de sorte `sorte`, de donnée `donnee`, dans le narratif `narratif` : le champ de tête de
 *  chacun de ses champs offerts (`formeDuPorteur`), décrit par `inferFields` sur le nœud de sa donnée, dans son
 *  contexte : ce qu'il offre sous lui (`cheminOffert`) et ses choix (`choixDuChamp`). */
export function formulaireDe<S extends SorteDePorteur>(sorte: S, donnee: DonneeDuPorteur[S], narratif: NarratifBlock): FieldDesc[] {
  const { noeud, champs } = formeDuPorteur(sorte, donnee, narratif);
  const decrits = inferFields([donnee as unknown as Record<string, unknown>], { noeud, niveau: 'profondeur' });
  const contexte: ContexteDuChamp = { offert: (chemin) => cheminOffert(champs, chemin), choix: (chemin) => choixDuChamp(sorte, donnee, chemin, narratif) };
  return [...new Set(champs.map(([tete]) => tete))].flatMap((cle) => decrits.filter((f) => f.key === cle)).map((f) => ({ ...f, contexte }));
}

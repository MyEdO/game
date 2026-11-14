/**
 * LECTURES de l'édition de scène — outil actif, calques, sélection, picking, emprise du pinceau et formulaire tiré
 * du schéma de chaque porteur (`formulaireDe`). PURES,
 * Node-safe, sans import d'hôte : tout hôte qui embarque le noyau désigne par elles ce qu'il édite.
 * Les ÉCRIVAINS vivent dans `./sceneEdit` ; les deux modules sont au `BRIDGE_PATH` de
 * `scripts/guards/lib/sceneFieldEditability.mjs`.
 */
import {
  dialoguesDeLaScene,
  sceneMetresPerTile,
  type Dialogue,
  type DialogueChoice,
  type DialogueNode,
  type EncounterDef,
  type EntityKind,
  type FaceDArete,
  type Scene,
  type SceneEffectZone,
  type SceneEntity,
  type Trigger,
  type WallSeg,
  type WallSide,
  type ZoneArea,
  type CellSide,
  canonEdge,
  porteAuteur,
} from './monde/scene';
import type { Flow } from '../data/schemas/defs-scenes/effets';
import {
  dialogueSchema,
  encounterDefSchema,
  faceDAreteSchema,
  optionalDeSceneSchema,
  sceneEffectZoneSchema,
  sceneEntitySchema,
  sceneSchema,
  triggerSchema,
  type Terrain,
} from '../data/schemas/defs-scenes/scene';
import { projetSchema } from '../data/schemas/defs-scenes/projet';
import { mapPlaceSchema, mapRouteSchema, placePoiSchema, worldMapSchema } from '../data/schemas/defs-scenes/worldmap';
import { repereDIdentiteSchema, valeurDIdentiteSchema } from '../data/schemas/grammaire/campagne';
import {
  affaireSchema,
  documentNarratifSchema,
  ecartSchema,
  etatNarratifSchema,
  formeDEtatSchema,
  indiceSchema,
  indiceStadeSchema,
  narratifSchema,
  presetPnjSchema,
  valeurDEtatSchema,
  type EcartDeFiche,
  type EtatNarratif,
  type Indice,
  type NarratifBlock,
  type PresetPnj,
} from '../data/schemas/defs-scenes/narratif';
import { identiteDe, libelleDeLigne } from './narratifEdit';
import {
  IDENTITE,
  REPERES,
  STADES,
  VALEURS_D_ETAT,
  idFrais,
  identiteNeuve,
  lignesNeuves,
  repereNeuf,
  type Identite,
  type RegistreCreable,
} from '../data/schemas/defs-scenes/ecritures-du-narratif';
import { FORMES_D_ETAT, etatDeclare, valeursDeclarees } from '../data/schemas/defs-scenes/formes-d-etat';
import { collectionDe, idsDeLaPortee } from '../data/schemas/grammaire/collection-cle';
import { noeudsAuChemin, ouverts, pasDeDonnee } from '../data/schemas/grammaire/descente';
import { porteeDeLaFeuille } from '../data/schemas/grammaire/ref';
import { traitInstanceSchema } from '../data/schemas/grammaire/reference';
import { champsDeclares, choixDuNoeud, formeAuPoint, inferFields, type ChoixDuContexte, type ContexteDuChamp, type FieldDesc } from './codex/editFields';
import { variantesAChoisir } from './valeursNeuves';
import { isOptionalNote } from '../engine/statEntry';
import { chargeLArme, gabaritDObjet } from '../engine/items';
import { travelModeLabels, travelVehicles, vehicleTravel } from '../engine/travel';
import { jsonCanonique } from '../lib/jsonCanonique.mjs';
import { estObjet } from '../lib/objet.mjs';
import { optionsDuNoeud } from '../data/schemas/grammaire/meta';
import { walkFlow } from '../engine/flowCore';
import { isDoorEdgeStructure, isWallEdgeStructure } from '../engine/structures';
import type { Combatant, StructureData } from '../engine/types';
import {
  creatures,
  estUnNavireAPonts,
  navalPorts,
  findCreatureById,
  findTrappingById,
  profilsStandard,
  refEstVolumique,
  siegeEngines,
  spells,
  trappingsInstanciables,
  structureAppearances,
  structures,
  traits,
  type CreatureData,
} from '../data';
import { listesDeSorts, refusDesSortsChoisis, sortsImprimes } from '../engine/sortsDuPnj';
import { ficheDuPersonnage, nomDEntite } from './monde/sceneNpc';
import { t } from '../i18n';
import { mergeCreatureProfile, objetDuNarratif, presetDuNarratif, type ResolveurDePreset } from './monde/resolveursDuNarratif';
import { entreesDeStades, entreesNarratives, type CleDeReferenceNarrative } from './codex/libellesNarratifs';
import { REFERENCES_NARRATIVES } from '../data/schemas/defs-scenes/registres-narratifs';
import { SOUS_REFERENCES, type CleDeSousReference } from '../data/schemas/defs-scenes/refs-narratives';
import { marcheNeuf, peripetieNeuve, portNeuf } from './worldMapEdit';
import { emptyWorldMap, resolvePortRef, type MapPlace, type MapRoute, type ProjectDoc, type WorldMap } from './worldMap';
import type { Warning } from './validateScene';
import { emptyStatblock, statblockDeLaCreature } from '../data/valeursNeuves';
import { customStatblockSchema } from '../data/schemas/defs-scenes/communs';
import { parcoursDe } from '../engine/pnjDeCarriere';
import { entityAppearanceSchema } from '../data/schemas/grammaire/valeurs';
import { apparencesChoisissablesDObjet, objetsAApparenceChoisie } from '../data/apparencesObjets';
import { armesDEntite, equipementDAuteurDe } from './equipementDessine';
import { CAP_IDENTITE_PROP, capDecorAdmis } from '../data/props.types';
import { DIR8_ORDER, estCardinal, type Dir8 } from '../geometry/dir8';
import { decorsEnCaseEtage, entitesEnCaseEtage } from './monde/decorIndex';
import { actionNeuve } from './monde/usable';
import { nextEntityId } from '../lib/entityId';
import { choixSousUneAdresse, estCheminDerive, type SourceDeLEdition } from './edition/adresseDeProse';
import { ancreDuDecor } from './monde/footprint';
import { portePar } from './monde/poseDuDecor';
import { aretesA } from './monde/wallIndex';
import type { Rect, Pt, EffectZoneSeed, Segment } from './sceneEdit';
import { tableTotale } from '../lib/tableTotale';

/** Outil actif (rail de la Palette). `ref` permet la pose DIRECTE d'un décor ou d'une fiche précise.
 *  L'outil d'ENTITÉ est SCINDÉ par `kind` (#877, #1882) : un décor NOMME son type au catalogue, un
 *  personnage NOMME sa fiche au bestiaire — `ref` y est REQUISE, comme au schéma de scène
 *  (`PORTEURS_DU_TYPE`) — et le départ des héros n'a rien à référencer. */
export type Tool =
  | { mode: 'selection' }
  | { mode: 'terrain'; terrain: Terrain }
  | { mode: 'entite'; kind: 'prop'; ref: string }
  | { mode: 'entite'; kind: 'personnage'; ref: string }
  | { mode: 'entite'; kind: 'heroStart' }
  | { mode: 'zone'; zone: ZoneVariant }
  // EMPRISE d'une zone d'effet au PINCEAU (`SceneEffectZone.tiles`) : `zoneId` = id STABLE de la zone
  // peinte, `paint` le sens du geste — l'appui et le glissé ajoutent (ou retirent) des cases, comme le
  // pinceau de terrain pose son terrain. Corriger une pièce qui déborde se fait SUR la carte.
  | { mode: 'casesDeZone'; zoneId: string; paint: 'add' | 'remove' }
  | { mode: 'entree' }
  | { mode: 'rencontre' }
  // `structure` (id de `structures.json`) = le MATÉRIAU porté par l'outil, mémorisé entre les poses
  // (comme un outil de peinture porte sa couleur) — plus besoin de repasser par l'inspecteur (#830).
  | { mode: 'arete'; paint: WallPaint; structure?: string }
  // Hauteur métrique d'une surface (porteuse : marchabilité/combat/chute, cf. `relief.ts`). On peint des
  // MÈTRES ; la traversée verticale s'auto-dérive du delta de hauteur (`surfaceLink`), sans escalier.
  | { mode: 'hauteur'; metres: number }
  // VOLÉE d'escalier : file de cases dont les cotes montent par crans franchissables jusqu'au plancher
  // de l'étage `toZ` (invariant PARTAGÉ avec le compilateur ASCII — `noyau/stairFlight.ts`). L'outil ne
  // pose AUCUN décor : une volée est du relief, la traversée s'en dérive comme pour toute surface.
  | { mode: 'escalier'; toZ: number }
  // Emplacement de siège : pose une SceneEntity portant un poste d'artillerie (`trappingId` = engin du
  // catalogue `armes-de-siege`). Le créneau (arc) et l'équipage s'éditent ensuite dans l'inspecteur.
  | { mode: 'emplacement'; trappingId: string }
  // Crénelage (#841 FU-H) : marque le pourtour peint comme portant un PARAPET crénelé (décoration de
  // rendu — `paintCrenellated`, orthogonal à `height`). `structure` = id de `structures.json` (le rendu en
  // dérive merlons/bandes/arase) ; `null` = gomme la marque.
  | { mode: 'crenelage'; structure: string | null }
  | { mode: 'gomme' };

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

/** Les types de sélection qui désignent un élément du projet par son seul identifiant : de la scène, un lieu et une
 *  route de la carte du monde, une entrée d'un registre créable du narratif (`RegistreCreable`), sous sa clé, ou un
 *  écart. */
type TypeDeSelParId = 'entity' | 'trigger' | 'entry' | 'effectZone' | 'dialogue' | 'encounter' | 'place' | 'route' | RegistreCreable | 'ecart';

/** Sélection unifiée — une seule chose sélectionnée à la fois, sur la carte comme dans les panneaux. */
export type Sel =
  | null
  | { type: TypeDeSelParId; id: string }
  | { type: 'restZone'; idx: number }
  | { type: 'architectureBody'; id: string }
  | { type: 'architectureStorey'; bodyId: string; id: string }
  | { type: 'architecturePart'; bodyId: string; storeyId: string; id: string }
  | { type: 'facadeSection'; bodyId: string; id: string }
  | { type: 'roofSection'; bodyId: string; id: string }
  // Arête de mur (cloison/porte) désignée par sa forme CANONIQUE (case + N|E + couche) — éditable dans
  // l'inspecteur (type, structure destructible). Posée par l'outil murs, sélectionnée à l'outil ↖.
  | { type: 'wall'; x: number; y: number; side: WallSide; z: number };

/** Combien d'EFFETS un Flow authoré porte-t-il, à TOUTE profondeur — les feuilles `effet` nichées sous
 *  un `si`, un `test` ou un `choix` comptent autant que celles de premier niveau. C'est le nombre que
 *  l'atelier annonce (pastille du dock, bouton « Effets (N) » de l'inspecteur) : un trigger dont tout
 *  l'effet vit dans une branche est un trigger qui AGIT. Distinct de `flowEffects` (moteur), qui
 *  n'énumère que le premier niveau parce que ses index CLÉENT les interactions d'entité. */
export function flowEffectCount(flow: Flow): number {
  let n = 0;
  walkFlow(flow, (node) => {
    if (node.kind === 'effet') n++;
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

/** État d'une arête : 'none' | 'wall' (pleine) | 'door' (franchissable), sur l'étage `z`. */
export function edgeWallState(scene: Scene, x: number, y: number, side: CellSide, z = 0): 'none' | 'wall' | 'door' {
  const e = canonEdge(x, y, side);
  const w = aretesA(scene, e.x, e.y, e.side, z)[0];
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
export type EntityTool = Extract<Tool, { mode: 'entite' }>;

/** La donnée d'une entrée de chaque registre créable du narratif (`RegistreCreable`), sous sa clé. */
type DonneeDesRegistres = { [R in RegistreCreable]: NarratifBlock[R][number] };

/** La donnée du porteur de chaque sorte de formulaire tiré du schéma : une entrée de chaque registre créable du narratif
 *  (`DonneeDesRegistres`), un écart et le narratif compris. */
export interface DonneeDuPorteur extends DonneeDesRegistres { zone: SceneEffectZone; declencheur: Trigger; entite: SceneEntity; dialogue: Dialogue; rencontre: EncounterDef; scene: Scene; lieu: MapPlace; route: MapRoute; carte: WorldMap; projet: ReglagesDuProjet; ecart: EcartDeFiche; narratif: NarratifBlock }

/** La sorte d'un porteur de formulaire tiré du schéma. */
export type SorteDePorteur = keyof DonneeDuPorteur;

/** Les chemins de clés et de rangs, depuis la donnée d'un porteur, des champs qu'il offre : chacun avec tout ce qu'il
 *  porte. */
type CheminsOfferts = readonly (readonly Segment[])[];

/** Le cadre où vit un porteur de formulaire tiré du schéma : sa scène, les scènes, la carte du monde et le narratif de
 *  son projet, et le `Source/` que ses adresses de prose désignent (`SourceDeLEdition`). */
export interface CadreDuPorteur { scene: Scene; projet: Pick<ProjectDoc, 'scenes' | 'narratif' | 'worldMap'>; source: SourceDeLEdition }

/** Le projet édité : le document que tient un cran de l'historique de l'éditeur. */
export type ProjetDEdition = Omit<ProjectDoc, 'schema'>;

/** Les réglages du projet édité que porte le projet lui-même, hors de ses scènes, de sa carte et de son narratif : ses
 *  axes actifs (#409), sous son identifiant. */
export type ReglagesDuProjet = Pick<ProjetDEdition, 'id' | 'activeAxes'>;

/** Le type de chaque document du projet édité où vit un porteur. */
interface TypesDesDocuments { scene: Scene; carte: NonNullable<ProjectDoc['worldMap']>; narratif: ProjectDoc['narratif']; projet: ReglagesDuProjet }

/** La sorte d'un document du projet édité. */
export type SorteDeDocument = keyof TypesDesDocuments;

/** Ce qu'un document du projet édité déclare : son identifiant dans le projet où la scène `sceneId` est montrée, sa
 *  lecture dans le projet `projet` (`undefined` : absent du projet), le projet où il devient `doc`, son schéma, et, du
 *  document qui peut manquer au projet, celui qu'il reçoit à son ouverture. */
export interface DocumentDuProjet<T> {
  id: (sceneId: string) => string;
  lire: (projet: ProjetDEdition, sceneId: string) => T | undefined;
  ecrire: (projet: ProjetDEdition, sceneId: string, doc: T) => ProjetDEdition;
  schema: unknown;
  neuf?: (projet: ProjetDEdition) => T;
}

/** Les documents du projet édité : la scène montrée, sous son identifiant, la carte du monde et le narratif, chacun seul
 *  de sa sorte au projet, sous elle, et ses réglages (`ReglagesDuProjet`), sous `projet`, lus et écrits au projet, sous
 *  son schéma : ses axes actifs absents valent le socle (`resolveActiveAxes`). La carte absente du projet en reçoit une vide (`emptyWorldMap`), sous un identifiant
 *  qu'aucune de ses scènes ne porte : la validation range ses avertissements sous lui (`Warning.sceneId`). #3606 */
export const DOCUMENTS: { readonly [K in SorteDeDocument]: DocumentDuProjet<TypesDesDocuments[K]> } = {
  scene: {
    id: (sceneId) => sceneId,
    lire: (projet, sceneId) => projet.scenes.find((sc) => sc.id === sceneId),
    ecrire: (projet, sceneId, scene) => ({ ...projet, scenes: projet.scenes.map((sc) => (sc.id === sceneId ? scene : sc)) }),
    schema: sceneSchema,
  },
  carte: {
    id: () => 'carte',
    lire: (projet) => projet.worldMap,
    ecrire: (projet, _sceneId, worldMap) => ({ ...projet, worldMap }),
    schema: worldMapSchema,
    neuf: (projet) => emptyWorldMap(nextEntityId('carte', projet.scenes.map((sc) => sc.id))),
  },
  narratif: { id: () => 'narratif', lire: (projet) => projet.narratif, ecrire: (projet, _sceneId, narratif) => ({ ...projet, narratif }), schema: narratifSchema },
  projet: {
    id: () => 'projet',
    lire: ({ id, activeAxes }) => (activeAxes === undefined ? { id } : { id, activeAxes }),
    ecrire: ({ activeAxes: _avant, ...projet }, _sceneId, { activeAxes }) => (activeAxes === undefined ? projet : { ...projet, activeAxes }),
    schema: projetSchema,
  },
};

/** La clé du type `T` dont la collection, présente ou non, a pour élément exactement `D`. */
type CollectionDe<T, D> = { [K in keyof T]-?: NonNullable<T[K]> extends readonly (infer E)[] ? ([E] extends [D] ? ([D] extends [E] ? K : never) : never) : never }[keyof T];

/** `A` et `B` sont-ils le même type ? */
type Egaux<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;

/** Où vit un porteur de donnée `D` : son document, et sa collection dans ce document ; sans collection, le porteur
 *  SINGULIER de son document, qui est le document, identifié par lui (`DocumentDuProjet.id`). */
export type AccesDuPorteur<D> = {
  [K in SorteDeDocument]:
    | { document: K; collection: CollectionDe<TypesDesDocuments[K], D> }
    | (Egaux<TypesDesDocuments[K], D> extends true ? { document: K; collection?: undefined } : never);
}[SorteDeDocument];

/** Ce qu'un porteur de formulaire tiré du schéma déclare : où il vit (`AccesDuPorteur`), le type de la sélection
 *  qui le désigne (`Sel`), absent du porteur singulier d'un document, que désigne l'absence de sélection, le nœud
 *  de sa donnée, la portée des avertissements de la validation qui le désignent (`Warning.scope`, `porteurDeLaPortee`),
 *  les champs qu'il offre, et les choix que son contexte pose à un chemin de sa donnée (`choixDuChamp`), dans son cadre. */
interface FormulaireDuPorteur<D> {
  acces: AccesDuPorteur<D>;
  sel?: TypeDeSelParId;
  schema: unknown;
  portee?: Warning['scope'];
  /** Le porteur se liste à la zone Logique de l'éditeur quand son document est ouvert, qui le sélectionne ; sinon il
   *  s'atteint sur le plan. */
  logique?: true;
  champs: (donnee: D, cadre: CadreDuPorteur) => CheminsOfferts;
  /** Les chemins de sa donnée qui se retirent entiers sans s'écrire entiers (`avecLaValeurDuPorteur`) : d'une clé,
   *  l'objet qu'elle porte ; d'un rang, l'élément de sa liste. */
  retraits?: (donnee: D) => CheminsOfferts;
  choix?: (donnee: D, chemin: readonly Segment[], cadre: CadreDuPorteur) => readonly ChoixDuContexte[] | undefined;
}

/** Les champs que le formulaire d'un personnage offre : de son rôle au combat, ses options, ses Compétences, le tirage de
 *  ses Caractéristiques et son embuscade ; son profil personnalisé ; sa contrepartie d'amateur des arts, son marchand, son
 *  jeu de taverne, son apparence, son animation. */
const CHAMPS_DU_PERSONNAGE: CheminsOfferts = [['combat', 'optionals'], ['combat', 'skills'], ['combat', 'randomChars'], ['combat', 'hiddenUntilCombat'], ['statblock'], ['amateur'], ['merchant'], ['tavernGame'], ['appearance'], ['anim']];

/** Les profils d'auteur qu'un PNJ de carrière ne porte pas (`refusDuPnjDeCarriere`) : son profil personnalisé et son preset. */
const PROFILS_D_AUTEUR: readonly Segment[] = ['statblock', 'presetId'];

/** L'apparence d'un PNJ de carrière : chacune de ses clés (`entityAppearanceSchema`), hors de la tenue, que sa carrière
 *  actuelle habille (`refusDuPnjDeCarriere`). */
const APPARENCE_DU_PNJ_DE_CARRIERE: CheminsOfferts = champsDeclares(entityAppearanceSchema)!.flatMap(([cle]) => (cle === 'tenue' ? [] : [['appearance', cle]]));

/** Les sorts que l'auteur choisit pour un personnage. */
const SORTS_CHOISIS = ['combat', 'spells'] as const;

/** Les champs que le formulaire du personnage `ent` offre (`CHAMPS_DU_PERSONNAGE`), dans son cadre : son preset s'il en
 *  porte un ou si son narratif en déclare ; son dialogue s'il en porte un ou si sa scène en déclare
 *  (`dialoguesDeLaScene`) ; ses sorts choisis s'il en porte, ou si sa fiche (`ficheEditee`)
 *  ouvre une liste de sorts (`listesDeSorts`) sans imprimer les siens (`sortsImprimes`) ; d'une coque, son véhicule,
 *  ses Améliorations et ses postes (MDG 12) ; d'un PNJ de carrière (`parcoursDe`), aucun de ses profils d'auteur (`PROFILS_D_AUTEUR`),
 *  et son apparence sans tenue (`APPARENCE_DU_PNJ_DE_CARRIERE`). */
function champsDuPersonnage(ent: SceneEntity, { scene, projet: { narratif } }: CadreDuPorteur): CheminsOfferts {
  const preset = ent.presetId !== undefined || narratif.presetsPnj.length ? [['presetId']] : [];
  const dialogue = ent.dialogueId !== undefined || dialoguesDeLaScene(scene).size ? [['dialogueId']] : [];
  const fiche = ent.combat?.spells?.length ? undefined : ficheEditee(ent, presetDuNarratif(narratif));
  const sorts = ent.combat?.spells?.length || (fiche && !sortsImprimes(fiche.porteurDeFiche).length && listesDeSorts(fiche).length) ? [SORTS_CHOISIS] : [];
  const coque = ent.vehicule ? [['vehicule'], ['upgrades'], ['postes']] : [];
  const champs = [...preset, ...dialogue, ...CHAMPS_DU_PERSONNAGE, ...sorts, ...coque];
  if (!parcoursDe(ent)) return champs;
  return champs.flatMap((c) => (PROFILS_D_AUTEUR.includes(c[0]) ? [] : c[0] === 'appearance' ? APPARENCE_DU_PNJ_DE_CARRIERE : [c]));
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
  const standard = new Set<string>(traits.filter((t) => t.standard).map((t) => t.id));
  return (id) => {
    const rang = facultatifs.indexOf(id as string);
    return rang >= 0 ? rang : facultatifs.length + (standard.has(id as string) ? 0 : 1);
  };
}

/** Les choix que le contexte d'un personnage pose à ses options (`combat.optionals`, LDB 76) : d'un élément présent, sa variante,
 *  le Trait, ou l'une des notes du Bestiaire de sa fiche, posée entière, verbatim (la courante restant offerte) ; de
 *  l'identifiant d'un Trait, tous les Traits, dans leur rang d'offre (`rangDOffreDuTrait`). */
function choixDesOptions(ent: SceneEntity, chemin: readonly Segment[]): readonly ChoixDuContexte[] | undefined {
  const [combat, optionals, rang, cle, ...reste] = chemin;
  if (combat !== 'combat' || optionals !== 'optionals' || typeof rang !== 'number' || rang >= (ent.combat?.optionals?.length ?? 0) || reste.length) return undefined;
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
 *  copie de sa créature du Bestiaire (`statblockDeLaCreature`), s'il en porte une, refusée du premier message de son
 *  schéma (`customStatblockSchema`) qu'elle viole. */
function choixDuProfil(ent: SceneEntity, presetDe: ResolveurDePreset): readonly ChoixDuContexte[] {
  const creature = findCreatureById(ent.creature?.id);
  const copie = creature && statblockDeLaCreature(creature);
  const lue = copie && customStatblockSchema.safeParse(copie);
  return [
    { valeur: emptyStatblock(nomDEntite(ent, presetDe)), libelle: t('ecran.editeur.profil.neuf'), refus: null },
    ...(creature && lue ? [{ valeur: copie, libelle: t('ecran.editeur.profil.copie', { fiche: creature.label }), refus: lue.success ? null : lue.error.issues[0].message }] : []),
  ];
}

/** L'apparence des objets d'un personnage, par objet (`EntityAppearance.apparencesObjets`). */
const APPARENCES_D_OBJETS = ['appearance', 'apparencesObjets'] as const;

/** Les choix posés à l'apparence des objets d'un porteur dont les armes sont `armes`, l'objet résolu par `objet`, sous
 *  elle au chemin `reste` : ses clés, chaque objet de ces armes dont l'apparence se choisit (`objetsAApparenceChoisie`) ;
 *  d'un objet, chacune de ses apparences choisissables (`apparencesChoisissablesDObjet`), posée entière ou par son
 *  identifiant. #2948 */
function choixDesApparencesDObjets(armes: () => ReturnType<typeof armesDEntite>, objet: ReturnType<typeof objetDuNarratif>, reste: readonly Segment[]): readonly ChoixDuContexte[] | undefined {
  const [trappingId, cle, ...plus] = reste;
  if (trappingId === undefined) return objetsAApparenceChoisie(armes(), objet).map((id) => ({ valeur: id, libelle: objet(id)?.label ?? id, refus: null }));
  if (typeof trappingId !== 'string' || plus.length || (cle !== undefined && cle !== 'id')) return undefined;
  return apparencesChoisissablesDObjet(trappingId, objet).map((a) => ({ valeur: cle === undefined ? { id: a.id } : a.id, libelle: a.label, refus: null }));
}

/** Les munitions du coffre d'une pièce `trappingId` : chaque munition du catalogue qu'elle charge (`chargeLArme`).
 *  MDG 12 l.410-424 */
function munitionsDeLaPiece(trappingId: string): ChoixDuContexte[] {
  const piece = { trappingId, subType: findTrappingById(trappingId)?.subType?.id };
  return trappingsInstanciables()
    .filter((m) => chargeLArme({ trappingId: m.id, subType: m.subType?.id }, piece) && gabaritDObjet(m.id)?.kind === 'ammo')
    .map((m) => ({ valeur: m.id, libelle: m.label, refus: null }));
}

/** Les choix que le contexte de la coque `ent`, dans le cadre `cadre`, pose à ses postes, sous eux au chemin `reste` : au
 *  rang qui suit le dernier, un poste neuf par engin de siège (`siegeEngines`) ; de la pièce d'un poste, chaque engin de
 *  siège ; d'un de ses servants, chaque personnage de la scène sans coque, hors des autres servants de la coque, le
 *  courant restant offert ; des clés de son coffre, les munitions de sa pièce (`munitionsDeLaPiece`) ; de sa munition choisie,
 *  posée entière ou par son identifiant, chaque munition de son coffre. MDG 12 */
function choixDesPostes(ent: SceneEntity, reste: readonly Segment[], { scene, projet: { narratif } }: CadreDuPorteur): readonly ChoixDuContexte[] | undefined {
  const postes = ent.postes ?? [];
  const [rang, cle, element, ...plus] = reste;
  if (typeof rang !== 'number' || plus.length) return undefined;
  const engins = (valeur: (id: string) => unknown) => siegeEngines().map((e) => ({ valeur: valeur(e.id), libelle: e.label, refus: null }));
  if (cle === undefined) return rang === postes.length ? engins((trappingId) => ({ trappingId })) : undefined;
  const poste = postes[rang];
  if (!poste) return undefined;
  if (cle === 'trappingId' && element === undefined) return engins((id) => id);
  if (cle === 'ammo' && element === undefined) return munitionsDeLaPiece(poste.trappingId);
  if (cle === 'selectedAmmo' && (element === undefined || element === 'id')) {
    return Object.keys(poste.ammo ?? {}).map((id) => ({ valeur: element === undefined ? { id } : id, libelle: findTrappingById(id)?.label ?? id, refus: null }));
  }
  if (cle !== 'crewIds' || typeof element !== 'number') return undefined;
  const servants = postes.flatMap((p) => p.crewIds ?? []);
  const courant = poste.crewIds?.[element];
  return scene.entities
    .filter((e) => e.kind === 'personnage' && !e.vehicule && (e.id === courant || !servants.includes(e.id)))
    .map((e) => ({ valeur: e.id, libelle: nomDEntite(e, presetDuNarratif(narratif)) ?? t('ecran.editeur.entite.personnage'), refus: null }));
}

/** Les choix que le contexte d'un personnage pose au chemin `chemin` de sa donnée, dans le cadre `cadre` : ceux de son
 *  profil personnalisé (`choixDuProfil`), de ses postes (`choixDesPostes`), de l'apparence de ses objets
 *  (`APPARENCES_D_OBJETS`, `choixDesApparencesDObjets`), les armes de ce qu'il déclare dans sa scène
 *  (`armesDEntite`, `equipementDAuteurDe`), d'un sort choisi (`choixDesSorts`), de ses options
 *  (`choixDesOptions`). */
function choixDuPersonnage(ent: SceneEntity, chemin: readonly Segment[], cadre: CadreDuPorteur): readonly ChoixDuContexte[] | undefined {
  const { narratif } = cadre.projet;
  if (chemin.length === 1 && chemin[0] === 'statblock') return choixDuProfil(ent, presetDuNarratif(narratif));
  if (chemin[0] === 'postes') return choixDesPostes(ent, chemin.slice(1), cadre);
  if (APPARENCES_D_OBJETS.every((cle, i) => chemin[i] === cle)) {
    const objet = objetDuNarratif(narratif);
    return choixDesApparencesDObjets(() => armesDEntite(objet, ent.creature?.id, equipementDAuteurDe(ent, cadre.scene)), objet, chemin.slice(APPARENCES_D_OBJETS.length));
  }
  const [rang, ...reste] = chemin.slice(SORTS_CHOISIS.length);
  const sorts = SORTS_CHOISIS.every((cle, i) => chemin[i] === cle) && typeof rang === 'number' && !reste.length;
  return sorts ? choixDesSorts(ent, rang, presetDuNarratif(narratif)) : choixDesOptions(ent, chemin);
}

/** Les actions authorées d'un décor (`SceneEntity.usable`). */
const ACTIONS_DU_DECOR = ['usable', 'actions'] as const;

/** Les choix que le contexte du décor `ent` pose au chemin `chemin` de sa donnée : à son utilisable absent, puis au rang
 *  qui suit sa dernière action, l'action neuve que ses actions laissent libre (`actionNeuve`), par son identifiant. */
function choixDuDecor(ent: SceneEntity, chemin: readonly Segment[]): readonly ChoixDuContexte[] | undefined {
  const actions = ent.usable?.actions ?? [];
  const neuve = actionNeuve(actions);
  const pose = (valeur: unknown) => [{ valeur, libelle: neuve.id, refus: null }];
  if (chemin.length === 1 && chemin[0] === 'usable') return ent.usable ? undefined : pose({ actions: [neuve] });
  const ajout = chemin.length === ACTIONS_DU_DECOR.length + 1 && chemin[ACTIONS_DU_DECOR.length] === actions.length;
  return ajout && ACTIONS_DU_DECOR.every((cle, i) => chemin[i] === cle) ? pose(neuve) : undefined;
}

/** Le nœud neuf du dialogue `dialogue` : sans réplique ni choix, d'id `n<k>` qu'aucun de ses nœuds ne porte (`k` part
 *  du nombre de ses nœuds + 1). */
export function noeudNeuf(dialogue: Pick<Dialogue, 'nodes'>): DialogueNode {
  let n = dialogue.nodes.length + 1;
  while (dialogue.nodes.some((x) => x.id === `n${n}`)) n++;
  return { id: `n${n}`, choices: [] };
}

/** Le choix neuf du nœud `noeud` : sans libellé, d'id frais parmi ses choix (`nextEntityId`). */
export const choixNeuf = (noeud: Pick<DialogueNode, 'choices'>): DialogueChoice => ({ id: nextEntityId('choix', noeud.choices.map((c) => c.id)), label: '' });

/** Les choix que le contexte du dialogue `dlg` pose au chemin `chemin` de sa donnée : au rang qui suit son dernier nœud,
 *  le nœud neuf (`noeudNeuf`) ; au rang qui suit le dernier choix d'un de ses nœuds, le choix neuf (`choixNeuf`) ;
 *  chacun par son identifiant. #3606 */
function choixDuDialogue(dlg: Dialogue, chemin: readonly Segment[]): readonly ChoixDuContexte[] | undefined {
  const [nodes, rang, choices, rangDuChoix, ...reste] = chemin;
  if (nodes !== 'nodes' || typeof rang !== 'number' || reste.length) return undefined;
  const pose = (valeur: { id: string }) => [{ valeur, libelle: valeur.id, refus: null }];
  if (choices === undefined) return rang === dlg.nodes.length ? pose(noeudNeuf(dlg)) : undefined;
  const noeud = dlg.nodes[rang];
  return noeud && choices === 'choices' && rangDuChoix === noeud.choices.length ? pose(choixNeuf(noeud)) : undefined;
}

/** Les champs d'une rencontre que son formulaire offre entiers. */
const CHAMPS_DE_LA_RENCONTRE: CheminsOfferts = [['victoryCondition'], ['onVictory'], ['surprise'], ['maneuverability'], ['threat'], ['terrain'], ['banRanged'], ['siege'], ['couvre']];

/** Les champs que le formulaire de la rencontre `enc` offre : les siens (`CHAMPS_DE_LA_RENCONTRE`), et de chacun de ses
 *  membres, à son rang, sa monture et celle qu'il chevauche ; ses membres s'enrôlent et se retirent par leurs
 *  écrivains (`addMember`, `removeMember`). #3606 */
const champsDeLaRencontre = (enc: EncounterDef): CheminsOfferts =>
  [...CHAMPS_DE_LA_RENCONTRE, ...(enc.members ?? []).flatMap((_, i) => [['members', i, 'mount'], ['members', i, 'ridesEntityId']])];

/** Les clés de premier niveau que déclare le schéma `schema`, hors des clés `exclues`, chacune en champ offert entier. */
const champsSauf = (schema: unknown, exclues: readonly string[]): CheminsOfferts =>
  champsDeclares(schema)!.flatMap(([cle]) => (exclues.includes(cle) ? [] : [[cle]]));

/** Les champs qu'offre le formulaire d'un lieu : chacun de son schéma, hors de son identifiant, de sa position sur la
 *  carte (`pos`, donnée spatiale) et de ses points d'intérêt ; de chacun d'eux, à son rang, chaque champ hors de son
 *  identifiant et de sa position sur le plan. #3606 */
const CHAMPS_DU_LIEU = champsSauf(mapPlaceSchema, ['id', 'pos', 'poi']);
const CHAMPS_DU_POI = champsSauf(placePoiSchema, ['id', 'pos']);
const champsDuLieu = (lieu: MapPlace): CheminsOfferts =>
  [...CHAMPS_DU_LIEU, ...(lieu.poi ?? []).flatMap((_, i) => CHAMPS_DU_POI.map(([cle]) => ['poi', i, cle]))];

/** Les champs qu'offre le formulaire d'une route : chacun de son schéma, hors de son identifiant, de ses extrémités et
 *  de son sens, que pose sa liaison (`lierLieux`). #3606 */
const CHAMPS_DE_LA_ROUTE = champsSauf(mapRouteSchema, ['id', 'a', 'b', 'from']);

/** Les points d'entrée de la scène `id` du cadre `cadre`, chacun par son nom. */
const entreesDeLaScene = (id: string | undefined, { projet }: CadreDuPorteur): readonly ChoixDuContexte[] =>
  Object.keys(projet.scenes.find((sc) => sc.id === id)?.entryPoints ?? {}).map((nom) => ({ valeur: nom, libelle: nom, refus: null }));

/** Les profils neufs qu'un lieu reçoit à son port et à son marché absents (`portNeuf`, `marcheNeuf`), chacun son libellé. */
const PROFILS_NEUFS_DU_LIEU = {
  port: { neuf: portNeuf, libelle: 'ecran.editeur.lieu.portNeuf' },
  market: { neuf: marcheNeuf, libelle: 'ecran.editeur.lieu.marcheNeuf' },
} as const;

/** Les ports du catalogue qu'un lieu reçoit à son port absent : chaque port de l'Index (`navalPorts`), son profil
 *  entier tiré du catalogue (`resolvePortRef`). MDG 15 */
const portsDuCatalogue = (): readonly ChoixDuContexte[] =>
  navalPorts.map((p) => ({ valeur: resolvePortRef({ ref: p.id }), libelle: `${p.label} (${p.region})`, refus: null }));

/** Les choix que le contexte du lieu `lieu` pose au chemin `chemin` de sa donnée : à son point d'entrée, ceux de sa
 *  scène (`entreesDeLaScene`) ; à son port ou à son marché absent, son profil neuf (`PROFILS_NEUFS_DU_LIEU`), et, au
 *  port, chaque port du catalogue (`portsDuCatalogue`). #3606 */
function choixDuLieu(lieu: MapPlace, chemin: readonly Segment[], cadre: CadreDuPorteur): readonly ChoixDuContexte[] | undefined {
  const [cle, ...reste] = chemin;
  if (reste.length) return undefined;
  if (cle === 'entry') return entreesDeLaScene(lieu.scene.id, cadre);
  if ((cle !== 'port' && cle !== 'market') || lieu[cle] !== undefined) return undefined;
  const { neuf, libelle } = PROFILS_NEUFS_DU_LIEU[cle];
  return [{ valeur: neuf(), libelle: t(libelle), refus: null }, ...(cle === 'port' ? portsDuCatalogue() : [])];
}

/** Les lieux d'où part un billet de la route `route` (`routeBilletSchema.depuis`) : son lieu de départ si elle est à sens
 *  unique (`from`), sinon chacune de ses extrémités, chacun posé entier (`{ id }`) ou par son identifiant (`id`, `cle`). */
const departsDuBillet = (route: MapRoute, cle: Segment | undefined, { projet }: CadreDuPorteur): readonly ChoixDuContexte[] =>
  (route.from ? [route.from] : [route.a, route.b]).map(({ id }) => ({ valeur: cle === undefined ? { id } : id, libelle: projet.worldMap?.places.find((p) => p.id === id)?.label ?? id, refus: null }));

/** Les modes de la route `route` que retient `retenu`, chacun à son libellé (`travelModeLabels`). */
const modesDeLaRoute = (route: MapRoute, retenu: (mode: string) => boolean = () => true): ChoixDuContexte[] =>
  route.modes.filter(retenu).map((mode) => ({ valeur: mode, libelle: travelModeLabels()[mode] ?? mode, refus: null }));

/** Les modes de voyage que la route `route` offre au rang `rang` de ses modes : à pied et chaque véhicule à passage
 *  payant (`travelVehicles`), hors de ceux qu'elle offre déjà, le courant restant offert, chacun à son libellé. LDB 51
 *  l.178-189 */
const modesDeVoyage = (route: MapRoute, rang: number): ChoixDuContexte[] =>
  ['pied', ...travelVehicles().map((v) => v.id)]
    .filter((mode) => mode === route.modes[rang] || !route.modes.includes(mode))
    .map((mode) => ({ valeur: mode, libelle: travelModeLabels()[mode] ?? mode, refus: null }));

/** Les clés des prix d'un billet en `mode` (`prixParClasseSchema`) : chaque classe de passage de son véhicule. */
const classesDuBillet = (mode: Segment): ChoixDuContexte[] =>
  (typeof mode === 'string' ? vehicleTravel(mode)?.classes ?? [] : []).map((c) => ({ valeur: c.id, libelle: c.label, refus: null }));

/** Les routes que la suite du billet en `mode` de la route `route` couvre au rang `rang` : chaque autre route de la carte
 *  qui offre ce mode, hors de celles que sa suite couvre déjà, la courante restant offerte, chacune nommée par ses
 *  extrémités. EDO 01 l.142 */
function suitesDuBillet(route: MapRoute, mode: Segment, rang: number, { projet }: CadreDuPorteur): ChoixDuContexte[] {
  const carte = projet.worldMap;
  const suite = route.billets?.[mode as keyof NonNullable<MapRoute['billets']>]?.suite ?? [];
  const nom = (ref: { id: string }) => carte?.places.find((p) => p.id === ref.id)?.label ?? ref.id;
  return (carte?.routes ?? [])
    .filter((r) => r.id !== route.id && r.modes.includes(mode as string) && (r.id === suite[rang] || !suite.includes(r.id)))
    .map((r) => ({ valeur: r.id, libelle: `${nom(r.a)} → ${nom(r.b)}`, refus: null }));
}

/** Les choix que le contexte d'un billet de la route `route`, en `mode`, pose sous lui au chemin `reste` : ses départs
 *  (`departsDuBillet`) ; les routes de sa suite (`suitesDuBillet`) ; les clés de son prix et de celui de chaque palier
 *  de son marchandage (`classesDuBillet`). EDO 01 l.142 */
function choixDuBillet(route: MapRoute, mode: Segment, reste: readonly Segment[], cadre: CadreDuPorteur): readonly ChoixDuContexte[] | undefined {
  const [cle, ...sous] = reste;
  if (cle === 'depuis' && (sous.length === 0 || (sous.length === 1 && sous[0] === 'id'))) return departsDuBillet(route, sous[0], cadre);
  if (cle === 'prix' && !sous.length) return classesDuBillet(mode);
  if (cle === 'suite' && sous.length === 1 && typeof sous[0] === 'number') return suitesDuBillet(route, mode, sous[0], cadre);
  const [paliers, rang, prix, ...plus] = sous;
  return cle === 'marchandage' && paliers === 'paliers' && typeof rang === 'number' && prix === 'prix' && !plus.length ? classesDuBillet(mode) : undefined;
}

/** Les choix que le contexte de la route `route` pose au chemin `chemin` de sa donnée : chacun de ses modes
 *  (`modesDeVoyage`) ; les clés de ses billets, chacun
 *  de ses modes à passage payant (`vehicleTravel`), et sous l'un d'eux, ceux du billet (`choixDuBillet`) ; les clés de
 *  sa vitesse, chacun de ses modes ; au rang qui suit sa dernière péripétie, la péripétie neuve (`peripetieNeuve`) ; à
 *  son embuscade, de son point d'entrée, ceux de sa scène (`entreesDeLaScene`), de sa rencontre, chaque rencontre de sa
 *  scène. #3606 */
function choixDeLaRoute(route: MapRoute, chemin: readonly Segment[], cadre: CadreDuPorteur): readonly ChoixDuContexte[] | undefined {
  const [ambush, cle, ...reste] = chemin;
  if (ambush === 'billets') return cle === undefined ? modesDeLaRoute(route, (mode) => vehicleTravel(mode) !== undefined) : choixDuBillet(route, cle, reste, cadre);
  if (ambush === 'speed') return cle === undefined ? modesDeLaRoute(route) : undefined;
  if (ambush === 'modes' && typeof cle === 'number' && !reste.length) return modesDeVoyage(route, cle);
  if (ambush === 'perils' && cle === (route.perils?.length ?? 0) && !reste.length) {
    const neuve = peripetieNeuve();
    return [{ valeur: neuve, libelle: neuve.label, refus: null }];
  }
  if (ambush !== 'ambush' || reste.length) return undefined;
  const id = route.ambush?.scene.id;
  if (cle === 'entry') return entreesDeLaScene(id, cadre);
  if (cle !== 'encounter') return undefined;
  return (cadre.projet.scenes.find((sc) => sc.id === id)?.encounters ?? []).map((e) => ({ valeur: e.id, libelle: e.id, refus: null }));
}

/** Les champs qu'offre, sous la sous-collection à clé au chemin `parent`, de ses éléments `elements` de schéma
 *  `schema` : de chacun, à son rang, chaque champ hors de son identifiant, que le geste dédié change en propageant
 *  (`renommerElement`) ; le rang qui suit le dernier, où l'élément neuf s'ajoute. La sous-collection entière n'est pas
 *  offerte : aucun raccourcissement ne la réécrit, son élément se retire par le geste dédié (`retirerElement`). #3606 B8 */
const champsDesElements = (parent: readonly Segment[], schema: unknown, elements: readonly unknown[]): CheminsOfferts =>
  [...elements.flatMap((_, i) => champsSauf(schema, ['id']).map(([cle]) => [...parent, i, cle])), [...parent, elements.length]];

/** Les lignes de l'identité d'un état. */
const LIGNES = [...IDENTITE, 'lignes'] as const;

/** Les champs qu'offre le formulaire d'un indice : chacun de son schéma hors de son identifiant et de ses stades, et
 *  ceux de ses stades (`champsDesElements`). */
const champsDeLIndice = (indice: Indice): CheminsOfferts =>
  [...champsSauf(indiceSchema, ['id', 'stades']), ...champsDesElements(STADES, indiceStadeSchema, indice.stades)];

/** `chemin` est-il, sous `parent`, le rang qui suit les `n` éléments de sa sous-collection ? */
const auRangNeuf = (chemin: readonly Segment[], parent: readonly Segment[], n: number): boolean =>
  chemin.length === parent.length + 1 && parent.every((cle, i) => chemin[i] === cle) && chemin[parent.length] === n;

/** L'élément neuf posé par son identifiant, seul choix. */
const poseNeuf = <V extends { id: string }>(valeur: V): readonly ChoixDuContexte[] => [{ valeur, libelle: valeur.id, refus: null }];

/** Les choix que le contexte de l'indice `indice`, dans le cadre `cadre`, pose au chemin `chemin` de sa donnée : au rang
 *  qui suit son dernier stade, le stade neuf, d'identifiant frais (`idFrais`), à prose vide (`NarratifEditor`, `addStade`) ;
 *  à un de ses renvois (`refs`), chaque autre indice de son narratif, hors de ceux qu'il renvoie déjà, le courant restant
 *  offert. #3606 */
function choixDeLIndice(indice: Indice, chemin: readonly Segment[], { projet: { narratif } }: CadreDuPorteur): readonly ChoixDuContexte[] | undefined {
  if (auRangNeuf(chemin, STADES, indice.stades.length)) return poseNeuf({ id: idFrais('stade', indice.stades), prose: '' });
  const [refs, rang, ...reste] = chemin;
  if (refs !== 'refs' || typeof rang !== 'number' || reste.length) return undefined;
  const poses = indice.refs ?? [];
  return narratif.indices
    .filter((i) => i.id !== indice.id && (i.id === poses[rang] || !poses.includes(i.id)))
    .map((i) => ({ valeur: i.id, libelle: i.titre || i.id, refus: null }));
}

/** Les champs d'une valeur d'une ligne d'identité, hors de son repère, que posent la couverture de l'identité
 *  (`etatCouvert`) et le renommage du repère (`renommeAuProjet`). */
const CHAMPS_DE_LA_VALEUR_D_IDENTITE = champsSauf(valeurDIdentiteSchema, ['repere']);

/** Les champs qu'offre l'identité `identite` : ses ancres, entières ; ses repères par élément (`champsDesElements`) ; de
 *  chacune de ses lignes, son espèce, son sexe et, de chacune de ses valeurs, ses champs hors de son repère
 *  (`CHAMPS_DE_LA_VALEUR_D_IDENTITE`) ; le rang qui suit sa dernière ligne, où la ligne neuve s'ajoute. Ses repères et ses
 *  lignes entiers ne sont pas offerts : une ligne se retire par son retrait déclaré (`retraitsDeLEtat`). */
const champsDeLIdentite = (identite: Identite): CheminsOfferts => [
  [...IDENTITE, 'ancres'],
  ...champsDesElements(REPERES, repereDIdentiteSchema, identite.reperes),
  ...identite.lignes.flatMap((l, j) => [
    [...LIGNES, j, 'espece'],
    [...LIGNES, j, 'sexe'],
    ...l.valeurs.flatMap((_, k) => CHAMPS_DE_LA_VALEUR_D_IDENTITE.map(([c]) => [...LIGNES, j, 'valeurs', k, c])),
  ]),
  [...LIGNES, identite.lignes.length],
];

/** Les champs qu'offre le formulaire d'un état : chacun de son schéma hors de son identifiant et de sa forme ; de sa forme
 *  courante (`formeAuPoint`), chaque champ hors de son discriminant, ses valeurs déclarées par élément
 *  (`champsDesElements`), son identité présente par ses champs (`champsDeLIdentite`), absente entière, où elle se pose.
 *  Changer de forme n'y est pas offert. */
function champsDeLEtat(etat: EtatNarratif): CheminsOfferts {
  const identite = identiteDe(etat);
  const forme = champsSauf(formeAuPoint(formeDEtatSchema, etat.forme)!.noeud, ['kind', 'valeurs', ...(identite ? ['identite'] : [])]).map((c) => ['forme', ...c]);
  const valeurs = FORMES_D_ETAT[etat.forme.kind].valeursDeclarees ? champsDesElements(VALEURS_D_ETAT, valeurDEtatSchema, valeursDeclarees(etat)) : [];
  return [...champsSauf(etatNarratifSchema, ['id', 'forme']), ...forme, ...valeurs, ...(identite ? champsDeLIdentite(identite) : [])];
}

/** Les retraits déclarés de l'état `etat` : son identité, et chacune de ses lignes. */
const retraitsDeLEtat = (etat: EtatNarratif): CheminsOfferts => {
  const identite = identiteDe(etat);
  return identite ? [IDENTITE, ...identite.lignes.map((_, j) => [...LIGNES, j])] : [];
};

/** Les choix que le contexte de l'état `etat` pose au chemin `chemin` de sa donnée : au rang qui suit sa dernière valeur
 *  déclarée, la valeur neuve, d'identifiant frais (`idFrais`), libellée de son rang (`NarratifEditor`, « Ajouter une
 *  valeur ») ; à son identité absente, l'identité neuve (`identiteNeuve`) ; au rang qui suit son dernier repère, le
 *  repère neuf (`repereNeuf`) ; au rang qui suit sa dernière ligne, chaque ligne neuve (`lignesNeuves`), libellée de son
 *  espèce et de son sexe, que l'écriture de l'état couvre (`etatCouvert`). #3606 */
function choixDeLEtat(etat: EtatNarratif, chemin: readonly Segment[]): readonly ChoixDuContexte[] | undefined {
  const valeurs = valeursDeclarees(etat);
  if (FORMES_D_ETAT[etat.forme.kind].valeursDeclarees) {
    return auRangNeuf(chemin, VALEURS_D_ETAT, valeurs.length) ? poseNeuf({ id: idFrais('valeur', valeurs), label: t('ecran.editeur.narratif.valeurNeuve', { n: valeurs.length + 1 }) }) : undefined;
  }
  const identite = identiteDe(etat);
  if (!identite) return chemin.length === IDENTITE.length && IDENTITE.every((cle, i) => chemin[i] === cle) ? [{ valeur: identiteNeuve(), libelle: t('ecran.editeur.narratif.identiteNeuve'), refus: null }] : undefined;
  if (auRangNeuf(chemin, REPERES, identite.reperes.length)) return poseNeuf(repereNeuf(identite));
  return auRangNeuf(chemin, LIGNES, identite.lignes.length) ? lignesNeuves(identite).map((l) => ({ valeur: l, libelle: libelleDeLigne(l), refus: null })) : undefined;
}

/** Les choix que le contexte du PNJ `preset`, dans le cadre `cadre`, pose au chemin `chemin` de sa donnée : à
 *  l'apparence de ses objets et à celle de son profil (`APPARENCES_DU_PRESET`, `choixDesApparencesDObjets`), les armes de son profil fusionné à sa créature de base
 *  (`mergeCreatureProfile`, `armesDEntite`), comme l'éditeur web (`NarratifEditor`, `PresetForm`). #3606 */
function choixDuPreset(preset: PresetPnj, chemin: readonly Segment[], { projet: { narratif } }: CadreDuPorteur): readonly ChoixDuContexte[] | undefined {
  const apparences = APPARENCES_DU_PRESET.find((prefixe) => prefixe.every((cle, i) => chemin[i] === cle));
  if (!apparences) return undefined;
  const objet = objetDuNarratif(narratif);
  const base = preset.base ? findCreatureById(preset.base.id) : undefined;
  const fusion = base ? mergeCreatureProfile(base, preset.profil) : preset.profil ?? {};
  return choixDesApparencesDObjets(() => armesDEntite(objet, undefined, { traits: fusion.traits, char: fusion.char }), objet, chemin.slice(apparences.length));
}

/** L'apparence des objets d'un PNJ, par objet : la sienne (`PresetPnj.apparence.apparencesObjets`), et celle de son profil
 *  (`PresetPnj.profil.appearance.apparencesObjets`). */
const APPARENCES_DU_PRESET = [['apparence', 'apparencesObjets'], ['profil', 'appearance', 'apparencesObjets']] as const;

/** Ce que déclare le formulaire d'une entrée de chaque registre créable du narratif (`RegistreCreable`) : son schéma,
 *  ses champs, chacun hors de son identifiant, que le renommage propage (`renommeAuProjet`), et les choix de son
 *  contexte ; d'un indice, ses champs (`champsDeLIndice`) aux choix de son contexte (`choixDeLIndice`) ; d'un PNJ, les
 *  choix du sien (`choixDuPreset`) ; d'un état, ses champs (`champsDeLEtat`), ses retraits déclarés (`retraitsDeLEtat`)
 *  et les choix de son contexte (`choixDeLEtat`). */
const FORMULAIRES_DES_REGISTRES: { readonly [R in RegistreCreable]: Pick<FormulaireDuPorteur<DonneeDuPorteur[R]>, 'schema' | 'champs' | 'retraits' | 'choix'> } = {
  affaires: { schema: affaireSchema, champs: () => champsSauf(affaireSchema, ['id']) },
  indices: { schema: indiceSchema, champs: champsDeLIndice, choix: choixDeLIndice },
  presetsPnj: { schema: presetPnjSchema, champs: () => champsSauf(presetPnjSchema, ['id']), choix: choixDuPreset },
  documents: { schema: documentNarratifSchema, champs: () => champsSauf(documentNarratifSchema, ['id']) },
  etats: { schema: etatNarratifSchema, champs: champsDeLEtat, retraits: retraitsDeLEtat, choix: choixDeLEtat },
};

/** Le formulaire d'une entrée de chaque registre créable du narratif (`FORMULAIRES_DES_REGISTRES`) : dans la collection
 *  du narratif sous la clé du registre, sélectionnée sous elle, désignée par la portée `narratif`, listé à la zone
 *  Logique. */
const formulairesDesRegistres = tableTotale(Object.keys(FORMULAIRES_DES_REGISTRES) as RegistreCreable[],
  (registre) => ({ acces: { document: 'narratif', collection: registre }, sel: registre, portee: 'narratif', logique: true, ...FORMULAIRES_DES_REGISTRES[registre] })) as { readonly [R in RegistreCreable]: FormulaireDuPorteur<DonneeDuPorteur[R]> };

/** Le formulaire d'une entité, par son type : d'un personnage, ses champs (`champsDuPersonnage`), aux choix de son
 *  contexte (`choixDuPersonnage`) ; d'un décor, ses actions authorées (`ACTIONS_DU_DECOR`), aux choix de son contexte
 *  (`choixDuDecor`), son assise s'écrivant à ses places ; d'un départ de héros, aucun champ. */
const FORMULAIRE_DU_TYPE: { readonly [K in EntityKind]: Omit<FormulaireDuPorteur<SceneEntity>, 'acces' | 'sel' | 'schema'> } = {
  personnage: { champs: champsDuPersonnage, choix: choixDuPersonnage },
  prop: { champs: () => [ACTIONS_DU_DECOR], choix: choixDuDecor },
  heroStart: { champs: () => [] },
};

/** Les formulaires tirés du schéma, par sorte de porteur (`FormulaireDuPorteur`). D'une zone d'effet, son Test de
 *  traversée, ses effets à la traversée et à chaque Round, son rendu tant qu'elle dure (#3834), et les groupes qu'elle
 *  bloque quand elle barre le passage (`barrier`) ; d'un déclencheur, sa
 *  condition d'entrée et son flux ; d'une entité, celui de son type (`FORMULAIRE_DU_TYPE`) ; d'un dialogue, son nœud de
 *  départ, ses nœuds et les entrées qu'il couvre, aux choix de son contexte (`choixDuDialogue`) ; d'une rencontre, ses
 *  circonstances, sa fin et les entrées qu'elle couvre, et de ses membres leur seule monture (`CHAMPS_DE_LA_RENCONTRE`) ;
 *  de la scène, porteur singulier de son document, son message de départ ; d'un lieu, ses champs (`champsDuLieu`), aux
 *  choix de son contexte (`choixDuLieu`) ; d'une route, les siens (`CHAMPS_DE_LA_ROUTE`), aux choix de son contexte
 *  (`choixDeLaRoute`) ; de la carte, porteur singulier de son document, son libellé, son fond et ses réglages ; de ses
 *  réglages, porteur singulier de leur document, ses axes actifs ; d'une entrée de chaque registre créable du narratif,
 *  le sien (`formulairesDesRegistres`) ; d'un écart, son motif, son entrée se changeant par le renommage ; du narratif,
 *  porteur singulier de son document, son ouverture et sa clôture. Chacun déclare la portée des avertissements qui le
 *  désignent ; ceux de la carte, la portée `worldMap` ; ceux du narratif, la portée `narratif`. */
export const FORMULAIRES: { readonly [S in SorteDePorteur]: FormulaireDuPorteur<DonneeDuPorteur[S]> } = {
  zone: { acces: { document: 'scene', collection: 'effectZones' }, sel: 'effectZone', schema: sceneEffectZoneSchema, champs: (zone) => [['crossTest'], ['onCross'], ['perRound'], ['rendu'], ...(zone.barrier ? [['barrier', 'blockGroups']] : [])] },
  declencheur: { acces: { document: 'scene', collection: 'triggers' }, sel: 'trigger', schema: triggerSchema, portee: 'trigger', logique: true, champs: () => [['when'], ['flow']] },
  entite: {
    acces: { document: 'scene', collection: 'entities' },
    sel: 'entity',
    portee: 'entity',
    schema: sceneEntitySchema,
    champs: (ent, cadre) => FORMULAIRE_DU_TYPE[ent.kind].champs(ent, cadre),
    choix: (ent, chemin, cadre) => FORMULAIRE_DU_TYPE[ent.kind].choix?.(ent, chemin, cadre),
  },
  dialogue: { acces: { document: 'scene', collection: 'dialogues' }, sel: 'dialogue', schema: dialogueSchema, portee: 'dialogue', logique: true, champs: () => [['start'], ['nodes'], ['couvre']], choix: choixDuDialogue },
  rencontre: { acces: { document: 'scene', collection: 'encounters' }, sel: 'encounter', schema: encounterDefSchema, portee: 'encounter', logique: true, champs: champsDeLaRencontre },
  scene: { acces: { document: 'scene' }, schema: sceneSchema, champs: () => [['startMessage']] },
  lieu: { acces: { document: 'carte', collection: 'places' }, sel: 'place', schema: mapPlaceSchema, portee: 'worldMap', logique: true, champs: champsDuLieu, choix: choixDuLieu },
  route: { acces: { document: 'carte', collection: 'routes' }, sel: 'route', schema: mapRouteSchema, portee: 'worldMap', logique: true, champs: () => CHAMPS_DE_LA_ROUTE, choix: choixDeLaRoute },
  carte: { acces: { document: 'carte' }, schema: worldMapSchema, portee: 'worldMap', champs: () => [['label'], ['background'], ['params']] },
  projet: { acces: { document: 'projet' }, schema: projetSchema, champs: () => [['activeAxes']] },
  ...formulairesDesRegistres,
  ecart: { acces: { document: 'narratif', collection: 'ecartes' }, sel: 'ecart', schema: ecartSchema, portee: 'narratif', logique: true, champs: () => [['motif']] },
  narratif: { acces: { document: 'narratif' }, schema: narratifSchema, portee: 'narratif', champs: () => [['ouverture'], ['cloture']] },
};

/** Le porteur de formulaire que la sélection `sel` désigne, le document `document` ouvert où la scène d'identifiant
 *  `sceneId` est montrée (`FORMULAIRES`, `sel`) : sa sorte et son identifiant, celui de la sélection ; sans sélection,
 *  le porteur singulier de ce document (`AccesDuPorteur`), sous son identifiant (`DocumentDuProjet.id`) ; `undefined`
 *  sans lui. */
export function porteurDeLaSel(sel: Sel, document: SorteDeDocument, sceneId: string): { sorte: SorteDePorteur; id: string } | undefined {
  const sortes = Object.keys(FORMULAIRES) as SorteDePorteur[];
  if (sel) {
    const sorte = sortes.find((k) => FORMULAIRES[k].sel === sel.type);
    return sorte && { sorte, id: (sel as Extract<Sel, { type: TypeDeSelParId }>).id };
  }
  const singulier = sortes.find((k) => accesDe(k).document === document && accesDe(k).collection === undefined);
  return singulier && { sorte: singulier, id: DOCUMENTS[document].id(sceneId) };
}

/** La sélection qui désigne le porteur de sorte `sorte` d'identifiant `id` (`FORMULAIRES`, `sel`) : aucune, du porteur
 *  qui n'en déclare pas. */
export function selDuPorteur(sorte: SorteDePorteur, id: string): Sel {
  const type = FORMULAIRES[sorte].sel;
  return type ? { type, id } : null;
}

/** Le porteur de formulaire que désigne un avertissement de portée `scope` et d'élément `refId` (`Warning`), dans le
 *  projet `projet` où la scène `sceneId` est montrée : parmi les sortes qui déclarent cette portée (`FORMULAIRES`,
 *  `portee`), celle dont un porteur du projet porte cet identifiant ; sans élément, le porteur singulier de son
 *  document ; `undefined` sans lui. #3606 */
export function porteurDeLaPortee(scope: Warning['scope'], refId: string | undefined, projet: ProjetDEdition, sceneId: string): { sorte: SorteDePorteur; id: string } | undefined {
  const sortes = (Object.keys(FORMULAIRES) as SorteDePorteur[]).filter((k) => FORMULAIRES[k].portee === scope);
  const sorte = sortes.find((k) => (refId === undefined
    ? accesDe(k).collection === undefined && DOCUMENTS[accesDe(k).document].lire(projet, sceneId) !== undefined
    : accesDe(k).collection !== undefined && porteurDuProjet(accesDe(k), projet, sceneId, refId) !== undefined));
  return sorte && { sorte, id: refId ?? DOCUMENTS[accesDe(sorte).document].id(sceneId) };
}

/** Où vit le porteur de sorte `sorte` (`FORMULAIRES`). */
export const accesDe = <S extends SorteDePorteur>(sorte: S): AccesDuPorteur<DonneeDuPorteur[S]> => (FORMULAIRES[sorte] as FormulaireDuPorteur<DonneeDuPorteur[S]>).acces;

/** Ce que l'accès d'un porteur dit de son document `doc` : ses porteurs, le document où ils deviennent `porteurs`,
 *  l'identifiant d'un porteur, là où la scène `sceneId` est montrée, et le chemin du porteur de rang `rang` depuis le
 *  document. */
interface LectureDeLAcces {
  document: DocumentDuProjet<unknown>;
  porteurs: (doc: unknown) => readonly unknown[];
  avec: (doc: unknown, porteurs: readonly unknown[]) => unknown;
  id: (porteur: unknown, sceneId: string) => string | undefined;
  chemin: (rang: number) => Segment[];
}

/** Les lectures déjà faites, par accès. */
const LECTURES = new WeakMap<object, LectureDeLAcces>();

/** La lecture de l'accès `acces`, seule à le lire : dans sa collection, absente lue vide, chacun identifié par la clé que
 *  le schéma de son document déclare à cette collection (`listeCle`, `collectionDe`) ; sans collection, le document
 *  seul, identifié par lui (`DocumentDuProjet.id`). #3606 */
function lectureDe(acces: AccesDuPorteur<unknown>): LectureDeLAcces {
  const deja = LECTURES.get(acces);
  if (deja) return deja;
  const document = DOCUMENTS[acces.document] as unknown as DocumentDuProjet<unknown>;
  const collection = acces.collection as string | undefined;
  const marque = collection === undefined ? undefined : ouverts(pasDeDonnee([document.schema], collection)).map(collectionDe).find((m) => m !== undefined);
  const lecture: LectureDeLAcces = collection === undefined
    ? { document, porteurs: (doc) => [doc], avec: (_doc, [seul]) => seul, id: (_doc, sceneId) => document.id(sceneId), chemin: () => [] }
    : {
      document,
      porteurs: (doc) => ((doc as Record<string, unknown>)[collection] ?? []) as readonly unknown[],
      avec: (doc, porteurs) => ({ ...(doc as object), [collection]: porteurs }),
      id: (porteur) => (marque?.forme === 'liste' ? marque.de(porteur) : undefined),
      chemin: (rang) => [collection, rang],
    };
  LECTURES.set(acces, lecture);
  return lecture;
}

/** Les porteurs d'accès `acces` du projet `projet` où la scène `sceneId` est montrée (`lectureDe`) ; aucun si leur
 *  document est absent du projet. */
export function porteursDuProjet<D>(acces: AccesDuPorteur<D>, projet: ProjetDEdition, sceneId: string): readonly D[] {
  const { document, porteurs } = lectureDe(acces as AccesDuPorteur<unknown>);
  const doc = document.lire(projet, sceneId);
  return (doc === undefined ? [] : porteurs(doc)) as readonly D[];
}

/** L'identifiant du porteur `porteur` d'accès `acces`, là où la scène `sceneId` est montrée (`lectureDe`). */
export const idDuPorteur = <D>(acces: AccesDuPorteur<D>, porteur: D, sceneId: string): string =>
  lectureDe(acces as AccesDuPorteur<unknown>).id(porteur, sceneId)!;

/** Le porteur d'accès `acces` et d'identifiant `id` du projet `projet` où la scène `sceneId` est montrée, et son chemin
 *  depuis son document ; `undefined` sans lui. */
export function porteurDuProjet<D>(acces: AccesDuPorteur<D>, projet: ProjetDEdition, sceneId: string, id: string): { donnee: D; chemin: Segment[] } | undefined {
  const lecture = lectureDe(acces as AccesDuPorteur<unknown>);
  const porteurs = porteursDuProjet(acces, projet, sceneId);
  const rang = porteurs.findIndex((p) => lecture.id(p, sceneId) === id);
  return rang < 0 ? undefined : { donnee: porteurs[rang], chemin: lecture.chemin(rang) };
}

/** Le projet `projet`, où la scène `sceneId` est montrée, dont le porteur d'accès `acces` qui porte l'identifiant de
 *  `avant` devient `apres`, dans son document (`DOCUMENTS`, `ecrire`). */
export function projetAvecLePorteur<D>(acces: AccesDuPorteur<D>, projet: ProjetDEdition, sceneId: string, avant: D, apres: D): ProjetDEdition {
  const { document, porteurs, avec, id } = lectureDe(acces as AccesDuPorteur<unknown>);
  const doc = document.lire(projet, sceneId)!;
  const cle = id(avant, sceneId);
  return document.ecrire(projet, sceneId, avec(doc, porteurs(doc).map((p) => (id(p, sceneId) === cle ? apres : p))));
}

/** `a` est-il un préfixe du chemin `b` ? */
const prefixe = (a: readonly Segment[], b: readonly Segment[]): boolean => a.length <= b.length && a.every((p, i) => p === b[i]);

/** Le chemin `chemin` est-il offert par les champs `offerts` : sous l'un d'eux, ou sur le chemin de l'un d'eux ? */
export const cheminOffert = (offerts: CheminsOfferts, chemin: readonly Segment[]): boolean =>
  offerts.some((o) => prefixe(o, chemin) || prefixe(chemin, o));

/** L'écriture au chemin `chemin`, où la donnée vaut `actuelle`, est-elle offerte par les champs `offerts` : sous l'un
 *  d'eux ; sur le chemin de l'un d'eux, si chaque clé que porte `actuelle`, ou chaque élément d'une liste à son rang,
 *  l'est, de proche en proche (elle n'emporte aucun champ qu'ils n'offrent pas). */
export function ecritureOfferte(offerts: CheminsOfferts, chemin: readonly Segment[], actuelle: unknown): boolean {
  if (offerts.some((o) => prefixe(o, chemin))) return true;
  if (!offerts.some((o) => prefixe(chemin, o))) return false;
  const entrees: [Segment, unknown][] = Array.isArray(actuelle) ? actuelle.map((v, i) => [i, v]) : estObjet(actuelle) ? Object.entries(actuelle) : [];
  return entrees.every(([cle, v]) => v === undefined || ecritureOfferte(offerts, [...chemin, cle], v));
}

/** Le formulaire tiré du schéma du porteur de sorte `sorte` (`FORMULAIRES`) : le nœud où s'écrit sa donnée `donnee`, à
 *  travers les unions de son schéma (`formeAuPoint`), les champs que sa donnée offre dans le cadre `cadre`, et ses
 *  retraits déclarés, aucun s'il n'en déclare pas. */
export function formeDuPorteur<S extends SorteDePorteur>(sorte: S, donnee: DonneeDuPorteur[S], cadre: CadreDuPorteur): { noeud: unknown; champs: CheminsOfferts; retraits: CheminsOfferts } {
  const formulaire: FormulaireDuPorteur<DonneeDuPorteur[S]> = FORMULAIRES[sorte];
  return { noeud: formeAuPoint(formulaire.schema, donnee)?.noeud, champs: formulaire.champs(donnee, cadre), retraits: retraitsDuPorteur(sorte, donnee) };
}

/** Les retraits déclarés du porteur de sorte `sorte`, de donnée `donnee` (`FormulaireDuPorteur.retraits`) ; aucun s'il
 *  n'en déclare pas. */
export function retraitsDuPorteur<S extends SorteDePorteur>(sorte: S, donnee: DonneeDuPorteur[S]): CheminsOfferts {
  const formulaire: FormulaireDuPorteur<DonneeDuPorteur[S]> = FORMULAIRES[sorte];
  return formulaire.retraits?.(donnee) ?? [];
}

/** La clé qui identifie l'élément `element` de la liste de nœud `noeud` (`listeCle`, `collectionDe`) ; `undefined` d'une
 *  liste sans clé. */
export function cleDeLElement(noeud: unknown, element: unknown): string | undefined {
  const marque = collectionDe(noeud);
  return marque?.forme === 'liste' ? marque.de(element) : undefined;
}

/** La clé `cle` est-elle une référence narrative (`REFERENCES_NARRATIVES`) ? */
const estReferenceNarrative = (cle: Segment | undefined): cle is CleDeReferenceNarrative =>
  typeof cle === 'string' && Object.prototype.hasOwnProperty.call(REFERENCES_NARRATIVES, cle);

/** La clé `cle` est-elle une sous-référence narrative (`SOUS_REFERENCES`) ? */
const estSousReference = (cle: Segment | undefined): cle is CleDeSousReference =>
  typeof cle === 'string' && Object.prototype.hasOwnProperty.call(SOUS_REFERENCES, cle);

/** Le registre de la référence parente d'une sous-référence. */
type RegistreDeSousReference = (typeof REFERENCES_NARRATIVES)[(typeof SOUS_REFERENCES)[CleDeSousReference]];

/** Les sous-entrées de l'entrée `id` de chaque registre qu'une sous-référence désigne, dans le narratif `narratif` : les
 *  stades d'un indice (`entreesDeStades`), les valeurs déclarées d'un état (`valeursDeclarees`). */
const SOUS_ENTREES_DESIGNEES: { readonly [R in RegistreDeSousReference]: (narratif: NarratifBlock, id: string) => readonly { id: string; label: string }[] } = {
  indices: entreesDeStades,
  etats: (narratif, id) => valeursDeclarees(etatDeclare(narratif.etats, id)),
};

/** Les choix de la sous-référence au chemin `chemin` de la donnée `donnee`, sous la clé `cle` : quand sa référence
 *  parente, sa clé sœur (`SOUS_REFERENCES`), désigne une entrée, chacune de ses sous-entrées (`SOUS_ENTREES_DESIGNEES`) ;
 *  `undefined` sans elle, où la clé n'est pas une sous-référence. */
function choixDeLaSousReference(donnee: unknown, chemin: readonly Segment[], cle: CleDeSousReference, narratif: NarratifBlock): readonly ChoixDuContexte[] | undefined {
  const parente = SOUS_REFERENCES[cle];
  const porteur = chemin.slice(0, -1).reduce<unknown>((o, pas) => (estObjet(o) || Array.isArray(o) ? (o as Record<Segment, unknown>)[pas] : undefined), donnee);
  const id = estObjet(porteur) ? porteur[parente] : undefined;
  return typeof id === 'string' ? SOUS_ENTREES_DESIGNEES[REFERENCES_NARRATIVES[parente]](narratif, id).map((e) => ({ valeur: e.id, libelle: e.label, refus: null })) : undefined;
}

/** Un objet qui ouvre des portées locales (`ouvrirPortees`), avec son nœud : son schéma et sa valeur. */
type Ouvreur = readonly [unknown, unknown];

/** Les objets qui ouvrent des portées locales aux feuilles du porteur `porteur` du cadre `cadre` : lui-même, sa scène,
 *  la carte du monde de son projet et son projet. */
const ouvreursDuCadre = (porteur: Ouvreur, { scene, projet }: CadreDuPorteur): readonly Ouvreur[] => [porteur, [sceneSchema, scene], [worldMapSchema, projet.worldMap], [projetSchema, projet]];

/** Les ids qu'admet la portée de la feuille locale parmi `noeuds` (`porteeDeLaFeuille`), résolus par le parse
 *  (`idsDeLaPortee`) sur le premier des `ouvreurs` qui l'ouvre ; `undefined` sans feuille locale, ou si aucun ne l'ouvre. */
function idsDeLaFeuilleLocale(noeuds: readonly unknown[], ouvreurs: readonly Ouvreur[]): readonly string[] | undefined {
  const portee = noeuds.map(porteeDeLaFeuille).find((p) => p !== undefined);
  return portee && ouvreurs.map(([ouvreur, valeur]) => idsDeLaPortee(ouvreur, valeur, portee)).find((ids) => ids !== undefined);
}

/** Les choix d'une référence LOCALE aux nœuds `noeuds`, parmi les portées des `ouvreurs` : d'une feuille locale, chaque
 *  id que sa portée admet ; d'une référence `{ id }` dont l'identifiant en est une, chacun posé entier ; `undefined`
 *  sinon. */
function choixDeLaReferenceLocale(noeuds: readonly unknown[], ouvreurs: readonly Ouvreur[]): readonly ChoixDuContexte[] | undefined {
  const ids = idsDeLaFeuilleLocale(noeuds, ouvreurs);
  if (ids) return ids.map((id) => ({ valeur: id, libelle: id, refus: null }));
  const emboites = idsDeLaFeuilleLocale(ouverts(pasDeDonnee(noeuds, 'id')), ouvreurs);
  return emboites?.map((id) => ({ valeur: { id }, libelle: id, refus: null }));
}

/** Les choix que le contexte du porteur de sorte `sorte`, de donnée `donnee`, pose au chemin `chemin` de sa donnée, dans
 *  leur ordre, dans le cadre `cadre` : sous une adresse de prose, ceux de son `Source/` (`choixSousUneAdresse`) ; d'une
 *  référence narrative, chaque entrée du registre que son narratif désigne (`entreesNarratives`) ; d'une
 *  sous-référence, chaque sous-entrée de l'entrée que désigne sa référence parente (`choixDeLaSousReference`) ; d'une
 *  référence locale, chaque élément que sa portée admet, ouverte par le porteur, sa scène ou son projet
 *  (`choixDeLaReferenceLocale`, `ouvreursDuCadre`), restreints à ceux de son porteur s'il en pose (`FORMULAIRES`) ;
 *  sinon ceux de son porteur ; `undefined` : ceux du nœud. */
export function choixDuChamp<S extends SorteDePorteur>(sorte: S, donnee: DonneeDuPorteur[S], chemin: readonly Segment[], cadre: CadreDuPorteur): readonly ChoixDuContexte[] | undefined {
  const cle = chemin[chemin.length - 1];
  const formulaire: FormulaireDuPorteur<DonneeDuPorteur[S]> = FORMULAIRES[sorte];
  const deLAdresse = choixSousUneAdresse(formulaire.schema, donnee, chemin, cadre.source);
  if (deLAdresse) return deLAdresse;
  if (estReferenceNarrative(cle)) return entreesNarratives(cadre.projet.narratif, cle).map((e) => ({ valeur: e.id, libelle: e.label, refus: null }));
  const sous = estSousReference(cle) ? choixDeLaSousReference(donnee, chemin, cle, cadre.projet.narratif) : undefined;
  if (sous) return sous;
  const locaux = choixDeLaReferenceLocale(noeudsAuChemin(formulaire.schema, donnee, chemin), ouvreursDuCadre([formulaire.schema, donnee], cadre));
  const duPorteur = formulaire.choix?.(donnee, chemin, cadre);
  return locaux && duPorteur ? duPorteur.filter((c) => locaux.some((l) => jsonCanonique(l.valeur) === jsonCanonique(c.valeur))) : locaux ?? duPorteur;
}

/** Le formulaire du porteur de sorte `sorte`, de donnée `donnee`, dans le cadre `cadre` : le champ de tête de
 *  chacun de ses champs offerts (`formeDuPorteur`), décrit par `inferFields` sur le nœud de sa donnée, dans son
 *  contexte : ce qu'il offre sous lui (`cheminOffert`, jamais ce qu'une adresse de prose dérive,
 *  `estCheminDerive`), où il s'écrit entier (`ecritureOfferte`), ses choix (`choixDuChamp`) et le `Source/` de
 *  ses adresses. */
export function formulaireDe<S extends SorteDePorteur>(sorte: S, donnee: DonneeDuPorteur[S], cadre: CadreDuPorteur): FieldDesc[] {
  const { noeud, champs } = formeDuPorteur(sorte, donnee, cadre);
  const decrits = inferFields([donnee as unknown as Record<string, unknown>], { noeud, niveau: 'profondeur' });
  const contexte: ContexteDuChamp = {
    offert: (chemin) => cheminOffert(champs, chemin) && !estCheminDerive(noeud, donnee, chemin),
    ecrivable: (chemin, actuelle) => ecritureOfferte(champs, chemin, actuelle),
    choix: (chemin) => choixDuChamp(sorte, donnee, chemin, cadre),
    source: cadre.source,
  };
  return [...new Set(champs.map(([tete]) => tete))].flatMap((cle) => decrits.filter((f) => f.key === cle)).map((f) => ({ ...f, contexte }));
}

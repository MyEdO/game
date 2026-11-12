/**
 * Brouillard de guerre — couche NOYAU : assemble les `Viewer`/sources de lumière depuis l'état (groupe
 * en exploration, alliés vivants en combat) et délègue au moteur PUR `vision.ts`. `visible` est DÉRIVÉ,
 * jamais stocké : `computeStateVisibleAndLight`, mémoïsé sur ses entrées (`memoByRefDeps`), sert le
 * rendu comme le noyau. L'EXPLORÉ par scène (`explored[sceneId]`, persistant) en est l'union, que la
 * transition du jeu accumule (`transitionDuJeu.ts`, `exploreAvec`).
 */
import { Scene, sceneMetresPerTile } from './monde/scene';
import { Pt } from './monde/path';
import { computeVisible, computeLightField, ambientScalar, baseSightTiles, darkSightTiles, mapLights, combatantLights, buildOpaque, type LightSource, type Occ } from './monde/vision';
import { memoByRef, memoByRefDeps } from './monde/sceneMemo';
import { meneurDuMonde } from './monde/combatants';
import { smokeOf } from './monde/combatGeometry';
import { isOutOfAction } from '../engine/conditions';
import type { Combatant } from '../engine/types';
import type { BattleState, EtatDeJeu } from './etat';

/** Tranche d'état nécessaire au calcul de visibilité : ses champs sont les dépendances du mémo `vueDeLaScene`. */
export interface VisionInput {
  scene: Scene | null;
  battle: { combatants: Combatant[]; zones?: BattleState['zones'] } | null;
  party?: Combatant[];
  partyPos: Pt;
  gameTime: number;
  lightLevel: number | null;
}

/** Sources de lumière PONCTUELLES de la scène : lumières posées (carte) + lumières portées (les deux
 *  camps en combat, le groupe en exploration — une torche révèle son porteur). SOURCE UNIQUE : le champ
 *  mécanique (`sceneLightField`) et le rendu (les lampes du monde volumique) lisent la MÊME liste, donc
 *  le même gate de port et les mêmes rayons. PUR. */
export function sceneLightSources(s: Pick<VisionInput, 'scene' | 'battle' | 'party' | 'partyPos'>): LightSource[] {
  const mpt = sceneMetresPerTile(s.scene!);
  const sources = mapLights(s.scene!);
  if (s.battle) {
    for (const c of s.battle.combatants) sources.push(...combatantLights(c, mpt));
    return sources;
  }
  // Combattant SYNTHÉTIQUE du groupe : items + armes tenues + effets actifs agrégés → `combatantLights`
  // applique LE MÊME gate de port qu'en combat (un objet rangé n'éclaire pas ; une lanterne portée /
  // un sort Lumière oui). Le gate vit en UN seul endroit (combatantLights), pas redupliqué ici.
  // UNE source pour tout le groupe (les émetteurs de TOUS les héros à la case du groupe, jamais
  // additionnés), PORTÉE par le MENEUR : c'est son jeton, et lui seul, qui marche à l'écran — sans ce
  // porteur nommé, la lampe du groupe reste clouée à la case logique pendant que le quad la traverse.
  const party = s.party ?? [];
  sources.push(...combatantLights({
    id: meneurDuMonde({ party })?.id,
    pos: s.partyPos,
    items: party.flatMap((p) => p.items ?? []),
    weapons: party.flatMap((p) => p.weapons ?? []),
    activeEffects: party.flatMap((p) => p.activeEffects ?? []),
  }, mpt));
  return sources;
}

/** Champ de lumière + fumée de la scène (SOURCE UNIQUE pour la vue du groupe ET la perception ennemie) :
 *  plancher ambiant + `sceneLightSources`. */
export function sceneLightField(s: VisionInput, occ: Occ = buildOpaque(s.scene!)): { light: ReturnType<typeof computeLightField>; smoke: Pt[] } {
  const scene = s.scene!;
  const ambient = ambientScalar(scene, s.gameTime, s.lightLevel);
  const smoke: Pt[] = s.battle?.zones ? smokeOf(s.battle) : [];
  return { light: computeLightField(scene, ambient, sceneLightSources(s), smoke, occ), smoke };
}

/** Triche de recette (`__wfrp.fog`) : révèle TOUTE la carte (brouillard OFF) pour diagnostiquer le RENDU
 *  sans la vision. Drapeau de module (hors state) basculé par le devtool, qui force un re-render. */
let REVEAL_ALL = false;
export const setRevealAll = (v: boolean): void => { REVEAL_ALL = v; };

/** Champ de lumière PLAT (plein jour) : le repli pour REVEAL_ALL / `!scene`, où aucune occlusion iso n'a
 *  de sens mais un consommateur attend un `LightField` valide. */
const FLAT_LIGHT = Object.freeze({ at: () => 1 }); // #2097

type StateLight = ReturnType<typeof sceneLightField>['light'];

/** Cases visibles pour un champ de lumière DÉJÀ calculé (le corps commun de `computeStateVisible` et
 *  `computeStateVisibleAndLight`) : union des alliés vivants en combat, sinon la position du groupe. PUR. */
function visibleFrom(scene: Scene, s: VisionInput, light: StateLight, smoke: Pt[], occ: Occ = buildOpaque(scene)): Set<string> {
  const baseR = baseSightTiles(scene, s.gameTime);
  const viewers = [];
  if (s.battle) {
    for (const c of s.battle.combatants) {
      // Brouillard PARTY-ONLY : seuls les héros du GROUPE (manuels, ou héros coop d'autres joueurs)
      // révèlent la carte. Un PNJ allié piloté par l'IA (`aiControlled` : défenseur de siège, équipage
      // d'une pièce) ne contribue PAS à la vue du groupe — sinon il dévoilerait tout le champ adverse.
      // Une pièce INERTE (affût de baliste/canon, côté allié `kind:'heros'` mais SANS IA) n'a pas d'yeux :
      // postée sur le rempart (z=1), elle dévoilerait sinon tout le champ d'en contrebas par-dessus le parapet.
      if (c.kind !== 'heros' || c.aiControlled || c.inert || isOutOfAction(c) || !c.pos) continue;
      // `z` du viewer = ÉTAGE du combattant (vision cross-niveau : un défenseur sur le rempart z=1
      // voit en contrebas z=0). Sans ce z, il serait calculé au sol — aveugle depuis la muraille.
      viewers.push({ pos: c.pos, z: c.pos.z, radiusTiles: baseR, darkTiles: darkSightTiles(c) });
    }
  } else {
    const dark = (s.party ?? []).reduce((m, c) => Math.max(m, darkSightTiles(c)), 0);
    viewers.push({ pos: s.partyPos, z: s.partyPos.z, radiusTiles: baseR, darkTiles: dark });
  }
  return computeVisible(scene, viewers, light, smoke, occ);
}

/** Toutes les cases construites (tous les étages) — repli REVEAL_ALL (recette : brouillard OFF).
 *  Mémoïsé par IDENTITÉ de `scene` (`memoByRef`, patron unique) : ne lit que `dimensions`/`layers`,
 *  dont toute mutation renvoie une NOUVELLE réf de scène. L'identité STABLE du Set compte autant que
 *  son contenu — c'est elle que les memos du rendu (`buildFloors`/`buildWalls`… via `visible`)
 *  observent : réallouer un Set identique à chaque pas leur fait reprojeter toute la carte. */
const allTiles = memoByRef((scene: Scene): Set<string> => {
  const all = new Set<string>();
  const { w, h } = scene.dimensions;
  for (const lvl of scene.layers) for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) all.add(`${x},${y},${lvl.z}`);
  return all;
});

/** Ensemble des cases (`"x,y,z"`) actuellement visibles par le groupe : union des alliés vivants en
 *  combat, sinon depuis la position du groupe en exploration. PUR (dérivé de l'état). */
export function computeStateVisible(s: VisionInput): Set<string> {
  return computeStateVisibleAndLight(s).visible;
}

type VueEtLumiere = { visible: Set<string>; light: StateLight; smoke: Pt[] };

/** La vue d'une scène, mémoïsée sur les entrées de `VisionInput` et le drapeau `REVEAL_ALL` : la transition du
 *  jeu et le rendu lisent le MÊME calcul. */
const vueDeLaScene = memoByRefDeps<Scene, VueEtLumiere>();

/** `computeStateVisible` + champ de LUMIÈRE en UN calcul : `sceneLightField` (potentiellement lourd) ne
 *  tourne qu'UNE fois par pas (l'iso a besoin des deux — vue ET voile d'éclairage des sols). REVEAL_ALL /
 *  `!scene` retournent un champ PLAT (plein jour) valide pour ne jamais casser le consommateur. */
export function computeStateVisibleAndLight(s: VisionInput): VueEtLumiere {
  const scene = s.scene;
  if (!scene) return { visible: new Set(), light: FLAT_LIGHT, smoke: [] };
  return vueDeLaScene(scene, [s.battle, s.party, s.partyPos, s.gameTime, s.lightLevel, REVEAL_ALL], () => {
    if (REVEAL_ALL) return { visible: allTiles(scene), light: FLAT_LIGHT, smoke: [] };
    const occ = buildOpaque(scene);
    const { light, smoke } = sceneLightField(s, occ);
    return { visible: visibleFrom(scene, s, light, smoke, occ), light, smoke };
  });
}

/** Cases qu'un combattant donné PERÇOIT (Ligne de Vue + lumière, vision nocturne incluse), avec le MÊME
 *  champ de lumière que le groupe → vision réciproque de l'IA. PUR. */
export function perceivedTiles(s: VisionInput, viewer: Combatant): Set<string> {
  if (!s.scene || !viewer.pos) return new Set();
  const occ = buildOpaque(s.scene);
  const { light, smoke } = sceneLightField(s, occ);
  return computeVisible(
    s.scene,
    [{ pos: viewer.pos, radiusTiles: baseSightTiles(s.scene, s.gameTime), darkTiles: darkSightTiles(viewer) }],
    light,
    smoke,
    occ,
  );
}

/** L'exploré de `s` où les cases `keys` sont fondues dans celui de la scène courante (union persistante, ne perd
 *  jamais l'ancien) ; `null` sans scène ou sans case neuve. PUR. */
export function exploreAvec(s: Pick<EtatDeJeu, 'scene' | 'explored'>, keys: Iterable<string>): EtatDeJeu['explored'] | null {
  const { scene, explored } = s;
  if (!scene) return null;
  const prev = explored[scene.id];
  const merged = new Set(prev);
  for (const k of keys) merged.add(k);
  return merged.size === (prev?.length ?? 0) ? null : { ...explored, [scene.id]: [...merged] };
}

/**
 * Modificateurs de combat dérivés de la SCÈNE (obscurité / météo) et empreinte des décors.
 * Source : LDB `14 - _GoBack.md` l.75, l.76, l.82. Vit au noyau (lit la Scène) ;
 * les valeurs sont injectées dans `attackModifiers`/`defenseModifiers` via `env` (cf. combatFlow).
 */
import type { Scene, SceneDuVolume, SceneEntity } from './scene';
import { isIndoor, sceneMetresPerTile } from './scene';
import { isNight } from '../../engine/clock';
import { ligneDeRegle } from '../../engine/reglesChiffrees';
import type { ModLine } from '../../engine/types';
import { findPropById } from '../../data';
import { entiteFootTiles } from './footprint';
import { rectangleDesPontsPoses } from '../../data/poseDesPonts';
import { memoByRefDeps } from './sceneMemo';
import { actionsAuthorees } from './usable';

export interface SceneCombatMods {
  /** Cible dissimulée (LDB 14 l.75). */
  concealed: boolean;
  /** Ligne météo de l'attaque (LDB 14 l.76, l.82). */
  attaque: ModLine | null;
  /** Ligne météo de l'esquive (LDB 14 l.82). */
  esquive: ModLine | null;
  /** Libellé de la ligne de cible dissimulée (`concealed`). */
  concealedLabel: string;
}

/** Obscurité de la scène (combat + rendu) : extérieur de nuit uniquement (l'intérieur reste éclairé).
 *  Source de l'obscurité = l'HORLOGE (`gameTime`), plus l'ambiance authored (#T1c). Unique dérivation partagée. */
export function sceneIsDark(scene: Pick<Scene, 'ambiance'>, gameTime: number): boolean {
  return !isIndoor(scene) && isNight(gameTime);
}

/** Modificateurs de combat de la scène (obscurité de nuit pilotée par l'horloge + météo). */
export function sceneCombatModifiers(scene: Pick<Scene, 'ambiance' | 'weather'>, gameTime: number): SceneCombatMods {
  const night = sceneIsDark(scene, gameTime);
  // ABSENCE de météo authored : aucune branche ci-dessous ne tire — mesuré identique au repli de ciel
  // clair qui vivait ici, qui n'était donc pas un défaut mais un id récité sans effet (#1789).
  const weather = scene.weather;
  const concealed = night || weather === 'brouillard'; // LDB 14 l.75
  const neige = () => ligneDeRegle('neige-eau-terrain-difficile', 'neige-eau-terrain-difficile'); // LDB 14 l.82
  return {
    concealed,
    attaque: weather === 'tempete' ? ligneDeRegle('climat-extreme', 'climat-extreme') : weather === 'neige' ? neige() : null, // LDB 14 l.76
    esquive: weather === 'neige' ? neige() : null,
    concealedLabel: weather === 'brouillard' ? 'Brouillard' : 'Obscurité',
  };
}

/** Un décor est SOLIDE (objet plein infranchissable : on ne se tient pas DESSUS) si son TYPE le déclare
 *  dans le dataset `props.json` (`solid`). Physique éditable au Codex ; un `ref` ABSENT du dataset =
 *  passable. Couvre combat ET exploration (via `isWalkable`). */
export const propIsSolid = (ref: string | undefined): boolean => !!ref && !!findPropById(ref)?.solid;

/** L'entité a-t-elle un CORPS SOLIDE, dont toutes les cases (`entiteFootTiles`) bloquent ? Un décor interactif ou solide
 *  par son type, ou une coque (`vehicule`) que la scène ne pose pas par ses ponts (`rectangleDesPontsPoses`) : ses ponts
 *  se marchent. Une créature n'en a pas.
 *  Décor : la porte est l'interaction ou la solidité, l'empreinte dérivée ne fournit que l'ÉTENDUE des cases (une
 *  cheminée, une enseigne NON solides ne murent pas leur case). « Interactif » = les actions AUTHORÉES de l'instance,
 *  sans drapeau d'épuisement : un coffre vidé bloque toujours sa case. */
function aUnCorpsSolide(scene: Pick<Scene, 'metresPerTile' | 'dimensions'>, e: SceneEntity): boolean {
  if (e.kind === 'prop') return actionsAuthorees(e).length > 0 || propIsSolid(e.decor?.id);
  return e.vehicule !== undefined && rectangleDesPontsPoses(scene, e) === null;
}

/** Index O(1) des cases des entités à corps solide (`aUnCorpsSolide`, `entityBlockedAt`), bâti UNE fois par identité de
 *  `scene.entities`. */
function buildEntityBlockIndex(scene: SceneDuVolume, mpt: number): Set<string> {
  const blocked = new Set<string>();
  for (const e of scene.entities) {
    if (!aUnCorpsSolide(scene, e)) continue;
    const z = e.z ?? 0;
    for (const t of entiteFootTiles(e, mpt)) blocked.add(`${t.x},${t.y},${z}`);
  }
  return blocked;
}
/** Mémoïsé par IDENTITÉ de `scene.entities` — PAS `scene` : `scene` reste souvent la MÊME réf entre
 *  deux rendus (aucun champ ne change), tandis que `entities` est TOUJOURS une NOUVELLE réf à chaque
 *  ajout/retrait en production (`.filter`/`.map`/spread — jamais `.push`/`.splice` hors fixtures de
 *  test) : la clé la plus fine est le tableau lui-même. L'ÉCHELLE et les DIMENSIONS entrent en DÉPENDANCE
 *  (`memoByRefDeps`) : l'empreinte dérivée d'un décor dépend de l'échelle (#1509), la pose des ponts d'une coque de
 *  l'échelle et de la carte (`rectangleDesPontsPoses`). Le mémo est daté par la version des datasets (`memoByRef`) :
 *  solidité et empreinte se lisent aux catalogues (`propIsSolid`, `entiteFootTiles`). */
const entityBlockIndex = memoByRefDeps<SceneEntity[], Set<string>>();

/** La case (x,y) est-elle tenue par le corps solide d'une entité (`aUnCorpsSolide`) ? Pour la walkability.
 *  Une coque hors de ses ponts bloque toutes ses cases. Un décor ne bloque PAS — SAUF s'il est :
 *   • INTERACTIF (coffre, stèle, dépouille fouillable…) : on ne se tient pas SUR lui, on l'aborde en
 *     case adjacente (exploration P5 comme combat « Ramasser », `ramassage` de `actions.json`) ; ou
 *   • SOLIDE par son TYPE (`props.json` `solid` : feu de camp, brasero, statue, tonneau…) : objet
 *     plein infranchissable. */
export function entityBlockedAt(scene: SceneDuVolume, x: number, y: number, z: number): boolean {
  const mpt = sceneMetresPerTile(scene);
  return entityBlockIndex(scene.entities, [mpt, scene.dimensions], () => buildEntityBlockIndex(scene, mpt)).has(`${x},${y},${z}`);
}

/**
 * Modificateurs de combat dérivés de la SCÈNE (obscurité / météo) et empreinte des décors.
 * Source : LDB `14 - _GoBack.md` l.75, l.76, l.82. Vit au noyau (lit la Scène) ;
 * les valeurs sont injectées dans `attackModifiers`/`defenseModifiers` via `env` (cf. combatFlow).
 */
import type { Scene, SceneEntity } from './scene';
import { isIndoor, sceneMetresPerTile } from './scene';
import { isNight } from '../../engine/clock';
import { ligneDeRegle } from '../../engine/reglesChiffrees';
import type { ModLine } from '../../engine/types';
import { findPropById } from '../../data';
import { propDeclaredFoot, propFootTiles } from './footprint';
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
 *  passable. Couvre combat ET exploration (via `isWalkable`). Le rendu SVG reste au catalogue gameIso. */
export const propIsSolid = (ref: string | undefined): boolean => !!ref && !!findPropById(ref)?.solid;

/** Index O(1) des cases couvertes par une empreinte de décor (`entityBlockedAt`), bâti UNE fois par
 *  identité de `scene.entities` — mêmes règles que la version balayée : décor sans empreinte déclarée
 *  au catalogue = pas bloquant SAUF interactif ou solide (cf. JSDoc `entityBlockedAt` ci-dessous). */
function buildEntityBlockIndex(entities: SceneEntity[], mpt: number): Set<string> {
  const blocked = new Set<string>();
  for (const e of entities) {
    if (e.kind !== 'prop') continue;
    // LA PORTE de blocage, INCHANGÉE par #1509 : c'est l'empreinte DÉCLARÉE (ou l'interaction, ou la
    // solidité) qui dit si un décor bloque — l'empreinte dérivée ne fournit que l'ÉTENDUE des cases.
    // Sans cette séparation, cheminée/enseigne/clocheton/applique (recettes NON solides, sans `foot`)
    // se mettraient à murer leur case.
    // « utilisable » ici = l'objet a un CORPS à heurter, pas « il reste du butin » : un coffre vidé
    // bloque toujours sa case. La porte lit donc les actions AUTHORÉES de l'instance, sans drapeau
    // d'épuisement.
    if (!propDeclaredFoot(e.ref) && !actionsAuthorees(e).length && !propIsSolid(e.ref)) continue;
    const z = e.z ?? 0;
    for (const t of propFootTiles(e.ref, e.pos, e.facing, mpt)) blocked.add(`${t.x},${t.y},${z}`);
  }
  return blocked;
}
/** Mémoïsé par IDENTITÉ de `scene.entities` — PAS `scene` : `scene` reste souvent la MÊME réf entre
 *  deux rendus (aucun champ ne change), tandis que `entities` est TOUJOURS une NOUVELLE réf à chaque
 *  ajout/retrait en production (`.filter`/`.map`/spread — jamais `.push`/`.splice` hors fixtures de
 *  test) : la clé la plus fine est le tableau lui-même. L'ÉCHELLE entre en DÉPENDANCE (`memoByRefDeps`)
 *  parce que l'empreinte dérivée en dépend (#1509) : la même liste d'entités à une autre échelle ne
 *  couvre pas les mêmes cases. */
const entityBlockIndex = memoByRefDeps<SceneEntity[], Set<string>>();

/** La case (x,y) est-elle couverte par l'empreinte (`PropData.foot`) d'un décor ? Pour la walkability.
 *  Un décor sans empreinte déclarée au catalogue ne bloque PAS — SAUF s'il est :
 *   • INTERACTIF (coffre, stèle, dépouille fouillable…) : on ne se tient pas SUR lui, on l'aborde en
 *     case adjacente (exploration P5 comme combat « Ramasser », LDB 13 l.115-116) ; ou
 *   • SOLIDE par son TYPE (`props.json` `solid` : feu de camp, brasero, statue, tonneau…) : objet
 *     plein infranchissable. */
export function entityBlockedAt(scene: Scene, x: number, y: number, z: number): boolean {
  const mpt = sceneMetresPerTile(scene);
  return entityBlockIndex(scene.entities, [mpt], () => buildEntityBlockIndex(scene.entities, mpt)).has(`${x},${y},${z}`);
}

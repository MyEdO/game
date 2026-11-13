/**
 * INDEX case → ENTITÉS d'une scène — les seules lectures de « qu'y a-t-il sur cette case ? », en DEUX
 * questions distinctes : « quel DÉCOR la COUVRE ? » (empreinte) et « quelles entités y sont ANCRÉES ? ».
 *
 * Les cases viennent de `propFootTiles` (`noyau/monde/footprint.ts`), la couture UNIQUE de l'empreinte
 * effective d'un décor (le corps tourné de sa recette) : aucun
 * consommateur ne rebâtit de cases pour répondre à cette question, et un décor de plus d'une case
 * répond donc sur TOUTES les siennes, pas seulement sur celle de son ancre.
 *
 * DEUX VUES, UNE construction. La Ligne de Vue interroge SANS étage — `tileBlocksSight(scene, x, y)`
 * n'en reçoit pas : elle lit la case, pas la couche (ÉCART CONNU, #1513). Le PICKING (jeu comme
 * éditeur) interroge À l'étage affiché, celui sur lequel l'écran résout. Un second index bâti à côté
 * re-balaierait les mêmes empreintes ; la seconde vue est donc un second `Map` rempli dans la MÊME
 * passe.
 *
 * PLUSIEURS DÉCORS sur une même case (un coffre calé contre le mur et un tonneau dans le coin, une lettre sur la table) :
 * chaque vue les rend TOUS, dans l'ordre du document ; c'est au lecteur de dire lequel compte (l'opacité de l'un
 * suffit, le pire couvert l'emporte, le plus proche du point visé se désigne).
 *
 * POURQUOI CET INDEX N'EST PAS CELUI DE LA MARCHABILITÉ (`sceneRules.ts`, `buildEntityBlockIndex`) :
 * le blocage est l'UNION des cases des décors qui passent la PORTE (`interact || solid`), une question fermée qu'un
 * ensemble de clés tranche sans relire les décors.
 *
 * Mémoïsé par IDENTITÉ de `scene.entities` (patron `noyau/monde/sceneMemo.ts`), avec l'ÉCHELLE en
 * dépendance : l'empreinte d'un décor à recette en dépend (#1509), la même liste d'entités à une
 * autre échelle ne couvre pas les mêmes cases. Aucune invalidation manuelle.
 */
import { propFootTiles } from './footprint';
import { memoByRefDeps } from './sceneMemo';
import { sceneMetresPerTile, type Scene, type SceneEntity } from './scene';

interface IndexDecor {
  /** Clé `x,y` — la vue COUVERTURE, SANS étage. */
  parCase: ReadonlyMap<string, readonly SceneEntity[]>;
  /** Clé `x,y,z` — la vue COUVERTURE, PAR étage. */
  parCaseEtage: ReadonlyMap<string, readonly SceneEntity[]>;
  /** Clé `x,y,z` — la vue ANCRAGE : TOUTES les entités dont la POSE tombe sur la case, dans l'ordre
   *  du document. */
  ancrees: ReadonlyMap<string, readonly SceneEntity[]>;
}

const AUCUNE: readonly SceneEntity[] = Object.freeze([]); // #2097

function bati(entities: readonly SceneEntity[], mpt: number): IndexDecor {
  const parCase = new Map<string, SceneEntity[]>();
  const parCaseEtage = new Map<string, SceneEntity[]>();
  const ancrees = new Map<string, SceneEntity[]>();
  const ranger = (index: Map<string, SceneEntity[]>, cle: string, e: SceneEntity) => {
    const deja = index.get(cle);
    if (deja) deja.push(e);
    else index.set(cle, [e]);
  };
  for (const e of entities) {
    const z = e.z ?? 0;
    ranger(ancrees, `${e.pos.x},${e.pos.y},${z}`, e);
    if (e.kind !== 'prop') continue;
    for (const t of propFootTiles(e.decor?.id, e.pos, e.facing, mpt)) {
      ranger(parCase, `${t.x},${t.y}`, e);
      ranger(parCaseEtage, `${t.x},${t.y},${z}`, e);
    }
  }
  return { parCase, parCaseEtage, ancrees };
}

const index = memoByRefDeps<readonly SceneEntity[], IndexDecor>();

const indexDe = (scene: Scene): IndexDecor => {
  const mpt = sceneMetresPerTile(scene);
  return index(scene.entities, [mpt], () => bati(scene.entities, mpt));
};

/** Les décors dont l'empreinte couvre la case (x, y), TOUS étages confondus, dans l'ordre du document. */
export const decorsEnCase = (scene: Scene, x: number, y: number): readonly SceneEntity[] =>
  indexDe(scene).parCase.get(`${x},${y}`) ?? AUCUNE;

/** Les décors dont l'empreinte couvre la case (x, y) À l'étage `z`, dans l'ordre du document. */
export const decorsEnCaseEtage = (scene: Scene, x: number, y: number, z: number): readonly SceneEntity[] =>
  indexDe(scene).parCaseEtage.get(`${x},${y},${z}`) ?? AUCUNE;

/** TOUTES les entités ANCRÉES sur la case (x, y, z) — toutes natures, dans l'ordre du document. C'est
 *  la lecture PAR POSITION du picking : le rayon nomme ce
 *  qu'il a frappé, et quand c'est la CASE qui est la question (survol « y a-t-il de l'interactif ici ? »,
 *  clic sur une case qu'aucun rayon n'a nommée), on lit ICI — en O(1), là où un balayage de
 *  `scene.entities` à chaque `pointermove` coûte la scène entière. Vue d'ANCRAGE et non de
 *  COUVERTURE : le picking rend déjà la case d'ANCRAGE d'un meuble (`meubleDessine`), et une entité
 *  sans empreinte authorée (PNJ, conteneur, déclencheur) n'en a pas d'autre. */
export const entitesEnCaseEtage = (scene: Scene, x: number, y: number, z: number): readonly SceneEntity[] =>
  indexDe(scene).ancrees.get(`${x},${y},${z}`) ?? AUCUNE;

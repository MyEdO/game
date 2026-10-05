/**
 * INDEX case → ENTITÉS d'une scène — les seules lectures de « qu'y a-t-il sur cette case ? », en DEUX
 * questions distinctes : « quel DÉCOR la COUVRE ? » (empreinte) et « quelles entités y sont ANCRÉES ? ».
 *
 * Les cases viennent de `propFootTiles` (`state/footprint.ts`), la couture UNIQUE de l'empreinte
 * effective d'un décor (corps tourné pour une recette, empreinte déclarée pour un billboard) : aucun
 * consommateur ne rebâtit de cases pour répondre à cette question, et un décor de plus d'une case
 * répond donc sur TOUTES les siennes, pas seulement sur celle de son ancre.
 *
 * DEUX VUES, UNE construction. La Ligne de Vue interroge SANS étage — `tileBlocksSight(scene, x, y)`
 * n'en reçoit pas : elle lit la case, pas la couche (ÉCART CONNU, #1513). Le PICKING (jeu comme
 * éditeur) interroge À l'étage affiché, celui sur lequel l'écran résout. Un second index bâti à côté
 * re-balaierait les mêmes empreintes ; la seconde vue est donc un second `Map` rempli dans la MÊME
 * passe.
 *
 * PRÉSÉANCE : deux décors sur une même case, c'est le PREMIER du tableau d'entités qui répond —
 * l'ordre du document, déterministe, le même dans les deux vues.
 *
 * POURQUOI CET INDEX N'EST PAS CELUI DE LA MARCHABILITÉ (`sceneRules.ts`, `buildEntityBlockIndex`) :
 * le blocage est l'UNION des cases des décors qui passent la PORTE (`propDeclaredFoot || interact ||
 * solid`), l'étendue est le PREMIER décor du tableau — un index unique portant un drapeau rendrait
 * une case libre dès qu'un décor traversable en couvre un bloquant.
 *
 * Mémoïsé par IDENTITÉ de `scene.entities` (patron `state/sceneMemo.ts`), avec l'ÉCHELLE en
 * dépendance : l'empreinte d'un décor à recette en dépend (#1509), la même liste d'entités à une
 * autre échelle ne couvre pas les mêmes cases. Aucune invalidation manuelle.
 */
import { propFootTiles } from './footprint';
import { memoByRefDeps } from './sceneMemo';
import { sceneMetresPerTile, type Scene, type SceneEntity } from './scene';

interface IndexDecor {
  /** Clé `x,y` — la vue COUVERTURE, SANS étage. */
  parCase: ReadonlyMap<string, SceneEntity>;
  /** Clé `x,y,z` — la vue COUVERTURE, PAR étage. */
  parCaseEtage: ReadonlyMap<string, SceneEntity>;
  /** Clé `x,y,z` — la vue ANCRAGE : TOUTES les entités dont la POSE tombe sur la case, dans l'ordre
   *  du document. */
  ancrees: ReadonlyMap<string, readonly SceneEntity[]>;
}

const AUCUNE: readonly SceneEntity[] = Object.freeze([]); // #2097

function bati(entities: readonly SceneEntity[], mpt: number): IndexDecor {
  const parCase = new Map<string, SceneEntity>();
  const parCaseEtage = new Map<string, SceneEntity>();
  const ancrees = new Map<string, SceneEntity[]>();
  for (const e of entities) {
    const z = e.z ?? 0;
    const cleAncre = `${e.pos.x},${e.pos.y},${z}`;
    const deja = ancrees.get(cleAncre);
    if (deja) deja.push(e);
    else ancrees.set(cleAncre, [e]);
    if (e.kind !== 'prop') continue;
    for (const t of propFootTiles(e.ref, e.pos, e.facing, mpt)) {
      const cle = `${t.x},${t.y}`;
      if (!parCase.has(cle)) parCase.set(cle, e);
      if (!parCaseEtage.has(`${cle},${z}`)) parCaseEtage.set(`${cle},${z}`, e);
    }
  }
  return { parCase, parCaseEtage, ancrees };
}

const index = memoByRefDeps<readonly SceneEntity[], IndexDecor>();

const indexDe = (scene: Scene): IndexDecor => {
  const mpt = sceneMetresPerTile(scene);
  return index(scene.entities, [mpt], () => bati(scene.entities, mpt));
};

/** Le décor dont l'empreinte couvre la case (x, y), TOUS étages confondus. */
export const decorEnCase = (scene: Scene, x: number, y: number): SceneEntity | undefined =>
  indexDe(scene).parCase.get(`${x},${y}`);

/** Le décor dont l'empreinte couvre la case (x, y) À l'étage `z`. */
export const decorEnCaseEtage = (scene: Scene, x: number, y: number, z: number): SceneEntity | undefined =>
  indexDe(scene).parCaseEtage.get(`${x},${y},${z}`);

/** TOUTES les entités ANCRÉES sur la case (x, y, z) — toutes natures, dans l'ordre du document. C'est
 *  la lecture PAR POSITION du picking (`gameIso/stage/pickResolve.ts` § `Verdict`) : le rayon nomme ce
 *  qu'il a frappé, et quand c'est la CASE qui est la question (survol « y a-t-il de l'interactif ici ? »,
 *  clic sur une case qu'aucun rayon n'a nommée), on lit ICI — en O(1), là où un balayage de
 *  `scene.entities` à chaque `pointermove` coûte la scène entière. Vue d'ANCRAGE et non de
 *  COUVERTURE : le picking rend déjà la case d'ANCRAGE d'un meuble (`meubleDessine`), et une entité
 *  sans empreinte authorée (PNJ, conteneur, déclencheur) n'en a pas d'autre. */
export const entitesEnCaseEtage = (scene: Scene, x: number, y: number, z: number): readonly SceneEntity[] =>
  indexDe(scene).ancrees.get(`${x},${y},${z}`) ?? AUCUNE;

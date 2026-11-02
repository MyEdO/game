/**
 * Contrat de LECTURE d'un ART ORIENTÉ par fonctions de rendu, une par vue (`ViewArt`) — la forme des
 * props ORIENTÉS du catalogue, par sa variante paramétrée `PropViews` (args `(params, ctx)`,
 * `catalog/types.ts`).
 *
 * Le PROFIL est dessiné tourné vers la DROITE ; le profil gauche s'obtient par MIROIR dans la MACHINERIE
 * de rendu (jamais dans l'art). La sélection vue+miroir vient de l'UNIQUE résolveur `project(dir, camRot)`
 * (`facing.ts`) — jamais un second algorithme. Une vue ABSENTE replie sur la vue déclarée la plus proche
 * (`nearestView`).
 */
import { VIEWS, type View } from '../facing';
import { tableTotale } from '../../lib/tableTotale';
import { MISSING_TONE, MISSING_TONE_DARK } from '../teamColors';

/** Art orienté par FONCTIONS de rendu, une par vue déclarée.
 *  @template A arguments passés à chaque vue — `[params, ctx]` pour un prop. */
export type ViewArt<A extends unknown[] = []> = Partial<Record<View, (...a: A) => string>>;

/** Ordre de PROXIMITÉ par vue demandée : `VIEWS` rangé par distance d'indice à la vue (le profil est
 *  mitoyen de la face et du dos), égalités rompues par l'ordre de `VIEWS`. */
const NEAREST = tableTotale(VIEWS, (_vue, indice) =>
  [...VIEWS].sort((a, b) => Math.abs(VIEWS.indexOf(a) - indice) - Math.abs(VIEWS.indexOf(b) - indice)));

/** Fonction de rendu de la vue repliée (repli inclus) ; un art sans aucune vue déclarée lève. */
export function nearestView<A extends unknown[]>(art: ViewArt<A>, want: View): (...a: A) => string {
  const vue = NEAREST[want].find((v) => art[v] != null);
  if (vue === undefined) throw new Error('[viewArt] art orienté sans aucune vue déclarée');
  return art[vue]!;
}

/**
 * REPLI VISIBLE (#223) — silhouette d'ERREUR ASSUMÉE d'un décor dont la réf n'a PAS d'art dédié : jamais
 * un joli générique silencieux, une caisse d'alarme barrée d'un « ? » que l'œil repère immédiatement en
 * jeu. Coords LOCALES : origine = contact sol au centre, l'objet monte en y NÉGATIF. Mono-vue
 * (`profile`). Couleurs : le ton d'alarme (`MISSING_TONE`, `teamColors.ts`), indépendant de toute palette.
 */
const MISSING_ART_SVG =
  `<g fill="none" stroke="${MISSING_TONE}" stroke-width="2.5">`
  + `<rect x="-22" y="-52" width="44" height="48" fill="${MISSING_TONE_DARK}"/>` // caisse d'erreur
  + '<path d="M-22 -52 L22 -4 M22 -52 L-22 -4" stroke-width="1.4" opacity="0.55"/>' // hachure croisée
  + '<path d="M-7 -40 Q-7 -47 0 -47 Q8 -47 8 -40 Q8 -34 0 -31 L0 -26" stroke-linecap="round"/>' // hampe du «?»
  + `<rect x="-2.4" y="-21" width="4.8" height="4.8" fill="${MISSING_TONE}" stroke="none"/>` // point du «?»
  + '</g>';

/** Art orienté du REPLI VISIBLE (#223), mono-vue `profile`. */
export const MISSING_ART: ViewArt = { profile: () => MISSING_ART_SVG };

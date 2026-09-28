/**
 * Contrat de LECTURE de tout ART ORIENTÉ (un texte par vue), sous ses deux formats : `ViewArt`, une
 * fonction de rendu par vue (engins de siège `engin/artkit`, coque de navire `ship/composeShip`, gabarit
 * terrestre `land/composeLand`, et, par la variante paramétrée `PropViews` (args `(params, ctx)`), les
 * props ORIENTÉS du catalogue) ; `PartArt`/`ViewSet` (`parts/types.ts`), un SVG par vue.
 *
 * Le PROFIL est dessiné tourné vers la DROITE ; le profil gauche s'obtient par MIROIR dans la MACHINERIE
 * de rendu (jamais dans l'art). La sélection vue+miroir vient de l'UNIQUE résolveur `project(dir, camRot)`
 * (`facing.ts`) — jamais un second algorithme.
 *
 * Lecture SANS repli : `declaredView` (une chaîne ne déclare que la face), la présence
 * `declaredView(art, v) != null`, `declaredViews`, `viewEntries`, `mapViews`. Lecture AVEC repli : UNE
 * lecture, `foldView`, paramétrée par un ordre de repli (une table totale keyée par vue) ; `nearestView`
 * en est l'instance d'un `ViewArt` (une vue ABSENTE replie sur la vue déclarée la plus proche : la coque
 * et le chariot ne déclarent que `profile`), `viewOrFront` celle d'un `PartArt`, qui vit avec son format
 * (#2000). La COUVERTURE réelle (`declaredViews`) pilote la galerie QC (cases vides / « profil seul »).
 */
import { VIEWS, type View } from './facing';
import { tableTotale } from '../../lib/tableTotale';

/** Art orienté par FONCTIONS de rendu, une par vue déclarée.
 *  @template A arguments passés à chaque vue — aucun pour engin/navire/terrestre ; `[params, ctx]` pour un prop. */
export type ViewArt<A extends unknown[] = []> = Partial<Record<View, (...a: A) => string>>;

/** Ce que `mapViews` rend : la valeur de `f` pour une chaîne, sinon un objet aux mêmes clés. */
type VuesMappees<A, U> = A extends string ? U : { [K in keyof A]: U };

/** Art de la vue `view` DÉCLARÉE par `art`, sans repli, ou `undefined`. Domaine : un art orienté en
 *  objet (une valeur par vue), une chaîne (qui ne déclare que la face), `null` ou `undefined`. */
export function declaredView<T>(art: Partial<Record<View, T>> | null | undefined, view: View): T | undefined;
export function declaredView<T>(art: string | Partial<Record<View, T>> | null | undefined, view: View): T | string | undefined;
export function declaredView<T>(art: string | Partial<Record<View, T>> | null | undefined, view: View): T | string | undefined {
  if (art == null) return undefined;
  if (typeof art === 'string') return view === 'front' ? art : undefined;
  return art[view];
}

/** Vues DÉCLARÉES par `art` (`declaredView(art, v) != null`), dans l'ordre de `VIEWS` : une chaîne
 *  déclare `['front']`, `null` et `undefined` ne déclarent rien. Même domaine que `declaredView`. */
export function declaredViews(art: string | Partial<Record<View, unknown>> | null | undefined): View[] {
  return VIEWS.filter((v) => declaredView(art, v) != null);
}

/** Art de la PREMIÈRE vue de `order[want]` que `art` déclare, lu par `declaredView`, ou `undefined`
 *  si `art` n'en déclare aucune (sans lever). `order` : l'ordre de repli, une table totale keyée par vue. */
export function foldView<T>(art: Partial<Record<View, T>> | null | undefined, want: View, order: Readonly<Record<View, readonly View[]>>): T | undefined;
export function foldView<T>(art: string | Partial<Record<View, T>> | null | undefined, want: View, order: Readonly<Record<View, readonly View[]>>): T | string | undefined;
export function foldView<T>(art: string | Partial<Record<View, T>> | null | undefined, want: View, order: Readonly<Record<View, readonly View[]>>): T | string | undefined {
  const vue = order[want].find((v) => declaredView(art, v) != null);
  return vue === undefined ? undefined : declaredView(art, vue);
}

/** Vues déclarées de `art` avec leur art (`declaredView`), dans l'ordre de `declaredViews` : une chaîne
 *  rend `[['front', art]]`, l'art de face dont les autres vues dérivent. */
export function viewEntries<T>(art: Partial<Record<View, T>> | null | undefined): [View, T][];
export function viewEntries<T>(art: string | Partial<Record<View, T>> | null | undefined): [View, T | string][];
export function viewEntries<T>(art: string | Partial<Record<View, T>> | null | undefined): [View, T | string][] {
  return declaredViews(art).map((v) => [v, declaredView(art, v)!]);
}

/** `f` appliquée à l'art de chaque vue : une chaîne rend `f(art)` ; un objet rend un objet aux MÊMES
 *  clés présentes (une vue absente reste absente), `f` appliquée à chaque valeur. */
export function mapViews<A extends string | Partial<Record<View, string>>, U>(art: A, f: (s: string) => U): VuesMappees<A, U> {
  if (typeof art === 'string') return f(art) as VuesMappees<A, U>;
  return Object.fromEntries(viewEntries(art).map(([vue, s]) => [vue, f(s)])) as VuesMappees<A, U>;
}

/** Ordre de PROXIMITÉ par vue demandée : `VIEWS` rangé par distance d'indice à la vue (le profil est
 *  mitoyen de la face et du dos), égalités rompues par l'ordre de `VIEWS`. */
const NEAREST = tableTotale(VIEWS, (_vue, indice) =>
  [...VIEWS].sort((a, b) => Math.abs(VIEWS.indexOf(a) - indice) - Math.abs(VIEWS.indexOf(b) - indice)));

/** Fonction de rendu de la vue repliée (repli inclus). */
export function nearestView<A extends unknown[]>(art: ViewArt<A>, want: View): (...a: A) => string {
  const rendu = foldView(art, want, NEAREST);
  if (!rendu) throw new Error('[viewArt] art orienté sans aucune vue déclarée');
  return rendu;
}

/**
 * REPLI VISIBLE (#223) — silhouette d'ERREUR ASSUMÉE d'un objet inerte du système de plans (navire /
 * terrestre / engin de siège) dont l'`id` n'a PAS d'art dédié. Doctrine du patron « mannequin »
 * (`state/spawn.ts`) : jamais un joli générique silencieux — une caisse d'alarme barrée d'un « ? » que
 * l'œil repère immédiatement en jeu, doublée d'un `console.warn` en DEV nommant l'`id` fautif (donnée à
 * corriger). Coords LOCALES : origine = contact sol au centre, l'objet monte en y NÉGATIF (cf.
 * `groundedBody`). Mono-vue (`profile`) → face/dos REPLIENT dessus. Couleurs LITTÉRALES (magenta d'alarme)
 * — indépendantes de la palette du record, pour rester criardes quelle que soit la teinte demandée.
 */
/** Ton d'ALARME du repli visible — SOURCE UNIQUE, partagée par les entrées de repli des catalogues de
 *  rendu (`gameIso/catalog/missing.ts`, #877). */
export const MISSING_TONE = '#ff2fb0';
/** Fond sourd de la caisse d'alarme (contraste du ton criard). */
export const MISSING_TONE_DARK = '#2a0820';

const MISSING_ART_SVG =
  `<g fill="none" stroke="${MISSING_TONE}" stroke-width="2.5">`
  + `<rect x="-22" y="-52" width="44" height="48" fill="${MISSING_TONE_DARK}"/>` // caisse d'erreur
  + '<path d="M-22 -52 L22 -4 M22 -52 L-22 -4" stroke-width="1.4" opacity="0.55"/>' // hachure croisée
  + '<path d="M-7 -40 Q-7 -47 0 -47 Q8 -47 8 -40 Q8 -34 0 -31 L0 -26" stroke-linecap="round"/>' // hampe du «?»
  + `<rect x="-2.4" y="-21" width="4.8" height="4.8" fill="${MISSING_TONE}" stroke="none"/>` // point du «?»
  + '</g>';

/** Art orienté du REPLI VISIBLE (#223), mono-vue `profile`. Exposé pour la galerie QC et les gardes. */
export const MISSING_ART: ViewArt = { profile: () => MISSING_ART_SVG };

/**
 * SOURCE UNIQUE du repli des 3 registres d'objets inertes (navire / terrestre / engin). Résout l'art
 * orienté d'`id` dans `byId` ; à défaut, la silhouette de REPLI VISIBLE (`MISSING_ART`) + un `console.warn`
 * en DEV nommant l'`id` fautif (`kind` = famille affichée), jamais un repli « générique silencieux ».
 */
export function orientedArtOr<T extends ViewArt>(byId: Map<string, T>, id: string, kind: string): ViewArt {
  const found = byId.get(id);
  if (found) return found;
  // `?.` : viewArt est importé par les scripts tsx (galeries), où `import.meta.env` n'existe pas.
  if (import.meta.env?.DEV) console.warn(`[${kind}] id « ${id} » sans art dédié — silhouette de repli visible (#223), donnée à corriger.`);
  return MISSING_ART;
}

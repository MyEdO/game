/**
 * MARQUE DU TEXTE JOUEUR (#1318 V8a₀) — module FEUILLE et entièrement TYPE : il n'importe rien et ne
 * déclare aucune valeur d'exécution, donc tout import s'efface à la compilation. C'est ce qui lui
 * permet d'être partagé par les TROIS minteurs sans cycle : `i18n/index.ts` (`t()`), `data/index.ts`
 * (les libellés de la donnée, via `dataLabel`) et les fabriques de forme du seam de jet
 * (`state/rollSeam.ts` : `composeRollLabel`).
 *
 * Il vit sous `src/i18n/` et non `src/state/` : le texte joueur est la matière de ce seam (déjà PUR,
 * sans React/DOM, déjà importé par `engine`/`data`/`state`/`ui` sans cycle), alors qu'un module de
 * `src/state` serait importé par `data` et `engine` à contresens de leur dépendance.
 *
 * MARQUE PUREMENT TYPOLOGIQUE (`declare const` — cf. le jumeau `state/stepBrand.ts`) : aucune valeur
 * à l'exécution, `JSON.stringify` d'un `PlayerText` rend la chaîne inchangée, et il reste assignable
 * VERS `string` (tout consommateur d'affichage continue de compiler). L'asymétrie est le murage :
 * `string` n'est PAS assignable vers `PlayerText`, donc un littéral posé sur un champ marqué ne
 * compile plus.
 *
 * LIMITES, les mêmes qu'au jumeau et pour la même raison — le lint (mur `murs/marques`,
 * `eslint.config.js`, mesuré par `state/built-brand-lint.test.ts`) mure les routes de FORGE
 * (`x as PlayerText`, `<PlayerText>x`, sous tableau/`readonly`/générique, et l'ALIAS de type). Restent
 * hors portée : l'ANNOTATION d'une valeur déjà élargie, le RENOMMAGE à l'import, l'alias GÉNÉRIQUE ou
 * calculé. Tous les minteurs sont sous ce lint (#1709 C3c-3b) : `i18n/index.ts` et `state/rollSeam.ts`
 * par exemption de FICHIER ; les deux casts du minteur (b) — `data/index.ts` (`dataLabel`) et
 * `data/mutations.ts` (`mutationTablePlayerLabel`) — et la fabrique de fixture `i18n/fixtureText.ts`
 * par exemption AU SITE, chacune avec sa raison.
 *
 * La CONCATÉNATION blanchit à l'envers : `` `${a} — ${b}` `` de deux `PlayerText` rend un `string` nu.
 * C'est VOULU — recomposer du texte est une FABRIQUE DE FORME, et une fabrique de forme est un
 * minteur nommé (`composeRollLabel`, et les gabarits de V8a₁), pas un site quelconque.
 */

declare const PLAYER_TEXT: unique symbol;

/** Texte destiné à l'ŒIL DU JOUEUR, sorti d'un des trois minteurs (cf. JSDoc ci-dessus). */
export type PlayerText = string & { readonly [PLAYER_TEXT]: true };

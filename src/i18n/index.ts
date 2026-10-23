/**
 * Seam i18n (plan évacué → https://github.com/MyEdO/game/issues/320) — PUR (aucun React/DOM) → importable par le moteur sans casser sa
 * pureté (peer module, comme src/data). `t(key, params)` résout depuis le catalogue de la locale courante
 * (FR par défaut, figée au lancement en v1) ; `MsgKey` est dérivé du catalogue FR → une clé absente est
 * une ERREUR DE COMPILATION. La 2ᵉ langue = un catalogue frère ajouté à `CATALOGS`.
 */
import { fr } from './messages/fr';
import type { PlayerText } from './playerText';

export type MsgKey = keyof typeof fr;
type Params = Record<string, string | number>;

/** Sous-ensemble `out.*` du catalogue — clés de CONSÉQUENCE (`resultLine`, `rollSeam.ts`, #295 Lot 0). */
export type OutKey = Extract<MsgKey, `out.${string}`>;

const CATALOGS = { fr } as const;
export type Locale = keyof typeof CATALOGS;

let locale: Locale = 'fr';
export const getLocale = (): Locale => locale;

/**
 * Change la locale COURANTE — et ne rétro-agit PAS sur ce qui est déjà résolu.
 *
 * GEL AU CHARGEMENT (dette nommée, #1318 V8a₁) : plusieurs cartes de libellés appellent `t()` à
 * l'ÉVALUATION DU MODULE et gardent la chaîne obtenue — `CHAR_LABELS`/`DIFFICULTY_LABELS`/
 * `HIT_LOCATION_LABELS`/`BODY_SHAPE_LOC_LABELS` (`engine/types.ts`) et
 * `CHAR_PENALTY_KIND_LABEL` (`engine/trauma.ts`, familles Faim/Soif et Ivresse — V8c₃ l'a fait passer
 * de littéraux au catalogue, MÊME motif : la carte est figée à l'évaluation du module).
 * V8c₄ ajoute UN site à cette liste, et un seul : `label: t('cor.natureTable')` de la famille
 * `tablesDeNature` (`noyau/corruptionFlow.ts`, table « Corps ou esprit ») — le libellé y est résolu à
 * la construction de la famille, puis gardé jusqu'à la prochaine édition de `species`. Les autres
 * cartes de la tranche n'en sont PAS : `SHIP_LOC_KEY`/`ALLURE_KEY`/`ENCOUNTER_KEY`/`SPELL_*` portent
 * des CLÉS (`MsgKey`), résolues à l'appel — c'est la forme à reprendre pour éteindre les précédentes.
 * V8c₅ n'AJOUTE aucun site à cette liste : ses cartes de module portent des CLÉS résolues à l'appel
 * (`SPEC_SOURCE_KEY` de `engine/traits/dispatch.ts`, `QUALITY_CLASS_KEY` de `qualities/craftEconomy.ts`,
 * `KEY_SECTION_KEY`/`labelKey`/`NAMED_KEY_KEY` de `state/clavier/keybindings.ts`) — la forme à reprendre.
 * Appeler `setLocale` après le chargement les laisse donc en FR, SANS erreur ni avertissement.
 *
 * Ce n'est pas un bug tant que la v1 fige la locale au lancement (plan i18n évacué vers #320, Non-objectifs :
 * « re-rendu live au changement de locale »), mais c'est la CONDITION de cette fonction : la 2ᵉ langue
 * devra transformer ces cartes en accesseurs (`charLabel(k)`) ou re-résoudre au rendu — pas se
 * contenter d'appeler `setLocale`.
 */
export const setLocale = (l: Locale): void => { locale = l; };

/** Interpole `{param}` dans un patron ; laisse `{x}` intact si `x` est absent. Pur (testable seul). */
export function interpolate(pattern: string, params?: Params): string {
  return params ? pattern.replace(/\{(\w+)\}/g, (_, k: string) => (params[k] != null ? String(params[k]) : `{${k}}`)) : pattern;
}

/** Ce qui reste d'un trou de message une fois retirés le nombre et le texte joueur. */
type ResteDuTrou<V> = Exclude<V, number | PlayerText>;
type EnIntersection<U> = (U extends unknown ? (u: U) => void : never) extends (i: infer I) => void ? I : never;
type EstUneUnion<U> = [U] extends [EnIntersection<U>] ? false : true;
/**
 * TROU DE MESSAGE (#2938) : un paramètre de `t()` (et de `trous()`) est du TEXTE — `string` élargi,
 * `PlayerText`, un littéral ou un gabarit SEUL — ou un nombre. Le paramètre de type est `const` : un
 * littéral frais garde son type étroit, si bien qu'une UNION de mots y reste visible et refuse l'appel.
 * Une union est un vocabulaire fermé (`PsychType`, `FireArc`, `c ? psy : 'autre'`, `` `${psy}` ``,
 * `psyOpt ?? '?'`) ou un texte à variantes écrit au site (`'+' | '−'`, `'' | 's'`, `'' | `, ${x}``) :
 * le premier se nomme par son libellé canonique (couture de `src/data/index.ts`, `libelleDeValeur`), le
 * second passe par un formateur partagé (`avecSigne`, `pluriel`) ou une clé du catalogue (`frag.*`).
 *
 * ANGLE MORT — ce que le typage ne voit pas, et que garde la couture de libellé du site :
 *  - un id typé `string` (`ConditionId`, id de Groupe, de créature, de compétence…), indiscernable d'un texte ;
 *  - un vocabulaire d'UN seul mot, ou un id écrit en littéral unique (`{ type: 'animosite' }`) ;
 *  - une valeur élargie AVANT l'appel : gabarit rangé dans une variable (`const x = `${psy}``), `String(id)`,
 *    `as string`, fonction qui rend `string` ;
 *  - un canal qui ne passe ni par `t()` ni par `trous()` (`interpolate`, `StakeRef.values` de `src/data/index.ts`).
 * Verrou : `i18n.test.ts`.
 */
type TrouDeMessage<V> = string extends ResteDuTrou<V> ? V
  : EstUneUnion<ResteDuTrou<V>> extends true ? { readonly 'id de vocabulaire fermé : à nommer par son libellé': V }
  : V;
type TrousDeMessage<P> = { [K in keyof P]: TrouDeMessage<P[K]> };

declare const TROUS_VERIFIES: unique symbol;
/** Paramètres de message dont les trous ont passé la garde de `t()` — la seule forme qu'un canal STOCKÉ
 *  accepte (`Consequence.vars`, `RefusGeste.vars`, `KeyBinding.labelParams`), forgée par `trous()`. */
export type TrousVerifies = Readonly<Params> & { readonly [TROUS_VERIFIES]: true };

/** Paramètres d'un message composés AVANT l'appel de `t()` : la MÊME garde de trous, au site qui les écrit. */
export function trous<const P extends object>(params: P & TrousDeMessage<P>): TrousVerifies {
  // eslint-disable-next-line murs/marques -- #2938 : minteur des paramètres stockés — la garde de trous est sa signature.
  return params as unknown as TrousVerifies;
}

/**
 * Texte de la clé dans la locale courante (repli FR puis clé), paramètres interpolés.
 *
 * MINTEUR (a) de `PlayerText` (#1318 V8a₀) — la voie NORMALE : tout ce qui sort du catalogue est du
 * texte joueur par construction. Le retour reste assignable vers `string`, donc aucun consommateur
 * d'affichage ne bouge ; ce qui change, c'est qu'un champ MARQUÉ accepte seulement une sortie de
 * minteur. `interpolate` reste `string` : elle interpole un patron quelconque, elle ne mint pas.
 */
export function t<const P extends object = Params>(key: MsgKey, params?: P & TrousDeMessage<P>): PlayerText {
  const pat: string = CATALOGS[locale][key] ?? CATALOGS.fr[key] ?? key;
  // eslint-disable-next-line murs/marques -- #1318 : minteur (a) de `PlayerText` — ce qui sort du catalogue est du texte joueur (cf. JSDoc de `t`).
  return interpolate(pat, params as Params | undefined) as PlayerText;
}

/** `cle` est-elle une clé du catalogue ? La garde des libellés lus par id (`noyau/libelles.ts`). */
export const estUneCle = (cle: string): cle is MsgKey => Object.prototype.hasOwnProperty.call(CATALOGS.fr, cle);

/**
 * FRAGMENT « de X » ÉLIDÉ — source UNIQUE de l'élision de la préposition devant un nom propre de
 * règle (Compétence, Caractéristique) : « Test **de** Résistance » mais « Test **d'**Initiative ».
 * Composé par les patrons qui nomment le SUJET d'un jet (`casc.traceTestLabel`) : le catalogue porte
 * le trou, l'élision se décide ici et nulle part ailleurs.
 *
 * PÉRIMÈTRE DÉCLARÉ : voyelles seulement (accentuées comprises). Le `h` reste NON élidé — muet ou
 * aspiré n'est pas décidable sur le seul mot (« d'Hypnotisme » mais « de Halfling »), et aucune
 * donnée ne le porte : l'inventer produirait un faux à l'écran. Un nom en `h` qui l'exigerait se
 * traite en donnée, jamais par une heuristique ici.
 */
export function deElide(nom: string): string {
  return `${elision('de', nom)}${nom}`;
}

/** La particule `de` ou l'article `le` devant `nom`, ÉLIDÉ ou non (« d’ » / « de », « l’ » / « le ») —
 *  même périmètre que `deElide`, dont elle est la règle : « arrive **l’**Aubentag », « arrive **le** Wellentag ». */
export function elision(particule: 'de' | 'le', nom: string): string {
  return /^[aeiouyàâäéèêëîïôöùûü]/i.test(nom) ? `${particule[0]}’` : `${particule} `;
}

/** Marque du pluriel d'un compte affiché (« 1 point », « 2 points », « -2 points ») : `s` au-delà de 1 en
 *  valeur absolue, rien sinon. */
export function pluriel(n: number): string {
  return Math.abs(n) > 1 ? 's' : '';
}

/** Un nombre signé tel qu'il se lit (« +10 », « −20 », « +0 ») : le signe moins typographique. */
export function avecSigne(n: number): string {
  return `${n >= 0 ? '+' : '−'}${Math.abs(n)}`;
}

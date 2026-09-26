/**
 * Seam i18n (plan évacué → https://github.com/cgauche/game/issues/320) — PUR (aucun React/DOM) → importable par le moteur sans casser sa
 * pureté (peer module, comme src/data). `t(key, params)` résout depuis le catalogue de la locale courante
 * (FR par défaut, figée au lancement en v1) ; `MsgKey` est dérivé du catalogue FR → une clé absente est
 * une ERREUR DE COMPILATION. La 2ᵉ langue = un catalogue frère ajouté à `CATALOGS`.
 */
import { fr } from './messages/fr';
import type { PlayerText } from './playerText';

export type MsgKey = keyof typeof fr;
type Params = Record<string, string | number>;

/** Sous-ensemble `out.*` du catalogue — clés de CONSÉQUENCE (`resultLine`, `rollSeam.ts`, #295 Lot 0).
 *  `OutVars` reste un `Record` non typé PAR clé (comme `Params` ci-dessus, `t()` n'a pas de typage
 *  par clé) ; le paramètre générique est gardé pour la signature de `Consequence` (#295), extensible
 *  sans casser l'appelant si `t()` se type un jour par clé. */
export type OutKey = Extract<MsgKey, `out.${string}`>;
export type OutVars<_K extends OutKey = OutKey> = Params;

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
 * V8c₄ ajoute UN site à cette liste, et un seul : `label: t('cor.natureTable')` passé à
 * `registerTableStep` au CHARGEMENT de `state/corruptionFlow.ts` (la table « Corps ou esprit » est
 * enregistrée par une boucle de module) — le libellé y est résolu une fois pour toutes. Les autres
 * cartes de la tranche n'en sont PAS : `SHIP_LOC_KEY`/`ALLURE_KEY`/`ENCOUNTER_KEY`/`SPELL_*` portent
 * des CLÉS (`MsgKey`), résolues à l'appel — c'est la forme à reprendre pour éteindre les précédentes.
 * V8c₅ n'AJOUTE aucun site à cette liste : ses cartes de module portent des CLÉS résolues à l'appel
 * (`SPEC_SOURCE_KEY` de `engine/traits/dispatch.ts`, `QUALITY_CLASS_KEY` de `qualities/craftEconomy.ts`,
 * `KEY_SECTION_KEY`/`labelKey`/`NAMED_KEY_KEY` de `state/keybindings.ts`) — la forme à reprendre.
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

/**
 * Texte de la clé dans la locale courante (repli FR puis clé), paramètres interpolés.
 *
 * MINTEUR (a) de `PlayerText` (#1318 V8a₀) — la voie NORMALE : tout ce qui sort du catalogue est du
 * texte joueur par construction. Le retour reste assignable vers `string`, donc aucun consommateur
 * d'affichage ne bouge ; ce qui change, c'est qu'un champ MARQUÉ accepte seulement une sortie de
 * minteur. `interpolate` reste `string` : elle interpole un patron quelconque, elle ne mint pas.
 */
export function t(key: MsgKey, params?: Params): PlayerText {
  const pat: string = CATALOGS[locale][key] ?? CATALOGS.fr[key] ?? key;
  return interpolate(pat, params) as PlayerText;
}

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
  return /^[aeiouyàâäéèêëîïôöùûü]/i.test(nom) ? `d’${nom}` : `de ${nom}`;
}

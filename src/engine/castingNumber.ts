/**
 * NIVEAU D'INCANTATION EFFECTIF — primitive UNIQUE (`VDM 02 l.379`, LDB 46).
 *
 * Le NI est une donnée du Sort (`SpellData.cn` — un Rituel EST un Sort, `VDM 02 l.363`/`l.379`,
 * distingué par sa seule rubrique d'anatomie `l.377-393`) que plusieurs
 * porteurs MODIFIENT : un bâton enchanté (`VDM 12 l.48`), un support de lecture (LDB 47 l.21,
 * `VDM 12 l.647`), un breuvage (`VDM 12` folio 162), un lieu (`VDM 14 l.437`, l.489, l.353), une
 * Activité (`VDM 02 l.777`). Aucun de ces porteurs n'est nommé ici : chacun apporte une liste de
 * `CastingNumberMod` en DONNÉE, et un 8ᵉ porteur ne coûte pas une ligne de moteur.
 *
 * Vocabulaire calqué sur celui de la magie environnementale (`arcane-phenomena.ts`,
 * `PhenomenonScope`) : mêmes clés de portée, même sémantique de OU entre les clauses de Domaine.
 *
 * SITE DE LECTURE : `engine/magic.ts` (`castingNumberOf`), consommé par `evaluateCasting`
 * (comparaison `DR ≥ NI`) et son miroir déterministe `castLandProbability`.
 */

/** Sens d'arrondi d'une division — le RAW le CHIFFRE à chaque fois, et il DIVERGE d'un porteur à
 *  l'autre (`VDM 12` folio 162 : au supérieur ; `VDM 14 l.437` et l.489 : à l'inférieur). */
export type CastingNumberRounding = 'inferieur' | 'superieur';

/** Un Rituel est un Sort (`VDM 02 l.363`) ; plusieurs modificateurs ne visent pourtant QUE l'un des
 *  deux (`VDM 12 l.646-647` : ×2 un Sort, ×4 un Rituel ; `VDM 14 l.489` : les Rituels seulement).
 *  D'où cet axe — un TAG de l'entrée de sort, jamais une mécanique de résolution distincte. */
export type CastingNumberKind = 'sort' | 'rituel';

/**
 * À QUOI s'applique le modificateur. Les clauses de DOMAINE (`domains`, `domainsExcept`,
 * `chaosMagic`, `spellIds`) se combinent en OU — comme `PhenomenonScope`. `kinds` est une
 * RESTRICTION préalable (ET) : « le NI des Rituels qui utilisent *Ghyran* » (`VDM 14 l.489`) ne
 * touche pas les Sorts de Vie. Portée absente = tout NI.
 */
export interface CastingNumberScope {
  /** Ids de `domains.json`. */
  domains?: string[];
  /** Ids de `domains.json` EXCLUS (le modificateur porte sur tous les autres Domaines). */
  domainsExcept?: string[];
  /** Magie du Chaos — résolue par l'appelant, qui pose `CastingNumberSubject.chaosMagic`. */
  chaosMagic?: boolean;
  /** Ids de sorts NOMMÉS par le RAW (`VDM 14 l.353`). */
  spellIds?: string[];
  /** Restreint le modificateur aux Sorts, ou aux Rituels. Absent = les deux. */
  kinds?: CastingNumberKind[];
}

/**
 * Un modificateur de NI en DONNÉE. Ordre d'application FIXE, arbitrage MAISON [entériné 2026-08-03]
 * là où aucun passage ne règle le cumul de deux porteurs : facteur (`multiply` puis `divide`,
 * arrondi par `round`), puis `delta`, puis le plancher `min` du modificateur.
 */
export interface CastingNumberMod {
  /** NI multiplié (`VDM 12 l.647` : ×2 pour un Sort lu au grimoire, ×4 pour un Rituel). */
  multiply?: number;
  /** NI divisé (`VDM 12` folio 162 : « de moitié » = 2). Exige `round`. */
  divide?: number;
  /** Sens d'arrondi de `divide`, tel qu'imprimé. */
  round?: CastingNumberRounding;
  /** Delta appliqué APRÈS le facteur (`VDM 12 l.48` : −1 ; `VDM 14 l.353` : −2). */
  delta?: number;
  /** Plancher EXPLICITE du RAW (`VDM 12 l.48` : « jusqu'à un minimum de 0 »). */
  min?: number;
  scope?: CastingNumberScope;
  /** Valeur maison ÉDITABLE portant sa justification (AGENTS.md règle 7) — le sens d'arrondi que le
   *  RAW n'imprime pas se pose ici, jamais en silence. */
  maison?: string;
  source: { book: string; page: number };
  /** Passage RAW VERBATIM qui porte le modificateur (règle stricte 5). */
  desc: string;
}

/** Le NI dont on calcule la valeur effective : sa nature, son Domaine, son id. */
export interface CastingNumberSubject {
  /** Id du Sort/Rituel (`spellIds`). */
  id?: string;
  /** Id de `domains.json` du Sort/Rituel. */
  domainId?: string | null;
  kind: CastingNumberKind;
  /** Le lanceur manipule la Magie du Chaos (`chaosDomainOf`), posé par l'appelant. */
  chaosMagic?: boolean;
}

/**
 * Plancher ABSOLU du NI. Le RAW ne le pose explicitement que pour le bâton enchanté
 * (`VDM 12 l.48`) ; ailleurs il est arithmétiquement neutre — la comparaison du Test d'Incantation
 * est `DR ≥ NI` sur une RÉUSSITE, dont le DR est déjà ≥ 0, donc un NI négatif se comporte comme 0.
 * Le poser ici n'accorde donc rien au joueur ; il empêche seulement un NI négatif d'être AFFICHÉ.
 */
export const CASTING_NUMBER_FLOOR = 0;

/** Le modificateur porte-t-il sur CE NI ? `kinds` filtre d'abord (ET), les clauses de Domaine
 *  s'unissent ensuite (OU) — portée absente = tout NI. */
export function castingNumberScopeMatches(scope: CastingNumberScope | undefined, subject: CastingNumberSubject): boolean {
  if (!scope) return true;
  if (scope.kinds && !scope.kinds.includes(subject.kind)) return false;
  const clauses = scope.domains || scope.domainsExcept || scope.chaosMagic || scope.spellIds;
  if (!clauses) return true;
  const domain = subject.domainId ?? null;
  if (scope.domains && domain != null && scope.domains.includes(domain)) return true;
  if (scope.domainsExcept && domain != null && !scope.domainsExcept.includes(domain)) return true;
  if (scope.chaosMagic && subject.chaosMagic) return true;
  if (scope.spellIds && subject.id != null && scope.spellIds.includes(subject.id)) return true;
  return false;
}

/** Applique UN modificateur (facteur → delta → plancher du modificateur). Une division sans sens
 *  d'arrondi déclaré ne s'applique pas : le RAW l'imprime toujours, l'omettre serait une devinette. */
function applyMod(ni: number, mod: CastingNumberMod): number {
  let v = ni;
  if (mod.multiply != null) v *= mod.multiply;
  if (mod.divide != null && mod.round) v = mod.round === 'superieur' ? Math.ceil(v / mod.divide) : Math.floor(v / mod.divide);
  if (mod.delta != null) v += mod.delta;
  if (mod.min != null) v = Math.max(mod.min, v);
  return v;
}

/**
 * NI EFFECTIF d'un Sort/Rituel : le NI imprimé, passé par tous les modificateurs dont la portée
 * tient, dans l'ordre de la liste, planché à `CASTING_NUMBER_FLOOR`. PUR.
 */
export function effectiveCastingNumber(
  base: number,
  subject: CastingNumberSubject,
  mods: readonly CastingNumberMod[] = [],
): number {
  let ni = base;
  for (const mod of mods) {
    if (!castingNumberScopeMatches(mod.scope, subject)) continue;
    ni = applyMod(ni, mod);
  }
  return Math.max(CASTING_NUMBER_FLOOR, ni);
}

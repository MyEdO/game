/**
 * PORTE UNIQUE du FORMAT LIVRE d'une référence de statbloc — « Compétence (Spéc) Valeur »,
 * « Talent (Spéc) Niveau », « Trait (Argument) Indice » : le RENDU vit dans `src/data`
 * (`skillRefLabel`/`talentRefLabel`) et dans `formatTrait` (`engine/traits/dispatch.ts`), le PARSE
 * INVERSE vit ici. Round-trips verrouillés par `statblock-skillref-roundtrip.test.ts` et
 * `label-logic-guard.test.ts` (`ALLER_RETOUR`).
 *
 * Consommateurs : les éditeurs de statbloc (`StatblockEditor`, atelier du Codex `CodexEdit`,
 * `StructFields`, `OptionalTraitsPicker`) et l'éditeur d'op (`GameOpEditor`). `spec` rend un `id` dès
 * qu'elle en RÉSOUT un — d'abord au catalogue de l'entrée, sinon au registre partagé (`specIdOf`) ; sur
 * un domaine à spécialisations OUVERTES, le verbatim saisi est conservé en dernier ressort
 * (« Savoir (Zorglub) » persiste « Zorglub »), faute d'id à désigner. Doctrine « toute LOGIQUE est
 * keyée par id STABLE » (AGENTS.md).
 */
import { byId, findSkill, findTalent, findTalentById, findTraitById, specCatalogOf, specIdByLabel, specLabel, specResolves, traitIdByLabel, type SkillRef, type TalentRef, type TraitData } from '../../data';
import { ARG_JOKER } from '../../data/schemas/grammaire/reference';
import { slugId } from '../../data/slug';
import { parseStatEntry } from '../../engine/statEntry';
import type { TraitPose } from '../../data/schemas/grammaire/reference';
import { t } from '../../i18n';

/** Saisie « (Au choix) » : un EMPLACEMENT, jamais une spécialisation (#1548). Le mot lu est celui que
 *  l'affichage compose (`ref.motAuChoix`, `choixLabel`). */
function saisieAuChoix(arg: string): boolean {
  return arg.toLowerCase().replace(/^(un |une |deux )/, '') === t('ref.motAuChoix').toLowerCase();
}

/** Branches d'une saisie « A ou B », coupées sur le liant que l'affichage compose (`ref.ou`,
 *  `ouListe`) ; une seule branche sans liant. */
function branchesOu(arg: string): string[] {
  const liant = t('ref.ou').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return arg.split(new RegExp(`\\s+${liant}\\s+`, 'i')).map((x) => x.trim());
}

/**
 * Libellé FR d'une spécialisation → son `id`. Deux étages, car ce qui est ÉNUMÉRABLE (`specCatalogOf`)
 * est un SOUS-ENSEMBLE de ce qui est VALIDE (`specResolves`) quand la def désigne une `specsSource` :
 * (1) l'entrée du catalogue dont le libellé est ce texte ; (2) sinon le slug du texte, s'il RÉSOUT au
 * registre partagé — un statbloc RAW porte des spécs réelles hors du pool joueur (Focalisation
 * « Magie des mers de Triton »). Verbatim en dernier ressort : domaine OUVERT, spéc libre saisie par
 * l'auteur (`LDB 09 l.40`).
 */
function specIdOf(ds: 'skills' | 'talents', refId: string, label: string): string {
  const def = ds === 'skills' ? byId('skill', refId) : findTalentById(refId);
  if (!def) return label;
  const auCatalogue = specCatalogOf(def).find((id) => specLabel(ds, refId, id) === label);
  if (auCatalogue) return auCatalogue;
  const candidat = slugId(label);
  return specResolves(def, candidat) ? candidat : label;
}

/** Parse une saisie « Compétence (Spéc) Valeur » → `SkillRef` (forme unique `{id, spec?|choix?, value}`).
 *  « (Au choix) » rend `choix: true`, « (A ou B) » rend `choix: [ids]` — jamais le littéral en `spec` ;
 *  une spéc concrète revient à son `id` (le round-trip d'édition passe par le libellé d'affichage). */
export function parseSkillRef(text: string): SkillRef {
  const p = parseStatEntry(text);
  const id = findSkill(p.name)?.id ?? slugId(p.name);
  const value = p.indice ?? 0;
  const arg = p.arg?.trim();
  if (!arg) return { id, value };
  if (saisieAuChoix(arg)) return { id, choix: true, value };
  const branches = branchesOu(arg);
  if (branches.length > 1) return { id, choix: branches.map((x) => specIdOf('skills', id, x)), value };
  return { id, spec: specIdOf('skills', id, arg), value };
}

/** Parse une saisie « Talent (Spéc) Niveau » → `TalentRef` (id stable + spec en id + `times` ≥2).
 *  Inverse EXACT de `talentRefLabel` : le niveau (« Maîtrise du combat 3 ») et la spécialisation
 *  survivent à l'aller-retour d'édition — un niveau absent vaut 1 (jamais écrit). */
export function parseTalentRef(text: string): TalentRef {
  const p = parseStatEntry(text);
  const id = findTalent(p.name)?.id ?? slugId(p.name);
  const arg = p.arg?.trim();
  return {
    id,
    ...(arg ? { spec: specIdOf('talents', id, arg) } : {}),
    ...(p.indice != null && p.indice > 1 ? { times: p.indice } : {}),
  };
}

/** Nom de Trait SAISI → son `id` (`traitIdByLabel`, casse ignorée) ; inconnu du registre → slug du
 *  texte (« Arme », « Griffes »). */
function idDeTraitSaisi(nom: string): string {
  return traitIdByLabel(nom) ?? slugId(nom);
}

/** Argument SAISI d'un Trait à registre (`specsSource`) : le libellé d'une entrée du registre revient
 *  à son id (`specIdByLabel`) ; un joker ou un texte libre reste verbatim. Sans registre, le texte est
 *  l'argument. Une saisie est UNE spécialisation : une liste jointe reste verbatim, et le schéma
 *  d'instance la refuse sur un registre fermé. */
function argDeTraitSaisi(def: TraitData | undefined, texte: string): string {
  const source = def?.specsSource;
  if (!source || ARG_JOKER.test(texte.trim())) return texte;
  return specIdByLabel(texte, source) ?? texte.trim();
}

/** Parse une saisie « Trait (Argument) Indice » → Trait posé (`TraitPose` : id stable, argument en ids,
 *  Indice/bonus, compte, portée). Inverse de `formatTrait`. */
export function parseTraitInstance(text: string): TraitPose {
  const p = parseStatEntry(text);
  const trait: TraitPose = { id: idDeTraitSaisi(p.name) };
  const value = p.bonus ?? p.indice;
  if (value != null) trait.value = value;
  if (p.arg != null) trait.arg = argDeTraitSaisi(findTraitById(trait.id), p.arg);
  if (p.count != null) trait.count = p.count;
  if (p.range != null) trait.range = p.range;
  return trait;
}

/** Même VALEUR posée : même id, Indice, Aspect, compte et portée — ce qu'atteste une provenance. */
const memeValeur = (a: TraitPose, b: TraitPose): boolean =>
  a.id === b.id && a.value === b.value && a.arg === b.arg && a.count === b.count && a.range === b.range;
/** Même Trait au même Aspect, quelle que soit la valeur. */
const memeAspect = (a: TraitPose, b: TraitPose): boolean => a.id === b.id && a.arg === b.arg;
/** Même Trait. */
const memeId = (a: TraitPose, b: TraitPose): boolean => a.id === b.id;

/** La saisie relue sur une pose EXISTANTE. `formatTrait` ne rend que l'id, l'Indice, l'Aspect, le compte
 *  et la portée ; le reste de la pose ne survit qu'à ce qu'il qualifie :
 *  - les drapeaux (`natural`, `hidden`) qualifient le TRAIT : ils survivent au même id ;
 *  - la provenance (`source`, `alsoIn`, `maison`) atteste la VALEUR posée : elle survit à la même valeur
 *    (`memeValeur`) et tombe dès que l'un de ses termes change.
 *  Relue UNE fois à la fin de la saisie (`SaisieEnBrouillon`), jamais à chaque frappe. SEULE voie
 *  d'édition en chaîne d'un Trait déjà posé : `parseTraitInstance` nu repose une pose NEUVE. */
export function relireTrait(text: string, avant: TraitPose): TraitPose {
  const relu = parseTraitInstance(text);
  if (!memeId(relu, avant)) return relu;
  const valeur = memeValeur(relu, avant);
  return {
    ...relu,
    ...(avant.natural !== undefined ? { natural: avant.natural } : {}),
    ...(avant.hidden !== undefined ? { hidden: avant.hidden } : {}),
    ...(valeur && avant.source !== undefined ? { source: avant.source } : {}),
    ...(valeur && avant.alsoIn !== undefined ? { alsoIn: avant.alsoIn } : {}),
    ...(valeur && avant.maison !== undefined ? { maison: avant.maison } : {}),
  };
}

/** Une LISTE de saisies relue sur ses poses d'origine, appariées en PASSES sur toute la liste, chaque
 *  pose servant une fois : d'abord à valeur égale (`memeValeur` : la pose revient entière), puis parmi
 *  les restantes au même Aspect, puis au même id seul (les drapeaux suivent, la provenance tombe,
 *  `relireTrait`) ; une saisie sans pose de même id est NEUVE. Ni le rang ni l'ordre des saisies ne
 *  décident : retirer ou réordonner un Trait ne fait passer aucun drapeau ni aucune provenance à un autre,
 *  doublons de même id compris. */
export function relireTraits(texts: readonly string[], avant: readonly TraitPose[]): TraitPose[] {
  const relus = texts.map(parseTraitInstance);
  const prises = avant.map(() => false);
  const appariees: (TraitPose | undefined)[] = relus.map(() => undefined);
  for (const apparie of [memeValeur, memeAspect, memeId]) {
    relus.forEach((relu, i) => {
      if (appariees[i]) return;
      const k = avant.findIndex((p, j) => !prises[j] && apparie(relu, p));
      if (k < 0) return;
      prises[k] = true;
      appariees[i] = avant[k];
    });
  }
  return relus.map((relu, i) => (appariees[i] ? relireTrait(texts[i], appariees[i]) : relu));
}

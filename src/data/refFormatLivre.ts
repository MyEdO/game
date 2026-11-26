/**
 * PORTE UNIQUE du FORMAT LIVRE d'une référence de statbloc — « Compétence (Spéc) Valeur »,
 * « Talent (Spéc) Niveau », « Trait (Argument) Indice » : le RENDU vit dans `src/data`
 * (`skillRefLabel`/`talentRefLabel`) et dans `formatTrait` (`engine/traits/dispatch.ts`), le PARSE
 * INVERSE vit ici. Round-trips verrouillés par `statblock-skillref-roundtrip.test.ts` et
 * `label-logic-guard.test.ts` (`ALLER_RETOUR`).
 *
 * Consommateurs : les éditeurs de statbloc (`StatblockEditor`, atelier du Codex `CodexEdit`,
 * `StructFields`, `OptionalTraitsPicker`), l'éditeur d'op (`GameOpEditor`) et celui d'arme (`WeaponField`,
 * « Qualité Indice », inverse de `qualityRefLabel`). `spec` rend un `id` dès
 * qu'elle en RÉSOUT un — d'abord au catalogue de l'entrée, sinon au registre partagé (`specIdOf`) ; sur
 * un domaine à spécialisations OUVERTES, le verbatim saisi est conservé en dernier ressort
 * (« Savoir (Zorglub) » persiste « Zorglub »), faute d'id à désigner. Doctrine « toute LOGIQUE est
 * keyée par id STABLE » (AGENTS.md).
 */
import {
  byId,
  caracDuSigle,
  findSkill,
  findTalent,
  findTalentById,
  findTraitById,
  qualityIdByLabel,
  specCatalogOf,
  specIdByLabel,
  specLabel,
  traitIdByLabel,
  emplacementsDesPiecesDuCatalogue,
  type SkillRef,
  type TalentRef,
  type TraitData,
} from './index';
import { ARG_JOKER, traitAdmet } from './schemas/grammaire/reference';
import { specAuCatalogue } from './schemas/grammaire/ref';
import { slugId } from './schemas/slug';
import { parseStatEntry } from '../engine/statEntry';
import { classerParenthese, lireMatiere } from '../engine/classementDeTrait';
import type { TraitPose } from './schemas/grammaire/reference';
import { t } from '../i18n';
import { norm } from '../lib/normalize';
import { DIFFICULTY_NAMES, type Difficulty, type QualityInstance } from '../engine/types';

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
 * est un SOUS-ENSEMBLE de ce qui est DÉSIGNÉ (`specAuCatalogue`) quand la def désigne une `specsSource` :
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
  return specAuCatalogue(ds === 'skills' ? 'skill' : 'talent', refId, candidat) ? candidat : label;
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

/** Une parenthèse qui nomme un Trait du registre (« Venin », « Venin (Complexe) »). */
const nommeUnTrait = (texte: string): boolean => !!findTraitById(idDeTraitSaisi(parseStatEntry(texte).name));

/** « Poison, Difficulté Difficile (–20) » → l'Aspect et la Difficulté qui le suit (MDG 16 l.226) ; un texte
 *  sans Difficulté reconnue reste l'Aspect. */
function aspectEtDifficulte(texte: string): { aspect?: string; difficulte?: Difficulty } {
  const m = /^(?:(.*?),\s*)?Difficulté\s+(.+)$/i.exec(texte.trim());
  const nom = m ? norm(m[2].replace(/\s*\(.*\)\s*$/, '')) : undefined;
  const difficulte = nom ? (Object.keys(DIFFICULTY_NAMES) as Difficulty[]).find((d) => norm(DIFFICULTY_NAMES[d]) === nom) : undefined;
  if (!m || !difficulte) return { aspect: texte };
  return { ...(m[1] ? { aspect: m[1] } : {}), difficulte };
}

/** Parse une saisie « Trait (Argument) Indice » → Trait posé (`TraitPose` : id stable, argument en ids,
 *  Indice/bonus ou Indice relatif ou fourchette ou Indice par Localisation, Difficulté, Traits conférés,
 *  compte, portée). Inverse de `formatTrait`. */
export function parseTraitInstance(text: string): TraitPose {
  const p = parseStatEntry(text);
  const trait: TraitPose = { id: idDeTraitSaisi(p.name) };
  const def = findTraitById(trait.id);
  const value = p.bonus ?? p.indice;
  // Sur un Trait d'attaque, une parenthèse qui nomme un Trait en est un Trait conféré (ZI 03 l.75, l.77).
  const groupes = [p.arg, ...(p.suites ?? [])].filter((g): g is string => g != null);
  const conferes = traitAdmet(trait.id, 'confere') ? groupes.filter(nommeUnTrait) : [];
  // La parenthèse d'un Trait à Indice imprimé se classe (`classerParenthese`) ; celle d'un Trait qui admet
  // l'Indice par Localisation peut désigner des Localisations ou des pièces du catalogue.
  const pieces = traitAdmet(trait.id, 'parLocalisation') ? emplacementsDesPiecesDuCatalogue() : undefined;
  let aspect: string | undefined;
  if (value != null) trait.value = value;
  if (p.plage) trait.plage = p.plage;
  for (const g of groupes.filter((x) => !conferes.includes(x))) {
    const classe = p.plage == null && def?.indice ? classerParenthese(g, { indice: value, pieces, caracs: caracDuSigle }) : undefined;
    if (!classe) aspect ??= g;
    else if ('plage' in classe) trait.plage = classe.plage;
    else if ('parLocalisation' in classe) {
      trait.parLocalisation = classe.parLocalisation;
      delete trait.value;
    } else if ('formule' in classe) trait.value = classe.formule;
    else {
      aspect ??= classe.aspect;
      trait.value = classe.indice;
    }
  }
  // La matière de l'Armure se lit à ses pièces (leur Groupe) ou à son Aspect. LDB 63 l.41-58 ; LDB 85 l.39
  const matiere = traitAdmet(trait.id, 'matiere') ? groupes.filter((x) => !conferes.includes(x)).map((g) => lireMatiere(g, { indice: value, pieces })).find((m) => m !== undefined) : undefined;
  if (matiere) trait.matiere = matiere;
  const lu = aspect != null && traitAdmet(trait.id, 'difficulte') ? aspectEtDifficulte(aspect) : { aspect };
  if (lu.aspect != null) trait.arg = argDeTraitSaisi(def, lu.aspect);
  if (lu.difficulte) trait.difficulte = lu.difficulte;
  if (conferes.length) trait.confere = conferes.map(parseTraitInstance);
  if (p.count != null) trait.count = p.count;
  if (p.range != null) trait.range = p.range;
  return trait;
}

/** Sépare un éventuel Indice de fin (« X 3 » / « X (3) » / « X (1A) ») du libellé. L'UNITÉ qui suit la valeur
 *  (`QualityData.indice.unite`, rendue par `qualityRefLabel`, `AA 08 l.136` « Taillade (1A) ») est absorbée :
 *  sans ça, un aller-retour prose→structure perdrait l'Indice de Taillade. Une majoration (« X +1 », munition seule,
 *  #4346) n'est pas un Indice : le libellé reste entier, et `parseQuality` la refuse. */
export function splitIndice(raw: string): { label: string; indice?: number } {
  const m = raw.trim().match(/^(.*?[^\s+])\s*\(?(\d+)\s*[A-Za-zÀ-ÿ]*\)?\s*$/);
  if (m && m[2] != null && m[1].trim()) return { label: m[1].trim(), indice: parseInt(m[2], 10) };
  return { label: raw.trim() };
}

/** Parse une saisie « Qualité Indice » (« Solide 3 », « précise ») → son id stable et son Indice, ou `null` si
 *  aucune qualité ne porte ce libellé (`qualityIdByLabel`, casse ignorée, ou l'id lui-même). */
export function parseQuality(raw: string): { id: string; indice?: number } | null {
  const { label, indice } = splitIndice(raw);
  const id = qualityIdByLabel(label);
  return id ? { id, indice } : null;
}

/** Parse une saisie « Qualité Indice » → `QualityInstance` (`{ id, value? }`), ou `null` si inconnue. Inverse de
 *  `qualityRefLabel`. */
export function parseQualityInstance(raw: string): QualityInstance | null {
  const p = parseQuality(raw);
  if (!p) return null;
  return p.indice != null ? { id: p.id, value: p.indice } : { id: p.id };
}

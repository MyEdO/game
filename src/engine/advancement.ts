/**
 * Avancement par Points d'Expérience (PX) — Livre de base, « Carrières » (LDB 07) l.35-109.
 *
 * Les Augmentations s'achètent UNE PAR UNE : le coût de la prochaine dépend du nombre déjà
 * acheté pour cette Caractéristique / Compétence (LDB 07 l.45/78). Toutes les valeurs sont copiées
 * VERBATIM du Tableau de Coût des Augmentations (LDB 07 l.51-70) — aucune invention.
 */
import { Combatant, CharKey } from './types';
import { CareerSlot, acquerirTalent, parseRefKey } from './careerSlots';
import advancementCostsJson from '../data/advancementCosts.json';
import { findTableEntry, tableOuverte } from './tables';
import { t } from '../i18n';

/**
 * Détection « in-carrière » (LDB 07 l.91) : une Augmentation est au coût standard si la
 * Caractéristique / Compétence / Talent est DISPONIBLE pour le héros — Caractéristiques et
 * Compétences des niveaux ≤ courant (LDB 07 l.41-43/76), Talents du niveau courant seul (LDB 07 l.103) ; sinon
 * le coût est doublé (Caractéristiques/Compétences) ou interdit (Talents, LDB 07 l.93).
 * Les Compétences/Talents passent par les EMPLACEMENTS de `careerSlots.ts` (spécialisations) ;
 * les Caractéristiques, sans spec, par `inCareerChar`. Libellés longs → clé via CHAR_LABELS.
 */
export function inCareerChar(careerChars: CharKey[], char: CharKey): boolean {
  return careerChars.includes(char);
}

/**
 * Type d'une bande du Tableau de Coût des Augmentations (LDB 07 l.56-70).
 * La bande = nombre d'Augmentations DÉJÀ achetées, fourchette `{min, max}` aux bornes INCLUSIVES,
 * les DEUX telles que la source les imprime (« 0 à 5 », « 6 à 10 »…).
 * `max: null` = bande FINALE « 71 et + » : LDB 07 l.49 ne pose AUCUN plafond, la borne haute reste
 * donc OUVERTE en donnée (JSON n'a pas d'Infinity) et ne s'ouvre qu'au lookup.
 * La donnée vit dans `src/data/advancementCosts.json` — ne pas éditer ici.
 */
export interface AdvanceCostBand { min: number; max: number | null; coutCarac: number; coutCompetence: number }

const ADVANCE_COST_TABLE: AdvanceCostBand[] = advancementCostsJson as AdvanceCostBand[];

/** La table telle que `findTableEntry` la lit : la borne OUVERTE de la dernière bande devient son
 *  infini. Aucun plafond n'est écrit en donnée — c'est le lookup qui ouvre, pas la source, et il est
 *  le tronc commun des tables ouvertes (`tableOuverte`, `./tables`). */
const ADVANCE_COST_LOOKUP = tableOuverte(ADVANCE_COST_TABLE);

/** Coût en PX de la PROCHAINE Augmentation (la N+1ᵉ), `advancesAlready` = N déjà achetées.
 *  Hors carrière, le coût est DOUBLÉ (LDB 07 l.91). `discount` : « 5 PX de moins par
 *  Augmentation » des talents Maître artisan / Oreille absolue / etc. (LDB 10) quand la
 *  Compétence ajoutée est déjà incluse dans la Carrière — appliqué in-carrière seulement. */
export function advanceCost(advancesAlready: number, kind: 'characteristic' | 'skill', inCareer = true, discount = 0): number {
  const band = findTableEntry(ADVANCE_COST_LOOKUP, advancesAlready);
  const base = kind === 'characteristic' ? band.coutCarac : band.coutCompetence;
  return inCareer ? Math.max(1, base - discount) : base * 2;
}

/** Coût en PX de la prochaine Augmentation de Talent : 100 + 100 × (Augmentations déjà achetées)
 *  pour ce Talent (LDB 07 l.105). 1ʳᵉ = 100, 2ᵉ = 200, 3ᵉ = 300. */
export function talentCost(timesAlready: number): number {
  return 100 * (timesAlready + 1);
}

export interface AdvanceResult {
  ok: boolean;
  cost: number;
  reason?: string;
}

/** Achète UNE Augmentation de Caractéristique (+1 à la valeur, +1 au compteur d'Augmentations) si
 *  les PX suffisent. Mute le héros. `inCareer` false → coût doublé (hors carrière). */
export function buyCharAdvance(hero: Combatant, char: CharKey, inCareer = true): AdvanceResult {
  const already = hero.charAdvances?.[char] ?? 0;
  const cost = advanceCost(already, 'characteristic', inCareer);
  if ((hero.xp ?? 0) < cost) return { ok: false, cost, reason: t('adv.notEnoughXp') };
  hero.xp = (hero.xp ?? 0) - cost;
  hero.charAdvances = { ...(hero.charAdvances ?? {}), [char]: already + 1 };
  hero.characteristics[char] += 1; // chaque Augmentation ajoute +1 (LDB 07 l.47)
  return { ok: true, cost };
}

/** Achète UNE Augmentation pour une Compétence DÉJÀ connue — identité (name, spec) : chaque
 *  Spécialisation est une Compétence distincte (LDB 09 l.42). */
export function buySkillAdvance(hero: Combatant, skillId: string, spec: string | undefined, inCareer = true, discount = 0): AdvanceResult {
  const skill = hero.skills.find((s) => s.id === skillId && (s.spec ?? '') === (spec ?? ''));
  if (!skill) return { ok: false, cost: 0, reason: t('adv.unknownSkill') };
  const cost = advanceCost(skill.advances, 'skill', inCareer, discount);
  if ((hero.xp ?? 0) < cost) return { ok: false, cost, reason: t('adv.notEnoughXp') };
  hero.xp = (hero.xp ?? 0) - cost;
  skill.advances += 1; // chaque Augmentation ajoute +1 au niveau de Compétence (LDB 07 l.80)
  return { ok: true, cost };
}

/** Achète UNE Augmentation de Talent (le crée à `times` 1 s'il est absent, sinon +1) si les PX
 *  suffisent. Identité STABLE par `talentId` + `spec` (déjà résolus par l'appelant ; jamais un
 *  libellé). Les Talents hors carrière ne sont pas achetables (LDB 07 l.93) et le Maxi doit être respecté
 *  (LDB 10 l.18) : le hors-carrière est vérifié par l'appelant, le Maxi par `acquerirTalent`. */
export function buyTalent(hero: Combatant, talentId: string, spec?: string): AdvanceResult {
  const already = hero.talents.find((t) => t.talentId === talentId && (t.spec ?? '') === (spec ?? ''))?.times ?? 0;
  const cost = talentCost(already);
  if ((hero.xp ?? 0) < cost) return { ok: false, cost, reason: t('adv.notEnoughXp') };
  if (!acquerirTalent(hero, { id: talentId, spec })) return { ok: false, cost, reason: t('adv.talentMax') };
  hero.xp = (hero.xp ?? 0) - cost;
  return { ok: true, cost };
}

// ── Changer de Carrière (LDB 07 l.111-140) ──

/** Nombre d'Augmentations requis pour COMPLÉTER un Niveau de Carrière (LDB 07 l.126-131 :
 *  Niveau 1→5, 2→10, 3→15, 4→20). Le LDB de base ne tabule que jusqu'au Niveau 4. */
export function careerCompletionAdvances(level: number): number {
  return 5 * level;
}

/** Référence `(id, spec)` couverte par un slot : l'option UNIQUE d'un slot EXPLICITE, ou — pour un
 *  slot À CHOIX — la désignation du héros (clé `refKey` décodée par `parseRefKey`, JAMAIS un
 *  libellé re-parsé). null = rien ne couvre ce slot (pas encore désigné, ou tirage aléatoire sans
 *  identité réelle). */
function slotRef(slot: CareerSlot, designations: Record<string, string>): { id: string; spec?: string } | null {
  if (!slot.needsChoice) {
    const o = slot.options[0];
    return o.optionId ? { id: o.optionId, spec: o.spec } : null;
  }
  const key = designations[slot.key];
  return key ? parseRefKey(key) : null;
}

/**
 * Un Niveau de Carrière est complété si (LDB 07 l.124) : toutes les CARACTÉRISTIQUES DE LA CARRIÈRE
 * disponibles (cumul des niveaux ≤ courant, LDB 07 l.41-43) ont ≥ req Augmentations, AU MOINS 8 des
 * Compétences disponibles (cumul, LDB 07 l.76) ont ≥ req Augmentations, et le héros possède au moins
 * 1 Talent du Niveau COURANT. Un emplacement « (Au choix) » compte via sa spec DÉSIGNÉE
 * (un slot non désigné n'est pas tenu) — chaque libellé concret ne valide qu'un slot, garanti
 * par l'unicité des désignations (cf. careerSlots.designateSlot).
 */
export function isCareerLevelComplete(
  hero: Combatant,
  level: number,
  opts: {
    /** Slots de Compétences des niveaux ≤ courant (careerSlots.skillSlots). */
    skillSlots: CareerSlot[];
    /** Slots de Talents du niveau courant (careerSlots.talentSlots). */
    talentSlots: CareerSlot[];
    /** Caractéristiques de carrière disponibles, clés `CharKey` (careerSlots.availableChars). */
    careerChars: CharKey[];
    /** Désignations du héros pour SA carrière (careerSlots.designationsFor). */
    designations: Record<string, string>;
  },
): boolean {
  const req = careerCompletionAdvances(level);
  const charKeys = opts.careerChars; // déjà des CharKey
  if (!charKeys.length || !charKeys.every((k) => (hero.charAdvances?.[k] ?? 0) >= req)) return false;

  let held = 0;
  for (const slot of opts.skillSlots) {
    const ref = slotRef(slot, opts.designations);
    if (!ref) continue;
    const adv = hero.skills.find((s) => s.id === ref.id && (s.spec ?? '') === (ref.spec ?? ''))?.advances ?? 0;
    if (adv >= req) held += 1;
  }
  if (held < 8) return false;

  return opts.talentSlots.some((slot) => {
    const ref = slotRef(slot, opts.designations);
    if (!ref) return false;
    return hero.talents.some((t) => t.talentId === ref.id && (t.spec ?? '') === (ref.spec ?? '') && t.times > 0);
  });
}

/** Coût en PX d'un changement de Carrière : 100 si le Niveau actuel est COMPLÉTÉ, 200 sinon (LDB 07 l.118). */
export function careerChangeCost(completed: boolean): number {
  return completed ? 100 : 200;
}

export interface CareerChangeContext {
  /** Le Niveau de Carrière COURANT est-il complété (cf. isCareerLevelComplete) ? */
  completed: boolean;
  /** La Carrière cible est-elle de la MÊME Classe que l'actuelle (LDB 07 l.144 : sinon +100 PX) ? */
  sameClass: boolean;
  /** Le Niveau cible existe-t-il dans les données de la Carrière cible ? */
  targetLevelExists: boolean;
  /** Option MJ (LDB 07 l.140 + l.148, « Avec l'accord du MJ ») : autoriser un SAUT de Niveau (même
   *  Carrière, Niveau supérieur non-adjacent) ET l'accès au MÊME Niveau d'une autre Carrière de la
   *  Classe. Piloté par la règle optionnelle `advancement-career-jump` côté state ; false = RAW strict. */
  gmJump?: boolean;
}

/**
 * Valide et chiffre un changement de Carrière (LDB 07 l.135-148) :
 *  - même Carrière : Niveau SUIVANT (exige la complétion, l.137) ou n'importe quel Niveau INFÉRIEUR
 *    (l.137) ; un SAUT vers un Niveau supérieur non-adjacent n'est permis qu'avec l'accord du MJ
 *    (l.140, `gmJump`) ;
 *  - autre Carrière : 1er Niveau (l.144 ; +100 PX si la Classe diffère) OU, avec l'accord du MJ et le
 *    Niveau courant complété, le MÊME Niveau d'une autre Carrière de la MÊME Classe (l.148, `gmJump`).
 *  Coût de base : 100 PX si complété, 200 sinon (l.118).
 */
export function validateCareerChange(
  hero: Combatant,
  newCareer: string,
  newLevel: number,
  ctx: CareerChangeContext,
): { ok: boolean; cost: number; reason?: string } {
  const base = careerChangeCost(ctx.completed);
  if (!ctx.targetLevelExists) return { ok: false, cost: base, reason: t('adv.unknownLevel') };
  const cur = hero.careerLevel ?? 1;
  if (newCareer === (hero.career ?? '')) {
    if (newLevel === cur) return { ok: false, cost: base, reason: t('adv.sameLevel') };
    if (newLevel < cur) return { ok: true, cost: base };
    if (newLevel === cur + 1) {
      if (!ctx.completed) return { ok: false, cost: base, reason: t('adv.levelNotCompleted') };
      return { ok: true, cost: base };
    }
    // Niveau supérieur non-adjacent : saut réservé au MJ (l.140), coût 100/200 comme un changement normal.
    if (ctx.gmJump) return { ok: true, cost: base };
    return { ok: false, cost: base, reason: t('adv.jumpNeedsGm') };
  }
  if (newLevel === 1) return { ok: true, cost: base + (ctx.sameClass ? 0 : 100) };
  // MÊME Niveau d'une autre Carrière de la Classe (l.148) : exige l'accord du MJ, la complétion et la
  // même Classe ; coût 100 PX (base complété).
  if (ctx.gmJump && ctx.sameClass && ctx.completed && newLevel === cur) return { ok: true, cost: base };
  return { ok: false, cost: base, reason: t('adv.newCareerFirstLevel') };
}

/**
 * Mentor requis (LDB 07 l.89 : « le MJ peut exiger que vous trouviez un mentor qui puisse vous
 * enseigner cette formation inhabituelle ») : une Augmentation HORS carrière (dont le coût est déjà
 * DOUBLÉ) est BLOQUÉE tant qu'aucun mentor n'est disponible, quand la règle optionnelle est active.
 * `policyOn` = règle `advancement-mentor` ; `hasMentor` = flag de groupe/scène. Renvoie vrai = bloqué.
 */
export function mentorBlocks(inCareer: boolean, policyOn: boolean, hasMentor: boolean): boolean {
  return !inCareer && policyOn && !hasMentor;
}

/** Change de Carrière/Niveau si la cible est valide et les PX suffisent (mute le héros).
 *  Validation + coût par `validateCareerChange` ; les désignations d'emplacements de l'ANCIENNE
 *  carrière sont conservées (elles sont par carrière — un retour les retrouve). */
export function changeCareer(hero: Combatant, newCareer: string, newLevel: number, ctx: CareerChangeContext): AdvanceResult {
  const v = validateCareerChange(hero, newCareer, newLevel, ctx);
  if (!v.ok) return { ok: false, cost: v.cost, reason: v.reason };
  if ((hero.xp ?? 0) < v.cost) return { ok: false, cost: v.cost, reason: t('adv.notEnoughXp') };
  hero.xp = (hero.xp ?? 0) - v.cost;
  // « N'a jamais appartenu » (AA 12 l.5) : la Carrière QUITTÉE (et la nouvelle) rejoignent l'historique
  // CUMULÉ, jamais purgé — `everBelongedClasses` (`engine/activities.ts`).
  const history = hero.careerHistory ? [...hero.careerHistory] : (hero.career ? [hero.career] : []);
  if (hero.career && !history.includes(hero.career)) history.push(hero.career);
  if (!history.includes(newCareer)) history.push(newCareer);
  hero.careerHistory = history;
  hero.career = newCareer;
  hero.careerLevel = newLevel;
  return { ok: true, cost: v.cost };
}

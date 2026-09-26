/**
 * Vue d'avancement (couche store/UI) — agrège le héros + `careerLevels.json` en une structure
 * prête à rendre. PURE et testée : pas d'état, pas d'effet de bord. Les coûts et la détection
 * in-carrière viennent du moteur (`engine/advancement.ts` + `engine/careerSlots.ts`, verbatim
 * LDB 07/09/10) ; ici on ne fait que router les listes des Niveaux de Carrière.
 *
 * Disponibilité (LDB 07) : Caractéristiques et Compétences CUMULATIVES sur les niveaux ≤
 * courant (l.43/76), Talents du niveau courant uniquement (l.103). Les emplacements
 * « (Au choix) » suivent le modèle de désignation de careerSlots (identité (id, spec)).
 */
import { Combatant, CharKey, CHAR_KEYS, CHAR_LABELS } from '../engine/types';
import {
  advanceCost,
  talentCost,
  isCareerLevelComplete,
  careerChangeCost,
  inCareerChar,
  validateCareerChange,
} from '../engine/advancement';
import {
  skillSlots,
  talentSlots,
  availableChars,
  designationsFor,
  takenRefs,
  refKey,
  parseRefKey,
  talentMaxReached,
  wildcardSpecs,
} from '../engine/careerSlots';
import { competenceEnCarriere, talentsAjoutesALaCarriere, baseWithTalents } from '../engine/talentEffects';
import { rule } from '../engine/policy';
import { levelsForCareer, byId, findCareerById, refLabel, specLabel, displayLabelForSex } from '../data';

export interface CharAdvanceRow {
  key: CharKey;
  label: string;
  value: number;
  advances: number;
  inCareer: boolean;
  nextCost: number;
}
export interface SkillAdvanceRow {
  /** `id` STABLE de la Compétence — câblage (achat/désignation). */
  skillId: string;
  /** Libellé D'AFFICHAGE seulement. */
  label: string;
  spec?: string;
  characteristic: CharKey;
  advances: number;
  /** Le héros possède-t-il déjà la Compétence (sinon : acquérable à 0 si in-carrière). */
  known: boolean;
  inCareer: boolean;
  nextCost: number;
}
/** Emplacement de Compétence « (Au choix) » non désigné : à apprendre/désigner via un choix de spec. */
export interface SkillSlotRow {
  slotKey: string;
  entry: string;
  /** Libellé D'AFFICHAGE du groupe (« Corps à corps »). */
  group: string;
  /** `id` STABLE du groupe — câblage (achat/désignation). */
  groupId: string;
  characteristic: CharKey;
  /** Specs proposées (liste restreinte du slot ou specs de skills.json — VALEUR opaque : id de
   *  Groupe d'arme ou texte FR selon le domaine), specs déjà prises exclues. `display` = texte
   *  montré (résolu via `specLabel`, jamais l'id brut). */
  options: { spec: string; display: string; ownedAdvances: number }[];
  /** Coût d'une 1re Augmentation (spec non possédée) — une spec possédée se désigne à 0 PX. */
  nextCost: number;
}
export interface TalentSlotRow {
  slotKey: string;
  entry: string;
  /** `id` STABLE du Talent si l'entrée est explicite ou le slot désigné — câblage. */
  talentId?: string;
  spec?: string;
  /** Libellé D'AFFICHAGE seulement (résolu via `refLabel`). */
  label?: string;
  times: number;
  nextCost: number;
  maxReached: boolean;
  /** Slot à choix non désigné : options proposées — `refKey` = clé de câblage OPAQUE id+spec (produite
   *  par `careerSlots.refKey`, jamais un libellé), `display` = texte montré (résolu via `refLabel`). */
  options?: { refKey: string; display: string; owned: boolean }[];
}
export interface CareerTarget {
  career: string;
  level: number;
  label: string;
  cost: number;
  ok: boolean;
  reason?: string;
}
export interface AdvancementView {
  xp: number;
  career: string;
  careerLevel: number;
  levelLabel: string;
  status: string;
  completed: boolean;
  changeCost: number;
  chars: CharAdvanceRow[];
  skills: SkillAdvanceRow[];
  skillSlotsOpen: SkillSlotRow[];
  talents: TalentSlotRow[];
  targets: CareerTarget[];
  /** Coût d'un changement vers une carrière donnée (id, sélecteur) : +100 hors Classe (LDB 07 l.144). */
  changeCostFor: (careerId: string) => number;
}

export function buildAdvancementView(hero: Combatant): AdvancementView {
  const career = hero.career ?? '';
  const careerLevel = hero.careerLevel ?? 1;
  const levels = levelsForCareer(career);
  const cur = levels.find((l) => l.level === careerLevel);
  const sSlots = skillSlots(levels, careerLevel); // cumul niveaux ≤ courant (LDB 07 l.76)
  const tSlots = talentSlots(levels, careerLevel); // niveau courant seul (l.103)
  const careerChars = availableChars(levels, careerLevel); // cumul (l.43)
  const designations = designationsFor(hero, career);

  const chars: CharAdvanceRow[] = CHAR_KEYS.map((key) => {
    const advances = hero.charAdvances?.[key] ?? 0;
    const inCareer = inCareerChar(careerChars, key);
    return { key, label: CHAR_LABELS[key], value: baseWithTalents(hero, key), advances, inCareer, nextCost: advanceCost(advances, 'characteristic', inCareer) };
  });

  // Compétences connues — identité (skillId, spec) : chaque Spécialisation est une Compétence
  // distincte (LDB 09 l.42). In-carrière = slot explicite / désigné / joker libre, OU
  // compétence ajoutée par un talent (« à n'importe quelle Carrière », LDB 10).
  const skills: SkillAdvanceRow[] = hero.skills.map((s) => {
    const sName = byId('skill', s.id)?.label ?? s.id; // AFFICHAGE seulement
    const { statut, remise: discount } = competenceEnCarriere(hero, sSlots, designations, s.id, s.spec);
    const inCareer = statut != null;
    return {
      skillId: s.id,
      label: sName,
      spec: s.spec,
      characteristic: s.characteristic,
      advances: s.advances,
      known: true,
      inCareer,
      nextCost: advanceCost(s.advances, 'skill', inCareer, discount),
    };
  });
  // Entrées EXPLICITES de carrière pas encore connues → acquérables à advances 0.
  const knows = (skillId: string, spec?: string) => hero.skills.some((s) => s.id === skillId && (s.spec ?? '') === (spec ?? ''));
  for (const slot of sSlots) {
    if (slot.needsChoice) continue;
    const o = slot.options[0];
    if (!o.optionId) continue; // tirage aléatoire sans identité réelle : jamais acquérable ainsi
    if (knows(o.optionId, o.spec)) continue;
    if (skills.some((r) => !r.known && r.skillId === o.optionId && (r.spec ?? '') === (o.spec ?? ''))) continue;
    const characteristic = byId('skill', o.optionId)?.characteristic ?? 'intelligence';
    skills.push({ skillId: o.optionId, label: o.label, spec: o.spec, characteristic, advances: 0, known: false, inCareer: true, nextCost: advanceCost(0, 'skill', true) });
  }
  // Emplacements de Compétence « (Au choix) » non désignés → choix de spec (désigner/apprendre).
  const taken = takenRefs([...sSlots, ...tSlots], designations);
  const skillSlotsOpen: SkillSlotRow[] = [];
  for (const slot of sSlots) {
    if (!slot.needsChoice || designations[slot.key]) continue;
    const o = slot.options[0];
    if (!o.optionId) continue; // garde défensive (un joker a toujours un optionId en pratique)
    const options = wildcardSpecs(o, 'skill')
      .filter((spec) => !taken.has(refKey(o.optionId!, spec)))
      .map((spec) => ({
        spec,
        display: specLabel('skills', o.optionId!, spec),
        ownedAdvances: hero.skills.find((s) => s.id === o.optionId && (s.spec ?? '') === spec)?.advances ?? 0,
      }));
    const characteristic = byId('skill', o.optionId)?.characteristic ?? 'intelligence';
    skillSlotsOpen.push({ slotKey: slot.key, entry: slot.entry, group: o.label, groupId: o.optionId, characteristic, options, nextCost: advanceCost(0, 'skill', true) });
  }

  // Talents : un rang par EMPLACEMENT du niveau courant (LDB 07 l.103).
  const talents: TalentSlotRow[] = tSlots.map((slot) => {
    let ref: { id: string; spec?: string } | null;
    if (slot.needsChoice) {
      const key = designations[slot.key];
      ref = key ? parseRefKey(key) : null;
    } else {
      const o = slot.options[0];
      ref = o.optionId ? { id: o.optionId, spec: o.spec } : null;
    }
    if (ref) {
      // Match de l'entité possédée par id+spec — le libellé (`refLabel`) reste l'AFFICHAGE seul.
      const label = refLabel('talents', ref);
      const times = hero.talents.find((t) => t.talentId === ref!.id && (t.spec ?? '') === (ref!.spec ?? ''))?.times ?? 0;
      return { slotKey: slot.key, entry: slot.entry, talentId: ref.id, spec: ref.spec, label, times, nextCost: talentCost(times), maxReached: talentMaxReached(hero, ref.id, ref.spec) };
    }
    // Slot à choix non désigné : proposer les options concrètes non prises par la carrière.
    const options: { refKey: string; display: string; owned: boolean }[] = [];
    for (const o of slot.options) {
      if (!o.optionId) continue;
      const pool: (string | undefined)[] = o.wildcard ? wildcardSpecs(o, 'talent') : [o.spec];
      for (const spec of pool) {
        const rk = refKey(o.optionId, spec);
        if (taken.has(rk)) continue;
        options.push({
          refKey: rk,
          display: refLabel('talents', { id: o.optionId, spec }),
          owned: (hero.talents.find((t) => t.talentId === o.optionId && (t.spec ?? '') === (spec ?? ''))?.times ?? 0) > 0,
        });
      }
    }
    return { slotKey: slot.key, entry: slot.entry, times: 0, nextCost: talentCost(0), maxReached: false, options };
  });
  // Talents AJOUTÉS à la carrière (`talentsAjoutesALaCarriere`, la définition que lit l'achat) : apprenables
  // en carrière même hors emplacement de niveau. Dédupe contre les slots déjà projetés (par id+spec).
  for (const add of talentsAjoutesALaCarriere(hero)) {
    const rk = refKey(add.id, add.spec);
    if (talents.some((r) => (r.talentId === add.id && (r.spec ?? '') === (add.spec ?? '')) || r.options?.some((o) => o.refKey === rk))) continue;
    const label = refLabel('talents', add);
    const times = hero.talents.find((t) => t.talentId === add.id && (t.spec ?? '') === (add.spec ?? ''))?.times ?? 0;
    talents.push({ slotKey: `add:${rk}`, entry: label, talentId: add.id, spec: add.spec, label, times, nextCost: talentCost(times), maxReached: talentMaxReached(hero, add.id, add.spec) });
  }

  const completed = cur
    ? isCareerLevelComplete(hero, careerLevel, { skillSlots: sSlots, talentSlots: tSlots, careerChars, designations })
    : false;
  const changeCost = careerChangeCost(completed);

  // Cibles de progression (LDB 07 l.137) : Niveau suivant (exige la complétion) + Niveaux inférieurs.
  // Avec l'option MJ « Sauts de Niveau » (l.140), les Niveaux supérieurs non-adjacents apparaissent aussi.
  const gmJump = rule('advancement-career-jump') === true;
  const targets: CareerTarget[] = [];
  for (const l of levels) {
    if (l.level === careerLevel) continue;
    if (!gmJump && l.level > careerLevel + 1) continue; // pas de saut de niveau sans l'accord du MJ
    const v = validateCareerChange(hero, career, l.level, { completed, sameClass: true, targetLevelExists: true, gmJump });
    targets.push({ career, level: l.level, label: l.label, cost: v.cost, ok: v.ok, reason: v.reason });
  }

  const curClass = findCareerById(career)?.class;
  const changeCostFor = (careerId: string) =>
    changeCost + (findCareerById(careerId)?.class === curClass ? 0 : 100); // LDB 07 l.144

  return {
    xp: hero.xp ?? 0,
    career,
    careerLevel,
    levelLabel: cur ? displayLabelForSex(hero.appearance?.sex, cur.label, cur.labelF) : career,
    status: cur?.status ?? '',
    completed,
    changeCost,
    chars,
    skills,
    skillSlotsOpen,
    talents,
    targets,
    changeCostFor,
  };
}

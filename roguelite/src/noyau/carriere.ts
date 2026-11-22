/**
 * La carrière : ce que le niveau offre, les Talents qui agissent en combat, les sorts et miracles.
 */
import { advanceCost, isCareerLevelComplete, careerChangeCost, talentCost } from '../../../src/engine/advancement';
import { availableChars, skillSlots, talentSlots, designationsFor, parseRefKey } from '../../../src/engine/careerSlots';
import { effectiveChar } from '../../../src/engine/characteristics';
import { testValue } from '../../../src/engine/skills';
import { byId, findSpellById, findTalentById, levelsForCareer, refLabel } from '../../../src/data';
import type { Combatant, CharKey } from '../../../src/engine/types';
import { libelleDeCarac } from './heros';


export interface OffreDeCarac { id: CharKey; label: string; valeur: number; augmentations: number; cout: number }
/** `carac` : l'abréviation de sa Caractéristique ; `valeur` : la valeur que son Test vise (`testValue`). */
export interface OffreDeCompetence { ref: { id: string; spec?: string }; label: string; augmentations: number; cout: number; carac: string; valeur: number }
/** `aSpecifier` : le Talent attend une spécialisation que la carrière laisse au choix (un domaine, un dieu). */
export interface OffreDeTalent { ref: { id: string; spec?: string }; label: string; possede: number; cout: number; aSpecifier?: boolean }
export interface Progression {
  niveau: number; titre: string; requis: number; complet: boolean; suivant: { niveau: number; titre: string; cout: number } | null;
  caracs: OffreDeCarac[]; competences: OffreDeCompetence[]; talents: OffreDeTalent[];
}

/** Les offres du niveau de carrière du héros : Caractéristiques et Compétences de carrière (cumul des niveaux
 *  atteints), Talents du niveau courant, et le niveau suivant. LDB 07 l.41-43, l.76, l.103, l.118-131 */
export function progression(c: Combatant): Progression {
  const carriere = c.career ?? '';
  const niveaux = levelsForCareer(carriere);
  const niveau = c.careerLevel ?? 1;
  const chars = availableChars(niveaux, niveau);
  const sSlots = skillSlots(niveaux, niveau);
  const tSlots = talentSlots(niveaux, niveau);
  const designations = designationsFor(c, carriere);
  const complet = isCareerLevelComplete(c, niveau, { skillSlots: sSlots, talentSlots: tSlots, careerChars: chars, designations });
  const refs = (slots: typeof sSlots) => slots.flatMap((sl) => {
    const designee = designations[sl.key];
    if (designee) { const r = parseRefKey(designee); return [{ id: r.id, ...(r.spec ? { spec: r.spec } : {}) }]; }
    return sl.options.filter((o) => o.optionId).map((o) => ({ id: o.optionId!, ...(o.spec ? { spec: o.spec } : {}), ...(sl.needsChoice && !o.spec ? { aSpecifier: true } : {}) }));
  });
  const prochain = niveaux.find((l) => l.level === niveau + 1);
  return {
    niveau, titre: niveaux.find((l) => l.level === niveau)?.label ?? carriere, requis: 5 * niveau, complet,
    suivant: prochain ? { niveau: prochain.level, titre: prochain.label, cout: careerChangeCost(complet) } : null,
    caracs: [...new Set(chars)].map((k) => ({ id: k, label: libelleDeCarac(k).label, valeur: effectiveChar(c, k), augmentations: c.charAdvances?.[k] ?? 0, cout: advanceCost(c.charAdvances?.[k] ?? 0, 'caracteristique', true) })),
    competences: refs(sSlots).filter((r) => !r.aSpecifier).map(({ aSpecifier: _a, ...ref }) => {
      const adv = c.skills.find((x) => x.id === ref.id && (x.spec ?? '') === (ref.spec ?? ''))?.advances ?? 0;
      const k = byId('skill', ref.id)?.characteristic as CharKey | undefined;
      return { ref, label: refLabel('skills', ref), augmentations: adv, cout: advanceCost(adv, 'competence', true), carac: k ? libelleDeCarac(k).abr : '', valeur: testValue(c, { skill: ref }) };
    }),
    talents: refs(tSlots).map(({ aSpecifier, ...ref }) => {
      const fois = c.talents.filter((t) => t.talentId === ref.id && (aSpecifier || (t.spec ?? '') === (ref.spec ?? ''))).reduce((n, t) => n + t.times, 0);
      return { ref, label: refLabel('talents', ref), possede: fois, cout: talentCost(fois), ...(aSpecifier ? { aSpecifier } : {}) };
    }),
  };
}

/** Les Compétences qu'un combat automatique teste. */
const COMPETENCES_DU_COMBAT = new Set(['corps-a-corps', 'projectiles', 'esquive', 'calme', 'resistance', 'focalisation', 'priere', 'athletisme', 'intimidation']);
/** Le Talent agit-il dans un combat automatique : effet de combat, passif, effets, trait conféré, domaine ou voie de
 *  lanceur, ou bonus non manuel à un Test qu'un combat lance (`talents.json`) ? */
export function talentDeCombat(id: string): boolean {
  const t = findTalentById(id);
  if (!t) return false;
  if (t.combat || t.passive || t.effects || t.confereTrait || t.grantsArcaneDomain) return true;
  return (t.test?.matches ?? []).some((m) => !('manual' in m && m.manual) && 'skill' in m && !!m.skill && COMPETENCES_DU_COMBAT.has(m.skill.id));
}

/** Les Talents que porte le héros : id, libellé, nombre de fois, et s'il agit en combat automatique (`talentDeCombat`). */
export const talentsAcquis = (c: Combatant): { id: string; label: string; fois: number; combat: boolean }[] =>
  c.talents.map((t) => ({ id: t.talentId, label: refLabel('talents', { id: t.talentId, ...(t.spec ? { spec: t.spec } : {}) }), fois: t.times, combat: talentDeCombat(t.talentId) }));

/** Ce que le livre dit d'un Talent (`talents.json`) : son texte, verbatim. */
export const texteDuTalent = (id: string): string => findTalentById(id)?.desc ?? '';

/** Ce que le livre dit d'un sort ou d'une prière (`spells.json`) : sa nature (école, dieu, NI) et son texte, verbatim. */
export function ficheDuSort(id: string): { label: string; nature: string; texte: string } {
  const s = findSpellById(id);
  const nature = s ? [`${s.ecole}${s.subType ? ` (${s.subType})` : ''}`, s.cn != null ? `NI ${s.cn}` : ''].filter(Boolean).join(' · ') : '';
  return { label: s?.label ?? id, nature, texte: s?.desc ?? '' };
}

/** Libellé d'un sort ou d'un miracle (`spells.json`). */
export const nomDeSort = (id: string): string => findSpellById(id)?.label ?? id;

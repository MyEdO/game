/**
 * La carrière : ce que le niveau offre, les Talents qui agissent en combat, les sorts et miracles.
 */
import { advanceCost, isCareerLevelComplete, careerChangeCost, talentCost } from '../../../src/engine/advancement';
import { talentMaxReached } from '../../../src/engine/acquisitionTalents';
import { spellCost, talentOuvre } from '../../../src/engine/grimoire';
import { spellSupportOf } from '../../../src/engine/spellspec';
import { castingKindOf } from '../../../src/engine/combatFeatures/dispatch';
import { emplacementsDeDotation, resolveTrappingChoices, valeursDeLEmplacement, type ChoixDeDotation } from '../../../src/engine/trappingChoices';
import { doterLePorteur } from '../../../src/engine/bourse';
import { fabriqueLocale } from '../../../src/engine/fabriqueDId';
import { makeRNG } from '../../../src/engine/dice';
import { availableChars, skillSlots, talentSlots, designationsFor, parseRefKey } from '../../../src/engine/careerSlots';
import { effectiveChar } from '../../../src/engine/characteristics';
import { testValue } from '../../../src/engine/skills';
import { competenceEnCarriere } from '../../../src/engine/talentEffects';
import { byId, findSpellById, findTalentById, levelsForCareer, refLabel, spells } from '../../../src/data';
import type { Combatant, CharKey, ItemInstance } from '../../../src/engine/types';
import { libelleDeCarac } from './heros';
import { auHameau, type Geste } from './hameau';


export interface OffreDeCarac { id: CharKey; label: string; valeur: number; augmentations: number; cout: number }
/** `carac` : l'abréviation de sa Caractéristique ; `valeur` : la valeur que son Test vise (`testValue`) ; `remise` :
 *  ce que chaque Augmentation coûte en moins (`competenceEnCarriere`). LDB 10 l.745 */
export interface OffreDeCompetence { ref: { id: string; spec?: string }; label: string; augmentations: number; cout: number; remise: number; carac: string; valeur: number }
/** `aSpecifier` : le Talent attend une spécialisation que la carrière laisse au choix (un domaine, un dieu) ;
 *  `auMaxi` : il ne se prend plus. LDB 10 */
export interface OffreDeTalent { ref: { id: string; spec?: string }; label: string; possede: number; cout: number; auMaxi: boolean; aSpecifier?: boolean }
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
    suivant: prochain ? { niveau: prochain.level, titre: prochain.label, cout: careerChangeCost(true) } : null,
    caracs: [...new Set(chars)].map((k) => ({ id: k, label: libelleDeCarac(k).label, valeur: effectiveChar(c, k), augmentations: c.charAdvances?.[k] ?? 0, cout: advanceCost(c.charAdvances?.[k] ?? 0, 'caracteristique', true) })),
    competences: refs(sSlots).filter((r) => !r.aSpecifier).map(({ aSpecifier: _a, ...ref }) => {
      const adv = c.skills.find((x) => x.id === ref.id && (x.spec ?? '') === (ref.spec ?? ''))?.advances ?? 0;
      const k = byId('skill', ref.id)?.characteristic as CharKey | undefined;
      const { remise } = competenceEnCarriere(c, sSlots, designations, ref.id, ref.spec);
      return { ref, label: refLabel('skills', ref), augmentations: adv, cout: advanceCost(adv, 'competence', true, remise), remise, carac: k ? libelleDeCarac(k).abr : '', valeur: testValue(c, { skill: ref }) };
    }),
    talents: refs(tSlots).map(({ aSpecifier, ...ref }) => {
      const fois = c.talents.filter((t) => t.talentId === ref.id && (aSpecifier || (t.spec ?? '') === (ref.spec ?? ''))).reduce((n, t) => n + t.times, 0);
      return { ref, label: refLabel('talents', ref), possede: fois, cout: talentCost(fois), auMaxi: talentMaxReached(c, ref.id, ref.spec), ...(aSpecifier ? { aSpecifier } : {}) };
    }),
  };
}

/** Ce que coûtent `n` Augmentations de carrière d'une Caractéristique ou d'une Compétence qui en compte `depuis`,
 *  `remise` déduite de chacune (`advanceCost`). */
export const coutDesAugmentations = (depuis: number, n: number, genre: 'caracteristique' | 'competence', remise = 0): number =>
  Array.from({ length: n }, (_, i) => advanceCost(depuis + i, genre, true, remise)).reduce((s, x) => s + x, 0);

/** Une étape d'un plan de niveau : l'achat, combien de fois, son libellé et ce qu'il coûte en tout. */
export type EtapeDuPlan = ({ genre: 'carac'; id: CharKey } | { genre: 'competence' | 'talent'; ref: { id: string; spec?: string } } | { genre: 'niveau' })
  & { label: string; fois: number; cout: number };

/** Les achats qui complètent les exigences du niveau `p`, dans l'ordre : chaque Caractéristique de carrière jusqu'à
 *  l'exigence, des Compétences de carrière jusqu'à en tenir 8 à l'exigence (les `preferee` d'abord, puis les plus
 *  avancées), le premier Talent de `p.talents` qui se prend si aucun n'est acquis, puis le niveau suivant.
 *  LDB 07 l.118-131 */
export function planDuNiveau(p: Progression, preferee: (ref: { id: string; spec?: string }) => boolean = () => false): EtapeDuPlan[] {
  const etapes: EtapeDuPlan[] = [];
  for (const k of p.caracs.filter((x) => x.augmentations < p.requis)) {
    const fois = p.requis - k.augmentations;
    etapes.push({ genre: 'carac', id: k.id, label: k.label, fois, cout: coutDesAugmentations(k.augmentations, fois, 'caracteristique') });
  }
  const tenues = p.competences.filter((k) => k.augmentations >= p.requis).length;
  const rang = (k: OffreDeCompetence) => (preferee(k.ref) ? 1 : 0);
  for (const k of p.competences.filter((x) => x.augmentations < p.requis).sort((x, y) => rang(y) - rang(x) || y.augmentations - x.augmentations).slice(0, Math.max(0, 8 - tenues))) {
    const fois = p.requis - k.augmentations;
    etapes.push({ genre: 'competence', ref: k.ref, label: k.label, fois, cout: coutDesAugmentations(k.augmentations, fois, 'competence', k.remise) });
  }
  const talent = p.talents.some((t) => t.possede > 0) ? undefined : p.talents.find((t) => !t.aSpecifier && !t.auMaxi);
  if (talent) etapes.push({ genre: 'talent', ref: talent.ref, label: talent.label, fois: 1, cout: talent.cout });
  if (p.suivant) etapes.push({ genre: 'niveau', label: p.suivant.titre, fois: 1, cout: p.suivant.cout });
  return etapes;
}

/** Les Compétences qu'un combat automatique teste. */
export const COMPETENCES_DU_COMBAT = new Set(['corps-a-corps', 'projectiles', 'esquive', 'calme', 'resistance', 'focalisation', 'priere', 'athletisme', 'intimidation']);
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

/** Libellé d'une Compétence, sa spécialisation comprise (`skills.json`). */
export const nomDeCompetence = (ref: { id: string; spec?: string }): string => refLabel('skills', ref);

/** Libellé d'un Talent, sa spécialisation comprise (`talents.json`). */
export const nomDeTalent = (ref: { id: string; spec?: string }): string => refLabel('talents', ref);

/** Ce que le livre dit d'un Talent (`talents.json`) : son texte, verbatim. */
export const texteDuTalent = (id: string): string => findTalentById(id)?.desc ?? '';

/** Ce que le livre dit d'un sort ou d'une prière (`spells.json`) : sa nature (école, dieu, NI) et son texte, verbatim. */
export function ficheDuSort(id: string): { label: string; nature: string; texte: string } {
  const s = findSpellById(id);
  const nature = s ? [`${s.ecole}${s.subType ? ` (${s.subType})` : ''}`, s.cn != null ? `NI ${s.cn}` : ''].filter(Boolean).join(' · ') : '';
  return { label: s?.label ?? id, nature, texte: s?.desc ?? '' };
}

/** Ce que le sort `id` coûte à `c` en PX, `null` s'il ne peut pas l'apprendre. */
export const prixDuSort = (c: Combatant, id: string): number | null => { const s = findSpellById(id); return s ? spellCost(c, s) : null; };

/** Libellé d'un sort ou d'un miracle (`spells.json`). */
export const nomDeSort = (id: string): string => findSpellById(id)?.label ?? id;

/** La recrue `c` portée au niveau `niveau` de sa carrière par les achats du noyau (`auHameau`) : à chaque niveau, ce
 *  qu'il exige pour être complété (`planDuNiveau`), puis le niveau suivant, payés des seuls PX que ces achats coûtent. LDB 07 l.118-131 */
export function porterAuNiveau(c: Combatant, niveau: number, graine: number): Combatant {
  let porte = c;
  while ((porte.careerLevel ?? 1) < niveau) {
    const p = progression(porte);
    const cible = p.niveau + 1;
    const plan = planDuNiveau(p);
    const gestes: Geste[] = plan.flatMap((x) => Array.from({ length: x.fois }, (): Geste => {
      if (x.genre === 'carac') return { verbe: 'acheterLaCaracteristique', args: [porte.id, x.id] };
      if (x.genre === 'niveau') return { verbe: 'changerDeCarriere', args: [porte.id, porte.career, cible] };
      return { verbe: x.genre === 'talent' ? 'acheterLeTalent' : 'acheterLaCompetence', args: [porte.id, x.ref] };
    }));
    const cout = plan.reduce((s, x) => s + x.cout, 0);
    const xp = porte.xp ?? 0;
    const [rendu] = auHameau([{ ...porte, xp: xp + cout }], gestes, graine++).groupe;
    if ((rendu.careerLevel ?? 1) !== cible || (rendu.xp ?? 0) !== xp) throw new Error(`porterAuNiveau : ${porte.career} ${cible} rendu au niveau ${rendu.careerLevel}, ${(rendu.xp ?? 0) - xp} PX d'écart`);
    porte = rendu;
  }
  return porte;
}

/** Les sorts ou miracles que le Talent `talent` spécialisé en `spec` ouvre (`talentOuvre`), du domaine ou culte `spec`
 *  ou des Arcanes communs à tous les domaines, et que le moteur joue (`spellSupportOf` mécanique ou partiel). LDB 47 l.309 */
export const sortsDeLaVoie = (talent: 'magie-des-arcanes' | 'invocation', spec: string): string[] => {
  const kind = castingKindOf(talent)!;
  return spells.filter((s) => talentOuvre({ kind, spec }, s) && (s.family !== 'arcane' || !s.domainId || s.domainId.id === spec) && spellSupportOf(s) !== 'narratif').map((s) => s.id);
};

/** Les objets que les niveaux 2 à `niveau` de la carrière de `c` dotent : la branche de chaque `{pick, of}` tirée à la
 *  graine `graine` ; un joker d'arme reste sans objet, comme à la création (`createHero`). LDB 07 */
export function dotationDesNiveaux(c: Combatant, niveau: number, graine: number): ItemInstance[] {
  const dotations = levelsForCareer(c.career ?? '').filter((l) => l.level > 1 && l.level <= niveau).flatMap((l) => l.trappings);
  if (!dotations.length) return [];
  const rng = makeRNG(graine);
  const choix: ChoixDeDotation = {};
  for (const e of emplacementsDeDotation(dotations)) {
    const valeurs = e.sorte === 'branches' ? valeursDeLEmplacement(e, c) : [];
    if (valeurs.length) choix[e.adresse] = valeurs[rng.int(0, valeurs.length - 1)];
  }
  return doterLePorteur(resolveTrappingChoices(dotations, choix), rng, fabriqueLocale(`n${graine}`)).items;
}

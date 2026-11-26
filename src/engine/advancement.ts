/**
 * Avancement par Points d'Expérience (PX), chiffré par le modèle de progression du héros (`modeleDe`).
 * LDB 07 l.35-109 ; CRB 045 ; CRB 048 l.45, l.72
 */
import { Combatant, CharKey } from './types';
import {
  CareerSlot,
  acquerirTalent,
  slotCovers,
  parseRefKey,
  talentAcquisitions,
  talentSlots,
  talentSlotsUpTo,
  type EmplacementsDuNiveau,
} from './careerSlots';
import advancementCostsJson from '../data/advancementCosts.json';
import type * as advancementCostsDef from '../data/schemas/defs/advancementCosts';
import { datasetDe } from '../data/datasets';
import { findTableEntryIndex, tableOuverte } from './tables';
import { memoParVersion } from '../data/versionDataset';
import { t } from '../i18n';
import { memeSpecialisation, type RefDesignee } from '../data/schemas/grammaire/ref';
import { cleDeProgression, modeleDe, type CleDeProgression } from './modeleDeProgression';
import { casesDuNiveau, cocherUnAchat } from './casesDeCarriere';

/** La Caractéristique `char` est-elle de la carrière (`careerChars`, cumul des niveaux ≤ courant) ? LDB 07 l.41-43,
 *  l.91 ; CRB 018 l.43 */
export function inCareerChar(careerChars: CharKey[], char: CharKey): boolean {
  return careerChars.includes(char);
}

/** « vos huit Compétences de départ » (LDB 05 l.535) ; « seules huit doivent être améliorées » d'un
 *  Niveau à dix Compétences (AA 02 l.134 ; VDM 03 l.37). LDB 07 l.124 */
export const CAREER_SKILLS_ADVANCED = 8;

const BANDES_DE_COUT = datasetDe<typeof advancementCostsDef>(advancementCostsJson);

/** Les tables de coût par modèle, telles que `findTableEntryIndex` les lit : la borne OUVERTE d'une dernière bande devient son infini
 *  (`tableOuverte`). Une table fermée n'a aucune bande au-delà de sa dernière. */
const tablesDeCout = memoParVersion('advancementCosts', () => {
  const tables: Record<CleDeProgression, ReturnType<typeof tableOuverte<(typeof BANDES_DE_COUT)[number]>>> = { '4e': [], '5e': [] };
  for (const b of tableOuverte(BANDES_DE_COUT)) tables[b.progression ?? '4e'].push(b);
  return tables;
});

/** Ce qu'une Augmentation augmente : une Caractéristique, ou une Compétence par sa référence (LDB 09 l.44). */
export type CibleDAugmentation = { kind: 'caracteristique'; char: CharKey } | { kind: 'competence'; competence: RefDesignee };

/** Points déjà ajoutés à la valeur de `cible` (0 pour une Compétence inconnue). */
function pointsDe(hero: Combatant, cible: CibleDAugmentation): number {
  if (cible.kind === 'caracteristique') return hero.charAdvances?.[cible.char] ?? 0;
  const { id, spec } = cible.competence;
  return hero.skills.find((s) => s.id === id && memeSpecialisation(s.spec, spec))?.advances ?? 0;
}

/** Nombre d'Augmentations déjà achetées pour `cible` : ses points divisés par le pas du modèle. LDB 07 l.45, l.78 ;
 *  CRB 045 l.15, l.25 */
export function augmentationsAchetees(hero: Combatant, cible: CibleDAugmentation): number {
  return Math.floor(pointsDe(hero, cible) / modeleDe(hero).pas);
}

/** Le prix de la prochaine Augmentation, ou la raison qui la ferme. */
export type Chiffrage = { ok: true; cout: number } | { ok: false; raison: string };

/** SEUL chiffrage public de la PROCHAINE Augmentation de `cible` pour `hero`, sur la table de son modèle. Hors carrière,
 *  le coût est multiplié par le coefficient du modèle ; `discount` : remise de Talent en carrière (LDB 10). Au-delà
 *  d'une table fermée, l'Augmentation est refusée. LDB 07 l.51-70, l.91 ; CRB 045 l.33-52 ; CRB 018 l.69 */
export function coutDeLAugmentation(hero: Combatant, cible: CibleDAugmentation, inCareer = true, discount = 0): Chiffrage {
  const m = modeleDe(hero);
  const deja = augmentationsAchetees(hero, cible);
  const table = tablesDeCout()[cleDeProgression(hero)];
  const i = findTableEntryIndex(table, deja);
  if (i < 0) return { ok: false, raison: t('adv.tableEpuisee') };
  const bande = table[i];
  const base = cible.kind === 'caracteristique' ? bande.coutCarac : bande.coutCompetence;
  return { ok: true, cout: inCareer ? Math.max(1, base - discount) : base * m.horsCarriere.coefficient };
}

/** Coût en PX de la prochaine prise du Talent (`talentId`, `spec`) par `hero` (`talentAcquisitions`). LDB 07 l.105,
 *  l.156 ; CRB 045 l.60 */
export function coutDuTalent(hero: Combatant, talentId: string, spec?: string): number {
  const { base, parPrise } = modeleDe(hero).coutDuTalent;
  return base + parPrise * talentAcquisitions(hero, talentId, spec);
}

const PORTEE_DES_TALENTS = { niveau: talentSlots, cumul: talentSlotsUpTo } as const;

/** Les emplacements de Talents de carrière que `hero` peut acheter au niveau `level` de `levels`. LDB 07 l.103 ;
 *  CRB 045 l.58 */
export function talentSlotsAchetables(hero: Combatant, levels: readonly EmplacementsDuNiveau[], level: number): CareerSlot[] {
  return PORTEE_DES_TALENTS[modeleDe(hero).porteeDesTalents](levels, level);
}

export interface AdvanceResult {
  ok: boolean;
  cost: number;
  reason?: string;
}

/** Paie et applique UNE Augmentation de `cible` si elle est chiffrée et les PX suffisent : `pas` points ajoutés à la
 *  valeur et au compteur, case cochée en carrière. Mute le héros. LDB 07 l.47, l.80 ; CRB 045 l.15, l.27, l.54 */
function acheterLAugmentation(hero: Combatant, cible: CibleDAugmentation, inCareer: boolean, discount: number, ajouter: (pas: number) => void): AdvanceResult {
  const c = coutDeLAugmentation(hero, cible, inCareer, discount);
  if (!c.ok) return { ok: false, cost: 0, reason: c.raison };
  const cost = c.cout;
  if ((hero.xp ?? 0) < cost) return { ok: false, cost, reason: t('adv.notEnoughXp') };
  hero.xp = (hero.xp ?? 0) - cost;
  ajouter(modeleDe(hero).pas);
  if (inCareer) cocherUnAchat(hero);
  return { ok: true, cost };
}

/** Achète UNE Augmentation de Caractéristique. Mute le héros. */
export function buyCharAdvance(hero: Combatant, char: CharKey, inCareer = true): AdvanceResult {
  return acheterLAugmentation(hero, { kind: 'caracteristique', char }, inCareer, 0, (pas) => {
    hero.charAdvances = { ...(hero.charAdvances ?? {}), [char]: (hero.charAdvances?.[char] ?? 0) + pas };
    hero.characteristics[char] += pas;
  });
}

/** Achète UNE Augmentation pour une Compétence DÉJÀ connue — identité : la référence. LDB 09 l.44 */
export function buySkillAdvance(hero: Combatant, ref: RefDesignee, inCareer = true, discount = 0): AdvanceResult {
  const skill = hero.skills.find((s) => s.id === ref.id && memeSpecialisation(s.spec, ref.spec));
  if (!skill) return { ok: false, cost: 0, reason: t('adv.unknownSkill') };
  return acheterLAugmentation(hero, { kind: 'competence', competence: ref }, inCareer, discount, (pas) => {
    skill.advances += pas;
  });
}

/** Achète UNE prise du Talent (`talentId`, `spec`), identité stable résolue par l'appelant, si les PX suffisent ; le
 *  hors-carrière est jugé par l'appelant, le Maxi par `acquerirTalent`. LDB 07 l.93, l.105 ; LDB 10 l.18 */
export function buyTalent(hero: Combatant, talentId: string, spec?: string): AdvanceResult {
  const cost = coutDuTalent(hero, talentId, spec);
  if ((hero.xp ?? 0) < cost) return { ok: false, cost, reason: t('adv.notEnoughXp') };
  if (!acquerirTalent(hero, { id: talentId, spec })) return { ok: false, cost, reason: t('adv.talentMax') };
  hero.xp = (hero.xp ?? 0) - cost;
  return { ok: true, cost };
}

// ── Changer de Carrière (LDB 07 l.111-140) ──

/** Nombre d'Augmentations requis pour COMPLÉTER le Niveau de Carrière `level`. LDB 07 l.126-131 */
export function careerCompletionAdvances(level: number): number {
  return 5 * level;
}

/** Référence `(id, spec)` couverte par un slot : l'option UNIQUE d'un slot EXPLICITE, ou — pour un
 *  slot À CHOIX ou « (Toutes) » — la désignation du héros (clé `refKey` décodée par `parseRefKey`, JAMAIS un
 *  libellé re-parsé). null = rien ne couvre ce slot (pas encore désigné, ou tirage aléatoire sans
 *  identité réelle). */
export function slotRef(slot: CareerSlot, designations: Record<string, string>): { id: string; spec?: string } | null {
  if (!slot.needsChoice && !slot.options[0].toutes) {
    const o = slot.options[0];
    return o.optionId ? { id: o.optionId, spec: o.spec } : null;
  }
  const key = designations[slot.key];
  return key ? parseRefKey(key) : null;
}

/** Le Niveau de Carrière `level` est-il complété : Caractéristiques de carrière disponibles, `CAREER_SKILLS_ADVANCED`
 *  Compétences disponibles (un emplacement « (Au choix) » par sa spec désignée) et un Talent du Niveau. LDB 07 l.124 */
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
    const tenues = hero.skills.filter((s) => tientLEmplacement(slot, opts.designations, s.id, s.spec));
    if (Math.max(0, ...tenues.map((s) => s.advances ?? 0)) >= req) held += 1;
  }
  if (held < CAREER_SKILLS_ADVANCED) return false;

  return tientUnTalentDuNiveau(hero, opts.talentSlots, opts.designations);
}

/** `hero` tient-il le Talent d'un des emplacements `talentSlots` (`slotRef`) ? LDB 07 l.124 */
export function tientUnTalentDuNiveau(hero: Pick<Combatant, 'talents'>, talentSlots: CareerSlot[], designations: Record<string, string>): boolean {
  return talentSlots.some((slot) => hero.talents.some((t) => t.times > 0 && tientLEmplacement(slot, designations, t.talentId, t.spec)));
}

/** L'entrée `(id, spec)` du héros tient-elle `slot` : sa référence (`slotRef`), ou pour un joker « (Toutes) » non
 *  désigné toute spécialisation qu'il couvre (`slotCovers`). CRB 018 l.107 */
function tientLEmplacement(slot: CareerSlot, designations: Record<string, string>, id: string, spec: string | undefined): boolean {
  const ref = slotRef(slot, designations);
  if (ref) return ref.id === id && memeSpecialisation(spec, ref.spec);
  return slot.options[0].toutes === true && slotCovers(slot, id, spec);
}

/** Options de `isCareerLevelComplete` : emplacements, Caractéristiques de carrière et désignations du héros. */
export type ContexteDeCompletion = Parameters<typeof isCareerLevelComplete>[2];

/** Le niveau `level` de la carrière courante de `hero` est-il validé pour passer au suivant, selon le critère de son
 *  modèle (`PassageDeNiveau`) ? LDB 07 l.124 ; CRB 048 l.45 */
export function niveauValide(hero: Combatant, level: number, opts: ContexteDeCompletion): boolean {
  const passage = modeleDe(hero).passage;
  switch (passage.type) {
    case 'completion': return isCareerLevelComplete(hero, level, opts);
    case 'cases': return level <= passage.seuils.length && casesDuNiveau(hero, hero.career ?? '', level) >= passage.seuils[level - 1];
  }
}

/** Coût en PX d'un changement de Carrière de `hero`, niveau courant validé ou non (`completed`), vers une carrière de
 *  la même Classe ou non. LDB 07 l.118, l.144 ; CRB 048 l.72 */
export function coutDuChangement(hero: Combatant, completed: boolean, sameClass = true): number {
  const c = modeleDe(hero).changement;
  return (completed ? c.complete : c.incomplet) + (sameClass ? 0 : c.autreClasse);
}

export interface CareerChangeContext {
  /** Le Niveau de Carrière COURANT est-il validé (`niveauValide`) ? */
  completed: boolean;
  /** La Carrière cible est-elle de la MÊME Classe que l'actuelle (LDB 07 l.144 : sinon +100 PX) ? */
  sameClass: boolean;
  /** Le Niveau cible existe-t-il dans les données de la Carrière cible ? */
  targetLevelExists: boolean;
  /** Règle optionnelle `progression-saut-de-niveau` applicable au héros (`regleDeProgression`). LDB 07 l.140, l.148 */
  gmJump?: boolean;
}

/** Valide et chiffre un changement de Carrière de `hero` vers (`newCareer`, `newLevel`) : même Carrière, Niveau
 *  suivant validé (coût du passage), Niveau inférieur si le modèle l'ouvre, saut sur règle optionnelle ; autre
 *  Carrière, 1er Niveau, ou le même Niveau de la Classe sur règle optionnelle. LDB 07 l.118, l.135-148 ; CRB 048 l.45,
 *  l.72 */
export function validateCareerChange(
  hero: Combatant,
  newCareer: string,
  newLevel: number,
  ctx: CareerChangeContext,
): { ok: boolean; cost: number; reason?: string } {
  const m = modeleDe(hero);
  const base = coutDuChangement(hero, ctx.completed);
  if (!ctx.targetLevelExists) return { ok: false, cost: base, reason: t('adv.unknownLevel') };
  const cur = hero.careerLevel ?? 1;
  if (newCareer === (hero.career ?? '')) {
    if (newLevel === cur) return { ok: false, cost: base, reason: t('adv.sameLevel') };
    if (newLevel < cur) return m.changement.descente ? { ok: true, cost: base } : { ok: false, cost: base, reason: t('adv.descenteFermee') };
    if (newLevel === cur + 1) {
      if (!ctx.completed) return { ok: false, cost: m.passage.cout, reason: t('adv.levelNotCompleted') };
      return { ok: true, cost: m.passage.cout };
    }
    if (ctx.gmJump) return { ok: true, cost: base };
    return { ok: false, cost: base, reason: t('adv.jumpNeedsGm') };
  }
  if (newLevel === 1) return { ok: true, cost: coutDuChangement(hero, ctx.completed, ctx.sameClass) };
  if (ctx.gmJump && ctx.sameClass && ctx.completed && newLevel === cur) return { ok: true, cost: base };
  return { ok: false, cost: base, reason: t('adv.newCareerFirstLevel') };
}

/** Une Augmentation hors carrière est-elle bloquée faute de mentor, la règle `progression-mentor` active ? LDB 07 l.89 */
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

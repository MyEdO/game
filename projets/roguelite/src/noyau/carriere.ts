/**
 * La carrière : ce que le niveau offre, les Talents qui agissent en combat, les sorts et miracles.
 */
import {
  buyCharAdvance,
  buySkillAdvance,
  buyTalent,
  CAREER_SKILLS_ADVANCED,
  careerCompletionAdvances,
  coutDeLAugmentation,
  coutDuChangement,
  coutDuTalent,
  niveauValide,
  talentSlotsAchetables,
  type Chiffrage,
  type ContexteDeCompletion,
} from '../../../../src/engine/advancement';
import { modeleDe } from '../../../../src/engine/modeleDeProgression';
import { casesDuNiveau } from '../../../../src/engine/casesDeCarriere';
import { talentMaxReached } from '../../../../src/engine/acquisitionTalents';
import { spellCost, talentOuvre } from '../../../../src/engine/grimoire';
import { spellSupportOf } from '../../../../src/engine/spellspec';
import { castingKindOf } from '../../../../src/engine/combatFeatures/dispatch';
import { emplacementsDeDotation, resolveTrappingChoices, valeursDeLEmplacement, type ChoixDeDotation } from '../../../../src/engine/trappingChoices';
import { doterLePorteur } from '../../../../src/engine/bourse';
import { fabriqueLocale } from '../../../../src/engine/fabriqueDId';
import { makeRNG } from '../../../../src/engine/dice';
import { availableChars, skillSlots, designationsFor, parseRefKey } from '../../../../src/engine/careerSlots';
import { bonusDe, effectiveChar, effectiveMaxWounds } from '../../../../src/engine/characteristics';
import { peutTenter, testValue } from '../../../../src/engine/skills';
import { weaponSkillId } from '../../../../src/engine/combat';
import { competenceEnCarriere } from '../../../../src/engine/talentEffects';
import { byId, characteristics, findSpellById, findTalentById, levelsForCareer, refLabel, spells } from '../../../../src/data';
import { CHAR_KEYS, type Combatant, type CharKey, type ItemInstance } from '../../../../src/engine/types';
import { memeSpecialisation } from '../../../../src/data/schemas/grammaire/ref';
import { auHameau, type Geste } from './hameau';
import { articleDuCatalogue, maniement } from './equipement';
import { chancesDeReussite } from './epreuve';


/** Abréviation et libellé d'une Caractéristique, tels que la donnée les porte (`characteristics.json`). */
export function libelleDeCarac(k: CharKey): { abr: string; label: string } {
  const d = characteristics.find((x) => x.id === k);
  return { abr: d?.abr ?? k, label: d?.label ?? k };
}

/** `points` : ce que ses Augmentations ont ajouté à la valeur (`charAdvances`) ; `cout` : le prix de la prochaine
 *  Augmentation (`coutDeLAugmentation`), `null` quand le noyau la refuse. */
export interface OffreDeCarac { id: CharKey; label: string; valeur: number; points: number; cout: number | null }
/** `points` : ce que ses Augmentations ont ajouté à la valeur (`advances`) ; `carac` : l'abréviation de sa
 *  Caractéristique ; `valeur` : la valeur que son Test vise (`testValue`) ; `remise` : ce que chaque Augmentation coûte
 *  en moins (`competenceEnCarriere`). LDB 10 l.745 */
export interface OffreDeCompetence { ref: { id: string; spec?: string }; label: string; points: number; cout: number | null; remise: number; carac: string; valeur: number }
/** `aSpecifier` : le Talent attend une spécialisation que la carrière laisse au choix (un domaine, un dieu) ;
 *  `auMaxi` : il ne se prend plus. LDB 10 */
export interface OffreDeTalent { ref: { id: string; spec?: string }; label: string; possede: number; cout: number; auMaxi: boolean; aSpecifier?: boolean }
/** Ce que le niveau courant exige pour passer au suivant, selon le passage du modèle du héros : `completion`, les
 *  `points` de chaque Caractéristique de carrière et de `competences` Compétences, et un Talent du niveau ; `cases`, les `cases`
 *  cochées au niveau sur son `seuil`. LDB 07 l.124-131 ; CRB 048 l.45 */
export type Exigence = { type: 'completion'; points: number; competences: number } | { type: 'cases'; cases: number; seuil: number };
export interface Progression {
  niveau: number; titre: string; exigence: Exigence | null; complet: boolean; suivant: { niveau: number; titre: string; cout: number } | null;
  caracs: OffreDeCarac[]; competences: OffreDeCompetence[]; talents: OffreDeTalent[];
}

/** L'exigence du niveau courant de `c`, lue du moteur (`modeleDe(c).passage`, `careerCompletionAdvances`,
 *  `casesDuNiveau`) ; `null` au-delà du dernier seuil d'un passage par cases. LDB 07 l.124-131 ; CRB 048 l.45 */
export function exigenceDuNiveau(c: Combatant): Exigence | null {
  const niveau = c.careerLevel ?? 1;
  const passage = modeleDe(c).passage;
  switch (passage.type) {
    case 'completion': return { type: 'completion', points: careerCompletionAdvances(niveau), competences: CAREER_SKILLS_ADVANCED };
    case 'cases': {
      const seuil = passage.seuils[niveau - 1];
      return seuil === undefined ? null : { type: 'cases', cases: casesDuNiveau(c, c.career ?? '', niveau), seuil };
    }
  }
}

/** Le contexte du niveau courant de `c` que `niveauValide` lit : Caractéristiques et emplacements de Compétences de
 *  carrière (cumul des niveaux atteints), Talents achetables (`talentSlotsAchetables`), désignations. LDB 07 l.41-43,
 *  l.76, l.103 ; CRB 045 l.58 */
function contexteDuNiveau(c: Combatant): ContexteDeCompletion {
  const carriere = c.career ?? '';
  const niveaux = levelsForCareer(carriere);
  const niveau = c.careerLevel ?? 1;
  return { skillSlots: skillSlots(niveaux, niveau), talentSlots: talentSlotsAchetables(c, niveaux, niveau), careerChars: availableChars(niveaux, niveau), designations: designationsFor(c, carriere) };
}

/** Les offres du niveau de carrière du héros : Caractéristiques et Compétences de carrière, Talents achetables
 *  (`contexteDuNiveau`), l'exigence du niveau (`exigenceDuNiveau`), sa validation par le noyau (`niveauValide`) et le
 *  niveau suivant. LDB 07 l.41-43, l.76, l.103, l.118-131 ; CRB 045 l.58 ; CRB 048 l.45 */
export function progression(c: Combatant): Progression {
  const carriere = c.career ?? '';
  const niveaux = levelsForCareer(carriere);
  const niveau = c.careerLevel ?? 1;
  const ctx = contexteDuNiveau(c);
  const { designations } = ctx;
  const refs = (slots: typeof ctx.skillSlots) => slots.flatMap((sl) => {
    const designee = designations[sl.key];
    if (designee) { const r = parseRefKey(designee); return [{ id: r.id, ...(r.spec ? { spec: r.spec } : {}) }]; }
    return sl.options.filter((o) => o.optionId).map((o) => ({ id: o.optionId!, ...(o.spec ? { spec: o.spec } : {}), ...(sl.needsChoice && !o.spec ? { aSpecifier: true } : {}) }));
  });
  const prochain = niveaux.find((l) => l.level === niveau + 1);
  return {
    niveau, titre: niveaux.find((l) => l.level === niveau)?.label ?? carriere, exigence: exigenceDuNiveau(c), complet: niveauValide(c, niveau, ctx),
    suivant: prochain ? { niveau: prochain.level, titre: prochain.label, cout: coutDuChangement(c, true) } : null,
    caracs: [...new Set(ctx.careerChars)].map((k) => ({ id: k, label: libelleDeCarac(k).label, valeur: effectiveChar(c, k), points: pointsDe(c, { genre: 'carac', id: k }), cout: prixDe(coutDeLAugmentation(c, { kind: 'caracteristique', char: k }, true)) })),
    competences: refs(ctx.skillSlots).filter((r) => !r.aSpecifier).map(({ aSpecifier: _a, ...ref }) => {
      const k = byId('skill', ref.id)?.characteristic as CharKey | undefined;
      const { remise } = competenceEnCarriere(c, ctx.skillSlots, designations, ref.id, ref.spec);
      return { ref, label: refLabel('skills', ref), points: pointsDe(c, { genre: 'competence', ref }), cout: prixDe(coutDeLAugmentation(c, { kind: 'competence', competence: ref }, true, remise)), remise, carac: k ? libelleDeCarac(k).abr : '', valeur: testValue(c, { skill: ref }) };
    }),
    talents: refs(ctx.talentSlots).map(({ aSpecifier, ...ref }) => {
      const fois = c.talents.filter((t) => t.talentId === ref.id && (aSpecifier || memeSpecialisation(t.spec, ref.spec))).reduce((n, t) => n + t.times, 0);
      return { ref, label: refLabel('talents', ref), possede: fois, cout: coutDuTalent(c, ref.id, ref.spec), auMaxi: talentMaxReached(c, ref.id, ref.spec), ...(aSpecifier ? { aSpecifier } : {}) };
    }),
  };
}

/** Le prix d'un `Chiffrage`, `null` s'il est refusé. */
const prixDe = (x: Chiffrage): number | null => (x.ok ? x.cout : null);

/** Une Caractéristique ou une Compétence de carrière, cible d'Augmentations. */
export type CibleDuPas = { genre: 'carac'; id: CharKey } | { genre: 'competence'; ref: { id: string; spec?: string } };

/** Les points que les Augmentations de `cible` ont ajoutés à sa valeur chez `c` (0 pour une Compétence inconnue). */
export function pointsDe(c: Combatant, cible: CibleDuPas): number {
  if (cible.genre === 'carac') return c.charAdvances?.[cible.id] ?? 0;
  return c.skills.find((s) => s.id === cible.ref.id && memeSpecialisation(s.spec, cible.ref.spec))?.advances ?? 0;
}

/** Un pas de progression : jusqu'au prochain multiple de cinq points. */
export const PAS = 5;
/** Le but en points d'un pas depuis `points` : le prochain multiple de `PAS`. */
export const butDuPas = (points: number): number => points + PAS - (points % PAS);

/** Ce qu'une suite d'Augmentations a pris : combien, les points gagnés, la somme de leurs `cost`, et le refus du noyau
 *  qui l'a arrêtée. */
interface Prises { fois: number; points: number; cout: number; refus: string | null }

/** Achète sur `copie` des Augmentations de carrière de `cible` (`buyCharAdvance`, `buySkillAdvance`), `remise` déduite de
 *  chacune, tant que sa valeur n'a pas gagné `but` points ; la Compétence inconnue est d'abord apprise. Mute `copie`. */
function acheterSur(copie: Combatant, cible: CibleDuPas, but: number, remise: number): Prises {
  if (cible.genre === 'competence' && !copie.skills.some((s) => s.id === cible.ref.id && memeSpecialisation(s.spec, cible.ref.spec))) {
    copie.skills.push({ id: cible.ref.id, spec: cible.ref.spec, characteristic: byId('skill', cible.ref.id)?.characteristic as CharKey, advances: 0 });
  }
  const depuis = pointsDe(copie, cible);
  let fois = 0;
  let cout = 0;
  while (pointsDe(copie, cible) < but) {
    const r = cible.genre === 'carac' ? buyCharAdvance(copie, cible.id) : buySkillAdvance(copie, cible.ref, true, remise);
    if (!r.ok) return { fois, points: pointsDe(copie, cible) - depuis, cout, refus: r.reason ?? '' };
    fois++;
    cout += r.cost;
  }
  return { fois, points: pointsDe(copie, cible) - depuis, cout, refus: null };
}

/** Une copie de `c` aux PX illimités. */
const copieSansCompte = (c: Combatant): Combatant => ({ ...structuredClone(c), xp: Number.MAX_SAFE_INTEGER });

/** Le pas de `cible` pour `c`, acheté sur une copie (`acheterSur`) jusqu'au prochain multiple de `PAS` points
 *  (`butDuPas`), `remise` déduite de chaque Augmentation : leur nombre, les points gagnés et leur coût ; `null` si le
 *  noyau en refuse une. */
export function prochainPas(c: Combatant, cible: CibleDuPas, remise = 0): { fois: number; points: number; cout: number } | null {
  const r = acheterSur(copieSansCompte(c), cible, butDuPas(pointsDe(c, cible)), remise);
  return r.refus === null ? { fois: r.fois, points: r.points, cout: r.cout } : null;
}

/** Une étape d'un plan de niveau : l'achat, combien de fois, son libellé et ce qu'il coûte en tout ; `points` : ce
 *  qu'une étape d'Augmentations ajoute à la valeur. */
export type EtapeDuPlan = ({ genre: 'carac'; id: CharKey; points: number } | { genre: 'competence'; ref: { id: string; spec?: string }; points: number } | { genre: 'talent'; ref: { id: string; spec?: string } } | { genre: 'niveau' })
  & { label: string; fois: number; cout: number };

/** Les achats qui valident le niveau `p` du héros `c` (`niveauValide`, sur une copie) : le premier Talent de
 *  `p.talents` qui se prend si aucun n'est acquis, puis, pas par pas (`butDuPas`) et à tour de rôle, les
 *  Caractéristiques de carrière et les Compétences de carrière (les `preferee` d'abord, puis les plus avancées) jusqu'à
 *  la validation ; enfin le niveau suivant. Sous l'exigence `completion`, chaque cible s'arrête à ses points et seules
 *  ses `competences` Compétences sont prises. LDB 07 l.118-131 ; CRB 048 l.45 */
export function planDuNiveau(c: Combatant, p: Progression, preferee: (ref: { id: string; spec?: string }) => boolean = () => false): EtapeDuPlan[] {
  const exigence = p.exigence;
  if (!exigence) return [];
  const copie = copieSansCompte(c);
  const ctx = contexteDuNiveau(c);
  const valide = () => niveauValide(copie, p.niveau, ctx);
  const talent = p.talents.some((t) => t.possede > 0) || valide() ? undefined : p.talents.find((t) => !t.aSpecifier && !t.auMaxi);
  if (talent) buyTalent(copie, talent.ref.id, talent.ref.spec);
  const plafond = exigence.type === 'completion' ? exigence.points : Infinity;
  const rang = (k: OffreDeCompetence) => (preferee(k.ref) ? 1 : 0);
  const competences = p.competences.filter((x) => x.points < plafond).sort((x, y) => rang(y) - rang(x) || y.points - x.points);
  const tenues = p.competences.length - competences.length;
  type Cible = { cible: CibleDuPas; label: string; remise: number };
  let restantes: Cible[] = [
    ...p.caracs.filter((x) => x.points < plafond).map((k): Cible => ({ cible: { genre: 'carac', id: k.id }, label: k.label, remise: 0 })),
    ...(exigence.type === 'completion' ? competences.slice(0, Math.max(0, exigence.competences - tenues)) : competences)
      .map((k): Cible => ({ cible: { genre: 'competence', ref: k.ref }, label: k.label, remise: k.remise })),
  ];
  const etapes: EtapeDuPlan[] = [];
  while (restantes.length && !valide()) {
    const encore: Cible[] = [];
    for (const x of restantes) {
      if (valide()) break;
      const r = acheterSur(copie, x.cible, Math.min(butDuPas(pointsDe(copie, x.cible)), plafond), x.remise);
      if (r.fois) etapes.push({ ...x.cible, label: x.label, fois: r.fois, points: r.points, cout: r.cout });
      if (r.refus === null && pointsDe(copie, x.cible) < plafond) encore.push(x);
    }
    restantes = encore;
  }
  if (talent) etapes.push({ genre: 'talent', ref: talent.ref, label: talent.label, fois: 1, cout: talent.cout });
  if (p.suivant) etapes.push({ genre: 'niveau', label: p.suivant.titre, fois: 1, cout: p.suivant.cout });
  return etapes;
}

/** Une valeur avant et après un achat. */
export interface AvantApres { avant: number; apres: number }
/** Un achat de carrière : les Augmentations d'une Caractéristique ou d'une Compétence jusqu'à `but` points, ou un
 *  Talent. */
export type AchatDeCarriere = (CibleDuPas & { but: number }) | { genre: 'talent'; ref: { id: string; spec?: string } };
/** Un Test de combat avant et après un achat : sa valeur, et ses chances (`chancesDeReussite`) ; `attaque` : le Test
 *  d'attaque d'une arme. */
export interface EcartDeTest extends AvantApres { label: string; attaque: boolean; chances: AvantApres }

/** Les Compétences de combat (`COMPETENCES_DU_COMBAT`) hors Test d'attaque que `c` peut tenter (`peutTenter`) : les
 *  siennes, spécialisation comprise, ou la Compétence de base qu'il n'a pas apprise. */
function competencesDeCombat(c: Combatant): { id: string; spec?: string }[] {
  return [...COMPETENCES_DU_COMBAT].filter((id) => id !== weaponSkillId('melee') && id !== weaponSkillId('distance')).flatMap((id) => {
    const siennes = c.skills.filter((s) => s.id === id).map((s) => ({ id, ...(s.spec ? { spec: s.spec } : {}) }));
    return siennes.length ? siennes : peutTenter(c, { skill: { id } }) ? [{ id }] : [];
  });
}

/** Ce que `achat` change au héros `c` en combat, lu par le moteur sur une copie qui l'a acheté (`acheterSur`,
 *  `buyTalent`) : le Test d'attaque de chaque arme `armes` du catalogue entre ses mains (`maniement`), puis celui de
 *  chaque Compétence de combat qu'il tente (`competencesDeCombat`, `testValue`) ou qu'il achète, avec leurs chances
 *  (`chancesDeReussite`) ; le Bonus de chaque Caractéristique (`bonusDe`) et les Blessures (`effectiveMaxWounds`).
 *  `null` si le noyau refuse l'achat. */
export function effetEnCombat(
  c: Combatant, achat: AchatDeCarriere, armes: readonly string[],
): { tests: EcartDeTest[]; bonus: (AvantApres & { id: CharKey })[]; blessures: AvantApres } | null {
  const copie = copieSansCompte(c);
  if (achat.genre === 'talent' ? !buyTalent(copie, achat.ref.id, achat.ref.spec).ok : acheterSur(copie, achat, achat.but, 0).refus !== null) return null;
  const ecart = (label: string, attaque: boolean, avant: number, apres: number): EcartDeTest =>
    ({ label, attaque, avant, apres, chances: { avant: chancesDeReussite(avant), apres: chancesDeReussite(apres) } });
  const tenues = armes.map((id) => ({ id, m: maniement(c, id) }));
  const attaques = tenues.map(({ id, m }) => ecart(`${articleDuCatalogue(id).label} · ${m.test}`, true, m.attaque, maniement(copie, id).attaque));
  const achetee = achat.genre === 'competence' && !tenues.some(({ m }) => m.designe.skill?.id === achat.ref.id && memeSpecialisation(m.designe.skill.spec, achat.ref.spec)) ? [achat.ref] : [];
  const competences = [...achetee, ...competencesDeCombat(copie).filter((r) => !achetee.some((a) => a.id === r.id && memeSpecialisation(a.spec, r.spec)))];
  return {
    tests: [...attaques, ...competences.map((ref) => ecart(refLabel('skills', ref), false, testValue(c, { skill: ref }), testValue(copie, { skill: ref })))],
    bonus: CHAR_KEYS.map((id) => ({ id, avant: bonusDe(c, id), apres: bonusDe(copie, id) })),
    blessures: { avant: effectiveMaxWounds(c), apres: effectiveMaxWounds(copie) },
  };
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
    const plan = planDuNiveau(porte, p);
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

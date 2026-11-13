/**
 * LE PNJ DE CARRIÈRE (#773) : un profil de base, celui du Bestiaire ou son tirage, porté au Niveau atteint d'une ou
 * plusieurs carrières. EDO 11 l.17-21 ; arbitrages R1-R4 au ticket #773 (2026-11-08). L'auteur choisit les Talents,
 * les Compétences des emplacements à choix et les dotations à choix ; ce qu'il laisse se tire sur une graine stable,
 * l'id du porteur. Une Compétence ou un Talent qu'un Talent ajoute aux carrières (LDB 10 l.70, l.467, l.745, l.891)
 * est de carrière dès le Niveau où ce Talent est pris : arbitrage du 2026-11-08 au ticket #773. Son argent : EDO 11 l.42-46.
 */
import type { Combatant } from './types';
import type { RefASpecialisation, RefDesignee } from '../data/schemas/grammaire/ref';
import { levelsForCareer } from '../data';
import {
  acquerirTalent,
  availableChars,
  freeSlotFor,
  inCareerStatus,
  parseRefKey,
  prisParLesAutres,
  refKey,
  skillSlots,
  slotCovers,
  talentMaxReached,
  talentSlots,
  wildcardSpecs,
  type CareerSlot,
} from './careerSlots';
import { applyTalentAcquisition, competencesAjouteesPar, deplierAjouts, talentsAjoutesALaCarriere, talentsAjoutesPar } from './talentEffects';
import { augmenterLaCompetence } from './character';
import { blessuresReconciliees } from './characteristics';
import { contexteDeNaissanceDObjet } from './items';
import { dotationsDuPnj, emplacementsDeDotation, resolveTrappingChoices, valeursDeLEmplacement, type ChoixDeDotation } from './trappingChoices';
import { hashSeed, makeRNG, type RNG } from './dice';
import { statusIncome } from './activities';
import { actorStatus } from './social';
import { bourseOf, doterLePorteur, ensureBourseInstance } from './bourse';
import { toBrass } from './money';
import { t } from '../i18n';

/** Le parcours d'un PNJ de carrière, tel que l'auteur l'écrit (`SceneEntity`). */
export interface ParcoursDeCarriere {
  /** Chaque carrière par son id, au Niveau atteint, dans l'ordre du parcours : la dernière est la carrière actuelle. */
  carrieres: Readonly<Record<string, number>>;
  /** Talents choisis, par carrière : chacun compte pour le premier Niveau atteint qui l'offre (`talentsDuParcours`). */
  talentsDeCarriere?: Readonly<Record<string, readonly RefDesignee[]>>;
  /** Compétences des emplacements à choix, par carrière, chacune sur le premier emplacement libre qui la couvre. */
  competencesDeCarriere?: Readonly<Record<string, readonly RefDesignee[]>>;
  /** Choix des emplacements de dotation de la carrière actuelle (`dotationsDuPnj`), par adresse (`adresseDeCreation`). */
  dotationsDeCarriere?: Readonly<Record<string, number | string>>;
}

/** Le parcours que porte `p`, `undefined` sans carrière. */
export function parcoursDe(p: Partial<ParcoursDeCarriere>): ParcoursDeCarriere | undefined {
  const { carrieres, talentsDeCarriere, competencesDeCarriere, dotationsDeCarriere } = p;
  return carrieres && { carrieres, talentsDeCarriere, competencesDeCarriere, dotationsDeCarriere };
}

/** La carrière actuelle du parcours `p` et son Niveau : la dernière carrière. */
export function carriereActuelle(p: ParcoursDeCarriere): { id: string; niveau: number } | undefined {
  const derniere = Object.entries(p.carrieres).pop();
  return derniere && { id: derniere[0], niveau: derniere[1] };
}

/** Les Talents de chaque Niveau atteint du parcours `p`, carrière par carrière dans son ordre. `offerts` (`refKey`) :
 *  ceux des emplacements du Niveau (`talentSlots`), et ceux qu'ajoute un Talent choisi à un Niveau antérieur
 *  (`talentsAjoutesPar`, LDB 10 l.467). `choisis` : les Talents choisis de la carrière dont c'est le premier Niveau
 *  qui les offre ; `refuses`, ceux qu'aucun n'offre. */
export function talentsDuParcours(p: ParcoursDeCarriere): { niveaux: Record<string, { offerts: string[]; choisis: RefDesignee[] }[]>; refuses: { carriere: string; ref: RefDesignee }[] } {
  const ajoutes: string[] = [];
  const niveaux: Record<string, { offerts: string[]; choisis: RefDesignee[] }[]> = {};
  const refuses: { carriere: string; ref: RefDesignee }[] = [];
  for (const [id, niveau] of Object.entries(p.carrieres)) {
    const levels = levelsForCareer(id);
    let restants = [...(p.talentsDeCarriere?.[id] ?? [])];
    niveaux[id] = [];
    for (let n = 1; n <= niveau; n++) {
      const slots = talentSlots(levels, n);
      const choisis = restants.filter((r) => slots.some((s) => slotCovers(s, r.id, r.spec)) || ajoutes.includes(refKey(r.id, r.spec)));
      restants = restants.filter((r) => !choisis.includes(r));
      niveaux[id].push({ offerts: [...new Set([...slots.flatMap(candidatsDuSlot), ...ajoutes])], choisis });
      ajoutes.push(...choisis.flatMap((r) => deplierAjouts(talentsAjoutesPar(r.id), 'talent')).map((r) => refKey(r.id, r.spec)));
    }
    refuses.push(...restants.map((ref) => ({ carriere: id, ref })));
  }
  return { niveaux, refuses };
}

/** Les désignations des emplacements de Compétence à choix de `carriere` au Niveau `niveau` (slotKey → `refKey`) :
 *  chaque Compétence de `refs` sur le premier emplacement libre qui la couvre (`freeSlotFor`), sauf celle qu'une entrée
 *  sans choix des Niveaux 1 à `niveau` couvre déjà (`inCareerStatus` `explicit`) ; `refusees`, celles qu'aucun ne prend.
 *  LDB 07 l.124. */
export function designationsDeCarriere(carriere: string, niveau: number, refs: readonly RefDesignee[]): { designations: Record<string, string>; refusees: RefDesignee[] } {
  const slots = skillSlots(levelsForCareer(carriere), niveau);
  const designations: Record<string, string> = {};
  const refusees: RefDesignee[] = [];
  for (const r of refs) {
    if (inCareerStatus(slots, designations, r.id, r.spec) === 'explicit') continue;
    const slot = freeSlotFor(slots, designations, r.id, r.spec);
    if (slot) designations[slot.key] = refKey(r.id, r.spec);
    else refusees.push(r);
  }
  return { designations, refusees };
}

/** Les Compétences ou Talents concrets (`refKey`) qu'un emplacement peut désigner : chaque option à id, chaque
 *  spécialisation de son pool pour un joker (`wildcardSpecs`). */
export function candidatsDuSlot(slot: CareerSlot): string[] {
  return slot.options.flatMap((o) => (o.optionId === undefined ? [] : (o.wildcard ? wildcardSpecs(o, slot.kind) : [o.spec]).map((spec) => refKey(o.optionId!, spec))));
}

/** Un élément de `liste` tiré sur `rng`, `undefined` d'une liste vide. */
const tirer = <T>(liste: readonly T[], rng: RNG): T | undefined => (liste.length ? liste[rng.int(0, liste.length - 1)] : undefined);

/** Le flux de tirage `quoi` de la carrière `carriere` du porteur `id`. */
const fluxDuPnj = (id: string, carriere: string, quoi: string): RNG => makeRNG(hashSeed(`carriere:${id}:${carriere}:${quoi}`));

/** Les choix de dotation `choisis` complétés sur `rng` : chaque emplacement de `dotations` non choisi reçoit une de
 *  ses valeurs (`valeursDeLEmplacement`). */
function choixCompletes(dotations: Parameters<typeof emplacementsDeDotation>[0], choisis: NonNullable<ParcoursDeCarriere['dotationsDeCarriere']>, rng: RNG): ChoixDeDotation {
  const complets: ChoixDeDotation = {};
  for (const e of emplacementsDeDotation(dotations)) {
    const v = choisis[e.adresse] ?? tirer(valeursDeLEmplacement(e), rng);
    if (v !== undefined) complets[e.adresse] = v;
  }
  return complets;
}

/** Le refus du parcours `p`, `undefined` s'il est admis : une carrière à un Niveau qu'elle n'a pas, un Talent qu'aucun
 *  Niveau atteint n'offre, une Compétence sans emplacement à choix libre qui la couvre, un choix de dotation hors des
 *  emplacements de la carrière actuelle ou de leurs valeurs. */
export function refusDuParcours(p: ParcoursDeCarriere): string | undefined {
  const ids = Object.keys(p.carrieres);
  if (!ids.length) return t('parcours.refus.vide');
  for (const [id, niveau] of Object.entries(p.carrieres)) {
    if (!levelsForCareer(id).some((l) => l.level === niveau)) return t('parcours.refus.niveau', { carriere: id, niveau });
  }
  const absente = Object.keys(p.talentsDeCarriere ?? {}).find((id) => !ids.includes(id));
  if (absente) return t('parcours.refus.talentsHorsParcours', { carriere: absente });
  const [refuse] = talentsDuParcours(p).refuses;
  if (refuse) return t('parcours.refus.talent', { ref: refKey(refuse.ref.id, refuse.ref.spec), carriere: refuse.carriere });
  for (const [id, refs] of Object.entries(p.competencesDeCarriere ?? {})) {
    if (!ids.includes(id)) return t('parcours.refus.competencesHorsParcours', { carriere: id });
    const [r] = designationsDeCarriere(id, p.carrieres[id], refs).refusees;
    if (r) return t('parcours.refus.competence', { competence: refKey(r.id, r.spec), carriere: id });
  }
  const actuelle = carriereActuelle(p)!;
  const emplacements = new Map(emplacementsDeDotation(dotationsDuPnj(actuelle.id, actuelle.niveau)).map((e) => [e.adresse as string, e]));
  for (const [adresse, v] of Object.entries(p.dotationsDeCarriere ?? {})) {
    const e = emplacements.get(adresse);
    if (!e) return t('parcours.refus.emplacement', { adresse, carriere: actuelle.id, niveau: actuelle.niveau });
    if (!valeursDeLEmplacement(e).includes(v)) return t('parcours.refus.valeur', { valeur: v, adresse });
  }
  return undefined;
}

/** Le parcours `p` sans ce que ses carrières n'admettent plus (`refusDuParcours`) : les Talents et Compétences d'une
 *  carrière absente ou que ses Niveaux n'offrent plus, les choix de dotation hors des emplacements de la carrière
 *  actuelle. Ce que l'éditeur écrit après une carrière retirée ou un Niveau changé. */
export function parcoursRetouche(p: ParcoursDeCarriere): ParcoursDeCarriere {
  const garder = <T>(parCarriere: Readonly<Record<string, readonly T[]>> | undefined, admis: (id: string, refs: readonly T[]) => T[]) => {
    const out = Object.fromEntries(Object.entries(parCarriere ?? {}).flatMap(([id, refs]) => {
      const gardes = id in p.carrieres ? admis(id, refs) : [];
      return gardes.length ? [[id, gardes]] : [];
    }));
    return Object.keys(out).length ? out : undefined;
  };
  const actuelle = carriereActuelle(p);
  const { refuses } = talentsDuParcours(p);
  const emplacements = new Map(actuelle ? emplacementsDeDotation(dotationsDuPnj(actuelle.id, actuelle.niveau)).map((e) => [e.adresse as string, e]) : []);
  const dotations = Object.fromEntries(Object.entries(p.dotationsDeCarriere ?? {}).filter(([a, v]) => {
    const e = emplacements.get(a);
    return e !== undefined && valeursDeLEmplacement(e).includes(v);
  }));
  return {
    carrieres: p.carrieres,
    talentsDeCarriere: garder(p.talentsDeCarriere, (id, refs) => refs.filter((t) => !refuses.some((r) => r.carriere === id && r.ref === t))),
    competencesDeCarriere: garder(p.competencesDeCarriere, (id, refs) => {
      const refusees = new Set(designationsDeCarriere(id, p.carrieres[id], refs).refusees);
      return refs.filter((r) => !refusees.has(r));
    }),
    dotationsDeCarriere: Object.keys(dotations).length ? dotations : undefined,
  };
}

/** Un Talent du Niveau `slots` tiré sur `rng` : un emplacement, ou les Talents `ajoutes` aux carrières, qui en offre
 *  un dont le Maxi n'est pas atteint (`talentMaxReached`), puis l'un de ceux-là. */
function talentTire(c: Combatant, slots: CareerSlot[], ajoutes: readonly RefDesignee[], rng: RNG): RefDesignee | undefined {
  const offerts = [...slots.map((s) => candidatsDuSlot(s).map(parseRefKey)), [...ajoutes]].map((l) => l.filter((r) => !talentMaxReached(c, r.id, r.spec))).filter((l) => l.length);
  return tirer(tirer(offerts, rng) ?? [], rng);
}

/** Le PNJ `c`, profil de base en main, porté au parcours `p` (EDO 11 l.19) : pour chaque Niveau atteint de chaque
 *  carrière, +5 à chaque Caractéristique et Compétence disponible (R1, R2), au moins un Talent du Niveau ; puis la
 *  carrière actuelle et son Niveau (Statut, LDB 08 l.9), les dotations de ses Niveaux 1 à N (R3, R4, `doterLePorteur`), et ses
 *  Blessures recalées sur le profil (`blessuresReconciliees`). Mute `c`. */
export function porterAuParcours(c: Combatant, p: ParcoursDeCarriere): void {
  const carrieres = Object.entries(p.carrieres);
  for (const [id, niveau] of carrieres) {
    const levels = levelsForCareer(id);
    for (let n = 1; n <= niveau; n++) for (const k of new Set(availableChars(levels, n))) c.characteristics[k] += 5;
  }
  // Compétences ajoutées par un Talent : `rang` de la carrière où il est pris (-1 : tenu avant le parcours), `niveau`.
  const rngAjouts = fluxDuPnj(c.id, '', 'ajouts');
  const ajoutee = (ref: RefASpecialisation) => tirer(deplierAjouts([ref], 'skill'), rngAjouts);
  const ajouts = c.talents.flatMap(competencesAjouteesPar).flatMap((ref) => ajoutee(ref) ?? []).map((ref) => ({ ref, rang: -1, niveau: 1 }));
  const { niveaux } = talentsDuParcours(p);
  for (const [rang, [id]] of carrieres.entries()) {
    const levels = levelsForCareer(id);
    const rngTalents = fluxDuPnj(c.id, id, 'talents');
    for (const [i, { choisis }] of niveaux[id].entries()) {
      const tire = choisis.length ? undefined : talentTire(c, talentSlots(levels, i + 1), talentsAjoutesALaCarriere(c), rngTalents);
      for (const t of tire ? [tire] : choisis) {
        const tenus = c.talents.length;
        if (!acquerirTalent(c, t)) continue;
        if (c.talents.length > tenus) ajouts.push(...competencesAjouteesPar(c.talents[tenus]).flatMap((ref) => ajoutee(ref) ?? []).map((ref) => ({ ref, rang, niveau: i + 1 })));
        applyTalentAcquisition(c, t.id, t.spec);
      }
    }
  }
  for (const [rang, [id, niveau]] of carrieres.entries()) {
    const levels = levelsForCareer(id);
    const slots = skillSlots(levels, niveau);
    const { designations } = designationsDeCarriere(id, niveau, p.competencesDeCarriere?.[id] ?? []);
    const rngCompetences = fluxDuPnj(c.id, id, 'competences');
    for (const s of slots) {
      if (!s.needsChoice || designations[s.key]) continue;
      const pris = prisParLesAutres(s, slots, designations);
      const k = tirer(candidatsDuSlot(s).filter((x) => !pris.has(x)), rngCompetences);
      if (k) designations[s.key] = k;
    }
    const premierNiveau = new Map<string, number>();
    const poser = (k: string, depuis: number) => premierNiveau.set(k, Math.min(depuis, premierNiveau.get(k) ?? depuis));
    for (const s of slots) {
      const k = s.needsChoice ? designations[s.key] : candidatsDuSlot(s)[0];
      if (k) poser(k, s.level);
    }
    for (const a of ajouts) if (a.rang <= rang) poser(refKey(a.ref.id, a.ref.spec), a.rang === rang ? a.niveau : 1);
    for (const [k, depuis] of premierNiveau) augmenterLaCompetence(c.skills, parseRefKey(k), 5 * (niveau - depuis + 1));
  }
  const actuelle = carriereActuelle(p)!;
  c.career = actuelle.id;
  c.careerLevel = actuelle.niveau;
  c.careerHistory = Object.keys(p.carrieres);
  const dotations = dotationsDuPnj(actuelle.id, actuelle.niveau);
  const rngDotations = fluxDuPnj(c.id, actuelle.id, 'dotations');
  let n = 0;
  Object.assign(c, doterLePorteur(resolveTrappingChoices(dotations, choixCompletes(dotations, p.dotationsDeCarriere ?? {}, rngDotations)), rngDotations, () => `${c.id}-dotation-${n++}`, contexteDeNaissanceDObjet(c)));
  c.wounds = blessuresReconciliees(c);
}

/** L'argent du PNJ `c` dont la Bourse est vide, aucune dotation d'argent ne l'ayant remplie : la somme de son Statut
 *  (`statusIncome`), tirée sur la graine de son id, dans sa Bourse. EDO 11 l.42-46, LDB 08 l.114-118. Mute `c`. */
export function argentDuPnj(c: Combatant): void {
  if (toBrass(bourseOf(c)) > 0) return;
  const bourse = ensureBourseInstance(c, () => `${c.id}-bourse`);
  const { tier, standing } = actorStatus(c);
  if (bourse) bourse.money = statusIncome(tier, standing, makeRNG(hashSeed(`argent:${c.id}`)));
}

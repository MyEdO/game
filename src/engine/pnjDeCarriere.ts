/**
 * LE PNJ DE CARRIÈRE (#773) : un profil de base, celui du Bestiaire ou son tirage, porté au Niveau atteint d'une ou
 * plusieurs carrières. EDO 11 l.17-21 ; arbitrages R1-R4 au ticket #773 (2026-11-08). L'auteur choisit les Talents,
 * les Compétences des emplacements à choix et les dotations à choix ; ce qu'il laisse se tire sur une graine stable,
 * l'id du porteur.
 */
import type { Combatant } from './types';
import type { RefDesignee } from '../data/schemas/grammaire/ref';
import { levelsForCareer, type CareerLevelData } from '../data';
import { acquerirTalent, availableChars, freeSlotFor, parseRefKey, prisParLesAutres, refKey, skillSlots, slotCovers, talentMaxReached, talentSlots, talentSlotsUpTo, wildcardSpecs, type CareerSlot } from './careerSlots';
import { applyTalentAcquisition } from './talentEffects';
import { augmenterLaCompetence } from './character';
import { blessuresReconciliees } from './characteristics';
import { buildInventory, contexteDeNaissanceDObjet } from './items';
import { dotationsDuPnj, emplacementsDeDotation, resolveTrappingChoices, valeursDeLEmplacement, type ChoixDeDotation } from './trappingChoices';
import { hashSeed, makeRNG, type RNG } from './dice';

/** Le parcours d'un PNJ de carrière, tel que l'auteur l'écrit (`SceneEntity`). */
export interface ParcoursDeCarriere {
  /** Chaque carrière par son id, au Niveau atteint, dans l'ordre du parcours : la dernière est la carrière actuelle. */
  carrieres: Readonly<Record<string, number>>;
  /** Talents choisis, par carrière : chacun compte pour le plus bas Niveau atteint qui l'offre (`niveauDuTalent`). */
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

/** Le plus bas Niveau atteint (1 à `niveau`) dont un emplacement de Talent couvre `ref` (`slotCovers`), `undefined`
 *  sans lui. */
export function niveauDuTalent(levels: CareerLevelData[], niveau: number, ref: RefDesignee): number | undefined {
  return talentSlotsUpTo(levels, niveau).find((s) => slotCovers(s, ref.id, ref.spec))?.level;
}

/** Les désignations des emplacements de Compétence à choix de `carriere` au Niveau `niveau` (slotKey → `refKey`) :
 *  chaque Compétence de `refs` sur le premier emplacement libre qui la couvre (`freeSlotFor`) ; `refusees`, celles
 *  qu'aucun ne prend. */
export function designationsDeCarriere(carriere: string, niveau: number, refs: readonly RefDesignee[]): { designations: Record<string, string>; refusees: RefDesignee[] } {
  const slots = skillSlots(levelsForCareer(carriere), niveau);
  const designations: Record<string, string> = {};
  const refusees: RefDesignee[] = [];
  for (const r of refs) {
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
  if (!ids.length) return 'aucune carrière au parcours';
  for (const [id, niveau] of Object.entries(p.carrieres)) {
    if (!levelsForCareer(id).some((l) => l.level === niveau)) return `la carrière « ${id} » n'a pas de Niveau ${niveau}`;
  }
  for (const [id, refs] of Object.entries(p.talentsDeCarriere ?? {})) {
    if (!ids.includes(id)) return `Talents de la carrière « ${id} », absente du parcours`;
    const r = refs.find((t) => niveauDuTalent(levelsForCareer(id), p.carrieres[id], t) === undefined);
    if (r) return `le Talent « ${refKey(r.id, r.spec)} » n'est offert par aucun Niveau atteint de « ${id} »`;
  }
  for (const [id, refs] of Object.entries(p.competencesDeCarriere ?? {})) {
    if (!ids.includes(id)) return `Compétences de la carrière « ${id} », absente du parcours`;
    const [r] = designationsDeCarriere(id, p.carrieres[id], refs).refusees;
    if (r) return `la Compétence « ${refKey(r.id, r.spec)} » ne désigne aucun emplacement à choix libre de « ${id} »`;
  }
  const actuelle = carriereActuelle(p)!;
  const emplacements = new Map(emplacementsDeDotation(dotationsDuPnj(actuelle.id, actuelle.niveau)).map((e) => [e.adresse as string, e]));
  for (const [adresse, v] of Object.entries(p.dotationsDeCarriere ?? {})) {
    const e = emplacements.get(adresse);
    if (!e) return `« ${adresse} » n'est pas un emplacement de dotation de « ${actuelle.id} » au Niveau ${actuelle.niveau}`;
    if (!valeursDeLEmplacement(e).includes(v)) return `« ${v} » n'est pas une valeur de l'emplacement de dotation « ${adresse} »`;
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
  const emplacements = new Map(actuelle ? emplacementsDeDotation(dotationsDuPnj(actuelle.id, actuelle.niveau)).map((e) => [e.adresse as string, e]) : []);
  const dotations = Object.fromEntries(Object.entries(p.dotationsDeCarriere ?? {}).filter(([a, v]) => {
    const e = emplacements.get(a);
    return e !== undefined && valeursDeLEmplacement(e).includes(v);
  }));
  return {
    carrieres: p.carrieres,
    talentsDeCarriere: garder(p.talentsDeCarriere, (id, refs) => refs.filter((t) => niveauDuTalent(levelsForCareer(id), p.carrieres[id], t) !== undefined)),
    competencesDeCarriere: garder(p.competencesDeCarriere, (id, refs) => {
      const refusees = new Set(designationsDeCarriere(id, p.carrieres[id], refs).refusees);
      return refs.filter((r) => !refusees.has(r));
    }),
    dotationsDeCarriere: Object.keys(dotations).length ? dotations : undefined,
  };
}

/** Un Talent du Niveau `slots` tiré sur `rng` : un emplacement qui en offre un dont le Maxi n'est pas atteint
 *  (`talentMaxReached`), puis l'un de ceux-là. */
function talentTire(c: Combatant, slots: CareerSlot[], rng: RNG): RefDesignee | undefined {
  const offerts = slots.map((s) => candidatsDuSlot(s).map(parseRefKey).filter((r) => !talentMaxReached(c, r.id, r.spec))).filter((l) => l.length);
  return tirer(tirer(offerts, rng) ?? [], rng);
}

/** Le PNJ `c`, profil de base en main, porté au parcours `p` (EDO 11 l.19) : pour chaque Niveau atteint de chaque
 *  carrière, +5 à chaque Caractéristique et Compétence disponible (R1, R2), au moins un Talent du Niveau ; puis la
 *  carrière actuelle et son Niveau (Statut, LDB 08 l.9), les dotations de ses Niveaux 1 à N en objets (R3, R4), et ses
 *  Blessures recalées sur le profil (`blessuresReconciliees`). Mute `c`. */
export function porterAuParcours(c: Combatant, p: ParcoursDeCarriere): void {
  for (const [id, niveau] of Object.entries(p.carrieres)) {
    const levels = levelsForCareer(id);
    for (let n = 1; n <= niveau; n++) for (const k of new Set(availableChars(levels, n))) c.characteristics[k] += 5;
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
    for (const s of slots) {
      const k = s.needsChoice ? designations[s.key] : candidatsDuSlot(s)[0];
      if (k && !premierNiveau.has(k)) premierNiveau.set(k, s.level);
    }
    for (const [k, depuis] of premierNiveau) augmenterLaCompetence(c.skills, parseRefKey(k), 5 * (niveau - depuis + 1));
  }
  for (const [id, niveau] of Object.entries(p.carrieres)) {
    const levels = levelsForCareer(id);
    const choisis = p.talentsDeCarriere?.[id] ?? [];
    const rngTalents = fluxDuPnj(c.id, id, 'talents');
    for (let n = 1; n <= niveau; n++) {
      const ici = choisis.filter((t) => niveauDuTalent(levels, niveau, t) === n);
      const tire = ici.length ? undefined : talentTire(c, talentSlots(levels, n), rngTalents);
      for (const t of tire ? [tire] : ici) if (acquerirTalent(c, t)) applyTalentAcquisition(c, t.id, t.spec);
    }
  }
  const actuelle = carriereActuelle(p)!;
  c.career = actuelle.id;
  c.careerLevel = actuelle.niveau;
  c.careerHistory = Object.keys(p.carrieres);
  const dotations = dotationsDuPnj(actuelle.id, actuelle.niveau);
  const rngDotations = fluxDuPnj(c.id, actuelle.id, 'dotations');
  let n = 0;
  c.items = buildInventory(resolveTrappingChoices(dotations, choixCompletes(dotations, p.dotationsDeCarriere ?? {}, rngDotations)), rngDotations, () => `${c.id}-dotation-${n++}`, contexteDeNaissanceDObjet(c));
  c.wounds = blessuresReconciliees(c);
}

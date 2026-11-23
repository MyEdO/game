/**
 * Les héros hors d'une partie : la recrue que le moteur crée, ses Caractéristiques, ses libellés.
 */
import { CAREER_SKILL_ADVANCES, CAREER_SKILLS_ADVANCED, competencesDeCarriere, createHero, designer, libreDEspece, type CreateHeroOptions } from '../../../src/engine/character';
import { adresseDeCreation, type AdresseDeCreation } from '../../../src/engine/adresseDeCreation';
import { designateSlot, skillSlots, slotCovers } from '../../../src/engine/careerSlots';
import { fabriqueLocale } from '../../../src/engine/fabriqueDId';
import { effectiveChar } from '../../../src/engine/characteristics';
import { raisonVerrouEtat } from '../../../src/engine/conditions';
import { findCareerById, findSpeciesById, levelsForCareer, characteristics, conditionLabel, refLabel, skills, carrieresAleatoires, colonneDeCarrieres, especesAleatoires } from '../../../src/data';
import type { RNG } from '../../../src/engine/dice';
import type { Combatant, CharKey, ConditionInstance } from '../../../src/engine/types';
import type { RefDesignee } from '../../../src/data/schemas/grammaire/ref';
import { progression } from './carriere';

/** La spécialisation `spec` de la Compétence `id` désignée à l'emplacement « (Au choix) » du niveau `niveau`. */
export interface Designation { niveau: number; id: string; spec: string }
/** Ce qui fait l'identité d'une recrue à sa création : le Talent de carrière choisi (et sa spécialisation : le dieu
 *  d'un Béni), les Sorts mineurs d'un lanceur, et les emplacements « (Au choix) » de Compétence désignés. */
export interface Identite { talent: { id: string; spec?: string }; sortsMineurs?: readonly string[]; designations?: readonly Designation[] }

/** Un héros neuf de la carrière `carriere`, tiré par la création du moteur (`createHero`) à la graine `graine` : une
 *  désignation du niveau 1 passe par la création (`specChoices`), une autre se pose par `designateSlot`. Ses
 *  Augmentations de création suivent `alignement`, lu sur un premier tirage à la même graine. LDB 05 l.535 */
export function nouvelleRecrue(graine: number, carriere: string, espece: string, nom: string, identite: Identite, utile: (ref: RefDesignee) => boolean): Combatant {
  const niveaux = levelsForCareer(carriere);
  const premier = niveaux.find((l) => l.level === 1)?.skills ?? [];
  const designations = identite.designations ?? [];
  const specChoices: Record<AdresseDeCreation, string> = {};
  for (const d of designations.filter((x) => x.niveau === 1)) {
    const i = premier.findIndex((r) => 'id' in r && r.id === d.id && r.choix != null);
    if (i < 0) throw new Error(`Désignation ${d.id} (${d.spec}) : aucun emplacement « (Au choix) » au niveau 1 de ${carriere}.`);
    specChoices[adresseDeCreation.carriereCompetence(i)] = d.spec;
  }
  const emplacements = skillSlots(niveaux, Math.max(...niveaux.map((l) => l.level)));
  const creer = (augmentations: Augmentations): Combatant => {
    const c = createHero({
      idNeuf: fabriqueLocale(`r${graine}`), speciesId: espece, careerId: carriere, label: nom, seed: graine, specChoices,
      careerTalent: identite.talent, ...(identite.sortsMineurs ? { pettySpells: [...identite.sortsMineurs] } : {}), ...augmentations,
    });
    for (const d of designations.filter((x) => x.niveau > 1)) {
      const slot = emplacements.find((s) => s.needsChoice && s.level === d.niveau && slotCovers(s, d.id, d.spec));
      const r = slot ? designateSlot(c, carriere, slot, d.id, d.spec, emplacements) : { ok: false, reason: 'aucun emplacement' };
      if (!r.ok) throw new Error(`Désignation ${d.id} (${d.spec}) au niveau ${d.niveau} de ${carriere} : ${r.reason}.`);
    }
    return c;
  };
  return creer(alignement(creer({}), espece, specChoices, utile));
}

/** Les Augmentations gratuites de Caractéristique de la création. LDB 05 l.459 */
const AUGMENTATIONS_DE_CARACTERISTIQUE = 5;
type Augmentations = Pick<CreateHeroOptions, 'charAdvancesAlloc' | 'skillAdvances' | 'speciesSkillAdvances'>;

/** Les Augmentations de création du héros `brouillon`, qui laissent chaque Caractéristique et chaque Compétence que sa
 *  carrière offre à son sommet (`progression`) à un multiple du pas (`PAS`) :
 *  - Caractéristique : toutes sur celle du niveau 1 qui porte le plus de Compétences `utile` offertes, la première du
 *    niveau à égalité (LDB 05 l.459) ;
 *  - espèce : les +3 sur celles qu'aucun emplacement de la carrière ne couvre, puis celles que seul un emplacement
 *    « (Au choix) » non désigné couvre, jamais une offerte ; les +5 sur les offertes `utile` d'abord (LDB 05 l.484) ;
 *  - carrière : une part égale par Compétence du niveau 1, les `utile` d'abord (LDB 05 l.535 ; AA 02 l.134). */
function alignement(brouillon: Combatant, espece: string, specChoices: Record<AdresseDeCreation, string>, utile: (ref: RefDesignee) => boolean): Augmentations {
  const carriere = brouillon.career ?? '';
  const niveaux = levelsForCareer(carriere);
  const sommet = Math.max(...niveaux.map((l) => l.level));
  const premier = niveaux.find((l) => l.level === 1);
  const offertes = progression({ ...brouillon, careerLevel: sommet }).competences.map((k) => k.ref);
  const offerte = (r: RefDesignee) => offertes.some((o) => o.id === r.id && (o.spec ?? '') === (r.spec ?? ''));
  const emplacements = skillSlots(niveaux, sommet);
  const couverte = (r: RefDesignee) => emplacements.some((s) => slotCovers(s, r.id, r.spec));
  const parRang = <T>(liste: readonly T[], rang: (x: T) => number): T[] => [...liste].sort((a, b) => rang(a) - rang(b));

  const portees = (k: CharKey) => offertes.filter((r) => utile(r) && ficheDeCompetence(r.id).carac === k).length;
  const caracteristique = (premier?.characteristics ?? []).reduce((m, k) => (portees(k) > portees(m) ? k : m));

  const sp = findSpeciesById(espece);
  if (!sp) throw new Error(`Espèce inconnue : ${espece}`);
  const designees: RefDesignee[] = [];
  for (const a of sp.skills) if ('id' in a) designees.push(designer('skill', a, undefined, libreDEspece(sp, a, designees)));
  const plus3 = parRang(designees, (r) => (offerte(r) ? 2 : couverte(r) ? 1 : 0)).slice(0, 3);
  if (plus3.some(offerte)) throw new Error(`${carriere} × ${espece} : moins de 3 Compétences d'espèce hors de la carrière (LDB 05 l.484).`);
  const plus5 = parRang(designees.filter((r) => !plus3.includes(r)), (r) => (offerte(r) ? (utile(r) ? 0 : 1) : 2)).slice(0, 3);

  const dotees = parRang(competencesDeCarriere(premier, brouillon, specChoices).filter((e) => !e.ajout), (e) => (utile(e.designee ?? e.ref) ? 0 : 1)).slice(0, CAREER_SKILLS_ADVANCED);
  return {
    charAdvancesAlloc: { [caracteristique]: AUGMENTATIONS_DE_CARACTERISTIQUE },
    speciesSkillAdvances: { plus5, plus3 },
    skillAdvances: Object.fromEntries(dotees.map((e) => [e.cle, CAREER_SKILL_ADVANCES / CAREER_SKILLS_ADVANCED])),
  };
}

/** Une espèce de `especes` tirée pour la carrière `carriere` : parmi celles dont la colonne du Tableau des Classes et
 *  Carrières aléatoires porte la carrière, ou porte celle de sa variante quand la carrière admet leur race, ou, pour
 *  une carrière qu'aucun tableau ne porte, dont la carrière admet la race, au poids de leur rangée au Tableau des
 *  Races aléatoires. LDB 05 l.214-299 ; AA 02 l.109-128 ; LDB 04 l.93-101 */
export function tirerUneEspece(rng: RNG, carriere: string, especes: readonly string[]): string {
  const variante = carrieresAleatoires.find((d) => d.kind === 'variante' && d.entries.some((r) => r.id === carriere));
  const tabulee = carrieresAleatoires.some((d) => d.entries.some((r) => r.id === carriere));
  const races = findCareerById(carriere)?.races;
  const permise = (id: string) => {
    const sp = findSpeciesById(id);
    if (!sp) return false;
    if (!tabulee) return races?.includes(sp.refChar) ?? false;
    const colonne = colonneDeCarrieres(sp.refCareer).entries;
    return colonne.some((r) => r.id === carriere) || (!!variante && variante.kind === 'variante' && colonne.some((r) => r.id === variante.carriere) && (races?.includes(sp.refChar) ?? true));
  };
  const rangees = especesAleatoires.find((t) => t.id === 'races-ldb')!.entries.filter((r) => especes.includes(r.id) && permise(r.id));
  let jet = rng.int(1, rangees.reduce((n, r) => n + r.max - r.min + 1, 0));
  return rangees.find((r) => (jet -= r.max - r.min + 1) <= 0)!.id;
}

/** Valeur courante d'une Caractéristique, Augmentations et effets compris. */
export const carac = (c: Combatant, k: CharKey): number => effectiveChar(c, k);


/** Hors de combat : à 0 PB ou Inconscient. */
export const horsDeCombat = (c: Combatant): boolean => !!c.dead || c.wounds.current <= 0 || c.conditions.some((e) => e.id === 'inconscient');

/** Libellé d'une carrière (`careers.json`). */
export const nomDeCarriereDuLivre = (id: string): string => findCareerById(id)?.label ?? id;

/** Ce que le livre dit d'une Caractéristique (`characteristics.json`), verbatim. */
export const texteDeCarac = (k: CharKey): string => characteristics.find((x) => x.id === k)?.desc ?? '';
/** Ce que le livre dit d'une Compétence (`skills.json`) : son texte verbatim, et la Caractéristique qui la porte. */
export function ficheDeCompetence(id: string): { texte: string; carac?: CharKey } {
  const d = skills.find((x) => x.id === id);
  return { texte: d?.desc ?? '', ...(d?.characteristic ? { carac: d.characteristic as CharKey } : {}) };
}

/** D'où vient l'État porté `e`, tel que le noyau le dit sur le héros : le fait qui le porte (`derivedFrom`, symptôme,
 *  mutation, trait…), le verrou qui le retient (`raisonVerrouEtat`), sa durée en Rounds, l'effet actif qui le repose
 *  à chaque Round (`opsPerRound`), et pour l'Inconscient les 0 Blessure (LDB 18 l.15). Vide quand le noyau ne dit rien
 *  de sa cause. */
export function causesDEtat(c: Combatant, e: ConditionInstance): string[] {
  const src = e.derivedFrom?.src;
  const verrou = raisonVerrouEtat(e, c);
  return [
    ...(src ? [`Porté par : ${refLabel(src.category, { id: src.id })}.`] : []),
    ...(verrou ? [verrou] : []),
    ...(e.roundsLeft != null ? [`Encore ${e.roundsLeft} Round${e.roundsLeft > 1 ? 's' : ''}.`] : []),
    ...(c.activeEffects ?? []).filter((x) => x.opsPerRound?.some((o) => o.op === 'condition' && o.id.id === e.id))
      .map((x) => `Reposé à chaque fin de Round par ${x.label}${x.duration.scale === 'rounds' ? `, encore ${x.duration.left} Round${x.duration.left > 1 ? 's' : ''}` : ''}.`),
    ...(e.id === 'inconscient' && c.wounds.current <= 0 ? ['À 0 Blessure.'] : []),
  ];
}

/** Libellé d'un État porté (`etats.json`), sa valeur comprise. */
export const libelleDEtat = (id: string, valeur: number): string => {
  const nom = conditionLabel(id);
  return valeur > 1 ? `${nom} ${valeur}` : nom;
};

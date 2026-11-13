/**
 * LE HÉROS D'UNE FICHE IMPRIMÉE (prétiré officiel) : Caractéristiques, Compétences, Talents, possessions, sorts et
 * parcours de carrière tels que la fiche les imprime, assemblés par `assemblerLeHeros`, sans aucun tirage.
 */
import type { Combatant, Characteristics, CharKey, HeroDetails, ItemInstance, SkillInstance } from './types';
import { CHAR_KEYS } from './types';
import type { RefDesignee } from '../data/schemas/grammaire/ref';
import { findSpeciesById, levelsForCareer } from '../data';
import { acquerirTalent, freeSlotFor, refKey, skillSlots, talentSlots, talentSlotsUpTo, type PorteurDeTalents } from './careerSlots';
import { assemblerLeHeros, augmenterLaCompetence, type CreateHeroOptions } from './character';
import { carriereActuelle, designationsDeCarriere, refusDuParcours, talentsDuParcours, type ParcoursDeCarriere } from './pnjDeCarriere';
import { contexteDeNaissanceDObjet, customTrapping, inventaireDesDotations, type DotationResolue } from './items';
import { baseWithTalents, talentCharBonusById } from './talentEffects';
import type { FabriqueDId } from './fabriqueDId';
import { tableTotale } from '../lib/tableTotale';

/** Une fiche de héros imprimée, en ids. */
export interface FicheDeHeros {
  speciesId: string;
  /** Chaque carrière au Niveau atteint, dans l'ordre du parcours : la dernière est la carrière actuelle. */
  parcours: Pick<ParcoursDeCarriere, 'carrieres'>;
  id: string;
  label: string;
  /** La ligne « Initiales » imprimée : les +N des Talents y sont déjà comptés. */
  initiales: Characteristics;
  /** La ligne « Augmentation ». */
  charAdvances: Partial<Record<CharKey, number>>;
  skills: readonly (RefDesignee & { advances: number })[];
  talents: readonly (RefDesignee & { times: number })[];
  /** Possessions, chacune à sa quantité imprimée : un objet du catalogue avec ses Atouts attachés, ou la ligne de la
   *  fiche hors catalogue. */
  trappings: readonly (((RefDesignee & Pick<DotationResolue['ref'], 'qualities'>) | { text: string }) & { qte: number })[];
  /** Tous les sorts de la fiche, Bénédictions comprises. */
  spells: readonly string[];
  fate: number;
  resilience: number;
  xp: number;
  motivation?: string;
  details?: HeroDetails;
  apparence?: CreateHeroOptions['apparence'];
}

/** Les désignations des emplacements « (Au choix) » de chaque carrière du parcours de `fiche`, Niveaux 1 à N : ses
 *  Compétences (`designationsDeCarriere`), et ses Talents au premier Niveau qui les offre (`talentsDuParcours`). */
function designationsDeLaFiche(fiche: FicheDeHeros): Combatant['careerSlotChoices'] {
  const { carrieres } = fiche.parcours;
  const talents = fiche.talents.map(({ id, spec }) => ({ id, spec }));
  const { niveaux } = talentsDuParcours({ carrieres, talentsDeCarriere: tableTotale(Object.keys(carrieres), () => talents) });
  const out: NonNullable<Combatant['careerSlotChoices']> = {};
  for (const [carriere, niveau] of Object.entries(carrieres)) {
    const levels = levelsForCareer(carriere);
    const { designations } = designationsDeCarriere(carriere, niveau, fiche.skills);
    const tous = [...skillSlots(levels, niveau), ...talentSlotsUpTo(levels, niveau)];
    niveaux[carriere].forEach(({ choisis }, i) => {
      for (const r of choisis) {
        const slot = freeSlotFor(talentSlots(levels, i + 1), designations, r.id, r.spec, tous);
        if (slot) designations[slot.key] = refKey(r.id, r.spec);
      }
    });
    if (Object.keys(designations).length) out[carriere] = designations;
  }
  return Object.keys(out).length ? out : undefined;
}

/** Les objets des possessions de `fiche` : ceux du catalogue par `inventaireDesDotations`, chaque ligne hors
 *  catalogue en objet sans stats (`customTrapping`), autant de fois que sa quantité. */
function inventaireDeLaFiche(fiche: FicheDeHeros, carriere: string, idNeuf: FabriqueDId): ItemInstance[] {
  const catalogue: DotationResolue[] = [];
  const horsCatalogue: string[] = [];
  for (const { qte, ...p } of fiche.trappings) {
    if ('text' in p) horsCatalogue.push(...Array<string>(qte).fill(p.text));
    else catalogue.push({ ref: p, n: qte });
  }
  return [
    ...inventaireDesDotations(catalogue, idNeuf, contexteDeNaissanceDObjet({ species: fiche.speciesId, career: carriere })),
    ...horsCatalogue.map((texte) => customTrapping(texte, idNeuf)),
  ];
}

/** Le héros de la fiche imprimée `fiche`, sans aucun tirage ; `idNeuf` forge les uids de ses objets. Les
 *  Caractéristiques stockées sont les Initiales sans les `charMod` des Talents (`baseWithTalents`), Augmentations
 *  comprises (LDB 05 l.463). */
export function heroDeFiche(fiche: FicheDeHeros, idNeuf: FabriqueDId): Combatant {
  const espece = findSpeciesById(fiche.speciesId);
  if (!espece) throw new Error(`Espèce inconnue : ${fiche.speciesId}`);
  const refus = refusDuParcours(fiche.parcours);
  if (refus) throw new Error(`Fiche « ${fiche.id} » : ${refus}`);
  const actuelle = carriereActuelle(fiche.parcours)!;

  // Les Initiales imprimées comptent déjà les `charMod` des Talents (EDOC 16 l.494) : retirés AVANT l'acquisition, dont le
  // Maxi (LDB 10 l.17) les relit par `baseWithTalents`.
  const characteristics = { ...fiche.initiales };
  for (const k of CHAR_KEYS) characteristics[k] += fiche.charAdvances[k] ?? 0;
  const imprimes = { characteristics: { ...characteristics }, talents: fiche.talents.map((t) => ({ talentId: t.id, ...(t.spec ? { spec: t.spec } : {}), times: t.times })) };
  for (const k of CHAR_KEYS) characteristics[k] -= baseWithTalents(imprimes, k) - imprimes.characteristics[k];
  const porteur: PorteurDeTalents = { characteristics, talents: [] };
  const charModEnTete = [...fiche.talents].sort((a, b) => Number(talentCharBonusById(b.id) !== null) - Number(talentCharBonusById(a.id) !== null));
  const rang = (id: string, spec?: string): number => fiche.talents.findIndex((t) => refKey(t.id, t.spec) === refKey(id, spec));
  for (const t of charModEnTete) {
    for (let i = 0; i < t.times; i++) if (!acquerirTalent(porteur, t)) throw new Error(`Fiche « ${fiche.id} » : Talent « ${refKey(t.id, t.spec)} » au-delà de son Maxi (LDB 10 l.18).`);
  }
  const talents = [...(porteur.talents ?? [])].sort((a, b) => rang(a.talentId, a.spec) - rang(b.talentId, b.spec));

  const skills: SkillInstance[] = [];
  for (const s of fiche.skills) augmenterLaCompetence(skills, s, s.advances);

  return assemblerLeHeros({
    espece: structuredClone(espece), // #2097
    career: actuelle.id,
    careerLevel: actuelle.niveau,
    careerHistory: Object.keys(fiche.parcours.carrieres),
    id: fiche.id,
    label: fiche.label,
    characteristics,
    charAdvances: { ...fiche.charAdvances },
    talents,
    skills,
    items: inventaireDeLaFiche(fiche, actuelle.id, idNeuf),
    careerSlotChoices: designationsDeLaFiche(fiche),
    fate: fiche.fate,
    resilience: fiche.resilience,
    spells: fiche.spells,
    xp: fiche.xp,
    details: fiche.details,
    motivation: fiche.motivation,
    apparence: fiche.apparence,
  });
}

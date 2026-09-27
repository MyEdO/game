import { createHero, skillCharacteristicById } from '../../engine/character';
import { acquerirTalent, availableChars, memeRef, skillSlots, talentSlots } from '../../engine/careerSlots';
import { careerCompletionAdvances, talentCost } from '../../engine/advancement';
import { makeRNG } from '../../engine/dice';
import { grantTrait } from '../../engine/grantedTraits';
import type { Combatant } from '../../engine/types';
import { levelsForCareer, rigSpeciesId } from '../../data';
import { arena } from './_shared';
import type { TestScenario } from './_shared';
import type { Scene } from '../../state/scene';

/**
 * Porte « Niveau complet » : LDB 07 l.124. Trois Agitateurs au Niveau 1, Caractéristiques et 8 Compétences de
 * carrière au seuil (`careerCompletionAdvances`), sans Talent du Niveau ; chacun a les PX d'UN Talent.
 * Ajout dans la carrière : LDB 10 l.467 ; comme en carrière : EDOC 13 l.524.
 */

const CARRIERE = 'agitateur';
const NIVEAU = 1;

/** Agitateur au seuil de LDB 07 l.124 sauf le Talent : Caractéristiques et Compétences de carrière posées au
 *  seuil, Talents du Niveau retirés, PX d'un Talent. */
function auSeuil(id: string, label: string, graine: number): Combatant {
  const h = createHero({ speciesId: 'humains-reiklander', careerId: CARRIERE, label, motivation: 'Progresser', rng: makeRNG(graine), id });
  const niveaux = levelsForCareer(CARRIERE);
  const seuil = careerCompletionAdvances(NIVEAU);
  for (const k of availableChars(niveaux, NIVEAU)) {
    const manque = seuil - (h.charAdvances?.[k] ?? 0);
    if (manque <= 0) continue;
    h.charAdvances = { ...(h.charAdvances ?? {}), [k]: seuil };
    h.characteristics[k] += manque;
  }
  for (const slot of skillSlots(niveaux, NIVEAU).filter((s) => !s.needsChoice && s.options[0].optionId).slice(0, 8)) {
    const { optionId, spec } = slot.options[0];
    const connue = h.skills.find((s) => memeRef(s, { id: optionId!, spec }));
    if (connue) connue.advances = Math.max(connue.advances, seuil);
    else h.skills.push({ id: optionId!, ...(spec != null ? { spec } : {}), characteristic: skillCharacteristicById(optionId!), advances: seuil });
  }
  const duNiveau = talentSlots(niveaux, NIVEAU).flatMap((s) => s.options.map((o) => o.optionId));
  h.talents = h.talents.filter((t) => !duNiveau.includes(t.talentId));
  h.xp = talentCost(0);
  h.appearance = { species: rigSpeciesId('humains-reiklander'), sex: 'M', build: 0.5 };
  return h;
}

function groupe(): Combatant[] {
  const carriere = auSeuil('nc-carriere', 'Agitateur (Talent de carrière)', 7101);
  const tzeentch = auSeuil('nc-tzeentch', 'Agitateur (Marque de Tzeentch)', 7102);
  grantTrait(tzeentch, { id: 'marque-de-tzeentch' });
  const flagellant = auSeuil('nc-flagellant', 'Agitateur (Flagellant)', 7103);
  acquerirTalent(flagellant, { id: 'flagellant' });
  return [carriere, tzeentch, flagellant];
}

function construireScene(): Scene {
  const scene = arena({ id: 'niveau-complet', label: 'Niveau complet' });
  scene.startMessage =
    "Trois Agitateurs au seuil de leur Niveau 1 (Caractéristiques et 8 Compétences), sans Talent du Niveau. Fiche → " +
    "Avancement : le 1er achète un Talent de carrière (Niveau complet), le 2e un Talent de la Marque de Tzeentch " +
    "(Niveau incomplet), le 3e Frénésie, ajoutée par Flagellant (Niveau complet).";
  return scene;
}

export const scenario: TestScenario = {
  id: 'niveau-complet',
  order: 7,
  category: 'progression',
  icon: 'scenario/training',
  title: 'Niveau de Carrière complet (LDB 07 l.124)',
  tests:
    'Porte « Niveau complet » (`isCareerLevelComplete`, LDB 07 l.124) à l’onglet Avancement : un Talent de ' +
    'carrière la franchit ; un Talent acheté comme en carrière (Marque de Tzeentch, EDOC 13 l.524) la laisse ' +
    'fermée ; un Talent ajouté à la carrière (Frénésie par Flagellant, LDB 10 l.467) la franchit — un achat chacun, ' +
    'provenance de l’ajout affichée sur sa rangée.',
  partyNote: 'Trois Agitateurs Niveau 1 au seuil, sans Talent du Niveau, les PX d’un Talent chacun : Talent de carrière · Marque de Tzeentch · Flagellant',
  construire: () => ({ party: groupe(), scene: construireScene() }),
};

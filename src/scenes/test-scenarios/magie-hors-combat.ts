import { pregenParty, PREGEN } from '../../data/pregens';
import { buildScene } from '../../state/mapSpec';
import { boostSkill } from './_casters';
import type { TestScenario } from './_shared';
import type { Scene } from '../../state/scene';
import type { Combatant } from '../../engine/types';

const construireScene = (): Scene => buildScene({
  id: 'test-magie-hors-combat',
  label: 'Magie — incantation hors combat',
  desc: 'Arène de test.',
  size: [14, 9],
  heroStart: [2, 4],
  startMessage:
    'Exploration (aucun combat). Cliquez une fiche de lanceur → section « Sorts » : soignez/bénissez ' +
    'l’allié blessé (Prêtre), puis « Focaliser » et « Lancer » un Sort d’Arcane (Sorcier). ' +
    'Les Projectiles magiques restent marqués « en combat ».',
});

export const scenario: TestScenario = {
  id: 'magie-hors-combat',
  order: 4,
  category: 'magie',
  icon: 'scenario/magic-field',
  title: 'Magie hors combat',
  tests: 'Incantation HORS COMBAT depuis la fiche : soin/bénédiction (Prêtre), Focalisation + Sort d’Arcane (Sorcier), refus des Projectiles magiques.',
  partyNote: 'Wilhelmina (Sorcier, +Armure Aethyrique, blessée) + Frère Anselm (Prêtre)',
  construire: () => ({ party: groupe(), scene: construireScene() }),
  // pas d'autoCombat : on teste l'incantation EN EXPLORATION (depuis la fiche de personnage).
};

function groupe(): Combatant[] {
  const [wiz, priest] = pregenParty(PREGEN.sorcier, PREGEN.pretre);
  // Sorcier : ajoute un Sort d'Arcane FOCALISABLE (les sorts pré-tirés Fléchette/Choc sont de la
  // Magie mineure, NON focalisable) pour exercer le bouton « Focaliser » hors combat.
  if (!wiz.spells?.includes('armure-aethyrique')) wiz.spells = ['armure-aethyrique', ...(wiz.spells ?? [])];
  boostSkill(wiz, 'langue', 'magick', 'intelligence', 5); // incantation des Arcanes
  boostSkill(wiz, 'focalisation', undefined, 'force-mentale', 5); // Test étendu de Focalisation
  // Bénédiction de Guérison : culte de Shallya (LDB 21), PAS Sigmar (gods.json id « sigmar » — les
  // SIX bénédictions RAW sont bataille/courage/droiture/puissance/protection/vigueur, #421). Ajout
  // AD HOC scénario (même patron que l'Armure Aethyrique du Sorcier ci-dessus) pour démontrer le
  // bouton « Bénédiction de soin » hors combat, sans reforger le culte du pré-tiré.
  if (!priest.spells?.includes('benediction-de-guerison')) priest.spells = ['benediction-de-guerison', ...(priest.spells ?? [])];
  boostSkill(priest, 'priere', undefined, 'sociabilite', 5); // Bénédictions
  // Un allié BLESSÉ → cible visible pour la Bénédiction de Guérison (+1 PB) du Prêtre.
  wiz.wounds.current = Math.max(1, wiz.wounds.max - 4);
  return [wiz, priest];
}

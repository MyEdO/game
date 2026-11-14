import type { FabriqueDId } from '../../engine/fabriqueDId';
import { groupeDeScenario } from './_heros';
import { buildScene } from '../../noyau/mapSpec';
import type { TestScenario } from './_shared';
import { boostSkill } from './_casters';
import { t } from '../../i18n';
import type { Scene } from '../../noyau/monde/scene';
import type { Combatant, CharKey } from '../../engine/types';
import type { RefDesignee } from '../../data/schemas/grammaire/ref';

/** Garantit qu'un héros peut TENTER une Compétence d'incantation (avancée ≥ 1, LDB 09-Compétences) —
 *  fixture de vérif : un pré-tiré peut avoir la Compétence à 0 avance (donc non tentable). */
const ensureSkill = (h: Combatant, ref: RefDesignee, characteristic: CharKey): void => boostSkill(h, ref, characteristic, 5);

const construireScene = (): Scene => buildScene({
  id: 'test-magie-hors-combat',
  label: 'Magie — incantation hors combat',
  desc: 'Arène de test.',
  size: [14, 9],
  heroStart: [2, 4],
  startMessage:
    { texte: `Exploration (aucun combat). Cliquez une fiche de lanceur → onglet « ${t('sheet.tab.magie')} » : soignez/bénissez ` +
    'l’allié blessé (Prêtre), puis « Focaliser » et « Lancer » un Sort d’Arcane (Sorcier). ' +
    'Les Projectiles magiques restent marqués « en combat ».' },
});

export const scenario: TestScenario = {
  id: 'magie-hors-combat',
  order: 4,
  category: 'magie',
  icon: 'scenario/magie-hors-combat',
  title: 'Magie hors combat',
  tests: 'Incantation HORS COMBAT depuis la fiche : soin/bénédiction (Prêtre), Focalisation + Sort d’Arcane (Sorcier), refus des Projectiles magiques.',
  partyNote: 'Sorcier ( +Armure Aethyrique, blessée) + Prêtre (Prêtre)',
  construire: (idNeuf) => ({ party: groupe(idNeuf), scene: construireScene() }),
  // pas d'autoCombat : on teste l'incantation EN EXPLORATION (depuis la fiche de personnage).
};

function groupe(idNeuf: FabriqueDId): Combatant[] {
  const [wiz, priest] = groupeDeScenario(idNeuf, 'sorcier', 'pretre');
  // Sorcier : ajoute un Sort d'Arcane FOCALISABLE (les sorts pré-tirés Fléchette/Choc sont de la
  // Magie mineure, NON focalisable) pour exercer le bouton « Focaliser » hors combat.
  if (!wiz.spells?.includes('armure-aethyrique')) wiz.spells = ['armure-aethyrique', ...(wiz.spells ?? [])];
  ensureSkill(wiz, { id: 'langue', spec: 'magick' }, 'intelligence'); // incantation des Arcanes
  ensureSkill(wiz, { id: 'focalisation' }, 'force-mentale'); // Test étendu de Focalisation
  // Bénédiction de Guérison : culte de Shallya (LDB 21), PAS Sigmar (gods.json id « sigmar » — les
  // SIX bénédictions RAW sont bataille/courage/droiture/puissance/protection/vigueur, #421). Ajout
  // AD HOC scénario (même patron que l'Armure Aethyrique du Sorcier ci-dessus) pour démontrer le
  // bouton « Bénédiction de soin » hors combat, sans reforger le culte du pré-tiré.
  if (!priest.spells?.includes('benediction-de-guerison')) priest.spells = ['benediction-de-guerison', ...(priest.spells ?? [])];
  ensureSkill(priest, { id: 'priere' }, 'sociabilite'); // Bénédictions
  // Un allié BLESSÉ → cible visible pour la Bénédiction de Guérison (+1 PB) du Prêtre.
  wiz.wounds.current = Math.max(1, wiz.wounds.max - 4);
  return [wiz, priest];
}

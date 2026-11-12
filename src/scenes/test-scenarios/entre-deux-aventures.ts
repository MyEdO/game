import type { FabriqueDId } from '../../engine/fabriqueDId';
import { createHero } from '../../engine/character';
import type { Combatant } from '../../engine/types';
import { buildScene } from '../../noyau/mapSpec';
import type { Scene } from '../../noyau/monde/scene';
import { especeDApparence } from '../../data';
import { renforcerCompetence, type TestScenario } from './_shared';

/**
 * « Entre deux aventures » (LDB 23) : un interlude ouvert au lancement, sans bataille. Le forgeron, Métier en main et
 * bourse pleine, peut engager un ouvrage d'Artisanat (ses Atouts et Défauts visés) et déposer en banque ; la
 * marchande, de Statut Argent, peut investir.
 */
function groupe(idNeuf: FabriqueDId): Combatant[] {
  const forgeron = createHero({ idNeuf, speciesId: 'nains', careerId: 'artisan', label: 'Durin (forgeron)', motivation: 'Test', seed: 1602, id: 'durin' });
  renforcerCompetence(forgeron, 'metier', 10, 'forgeron');
  forgeron.appearance = { species: especeDApparence('nains'), sex: 'M' };
  const marchande = createHero({ idNeuf, speciesId: 'humains-reiklander', careerId: 'marchand', label: 'Hilde (marchande)', motivation: 'Test', seed: 1603, id: 'hilde' });
  marchande.appearance = { species: especeDApparence('humains-reiklander'), sex: 'F' };
  return [forgeron, marchande];
}

const construireScene = (): Scene => buildScene({
  id: 'test-entre-deux-aventures',
  label: 'Entre deux aventures — l’atelier',
  desc: 'Arène de test.',
  size: [12, 8],
  heroStart: [3, 4],
});

export const scenario: TestScenario = {
  id: 'entre-deux-aventures',
  order: 63,
  category: 'marche',
  icon: 'scenario/marche',
  title: 'Entre deux aventures',
  tests: 'Interlude ouvert au lancement : Activités par héros, ouvrage d’Artisanat à engager (Atouts et Défauts), dépôt en banque (investir, planquer).',
  partyNote: 'Durin (forgeron, Métier) · Hilde (marchande, Statut Argent)',
  money: { gold: 20, silver: 0, brass: 0 },
  interludeWeeks: 2,
  construire: (idNeuf) => ({ party: groupe(idNeuf), scene: construireScene() }),
};

/**
 * L'EFFET DE SCÈNE « NOUVEAU HÉROS » PAR LE PONT (#3556) : « Effets scriptés » joué comme Godot le joue. Le groupe
 * mené à l'avis d'enrôlement par un clic de case, son geste d'exploration joué : l'Effet `openCharacterCreator` émet
 * `EVT.HEROS_A_CREER`, et le pont ouvre la création comme « Nouveau héros », à sa première page, la partie intacte ;
 * rejoué la création ouverte, il la laisse telle quelle.
 */
import { describe, it, expect } from 'vitest';
import { drainer, table, enFocus } from './pont.testkit';
import { CLIC_DU_CHAMP } from '../../../src/noyau/index';
import type { Bouton } from '../../../src/hote/elements';

const { appel } = table();

describe('l’Effet de scène « nouveau héros » par le pont', () => {
  it('signer l’avis d’enrôlement ouvre la création sur un héros neuf', () => {
    let { suite } = drainer(appel, appel('demarrer', { scenario: 'effets-scriptes', graine: 7 }));
    while (suite.vue.projection.fenetre) ({ suite } = drainer(appel, appel('jouer', enFocus(suite.vue)!.jeu)));
    ({ suite } = drainer(appel, appel('jouer', { type: CLIC_DU_CHAMP, args: [{ x: 2, y: 6 }] })));
    const signer = suite.vue.zones['exploration.gestes'].find((b) => b.libelle.startsWith('Avis d’enrôlement'));
    expect(signer, 'à portée, l’avis offre son geste d’exploration').toBeDefined();
    expect(suite.vue.zones['creation.titre'], 'aucune création avant le geste').toEqual([]);
    const groupe = suite.vue.zones['groupe.heros'].map((c) => c.nom);

    ({ suite } = drainer(appel, appel('jouer', signer!.jeu)));
    expect(suite.vue.zones['creation.titre'][0]?.texte, 'la création ouverte à sa première page').toBe('Race · 1/10');
    expect(suite.vue.zones['groupe.gestes'].find((b) => b.id === 'creation')?.presse, 'comme par « Nouveau héros », son bouton pressé').toBe(true);
    expect(suite.vue.zones['groupe.heros'].map((c) => c.nom), 'la partie n’a pas changé de groupe').toEqual(groupe);

    const tirage = suite.vue.zones['creation.corps'].find((e): e is Bouton => e.type === 'bouton' && e.id === 'tirage')!;
    ({ suite } = drainer(appel, appel('creation', tirage.jeu)));
    const corps = suite.vue.zones['creation.corps'];
    expect(corps.some((e) => e.type === 'jet'), 'le d100 de la race tombé').toBe(true);
    ({ suite } = drainer(appel, appel('jouer', signer!.jeu)));
    expect(suite.vue.zones['creation.corps'], 'rejoué, la création ouverte reste telle quelle, son tirage gardé').toEqual(corps);
  });
});

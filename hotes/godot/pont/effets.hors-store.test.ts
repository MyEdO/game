/**
 * LES EFFETS PAR LE PONT (#3771, `CONTRAT.md`) : chaque `Suite` porte les effets de son appel (`effetsDeLAppel`), que
 * Godot rend tels quels. Une charge à l'arme de mêlée rend son coup, de l'attaquant à sa cible.
 */
import { describe, it, expect } from 'vitest';
import { drainer, table, type Reponse } from './pont.testkit';
import type { Effet } from '../../../src/noyau/index';
import type { Bouton } from '../../../src/hote/elements';
import { clicDuCombattant, type Suite } from './pont';

const { appel } = table();
const rendus: Effet[] = [];

/** Le geste joué, ses jetons repris, puis chaque fenêtre vidée par le geste que l'Entrée jouerait ; chaque effet
 *  rendu recueilli. */
function jouer(r: Reponse): Suite {
  let { suite, effets } = drainer(appel, r);
  rendus.push(...effets);
  for (let pas = 0; suite.vue.projection.fenetre; pas++) {
    expect(pas, 'les fenêtres se vident').toBeLessThan(20);
    ({ suite, effets } = drainer(appel, appel('jouer', suite.vue.zones['fenetre.gestes'].find((x): x is Bouton => x.type === 'bouton' && x.focus)!.jeu)));
    rendus.push(...effets);
  }
  return suite;
}

describe('les effets par le pont', () => {
  it('une charge rend le coup de l’attaquant à sa cible, son issue et son rendu résolus', { timeout: 120_000 }, () => {
    const debut = jouer(appel('demarrer', { scenario: 'dome', graine: 7 }));
    const heros = debut.vue.projection.combat!.actif!.id;
    const armee = jouer(appel('jouer', { type: 'armerLIntention', args: ['charge'] }));
    const [cible] = armee.vue.projection.combat!.cibles.liste;
    jouer(appel('jouer', clicDuCombattant(armee.vue, cible)));
    const coup = rendus.find((e) => e.quoi === 'coup' && e.de === heros);
    expect(coup, 'le coup du héros est dans la suite').toMatchObject({ quoi: 'coup', vers: cible, issue: expect.stringMatching(/^(touche|critique|pare|manque)$/), couleur: expect.stringMatching(/^#[0-9a-f]{6}$/), trajet: null });
    expect(coup!.quoi === 'coup' && coup!.arrivee?.son?.fichiers.length, 'son arrivée joue un son du registre').toBeGreaterThan(0);
  });
});

/**
 * LES EFFETS PAR LE PONT (#3771, `CONTRAT.md`) : chaque `Suite` porte les effets de son appel (`effetsDeLAppel`), que
 * Godot rend tels quels. Une charge à l'arme de mêlée rend son coup, de l'attaquant à sa cible. La vitrine de l'atelier
 * (#3777, `vitrine`) rend, hors partie, l'attaque de chaque engin de siège. Le coup dit ses flottants, le jet du joueur
 * ses dés, et la vue porte la musique de la partie (#3825).
 */
import { describe, it, expect } from 'vitest';
import { drainer, table, type Reponse } from './pont.testkit';
import { siegeEngines, type Effet, type VitrineDesEffets } from '../../../src/noyau/index';
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
  it('la vitrine rend, hors partie, l’attaque de chaque engin de siège', () => {
    const r = appel('vitrine');
    expect(r.ok).toBe(true);
    const vitrine = r as unknown as VitrineDesEffets;
    expect(Object.keys(vitrine.attaques).sort()).toEqual(siegeEngines().map((t) => t.id).sort());
    expect(vitrine.attaques['trebuchet-ade2']).toMatchObject({ quoi: 'coup', de: vitrine.de, vers: vitrine.vers, trajet: { projectile: 'pierre' } });
  });

  it('une charge rend le coup de l’attaquant à sa cible, son issue, son rendu et ses flottants ; le jet du joueur, ses dés ; la vue, la musique du combat', { timeout: 120_000 }, () => {
    const debut = jouer(appel('demarrer', { scenario: 'dome', graine: 7 }));
    expect(debut.vue.musique).toMatchObject({ cle: 'ctx:combat', pistes: [{ id: 'musique-combat' }] });
    const heros = debut.vue.projection.combat!.actif!.id;
    const armee = jouer(appel('jouer', { type: 'armerLIntention', args: ['charge'] }));
    const [cible] = armee.vue.projection.combat!.cibles.liste;
    jouer(appel('jouer', clicDuCombattant(armee.vue, cible)));
    const coup = rendus.find((e) => e.quoi === 'coup' && e.de === heros);
    expect(coup, 'le coup du héros est dans la suite').toMatchObject({ quoi: 'coup', vers: cible, issue: expect.stringMatching(/^(touche|critique|pare|manque)$/), couleur: expect.stringMatching(/^#[0-9a-f]{6}$/), trajet: null });
    expect(coup!.quoi === 'coup' && coup!.arrivee?.son?.fichiers.length, 'son arrivée joue un son du registre').toBeGreaterThan(0);
    expect(coup!.quoi === 'coup' && coup!.flottants.length, 'son arrivée dit son issue').toBeGreaterThan(0);
    expect(rendus.some((e) => e.quoi === 'son' && e.son.id === 'des'), 'le jet lancé fait rouler les dés').toBe(true);
  });
});

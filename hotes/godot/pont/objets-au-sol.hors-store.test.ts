/**
 * LES OBJETS AU SOL PAR LE PONT (#3741) : hors combat, la fiche d'un héros pose une possession au sol (« Poser au sol ») ;
 * un décor naît à la case du groupe et le monde se redessine (`plateau.cleDuMonde`) ; l'exploration offre de la
 * ramasser, et elle revient sur un héros du groupe.
 */
import { describe, it, expect } from 'vitest';
import { drainer, ficheDuHeros, sectionDeLaFiche, suiteDe, table, enFocus } from './pont.testkit';
import type { Suite } from './pont';
import type { Bouton, Entite, Jeu } from '../../../src/hote/elements';

const { appel } = table();

/** Un geste joué par le pont, ses jetons rejoués. */
const jouer = (jeu: Jeu): Suite => drainer(appel, appel('jouer', jeu)).suite;

/** Les possessions de la fiche du héros `libelle`, la fiche ouverte puis refermée. */
function possessionsDe(s: Suite, libelle: string): string[] {
  const h = ficheDuHeros(s.vue, libelle);
  const ouverte = suiteDe(appel('fiche', h.jeu));
  const libelles = (sectionDeLaFiche(ouverte.vue, 'possessions') as Bouton[]).map((p) => p.libelle);
  appel('fiche', { fiche: null });
  return libelles;
}

describe('les objets au sol par le pont', () => {
  it('posée depuis la fiche, une possession devient un décor du monde, et l’exploration la ramasse', () => {
    let { suite: s } = drainer(appel, appel('demarrer', { scenario: 'porte-close', graine: 7 }));
    while (s.vue.projection.fenetre) s = jouer(enFocus(s.vue)!.jeu);
    const avant = s.vue.plateau!.cleDuMonde;
    const rosa = ficheDuHeros(s.vue, 'Apothicaire');
    s = suiteDe(appel('fiche', rosa.jeu));
    const dague = (sectionDeLaFiche(s.vue, 'possessions') as Bouton[]).find((p) => p.libelle === 'Dague')!;
    s = suiteDe(appel('fiche', dague.jeu));
    const poser = (s.vue.zones['fiche.objet'] as Entite[])[0].elements.find((e) => e.id === 'poser') as Bouton;
    expect(poser, 'la possession choisie se pose au sol').toMatchObject({ type: 'bouton', libelle: 'Poser au sol', refus: null });
    s = jouer(poser.jeu);
    expect((sectionDeLaFiche(s.vue, 'possessions') as Bouton[]).map((p) => p.libelle), 'posée, elle quitte la fiche').not.toContain('Dague');
    s = suiteDe(appel('fiche', { fiche: null }));
    expect(s.vue.plateau!.cleDuMonde, 'un décor est né : le monde se redessine').not.toBe(avant);

    const ramasser = s.vue.zones['exploration.gestes'].find((b) => b.libelle === 'Dague : Ramasser');
    expect(ramasser, 'l’exploration offre de la ramasser').toBeDefined();
    s = jouer(ramasser!.jeu);
    expect(s.vue.zones['exploration.gestes'].map((b) => b.libelle), 'ramassée, l’offre sort').not.toContain('Dague : Ramasser');
    expect(s.vue.plateau!.cleDuMonde, 'et son décor avec elle').toBe(avant);
    const heros = s.vue.zones['groupe.heros'].map((c) => c.nom);
    expect(heros.flatMap((h) => possessionsDe(s, h)), 'elle revient sur un héros du groupe').toContain('Dague');
  });
});

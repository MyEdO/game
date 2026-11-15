/**
 * LE JOURNAL DATÉ PAR LE PONT (#3534) : le voyage de Weiler à Steinbruck joué comme Godot le joue ; chaque jour de jeu
 * s'ouvre sur sa date, une fois, dans l'ordre des jours, avant la première ligne écrite ce jour-là.
 */
import { afterEach, describe, it, expect } from 'vitest';
import { departDeLaCarte, drainer, table, gestesDessines } from './pont.testkit';
import type { Bouton, Ligne } from '../../../src/hote/elements';
import type { Pont, Suite } from './pont';

let ouvert: Pont | null = null;
afterEach(() => { ouvert?.appeler('quitter'); ouvert = null; });

describe('le journal daté par le pont', () => {
  it('le voyage écrit ses jours, chacun sa date en tête, dans l’ordre', () => {
    const { pont, appel } = table();
    ouvert = pont;
    const lignes: Ligne[] = [];
    const jouer = (methode: string, entree: unknown): Suite => {
      const d = drainer(appel, appel(methode, entree));
      lignes.push(...d.lignes);
      return d.suite;
    };
    let s = jouer('demarrer', { scenario: 'voyage', graine: 7 });
    const avancer = (jusqua?: string) => {
      for (let pas = 0; s.vue.projection.fenetre && s.vue.projection.fenetre.cle !== jusqua; pas++) {
        expect(pas, 'les fenêtres se vident').toBeLessThan(80);
        const g = gestesDessines(s.vue);
        s = jouer('jouer', (g.find((x): x is Bouton => x.type === 'bouton' && x.focus) ?? g.find((x): x is Bouton => x.type === 'bouton' && !x.refus)!).jeu);
      }
    };
    avancer();
    s = jouer('jouer', s.vue.zones['exploration.gestes'].find((b) => b.libelle === 'Carte du monde')!.jeu);
    s = jouer('jouer', departDeLaCarte(s.vue, 'r-grandroute', 'jourParJour').valeurs[0].jeu);
    avancer('ecranDuLieu');
    const jours = lignes.filter((l) => l.id.startsWith('journal/jour/'));
    const rangs = jours.map((l) => Number(l.id.split('/')[2]));
    expect(lignes[0].id, 'la première ligne est la date du premier jour').toMatch(/^journal\/jour\//);
    expect(rangs.length, 'le voyage passe plusieurs jours').toBeGreaterThan(1);
    expect(rangs, 'chaque jour une fois, dans l’ordre').toEqual([...rangs].sort((a, b) => a - b).filter((r, i, t) => t.indexOf(r) === i));
    expect(jours.every((l) => l.ton === 'alerte' && / \d{4} CI$/.test(l.texte)), 'la date dite, en alerte').toBe(true);
  });
});

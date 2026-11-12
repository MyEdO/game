/**
 * LA BATAILLE DE MASSE PAR LE PONT (#3328) : « Bataille de masse » joué comme Godot le joue, l'interlude clos. Chaque
 * armée et sa Puissance, chaque Scène du Round, son effet, ses postes et son engagement fermé par son verdict
 * (`batailleEnVue`) ; une Scène résolue tient la main par son jet, puis se ferme ; le Test spectaculaire ouvre
 * l'entre-deux-Rounds, et le Round suivant revient.
 */
import { describe, it, expect } from 'vitest';
import { drainer, table, enFocus } from './pont.testkit';
import type { Bouton, Choix, Element, Entite, Jauge } from '../../../src/hote/elements';
import type { Suite } from './pont';

const { appel } = table();
const jouer = (b: Bouton): Suite => drainer(appel, appel('jouer', b.jeu)).suite;
const focus = (suite: Suite): Bouton => enFocus(suite.vue)!;
const corps = (suite: Suite) => Object.fromEntries(suite.vue.zones['fenetre.corps'].map((e) => [e.id, e]));
const parId = (e: Entite) => Object.fromEntries(e.elements.map((x: Element) => [x.id, x]));

describe('la bataille de masse par le pont', () => {
  it('les armées, chaque Scène et ses postes ; une Scène résolue se ferme ; le Test spectaculaire, puis le Round suivant', () => {
    let suite = drainer(appel, appel('demarrer', { scenario: 'bataille-de-masse', graine: 7 })).suite;
    for (let pas = 0; suite.vue.disposition !== 'batailleDeMasse'; pas++) {
      expect(pas, 'l’interlude se clôt').toBeLessThan(15);
      suite = jouer(focus(suite));
    }
    let c = corps(suite);
    expect(c['bataille/round'], 'le Round').toMatchObject({ texte: 'Round de bataille 1 / 3' });
    expect(parId(c['armee/allie'] as Entite).puissance as Jauge, 'la Puissance alliée').toMatchObject({ courant: 50, texte: '50 · départ 50' });
    const tenue = parId(c['scene/tenez-votre-position'] as Entite);
    expect(tenue.position, 'la position tenue').toMatchObject({ libelle: 'Point de rupture 0/10' });
    expect((parId(c['scene/pluie-de-fleches'] as Entite).engager as Bouton).libelle, 'un combat engage tout le groupe, sans postes').toBe('Engager le combat');
    expect(parId(c['scene/pluie-de-fleches'] as Entite).postes, 'sans postes').toBeUndefined();

    const sigmund = (s: Suite) => (parId(corps(s)['scene/motivation'] as Entite).postes as Choix).valeurs[0];
    suite = jouer(sigmund(suite));
    expect(sigmund(suite), 'Le Soldat posté à la Motivation').toMatchObject({ libelle: 'Soldat', presse: true });

    suite = jouer(parId(corps(suite)['scene/motivation'] as Entite).engager as Bouton);
    expect(suite.vue.disposition, 'le jet de la Scène tient la main').toBe('activite');
    expect(suite.vue.zones['fenetre.corps'].some((e) => e.id.startsWith('scene/')), 'la bataille ne se montre pas sous le jet').toBe(false);
    suite = jouer(focus(suite));
    suite = jouer(suite.vue.zones['fenetre.gestes'].find((b): b is Bouton => b.type === 'bouton' && b.libelle === 'Appliquer')!);
    c = corps(suite);
    expect((parId(c['scene/motivation'] as Entite).engager as Bouton).refus, 'la Scène résolue se ferme').toBe('Cette Scène est déjà résolue.');

    suite = jouer(c['bataille/geste/0'] as Bouton);
    c = corps(suite);
    expect(c['bataille/geste/0'], 'le Rassemblement entre deux Rounds').toMatchObject({ libelle: 'Rassemblement', refus: null });
    expect((parId(c['scene/tenez-votre-position'] as Entite).engager as Bouton).refus, 'le Round joué ferme ses Scènes').toBe('Le Test spectaculaire est joué : le Round suivant attend.');
    suite = jouer(c['bataille/geste/1'] as Bouton);
    expect(corps(suite)['bataille/round'], 'le Round suivant').toMatchObject({ texte: 'Round de bataille 2 / 3' });
  });
});

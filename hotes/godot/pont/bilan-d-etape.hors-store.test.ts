/**
 * LE BILAN DE L'ÉTAPE PAR LE PONT (#3512) : la journée de route jouée comme Godot la joue. Le bilan dit avant
 * « Continuer » ce qu'il va appliquer (cartes, rations, camp) et la Rencontre qu'il fait tirer ; la Rencontre se
 * tire ensuite à sa table, son entrée dite dans la fenêtre. EDOC 8 l.161, l.182-233
 */
import { describe, it, expect } from 'vitest';
import { drainer, table } from './pont.testkit';
import type { Bouton, Element, Entite, Jet } from '../../../src/hote/elements';
import type { Suite } from './pont';

const { appel } = table();
const jouer = (jeu: Bouton['jeu']): Suite => drainer(appel, appel('jouer', jeu)).suite;
const enFocus = (suite: Suite): Bouton => suite.vue.zones['fenetre.gestes'].find((x): x is Bouton => x.type === 'bouton' && x.focus)!;
const etape = (suite: Suite) => suite.vue.zones['fenetre.etape'].map((l) => l.texte).join('');
const annonce = (suite: Suite) => suite.vue.zones['fenetre.corps'].filter((e: Element) => e.id.startsWith('issue/')).map((e) => ('texte' in e ? e.texte : ''));

describe('le bilan de l’Étape par le pont', () => {
  it('le bilan annonce ce qu’il applique et la Rencontre due, puis la Rencontre se tire à sa table', () => {
    let suite = drainer(appel, appel('demarrer', { scenario: 'voyage', graine: 7 })).suite;
    while (suite.vue.projection.fenetre) suite = jouer(enFocus(suite).jeu);
    suite = jouer(suite.vue.zones['exploration.gestes'].find((b) => b.libelle === 'Carte du monde')!.jeu);
    const route = suite.vue.zones['fenetre.corps'].find((e) => e.id === 'carte/r-grandroute') as Entite;
    suite = jouer((route.elements.find((x) => x.id === 'modes') as { valeurs: Bouton[] }).valeurs.find((b) => b.id === 'pied')!.jeu);
    for (let pas = 0; etape(suite) !== 'Bilan de l’Étape'; pas++) {
      expect(pas, 'la journée de route mène à son bilan').toBeLessThan(20);
      suite = jouer(enFocus(suite).jeu);
    }
    expect(annonce(suite), 'la carte qui avance, la Rencontre qui vient').toEqual(['Cartographie : 2/4 DR.', 'Rencontre positive en vue.']);

    suite = jouer(enFocus(suite).jeu);
    expect(etape(suite), 'la Rencontre due, à sa table').toBe('Rencontre positive');
    expect(enFocus(suite).libelle).toBe('Lancer le dé');
    suite = jouer(enFocus(suite).jeu);
    const jet = suite.vue.zones['fenetre.corps'].find((e): e is Jet => e.type === 'jet')!;
    expect(jet.verdict, 'l’entrée tirée, sans redire sa catégorie').toMatch(/^Voilà qui est utile ! : /);
  });
});

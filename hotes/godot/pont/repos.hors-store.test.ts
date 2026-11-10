/**
 * LE REPOS PAR LE PONT (#3328) : la halte de nuit du « Voyage & temps long » jouée comme Godot la joue. La nuit et son
 * lieu, chaque dormeur en entité, son couchage et sa pitance en choix (`reposEnVue`), la note ; le dormeur règle sa nuit
 * d'un geste, sans formulaire, et « Dormir » ouvre la nuit.
 */
import { describe, it, expect } from 'vitest';
import { departDeLaCarte, drainer, table } from './pont.testkit';
import type { Bouton, Choix, Element, Entite } from '../../../src/hote/elements';
import type { Suite } from './pont';

const { appel } = table();
const jouer = (jeu: Bouton['jeu']): Suite => drainer(appel, appel('jouer', jeu)).suite;
const enFocus = (suite: Suite): Bouton => suite.vue.zones['fenetre.gestes'].find((x): x is Bouton => x.type === 'bouton' && x.focus)!;
const corps = (suite: Suite) => Object.fromEntries(suite.vue.zones['fenetre.corps'].map((e) => [e.id, e]));
const parId = (e: Entite) => Object.fromEntries(e.elements.map((x: Element) => [x.id, x]));

describe('le repos par le pont', () => {
  it('la nuit à l’auberge du relais : chaque dormeur règle son couchage et sa pitance, la note suit, puis le groupe dort', () => {
    let suite = drainer(appel, appel('demarrer', { scenario: 'voyage', graine: 7 })).suite;
    while (suite.vue.projection.fenetre) suite = jouer(enFocus(suite).jeu);
    suite = jouer(suite.vue.zones['exploration.gestes'].find((b) => b.libelle === 'Carte du monde')!.jeu);
    const route = departDeLaCarte(suite.vue, 'r-grandroute');
    suite = jouer(route.valeurs.find((b) => b.id === 'pied')!.jeu);
    for (let pas = 0; suite.vue.disposition !== 'repos'; pas++) {
      expect(pas, 'la journée de route mène à la halte').toBeLessThan(20);
      suite = jouer(enFocus(suite).jeu);
    }
    let c = corps(suite);
    expect(c['repos/nuit'], 'la nuit et son lieu').toMatchObject({ texte: 'Nuit à l’auberge — Weiler → Steinbruck' });
    const couchage = (s: Suite) => parId(corps(s)['repos/bjorn'] as Entite).couchage as Choix;
    expect(couchage(suite).valeurs.map((b) => [b.libelle, b.presse]), 'les couchages du relais, le sien pressé').toEqual([['Privée', true], ['Commune', false], ['Dehors', false]]);
    expect((parId(c['repos/bjorn'] as Entite).pitance as Choix).valeurs.map((b) => b.libelle), 'sa pitance').toContain('Repas');
    expect(suite.vue.zones['fenetre.gestes'].map((g) => g.type), 'aucun formulaire : la nuit se règle sur ses dormeurs').toEqual(['bouton']);
    const note = (c['repos/note'] as Element & { texte: string }).texte;

    suite = jouer(couchage(suite).valeurs[2].jeu);
    expect(couchage(suite).valeurs.map((b) => b.presse), 'Bjorn dort dehors').toEqual([false, false, true]);
    const pitance = (parId(corps(suite)['repos/bjorn'] as Entite).pitance as Choix).valeurs;
    suite = jouer(pitance[pitance.length - 1].jeu);
    c = corps(suite);
    expect((c['repos/note'] as Element & { texte: string }).texte, 'un repas de moins, la note suit').not.toBe(note);
    expect(parId(c['repos/bjorn'] as Entite)['alerte/0'], 'le ventre vide se dit').toMatchObject({ libelle: 'Ventre vide', ton: 'alerte' });

    suite = jouer(enFocus(suite).jeu);
    expect(suite.vue.disposition, '« Dormir » ouvre la nuit, dans la scène du voyage').toBe('voyage');
  });
});

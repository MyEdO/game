/**
 * LE REPOS PAR LE PONT (#3328, #3534) : la halte de nuit du « Voyage & temps long » jouée comme Godot la joue. La nuit
 * et son lieu, la note ; sur la carte de chaque dormeur (`groupe.heros`), son couchage et sa pitance en listes
 * (`reposEnVue`) ; le dormeur règle sa nuit d'un geste, sans formulaire, et « Dormir » ouvre la nuit.
 */
import { describe, it, expect } from 'vitest';
import { departDeLaCarte, drainer, table, enFocus } from './pont.testkit';
import type { Bouton, Choix, Element, Entite } from '../../../src/hote/elements';
import type { Suite } from './pont';

const { appel } = table();
const jouer = (jeu: Bouton['jeu']): Suite => drainer(appel, appel('jouer', jeu)).suite;
const focus = (suite: Suite): Bouton => enFocus(suite.vue)!;
const corps = (suite: Suite) => Object.fromEntries(suite.vue.zones['fenetre.corps'].map((e) => [e.id, e]));
const parId = (e: Entite) => Object.fromEntries(e.elements.map((x: Element) => [x.id, x]));
/** La carte de Bjorn dans la barre du groupe, ses éléments par id. */
const bjorn = (s: Suite) => parId(s.vue.zones['groupe.heros'].find((h) => h.id === 'heros/bjorn')!);

describe('le repos par le pont', () => {
  it('la nuit à l’auberge du relais : chaque dormeur règle son couchage et sa pitance, la note suit, puis le groupe dort', () => {
    let suite = drainer(appel, appel('demarrer', { scenario: 'voyage', graine: 7 })).suite;
    while (suite.vue.projection.fenetre) suite = jouer(focus(suite).jeu);
    suite = jouer(suite.vue.zones['exploration.gestes'].find((b) => b.libelle === 'Carte du monde')!.jeu);
    const route = departDeLaCarte(suite.vue, 'r-grandroute');
    suite = jouer(route.valeurs.find((b) => b.id === 'pied')!.jeu);
    for (let pas = 0; suite.vue.disposition !== 'repos'; pas++) {
      expect(pas, 'la journée de route mène à la halte').toBeLessThan(20);
      suite = jouer(focus(suite).jeu);
    }
    let c = corps(suite);
    expect(c['scene/moment'], 'la nuit et son lieu, en tête de la scène').toMatchObject({ texte: 'Nuit à l’auberge — Weiler → Steinbruck' });
    expect(c['scene/paysage'], 'le paysage de la halte : la nuit, et le logis éclairé').toMatchObject({ paysage: ['ciel-nuit', 'relief-terre', 'voile-nuit', 'halte-toit'] });
    const couchage = (s: Suite) => bjorn(s).couchage as Choix;
    expect(couchage(suite).type, 'un choix de la carte, en liste').toBe('liste');
    expect(couchage(suite).valeurs.map((b) => [b.libelle, b.presse]), 'les couchages du relais, le sien pressé').toEqual([['Privée', true], ['Commune', false], ['Dehors', false]]);
    expect((bjorn(suite).pitance as Choix).valeurs.map((b) => b.libelle), 'sa pitance').toContain('Repas');
    expect(suite.vue.zones['fenetre.gestes'].map((g) => g.type), 'aucun formulaire : la nuit se règle sur ses dormeurs').toEqual(['bouton']);
    const note = (c['repos/note'] as Element & { texte: string }).texte;

    suite = jouer(couchage(suite).valeurs[2].jeu);
    expect(couchage(suite).valeurs.map((b) => b.presse), 'Bjorn dort dehors').toEqual([false, false, true]);
    const pitance = (bjorn(suite).pitance as Choix).valeurs;
    suite = jouer(pitance[pitance.length - 1].jeu);
    c = corps(suite);
    expect((c['repos/note'] as Element & { texte: string }).texte, 'un repas de moins, la note suit').not.toBe(note);
    expect(bjorn(suite)['alerte/0'], 'le ventre vide se dit').toMatchObject({ libelle: 'Ventre vide', ton: 'alerte' });

    suite = jouer(focus(suite).jeu);
    expect(suite.vue.disposition, '« Dormir » ouvre la nuit, dans la scène du voyage').toBe('voyage');
  });
});

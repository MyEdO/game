/**
 * L'INTERLUDE PAR LE PONT (#3328) : « Bataille de masse » joué comme Godot le joue, un interlude de préparation ouvert.
 * Les dés d'Événement tombent, puis chaque héros est une entité : ses Activités restantes, l'Événement de sa période, et
 * chacune de ses Activités en geste fermé par sa raison, un geste par cible quand elle en vise une (`interludeEnVue`).
 * Une Activité jouée ouvre son jet, qui tient la main seul, puis l'interlude revient, une Activité de moins.
 */
import { describe, it, expect } from 'vitest';
import { drainer, table } from './pont.testkit';
import type { Bouton, Choix, Element, Entite, Puce } from '../../../src/hote/elements';
import type { Suite } from './pont';

const { appel } = table();
const jouer = (b: Bouton): Suite => drainer(appel, appel('jouer', b.jeu)).suite;
const enFocus = (suite: Suite): Bouton => suite.vue.zones['fenetre.gestes'].find((x): x is Bouton => x.type === 'bouton' && x.focus)!;
const heros = (suite: Suite, nom: string): Entite => suite.vue.zones['fenetre.corps'].find((e): e is Entite => e.type === 'entite' && e.nom === nom)!;
const parLibelle = (e: Entite) => Object.fromEntries(e.elements.map((x: Element) => [(x as Bouton).libelle, x]));

describe('l’interlude par le pont', () => {
  it('chaque héros, ses Activités fermées par leur raison ; une Activité jouée tient la main, puis l’interlude revient', () => {
    let suite = drainer(appel, appel('demarrer', { scenario: 'bataille-de-masse', graine: 7 })).suite;
    for (let pas = 0; suite.vue.disposition !== 'interlude'; pas++) {
      expect(pas, 'les dés d’Événement tombent').toBeLessThan(12);
      suite = jouer(enFocus(suite));
    }
    expect(suite.vue.zones['fenetre.corps'][0], 'la durée de l’interlude').toMatchObject({ id: 'repit/semaines', texte: '3 semaines de répit' });
    const sigmund = heros(suite, 'Sigmund Reikhardt');
    expect(sigmund.elements.filter((e): e is Puce => e.type === 'puce').map((p) => p.libelle), 'ses Activités et l’Événement de sa période').toEqual(['Activités : 3 / 3', 'Allié inculpé']);
    const activites = parLibelle(sigmund);
    expect(activites.Revenus, 'les Revenus se jouent').toMatchObject({ type: 'bouton', refus: null });
    expect((activites['Identifier un artefact'] as Bouton).refus, 'sans artefact, l’identification est fermée').toBe('Aucun objet non identifié dans le sac de Sigmund Reikhardt.');
    const apprentissage = activites['Apprentissage particulier'] as Choix;
    expect(apprentissage.type, 'un Talent par geste, en liste').toBe('liste');
    expect(apprentissage.valeurs[0].refus, 'chaque Talent fermé par sa raison').toBe('Sigmund Reikhardt : PX insuffisants (100).');
    expect((activites.Sabotage as Bouton).refus, 'une préparation de bataille et son préalable').toBe('Exige un Repérage réussi au préalable.');

    suite = jouer(activites.Revenus as Bouton);
    expect(suite.vue.disposition, 'le jet des Revenus tient la main').toBe('activity');
    expect(suite.vue.zones['fenetre.corps'].some((e) => e.type === 'entite'), 'l’interlude ne se montre pas sous le jet').toBe(false);
    suite = jouer(enFocus(suite));
    suite = jouer(suite.vue.zones['fenetre.gestes'].find((b): b is Bouton => b.type === 'bouton' && b.libelle === 'Appliquer')!);
    expect(suite.vue.disposition, 'l’interlude revient').toBe('interlude');
    expect(parLibelle(heros(suite, 'Sigmund Reikhardt'))['Activités : 2 / 3'], 'une Activité de moins').toBeDefined();
  });
});

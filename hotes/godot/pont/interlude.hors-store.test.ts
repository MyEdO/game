/**
 * L'INTERLUDE PAR LE PONT (#3328) : « Bataille de masse » joué comme Godot le joue, un interlude de préparation ouvert.
 * Les dés d'Événement tombent, puis chaque héros est une entité : ses Activités restantes, l'Événement de sa période, le
 * choix de l'Activité qu'il compose et chaque choix de sa composition, chaque valeur fermée par sa raison, et le bouton
 * qui la pratique, fermé par ce qui reste à choisir, et ses préparations de bataille (`interludeEnVue`). Une Activité pratiquée
 * ouvre son jet, qui tient la main seul, puis l'interlude revient, une Activité de moins.
 */
import { describe, it, expect } from 'vitest';
import { drainer, table, enFocus } from './pont.testkit';
import type { Bouton, Choix, Element, Entite, Puce } from '../../../src/hote/elements';
import type { Suite } from './pont';
import { t } from '../../../src/i18n';

const { appel } = table();
const jouer = (b: Bouton): Suite => drainer(appel, appel('jouer', b.jeu)).suite;
const focus = (suite: Suite): Bouton => enFocus(suite.vue)!;
const heros = (suite: Suite, nom: string): Entite => suite.vue.zones['fenetre.corps'].find((e): e is Entite => e.type === 'entite' && e.nom === nom)!;
const parLibelle = (e: Entite) => Object.fromEntries(e.elements.map((x: Element) => [(x as Bouton).libelle, x]));
const valeur = (c: Element, libelle: string): Bouton => (c as Choix).valeurs.find((v) => v.libelle === libelle)!;
const SIGMUND = 'Soldat';

describe('l’interlude par le pont', () => {
  it('chaque héros compose son Activité, fermée par sa raison, et la pratique ; son jet tient la main, puis l’interlude revient', { timeout: 120_000 }, () => {
    let suite = drainer(appel, appel('demarrer', { scenario: 'bataille-de-masse', graine: 7 })).suite;
    for (let pas = 0; suite.vue.disposition !== 'interlude'; pas++) {
      expect(pas, 'les dés d’Événement tombent').toBeLessThan(12);
      suite = jouer(focus(suite));
    }
    expect(suite.vue.zones['fenetre.corps'][0], 'la durée de l’interlude').toMatchObject({ id: 'repit/semaines', texte: '3 semaines de répit' });
    const sigmund = heros(suite, SIGMUND);
    expect(sigmund.elements.filter((e): e is Puce => e.type === 'puce').map((p) => [p.libelle, p.valeur]), 'ses Activités, ses PX, sa bourse et l’Événement de sa période').toEqual([
      ['Activités : 3 / 3', null], ['PX', '0'], ['Bourse', '0 sc'], ['Allié inculpé', null],
    ]);
    const composer = parLibelle(sigmund);
    expect(composer.Activité, 'l’Activité à composer, en liste').toMatchObject({ type: 'liste', refus: null });
    expect(valeur(composer.Activité, 'Revenus').refus, 'les Revenus se composent').toBeNull();
    expect(valeur(composer.Activité, 'Identifier un artefact').refus, 'sans artefact, l’identification est fermée').toBe('Aucun objet non identifié dans le sac de Soldat.');
    expect(composer.Entreprendre, 'rien à pratiquer avant de composer').toBeUndefined();
    expect((composer.Sabotage as Bouton).refus, 'une préparation de bataille et son préalable').toBe('Exige un Repérage réussi au préalable.');

    suite = jouer(valeur(composer.Activité, 'Apprentissage particulier'));
    const apprentissage = parLibelle(heros(suite, SIGMUND));
    expect(valeur(apprentissage.Activité, 'Apprentissage particulier').presse, 'l’Activité composée est pressée').toBe(true);
    const talents = apprentissage.Talent as Choix;
    expect(talents.type, 'un Talent par geste, en liste').toBe('liste');
    expect(talents.valeurs[0].refus, 'chaque Talent fermé par sa raison').toBe('Soldat : PX insuffisants (100).');
    expect(talents.valeurs[0].libelle, 'une valeur de liste se lit par son libellé seul : il dit ce qu’elle coûte').toMatch(/ · 100 PX$/);
    expect((apprentissage.Entreprendre as Bouton).refus, 'sans Talent choisi, l’Apprentissage ne se pratique pas').toBe(t('interlude.choisir.talent'));

    suite = jouer(valeur(parLibelle(heros(suite, SIGMUND)).Activité, 'Revenus'));
    const revenus = parLibelle(heros(suite, SIGMUND)).Entreprendre as Bouton;
    expect(revenus.refus, 'les Revenus se pratiquent').toBeNull();
    suite = jouer(revenus);
    expect(suite.vue.disposition, 'le jet des Revenus tient la main').toBe('activite');
    expect(suite.vue.zones['fenetre.corps'].some((e) => e.type === 'entite'), 'l’interlude ne se montre pas sous le jet').toBe(false);
    suite = jouer(focus(suite));
    suite = jouer(suite.vue.zones['fenetre.gestes'].find((b): b is Bouton => b.type === 'bouton' && b.libelle === 'Appliquer')!);
    expect(suite.vue.disposition, 'l’interlude revient').toBe('interlude');
    expect(parLibelle(heros(suite, SIGMUND))['Activités : 2 / 3'], 'une Activité de moins').toBeDefined();
  });
});

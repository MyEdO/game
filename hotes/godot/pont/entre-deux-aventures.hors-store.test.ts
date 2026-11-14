/**
 * L'OUVRAGE ET LE DÉPÔT PAR LE PONT (#3328) : « Entre deux aventures » joué comme Godot le joue. Le forgeron compose
 * son Artisanat (l'ouvrage, puis les qualités qu'il vise) et a son formulaire de dépôt (chaque genre fermé par sa
 * raison, le montant que sa bourse couvre) ; la marchande sans Métier ni bourse a l'Artisanat et le dépôt fermés par
 * leur raison. Joués tels que Godot les lit, l'ouvrage engagé ne s'offre plus et l'Artisanat se poursuit, la planque
 * rejoint les dépôts.
 */
import { describe, it, expect } from 'vitest';
import { drainer, table, enFocus } from './pont.testkit';
import type { Bouton, Choix, Element, Entite, Formulaire, Saisie } from '../../../src/hote/elements';
import type { Suite } from './pont';
import { t } from '../../../src/i18n';

const { appel } = table();
const jouer = (jeu: Bouton['jeu']): Suite => drainer(appel, appel('jouer', jeu)).suite;
const heros = (suite: Suite, id: string): Entite => suite.vue.zones['fenetre.corps'].find((e): e is Entite => e.id === `repit/${id}`)!;
const parId = (e: Entite) => Object.fromEntries(e.elements.map((x: Element) => [x.id, x]));
const saisie = (f: Formulaire, nom: string) => f.champs.find((c) => c.nom === nom) as Extract<Saisie, { valeurs: unknown }>;
const valeur = (c: Element, libelle: string): Bouton => (c as Choix).valeurs.find((v) => v.libelle === libelle)!;

describe('l’ouvrage et le dépôt par le pont', () => {
  it('le forgeron engage un ouvrage et planque son argent ; la marchande voit pourquoi elle ne le peut pas', () => {
    let suite = drainer(appel, appel('demarrer', { scenario: 'entre-deux-aventures', graine: 7 })).suite;
    for (let pas = 0; suite.vue.disposition !== 'interlude'; pas++) {
      expect(pas, 'les dés d’Événement tombent').toBeLessThan(8);
      suite = jouer(enFocus(suite.vue)!.jeu);
    }
    const durin = parId(heros(suite, 'durin'));
    expect(valeur(durin.activite, 'Artisanat').refus, 'l’ouvrage s’engage').toBeNull();
    const depot = durin['depot/durin'] as Formulaire;
    expect(saisie(depot, 'genre').valeurs.map((v) => [v.libelle, v.refus]), 'un artisan Bronze planque, sans investir ni Mécénat ici').toEqual([
      ['Investir', 'Durin (forgeron) : investir en banque exige le Statut Argent ou Or.'], ['Planquer', null], ['Mécénat', 'Le Mécénat ne se pratique pas ici.'],
    ]);
    expect(depot.champs.find((c) => c.nom === 'montant'), 'le montant, par pistole, jusqu’à la bourse').toMatchObject({ type: 'saisieNombre', min: 12, max: 4800, pas: 12 });
    const hilde = parId(heros(suite, 'hilde'));
    expect(valeur(hilde.activite, 'Artisanat').refus, 'sans Métier, aucun ouvrage').toBe('Hilde (marchande) ne possède aucune Compétence Métier — impossible de fabriquer.');

    suite = jouer(valeur(durin.activite, 'Artisanat').jeu);
    const artisanat = parId(heros(suite, 'durin'));
    expect((artisanat.pratiquer as Bouton).refus, 'sans ouvrage choisi, rien ne s’engage').toBe(t('interlude.choisir.ouvrage'));
    expect((artisanat.ajouterLaQualite as Choix).valeurs.map((v) => v.libelle), 'les Atouts d’Objet').toContain('Solide');
    const [, ouvrage] = (artisanat.ouvrage as Choix).valeurs.filter((v) => !v.refus);
    suite = jouer(ouvrage.jeu);
    suite = jouer(valeur(parId(heros(suite, 'durin')).ajouterLaQualite, 'Solide').jeu);
    const compose = parId(heros(suite, 'durin'));
    expect(valeur(compose.ouvrage, ouvrage.libelle).presse, 'l’ouvrage choisi est pressé').toBe(true);
    expect(valeur(compose.retirerLaQualite, 'Solide'), 'la qualité visée se retire').toBeDefined();
    expect((compose.pratiquer as Bouton).refus, 'l’ouvrage composé s’engage').toBeNull();
    suite = jouer((compose.pratiquer as Bouton).jeu);
    const apres = parId(heros(suite, 'durin'));
    expect(apres.ouvrage, 'l’ouvrage engagé ne s’offre plus').toBeUndefined();
    expect(apres.pratiquer, 'l’Artisanat en cours se poursuit').toMatchObject({ type: 'bouton', refus: null });

    suite = jouer({ type: depot.verbe, args: ['durin', 'planque', 120] });
    expect((suite.vue.zones['fenetre.corps'].find((e) => e.id === 'repit/depots') as Entite).elements.map((b) => (b as Bouton).libelle), 'la planque rejoint les dépôts').toHaveLength(1);
  });
});

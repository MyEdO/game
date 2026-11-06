/**
 * L'OUVRAGE ET LE DÉPÔT PAR LE PONT (#3328) : « Entre deux aventures » joué comme Godot le joue. Le forgeron a son
 * formulaire d'ouvrage (chaque ouvrage, les Atouts et Défauts à cocher) et de dépôt (chaque genre fermé par sa raison,
 * le montant que sa bourse couvre) ; la marchande sans Métier ni bourse a les siens fermés par leur raison. Joués tels
 * que Godot les lit, l'ouvrage engagé cède la place à l'Artisanat, la planque rejoint les dépôts.
 */
import { describe, it, expect } from 'vitest';
import { drainer, table } from './pont.testkit';
import type { Bouton, Element, Entite, Formulaire, Saisie } from '../../../src/hote/elements';
import type { Suite } from './pont';

const { appel } = table();
const jouer = (jeu: Bouton['jeu']): Suite => drainer(appel, appel('jouer', jeu)).suite;
const heros = (suite: Suite, id: string): Entite => suite.vue.zones['fenetre.corps'].find((e): e is Entite => e.id === `repit/${id}`)!;
const parId = (e: Entite) => Object.fromEntries(e.elements.map((x: Element) => [x.id, x]));
const saisie = (f: Formulaire, nom: string) => f.champs.find((c) => c.nom === nom) as Extract<Saisie, { valeurs: unknown }>;

describe('l’ouvrage et le dépôt par le pont', () => {
  it('le forgeron engage un ouvrage et planque son argent ; la marchande voit pourquoi elle ne le peut pas', () => {
    let suite = drainer(appel, appel('demarrer', { scenario: 'entre-deux-aventures', graine: 7 })).suite;
    for (let pas = 0; suite.vue.disposition !== 'interlude'; pas++) {
      expect(pas, 'les dés d’Événement tombent').toBeLessThan(8);
      suite = jouer(suite.vue.zones['fenetre.gestes'].find((x): x is Bouton => x.type === 'bouton' && x.focus)!.jeu);
    }
    const durin = parId(heros(suite, 'durin'));
    const ouvrage = durin['ouvrage/durin'] as Formulaire;
    expect(ouvrage, 'l’ouvrage s’engage').toMatchObject({ type: 'formulaire', libelle: 'Entreprendre un ouvrage', refus: null });
    expect(ouvrage.champs.map((c) => c.type), 'le forgeron posé, l’ouvrage à choisir, les Atouts et Défauts à cocher').toEqual(['fixe', 'saisieChoix', 'saisieCoches', 'saisieCoches']);
    expect(saisie(ouvrage, 'atouts').valeurs.map((v) => v.libelle), 'les Atouts d’Objet').toContain('Solide');
    const depot = durin['depot/durin'] as Formulaire;
    expect(saisie(depot, 'kind').valeurs.map((v) => [v.libelle, v.refus]), 'un artisan Bronze planque, sans investir ni Mécénat ici').toEqual([
      ['Investir', 'Durin (forgeron) : investir en banque exige le Statut Argent ou Or.'], ['Planquer', null], ['Mécénat', 'Le Mécénat ne se pratique pas ici.'],
    ]);
    expect(depot.champs.find((c) => c.nom === 'amountBrass'), 'le montant, par pistole, jusqu’à la bourse').toMatchObject({ type: 'saisieNombre', min: 12, max: 4800, pas: 12 });
    const hilde = parId(heros(suite, 'hilde'));
    expect((hilde['ouvrage/hilde'] as Formulaire).refus, 'sans Métier, aucun ouvrage').toBe('Hilde (marchande) ne possède aucune Compétence Métier — impossible de fabriquer.');

    const [, choisi] = saisie(ouvrage, 'trappingId').valeurs.filter((v) => !v.refus);
    suite = jouer({ type: ouvrage.verbe, args: ['durin', choisi.valeur, ['solide'], []] });
    const apres = parId(heros(suite, 'durin'));
    expect(apres['ouvrage/durin'], 'l’ouvrage engagé ne s’offre plus').toBeUndefined();
    expect(apres.craft, 'l’Artisanat en cours se poursuit').toMatchObject({ type: 'bouton', refus: null });

    suite = jouer({ type: depot.verbe, args: ['durin', 'stash', 120] });
    expect((suite.vue.zones['fenetre.corps'].find((e) => e.id === 'repit/depots') as Entite).elements.map((b) => (b as Bouton).libelle), 'la planque rejoint les dépôts').toHaveLength(1);
  });
});

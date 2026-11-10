/**
 * L'OUVRAGE ET LE DÉPÔT EN VUE, sans store (#3328) : `interludeEnVue` offre à un forgeron qui a de quoi payer
 * l'ouvrage d'Artisanat à composer (chaque ouvrage fermé par `refusDArtisanat`, les Atouts et Défauts visables) puis à
 * pratiquer, et le dépôt en banque (chaque genre fermé par son devis, le montant que la bourse couvre) ; leurs gestes les
 * jouent, et refusent en le disant l'ouvrage ou le genre laissé vide. LDB 23 l.74-78, l.95, l.164-170
 */
import { idsDeTest } from '../engine/idsDeTest.testkit';
import { describe, it, expect } from 'vitest';
import { ouvrirLeBanc } from './banc.testkit';
import { draineCascade } from './cascade.testkit';
import { interludeEnVue } from './interludeEnVue';
import { createHero } from '../engine/character';
import { withBourseMoney } from '../engine/bourse';

/** Un banc sur un interlude d'une semaine, dés d'Événement posés, dont le forgeron porte 10 CO. */
function forge() {
  const h = withBourseMoney(createHero({ idNeuf: idsDeTest, speciesId: 'nains', careerId: 'artisan', label: 'Forgeron', seed: 1602 }), { gold: 10, silver: 0, brass: 0 }, idsDeTest);
  if (!h.skills.some((s) => s.id === 'metier')) h.skills.push({ id: 'metier', spec: 'forgeron', characteristic: 'dexterite', advances: 10 });
  const banc = ouvrirLeBanc({ graine: 7, desFixes: false, etat: { party: [h], screen: 'interlude' } });
  banc.actions.ouvrirLInterlude(1);
  draineCascade(banc.getState);
  const vue = () => interludeEnVue(banc.getState())!.heros[0];
  const dernier = () => banc.getState().journal.slice(-1)[0];
  return { banc, id: h.id, vue, dernier };
}

describe('l’ouvrage et le dépôt de l’interlude en vue', () => {
  it('l’ouvrage : composé par les choix du forgeron, chaque ouvrage et ses matériaux, les Atouts et Défauts ; engagé, il cède la place à l’Artisanat', () => {
    const { banc, id, vue, dernier } = forge();
    const choix = (axe: string) => vue().composition.find((c) => c.axe === axe);
    const activite = choix('activite')!;
    const artisanat = activite.valeurs.find((v) => v.geste.args[2] === 'craft')!;
    expect(artisanat, 'le forgeron peut engager un ouvrage').toMatchObject({ refus: null, choisie: false, geste: { verbe: 'fenetreChoisir', args: ['interlude', 'activite', 'craft', id] } });
    expect(vue().pratiquer, 'rien de composé, rien à pratiquer').toBeNull();

    banc.actions.fenetreChoisir('interlude', 'activite', 'craft', id);
    expect(choix('activite')!.valeurs.find((v) => v.geste.args[2] === 'craft')!.choisie, 'l’Artisanat composé').toBe(true);
    const ouvert = choix('ouvrage')!.valeurs.find((o) => !o.refus)!;
    expect(ouvert.libelle, 'l’ouvrage dit ses matériaux').toMatch(/ · /);
    const atout = choix('ajouterLaQualite')!.valeurs[0];
    expect(choix('ajouterLaQualite')!.valeurs.length, 'des Atouts et des Défauts à viser').toBeGreaterThan(1);
    expect(vue().pratiquer, 'l’ouvrage laissé vide est refusé, dit').toMatchObject({ refus: 'Choisissez un équipement du catalogue.' });

    banc.actions.fenetreChoisir('interlude', 'pratiquer', true, id);
    expect(dernier(), 'l’ouvrage laissé vide est refusé, dit').toBe('Choisissez un équipement du catalogue.');
    expect(banc.getState().party[0].craft, 'rien d’engagé').toBeUndefined();

    banc.actions.fenetreChoisir(...(ouvert.geste.args as ['interlude', 'ouvrage', string, string]));
    banc.actions.fenetreChoisir(...(atout.geste.args as ['interlude', 'ajouterLaQualite', string, string]));
    expect(choix('retirerLaQualite')!.valeurs.map((v) => v.geste.args[2]), 'la qualité visée se retire').toEqual([atout.geste.args[2]]);
    banc.actions.fenetreChoisir('interlude', 'pratiquer', true, id);
    expect(banc.getState().party[0].craft, 'l’ouvrage est engagé, sa qualité visée').toMatchObject({ trappingId: ouvert.geste.args[2], atouts: [atout.geste.args[2]] });
    expect(choix('ouvrage'), 'l’ouvrage engagé ne s’offre plus').toBeUndefined();
    expect(vue().pratiquer, 'l’Artisanat en cours se poursuit').toMatchObject({ refus: null });
  });

  it('le dépôt : chaque genre fermé par son devis, le montant que la bourse couvre ; planqué, il rejoint les dépôts', () => {
    const { banc, id, vue, dernier } = forge();
    const depot = vue().depot;
    expect(depot, 'la bourse de 10 CO, par pistole').toMatchObject({ refus: null, geste: { verbe: 'deposerALaBanque', args: [id] }, max: 2400, pas: 12 });
    expect(depot.genres.map((g) => [g.valeur, g.refus]), 'un artisan Bronze n’investit pas, le Mécénat ne se pratique pas ici').toEqual([
      ['investir', 'Forgeron : investir en banque exige le Statut Argent ou Or.'], ['planque', null], ['mecenat', 'Le Mécénat ne se pratique pas ici.'],
    ]);

    banc.actions.deposerALaBanque(id, null as unknown as 'planque', 120);
    expect(dernier(), 'le genre laissé vide est refusé, dit').toBe('Choisissez le dépôt : investir, planquer ou Mécénat.');
    banc.actions.deposerALaBanque(id, 'planque', 120);
    expect(interludeEnVue(banc.getState())!.depots.map((d) => d.libelle), 'la planque rejoint les dépôts').toHaveLength(1);
  });
});

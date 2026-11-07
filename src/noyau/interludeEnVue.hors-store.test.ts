/**
 * L'OUVRAGE ET LE DÉPÔT EN VUE, sans store (#3328) : `interludeEnVue` offre à un forgeron qui a de quoi payer
 * l'ouvrage d'Artisanat à engager (chaque ouvrage fermé par `refusDArtisanat`, les Atouts et Défauts visables) et le
 * dépôt en banque (chaque genre fermé par son devis, le montant que la bourse couvre) ; leurs verbes les jouent, et
 * refusent en le disant l'ouvrage ou le genre laissé vide. LDB 23 l.74-78, l.164-170
 */
import { describe, it, expect } from 'vitest';
import { ouvrirLeBanc } from './banc.testkit';
import { draineCascade } from './cascade.testkit';
import { interludeEnVue } from './interludeEnVue';
import { createHero } from '../engine/character';
import { withBourseMoney } from '../engine/bourse';

/** Un banc sur un interlude d'une semaine, dés d'Événement posés, dont le forgeron porte 10 CO. */
function forge() {
  const h = withBourseMoney(createHero({ speciesId: 'nains', careerId: 'artisan', label: 'Forgeron', seed: 1602 }), { gold: 10, silver: 0, brass: 0 });
  if (!h.skills.some((s) => s.id === 'metier')) h.skills.push({ id: 'metier', spec: 'forgeron', characteristic: 'dexterite', advances: 10 });
  const banc = ouvrirLeBanc({ graine: 7, desFixes: false, etat: { party: [h], screen: 'interlude' } });
  banc.actions.ouvrirLInterlude(1);
  draineCascade(banc.getState);
  const vue = () => interludeEnVue(banc.getState())!.heros[0];
  const dernier = () => banc.getState().journal.slice(-1)[0];
  return { banc, id: h.id, vue, dernier };
}

describe('l’ouvrage et le dépôt de l’interlude en vue', () => {
  it('l’ouvrage : chaque ouvrage et ses matériaux, les Atouts et Défauts ; engagé, il cède la place à l’Artisanat', () => {
    const { banc, id, vue, dernier } = forge();
    const ouvrage = vue().ouvrage!;
    expect(ouvrage.refus, 'le forgeron peut engager un ouvrage').toBeNull();
    expect(ouvrage.geste, 'le verbe et le héros posé').toEqual({ verbe: 'fabriquerLObjet', args: [id] });
    const ouvert = ouvrage.ouvrages.find((o) => !o.refus)!;
    expect(ouvert.libelle, 'l’ouvrage dit ses matériaux').toMatch(/ · /);
    expect(ouvrage.atouts.length && ouvrage.defauts.length, 'des Atouts et des Défauts à viser').toBeGreaterThan(0);

    banc.actions.fabriquerLObjet(id, null as unknown as string, [], []);
    expect(dernier(), 'l’ouvrage laissé vide est refusé, dit').toBe('Choisissez un équipement du catalogue.');
    expect(vue().ouvrage, 'rien d’engagé').not.toBeNull();

    banc.actions.fabriquerLObjet(id, ouvert.valeur, [ouvrage.atouts[0].valeur], []);
    expect(banc.getState().party[0].craft, 'l’ouvrage est engagé, son Atout visé').toMatchObject({ trappingId: ouvert.valeur, atouts: [ouvrage.atouts[0].valeur] });
    expect(vue().ouvrage, 'l’ouvrage engagé ne s’offre plus').toBeNull();
    expect(vue().activites.some((a) => a.id === 'craft'), 'l’Artisanat en cours se poursuit').toBe(true);
  });

  it('le dépôt : chaque genre fermé par son devis, le montant que la bourse couvre ; planqué, il rejoint les dépôts', () => {
    const { banc, id, vue, dernier } = forge();
    const depot = vue().depot;
    expect(depot, 'la bourse de 10 CO, par pistole').toMatchObject({ refus: null, geste: { verbe: 'deposerALaBanque', args: [id] }, max: 2400, pas: 12 });
    expect(depot.genres.map((g) => [g.valeur, g.refus]), 'un artisan Bronze n’investit pas, le Mécénat ne se pratique pas ici').toEqual([
      ['invest', 'Forgeron : investir en banque exige le Statut Argent ou Or.'], ['stash', null], ['mecenat', 'Le Mécénat ne se pratique pas ici.'],
    ]);

    banc.actions.deposerALaBanque(id, null as unknown as 'stash', 120);
    expect(dernier(), 'le genre laissé vide est refusé, dit').toBe('Choisissez le dépôt : investir, planquer ou Mécénat.');
    banc.actions.deposerALaBanque(id, 'stash', 120);
    expect(interludeEnVue(banc.getState())!.depots.map((d) => d.libelle), 'la planque rejoint les dépôts').toHaveLength(1);
  });
});

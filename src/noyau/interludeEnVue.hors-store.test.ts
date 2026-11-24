/**
 * L'OUVRAGE ET LE DÉPÔT EN VUE, sans store (#3328, #4574) : `interludeEnVue` offre à un forgeron qui a de quoi payer
 * l'ouvrage d'Artisanat à composer (chaque ouvrage fermé par `refusDArtisanat`, les Atouts et Défauts visables) puis à
 * pratiquer, et le dépôt en banque (chaque genre fermé par son devis, le montant que la bourse couvre) ; leurs gestes les
 * jouent, et refusent en le disant l'ouvrage ou le genre laissé vide. La vue publie des données : chaque valeur nommée
 * seule, son coût à part (PX ou prix), la bourse et les montants en `Money`, l'Événement par son id, chaque dépôt par
 * son héros, son genre, son montant et ce que rend un investissement. LDB 23 l.66-78, l.95, l.132-136, l.157-170
 */
import { describe, it, expect } from 'vitest';
import { bancDeLInterlude } from './interlude.testkit';
import { ouvrirLeBanc } from './banc.testkit';
import { draineCascade } from './cascade.testkit';
import { idsDeTest } from '../engine/idsDeTest.testkit';
import { learnableSpells } from '../engine/grimoire';
import { herosDeScenario } from '../scenes/test-scenarios/_heros';
import { interludeEnVue } from './interludeEnVue';
import { bourseOf, withBourseMoney } from '../engine/bourse';
import { bankPayout, craftCatalog, entrainementOptions, cleDEntrainement, learnableTalents, orderCatalog } from '../engine/activities';
import { fromBrass } from '../engine/money';
import { interludeEventFor } from '../data/interludeEvents';
import { ACTIVITIES } from '../data';
import { fenetreADessiner } from '../hote/gestes';

/** L'id de l'Activité que résout `resolver`. */
const activiteDe = (resolver: string): string => ACTIVITIES.find((a) => a.resolver === resolver)!.id;

/** L'interlude ouvert du héros de carrière `carriere` (`bancDeLInterlude`), sa vue et la dernière ligne du journal. */
function forge(carriere = 'artisan') {
  const { banc, id } = bancDeLInterlude(carriere);
  const vue = () => interludeEnVue(banc.getState())!.heros[0];
  const dernier = () => banc.getState().journal.slice(-1)[0];
  return { banc, id, vue, dernier };
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
    const catalogue = craftCatalog().find((o) => o.id === ouvert.geste.args[2])!;
    expect(ouvert, 'l’ouvrage nommé seul, ses matériaux en prix').toMatchObject({ libelle: catalogue.label, cout: { prix: fromBrass(catalogue.materialsBrass) } });
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
    const [planque] = banc.getState().bank;
    expect(interludeEnVue(banc.getState())!.depots, 'la planque rejoint les dépôts : son héros, son montant, rien à investir').toEqual([{
      uid: planque.uid, heros: { id, nom: 'Forgeron' }, genre: 'planque', montant: fromBrass(planque.brass), investissement: null,
      geste: { verbe: 'retirerDeLaBanque', args: [planque.uid] }, refus: null,
    }]);
  });

  it('l’investissement : son Indice et ce qu’il rend au retrait', () => {
    const { banc, id, vue } = forge('marchand');
    expect(vue().depot.genres.map((g) => [g.valeur, g.refus]).slice(0, 2), 'un marchand Argent investit').toEqual([['investir', null], ['planque', null]]);
    banc.actions.deposerALaBanque(id, 'investir', 1200);
    const [depot] = banc.getState().bank;
    expect(interludeEnVue(banc.getState())!.depots[0], 'l’investissement, son Indice et son rendu').toMatchObject({
      heros: { id, nom: 'Forgeron' }, genre: 'investir', montant: fromBrass(depot.brass), investissement: { indice: depot.rate, rendu: fromBrass(bankPayout('investir', depot.brass, depot.rate)) },
    });
  });

  it('la bourse en Money, l’Événement par son id, la Commande nommée seule et son prix', () => {
    const { banc, id, vue } = forge();
    const h = banc.getState().party[0];
    const roll = banc.getState().interlude!.perHero[id].eventRoll!;
    expect(vue().bourse, 'la bourse en Money').toEqual(bourseOf(h));
    expect(vue().evenement, 'l’Événement de la période').toEqual({ id: interludeEventFor(roll).id, nom: interludeEventFor(roll).label });
    const commande = vue().activites.find((a) => a.id === 'order')!;
    expect(commande.gestes.map((g) => [g.libelle, g.cout]), 'chaque objet nommé seul, son prix à part').toEqual(orderCatalog().map((o) => [o.label, { prix: fromBrass(o.priceBrass) }]));
  });

  it('les Talents et l’Entraînement nommés seuls, leur coût en PX', () => {
    const { banc, id, vue } = forge();
    const h = () => banc.getState().party[0];
    const valeurs = (axe: string) => vue().composition.find((c) => c.axe === axe)!.valeurs;
    banc.actions.fenetreChoisir('interlude', 'activite', activiteDe('learnTalent'), id);
    const talents = learnableTalents(h());
    expect(talents.length, 'des Talents à apprendre').toBeGreaterThan(0);
    expect(valeurs('talent').map((v) => [v.libelle, v.cout]), 'chaque Talent, son coût en PX').toEqual(talents.map((o) => [o.label, { px: o.xpCost }]));
    banc.actions.fenetreChoisir('interlude', 'activite', activiteDe('entrainement'), id);
    const options = entrainementOptions(h());
    expect(valeurs('entrainement').map((v) => [v.geste.args[2], v.libelle, v.cout]), 'chaque Entraînement, son coût en PX').toEqual(options.map((o) => [cleDEntrainement(o), o.label, { px: o.xpCost }]));
  });

  it('chaque sort à mémoriser nommé seul, son coût en PX (Altdorf, recherche universitaire)', () => {
    const h = withBourseMoney(herosDeScenario(idsDeTest, 'sorcier'), { gold: 10, silver: 0, brass: 0 }, idsDeTest);
    const banc = ouvrirLeBanc({ graine: 7, desFixes: false, etat: { party: [h], screen: 'interlude', lieu: 'altdorf' } });
    banc.actions.ouvrirLInterlude(1);
    draineCascade(banc.getState);
    banc.actions.fenetreChoisir('interlude', 'activite', 'recherche-universitaire', h.id);
    const payants = learnableSpells(banc.getState().party[0]).filter((x) => x.cost > 0);
    expect(payants.length, 'le sorcier a des sorts payants à mémoriser').toBeGreaterThan(0);
    const sort = interludeEnVue(banc.getState())!.heros[0].composition.find((c) => c.axe === 'sort')!;
    expect(sort.valeurs.map((v) => [v.geste.args[2], v.libelle, v.cout])).toEqual(payants.map((x) => [x.spell.id, x.spell.label, { px: x.cost }]));
  });

  it('la fenêtre de l’interlude ne redit aucun de ses choix : la vue les porte', () => {
    const { banc, id } = forge();
    banc.actions.fenetreChoisir('interlude', 'activite', activiteDe('craftExtended'), id);
    const choix = fenetreADessiner(banc.getState())!.gestes.filter((g) => g.cle.startsWith('fenetreChoisir@interlude#'));
    expect(choix.length, 'la fenêtre porte les choix de l’interlude').toBeGreaterThan(0);
    expect(choix.map((g) => [g.cle, g.ouvert, g.arguments.find((a) => a.nom === 'valeur')?.valeurs?.length]), 'chacun fermé, sans valeur : la vue porte les valeurs et leur coût').toEqual(choix.map((g) => [g.cle, false, 0]));
  });
});

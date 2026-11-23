/**
 * LE REPOS EN VUE, sans store (#3328, #4574) : `reposEnVue` dit la nuit à régler en données, son lieu, son toit, ses
 * nuits et sa qualité, le temps qu'il fait, chaque dormeur et ce que le lieu lui offre en couchage (chaque chambre en
 * données) et en pitance, chacun écrit en choix de la fenêtre (`fenetreChoisir('repos', …)`), ce qui l'attend cette
 * nuit en alertes typées, et la note que les bourses paient, en Money ; le verbe refuse en le disant ce que le lieu
 * n'offre pas. LDB 66
 */
import { idsDeTest } from '../engine/idsDeTest.testkit';
import { describe, it, expect, afterEach } from 'vitest';
import { ouvrirLeBanc } from './banc.testkit';
import { reposEnVue } from './reposEnVue';
import { routeLieu } from './restFlow';
import { emptyScene } from './monde/scene';
import { createHero } from '../engine/character';
import { withBourseMoney } from '../engine/bourse';
import { isRation } from '../engine/provisions';
import { addCondition } from '../engine/conditions';
import { itemFromTrappingById } from '../engine/items';
import { resetRule, rule, setRule } from '../engine/policy';
import { fixtureText } from '../i18n/fixtureText';
import { t } from '../i18n';
import type { Combatant } from '../engine/types';
import type { EtatDeJeu } from './etat';

/** Un héros sans ration, nommé `label`. */
function heros(label: string, seed: number): Combatant {
  const h = createHero({ idNeuf: idsDeTest, speciesId: 'humains-reiklander', careerId: 'soldat', label, seed });
  h.items = (h.items ?? []).filter((i) => !isRation(i));
  return h;
}

/** Un banc dont le groupe, deux héros sans ration et une bourse de 2 pistoles, s'arrête à l'auberge du relais. */
function relais() {
  const a = withBourseMoney(heros('Anna', 11), { gold: 0, silver: 2, brass: 0 }, idsDeTest);
  const b = withBourseMoney(heros('Borin', 12), { gold: 0, silver: 0, brass: 0 }, idsDeTest);
  const banc = ouvrirLeBanc({ graine: 7, etat: { party: [a, b] } });
  banc.getState().offrirLeRepos({ lieu: { nom: fixtureText('Le relais') }, places: { auberge: true } });
  const vue = () => reposEnVue(banc.getState())!;
  const dernier = () => banc.getState().journal.slice(-1)[0];
  return { banc, a, b, vue, dernier };
}

/** Un banc dont le groupe `party` campe sous la météo `weather`. */
function campement(party: Combatant[], etat: Partial<EtatDeJeu> = {}) {
  const banc = ouvrirLeBanc({ graine: 7, etat: { party, ...etat } });
  banc.getState().offrirLeRepos({ lieu: { nom: fixtureText('La clairière') }, places: { camp: true } });
  return { banc, vue: () => reposEnVue(banc.getState())! };
}

afterEach(() => resetRule('exposition-tente-annule'));

describe('le repos en vue', () => {
  it('la nuit, chaque dormeur et ce que le lieu lui offre, la note que les bourses paient', () => {
    const { a, b, vue } = relais();
    const r = vue();
    expect([r.lieu, r.toit, r.nuits, r.qualite], 'la nuit, son lieu, son toit, une nuit de qualité normale').toEqual([{ nom: 'Le relais' }, 'auberge', 1, 'normale']);
    const anna = r.dormeurs.find((d) => d.id === a.id)!;
    expect(anna.couchage.valeurs.map((v) => [v.valeur, v.libelle, v.choisie, v.chambre]), 'sa chambre et qui la partage, les chambres neuves, puis la salle commune et la belle étoile').toEqual([
      ['chambre-1', 'Chambre 1 (2 lits) avec Borin', true, { offre: 'chambre', numero: 1, lits: 2, occupants: [a.id, b.id], pleine: false }],
      ['chambre-2', 'Nouvelle chambre (2 lits)', false, { offre: 'chambre', numero: 2, lits: 2, occupants: [], pleine: false }],
      ['grande-1', 'Nouvelle grande chambre (4 lits)', false, { offre: 'grande', numero: 1, lits: 4, occupants: [], pleine: false }],
      ['commune', 'Commune', false, null],
      ['dehors', 'Dehors', false, null],
    ]);
    expect(anna.pitance.valeurs.map((v) => [v.valeur, v.libelle]), 'sans ration, le repas ou rien').toEqual([['repas', 'Repas'], ['rien', 'Rien']]);
    expect(anna.couchage.valeurs[4].geste, 'le couchage, en verbe du noyau').toEqual({ verbe: 'fenetreChoisir', args: ['repos', 'couchage', 'dehors', a.id] });
    expect(r.note, 'une chambre pour deux et deux repas, plus que la bourse').toEqual({ cout: { gold: 0, silver: 12, brass: 0 }, bourse: { gold: 0, silver: 2, brass: 0 }, couverte: false });
  });

  it('une chambre pleine se dit à qui n’y dort pas : ses occupants, fermée', () => {
    const party = [heros('Anna', 11), heros('Borin', 12), heros('Carl', 13)];
    const banc = ouvrirLeBanc({ graine: 7, etat: { party } });
    banc.getState().offrirLeRepos({ lieu: { nom: fixtureText('Le relais') }, places: { auberge: true } });
    const carl = reposEnVue(banc.getState())!.dormeurs.find((d) => d.id === party[2].id)!;
    expect(carl.couchage.valeurs.slice(0, 2).map((v) => [v.valeur, v.chambre, v.refus]), 'la chambre des deux autres, pleine ; la sienne').toEqual([
      ['chambre-1', { offre: 'chambre', numero: 1, lits: 2, occupants: [party[0].id, party[1].id], pleine: true }, t('rf.chambrePleine')],
      ['chambre-2', { offre: 'chambre', numero: 2, lits: 2, occupants: [party[2].id], pleine: false }, null],
    ]);
  });

  it('la halte en route : les deux extrémités par leur id et leur nom à la carte', () => {
    const banc = ouvrirLeBanc({ graine: 7, etat: {
      party: [heros('Anna', 11)],
      worldMap: { id: 'carte', label: 'Carte', places: [{ id: 'pa', label: 'Weiler', pos: { x: 0, y: 0 }, scene: { id: 's-a' } }, { id: 'pb', label: 'Federholz', pos: { x: 1, y: 0 }, scene: { id: 's-b' } }], routes: [] },
    } });
    banc.getState().offrirLeRepos({ lieu: routeLieu({ fromPlaceId: 'pa', toPlaceId: 'pb' }), places: { camp: true } });
    expect(reposEnVue(banc.getState())!.lieu).toEqual({ route: { de: 'pa', vers: 'pb', deNom: 'Weiler', versNom: 'Federholz' } });
  });

  it('le temps de la nuit : clément', () => {
    expect(campement([heros('Anna', 11)]).vue().temps, 'beau temps').toEqual({ severite: 'clement', pleinAir: false, abrite: false });
  });

  it('le temps de la nuit : mauvais, sous la tente', () => {
    const campeur = heros('Anna', 11);
    campeur.items = [...(campeur.items ?? []), itemFromTrappingById('tente', idsDeTest)!];
    setRule('exposition-tente-annule', true);
    const { vue } = campement([campeur], { scene: { ...emptyScene('pluie', 4, 4), weather: 'pluie' } });
    expect(vue().temps, 'la pluie, et la tente qui abrite').toEqual({ severite: 'difficile', pleinAir: false, abrite: true });
  });

  it('ce qui attend un dormeur, dans l’ordre : le repos qui ne soigne pas et son motif, le ventre vide, les Expositions', () => {
    const blesse = heros('Anna', 11);
    addCondition(blesse, 'hemorragique', 1);
    const { banc, vue } = campement([blesse], { scene: { ...emptyScene('tempete', 4, 4), weather: 'tempete' } });
    banc.actions.fenetreChoisir('repos', 'pitance', 'rien', blesse.id);
    expect(vue().dormeurs[0].alertes).toEqual([{ genre: 'refusDeRecuperation', motif: 'instable' }, { genre: 'ventreVide' }, { genre: 'expositions', n: Number(rule('exposition-tests-nuit-extreme')) }]);
  });

  it('le dormeur règle sa nuit : la note suit, le ventre vide se dit ; ce que le lieu n’offre pas est refusé, dit', () => {
    const { banc, a, b, vue, dernier } = relais();
    for (const h of [a, b]) banc.actions.fenetreChoisir('repos', 'couchage', 'dehors', h.id);
    banc.actions.fenetreChoisir('repos', 'pitance', 'rien', a.id);
    const anna = vue().dormeurs.find((d) => d.id === a.id)!;
    expect(anna.couchage.valeurs.find((v) => v.choisie)?.valeur, 'dehors').toBe('dehors');
    expect(anna.alertes, 'le ventre vide').toEqual([{ genre: 'ventreVide' }]);
    expect(vue().note, 'un repas seul, que la bourse couvre').toEqual({ cout: { gold: 0, silver: 1, brass: 0 }, bourse: { gold: 0, silver: 2, brass: 0 }, couverte: true });

    banc.actions.fenetreChoisir('repos', 'couchage', 'bord', a.id);
    expect(dernier(), 'le hamac n’est pas offert au relais').toBe(t('choix.refus.valeur'));
    banc.actions.fenetreChoisir('repos', 'pitance', 'ration', a.id);
    expect(dernier(), 'sans ration, pas de ration').toBe(t('choix.refus.valeur'));
    expect(vue().dormeurs.find((d) => d.id === a.id)!.couchage.valeurs.find((v) => v.choisie)?.valeur, 'rien ne change').toBe('dehors');
  });
});

/**
 * L'ACCÈS RÉSERVÉ D'UN ÉTABLISSEMENT (#4277 B3) : la paire `when` + `refus` de la route (`champsDAcces`), sur
 * l'établissement d'un lieu. Fermé, il reste à l'écran du lieu, chacun de ses gestes refusé par la raison de l'auteur ;
 * le geste direct qui l'ouvre est refusé au noyau, dit. La Condition devenue vraie, il s'ouvre.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { idsDeTest } from '../engine/idsDeTest.testkit';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { resetSceneRegistry } from './monde/registreDesScenes';
import { emptyScene } from './monde/scene';
import type { WorldMap } from './worldMap';
import { tousLesHerosDeScenario } from '../scenes/test-scenarios/_heros';
import { lieuEnVue } from './lieuEnVue';

const MEMBRE = 'membre-du-club';
const REFUS = 'Le portier ne laisse entrer que les membres du club.';
const PARRAINE = 'Votre parrain attend à la porte de la forge.';

const worldMap: WorldMap = {
  id: 'carte', label: 'Carte', routes: [],
  places: [{
    id: 'bourg', label: 'Altdorf', pos: { x: 0, y: 0 }, scene: { id: 'place' },
    services: [
      { id: 'club', kind: { id: 'auberge' }, label: 'Le Club des Gentilshommes', when: { kind: 'flag', expr: MEMBRE }, refus: { texte: REFUS } },
      { id: 'forge', kind: { id: 'forgeron' }, label: 'La Forge des Pairs', when: { kind: 'flag', expr: MEMBRE }, refus: { texte: PARRAINE } },
    ],
  }],
};

let banc: Banc;
const g = () => banc.getState();
const dernier = () => g().journal[g().journal.length - 1];
const gestes = () => lieuEnVue(g())?.services.map((s) => [s.id, s.gestes.map((x) => [x.geste.verbe, x.refus])]);

beforeEach(() => {
  resetSceneRegistry();
  banc = ouvrirLeBanc();
  const place = emptyScene('place', 6, 6);
  place.entities.push({ id: 'hs', kind: 'heroStart', pos: { x: 0, y: 0 } });
  g().fixerLeGroupe(tousLesHerosDeScenario(idsDeTest));
  g().chargerLeProjet({ scenes: [place], entryId: 'place', worldMap, projet: null });
  g().ouvrirLeLieu();
});

describe('un club fermé tant que le groupe n’en est pas membre', () => {
  it('fermé, il reste à l’écran du lieu, chacun de ses gestes refusé par la raison de l’auteur', () => {
    expect(gestes()).toEqual([
      ['club', [['ouvrirLeRepos', REFUS], ['recueillirLesRumeurs', REFUS]]],
      ['forge', [['ouvrirLaBoutique', PARRAINE]]],
    ]);
  });

  it('fermé, le geste direct qui l’ouvre est refusé au noyau, et le refus est dit', () => {
    g().ouvrirLeRepos('club');
    expect([dernier(), g().pendingRest]).toEqual([REFUS, null]);
    g().recueillirLesRumeurs('club');
    expect([dernier(), g().pendingCascade]).toEqual([REFUS, null]);
    g().ouvrirLaBoutique('forge');
    expect([dernier(), g().merchant]).toEqual([PARRAINE, null]);
  });

  it('la Condition devenue vraie, il s’ouvre : ses gestes se jouent', () => {
    banc.setState({ flags: { [MEMBRE]: true } });
    expect(gestes()).toEqual([
      ['club', [['ouvrirLeRepos', null], ['recueillirLesRumeurs', null]]],
      ['forge', [['ouvrirLaBoutique', null]]],
    ]);
    g().ouvrirLeRepos('club');
    expect(g().pendingRest?.lieu).toBe('Le Club des Gentilshommes');
    g().ouvrirLaBoutique('forge');
    expect(g().merchant?.entityId).toBe('lieu:bourg:forge');
  });
});

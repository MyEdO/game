/**
 * LES ZONES D'EFFET DE L'APPEL (#3783) : chaque site qui pose une zone l'émet sur le bus (`EVT.ANIM_AOE`) avec son
 * auteur, son centre, ses cases et ce qui en tire le rendu, et `effetsDeLAppel` en rend l'effet `zone` : le Souffle de
 * Feu (le rendu de son Type, son jet jusqu'au centre), le hurlement (centré sur son auteur, sans jet), le sort de zone
 * (`castCommitZone`, teint de son Domaine) et la zone persistante d'un sort (`applyCast`, Mur de feu).
 */
import { idsDeTest } from '../engine/idsDeTest.testkit';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { bus, EVT, type ChargeDeZone } from './bus';
import { effetsDeLAppel, type Effet } from './effetsDeLAppel';
import { resolveManeuver } from './combatManeuvers';
import { applyCast, castCommitZone } from './combatFlow';
import { seedBattleRng } from './battleRng';
import { findDomainById, findManeuverById, findSpellById } from '../data';
import { souffleDuType } from '../engine/creatureAttacks';
import { createHero } from '../engine/character';
import { testScene } from '../scenes/test-fixture';
import type { CastResult } from '../engine/magic';
import type { Combatant } from '../engine/types';
import type { Jeu } from './etat';
import { blessuresSurLeProfil, blessuresDeBase } from '../engine/combattantDeTest.testkit';

let banc: Banc;
let zones: ChargeDeZone[];
let off: () => void;
beforeEach(() => {
  banc = ouvrirLeBanc();
  zones = [];
  off = bus.on(EVT.ANIM_AOE, (z) => { zones.push(structuredClone(z)); });
});
afterEach(() => { off(); });

/** L'effet de la seule zone émise, rendu sur l'état du banc. */
function laZone(): Extract<Effet, { quoi: 'zone' }> {
  expect(zones).toHaveLength(1);
  const effets = effetsDeLAppel(banc.getState() as unknown as Jeu, [{ type: 'emis', evt: 'anim_aoe', payload: zones[0] }]);
  expect(effets).toHaveLength(1);
  return effets[0] as Extract<Effet, { quoi: 'zone' }>;
}

const mk = (id: string, kind: 'hero' | 'enemy', x: number, y: number): Combatant =>
  (blessuresSurLeProfil({
    id, label: id, kind, pos: { x, y, z: 0 },
    characteristics: { 'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 30, endurance: 30, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 },
    wounds: blessuresDeBase(40), advantage: 3, conditions: [], traits: [], talents: [], skills: [], weapons: [],
    armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
  })) as unknown as Combatant;

function monterLeCombat(combatants: Combatant[]) {
  seedBattleRng(3);
  banc.setState({
    battle: { combatants, order: combatants.map((c) => c.id), turn: 0, round: 1, acted: false, log: [], zones: [] } as never,
    scene: { id: 's', name: 's', dimensions: { w: 40, h: 40 }, metresPerTile: 2, ambiance: 'jour', layers: [{ z: 0, tiles: new Array(40 * 40).fill('herbe') }], entities: [], dialogues: [], triggers: [], encounters: [] } as never,
    party: [], facing: {},
  });
  const set: Parameters<typeof resolveManeuver>[1] = (p) => banc.setState(p as never);
  return { get: () => banc.getState(), set };
}

describe('les zones d’effet de l’appel (#3783)', () => {
  it('un Souffle de Feu : le rendu de son Type, son jet de flammes jusqu’au centre, sa nappe de flammes sur chaque case', () => {
    const atk = mk('atk', 'enemy', 3, 5);
    const cible = mk('cible', 'hero', 7, 5);
    const { get, set } = monterLeCombat([atk, cible]);
    resolveManeuver(get, set, atk, souffleDuType(findManeuverById('souffle')!, 'feu'), 0, null, 0, cible);
    expect(zones[0]).toMatchObject({ de: 'atk', centre: { x: 7, y: 5 }, rendu: 'souffle-de-feu' });
    const z = laZone();
    expect(z).toMatchObject({ de: 'atk', centre: { x: 7, y: 5 }, couleur: '#ff6a20', depart: { son: { id: 'souffle' } }, trajet: { projectile: 'jet-de-flammes' }, nappe: { visuel: 'nappe-de-flammes', son: { id: 'sort-feu' } } });
    expect(z.cases).toContainEqual({ x: 7, y: 5 });
    expect(z.cases.length).toBeGreaterThan(1);
  });

  it('un hurlement : centré sur son auteur, sans jet, son onde et son cri', () => {
    const atk = mk('atk', 'enemy', 5, 5);
    const { get, set } = monterLeCombat([atk, mk('h', 'hero', 6, 5)]);
    resolveManeuver(get, set, atk, findManeuverById('hurlement-fantomatique')!, 0, null, 0);
    expect(laZone()).toMatchObject({ de: 'atk', centre: { x: 5, y: 5 }, trajet: null, depart: { son: { id: 'hurlement' } }, nappe: { visuel: 'onde' } });
  });

  it('un sort de zone posé : son Domaine teint la zone, son trait vole jusqu’au centre, même posé dans le vide', () => {
    const c = mk('lanceur', 'hero', 5, 5);
    monterLeCombat([c, mk('loin', 'enemy', 30, 30)]);
    const lance: CastResult = { cast: true, roll: 11, target: 80, sl: 4, isCritical: false, isFumble: false, log: 'lancé' };
    banc.setState({ pendingCast: { casterId: 'lanceur', targetId: 'lanceur', spellId: 'comete-de-cassandora', missile: true, focused: false, result: lance, zone: { center: null, radius: 1, r0m: 1, placing: true } } as never });
    castCommitZone(banc.getState, banc.setState, { x: 9, y: 5 });
    expect(zones[0]).toMatchObject({ de: 'lanceur', centre: { x: 9, y: 5 }, sort: 'comete-de-cassandora' });
    expect(zones[0].tiles).toHaveLength(9);
    const domaine = findDomainById(findSpellById('comete-de-cassandora')!.domainId)!;
    expect(laZone()).toMatchObject({ couleur: domaine.couleur, trajet: { projectile: 'trait-magique' } });
  });

  it('la zone persistante d’un sort (Mur de feu) : le sort la nomme, sa nappe est celle de son Domaine', () => {
    const W = createHero({ idNeuf: idsDeTest, speciesId: 'humains-reiklander', careerId: 'soldat', label: 'W', seed: 3 });
    banc.setState({ party: [W] });
    banc.getState().lancerLaScene(testScene());
    banc.getState().lancerLeCombat('enc-mutants');
    banc.getState().fenetreValider('roundStart');
    banc.abandonner();
    banc.getState().ensemencerLeTirage(5);
    const b = banc.getState().battle!;
    const lanceur = b.combatants.find((c) => c.label === 'W')!;
    lanceur.characteristics['force-mentale'] = 40;
    lanceur.pos = { x: 5, y: 10 };
    const T = b.combatants.filter((c) => c.kind === 'enemy')[0];
    T.pos = { x: 10, y: 10 };
    zones = [];
    applyCast(banc.getState, banc.setState, lanceur, T, findSpellById('mur-de-feu')!, { cast: true, roll: 30, target: 70, sl: 6, isCritical: false, isFumble: false, log: 'ok' }, false, false);
    expect(zones[0]).toMatchObject({ de: lanceur.id, centre: { x: 10, y: 10 }, sort: 'mur-de-feu' });
    expect(laZone()).toMatchObject({ couleur: '#ff5a2a', nappe: { visuel: 'nappe-de-flammes', son: { id: 'sort-feu' } } });
  });
});

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
import { effetsDeLAppel, zonesQuiDurentEnVue, type Effet } from './effetsDeLAppel';
import { caseEnVue } from './visionDuGroupe';
import { resolveManeuver } from './combatManeuvers';
import { applyCast, castCommitZone } from './combatFlow';
import { seedBattleRng } from './battleRng';
import { findDomainById, findManeuverById, findSpellById } from '../data';
import { souffleDuType } from '../engine/creatureAttacks';
import { discTiles } from './monde/zones';
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

const mk = (id: string, kind: 'heros' | 'ennemi', x: number, y: number): Combatant =>
  (blessuresSurLeProfil({
    id, label: id, kind, pos: { x, y, z: 0 },
    characteristics: { 'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 30, endurance: 30, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 },
    wounds: blessuresDeBase(40), advantage: 3, conditions: [], traits: [], talents: [], skills: [], weapons: [],
    armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
  })) as unknown as Combatant;

/** Le combat de `combatants` sur un pré de 40 × 40 cases, de jour, bordé des murs `murs`. */
function monterLeCombat(combatants: Combatant[], murs: { x: number; y: number; side: 'N' | 'E' }[] = []) {
  seedBattleRng(3);
  banc.setState({
    battle: { combatants, order: combatants.map((c) => c.id), turn: 0, round: 1, acted: false, log: [], zones: [] } as never,
    scene: { id: 's', name: 's', dimensions: { w: 40, h: 40 }, metresPerTile: 2, ambiance: 'jour', layers: [{ z: 0, tiles: new Array(40 * 40).fill('herbe') }], walls: murs, entities: [], dialogues: [], triggers: [], encounters: [] } as never,
    party: [], facing: {},
  });
  const set: Parameters<typeof resolveManeuver>[1] = (p) => banc.setState(p as never);
  return { get: () => banc.getState(), set };
}

describe('les zones d’effet de l’appel (#3783)', () => {
  it('un Souffle de Feu : le rendu de son Type, son jet de flammes jusqu’au centre, sa nappe de flammes sur chaque case', () => {
    const atk = mk('atk', 'ennemi', 3, 5);
    const cible = mk('cible', 'heros', 7, 5);
    const { get, set } = monterLeCombat([atk, cible]);
    resolveManeuver(get, set, atk, souffleDuType(findManeuverById('souffle')!, 'feu'), 0, null, 0, cible);
    expect(zones[0]).toMatchObject({ de: 'atk', centre: { x: 7, y: 5 }, rendu: 'souffle-de-feu' });
    const z = laZone();
    expect(z).toMatchObject({ de: 'atk', centre: { x: 7, y: 5 }, couleur: '#ff6a20', depart: { son: { id: 'souffle' } }, trajet: { projectile: 'jet-de-flammes' }, nappe: { visuel: 'nappe-de-flammes', son: { id: 'sort-feu' } } });
    expect(z.cases).toContainEqual({ x: 7, y: 5 });
    expect(z.cases.length).toBeGreaterThan(1);
  });

  it('un hurlement : centré sur son auteur, sans jet, son onde et son cri', () => {
    const atk = mk('atk', 'ennemi', 5, 5);
    const { get, set } = monterLeCombat([atk, mk('h', 'heros', 6, 5)]);
    resolveManeuver(get, set, atk, findManeuverById('hurlement-fantomatique')!, 0, null, 0);
    expect(laZone()).toMatchObject({ de: 'atk', centre: { x: 5, y: 5 }, trajet: null, depart: { son: { id: 'hurlement' } }, nappe: { visuel: 'onde' } });
  });

  it('un sort de zone posé : son Domaine teint la zone, son trait vole jusqu’au centre, même posé dans le vide', () => {
    const c = mk('lanceur', 'heros', 5, 5);
    monterLeCombat([c, mk('loin', 'ennemi', 30, 30)]);
    const lance: CastResult = { cast: true, roll: 11, target: 80, sl: 4, isCritical: false, isFumble: false, log: 'lancé' };
    banc.setState({ pendingCast: { casterId: 'lanceur', targetId: 'lanceur', spellId: 'comete-de-cassandora', missile: true, focused: false, result: lance, zone: { center: null, radius: 1, r0m: 1, placing: true } } as never });
    castCommitZone(banc.getState, banc.setState, { x: 9, y: 5 });
    expect(zones[0]).toMatchObject({ de: 'lanceur', centre: { x: 9, y: 5 }, sort: 'comete-de-cassandora' });
    expect(zones[0].tiles).toHaveLength(9);
    const domaine = findDomainById(findSpellById('comete-de-cassandora')!.domainId?.id)!;
    expect(laZone()).toMatchObject({ couleur: domaine.couleur, trajet: { projectile: 'trait-magique' } });
  });

  it('la zone persistante d’un sort (Mur de feu) : le sort la nomme, sa nappe est celle de son Domaine', () => {
    const W = createHero({ idNeuf: idsDeTest, speciesId: 'humains-reiklander', careerId: 'soldat', label: 'W', seed: 3 });
    banc.setState({ party: [W] });
    banc.getState().lancerLaScene(testScene());
    banc.getState().lancerLeCombat('enc-mutants');
    banc.getState().fenetreValider('debutDuRound');
    banc.abandonner();
    banc.getState().ensemencerLeTirage(5);
    const b = banc.getState().battle!;
    const lanceur = b.combatants.find((c) => c.label === 'W')!;
    lanceur.characteristics['force-mentale'] = 40;
    lanceur.pos = { x: 5, y: 10 };
    const T = b.combatants.filter((c) => c.kind === 'ennemi')[0];
    T.pos = { x: 10, y: 10 };
    zones = [];
    applyCast(banc.getState, banc.setState, lanceur, T, findSpellById('mur-de-feu')!, { cast: true, roll: 30, target: 70, sl: 6, isCritical: false, isFumble: false, log: 'ok' }, false, false);
    expect(zones[0]).toMatchObject({ de: lanceur.id, centre: { x: 10, y: 10 }, sort: 'mur-de-feu' });
    expect(laZone()).toMatchObject({ couleur: '#ff5a2a', nappe: { visuel: 'nappe-de-flammes', son: { id: 'sort-feu' } } });
  });
});

/** Un mur plein `E` sur toute la colonne `x` du pré. */
const murEn = (x: number) => Array.from({ length: 40 }, (_, y) => ({ x, y, side: 'E' as const }));
/** Les cases du rectangle `xs` × `ys`. */
const rect = (xs: number[], ys: number[]) => xs.flatMap((x) => ys.map((y) => ({ x, y })));
/** Les zones qui durent du banc, telles que le pont les sert. */
const vues = () => zonesQuiDurentEnVue(banc.getState() as unknown as Jeu);
/** Pose `zonesPosees` aux zones du combat du banc. */
const poser = (zonesPosees: unknown[]) => banc.setState({ battle: { ...banc.getState().battle!, zones: zonesPosees } } as never);

describe('une fumée lancée en vue (#3950)', () => {
  it('un Souffle de Fumée 5 × 5 se montre entier par son bord vu ; une fumée dont ni case ni voisine n’est vue, non', () => {
    const atk = mk('atk', 'heros', 3, 5);
    const cible = mk('cible', 'ennemi', 7, 5);
    const { get, set } = monterLeCombat([atk, cible]);
    resolveManeuver(get, set, atk, souffleDuType(findManeuverById('souffle')!, 'fumee'), 0, null, 0, cible);
    expect(zones[0].tiles, 'témoin : un souffle de 5 × 5 cases').toHaveLength(25);
    const [fumee] = get().battle!.zones!;
    const cachee = { label: 'Fumée', tiles: [{ x: 12, y: 5 }, { x: 13, y: 5 }], rounds: 2, blocksLoS: true, rendu: { id: 'souffle-de-fumee' } };
    banc.setState({ battle: { ...get().battle!, zones: [fumee, cachee] } } as never);
    const etat = banc.getState() as unknown as Jeu;
    const vue = (c: { x: number; y: number }) => caseEnVue(etat, c);
    expect(fumee.tiles.filter(vue), 'témoin : aucune case sous la fumée n’est vue').toEqual([]);
    expect(cachee.tiles.flatMap((t) => discTiles(t, 1)).filter(vue), 'témoin : ni case ni voisine de la fumée cachée n’est vue').toEqual([]);
    expect(laZone().cases, 'l’effet de l’appel : ses 25 cases').toHaveLength(25);
    const durent = zonesQuiDurentEnVue(etat);
    expect(durent.map((z) => z.cases.length), 'la fumée vue sert ses cases entières, la cachée aucune').toEqual([fumee.tiles.length]);
  });
});

describe('les zones qui durent telles que le groupe les voit (#3834, #3950)', () => {
  it('celle d’un sort au rendu de son Domaine, une fumée au sien, une zone sans rendu cachée', () => {
    monterLeCombat([mk('h', 'heros', 3, 5)]);
    const cases = [{ x: 4, y: 3 }, { x: 5, y: 3 }, { x: 6, y: 3 }];
    const sort = findSpellById('mur-de-feu')!;
    poser([
      { label: 'Mur', tiles: cases, rounds: 3, source: { kind: 'sort', id: sort.id } },
      { label: 'Fumée', tiles: cases, rounds: 2, blocksLoS: true, rendu: { id: 'souffle-de-fumee' } },
      { label: 'Piège', tiles: cases, rounds: 1, permanent: true, perRound: [] },
      { label: 'Fumée', tiles: cases, rounds: 2, rendu: { id: 'souffle-de-fumee' } },
    ]);
    const [feu, fumee, seconde] = vues();
    expect(feu).toMatchObject({ cases, centre: { x: 5, y: 3 }, couleur: findDomainById(sort.domainId!.id)!.couleur, visuel: 'nappe-de-flammes', boucle: { id: 'crepitement' } });
    expect(fumee).toMatchObject({ visuel: 'nuage', boucle: null });
    expect(seconde.cle, 'deux zones au même rendu et au même centre gardent chacune sa clé').not.toBe(fumee.cle);
    poser([{ label: 'Piège', tiles: cases, rounds: 1 }]);
    expect(vues()).toEqual([]);
  });

  it('réduite à ses cases vues : en partie derrière un mur, puis entière le mur ôté, sous la même clé ; hors de vue, absente', () => {
    monterLeCombat([mk('h', 'heros', 3, 5)], murEn(6));
    const cases = [4, 5, 6, 7, 8].map((x) => ({ x, y: 5 }));
    const mur = { label: 'Mur', tiles: cases, rounds: 3, source: { kind: 'sort', id: 'mur-de-feu' } };
    poser([mur]);
    const [partielle] = vues();
    expect(partielle).toMatchObject({ cases: cases.slice(0, 3), centre: { x: 5, y: 5 } });
    banc.setState({ scene: { ...banc.getState().scene!, walls: [] } } as never);
    const [entiere] = vues();
    expect(entiere).toMatchObject({ cases, centre: { x: 6, y: 5 } });
    expect(entiere.cle, 'la clé de la zone entière').toBe(partielle.cle);
    banc.setState({ scene: { ...banc.getState().scene!, walls: murEn(6) } } as never);
    poser([{ ...mur, tiles: [8, 9, 10].map((x) => ({ x, y: 5 })) }]);
    expect(vues(), 'derrière le mur, aucune case vue').toEqual([]);
  });

  it('une fumée derrière un mur plein ne se montre pas, ni le feu dessous, ni la zone d’un appel lancé là ; devant le mur, entière', () => {
    monterLeCombat([mk('h', 'heros', 3, 5), mk('e', 'ennemi', 8, 12)], murEn(5));
    const derriere = { label: 'Fumée', tiles: rect([6, 7, 8], [4, 5, 6]), rounds: 2, blocksLoS: true, rendu: { id: 'souffle-de-fumee' } };
    const feu = { label: 'Feu', tiles: [{ x: 7, y: 5 }], rounds: 2, rendu: { id: 'souffle-de-feu' } };
    const devant = { label: 'Fumée', tiles: rect([4, 5], [7, 8, 9]), rounds: 2, blocksLoS: true, rendu: { id: 'souffle-de-fumee' } };
    poser([derriere, feu, devant]);
    const etat = banc.getState() as unknown as Jeu;
    expect(rect([5], [4, 5, 6]).every((c) => caseEnVue(etat, c)), 'témoin : le pied du mur, côté du groupe, est vu').toBe(true);
    expect(rect([9], [3, 4, 5, 6, 7]).some((c) => caseEnVue(etat, c)), 'témoin : rien derrière le mur n’est vu').toBe(false);
    expect(vues().map((z) => z.cases.length), 'seule la fumée devant le mur, entière').toEqual([devant.tiles.length]);
    const appel = effetsDeLAppel(etat, [{ type: 'emis', evt: 'anim_aoe', payload: { de: 'e', centre: { x: 7, y: 5 }, tiles: derriere.tiles, rendu: 'souffle-de-fumee' } }]);
    expect(appel, 'la zone d’un appel lancé derrière le mur').toEqual([]);
  });
});

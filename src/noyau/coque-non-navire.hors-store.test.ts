/**
 * Une coque routière n'est pas un navire (EDOC 07 l.334, MDG 13 l.656).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import type { Combatant } from '../engine/types';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { spawnEnemy } from './monde/spawn';
import { applyCriticalToTarget, runEnemyAI } from './combatFlow';
import { emptyScene, isWalkable, type Scene } from './monde/scene';
import { createHero } from '../engine/character';
import { nomDe } from '../engine/nom';
import { idsDeTest } from '../engine/idsDeTest.testkit';
import { footprintTiles } from './monde/footprint';
import { occupied } from './monde/combatGeometry';
import { tileKey } from './monde/path';
import { placeCombatant } from './monde/spawn';
import { translaterFormation } from './monde/shipPostes';
import { capEnCombat, coquesDeLaScene } from './planDeNavire';
import { bassinDeLaCaraque } from './planDeNavire.testkit';
import { coquesEnVue } from './visionDuGroupe';
import { buildScene } from './mapSpec';
import { garanti } from '../lib/garanti';
import { t } from '../i18n';

/** Une coque qui n'est PAS un navire (`profilNavalDe` : pas de facette `ship`) — EDOC 07 l.334, MDG 13 l.656. */
const diligence = (id = 'dil', pos = { x: 7, y: 5 }): Combatant => spawnEnemy({ vehicule: 'diligence' }, id, pos);
const cogue = (id = 'nav', pos = { x: 5, y: 5 }): Combatant => spawnEnemy({ vehicule: 'cogue' }, id, pos);

let banc: Banc;

const poser = (combatants: Combatant[], over: Record<string, unknown> = {}): void => {
  banc.setState({
    battle: { combatants, order: combatants.map((c) => c.id), turn: 0, round: 1, acted: false, log: [] } as never,
    party: [], scene: emptyScene('scene-test', 20, 20), travelPlan: null, facing: {}, vessel: null, journal: [], ...over,
  } as never);
};

describe('coque routière (EDOC 07 l.334) : ni Critique, ni collision, ni IA de navire', () => {
  beforeEach(() => {
    banc = ouvrirLeBanc();
    banc.getState().ensemencerLeTirage(7);
  });

  it('un Critique sur une diligence ne lève pas, ne compte aucune Blessure Critique, ne pose aucun État et journalise le refus', () => {
    const dil = diligence();
    poser([dil]);
    const avant = { conditions: [...dil.conditions], criticalWounds: dil.criticalWounds };
    const log: string[] = [];
    expect(applyCriticalToTarget(dil, 'corps', 0, log, banc.setState, { get: banc.getState })).toBe('aucune');
    expect(dil.criticalWounds).toBe(avant.criticalWounds);
    expect(dil.conditions).toEqual(avant.conditions);
    expect(log).toEqual([t('cf.coqueSansCritique', { name: nomDe(dil) })]);
  });

  it("un navire qui avance sur une diligence ne résout aucune collision : aucune des deux coques n'encaisse", () => {
    const nav = cogue();
    const dil = diligence();
    poser([nav, dil], { facing: { nav: 'E' } });
    const avant = { nav: nav.wounds.current, dil: dil.wounds.current };
    banc.getState().avancerLeNavire('nav', 3);
    const b = banc.getState().battle!;
    expect(b.combatants.find((c) => c.id === 'dil')!.wounds.current).toBe(avant.dil);
    expect(b.combatants.find((c) => c.id === 'nav')!.wounds.current).toBe(avant.nav);
  });

  it("une diligence ENNEMIE à son tour face à un navire de héros ne joue pas l'IA de navire et ne lève pas", () => {
    const nav = cogue('nav', { x: 3, y: 5 });
    nav.kind = 'heros';
    const dil = diligence('dil', { x: 10, y: 5 });
    poser([nav, dil], { facing: { nav: 'E', dil: 'W' } });
    banc.setState({ battle: { ...banc.getState().battle!, turn: 1 } });
    expect(() => runEnemyAI(banc.getState, banc.setState, 'dil')).not.toThrow();
    expect(banc.getState().battle!.combatants.find((c) => c.id === 'dil')!.pos).toEqual({ x: 10, y: 5 });
  });
});

describe('coque routière au combat : la scène porte son corps, qui ne bouge pas (#4471)', () => {
  const ANCRE = { x: 6, y: 6 };
  /** Une cour où la diligence est membre de la rencontre, le combat lancé par le jeu. */
  const auCombat = () => {
    banc = ouvrirLeBanc();
    banc.setState({ party: [createHero({ idNeuf: idsDeTest, speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', seed: 1 })] });
    const cour: Scene = emptyScene('cour', 14, 14);
    cour.entities = [{ id: 'depart', kind: 'heroStart', pos: { x: 1, y: 1 } }, { id: 'dil', kind: 'personnage', vehicule: { id: 'diligence' }, pos: { ...ANCRE } }];
    cour.encounters = [{ id: 'enc', members: [{ entityId: 'dil' }] }];
    banc.getState().lancerLaScene(cour);
    banc.getState().lancerLeCombat('enc', undefined, { noSurprise: true });
    const s = banc.getState();
    return { dil: s.battle!.combatants.find((c) => c.id === 'dil')!, heros: s.battle!.combatants.find((c) => c.kind === 'heros')! };
  };
  const cases = footprintTiles(ANCRE, 2);

  it('une avance refusée et nommée : la diligence reste en place, ses cases tenues par la scène seule', () => {
    const { dil, heros } = auCombat();
    expect(banc.getState().avancerLeNavire('dil', 3)).toBe(0);
    const s = banc.getState();
    expect(dil.pos).toMatchObject(ANCRE);
    expect(s.refus?.texte).toBe(t('cs.refusCorpsImmobile', { name: nomDe(dil) }));
    const occ = occupied(s.battle!, heros);
    expect(cases.map((c) => [isWalkable(s.scene!, c.x, c.y, 0), occ.has(tileKey(c.x, c.y, 0))])).toEqual(Array(4).fill([false, false]));
  });

  it('une poussée (`translaterFormation`) et une pose (`placeCombatant`, Effet `to`) refusées', () => {
    const { dil } = auCombat();
    const { battle, scene } = banc.getState();
    expect(translaterFormation(battle!.combatants, scene, dil, [], { x: 1, y: 0 })).toBeNull();
    expect(placeCombatant(dil, scene, { x: 9, y: 9 })).toBe(false);
    expect(dil.pos).toMatchObject(ANCRE);
  });

  it('son cap est celui de la scène : sans cap d’auteur, le nord, jamais tournée vers l’ennemi ni par un geste', () => {
    const { dil, heros } = auCombat();
    expect([banc.getState().facing.dil, capEnCombat(banc.getState(), 'dil')]).toEqual([undefined, 'N']);
    banc.getState().orienterVers('dil', dil.pos!, heros.pos!);
    expect([banc.getState().facing.dil, capEnCombat(banc.getState(), 'dil')]).toEqual([undefined, 'N']);
  });
});

describe('le groupe ne voit une coque terrestre que là où il la voit (#4471)', () => {
  const heros = () => [createHero({ idNeuf: idsDeTest, speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', seed: 1 })];
  /** Un pré où une rencontre pose une diligence et un brigand, en embuscade ou non, sous `lumiere`. */
  const pre = (hidden: boolean, lumiere: 'jour' | 'nuit', x: number): Scene => buildScene({
    id: 'pre', label: 'Pré', size: [30, 8], terrain: 'herbe', ambientLight: lumiere, heroStart: [1, 4],
    encounters: [{ id: 'emb', hidden, enemies: [
      { vehicule: { id: 'diligence' }, pos: { x, y: 3 }, label: 'Diligence' },
      { creature: { id: 'humain' }, pos: { x: 3, y: 4 }, label: 'Brigand' },
    ] }],
  });
  const lancer = (scene: Scene) => {
    banc = ouvrirLeBanc();
    banc.setState({ party: heros() });
    banc.getState().lancerLaScene(scene);
    return garanti(banc.getState().scene!.entities.find((e) => e.vehicule), 'diligence', 'entité de la rencontre').id;
  };

  it('en exploration, connue, elle se montre', () => {
    const vue = lancer(pre(false, 'jour', 18));
    expect(coquesEnVue(banc.getState(), banc.getState().scene!).map((c) => c.id)).toEqual([vue]);
  });

  it('en exploration, en embuscade, jamais', () => {
    lancer(pre(true, 'jour', 18));
    expect(coquesEnVue(banc.getState(), banc.getState().scene!)).toEqual([]);
  });

  it('au combat, hors de vue de nuit, elle ne se montre pas ; un navire posé par ses ponts, le plateau, toujours', () => {
    const id = lancer(pre(false, 'nuit', 26));
    banc.getState().lancerLeCombat('emb', undefined, { noSurprise: true });
    expect(coquesDeLaScene(banc.getState().scene!).map((c) => c.id)).toEqual([id]);
    expect(coquesEnVue(banc.getState(), banc.getState().scene!)).toEqual([]);
    const bassin = bassinDeLaCaraque('N');
    const enEmbuscade = { ...bassin, entities: bassin.entities.map((e) => (e.vehicule ? { ...e, combat: { hiddenUntilCombat: true } } : e)) };
    expect(coquesEnVue(banc.getState(), enEmbuscade).map((c) => c.id)).toEqual(['c1']);
  });
});

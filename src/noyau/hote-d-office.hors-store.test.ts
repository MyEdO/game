/**
 * L'ÉTAPE HÔTE QU'AUCUN HUMAIN NE TIENT (#3892) — `sieges.tenuParUnHumain` : « leur étape se résout d'office et se
 * montre au bilan ». Parquée dans le slot par le pilote immédiat, elle se joue par les MÊMES verbes qu'un humain
 * (`jetLancer`/`jetValider` sur son flux, `combatAuto.jouerLaPaireDuJet`) ; tenue, elle reste parquée sur sa fenêtre.
 * Matrice des hôtes atteignables hors bataille par leur producteur réel : Test (`openSkillTest`), Test étendu
 * (`ouvrirLeTestEtendu`), incantation (`incanterLeSort`) ; en bataille, l'incantation du héros IA (`runEnemyAI`).
 */
import { idsDeTest } from '../engine/idsDeTest.testkit';
import { describe, it, expect, beforeEach } from 'vitest';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { createHero } from '../engine/character';
import { herosDeScenario } from '../scenes/test-scenarios/_heros';
import { openSkillTest } from './combatEffects';
import { condCtx } from './bourseFlow';
import { EMPTY_FLOW } from '../engine/flowCore';
import { startCascade } from './cascade';
import { runEnemyAI } from './combatFlow';
import { spawnEnemy } from './monde/spawn';
import { seedBattleRng } from './battleRng';
import { findSpellById } from '../data';
import { blessuresDeBase } from '../engine/combattantDeTest.testkit';
import { cleDeFixture } from './noyau.testkit';
import { fixtureText } from '../i18n/fixtureText';
import type { Combatant } from '../engine/types';
import type { PendingKey } from './stateFields';

let banc: Banc;
beforeEach(() => {
  banc = ouvrirLeBanc();
  banc.setState({ battle: null, pendingCascade: null, suspendedCascades: [], journal: [] });
  banc.getState().ensemencerLeTirage(5);
});

const heros = (ia: boolean): Combatant => {
  const h = createHero({ idNeuf: idsDeTest, speciesId: 'humains-reiklander', careerId: 'soldat', label: 'Brawn', seed: 1 });
  h.aiControlled = ia;
  return h;
};

const sorcier = (ia: boolean): Combatant => {
  const w = herosDeScenario(idsDeTest, 'sorcier');
  const sk = w.skills.find((s) => s.id === 'langue');
  if (sk) sk.advances = Math.max(sk.advances, 10);
  else w.skills.push({ id: 'langue', spec: 'magick', advances: 10 } as never);
  w.aiControlled = ia;
  return w;
};

/** Un membre de la matrice : son porteur, son producteur réel, le slot qui porte la donnée de son jet. */
const MEMBRES: readonly { jet: string; slot: PendingKey; porteur: (ia: boolean) => Combatant; ouvrir: (c: Combatant) => void }[] = [
  {
    jet: 'test', slot: 'pendingTest', porteur: heros,
    ouvrir: (c) => { openSkillTest(banc.getState, banc.setState, { characteristic: 'force-mentale', difficulty: 'difficile' } as never, condCtx(banc.getState), EMPTY_FLOW, EMPTY_FLOW, EMPTY_FLOW, { actorId: c.id }); },
  },
  {
    jet: 'testEtendu', slot: 'pendingExtendedTest', porteur: heros,
    ouvrir: (c) => banc.getState().ouvrirLeTestEtendu({ actorId: c.id, label: 'Enfoncer la porte', skillLabel: 'Force', target: 70, drCible: 2 }),
  },
  {
    jet: 'incantation', slot: 'pendingCast', porteur: sorcier,
    ouvrir: (c) => banc.getState().incanterLeSort(c.id, 'armure-aethyrique', c.id),
  },
];

describe('Étape hôte hors bataille : tenue, elle parque ; non tenue, ses verbes se jouent d’office (#3892)', () => {
  for (const m of MEMBRES) {
    it(`${m.jet} — porteur TENU : l’étape reste parquée sur sa fenêtre, non validée`, () => {
      const c = m.porteur(false);
      banc.setState({ party: [c] });
      m.ouvrir(c);
      const p = banc.getState().pendingCascade!;
      expect(p.participants[p.cursor].jet).toBe(m.jet);
      expect(p.participants[p.cursor].committed).toBeFalsy();
      expect(banc.getState()[m.slot], 'la fenêtre vit : son slot porte la donnée').not.toBeNull();
    });

    it(`${m.jet} — porteur NON TENU (IA) : la paire lancer/valider se joue sur le slot, la fenêtre se ferme`, () => {
      const c = m.porteur(true);
      banc.setState({ party: [c] });
      m.ouvrir(c);
      expect(banc.getState()[m.slot], 'le jet a été joué et validé par ses verbes').toBeNull();
      expect(banc.getState().pendingCascade, 'aucune étape hôte ne reste parquée').toBeNull();
    });
  }

  it('Test étendu NON TENU à plusieurs Rounds : une paire par Round jusqu’à la borne d’essais', () => {
    const c = heros(true);
    banc.setState({ party: [c] });
    banc.getState().ouvrirLeTestEtendu({ actorId: c.id, label: 'Enfoncer la porte', skillLabel: 'Force', target: 70, drCible: 100, tentativesMax: 3 });
    expect(banc.getState().pendingExtendedTest, 'trois Rounds joués : la borne d’essais clôt le Test').toBeNull();
    expect(banc.getState().pendingCascade).toBeNull();
    expect(banc.getState().journal.some((l) => l.startsWith('Enfoncer la porte : échoué'))).toBe(true);
  });

  for (const m of MEMBRES) {
    it(`${m.jet} — slot VIVANT d’un autre contexte : la cascade qui le tenait est suspendue, pas écrasée, puis reprise à la sortie de l’hôte (#4006)`, () => {
      const autre = heros(false);
      const c = m.porteur(true);
      banc.setState({ party: [autre, c] });
      startCascade(banc.getState, banc.setState, {
        title: 'Autre', purpose: 'upkeep',
        steps: [{ id: 'autre-1', kind: cleDeFixture('note'), actorId: autre.id, options: [{ key: 'a', label: fixtureText('A') }, { key: 'b', label: fixtureText('B') }] }],
      });
      m.ouvrir(c);
      expect(banc.getState()[m.slot], 'le jet s’est joué d’office').toBeNull();
      expect(banc.getState().suspendedCascades, 'la pile est vide').toEqual([]);
      expect(banc.getState().pendingCascade?.participants.map((x) => x.id), 'la cascade qui tenait le slot y revient, intacte').toEqual(['autre-1']);
    });
  }
});

describe('Étape hôte en bataille : le héros IA qui incante (#3892)', () => {
  it('cadence manuelle : dégâts appliqués et séquence close au passage de son tour, un seul jetValider', () => {
    seedBattleRng(17);
    const c = herosDeScenario(idsDeTest, 'sorcier');
    c.id = 'caster'; c.aiControlled = true;
    c.characteristics.intelligence = 70; c.characteristics['force-mentale'] = 70;
    c.skills = [{ id: 'langue', spec: 'magick', characteristic: 'intelligence', advances: 60 } as never];
    c.spells = [findSpellById('flechette')!.id]; c.pos = { x: 5, y: 5 }; c.advantage = 0;
    const ennemi = (id: string, x: number): Combatant => {
      const e = spawnEnemy({ ref: 'humain' }, id, { x, y: 5 });
      e.kind = 'ennemi'; e.skills = []; e.spells = []; e.talents = []; e.wounds = blessuresDeBase(30, 30, e);
      return e;
    };
    const battle = {
      combatants: [c, ennemi('e1', 8), ennemi('e2', 9)], order: ['caster', 'e1', 'e2'], baseOrder: ['caster', 'e1', 'e2'],
      turn: 0, round: 1, action: null, selectedSpellId: null, reachable: new Map(), movementUsed: 0, movedPreAction: false, acted: false, log: [], over: null,
    } as never;
    const scene = { id: 's', dimensions: { w: 20, h: 20 }, layers: [{ z: 0, tiles: [] }], entities: [], dialogues: [], triggers: [], encounters: [] } as never;
    banc.setState({ battle, scene, party: [c], partyPos: { x: 0, y: 0 }, actorAoe: null, pendingCast: null });
    const jetValider = banc.getState().jetValider;
    const valides: string[] = [];
    banc.setState({ jetValider: (jet, ...reste) => { valides.push(jet); return jetValider(jet, ...reste); } });
    runEnemyAI(banc.getState, banc.setState, 'caster');
    banc.jusquA((e) => e.battle!.turn !== 0, 20);
    const s = banc.getState();
    expect(s.pendingCast, 'aucune révélation ne reste ouverte').toBeNull();
    expect(s.pendingCascade, 'la séquence d’incantation est close').toBeNull();
    const perdues = ['e1', 'e2'].reduce((n, id) => n + 30 - s.battle!.combatants.find((x) => x.id === id)!.wounds.current, 0);
    expect(perdues, 'les dégâts du sort sont appliqués').toBeGreaterThan(0);
    expect(valides.filter((j) => j === 'incantation')).toHaveLength(1);
  });
});

import { describe, it, expect } from 'vitest';
import { applySummon, purgeExpiredSummons } from './summonFlow';
import type { Combatant } from '../engine/types';
import type { Scene } from './scene';
import { gameOpSchema, OPS_NON_TYPEES } from '../data/schemas/grammaire/mecanique';

/**
 * Moteur d'invocation (SpellSpec.summon) : la créature entre en combat dans le camp du lanceur,
 * insérée dans l'initiative, marquée `Combatant.summon` ; elle se dissipe à l'expiration de durée
 * ou si le lanceur (pour les minions liés) tombe.
 */
const caster = (over: Partial<Combatant> = {}): Combatant =>
  ({
    id: 'necro', label: 'Nécromancien', kind: 'hero',
    characteristics: { 'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 30, endurance: 30, initiative: 30, agilite: 30, dexterite: 30, intelligence: 40, 'force-mentale': 40, sociabilite: 30 },
    wounds: { current: 20, max: 20 }, advantage: 0, conditions: [], skills: [], talents: [],
    weapons: [], armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    pos: { x: 5, y: 5 }, ...over,
  } as Combatant);

const scene = (): Scene =>
  ({ id: 's', name: 's', dimensions: { w: 14, h: 14 }, ambiance: 'exterieur', layers: [{ z: 0, tiles: new Array(14 * 14).fill('herbe') }], entities: [], dialogues: [], triggers: [], encounters: [] } as unknown as Scene);

/** Scène à 2 couches (sol z0 + chemin de ronde z1), les deux praticables — pour les cas z-aware (#802). */
const sceneWithRampart = (): Scene =>
  ({
    id: 's', name: 's', dimensions: { w: 14, h: 14 }, ambiance: 'exterieur',
    layers: [
      { z: 0, tiles: new Array(14 * 14).fill('herbe') },
      { z: 1, tiles: new Array(14 * 14).fill('pierre') },
    ],
    entities: [], dialogues: [], triggers: [], encounters: [],
  } as unknown as Scene);

const battle = (combatants: Combatant[], round = 1): any => {
  const order = combatants.map((c) => c.id);
  // En début de combat réel, `order` et `baseOrder` partagent la MÊME référence (régression : une
  // insertion d'invocation ne doit pas frapper le tableau deux fois).
  return { combatants, order, baseOrder: order, turn: 0, round, log: [], zones: [], over: false };
};

function harness(_c: Combatant, b: any, sc: Scene = scene()) {
  let state: any = { battle: b, scene: sc };
  return { get: () => state, set: (p: any) => { state = { ...state, ...p }; }, state: () => state };
}

describe('applySummon', () => {
  it('Réanimation : invoque BFM + DR créatures alliées, placées et insérées dans l’ordre', () => {
    const c = caster(); // BFM = 4
    const h = harness(c, battle([c]));
    const lines = applySummon(h.get, h.set, c, { ref: 'zombie', count: { bonusOf: 'force-mentale' }, countPerSL: { every: 1, amount: 1 }, allyOfCaster: true, despawnIfCasterDown: true }, { sl: 2, rounds: null, label: 'Réanimation' });
    const summons = h.state().battle.combatants.filter((x: Combatant) => x.summon);
    expect(summons.length).toBe(4 + 2); // BFM(4) + DR(2)
    expect(summons.every((s: Combatant) => s.kind === 'hero')).toBe(true); // camp du lanceur héros
    expect(summons.every((s: Combatant) => s.summon!.byId === 'necro' && s.summon!.despawnIfSummonerDown)).toBe(true);
    expect(h.state().battle.order).toContain(summons[0].id); // dans l'initiative
    const order = h.state().battle.order;
    expect(new Set(order).size).toBe(order.length); // AUCUN doublon (order ≠ baseOrder dédoublés)
    expect(h.state().battle.baseOrder).not.toBe(h.state().battle.order); // dédoublés à l'insertion
    expect(lines.join(' ')).toMatch(/invoque 6/);
  });

  it('summon hostile : camp opposé au lanceur', () => {
    const c = caster();
    const h = harness(c, battle([c]));
    applySummon(h.get, h.set, c, { ref: 'sanguinaire-de-khorne', count: 1, allyOfCaster: false }, { rounds: 3, label: 'Déchirer l’Aethyr' });
    const s = h.state().battle.combatants.find((x: Combatant) => x.summon);
    expect(s.kind).toBe('enemy'); // hostile à un lanceur héros
  });

  // Unicité RAW (LDB 46/40) : l'invocation porte l'IDENTITÉ du sort source (`summon.spellId`) → l'IA sait
  // qu'une invocation de CE sort est déjà vivante et ne la relance pas. Le death-spawn/trait ne passe PAS
  // de `spellId` (pas un sort) → reste `undefined`.
  it('opts.spellId → marque summon.spellId (Unicité) ; sans → undefined', () => {
    const c1 = caster();
    const h1 = harness(c1, battle([c1]));
    applySummon(h1.get, h1.set, c1, { ref: 'loup', count: 1, allyOfCaster: true }, { rounds: 2, label: 'Hurlement du loup', spellId: 'hurlement-du-loup' });
    const withId = h1.state().battle.combatants.find((x: Combatant) => x.summon);
    expect(withId.summon.spellId).toBe('hurlement-du-loup');

    const c2 = caster();
    const h2 = harness(c2, battle([c2]));
    applySummon(h2.get, h2.set, c2, { ref: 'loup', count: 1, allyOfCaster: true }, { rounds: 2, label: 'Hurlement du loup' });
    const noId = h2.state().battle.combatants.find((x: Combatant) => x.summon);
    expect(noId.summon.spellId).toBeUndefined();
  });

  it('lanceur posé sur un chemin de ronde (z1) → invoque SUR z1, pas au sol (#802)', () => {
    const c = caster({ pos: { x: 5, y: 5, z: 1 } });
    const h = harness(c, battle([c]), sceneWithRampart());
    applySummon(h.get, h.set, c, { ref: 'loup', count: 1, allyOfCaster: true }, { rounds: 2, label: 'Hurlement du loup' });
    const s = h.state().battle.combatants.find((x: Combatant) => x.summon);
    expect(s.pos.z).toBe(1);
  });
});

describe('purgeExpiredSummons', () => {
  it('dissipe à l’expiration de durée (round ≥ expiresAtRound)', () => {
    const c = caster();
    const h = harness(c, battle([c], 1));
    applySummon(h.get, h.set, c, { ref: 'loup', count: 1, allyOfCaster: true }, { rounds: 2, label: 'Hurlement du loup' }); // expiresAtRound = 1 + 2 = 3
    const b = h.state().battle;
    expect(purgeExpiredSummons(b, 2)).toHaveLength(0); // pas encore
    const gone = purgeExpiredSummons(b, 3); // round 3 ≥ 3 → dissipe
    expect(gone).toHaveLength(1);
    expect(b.combatants.some((x: Combatant) => x.summon)).toBe(false);
    expect(b.order.length).toBe(1); // retiré de l'ordre
  });

  it('minion lié : s’effondre si le lanceur tombe (despawnIfSummonerDown)', () => {
    const c = caster();
    const h = harness(c, battle([c], 1));
    applySummon(h.get, h.set, c, { ref: 'squelette', count: 2, allyOfCaster: true, despawnIfCasterDown: true }, { rounds: null, label: 'Relever les morts' });
    const b = h.state().battle;
    expect(purgeExpiredSummons(b, 5)).toHaveLength(0); // lanceur debout, pas d'expiration de durée
    c.conditions = [{ id: 'inconscient', value: 1 }]; // le sorcier tombe
    expect(purgeExpiredSummons(b, 5)).toHaveLength(2); // les 2 squelettes s'effondrent
    expect(b.combatants.filter((x: Combatant) => x.summon)).toHaveLength(0);
  });
});

/** PAYLOAD STRICT de l'op (#1882) — la créature invoquée se nomme par un id du bestiaire, tenu AU PARSE :
 *  une op `summon` sans créature n'atteint jamais le spawn. */
describe('summon — la créature est un id du bestiaire, tenu au parse (#1882)', () => {
  it('accepte un id de `creatures.json`, refuse la créature vide ou inconnue en la NOMMANT', () => {
    const ok = gameOpSchema.safeParse({ op: 'summon', ref: 'squelette', count: 1, countPerSL: { every: 1, amount: 1 }, allyOfCaster: true });
    expect(ok.success, JSON.stringify(ok.error?.issues)).toBe(true);
    for (const ref of ['', 'goule-imaginaire']) {
      const ko = gameOpSchema.safeParse({ op: 'summon', ref, count: 1 });
      expect(ko.success, ref).toBe(false);
      expect(JSON.stringify(ko.error?.issues)).toContain(`« ${ref} »`);
    }
  });

  it('l’op ne figure plus à l’inventaire des payloads non décrits', () => {
    expect(OPS_NON_TYPEES).not.toContain('summon');
  });
});

// #2097
import { idsDeTest } from '../engine/idsDeTest.testkit';
import { describe, it, beforeEach, expect } from 'vitest';
import * as donnees from '../data';
import { species } from '../data';
import { HEROS_DE_SCENARIO, herosDeScenario, type RoleDeScenario } from '../scenes/test-scenarios/_heros';
import { applyOps, type GameOp } from '../engine/ops';
import { makeRNG, type RNG } from '../engine/dice';
import { createHero } from '../engine/character';
import type { Combatant } from '../engine/types';
import { testScenarios } from '../scenes/test-scenarios';
import { allBuiltinCampaigns, campagneDuJeu, lancerCampagne, paquetDuJeu } from '../scenes/campaign';
import { applyEffects, EFFECT_HANDLERS } from './combatEffects';
import { combatHooksOf } from './combatHooks';
import { memoByRef } from './monde/sceneMemo';
import { emptyScene, type Scene } from './monde/scene';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { etatInitialDuJeu } from './etat';
import { scenesDuRegistre } from './monde/registreDesScenes';
import { atteignables, partagesDeLEtat } from '../scenes/partage.testkit';
import { gelerProfond } from '../lib/gelerProfond';
import type { NarratifBlock } from '../data/schemas/defs-scenes/narratif';
import { desDuTest, desEnSuite } from '../engine/dice.testkit';

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });

const geler = memoByRef((s: Scene) => s);
const VIERGE = JSON.stringify(etatInitialDuJeu());
/** L'entité source des ops : une DONNÉE gelée, comme celle qu'un effet du catalogue porte. */
const SOURCE = { kind: 'sort', id: 'partage' } as const;
gelerProfond(SOURCE);

/** Une écriture EN PLACE dans une donnée gelée : la faute que la copie à la couture prévient. */
const ecritDansLaDonnee = (e: unknown): boolean =>
  e instanceof TypeError && /read only|read-only|not extensible|Cannot (assign|add|delete|define)/i.test(e.message);

/** Les chemins de `c` vers une donnée (gelée, catalogue, ou l'une des `sources`). */
const partagesDe = (c: unknown, sources: readonly unknown[] = []) => partagesDeLEtat({ c }, sources);

/** Un dé constant : chaque tirage rend `v`, borné à l'intervalle demandé. */
const deConstant = (v: number): RNG => desEnSuite([v], { boucle: true, borne: true });

const enJeu = (c: Combatant): Combatant => ({ ...c, pos: { x: 1, y: 1 } });

describe('coutures donnée → état (#2097)', () => {
  it('A — un effet `giveTrapping` d’une scène gelée : l’objet reçu n’atteint pas la scène', () => {
    const eff = { type: 'giveTrapping', trappingId: 'dague', teinte: { id: 'aethyrique' } };
    const scene = { ...emptyScene('partage-a', 4, 4), triggers: [{ id: 't', when: { kind: 'enter' }, flow: { kind: 'effet', effet: eff } }] } as unknown as Scene;
    geler(scene);
    const gele = (scene as unknown as { triggers: { flow: { effet: typeof eff } }[] }).triggers[0].flow.effet;
    expect(Object.isFrozen(gele.teinte)).toBe(true);
    banc.setState({ party: [herosDeScenario(idsDeTest, 'soldat')], scene });
    applyEffects(banc.getState, banc.setState, [gele as never]);
    expect(banc.getState().party[0].items!.some((i) => i.trappingId === 'dague' && i.teinte === 'aethyrique')).toBe(true);
    expect(partagesDe(banc.getState().party, [scene])).toEqual([]);
  });

  it('B — chaque op du catalogue, dé par dé pour `rollTable` et `rollThreshold`, n’attache rien du catalogue', () => {
    const vues = new Set<string>();
    const ops: GameOp[] = [];
    for (const [o] of atteignables(Object.values(donnees), 'données')) {
      if (Array.isArray(o) || typeof (o as { op?: unknown }).op !== 'string') continue;
      const cle = JSON.stringify(o);
      if (vues.has(cle)) continue;
      vues.add(cle);
      ops.push(o as GameOp);
    }
    const base = enJeu(herosDeScenario(idsDeTest, 'sorcier'));
    const fautes = new Map<string, string[]>();
    let appliquees = 0;
    for (const op of ops) {
      const des = op.op === 'rollTable' || op.op === 'rollThreshold' ? Array.from({ length: 100 }, (_, i) => i + 1) : [0];
      for (const v of des) {
        const c = structuredClone(base);
        try {
          applyOps(c, [op], { idNeuf: idsDeTest, rng: v ? deConstant(v) : makeRNG(7), source: SOURCE, defaultDurationRounds: 3 });
        } catch (e) {
          if (ecritDansLaDonnee(e)) fautes.set(`${op.op}${v ? ` (dé ${v})` : ''} : ${JSON.stringify(op).slice(0, 80)}`, [(e as Error).message]);
          continue;
        }
        appliquees++;
        const p = partagesDe(c);
        if (p.length) fautes.set(`${op.op}${v ? ` (dé ${v})` : ''} : ${JSON.stringify(op).slice(0, 80)}`, p.slice(0, 3));
      }
    }
    expect(ops.length).toBeGreaterThan(1000);
    expect(appliquees).toBeGreaterThan(ops.length);
    expect([...fautes].slice(0, 10)).toEqual([]);
  });

  it('C — un héros créé (chaque espèce) et chaque pré-tiré n’atteignent pas le catalogue', () => {
    const fautes: string[] = [];
    let crees = 0;
    for (const sp of species) {
      let h: Combatant;
      try {
        h = createHero({ idNeuf: idsDeTest, speciesId: sp.id, careerId: 'soldat', label: 'X', seed: 1 });
      } catch {
        continue;
      }
      crees++;
      fautes.push(...partagesDe(h).map((p) => `${sp.id} : ${p}`));
    }
    for (const id of Object.keys(HEROS_DE_SCENARIO) as RoleDeScenario[]) fautes.push(...partagesDe(herosDeScenario(idsDeTest, id)).map((p) => `${id} : ${p}`));
    expect(crees).toBeGreaterThan(0);
    expect(fautes).toEqual([]);
  });

  it('D — une zone d’une scène gelée (`onCross` → `applyOps`) : le combattant n’atteint pas la scène', () => {
    const onCross = [
      { op: 'grantWeapon', label: 'Lame de zone', damage: 3, teinte: { id: 'aethyrique' } },
      { op: 'perRound', ops: [{ op: 'wounds', amount: 1, ignoreTB: true, ignoreAP: true }] },
    ];
    const scene = { ...emptyScene('partage-d', 4, 4), effectZones: [{ id: 'z', tiles: [{ x: 1, y: 1 }], onCross }] } as unknown as Scene;
    geler(scene);
    const gelees = (scene as unknown as { effectZones: { onCross: GameOp[] }[] }).effectZones[0].onCross;
    expect(Object.isFrozen(gelees)).toBe(true);
    const c = enJeu(herosDeScenario(idsDeTest, 'soldat'));
    for (const op of gelees) applyOps(c, [op], { idNeuf: idsDeTest, rng: desDuTest, source: SOURCE, defaultDurationRounds: 3 });
    expect(c.items!.some((i) => i.label === 'Lame de zone')).toBe(true);
    expect(partagesDe(c, [scene])).toEqual([]);
  });

  it('aura — `recompute-auras` : la cible ne reçoit pas les ops du catalogue par référence', () => {
    const src = enJeu(herosDeScenario(idsDeTest, 'soldat'));
    src.id = 'src';
    src.kind = 'ennemi';
    src.traits = [{ id: 'perturbant' }];
    const cible = herosDeScenario(idsDeTest, 'sorcier');
    cible.id = 'cible';
    cible.pos = { x: 2, y: 1 };
    const battle = { combatants: [src, cible], order: ['src', 'cible'], turn: 0, round: 1, log: [], over: null };
    banc.setState({ scene: emptyScene('scene-test', 6, 6), battle } as never);
    combatHooksOf('onRoundEnd').find((h) => h.id === 'recompute-auras')!.run({ get: banc.getState, set: banc.setState, battle } as never);
    expect(cible.auraMods?.length).toBeGreaterThan(0);
    expect(partagesDe(cible)).toEqual([]);
  });

  // Un test par lot : le corpus entier dépasse le délai d'un test (`DELAI_DE_TEST_MS`) sous la charge d'un worker
  // partagé (#3412). Les comptes s'accumulent sur les lots, et le dernier test les juge.
  const lots: { nom: string; scenes: Scene[]; narratif: NarratifBlock | null }[] = [
    ...testScenarios.map((s) => {
      const b = s.construire(idsDeTest);
      return { nom: `scénario ${s.id}`, scenes: [b.scene, ...(b.extraScenes ?? [])], narratif: b.narratif ?? null };
    }),
    ...allBuiltinCampaigns.map((c) => {
      const p = paquetDuJeu(c);
      return { nom: `campagne ${c.id}`, scenes: p.scenes, narratif: p.narratif ?? null };
    }),
  ];
  const heros = herosDeScenario(idsDeTest, 'soldat');
  let effets = 0;
  let ops = 0;

  it.each(lots.map((l) => [l.nom, l] as const))('A, D — %s : chaque effet et chaque op de ses scènes, appliqués après `memoByRef` : rien de la scène ni du narratif', (_nom, lot) => {
    const fautes: string[] = [];
    for (const original of lot.scenes) {
      const scene = structuredClone(original);
      geler(scene);
      const sources = [scene, lot.narratif];
      for (const [o, chemin] of atteignables(scene, scene.id)) {
        if (Array.isArray(o)) continue;
        const x = o as { type?: unknown; op?: unknown };
        if (typeof x.type === 'string' && x.type in EFFECT_HANDLERS) {
          banc.setState({ ...JSON.parse(VIERGE), party: [structuredClone(heros)], scene, campaignNarratif: lot.narratif });
          try {
            applyEffects(banc.getState, banc.setState, [o as never]);
          } catch (e) {
            if (ecritDansLaDonnee(e)) fautes.push(`${lot.nom} / ${chemin} (${x.type}) : ${(e as Error).message}`);
            continue;
          }
          effets++;
          fautes.push(...partagesDeLEtat(banc.getState(), sources).map((p) => `${lot.nom} / ${chemin} (${x.type}) : ${p}`));
        } else if (typeof x.op === 'string') {
          const c = enJeu(structuredClone(heros));
          try {
            applyOps(c, [o as GameOp], { idNeuf: idsDeTest, rng: makeRNG(7), source: SOURCE, defaultDurationRounds: 3 });
          } catch (e) {
            if (ecritDansLaDonnee(e)) fautes.push(`${lot.nom} / ${chemin} (${x.op}) : ${(e as Error).message}`);
            continue;
          }
          ops++;
          fautes.push(...partagesDe(c, sources).map((p) => `${lot.nom} / ${chemin} (${x.op}) : ${p}`));
        }
      }
    }
    expect(fautes.slice(0, 10)).toEqual([]);
  });

  it('A, D — le corpus a appliqué au moins un effet et une op : la couture ne se juge pas sur le vide', () => {
    expect(effets).toBeGreaterThan(0);
    expect(ops).toBeGreaterThan(0);
  });

  it.each(allBuiltinCampaigns.map((c) => [c.id, c] as const))('campagne %s lancée par `lancerCampagne` : rien de partagé, ouverture comprise', (_id, c) => {
    banc.setState({ party: [herosDeScenario(idsDeTest, 'soldat')] });
    expect(lancerCampagne(banc.getState, campagneDuJeu(c))).toBeNull();
    expect(partagesDeLEtat(banc.getState(), scenesDuRegistre())).toEqual([]);
  });
});

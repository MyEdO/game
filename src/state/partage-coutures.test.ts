// #2097
import { describe, it, expect } from 'vitest';
import * as donnees from '../data';
import { species } from '../data';
import { pregen, PREGEN } from '../data/pregens';
import { applyOps, type GameOp } from '../engine/ops';
import { makeRNG, type RNG } from '../engine/dice';
import { createHero } from '../engine/character';
import type { Combatant } from '../engine/types';
import { testScenarios } from '../scenes/test-scenarios';
import { allBuiltinCampaigns, campagneDuJeu, lancerCampagne, paquetDuJeu } from '../scenes/campaign';
import { applyEffects, EFFECT_HANDLERS } from './combatEffects';
import { combatHooksOf } from './combatHooks';
import './combat/roundHooks';
import { memoByRef } from './sceneMemo';
import { emptyScene, type Scene } from './scene';
import { useGame, scenesDuRegistre } from './store';
import { atteignables, partagesDeLEtat } from './partage.testkit';
import { gelerProfond } from '../lib/gelerProfond';
import type { NarratifBlock } from './campaignNarratif';

const geler = memoByRef((s: Scene) => s);
const VIERGE = JSON.stringify(useGame.getInitialState());
/** L'entité source des ops : une DONNÉE gelée, comme celle qu'un effet du catalogue porte. */
const SOURCE = { kind: 'spell', id: 'partage' } as const;
gelerProfond(SOURCE);

/** Une écriture EN PLACE dans une donnée gelée : la faute que la copie à la couture prévient. */
const ecritDansLaDonnee = (e: unknown): boolean =>
  e instanceof TypeError && /read only|read-only|not extensible|Cannot (assign|add|delete|define)/i.test(e.message);

/** Les chemins de `c` vers une donnée (gelée, catalogue, ou l'une des `sources`). */
const partagesDe = (c: unknown, sources: readonly unknown[] = []) => partagesDeLEtat({ c }, sources);

/** Un dé constant : chaque tirage rend `v`, borné à l'intervalle demandé. */
const deConstant = (v: number): RNG => ({ int: (a, b) => Math.min(b, Math.max(a, v)) });

const enJeu = (c: Combatant): Combatant => ({ ...c, pos: { x: 1, y: 1 } });

describe('coutures donnée → état (#2097)', () => {
  it('A — un effet `giveTrapping` d’une scène gelée : l’objet reçu n’atteint pas la scène', () => {
    const eff = { type: 'giveTrapping', trappingId: 'dague', skin: { metal: '#7faaff' } };
    const scene = { ...emptyScene(4, 4), id: 'partage-a', triggers: [{ id: 't', when: { kind: 'enter' }, flow: { kind: 'do', effect: eff } }] } as unknown as Scene;
    geler(scene);
    const gele = (scene as unknown as { triggers: { flow: { effect: typeof eff } }[] }).triggers[0].flow.effect;
    expect(Object.isFrozen(gele.skin)).toBe(true);
    useGame.setState({ party: [pregen(PREGEN.soldat)], scene });
    applyEffects(useGame.getState, useGame.setState, [gele as never]);
    expect(useGame.getState().party[0].items!.some((i) => i.trappingId === 'dague' && i.skin?.metal === '#7faaff')).toBe(true);
    expect(partagesDe(useGame.getState().party, [scene])).toEqual([]);
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
    const base = enJeu(pregen(PREGEN.sorcier));
    const fautes = new Map<string, string[]>();
    let appliquees = 0;
    for (const op of ops) {
      const des = op.op === 'rollTable' || op.op === 'rollThreshold' ? Array.from({ length: 100 }, (_, i) => i + 1) : [0];
      for (const v of des) {
        const c = structuredClone(base);
        try {
          applyOps(c, [op], { rng: v ? deConstant(v) : makeRNG(7), source: SOURCE, defaultDurationRounds: 3 });
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
        h = createHero({ speciesId: sp.id, careerId: 'soldat', label: 'X', seed: 1 });
      } catch {
        continue;
      }
      crees++;
      fautes.push(...partagesDe(h).map((p) => `${sp.id} : ${p}`));
    }
    for (const id of Object.values(PREGEN)) fautes.push(...partagesDe(pregen(id)).map((p) => `${id} : ${p}`));
    expect(crees).toBeGreaterThan(0);
    expect(fautes).toEqual([]);
  });

  it('D — une zone d’une scène gelée (`onCross` → `applyOps`) : le combattant n’atteint pas la scène', () => {
    const onCross = [
      { op: 'grantWeapon', label: 'Lame de zone', damage: 3, skin: { metal: '#ff0000' } },
      { op: 'perRound', ops: [{ op: 'wounds', amount: 1, ignoreTB: true, ignoreAP: true }] },
    ];
    const scene = { ...emptyScene(4, 4), id: 'partage-d', effectZones: [{ id: 'z', tiles: [{ x: 1, y: 1 }], onCross }] } as unknown as Scene;
    geler(scene);
    const gelees = (scene as unknown as { effectZones: { onCross: GameOp[] }[] }).effectZones[0].onCross;
    expect(Object.isFrozen(gelees)).toBe(true);
    const c = enJeu(pregen(PREGEN.soldat));
    for (const op of gelees) applyOps(c, [op], { source: SOURCE, defaultDurationRounds: 3 });
    expect(c.items!.some((i) => i.label === 'Lame de zone')).toBe(true);
    expect(partagesDe(c, [scene])).toEqual([]);
  });

  it('aura — `recompute-auras` : la cible ne reçoit pas les ops du catalogue par référence', () => {
    const src = enJeu(pregen(PREGEN.soldat));
    src.id = 'src';
    src.kind = 'enemy';
    src.traits = [{ id: 'perturbant' }];
    const cible = pregen(PREGEN.sorcier);
    cible.id = 'cible';
    cible.pos = { x: 2, y: 1 };
    const battle = { combatants: [src, cible], order: ['src', 'cible'], turn: 0, round: 1, log: [], over: null };
    useGame.setState({ scene: emptyScene(6, 6), battle } as never);
    combatHooksOf('onRoundEnd').find((h) => h.id === 'recompute-auras')!.run({ get: useGame.getState, set: useGame.setState, battle } as never);
    expect(cible.auraMods?.length).toBeGreaterThan(0);
    expect(partagesDe(cible)).toEqual([]);
  });

  it('A, D — chaque effet et chaque op des scènes du corpus, appliqués après `memoByRef` : rien de la scène ni du narratif', () => {
    const lots: { nom: string; scenes: Scene[]; narratif: NarratifBlock | null }[] = [
      ...testScenarios.map((s) => {
        const b = s.construire();
        return { nom: `scénario ${s.id}`, scenes: [b.scene, ...(b.extraScenes ?? [])], narratif: b.narratif ?? null };
      }),
      ...allBuiltinCampaigns.map((c) => {
        const p = paquetDuJeu(c);
        return { nom: `campagne ${c.id}`, scenes: p.scenes, narratif: p.narratif ?? null };
      }),
    ];
    const heros = pregen(PREGEN.soldat);
    const fautes: string[] = [];
    let effets = 0;
    let ops = 0;
    for (const lot of lots) {
      for (const original of lot.scenes) {
        const scene = structuredClone(original);
        geler(scene);
        const sources = [scene, lot.narratif];
        for (const [o, chemin] of atteignables(scene, scene.id)) {
          if (Array.isArray(o)) continue;
          const x = o as { type?: unknown; op?: unknown };
          if (typeof x.type === 'string' && x.type in EFFECT_HANDLERS) {
            useGame.setState({ ...JSON.parse(VIERGE), party: [structuredClone(heros)], scene, campaignNarratif: lot.narratif });
            try {
              applyEffects(useGame.getState, useGame.setState, [o as never]);
            } catch (e) {
              if (ecritDansLaDonnee(e)) fautes.push(`${lot.nom} / ${chemin} (${x.type}) : ${(e as Error).message}`);
              continue;
            }
            effets++;
            fautes.push(...partagesDeLEtat(useGame.getState(), sources).map((p) => `${lot.nom} / ${chemin} (${x.type}) : ${p}`));
          } else if (typeof x.op === 'string') {
            const c = enJeu(structuredClone(heros));
            try {
              applyOps(c, [o as GameOp], { rng: makeRNG(7), source: SOURCE, defaultDurationRounds: 3 });
            } catch (e) {
              if (ecritDansLaDonnee(e)) fautes.push(`${lot.nom} / ${chemin} (${x.op}) : ${(e as Error).message}`);
              continue;
            }
            ops++;
            fautes.push(...partagesDe(c, sources).map((p) => `${lot.nom} / ${chemin} (${x.op}) : ${p}`));
          }
        }
      }
    }
    useGame.setState(JSON.parse(VIERGE));
    expect(effets).toBeGreaterThan(0);
    expect(ops).toBeGreaterThan(0);
    expect(fautes.slice(0, 10)).toEqual([]);
  });

  it.each(allBuiltinCampaigns.map((c) => [c.id, c] as const))('campagne %s lancée par `lancerCampagne` : rien de partagé, ouverture comprise', (_id, c) => {
    useGame.setState({ party: [pregen(PREGEN.soldat)] });
    expect(lancerCampagne(useGame.getState, campagneDuJeu(c))).toBeNull();
    expect(partagesDeLEtat(useGame.getState(), scenesDuRegistre())).toEqual([]);
  });
});

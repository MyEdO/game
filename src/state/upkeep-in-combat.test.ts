import { fixtureText } from '../i18n/fixtureText';
import { describe, it, expect, beforeEach } from 'vitest';
import { useGame } from './store';
import { cascadeAppliers } from './cascade';
import { checkBattleOver } from './combatFlow';
import { createHero } from '../engine/character';
import { makeRNG } from '../engine/dice';
import type { Combatant } from '../engine/types';
import type { CascadeStep } from './pendings';
import { monoStep } from './rollSeam';
import { nightStakeRef } from '../data';

/**
 * #253 — DEUX chemins d'entretien qui NE roulaient plus en silence.
 *  1. Dessoûlage (LDB 09 l.485) : le 2ᵉ Test (gueule de bois) est sa PROPRE étape influençable INSÉRÉE, plus
 *     aucun `rollTest` inline dans l'applier — le joueur influence les DEUX jets.
 *  2. Combat franchissant minuit : les Tests d'entretien du jour se METTENT EN FILE (`deferredUpkeepQueue`)
 *     et sont CONSOMMÉS par `openCombatEndCascade` — jamais un jet silencieux (advanceTime par Round).
 */
const get = useGame.getState;
const set = useGame.setState;

describe('#253.1 — dessoûlage : le 2ᵉ Test (gueule de bois) est une étape INFLUENÇABLE insérée', () => {
  it('l\'applier `dessoulage` DISSIPE (1er DR) et INSÈRE une étape `dessoulageHangover` (2ᵉ jet), sans rouler l\'Exténué', () => {
    const hero = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', rng: makeRNG(1) });
    hero.drunk = { failedTests: 3, drunk: true, result: 'joyeux' };
    useGame.setState({ party: [hero], gameTime: 8 * 60 });
    // BANDE de Dessoûlage (#1117 L3) : la conséquence se joue PAR RANGÉE.
    const step: CascadeStep = { id: 'bande-dessoulage', kind: 'dessoulage', label: fixtureText('Dessoûlage'), aggregate: 'none',
      participants: [{ id: hero.id, interactive: true, label: 'Résistance', base: 40, target: 40, result: { roll: 45, target: 40, sl: 1, success: true } }] };

    const out = cascadeAppliers['dessoulage'].apply(get, set, step, hero, { steps: [step], index: 0 });

    expect(hero.drunk).toBeUndefined();                          // dissipation appliquée (1er Test)
    expect(out?.insert?.[0]?.kind).toBe('dessoulageHangover');   // 2ᵉ Test devenu BANDE influençable
    expect(out?.insert?.[0]?.participants?.[0]?.result ?? null).toBeNull(); // pas encore lancé (le joueur l'influencera)
    expect(hero.conditions?.some((c) => c.id === 'extenue')).toBeFalsy(); // gueule de bois DIFFÉRÉE au 2ᵉ Test

    const hStep = out!.insert![0];
    hStep.participants![0].result = { roll: 10, target: hStep.participants![0].target, sl: 2, success: true };
    cascadeAppliers['dessoulageHangover'].apply(get, set, hStep, hero, { steps: [hStep], index: 0 });
    expect(hero.conditions?.some((c) => c.id === 'extenue')).toBe(true); // posée par le 2ᵉ Test résolu
  });
});

describe('#253.2 — combat franchissant minuit : les Tests d\'entretien se mettent EN FILE, jamais silencieux', () => {
  beforeEach(() => useGame.setState({ battle: null, pendingCascade: null, deferredUpkeepQueue: [], pendingVictory: null }));

  const deadEnemy = (): Combatant =>
    ({ id: 'e', kind: 'enemy', name: 'Bandit', characteristics: { endurance: 30 } as never,
      wounds: { current: 0, max: 10 }, dead: true, conditions: [], skills: [], items: [], weapons: [], movement: 4, advantage: 0 } as unknown as Combatant);

  it('un franchissement de jour PENDANT un combat FILE un Test de dessoûlage (deferredUpkeepQueue), sans le rouler', () => {
    const hero = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', rng: makeRNG(2) });
    hero.drunk = { failedTests: 2, drunk: true, result: 'joyeux' };
    const heroClone = { ...hero, kind: 'hero' as const };
    useGame.setState({
      party: [hero], lastUpkeepDay: 0, lastNightDay: 0, gameTime: 23 * 60 + 59,
      battle: { combatants: [heroClone, deadEnemy()], order: [hero.id, 'e'], turn: 0, round: 1, log: [], over: null } as never,
      deferredUpkeepQueue: [], pendingCascade: null,
    });
    // 2 minutes → franchit minuit (jour 0 → 1) EN COMBAT.
    get().advanceTime(2);
    const q = get().deferredUpkeepQueue;
    // La file porte des BANDES (#1117 L3) : le porteur est une RANGÉE, plus l'`actorId` de l'étape.
    expect(q.some((s) => s.kind === 'dessoulage' && (s.participants ?? []).some((p) => p.id === hero.id))).toBe(true);
    expect(get().party[0].drunk).toBeTruthy(); // PAS dessoûlé en silence — le Test attend la fin de combat
  });

  it('openCombatEndCascade CONSOMME la file : un héros piloté-humain → l\'étape rejoint la cascade de FIN', () => {
    const hero = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', rng: makeRNG(3) });
    const heroClone = { ...hero, kind: 'hero' as const };
    // La file accepte seulement une étape MINTÉE (#1262 V2) ; sa ligne est posée telle quelle.
    const queued = monoStep({ id: 'faim-H-0', kind: 'faim', actor: hero, label: fixtureText('Faim'), rollLabel: 'Résistance',
      difficulty: 'intermediaire', montee: { base: 40, target: 40 }, stake: nightStakeRef('faim') })!;
    useGame.setState({
      party: [hero],
      battle: { combatants: [heroClone, deadEnemy()], order: [hero.id, 'e'], turn: 0, round: 1, log: [], over: null } as never,
      deferredUpkeepQueue: [queued], pendingCascade: null, pendingVictory: null,
    });

    expect(checkBattleOver(get, set)).toBe(true); // victoire remplie (ennemi mort)
    expect(get().deferredUpkeepQueue).toHaveLength(0); // file VIDÉE (consommée)
    const casc = get().pendingCascade;
    expect(casc?.combatEndBoundary).toBe(true);
    expect(casc?.participants.some((s) => s.kind === 'faim')).toBe(true); // l'étape filée a rejoint la cascade de fin
  });
});

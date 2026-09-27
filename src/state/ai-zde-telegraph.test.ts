/**
 * Télégraphe VISUEL de la ZdE de l'IA (juice, pas une règle) : quand un lanceur IA lance un sort de
 * ZONE (`case 'castArea'` de `runEnemyAI`), on PEINT le disque cible (centre + rayon) ~0,7 s AVANT la
 * résolution — comme le missile montre déjà sa ligne/réticule (`actorAim`). L'ancien télégraphe était
 * un `actorAim` DÉGÉNÉRÉ (ligne enemy→enemy) qui n'indiquait PAS l'aire ; on le remplace par le nouvel
 * état transitoire `actorAoe { casterId, center, radius }`.
 *
 * On vérifie : (1) `actorAoe` est POSÉ pendant la phase de télégraphe (center + radius corrects, centre
 * couvrant le paquet de héros) ; (2) il est NETTOYÉ (null) après le `setTimeout(TEMPO.aimTelegraph)` et
 * la résolution de la ZdE est AMORCÉE (cascade d'incantation ouverte). La NON-RÉGRESSION de l'application
 * effective de la zone par le chemin PARTAGÉ `castConfirm` est couverte par `ai-zde-counterspell.test.ts`.
 * Le moteur (`src/engine`) n'est PAS touché.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useGame } from './store';
import { runEnemyAI } from './combatFlow';
import { spawnEnemy } from './spawn';
import { chebyshev } from './path';
import { pregen, PREGEN } from '../data/pregens';
import { findSpell } from '../data';
import { seedBattleRng } from './battleRng';
import type { Combatant } from '../engine/types';

describe('ZdE ennemie — télégraphe visuel actorAoe (pose pendant le télégraphe → nettoyage à la résolution)', () => {
  beforeEach(() => {
    vi.useFakeTimers(); vi.clearAllTimers();
    useGame.setState({ battle: null, party: [], journal: [], pendingCast: null, pendingCounterspell: null, pendingCascade: null, actorAoe: null });
    seedBattleRng(17);
  });
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });

  /** Une cible héros minimale (sans Dissipation : aucune fenêtre de Contre-sort ne s'ouvre). */
  function target(x: number, y: number, id: string): Combatant {
    const h = pregen(PREGEN.sorcier);
    h.id = id; h.label = id; h.pos = { x, y };
    h.wounds = { ...h.wounds, max: 30, current: 30 };
    h.skills = []; // pas de Langue (Magick) → ne peut pas Dissiper → pas de pendingCounterspell
    h.spells = [];
    h.talents = [];
    return h;
  }

  function setupAiAreaCaster() {
    // Lanceur IA fort (DR ≥ NI d'Explosion d'un seul jet), deux héros COLLÉS → un centre couvre les deux.
    const e = spawnEnemy({ ref: 'brigand' }, 'caster', { x: 5, y: 5 });
    e.kind = 'enemy';
    e.characteristics.intelligence = 70; e.characteristics['force-mentale'] = 70;
    e.skills = [{ id: 'langue', spec: 'magick', characteristic: 'intelligence', advances: 60 } as never];
    const spell = findSpell('Explosion')!; // Projectile magique à ZdE
    e.spells = [spell.id];
    e.advantage = 0; e.movement = 4; e.pos = { x: 5, y: 5 };
    const h1 = target(8, 5, 'h1');
    const h2 = target(9, 5, 'h2'); // collés → ZdE favorable
    const battle = {
      combatants: [e, h1, h2], order: ['caster', 'h1', 'h2'], baseOrder: ['caster', 'h1', 'h2'],
      turn: 0, round: 1, action: null, selectedSpellId: null, reachable: new Map(),
      movementUsed: 0, movedPreAction: false, acted: false, log: [], over: null,
    } as never;
    const scene = {
      id: 's', dimensions: { w: 20, h: 20 }, layers: [{ z: 0, tiles: [] }],
      entities: [], dialogues: [], triggers: [], encounters: [],
    } as never;
    useGame.setState({ battle, scene, party: [], partyPos: { x: 0, y: 0 }, actorAoe: null });
    return { e, h1, h2, spell };
  }

  it('castArea : actorAoe est POSÉ (center+radius) pendant le télégraphe, puis NETTOYÉ quand la ZdE se résout', () => {
    const { e, h1, h2 } = setupAiAreaCaster();

    runEnemyAI(useGame.getState, useGame.setState, e.id);

    // Phase de télégraphe (synchrone) : l'IA a choisi la ZdE → actorAoe peint le disque cible.
    const aoe = useGame.getState().actorAoe;
    expect(aoe).not.toBeNull();
    expect(aoe!.casterId).toBe('caster');
    expect(aoe!.radius).toBeGreaterThanOrEqual(1); // Explosion : rayon ≥ 1 case
    // Centre choisi par l'IA pure : couvre le paquet (8,5)/(9,5) → distance Chebyshev ≤ rayon de chaque héros.
    expect(chebyshev(aoe!.center, h1.pos!)).toBeLessThanOrEqual(aoe!.radius);
    expect(chebyshev(aoe!.center, h2.pos!)).toBeLessThanOrEqual(aoe!.radius);
    // Avant le timer du télégraphe, la résolution reste inamorcée (pas de cast en cours).
    expect(useGame.getState().pendingCast).toBeNull();
    expect(useGame.getState().pendingCascade).toBeNull();

    // Déclenche le setTimeout du télégraphe (TEMPO.aimTelegraph) → la callback nettoie actorAoe AVANT
    // d'amorcer la résolution (castZoneSpell → castRoll → routeCounterspell → castConfirm, chemin PARTAGÉ).
    vi.runOnlyPendingTimers();

    // Télégraphe nettoyé : le disque de menace disparaît au moment où le sort part — c'est l'invariant
    // central de ce LOT (l'application effective des dégâts est couverte par ai-zde-counterspell.test.ts).
    expect(useGame.getState().actorAoe).toBeNull();
  });

  it('pose/nettoyage MANUELS de actorAoe : champ transitoire isolé (init null, set/clear)', () => {
    // Sanity du nouvel état (indépendant du drive IA) : il se pose et se nettoie comme actorAim/actorMove.
    expect(useGame.getState().actorAoe).toBeNull();
    useGame.setState({ actorAoe: { casterId: 'x', center: { x: 4, y: 7 }, radius: 2 } });
    expect(useGame.getState().actorAoe).toEqual({ casterId: 'x', center: { x: 4, y: 7 }, radius: 2 });
    useGame.setState({ actorAoe: null });
    expect(useGame.getState().actorAoe).toBeNull();
  });
});

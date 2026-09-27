import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useGame } from './store';
import { applySurprise, checkBattleOver } from './combatFlow';
import { seedBattleRng } from './battleRng';
import { pickActiveModalKey } from './modalArbiter';
import { createHero } from '../engine/character';
import type { Combatant } from '../engine/types';

/**
 * F3 (recette 2026-07-11, #345) — VERROU de l'ordonnancement, éprouvé PAR LE VRAI CHEMIN : `checkBattleOver`
 * DIFFÈRE la Victoire tant qu'UNE cascade est ouverte, pas seulement une cascade `combatEndBoundary`. Une
 * cascade de SETUP (Surprise, purpose 'combat', ouverte au DÉBUT du combat) encore pendante quand la mort du
 * dernier ennemi remplit la condition de victoire ne doit PAS voir l'écran de Victoire (HORS_MODAL) s'empiler
 * par-dessus sa modale (clic intercepté) — doctrine suspension/reprise (cascade.ts). La cascade de Surprise
 * est construite ICI par `applySurprise` (VRAI `triggeredBatchTest` influençable, héros manuel) et RÉSOLUE par les
 * actions du store (`cascadeResolveAll`/`cascadeFinish`) : la continuation vers la victoire différée n'est
 * PROVOQUÉE par aucun `set()` manuel d'état interne ni `checkBattleOver` rappelé à la main — elle vient de
 * `dispatchCascadeDone` (combatSlice), qui re-vérifie `checkBattleOver` à la clôture d'une cascade 'combat'.
 */
const get = useGame.getState;
const set = useGame.setState;

/** Ennemi GÉNÉRIQUE (ne suit PAS les règles de Personnage) : sa mort n'ouvre AUCUNE cascade de fin de
 *  combat — on isole ainsi la SEULE cascade de Surprise. Vivant (embusqueur) au moment d'`applySurprise`. */
const ambusher = (over: Partial<Combatant> = {}): Combatant =>
  ({ id: 'e', kind: 'enemy', name: 'Bandit',
    characteristics: { agilite: 40, perception: 30, endurance: 30, initiative: 30 } as never,
    wounds: { current: 10, max: 10 }, dead: false, conditions: [], skills: [], items: [], weapons: [],
    movement: 4, advantage: 0, traits: [], ...over } as unknown as Combatant);

/** Marque tous les ennemis debout comme MORTS (état d'ENTITÉ, dégâts encaissés — PAS l'état interne d'une
 *  cascade) : simule le dernier coup létal APRÈS l'établissement de la Surprise. */
const slayEnemies = () =>
  set({ battle: { ...get().battle!, combatants: get().battle!.combatants.map((c) => (c.kind === 'enemy' && !c.dead ? { ...c, dead: true, wounds: { ...c.wounds, current: 0 } } : c)) } });

describe('F3 — Surprise (cascade de setup) vs Victoire : ordonnancement de checkBattleOver', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.clearAllTimers(); useGame.setState({ scene: null, party: [], battle: null, pendingVictory: null, pendingCascade: null }); });
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });

  it('mort du dernier ennemi avec une Surprise PENDANTE → Victoire DIFFÉRÉE (cascade seule à l\'écran)', () => {
    seedBattleRng(7);
    const hero = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', seed: 1 });
    const heroClone = { ...hero, kind: 'hero' as const };
    useGame.setState({
      party: [hero],
      battle: { combatants: [heroClone, ambusher()], order: [hero.id, 'e'], turn: -1, round: 1, log: [], over: null } as never,
      pendingVictory: null, pendingCascade: null,
    });

    // Surprise de setup RÉELLE : le camp héros est pris en embuscade (Test de Perception influençable, cascade).
    applySurprise(get, set, 'party');
    expect(get().pendingCascade?.purpose).toBe('combat');
    expect(get().pendingCascade!.participants[0].kind).toBe('triggeredBatchTest'); // VRAI kind (la BANDE de guetteurs, pas un 'surpriseTest' inventé)

    // Le dernier ennemi meurt pendant que la Surprise est pendante ; le jeu appelle `checkBattleOver`.
    slayEnemies();
    const ended = checkBattleOver(get, set);

    // FIX #345 : la Victoire est DIFFÉRÉE tant que la Surprise (purpose 'combat', non combatEndBoundary) est
    // pendante — pas de `battle.over`, pas de `pendingVictory`. La cascade reste la SEULE surface.
    expect(ended).toBe(true);       // `checkBattleOver` a bien statué (victoire différée), la boucle s'arrête
    expect(get().battle!.over).toBeNull();
    expect(get().pendingVictory).toBeNull();
    expect(get().pendingCascade).toBeTruthy();
    expect(get().pendingCascade!.purpose).toBe('combat');
    expect(get().pendingCascade!.participants[0].kind).toBe('triggeredBatchTest'); // TOUJOURS la Surprise, PAS écrasée

    // L'arbitre n'offre QUE la cascade Surprise (aucun écran de Victoire empilé par-dessus).
    expect(pickActiveModalKey(get())).toBe('cascade');
  });

  it('FIX #345 — Surprise résolue PAR LES ACTIONS → la cascade de FIN de combat s\'ouvre D\'ELLE-MÊME, la victoire suit (dispatchCascadeDone, aucun set manuel)', () => {
    seedBattleRng(11);
    const hero = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', seed: 2 });
    const heroClone = { ...hero, kind: 'hero' as const };
    // Ennemi CORROMPU (Trait `corruption`) → `worstCorruptionExposure` != null → le héros (manuel, piloté-humain)
    // DOIT un Test d'Exposition de fin de combat. Vivant = embusqueur légitime au moment d'`applySurprise`.
    const enemy = ambusher({ traits: [{ id: 'corruption', arg: 'mineure' }] as never });
    useGame.setState({
      party: [hero],
      battle: { combatants: [heroClone, enemy], order: [hero.id, 'e'], turn: -1, round: 1, log: [], over: null } as never,
      pendingVictory: null, pendingCascade: null,
    });

    // 1) Surprise de setup RÉELLE (applySurprise → triggeredBatchTest influençable), PUIS mort du dernier ennemi.
    applySurprise(get, set, 'party');
    expect(get().pendingCascade!.participants[0].kind).toBe('triggeredBatchTest');
    slayEnemies();

    // Mort du dernier ennemi AVEC Surprise pendante → Victoire différée, Surprise INTACTE (pas d'écrasement).
    expect(checkBattleOver(get, set)).toBe(true);
    expect(get().pendingCascade!.participants[0].kind).toBe('triggeredBatchTest'); // TOUJOURS la Surprise, PAS une étape de fin
    expect(get().battle!.over).toBeNull();
    expect(get().pendingVictory).toBeNull();

    // 2) On RÉSOUT la Surprise par les ACTIONS réelles (le VRAI chemin joueur : tout lancer + terminer). AUCUN
    //    `set()` d'état interne, AUCUN `checkBattleOver` rappelé à la main : la continuation vient de
    //    `dispatchCascadeDone`, qui re-vérifie `checkBattleOver` (slot libre) → OUVRE la cascade de fin (#345).
    get().cascadeResolveAll();
    get().cascadeFinish();
    const fin = get().pendingCascade;
    expect(fin).toBeTruthy();
    expect(fin!.combatEndBoundary).toBe(true);
    expect(fin!.participants.some((s) => s.kind === 'combatEndCorruption')).toBe(true);
    expect(get().battle!.over).toBeNull(); // victoire ENCORE différée (derrière la cascade de fin)
    expect(get().pendingVictory).toBeNull();

    // 3) On résout la cascade de FIN par les ACTIONS → la Victoire s'enchaîne (finishCombatEnd → finishVictory).
    get().cascadeResolveAll();
    get().cascadeFinish();
    expect(get().battle!.over).toBe('victory');
    expect(get().pendingVictory).toBeTruthy();
  });
});

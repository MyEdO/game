import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useGame } from './store';
import { seedBattleRng } from './battleRng';
import { createHero } from '../engine/character';
import type { Combatant } from '../engine/types';
import { cascadeDeTest } from './cascadeTestKit';

/**
 * Verrou STRUCTUREL (#345, correction juge ronde 3) : `dispatchCascadeDone` (combatSlice.ts) re-vérifie
 * `checkBattleOver` à la clôture de N'IMPORTE QUELLE cascade, pas seulement `purpose:'combat'`. Aucun
 * purpose non-combat ne coexiste avec un combat AUJOURD'HUI, mais le garde précédent ne routait le
 * re-check QUE dans la branche `purpose==='combat'` — un futur purpose ouvert en combat (ex. un Test
 * d'Avantage `purpose:'test'` déjà tiré pendant un combat ailleurs dans le code, combatSlice.ts:3163)
 * referait le trou d'écrasement/victoire-manquée sans qu'aucun test ne le voie.
 *
 * Ce test construit l'état HYPOTHÉTIQUE (combat actif + cascade `purpose:'test'` pendante + dernier
 * ennemi déjà mort) — inatteignable par le jeu actuel pour CE purpose précis — afin de figer le
 * comportement générique : la clôture de cette cascade doit enchaîner la Victoire, jamais rester
 * silencieuse (ni écraser, ni perdre la fin de combat).
 */
const get = useGame.getState;

const ambusher = (): Combatant =>
  ({ id: 'e', kind: 'enemy', name: 'Bandit',
    characteristics: { agilite: 40, perception: 30, endurance: 30, initiative: 30 } as never,
    wounds: { current: 0, max: 10 }, dead: true, conditions: [], skills: [], items: [], weapons: [],
    movement: 4, advantage: 0, traits: [] } as unknown as Combatant);

describe('dispatchCascadeDone — re-check TOUT-PURPOSE de checkBattleOver (#345, fix structurel)', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.clearAllTimers(); useGame.setState({ scene: null, party: [], battle: null, pendingVictory: null, pendingCascade: null }); });
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });

  it('cascade purpose "test" (hypothétique) close en combat, dernier ennemi déjà mort → la Victoire s\'enchaîne (pas d\'écrasement, pas de silence)', () => {
    seedBattleRng(3);
    const hero = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', seed: 1 });
    const heroClone = { ...hero, kind: 'hero' as const };
    useGame.setState({
      party: [hero],
      battle: { combatants: [heroClone, ambusher()], order: [hero.id, 'e'], turn: 0, round: 1, log: [], over: null } as never,
      pendingVictory: null,
      // Cascade `purpose:'test'` HYPOTHÉTIQUE encore pendante en plein combat (aujourd'hui `test` ne
      // coexiste avec `battle` que dans des contextes déjà routés ailleurs — ce n'est PAS le cas générique
      // visé, d'où l'injection directe plutôt qu'un chemin de jeu réel). Étape d'AFFICHAGE (toujours prête).
      pendingCascade: cascadeDeTest(
        [{ id: 'hypo-1', kind: 'hypoDisplayStep', actorId: hero.id, outcome: [{ text: 'note' }] }],
        { title: 'Étape hypothétique' },
      ),
    });

    // Clôture de la cascade PAR LES ACTIONS réelles (pas de `checkBattleOver` rappelé à la main) : le
    // seul step est une « affichage », toujours prêt → `cascadeNext` la ferme d'un coup.
    get().cascadeNext();

    // Le re-check générique doit avoir statué : combat terminé, Victoire enchaînée (le dernier ennemi
    // était déjà mort AVANT l'ouverture de la cascade hypothétique).
    expect(get().pendingCascade).toBeNull(); // pas d'écrasement silencieux : rien ne reste bloqué
    expect(get().battle!.over).toBe('victory');
    expect(get().pendingVictory).toBeTruthy();
  });
});

/**
 * Lot 6 — Ciblage de Zone d'Effet (LDB 47 l.28), côté web : le clic du curseur de combat (`commitCursor`) sur une
 * cible hors de portée. Le reste se joue au banc du noyau (`src/noyau/zde-cast.hors-store.test.ts`).
 */
import { idsDeTest } from '../engine/idsDeTest.testkit';
import { describe, it, expect, beforeEach } from 'vitest';
import { useGame } from './store';
import { herosDeScenario } from '../scenes/test-scenarios/_heros';
import { spawnEnemy } from '../noyau/monde/spawn';
import { currentTargetingMode } from '../noyau/targetingModes';

function wiz() {
  const w = herosDeScenario(idsDeTest, 'sorcier');
  const sk = w.skills.find((s) => s.id === 'langue');
  if (sk) sk.advances = Math.max(sk.advances, 10);
  w.spells = ['explosion', ...(w.spells ?? [])]; // Explosion : Projectile magique ZdE (LDB 47 l.453)
  return w;
}

describe('ZdE en combat — flux « jet PUIS pose » (LDB 47 l.15/28)', () => {
  beforeEach(() => {
    useGame.setState({ battle: null, party: [], journal: [], pendingCast: null, refus: null, combatCursor: null });
    useGame.getState().ensemencerLeTirage(17);
  });

  function setupBattle() {
    const w = wiz();
    w.pos = { x: 2, y: 2 };
    w.characteristics['force-mentale'] = 40; // BFM 4 → ZdE diamètre 4 m → rayon 1 case ; portée (FM) m → 20 cases
    const e1 = spawnEnemy({ ref: 'humain' }, 'e1', { x: 6, y: 6 });
    const e2 = spawnEnemy({ ref: 'humain' }, 'e2', { x: 7, y: 6 });
    const e3 = spawnEnemy({ ref: 'humain' }, 'e3', { x: 12, y: 12 }); // hors zone
    const battle = {
      combatants: [w, e1, e2, e3], order: [w.id, 'e1', 'e2', 'e3'], baseOrder: [w.id, 'e1', 'e2', 'e3'],
      turn: 0, round: 1, action: 'incantation', selectedSpellId: 'explosion', reachable: new Map(),
      movementUsed: 0, movedPreAction: false, acted: false, log: [], over: null,
    } as never;
    const scene = { id: 's', dimensions: { w: 20, h: 20 }, layers: [{ z: 0, tiles: [] }], entities: [], dialogues: [], triggers: [], encounters: [] } as never;
    useGame.setState({ battle, scene, party: [] });
    return { w, e1, e2, e3 };
  }

  /** Le clic d'une SURFACE réelle (curseur clavier/manette) : même porte partagée que la carte et la
   *  frise. Jamais `cliquerLaCase` en direct — il sauterait la porte qu'on mesure. */
  function cliqueParLeCurseur(pt: { x: number; y: number }) {
    useGame.setState({ combatCursor: { tile: { ...pt } } });
    useGame.getState().commitCursor();
    useGame.setState({ combatCursor: null });
  }

  /**
   * SORT DE ZONE HORS D'ATTEINTE — le survol ne montre rien (`invalid`), et le clic ne doit RIEN ouvrir
   * en silence : le gate de portée/LdV (`castTargetBlock`) précède le routage de zone, sinon la cascade
   * partait sans un mot sur une cible que l'affordance déclarait déjà hors d'atteinte.
   */
  it('cible HORS de portée : rien au survol, aucune cascade ouverte au clic, et le refus est DIT', () => {
    const { w, e3 } = setupBattle();
    w.characteristics['force-mentale'] = 20; // portée du sort = FM mètres → 10 cases
    e3.pos = { x: 19, y: 19 }; // 17 cases depuis (2,2) : au-delà de la portée
    useGame.setState({ refus: null });
    const mode = currentTargetingMode(useGame.getState);
    expect(mode.id).toBe('incantation');
    expect(mode.affordance!(useGame.getState, w, e3), 'invalide = le survol n’affiche rien').toMatchObject({ kind: 'invalid' });
    cliqueParLeCurseur(e3.pos);
    expect(useGame.getState().pendingCast, 'une zone ne s’ouvre PAS sur une cible hors d’atteinte').toBeNull();
    expect(useGame.getState().refus?.texte, 'le refus se dit au point du geste').toBeTruthy();
  });
});

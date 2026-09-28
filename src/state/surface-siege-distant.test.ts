/**
 * #1426 — « un siège qui POSSÈDE voit » : trois fenêtres de combat qui se décidaient sur l'affordance
 * LOCALE (`pilotedByHuman`, « qui a la main devant CET écran ») au lieu de la SURFACE (« un siège
 * humain QUELCONQUE tient ce porteur »). Évaluées chez l'HÔTE pour le héros d'un invité, elles
 * dégradaient ce héros en automate :
 *  — défense d'une manœuvre de ZONE (Souffle, LDB 85) : les effets subis en silence, sans défense ;
 *  — balayage d'un héros (LDB 14 l.9 / 85 l.362) : ni fenêtre ici, ni `autoCleave` (gaté `aiDriven`) ;
 *  — fuite (LDB 15 l.59-68) : le flux résolu HEADLESS alors que le fuyard porte son propre cycle.
 * En SOLO les deux prédicats coïncident : ces régressions y sont INVISIBLES — d'où le harnais à deux
 * sièges.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useGame } from './store';
import './combatFlow';
import { aiCreatureFreeAttacks, maybeHeroCleave } from './combatFlow';
import { createHero } from '../engine/character';
import { seedBattleRng } from './battleRng';
import { testScene } from '../scenes/test-fixture';
import { resetCadence } from '../engine/cadence';
import { tenuParUnHumain, pilotedByHuman, defenseSurfaced, aiDriven, seatOwns } from './netOwnership';
import { fleeCalme, fleeNeedCalme } from './pendings';
import type { Combatant } from '../engine/types';
import type { AttackResult } from '../engine/combat';

const g = useGame.getState;
const set = useGame.setState;
const NET0 = g().net;

/** Combat RÉEL à deux sièges : le siège 1 (invité) possède H[0] ; l'hôte (siège 0) rend l'état. */
function coop(vivants = 1): { H: Combatant[]; E: Combatant[] } {
  const party = [createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H0', seed: 1 })];
  set({ party });
  g().startScene(testScene());
  g().startCombat('enc-mutants');
  g().confirmRoundStart();
  vi.clearAllTimers();
  const b = g().battle!;
  const H = b.combatants.filter((c) => c.kind === 'hero');
  const enemies = b.combatants.filter((c) => c.kind === 'enemy');
  enemies.slice(vivants).forEach((e) => (e.dead = true));
  const E = enemies.slice(0, vivants);
  H[0].pos = { x: 10, y: 10 };
  set({ battle: { ...b }, pendingCascade: null, suspendedCascades: [], pendingCleave: null, pendingDisengage: null } as never);
  set({ net: { ...NET0, mode: 'host', mySeat: 0, gmSeat: undefined, slots: [0, 1, 0, 0], ownership: { [H[0].id]: 1 } } } as never);
  return { H, E };
}

beforeEach(() => {
  vi.useFakeTimers(); vi.clearAllTimers(); resetCadence(); seedBattleRng(4);
  set({ battle: null, pendingCascade: null, suspendedCascades: [], pendingCleave: null, pendingDisengage: null } as never);
});
afterEach(() => {
  vi.clearAllTimers(); vi.useRealTimers(); resetCadence();
  set({ net: NET0, battle: null, pendingCascade: null, suspendedCascades: [], pendingCleave: null, pendingDisengage: null } as never);
});

describe('Le héros d’un siège DISTANT garde ses fenêtres chez l’hôte (#1426)', () => {
  it('Souffle (LDB 85) : le défenseur de l’invité a SA défense de manœuvre, pas les effets en silence', () => {
    const { H, E } = coop();
    expect(pilotedByHuman(g(), H[0]), 'chez l’hôte, il n’a pas la main sur le héros de l’invité…').toBe(false);
    expect(defenseSurfaced(g(), H[0]), '…mais un siège humain le tient').toBe(true);

    E[0].traits = [{ id: 'souffle', value: 14, arg: 'Feu' }];
    E[0].advantage = 2;
    E[0].characteristics['capacite-de-tir'] = 85;
    E[0].characteristics.endurance = 40;
    E[0].pos = { x: 5, y: 5 };
    H[0].pos = { x: 5, y: 8 };
    H[0].characteristics.agilite = 1;
    H[0].skills = H[0].skills.filter((s) => s.id !== 'esquive');
    H[0].conditions = [];
    set({ battle: { ...g().battle!, acted: true } });

    aiCreatureFreeAttacks(g, set, E[0]);

    const etape = (g().pendingCascade?.participants ?? []).find((s) => s.kind === 'maneuverDefense' && s.actorId === H[0].id);
    expect(etape, 'la défense de manœuvre du héros distant doit REMONTER').toBeTruthy();
    expect(etape!.result ?? null, 'et rien n’a été roulé à sa place').toBeNull();
    expect(seatOwns(g(), 1, H[0].id), 'la fenêtre appartient au siège qui possède le défenseur').toBe(true);
  });

  it('Balayage (LDB 85 l.362) : l’attaquant de l’invité reçoit `pendingCleave`, jamais une perte silencieuse', () => {
    const { H, E } = coop(2);
    E[0].pos = { x: 11, y: 10 }; // frappé
    E[1].pos = { x: 11, y: 11 }; // adjacent et hors des `hitIds` → il reste une cible à enchaîner
    set({ battle: { ...g().battle! } });
    const res = { hit: true, attackerRoll: 30, netSL: 2, location: 'corps', damage: 5, woundsLost: 3,
      critical: false, cleave: true, advantageTo: 'attacker', defenderDefeated: false, log: 'touche' } as unknown as AttackResult;

    maybeHeroCleave(g, set, H[0], E[0], res, false);

    const pc = g().pendingCleave;
    expect(pc, 'le balayage du héros distant doit ouvrir SA fenêtre').toBeTruthy();
    expect(pc!.attackerId).toBe(H[0].id);
    expect(seatOwns(g(), 1, pc!.attackerId), 'elle appartient au siège qui possède l’attaquant').toBe(true);
  });

  it('AUCUN porteur entre les deux chemins du balayage : `tenuParUnHumain` et `aiDriven` se partagent les porteurs', () => {
    const { H, E } = coop();
    const partage = (c: Combatant, quoi: string) =>
      expect(tenuParUnHumain(g(), c.id) !== aiDriven(g(), c), `${quoi} : ni fenêtre ni automate (ou les DEUX)`).toBe(true);
    partage(H[0], 'héros manuel d’un siège distant');
    H[0].aiControlled = true;
    set({ net: { ...g().net, ownership: {} } } as never); // héros IA rendu à l'hôte
    partage(H[0], 'héros conduit par l’IA');
    H[0].aiControlled = false;
    partage(H[0], 'héros manuel local');
    partage(E[0], 'ennemi sans siège MJ');
    set({ net: { ...g().net, gmSeat: 0 } } as never);
    partage(E[0], 'ennemi conduit par le MJ');
  });

  it('Fuite (LDB 15 l.59-68) : le fuyard de l’invité garde sa fenêtre — pas de résolution HEADLESS', () => {
    const { H, E } = coop();
    E[0].pos = { x: 11, y: 10 };
    E[0].characteristics['capacite-de-combat'] = 90;
    H[0].wounds = { current: 40, max: 40, base: 40 } as never;
    H[0].engagedWith = [E[0].id];
    E[0].engagedWith = [H[0].id];
    set({
      battle: { ...g().battle! },
      pendingDisengage: { moverId: H[0].id, foeId: E[0].id, canSacrifice: false, phase: 'choice', atk: null, def: null, result: null },
    } as never);

    g().disengageFlee();

    const pd = g().pendingDisengage;
    expect(pd, 'la fenêtre de fuite a été résolue sans le fuyard').toBeTruthy();
    expect(pd!.fuir, 'le flux `flee` doit être OUVERT').toBeTruthy();
    expect(fleeCalme(pd!)!.interactive, 'le fuyard est un acteur JOUÉ : son Test de Calme lui revient').toBe(true);
    expect(fleeNeedCalme(pd!) ? fleeCalme(pd!)!.calme : null, 'son Calme a été jeté à sa place').toBeNull();
    // …et le siège qui le possède peut mener la fenêtre à son terme.
    expect(seatOwns(g(), 1, H[0].id)).toBe(true);
  });
});

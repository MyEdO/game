import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useGame } from './store';
import { applyAttackResult } from './combatFlow';
import { draineCascade } from './cascadeTestKit';
import { createHero } from '../engine/character';
import { rederivePassiveAttack } from '../engine/combat';
import { testScene } from '../scenes/test-fixture';
import type { ArmourPoints, Combatant, Weapon } from '../engine/types';

/** Martyr : LDB 43 l.107 ; le Critique reste sur la cible : LDB 14 l.3, LDB 13 l.159. */

const SANS_PA: ArmourPoints = { tete: 0, corps: 0, brasG: 0, brasD: 0, jambeG: 0, jambeD: 0 };
const epee = { label: 'Épée', type: 'melee', damage: { plusBF: true, flat: 4 }, qualities: [] } as unknown as Weapon;
/** Arme Inoffensive (LDB 62 l.327) : aucune Blessure minimale. */
const gourdin = { label: 'Gourdin', type: 'melee', damage: { plusBF: false, flat: 0 }, qualities: [{ id: 'inoffensive' }] } as unknown as Weapon;

interface Coup { sl: number; critical: boolean; martyr?: boolean; fenetre?: boolean; arme?: Weapon; endurance?: number; endurancePretre?: number; pa?: number }

/** Une touche de `sl` DR sur la cible, gardée ou non par un prêtre sous Martyr, par la couture du jeu
 *  (`rederivePassiveAttack` → `applyHit`). `fenetre` : attaque STANDARD, dont le Critique ouvre la fenêtre
 *  de Blessure critique et RÉ-ENTRE `applyAttackResult`. */
function touche({ sl, critical, martyr = true, fenetre = false, arme = epee, endurance, endurancePretre, pa = 0 }: Coup) {
  useGame.getState().seedRng(7);
  const hero = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', seed: 7 });
  useGame.setState({ party: [hero], battle: null, pendingCascade: null, suspendedCascades: [] });
  useGame.getState().startScene(structuredClone(testScene()));
  useGame.getState().startCombat('enc-mutants');
  useGame.getState().confirmRoundStart();
  vi.clearAllTimers();
  const b = useGame.getState().battle!;
  const H = b.combatants.find((c) => c.kind === 'hero')!;
  const [cible, pretre] = b.combatants.filter((c) => c.kind === 'enemy');
  for (const c of [cible, pretre]) { c.items = (c.items ?? []).filter((i) => i.kind !== 'armor'); c.armour = { ...SANS_PA }; c.wounds = { current: 20, max: 20 } as Combatant['wounds']; }
  cible.important = true; // LDB 18 l.44 : hors Mort subite
  cible.armour = { tete: pa, corps: pa, brasG: pa, brasD: pa, jambeG: pa, jambeD: pa };
  if (endurance != null) cible.characteristics = { ...cible.characteristics, endurance };
  if (endurancePretre != null) pretre.characteristics = { ...pretre.characteristics, endurance: endurancePretre };
  if (martyr) cible.activeEffects = [{ label: 'Martyr', bonus: 0, duration: { scale: 'rounds', left: 4 }, martyrGuard: pretre.id }] as never;
  const res = rederivePassiveAttack(H, cible, arme, { roll: critical ? 44 : 45, target: 90, success: true, sl, isDouble: critical } as never, 'melee', 'corps');
  applyAttackResult(useGame.getState, useGame.setState, H, cible, arme, res, fenetre ? {} : { sousAttaque: true });
  draineCascade(useGame.getState);
  const apres = useGame.getState().battle!.combatants;
  return { res, cible: apres.find((c) => c.id === cible.id)!, pretre: apres.find((c) => c.id === pretre.id)! };
}

describe('Martyr : les Dégâts au prêtre, le Critique à la cible', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.clearAllTimers(); });
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });

  it('sans Critique : la cible reste intacte, le prêtre encaisse', () => {
    const { res, cible, pretre } = touche({ sl: 2, critical: false });
    expect(res).toMatchObject({ hit: true, critical: false });
    expect(cible.wounds.current).toBe(20);
    expect(cible.criticalWounds ?? 0).toBe(0);
    expect(pretre.wounds.current).toBeLessThan(20);
  });

  it('avec Critique : le Critique frappe la cible, qui ne perd aucune Blessure des Dégâts de la touche', () => {
    const faible = touche({ sl: 2, critical: true });
    const fort = touche({ sl: 6, critical: true });
    expect(faible.res.critical).toBe(true);
    expect(faible.cible.criticalWounds).toBe(1);
    expect(fort.cible.criticalWounds).toBe(1);
    // Les Dégâts ne la touchent pas : la plus forte touche lui laisse les mêmes Blessures.
    expect(fort.cible.wounds.current).toBe(faible.cible.wounds.current);
    expect(fort.pretre.wounds.current).toBeLessThan(faible.pretre.wounds.current);
  });

  it('avec Critique : le prêtre encaisse une seule fois, malgré la fenêtre du Critique', () => {
    const fenetre = touche({ sl: 2, critical: true, fenetre: true });
    expect(fenetre.cible.criticalWounds).toBe(1);
    expect(fenetre.pretre.wounds.current).toBe(touche({ sl: 2, critical: false }).pretre.wounds.current);
  });

  it('Critique dévié (LDB 63 l.30) : la Déviation ne réinjecte aucun Dégât de la touche', () => {
    const { cible } = touche({ sl: 6, critical: true, pa: 1 });
    expect(cible.criticalWounds ?? 0).toBe(0);
    expect(Object.values(cible.armour ?? {}).reduce((t, n) => t + n, 0), 'un PA sacrifié').toBe(5);
    expect(cible.wounds.current).toBe(20);
  });

  it('touche à 0 Blessure (arme Inoffensive) : ses Dégâts vont quand même au prêtre', () => {
    const { res, pretre } = touche({ sl: 2, critical: false, arme: gourdin, endurance: 90, endurancePretre: 10 });
    expect(res).toMatchObject({ hit: true, woundsLost: 0 });
    expect(res.damage).toBeGreaterThan(0);
    expect(pretre.wounds.current).toBeLessThan(20);
  });

  it('témoin sans Martyr : la plus forte touche coûte des Blessures à la cible', () => {
    expect(touche({ sl: 6, critical: true, martyr: false }).cible.wounds.current)
      .toBeLessThan(touche({ sl: 2, critical: true, martyr: false }).cible.wounds.current);
  });
});

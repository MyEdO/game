/**
 * Lot 6 — Ciblage de Zone d'Effet (LDB 47 l.28) : parsing diamètre/portée,
 * clic-case en mode incantation → toutes les cibles du rayon visées par le
 * même jet, garde-fou de portée, et cible hors de portée refusée avant le routage de zone (LDB 47 l.27).
 */
import { idsDeTest } from '../engine/idsDeTest.testkit';
import { describe, it, expect, beforeEach } from 'vitest';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { herosDeScenario } from '../scenes/test-scenarios/_heros';
import { spawnEnemy } from './monde/spawn';
import { zdeDiameterMeters, zdeRadiusTiles, spellRangeTiles } from '../engine/magic';
import { findSpellById } from '../data';
import type { Combatant } from '../engine/types';
import { blessuresSurLeProfil, blessuresDeBase } from '../engine/combattantDeTest.testkit';
import { currentTargetingMode } from './targetingModes';
import { jouerLeClicDeCase } from './combatOrParty';

let banc: Banc;

function wiz() {
  const w = herosDeScenario(idsDeTest, 'sorcier');
  const sk = w.skills.find((s) => s.id === 'langue');
  if (sk) sk.advances = Math.max(sk.advances, 10);
  w.spells = ['explosion', ...(w.spells ?? [])]; // Explosion : Projectile magique ZdE (LDB 47 l.453)
  return w;
}

describe('parsing ZdE / portée (engine/magic)', () => {
  const caster = blessuresSurLeProfil({ characteristics: { 'force-mentale': 42, initiative: 30, sociabilite: 30, 'capacite-de-combat': 0, 'capacite-de-tir': 0, force: 0, endurance: 0, agilite: 0, dexterite: 0, intelligence: 0 }, skills: [], talents: [], conditions: [], wounds: blessuresDeBase(1), advantage: 0, movement: 4, weapons: [], armour: {} }) as never as Combatant;
  it('aire { diamètre (Bonus de FM) } → diamètre BFM, rayon en cases ⌊d/2/2⌋', () => {
    expect(zdeDiameterMeters({ kind: 'area', span: 'diameter', meters: { bonusOf: 'force-mentale' } }, caster)).toBe(4);
    expect(zdeRadiusTiles({ kind: 'area', span: 'diameter', meters: { bonusOf: 'force-mentale' } }, caster)).toBe(1);
    expect(zdeRadiusTiles({ kind: 'special', text: 'ZdE (Spécial)' }, caster)).toBeNull(); // mur/lieu : non chiffrable
    expect(zdeRadiusTiles({ kind: 'count', n: 1 }, caster)).toBeNull(); // cible dénombrée : pas une ZdE
  });
  it('portée : distance littérale / (Caractéristique) / self / touch', () => {
    expect(spellRangeTiles({ kind: 'distance', value: 6, unit: 'm' }, caster)).toBe(3);
    expect(spellRangeTiles({ kind: 'distance', value: { charOf: 'force-mentale' }, unit: 'm' }, caster)).toBe(21); // 42 m → 21 cases
    expect(spellRangeTiles({ kind: 'self' }, caster)).toBe(0);
    expect(spellRangeTiles({ kind: 'touch' }, caster)).toBe(1);
    expect(spellRangeTiles(null, caster)).toBeNull();
  });
});

describe('ZdE en combat — flux « jet PUIS pose » (LDB 47 l.15/28)', () => {
  beforeEach(() => {
    banc = ouvrirLeBanc();
    banc.setState({ battle: null, party: [], journal: [], pendingCast: null, refus: null });
    banc.getState().ensemencerLeTirage(17);
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
    banc.setState({ battle, scene, party: [] });
    return { w, e1, e2, e3 };
  }

  /** Jet RÉUSSI posé directement (déterminisme) — sl au choix pour piloter le budget de Surincantation. */
  const okCast = (sl: number) => ({ cast: true, roll: 11, target: 70, sl, isCritical: false, isFumble: false, log: 'lancé' });

  it('tout clic (case ou token) OUVRE la modale sans centre ; la pose touche tous ceux du rayon FINAL', () => {
    const { w, e1, e2, e3 } = setupBattle();
    banc.getState().cliquerLaCase({ x: 9, y: 9 }); // n'importe quelle case : la modale s'ouvre
    const pc = banc.getState().pendingCast!;
    expect(pc.zone).toMatchObject({ center: null, radius: 1 });
    expect(pc.targetId).toBe(w.id); // ancre lanceur — aucun effet ne lui est appliqué
    banc.setState({ pendingCast: { ...pc, result: okCast(4) as never } });
    banc.getState().jetRegler('incantation', 'carte', 'zone');
    banc.getState().cliquerLaCase({ x: 6, y: 6 }); // pose → application immédiate
    expect(banc.getState().pendingCast).toBeNull();
    const hp = (id: string) => banc.getState().battle!.combatants.find((c) => c.id === id)!.wounds;
    expect(hp('e1').current).toBeLessThan(hp('e1').max); // dans le rayon
    expect(hp('e2').current).toBeLessThan(hp('e2').max);
    expect(hp('e3').current).toBe(hp('e3').max); // hors zone
    expect(banc.getState().battle!.acted).toBe(true);
    void e1; void e2; void e3;
  });

  it('Surincantation « +Zone » (LDB 47 l.15) : le gabarit s’agrandit du Ø initial et la pose ramasse plus loin', () => {
    const { w } = setupBattle();
    const ni = findSpellById('explosion')!.cn ?? 0;
    banc.getState().cliquerLaCase({ x: 9, y: 9 });
    let pc = banc.getState().pendingCast!;
    banc.setState({ pendingCast: { ...pc, result: okCast(ni + 2) as never } }); // surplus 2 → 1 allocation
    banc.getState().jetRegler('incantation', 'surincantationZone', 1);
    pc = banc.getState().pendingCast!;
    expect(pc.overcast?.zone).toBe(1);
    expect(pc.zone!.radius).toBe(2); // r0m 2 m → ×2 = 4 m → 2 cases
    banc.getState().jetRegler('incantation', 'carte', 'zone');
    banc.getState().cliquerLaCase({ x: 10, y: 10 }); // e3 (12,12) à 2 cases du centre
    const hp = (id: string) => banc.getState().battle!.combatants.find((c) => c.id === id)!.wounds;
    expect(hp('e3').current).toBeLessThan(hp('e3').max);
    expect(hp('e1').current).toBe(hp('e1').max); // loin du centre
    void w;
  });

  it('pose hors de portée → refus journalisé, la pose RESTE en cours ; zone VIDE → autorisée (Action consommée)', () => {
    const { w } = setupBattle();
    w.characteristics['force-mentale'] = 8; // portée (FM) mètres → 4 cases
    banc.getState().cliquerLaCase({ x: 9, y: 9 });
    const pc = banc.getState().pendingCast!;
    banc.setState({ pendingCast: { ...pc, result: okCast(4) as never } });
    banc.getState().jetRegler('incantation', 'carte', 'zone');
    banc.getState().cliquerLaCase({ x: 12, y: 12 }); // 10 cases > 4 → refus
    expect(banc.getState().journal.join('\n')).toMatch(/hors de portée/);
    expect(banc.getState().pendingCast?.zone?.placing).toBe(true); // toujours en pose
    banc.getState().cliquerLaCase({ x: 4, y: 4 }); // dans la portée, PERSONNE dans le rayon
    expect(banc.getState().pendingCast).toBeNull();
    // En combat, la sortie commune (finishPlayerAction) écrit dans le LOG de combat.
    expect(banc.getState().battle!.log.map((e) => e.text).join('\n')).toMatch(/ne touche personne/);
    expect(banc.getState().battle!.acted).toBe(true);
  });

  // LDB 47 l.27. Le clic passe par la porte du champ (`jouerLeClicDeCase`), celle du clic-sol et du curseur.
  it('cible HORS de portée : rien au survol, aucune cascade ouverte au clic, et le refus est DIT', () => {
    const { w, e3 } = setupBattle();
    w.characteristics['force-mentale'] = 20; // portée du sort = FM mètres → 10 cases
    e3.pos = { x: 19, y: 19 }; // 17 cases depuis (2,2) : au-delà de la portée
    const mode = currentTargetingMode(banc.getState);
    expect(mode.id).toBe('incantation');
    expect(mode.affordance!(banc.getState, w, e3), 'invalide = le survol n’affiche rien').toMatchObject({ kind: 'invalid' });
    expect(jouerLeClicDeCase(banc.getState, e3.pos!, true), 'le clic de la cible se joue').toBe(true);
    expect(banc.getState().pendingCast, 'une zone ne s’ouvre PAS sur une cible hors d’atteinte').toBeNull();
    expect(banc.getState().refus?.texte, 'le refus se dit au point du geste').toBeTruthy();
  });
});

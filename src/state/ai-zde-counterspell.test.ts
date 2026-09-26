/**
 * LOT 6 — point A : PARITÉ Contre-sort sur une ZdE ENNEMIE (LDB 46 l.154-162).
 *
 * Une ZdE d'un lanceur IA (`case 'castArea'`) OUVRE la fenêtre de Contre-sort/Dissipation comme le missile
 * (via `routeCounterspell`/`pendingCounterspell`). La RÉSOLUTION passe par le chemin PARTAGÉ, commun à
 * l'IA et à la zone : `counterspellConfirm/Cancel → castConfirm` :
 *  - « Laisser passer » → `castConfirm` POSE la zone sur le centre auto-choisi (`zone.autoCenter`, l'équivalent
 *    du curseur souris d'un héros) parce que le lanceur est `aiDriven` — exactement comme le héros manuel
 *    pose au clic ;
 *  - DISSIPATION → `castConfirm` ne pose RIEN (zone non posée), pending fermé proprement (pas de soft-lock).
 *
 * On vérifie aussi l'invariant de SYMÉTRIE : un héros MANUEL passé par `castConfirm` sur une ZdE non posée
 * RESTE en pose (attend le clic réel) — `castConfirm` n'auto-pose QUE pour un lanceur `aiDriven`.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useGame } from './store';
import { spawnEnemy } from './spawn';
import { pregen, PREGEN } from '../data/pregens';
import { findSpell } from '../data';
import type { Combatant } from '../engine/types';

describe('ZdE ennemie — fenêtre de Contre-sort (parité missile, chemin PARTAGÉ castConfirm)', () => {
  beforeEach(() => {
    vi.useFakeTimers(); vi.clearAllTimers();
    useGame.setState({ battle: null, party: [], journal: [], pendingCast: null, pendingCounterspell: null, pendingCascade: null });
    useGame.getState().seedRng(17);
  });
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });

  /** Un héros LANCEUR (Langue (Magick)) capable de Dissiper, posé en (x,y). */
  function dispeller(x: number, y: number, id: string): Combatant {
    const h = pregen(PREGEN.sorcier);
    h.id = id; h.label = id; h.pos = { x, y };
    h.wounds = { ...h.wounds, max: 99, current: 99 };
    const sk = h.skills.find((s) => s.id === 'langue');
    if (sk) sk.advances = Math.max(sk.advances, 30);
    else h.skills.push({ id: 'langue', spec: 'magick', characteristic: 'intelligence', advances: 30 } as never);
    h.spells = ['flechette', ...(h.spells ?? [])];
    return h;
  }

  /** Un sort de ZdE FIGÉ dans pendingCast (zone NON posée + autoCenter) — état EXACT que `case 'castArea'`
   *  produit juste avant la fenêtre de Contre-sort (jet réussi, centre auto-choisi mémorisé). */
  const okCast = () => ({ cast: true, roll: 11, target: 80, sl: 4, isCritical: false, isFumble: false, log: 'lancé' });

  function setupZoneAwaitingCounter() {
    const e = spawnEnemy({ ref: 'brigand' }, 'caster', { x: 5, y: 5 });
    e.kind = 'enemy';
    e.characteristics.intelligence = 60; e.characteristics['force-mentale'] = 60;
    e.skills = [{ id: 'langue', spec: 'magick', characteristic: 'intelligence', advances: 40 } as never];
    const spell = findSpell('Explosion')!; // Projectile magique à ZdE
    e.spells = [spell.id];
    const h1 = dispeller(8, 8, 'h1');
    const h2 = dispeller(9, 8, 'h2'); // collés → un centre couvre les deux
    const battle = {
      combatants: [e, h1, h2], order: ['caster', 'h1', 'h2'], baseOrder: ['caster', 'h1', 'h2'],
      turn: 0, round: 1, action: 'cast', selectedSpellId: spell.id, reachable: new Map(),
      movementUsed: 0, movedPreAction: false, acted: false, log: [], over: null,
    } as never;
    const scene = { id: 's', dimensions: { w: 20, h: 20 }, layers: [{ z: 0, tiles: [] }], entities: [], dialogues: [], triggers: [], encounters: [] } as never;
    useGame.setState({ battle, scene, party: [] });
    // Pose l'état figé : zone non posée + centre auto-choisi sur le paquet (8,8).
    useGame.setState({
      pendingCast: {
        casterId: 'caster', targetId: 'caster', spellId: spell.id, missile: true, focused: false,
        result: okCast() as never,
        zone: { center: null, radius: 1, r0m: 2, autoCenter: { x: 8, y: 8 } },
      } as never,
    });
    return { e, h1, h2 };
  }

  it('« Laisser passer » (aucune Dissipation) → castConfirm POSE la zone sur autoCenter (caster aiDriven, pas de soft-lock, pas de mono-cible)', () => {
    const { h1, h2 } = setupZoneAwaitingCounter();
    // Rangée DÉCLARÉE (#1042/#1059) : « Laisser passer » n'existe qu'une fois la composition arrêtée.
    useGame.setState({ pendingCounterspell: { participants: [{ id: h1.id, interactive: true, declared: 'solo', result: null }] } as never });
    useGame.getState().counterspellCancel(); // personne ne contre → castConfirm pose la zone sur (8,8)
    expect(useGame.getState().pendingCounterspell).toBeNull();
    expect(useGame.getState().pendingCast).toBeNull(); // pending fermé (zone posée → pas de soft-lock)
    const hp = (id: string) => useGame.getState().battle!.combatants.find((c) => c.id === id)!.wounds;
    expect(hp('h1').current).toBeLessThan(hp('h1').max); // dans le rayon → touché par la zone
    expect(hp('h2').current).toBeLessThan(hp('h2').max);
    void h2;
  });

  it('DISSIPATION (Contre-sort gagnant) → castConfirm NE POSE RIEN, pending fermé proprement (pas de soft-lock)', () => {
    const { h1, h2 } = setupZoneAwaitingCounter();
    // Force une issue de dissipation directement dans le participant (le moteur de Contre-sort la produit
    // normalement ; ici on isole la ROUTE post-Contre-sort = le chemin PARTAGÉ castConfirm).
    useGame.setState({
      pendingCounterspell: {
        participants: [{ id: h1.id, interactive: true, result: { dispelled: true, counter: { sl: 5 }, log: 'Dissipé !' } }],
      } as never,
    });
    const hpBefore = useGame.getState().battle!.combatants.find((c) => c.id === h2.id)!.wounds.current;
    useGame.getState().counterspellConfirm();
    expect(useGame.getState().pendingCounterspell).toBeNull();
    expect(useGame.getState().pendingCast).toBeNull(); // fermé proprement même dissipé (pas de soft-lock)
    // Sort dissipé → aucune zone appliquée : les cibles du paquet sont INTACTES.
    expect(useGame.getState().battle!.combatants.find((c) => c.id === h1.id)!.wounds.current).toBe(99);
    expect(useGame.getState().battle!.combatants.find((c) => c.id === h2.id)!.wounds.current).toBe(hpBefore);
  });

  it('ZdE IA SANS dissipeur (castConfirm direct) → la zone se pose toute seule sur autoCenter (le paquet est touché)', () => {
    const { h1, h2 } = setupZoneAwaitingCounter();
    // Aucun Contre-sort ouvert (aucun dissipeur) : `case 'castArea'` appelle directement castConfirm.
    expect(useGame.getState().pendingCounterspell).toBeNull();
    useGame.getState().castConfirm();
    expect(useGame.getState().pendingCast).toBeNull(); // posé → pending fermé
    const hp = (id: string) => useGame.getState().battle!.combatants.find((c) => c.id === id)!.wounds;
    expect(hp('h1').current).toBeLessThan(hp('h1').max);
    expect(hp('h2').current).toBeLessThan(hp('h2').max);
    void h1; void h2;
  });

  it('SYMÉTRIE — héros MANUEL : castConfirm sur une ZdE non posée RESTE en pose (attend le clic, PAS d\'auto-pose)', () => {
    const spell = findSpell('Explosion')!;
    const w = dispeller(2, 2, 'wiz'); // héros lanceur (kind hero → non aiDriven en cadence manuelle)
    w.spells = [spell.id, ...(w.spells ?? [])];
    const t1 = spawnEnemy({ ref: 'brigand' }, 't1', { x: 8, y: 8 });
    const battle = {
      combatants: [w, t1], order: [w.id, 't1'], baseOrder: [w.id, 't1'],
      turn: 0, round: 1, action: 'cast', selectedSpellId: spell.id, reachable: new Map(),
      movementUsed: 0, movedPreAction: false, acted: false, log: [], over: null,
    } as never;
    const scene = { id: 's', dimensions: { w: 20, h: 20 }, layers: [{ z: 0, tiles: [] }], entities: [], dialogues: [], triggers: [], encounters: [] } as never;
    useGame.setState({ battle, scene, party: [] });
    useGame.setState({
      pendingCast: {
        casterId: w.id, targetId: w.id, spellId: spell.id, missile: true, focused: false,
        result: okCast() as never,
        zone: { center: null, radius: 1, r0m: 2 }, // PAS d'autoCenter (pose joueur)
      } as never,
    });
    useGame.getState().castConfirm(); // héros manuel → passe EN POSE, n'applique rien
    const pc = useGame.getState().pendingCast;
    expect(pc).not.toBeNull(); // pending vivant (attend le clic réel)
    expect(pc!.zone!.placing).toBe(true); // gabarit qui suit le curseur
    expect(pc!.zone!.center).toBeNull(); // zone non posée à ce stade
    // La cible n'a RIEN reçu (aucune application avant la pose).
    expect(useGame.getState().battle!.combatants.find((c) => c.id === 't1')!.wounds.current)
      .toBe(useGame.getState().battle!.combatants.find((c) => c.id === 't1')!.wounds.max);
  });
});

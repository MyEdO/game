/**
 * Lot 6 — Ciblage de Zone d'Effet (LDB 47 l.28) : parsing diamètre/portée,
 * clic-case en mode incantation → toutes les cibles du rayon visées par le
 * même jet, garde-fou de portée.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useGame } from './store';
import { pregen, PREGEN } from '../data/pregens';
import { spawnEnemy } from './spawn';
import { zdeDiameterMeters, zdeRadiusTiles, spellRangeTiles } from '../engine/magic';
import { findSpell } from '../data';
import { currentTargetingMode } from './targetingModes';
import type { Combatant } from '../engine/types';

function wiz() {
  const w = pregen(PREGEN.sorcier);
  const sk = w.skills.find((s) => s.id === 'langue');
  if (sk) sk.advances = Math.max(sk.advances, 10);
  w.spells = ['explosion', ...(w.spells ?? [])]; // Explosion : Projectile magique ZdE (LDB 47 l.453)
  return w;
}

describe('parsing ZdE / portée (engine/magic)', () => {
  const caster = { characteristics: { 'force-mentale': 42, initiative: 30, sociabilite: 30, 'capacite-de-combat': 0, 'capacite-de-tir': 0, force: 0, endurance: 0, agilite: 0, dexterite: 0, intelligence: 0 }, skills: [], talents: [], conditions: [], wounds: { current: 1, max: 1 }, advantage: 0, movement: 4, weapons: [], armour: {} } as never as Combatant;
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
    useGame.setState({ battle: null, party: [], journal: [], pendingCast: null, refus: null, combatCursor: null });
    useGame.getState().seedRng(17);
  });

  function setupBattle() {
    const w = wiz();
    w.pos = { x: 2, y: 2 };
    w.characteristics['force-mentale'] = 40; // BFM 4 → ZdE diamètre 4 m → rayon 1 case ; portée (FM) m → 20 cases
    const e1 = spawnEnemy({ ref: 'brigand' }, 'e1', { x: 6, y: 6 });
    const e2 = spawnEnemy({ ref: 'brigand' }, 'e2', { x: 7, y: 6 });
    const e3 = spawnEnemy({ ref: 'brigand' }, 'e3', { x: 12, y: 12 }); // hors zone
    const battle = {
      combatants: [w, e1, e2, e3], order: [w.id, 'e1', 'e2', 'e3'], baseOrder: [w.id, 'e1', 'e2', 'e3'],
      turn: 0, round: 1, action: 'cast', selectedSpellId: 'explosion', reachable: new Map(),
      movementUsed: 0, movedPreAction: false, acted: false, log: [], over: null,
    } as never;
    const scene = { id: 's', dimensions: { w: 20, h: 20 }, layers: [{ z: 0, tiles: [] }], entities: [], dialogues: [], triggers: [], encounters: [] } as never;
    useGame.setState({ battle, scene, party: [] });
    return { w, e1, e2, e3 };
  }

  /** Jet RÉUSSI posé directement (déterminisme) — sl au choix pour piloter le budget de Surincantation. */
  const okCast = (sl: number) => ({ cast: true, roll: 11, target: 70, sl, isCritical: false, isFumble: false, log: 'lancé' });

  /** Le clic d'une SURFACE réelle (curseur clavier/manette) : même porte partagée que la carte et la
   *  frise. Jamais `battleClickEntity` en direct — il sauterait la porte qu'on mesure. */
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
    expect(mode.id).toBe('cast');
    expect(mode.affordance!(useGame.getState, w, e3), 'invalide = le survol n’affiche rien').toMatchObject({ kind: 'invalid' });
    cliqueParLeCurseur(e3.pos);
    expect(useGame.getState().pendingCast, 'une zone ne s’ouvre PAS sur une cible hors d’atteinte').toBeNull();
    expect(useGame.getState().refus?.texte, 'le refus se dit au point du geste').toBeTruthy();
  });

  it('tout clic (case ou token) OUVRE la modale sans centre ; la pose touche tous ceux du rayon FINAL', () => {
    const { w, e1, e2, e3 } = setupBattle();
    useGame.getState().battleClickTile({ x: 9, y: 9 }); // n'importe quelle case : la modale s'ouvre
    const pc = useGame.getState().pendingCast!;
    expect(pc.zone).toMatchObject({ center: null, radius: 1 });
    expect(pc.targetId).toBe(w.id); // ancre lanceur — aucun effet ne lui est appliqué
    useGame.setState({ pendingCast: { ...pc, result: okCast(4) as never } });
    useGame.getState().castPlaceZone(true);
    useGame.getState().battleClickTile({ x: 6, y: 6 }); // pose → application immédiate
    expect(useGame.getState().pendingCast).toBeNull();
    const hp = (id: string) => useGame.getState().battle!.combatants.find((c) => c.id === id)!.wounds;
    expect(hp('e1').current).toBeLessThan(hp('e1').max); // dans le rayon
    expect(hp('e2').current).toBeLessThan(hp('e2').max);
    expect(hp('e3').current).toBe(hp('e3').max); // hors zone
    expect(useGame.getState().battle!.acted).toBe(true);
    void e1; void e2; void e3;
  });

  it('Surincantation « +Zone » (LDB 47 l.15) : le gabarit s’agrandit du Ø initial et la pose ramasse plus loin', () => {
    const { w } = setupBattle();
    const ni = findSpell('Explosion')!.cn ?? 0;
    useGame.getState().battleClickTile({ x: 9, y: 9 });
    let pc = useGame.getState().pendingCast!;
    useGame.setState({ pendingCast: { ...pc, result: okCast(ni + 2) as never } }); // surplus 2 → 1 allocation
    useGame.getState().castAllocOvercast('zone', 1);
    pc = useGame.getState().pendingCast!;
    expect(pc.overcast?.zone).toBe(1);
    expect(pc.zone!.radius).toBe(2); // r0m 2 m → ×2 = 4 m → 2 cases
    useGame.getState().castPlaceZone(true);
    useGame.getState().battleClickTile({ x: 10, y: 10 }); // e3 (12,12) à 2 cases du centre
    const hp = (id: string) => useGame.getState().battle!.combatants.find((c) => c.id === id)!.wounds;
    expect(hp('e3').current).toBeLessThan(hp('e3').max);
    expect(hp('e1').current).toBe(hp('e1').max); // loin du centre
    void w;
  });

  it('pose hors de portée → refus journalisé, la pose RESTE en cours ; zone VIDE → autorisée (Action consommée)', () => {
    const { w } = setupBattle();
    w.characteristics['force-mentale'] = 8; // portée (FM) mètres → 4 cases
    useGame.getState().battleClickTile({ x: 9, y: 9 });
    const pc = useGame.getState().pendingCast!;
    useGame.setState({ pendingCast: { ...pc, result: okCast(4) as never } });
    useGame.getState().castPlaceZone(true);
    useGame.getState().battleClickTile({ x: 12, y: 12 }); // 10 cases > 4 → refus
    expect(useGame.getState().journal.join('\n')).toMatch(/hors de portée/);
    expect(useGame.getState().pendingCast?.zone?.placing).toBe(true); // toujours en pose
    useGame.getState().battleClickTile({ x: 4, y: 4 }); // dans la portée, PERSONNE dans le rayon
    expect(useGame.getState().pendingCast).toBeNull();
    // En combat, la sortie commune (finishPlayerAction) écrit dans le LOG de combat.
    expect(useGame.getState().battle!.log.map((e) => e.text).join('\n')).toMatch(/ne touche personne/);
    expect(useGame.getState().battle!.acted).toBe(true);
  });
});

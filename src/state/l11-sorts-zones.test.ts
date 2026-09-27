/**
 * L11 — sorts à ZONE PERSISTANTE (LDB 47) : Mur de feu (« Quiconque traverse le mur de feu
 * gagne 1 État En flammes et subit une frappe de BFM Dégâts ») et Grands feux d'U'Zhul
 * (« le feu continue de brûler dans la ZdE pour la durée du Sort »).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useGame } from './store';
import { applyCast, wardedAgainst, organicProjectile, zoneRadiusTilesAt } from './combatFlow';
import { sceneMetresPerTile, emptyScene } from './scene';
import { createHero } from '../engine/character';
import { findSpell } from '../data';
import { testScene } from '../scenes/test-fixture';
import type { CastResult, MissileResult } from '../engine/magic';
import type { Combatant, Weapon } from '../engine/types';
import type { GameOp } from '../engine/ops';

describe('L11 — zones persistantes posées par les sorts', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.clearAllTimers(); useGame.setState({ battle: null, pendingCast: null }); });
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });

  function setup() {
    const W = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'W', seed: 3 });
    useGame.setState({ party: [W] });
    useGame.getState().startScene(testScene());
    useGame.getState().startCombat('enc-mutants');
    useGame.getState().confirmRoundStart();
    vi.clearAllTimers();
    useGame.getState().seedRng(5);
    const b = useGame.getState().battle!;
    const caster = b.combatants.find((c) => c.label === 'W')!;
    caster.skills.push({ id: 'langue', spec: 'magick', characteristic: 'intelligence', advances: 10 });
    caster.characteristics['force-mentale'] = 40; // BFM 4
    caster.pos = { x: 5, y: 10 };
    const T = b.combatants.filter((c) => c.kind === 'enemy')[0];
    T.pos = { x: 10, y: 10 };
    return { caster, T };
  }

  it('Mur de feu : mur perpendiculaire centré sur la cible, durée (BFM) Rounds, onCross armé', () => {
    const { caster, T } = setup();
    const ok: CastResult = { cast: true, roll: 30, target: 70, sl: 6, isCritical: false, isFumble: false, log: 'ok' };
    applyCast(useGame.getState, useGame.setState, caster, T, findSpell('Mur de feu')!, ok, false, false);
    const wall = (useGame.getState().battle!.zones ?? []).find((z) => z.label === 'Mur de feu')!;
    expect(wall).toBeTruthy();
    expect(wall.rounds).toBe(4); // (BFM 4) Rounds
    expect(wall.onCross?.some((o) => o.op === 'condition' && o.id === 'en-flammes')).toBe(true);
    // axe O→E → mur VERTICAL passant par la cible ; longueur : BFM 4 m + 3 paliers (+2 DR) × 4 m = 16 m → 8 cases
    expect(wall.tiles.every((t) => t.x === 10)).toBe(true);
    expect(wall.tiles).toHaveLength(8);
    expect(wall.tiles.some((t) => t.y === 10)).toBe(true);
    expect(wall.casterId).toBe(caster.id);
  });

  it('Forêt d’épines : disque centré sur la cible, onCross Empêtré porte escapeStrength = FM du LANCEUR (LDB 48 l.749)', () => {
    const { caster, T } = setup();
    const ok: CastResult = { cast: true, roll: 30, target: 70, sl: 0, isCritical: false, isFumble: false, log: 'ok' };
    applyCast(useGame.getState, useGame.setState, caster, T, findSpell('Forêt d\'épines')!, ok, false, false);
    const zone = (useGame.getState().battle!.zones ?? []).find((z) => z.label === 'Forêt d\'épines')!;
    expect(zone).toBeTruthy();
    const empetreOp = zone.onCross?.find((o): o is Extract<GameOp, { op: 'condition' }> => o.op === 'condition' && o.id === 'empetre');
    expect(empetreOp?.escapeStrength).toEqual({ charOf: 'force-mentale' });
  });

  it('Bouclier anti-flèches / Dôme : auras posées par le cast ; géométrie intérieur/extérieur', () => {
    const { caster, T } = setup();
    const ok: CastResult = { cast: true, roll: 30, target: 70, sl: 0, isCritical: false, isFumble: false, log: 'ok' };
    applyCast(useGame.getState, useGame.setState, caster, caster, findSpell('Bouclier anti-flèches')!, ok, false, false);
    applyCast(useGame.getState, useGame.setState, caster, caster, findSpell('Dôme')!, ok, false, false);
    const effects = caster.activeEffects ?? [];
    // Les DEUX auras déclarent leur zone par la ligne « Cible » de leur sort (`LDB 47 l.356` pour le
    // Bouclier anti-flèches, `l.408` pour le Dôme). Une ZdE est un DIAMÈTRE (`LDB 47 l.28`) : à BFM 4,
    // c'est 4 m de diamètre, donc 2 m de RAYON. Ce test
    // figeait 4 m de rayon pour les deux — une zone DEUX fois trop large, recapturée ici depuis le RAW.
    expect(effects.some((e) => e.arrowWard?.radiusMeters === 2)).toBe(true);
    expect(effects.some((e) => e.domeWard?.radiusMeters === 2)).toBe(true);
    // Géométrie : héros adjacent au porteur = couvert vs un tireur lointain…
    const ally = { ...caster, id: 'ally', activeEffects: [], pos: { x: 6, y: 10 } } as Combatant;
    const combatants = [caster, ally, T];
    const mptTerre = sceneMetresPerTile(useGame.getState().scene);
    expect(wardedAgainst(combatants, T, ally, 'arrowWard', mptTerre)).toBe(true);
    // …mais un attaquant DANS la zone n'est pas gêné (le projectile n'« entre » pas).
    const inside = { ...T, id: 'in', pos: { x: 5, y: 11 } } as Combatant;
    expect(wardedAgainst([caster, ally, inside], inside, ally, 'arrowWard', mptTerre)).toBe(false);
    // ÉCHELLE DE LA SCÈNE (#1507) : l'aura reste chiffrée en MÈTRES, et sa conversion en cases est la
    // primitive partagée (`porteeEnCases`, plancher d'UNE case — formule verrouillée par
    // `echelle-de-scene.test.ts`). Avec la ZdE du RAW (4 m de DIAMÈTRE → 2 m de rayon), ce rayon tient
    // dans UNE case à toute échelle : un allié à DEUX cases n'est couvert ni à terre ni en mer. Le
    // contraste « couvert à terre, découvert en mer » que ces lignes montraient tenait à un rayon de
    // 4 m — la zone DOUBLÉE que ce lot corrige (LDB 47 l.28 : une ZdE est un diamètre).
    const loin = { ...caster, id: 'loin', activeEffects: [], pos: { x: 7, y: 10 } } as Combatant;
    expect(wardedAgainst([caster, loin, T], T, loin, 'arrowWard', mptTerre)).toBe(false);
    expect(wardedAgainst([caster, loin, T], T, loin, 'arrowWard', 10)).toBe(false);
    // …et la case ADJACENTE au porteur reste couverte à toute échelle (plancher d'UNE case).
    expect(wardedAgainst(combatants, T, ally, 'arrowWard', 10)).toBe(true);
  });

  /**
   * GABARIT d'un sort de ZONE (#1507) — `op zone` écrit son rayon en MÈTRES (`radiusMeters`) ; c'est
   * `zoneRadiusTilesAt` qui le pose en cases, à l'échelle de la SCÈNE. Une ZdE de 4 m couvre 2 cases
   * à terre et 0 case en mer (0,4 case : le gabarit est plus petit que la maille, il ne déborde pas
   * de la case posée). Le littéral `2` d'avant peignait 2 cases de 10 m, soit un disque de 40 m.
   */
  it('gabarit de ZONE : 4 m = 2 cases à 2 m/case, 0 case à 10 m/case', () => {
    const mptTerre = sceneMetresPerTile(emptyScene(1, 1));
    expect([mptTerre, zoneRadiusTilesAt(4, 0, mptTerre)]).toEqual([2, 2]);
    expect(zoneRadiusTilesAt(4, 0, 10)).toBe(0);
    // La Surincantation « +Zone » agrandit le MÊME gabarit métrique : elle suit l'échelle elle aussi.
    expect(zoneRadiusTilesAt(4, 1, mptTerre)).toBeGreaterThan(zoneRadiusTilesAt(4, 0, mptTerre));
  });

  it('organicProjectile : flag maison Weapon.organicProjectile — flèches/carreaux/javelots oui, poudre/fronde/couteaux non', () => {
    const w = (organic: boolean | undefined): Weapon => ({ label: 'x', type: 'ranged', damage: { plusBF: false, flat: 7 }, qualities: [], organicProjectile: organic } as unknown as Weapon);
    expect(organicProjectile(w(true))).toBe(true); // arc/arbalète/javelot (data trappings.json)
    expect(organicProjectile(w(false))).toBe(false);
    expect(organicProjectile(w(undefined))).toBe(false); // poudre noire/fronde/couteau de lancer : absent = non organique
  });

  it('Grands feux d’U’Zhul : disque (BFM m) autour de la cible touchée, perRound armé', () => {
    const { caster, T } = setup();
    const ok: CastResult & Partial<MissileResult> = {
      cast: true, roll: 30, target: 70, sl: 0, isCritical: false, isFumble: false, log: 'ok',
      hit: true, woundsLost: 0, defenderDefeated: false, location: 'corps',
    };
    applyCast(useGame.getState, useGame.setState, caster, T, findSpell("Grands feux d'U'Zhul")!, ok, true, false);
    const fire = (useGame.getState().battle!.zones ?? []).find((z) => z.label === "Grands feux d'U'Zhul")!;
    expect(fire).toBeTruthy();
    expect(fire.rounds).toBe(4); // (BFM) Rounds
    expect(fire.perRound?.some((o) => o.op === 'wounds' && o.ignoreAP === true)).toBe(true);
    // disque BFM 4 m → rayon 2 cases autour de la cible (10,10) → 5×5
    expect(fire.tiles).toHaveLength(25);
    expect(fire.tiles.some((t) => t.x === 10 && t.y === 10)).toBe(true);
  });
});

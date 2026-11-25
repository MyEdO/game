import { idsDeTest } from '../engine/idsDeTest.testkit';
import { describe, it, expect, beforeEach } from 'vitest';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { buildAiInput, etatDeTourNeuf, firedAttackBlock, frenzyTarget } from './combatFlow';
import { hoverTargeting } from './targeting';
import { chooseEnemyAction } from './monde/ai';
import { createHero } from '../engine/character';
import { testScene } from '../scenes/test-fixture';
import type { Combatant, Weapon } from '../engine/types';
import { MELEE, reluDans } from './combatDeTest.testkit';
import { effectiveMovement } from '../engine/encumbrance';
import { mountMovement } from './mount';

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });

/** Un combat enc-mutants à `n` héros ; `vivants` ennemis en jeu, les autres morts. */
function combat(n: number, vivants = 1): { heros: Combatant[]; ennemi: Combatant; ennemis: Combatant[] } {
  const party = Array.from({ length: n }, (_, i) =>
    createHero({ idNeuf: idsDeTest, speciesId: 'humains-reiklander', careerId: 'soldat', label: `H${i}`, seed: i + 1 }));
  banc.setState({ party });
  banc.getState().lancerLaScene(testScene());
  banc.getState().lancerLeCombat('enc-mutants');
  banc.getState().fenetreValider('debutDuRound');
  banc.abandonner();
  const battle = banc.getState().battle!;
  const ennemis = battle.combatants.filter((c) => c.kind === 'ennemi');
  for (const e of ennemis.slice(vivants)) e.dead = true;
  return { heros: battle.combatants.filter((c) => c.kind === 'heros'), ennemi: ennemis[0], ennemis: ennemis.slice(0, vivants) };
}

const aSonTour = (c: Combatant) => {
  const battle = banc.getState().battle!;
  banc.setState({ battle: { ...battle, ...etatDeTourNeuf(), turn: battle.order.indexOf(c.id) } });
};

const cibleDe = (a: ReturnType<typeof chooseEnemyAction>): string | undefined =>
  (a as { targetId?: string }).targetId ?? (a as { thenTargetId?: string }).thenTargetId;

describe('Frénésie : l’IA vise la cible imposée au joueur (LDB 21 l.33, #5050)', () => {
  it('le plus proche par la distance de combat, pas par Manhattan', () => {
    const get = banc.getState;
    const { heros: [a, b], ennemi: e } = combat(2);
    e.pos = { x: 10, y: 10 }; a.pos = { x: 13, y: 13 }; b.pos = { x: 14, y: 10 };
    for (const c of [a, b, e]) c.size = 'moyenne';
    e.weapons = [MELEE];
    e.psychState = [{ type: 'frenesie' }];
    aSonTour(e);
    expect(frenzyTarget(get, reluDans(get, e))?.id).toBe(a.id);
    expect(cibleDe(chooseEnemyAction(buildAiInput(reluDans(get, e), get)))).toBe(a.id);
  });
});

describe('Tir : l’IA passe la porte du tir du joueur, quel que soit le porteur (#5048, #5049)', () => {
  it('un héros en Auto-combat sans munition ne tire pas (LDB 62 l.106)', () => {
    const get = banc.getState;
    const { heros: [h], ennemi: e } = combat(1);
    h.pos = { x: 4, y: 10 }; e.pos = { x: 12, y: 10 };
    const ARC: Weapon = { uid: 'arc1', label: 'Arc', type: 'distance', subType: 'arc', damage: { plusBF: false, flat: 7 }, range: 50, qualities: [] };
    h.weapons = [ARC];
    h.items = (h.items ?? []).filter((i) => i.kind !== 'ammo');
    h.aiControlled = true;
    aSonTour(h);
    expect(firedAttackBlock(get, reluDans(get, h), reluDans(get, e), 'arc1')?.reason).toBe('noammo');
    expect(chooseEnemyAction(buildAiInput(reluDans(get, h), get)).kind).not.toBe('tir');
  });

  const PIECE: Weapon = { uid: 'pc1', label: 'Pièce', type: 'distance', damage: { plusBF: false, flat: 10 }, range: 100, minRangeBand: 'courte', qualities: [] };

  it('un ennemi ne tire pas une pièce à portée minimale à Bout Portant (ADE II 08 l.253)', () => {
    const get = banc.getState;
    const { heros: [h], ennemi: e } = combat(1);
    h.pos = { x: 8, y: 10 }; e.pos = { x: 11, y: 10 };
    e.weapons = [PIECE];
    aSonTour(e);
    expect(firedAttackBlock(get, reluDans(get, e), reluDans(get, h), 'pc1')?.reason).toBe('portee-min');
    expect(chooseEnemyAction(buildAiInput(reluDans(get, e), get)).kind).not.toBe('tir');
  });

  it('le geste d’un ennemi conduit à la main (siège MJ) est refusé par la même porte', () => {
    const get = banc.getState;
    const { heros: [h], ennemi: e } = combat(1);
    h.pos = { x: 8, y: 10 }; e.pos = { x: 11, y: 10 };
    e.weapons = [PIECE];
    aSonTour(e);
    expect(hoverTargeting(get, reluDans(get, e), reluDans(get, h))).toMatchObject({ kind: 'invalid', reason: 'portee-min' });
  });
});

describe('Vol : le budget de Vol se plie aux États, pour l’IA comme pour le joueur (LDB 85 l.428-439, #5045)', () => {
  const volant = (etat?: string) => {
    const get = banc.getState;
    const { heros: [h], ennemi: e } = combat(1);
    e.pos = { x: 18, y: 10 }; h.pos = { x: 3, y: 10 };
    e.weapons = [MELEE]; e.size = 'moyenne';
    e.traits = [...(e.traits ?? []), { id: 'vol', value: 20 }];
    e.conditions = etat ? [{ id: etat, value: 1 }] : [];
    aSonTour(e);
    const ee = reluDans(get, e);
    return { ee, input: buildAiInput(ee, get), joueur: mountMovement(get().battle!, ee) };
  };

  it('libre : 20 m de Vol, soit 10 points de Mouvement, au joueur comme à l’IA', () => {
    const { input, joueur } = volant();
    expect(joueur).toBe(10);
    expect(input).toMatchObject({ movement: 10, flying: true });
  });

  it('Empêtré : ni marche ni vol (LDB 16 l.64)', () => {
    const { input, joueur } = volant('empetre');
    expect(joueur).toBe(0);
    expect(input.movement).toBe(0);
  });

  it('À Terre : pas de vol, la reptation seule (LDB 16 l.35)', () => {
    const { ee, input, joueur } = volant('a-terre');
    expect(joueur).toBe(effectiveMovement(ee));
    expect(input).toMatchObject({ movement: effectiveMovement(ee), flying: false });
  });

  it('Sonné : la moitié du Vol (LDB 16 l.125)', () => {
    const { input, joueur } = volant('sonne');
    expect(joueur).toBe(5);
    expect(input).toMatchObject({ movement: 5, flying: true });
  });
});

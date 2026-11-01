import { describe, it, expect, beforeEach } from 'vitest';
import { chooseEnemyAction, EnemyTurnInput, type CastableSpell } from './monde/ai';
import { emptyScene } from './monde/scene';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { aiAvailableFreeAttack } from './combatFlow';
import { aiMaybeFrenzy } from './combat/turnHooks';
import { isFrenzied } from '../engine/psychology';
import { createHero } from '../engine/character';
import { testScene } from '../scenes/test-fixture';
import type { Combatant, Weapon } from '../engine/types';
import type { SpellData } from '../data';
import { blessuresDeBase, blessuresSurLeProfil } from '../engine/combattantDeTest.testkit';
import { actorIn } from './monde/combatants';

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });

const MELEE: Weapon = { label: 'Épée', type: 'melee', damage: { plusBF: true, flat: 4 }, qualities: [] };

function mk(id: string, kind: 'hero' | 'enemy', pos: { x: number; y: number }, opts: Partial<Combatant> = {}): Combatant {
  return blessuresSurLeProfil({
    id, label: id, kind, pos,
    wounds: blessuresDeBase(10),
    weapons: [MELEE],
    characteristics: {} as never,
    advantage: 0, conditions: [], armour: {} as never,
    skills: [], talents: [], movement: 4,
    ...opts,
  }) as Combatant;
}

/** Invocation alliée RÉSOLUE (shape 'self', op summon sur 'caster'). */
function summonSpell(): CastableSpell {
  const data = { id: 'invoc', label: 'Invocation', ecole: 'sort', subType: null, family: 'arcane', cn: 0, range: null, target: null, duration: null, desc: '', source: { book: 'LDB', page: 0 }, effects: { kind: 'do', effect: { type: 'ops', on: 'caster', ops: [{ op: 'summon', ref: 'loup', count: 1, allyOfCaster: true }] } } } as unknown as SpellData;
  return { id: 'invoc', data, cn: 0, range: 0, shape: 'self', landProb: 1, focusState: 'none', active: false };
}

const scene = emptyScene('scene-test', 12, 12);
function input(enemy: Combatant, heroes: Combatant[], extra: Partial<EnemyTurnInput> = {}): EnemyTurnInput {
  return { enemy, heroes, scene, blocked: new Set(heroes.map((h) => `${h.pos!.x},${h.pos!.y}`)), movement: enemy.movement, spells: [], ...extra };
}

describe('Frénésie IA — cible la plus proche (chooseEnemyAction, pur, LDB 21 l.33)', () => {
  it('frenzied : vise le plus PROCHE en Ligne de Vue (pas le plus faible distant)', () => {
    const e = mk('e', 'enemy', { x: 5, y: 5 }, { psychState: [{ type: 'frenesie' }], movement: 4 });
    const near = mk('near', 'hero', { x: 5, y: 6 }, { wounds: blessuresDeBase(10) }); // proche, costaud
    const far = mk('far', 'hero', { x: 5, y: 9 }, { wounds: blessuresDeBase(10, 2) }); // faible, atteignable MAIS plus loin
    const action = chooseEnemyAction(input(e, [near, far]));
    const tid = (action as { targetId?: string; thenTargetId?: string }).targetId ?? (action as { thenTargetId?: string }).thenTargetId;
    expect(tid).toBe('near');
  });

  it('non frenzied : conserve le ciblage du plus faible (régression)', () => {
    const e = mk('e', 'enemy', { x: 5, y: 5 });
    const near = mk('near', 'hero', { x: 5, y: 6 }, { wounds: blessuresDeBase(10) });
    const far = mk('far', 'hero', { x: 5, y: 7 }, { wounds: blessuresDeBase(10, 2) }); // faible, atteignable
    const action = chooseEnemyAction(input(e, [near, far]));
    const tid = (action as { targetId?: string; thenTargetId?: string }).targetId ?? (action as { thenTargetId?: string }).thenTargetId;
    expect(tid).toBe('far');
  });
});

describe('Frénésie IA — ORDRE (report tant qu’un sort prime, Couche 3)', () => {
  // PRÉDICAT du report (aiWouldPrepareSpell = action ∈ {cast,castArea,focus}) au niveau PUR : pas encore
  // frénétique (le peek tourne AVANT l'entrée), une invocation jouable + héros loin → l'IA PRÉPARE le sort
  // (cast), donc la Frénésie est différée. Sans sort → mêlée/approche (pas de report).
  it('un sort jouable (invocation, héros loin) → la meilleure action est `cast` (→ report de Frénésie)', () => {
    const e = mk('e', 'enemy', { x: 5, y: 5 }, { weapons: [] }); // état non frénétique à ce stade
    const h = mk('h', 'hero', { x: 5, y: 11 }); // loin → ni mêlée ni bonne approche
    expect(chooseEnemyAction(input(e, [h], { spells: [summonSpell()] })).kind).toBe('cast');
  });

  it('sans sort jouable → la meilleure action n’est PAS un sort (pas de report)', () => {
    const e = mk('e', 'enemy', { x: 5, y: 5 }, { weapons: [MELEE] });
    const h = mk('h', 'hero', { x: 5, y: 11 });
    expect(['cast', 'castArea', 'focus']).not.toContain(chooseEnemyAction(input(e, [h])).kind);
  });
});

describe('Frénésie IA — entrée auto & attaque libre', () => {
  beforeEach(() => {
    banc.setState({ battle: null });
  });

  function setupBattle() {
    const hero = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', seed: 1 });
    banc.setState({ party: [hero] });
    banc.getState().startScene(testScene());
    banc.getState().startCombat('enc-mutants');
    banc.getState().confirmRoundStart();
    banc.abandonner();
    const b = banc.getState().battle!;
    const H = b.combatants.find((c) => c.kind === 'hero')!;
    const E = b.combatants.find((c) => c.kind === 'enemy')!;
    b.combatants.filter((c) => c.kind === 'enemy' && c.id !== E.id).forEach((e) => (e.dead = true));
    H.pos = { x: 10, y: 10 };
    E.pos = { x: 11, y: 10 }; // adjacent + Ligne de Vue dégagée
    banc.setState({ battle: { ...b } });
    return { H, E };
  }

  it('aiMaybeFrenzy : ennemi capable + adversaire en LdV → entre en Frénésie (Test de FM réussi)', () => {
    banc.getState().seedRng(5);
    const { E } = setupBattle();
    E.traits = [{ id: 'frenesie' }];
    E.characteristics['force-mentale'] = 99; // réussite quasi certaine
    aiMaybeFrenzy(banc.getState, banc.setState, E);
    expect(isFrenzied(banc.getState().battle!.combatants.find((c) => c.id === E.id)!)).toBe(true);
  });

  it('aiMaybeFrenzy : aucun adversaire vivant en LdV → pas de Frénésie', () => {
    const { H, E } = setupBattle();
    E.traits = [{ id: 'frenesie' }];
    E.characteristics['force-mentale'] = 99;
    (H as Combatant).dead = true;
    aiMaybeFrenzy(banc.getState, banc.setState, E);
    expect(isFrenzied(banc.getState().battle!.combatants.find((c) => c.id === E.id)!)).toBe(false);
  });

  it('aiMaybeFrenzy : ennemi NON capable → pas de Frénésie', () => {
    const { E } = setupBattle();
    E.characteristics['force-mentale'] = 99; // mais aucun trait/talent « Frénésie »
    aiMaybeFrenzy(banc.getState, banc.setState, E);
    expect(isFrenzied(banc.getState().battle!.combatants.find((c) => c.id === E.id)!)).toBe(false);
  });

  // ORDRE (Couche 3) : le report passe par le noyau (`aiWouldCast`). Un ennemi frénésie-CAPABLE dont la
  // meilleure action est un SORT (ici un Projectile sur le héros, seule action d'un lanceur DÉSARMÉ) ne
  // frénésie PAS — il lance son sort d'abord (l'Unicité retirera les sorts un à un avant de charger).
  it('aiMaybeFrenzy : un sort jouable prime (aiWouldCast vrai) → REPORTE la Frénésie', () => {
    banc.getState().seedRng(5);
    const { H, E } = setupBattle();
    E.traits = [{ id: 'frenesie' }];
    E.characteristics['force-mentale'] = 99; E.characteristics.intelligence = 60; // FM → entrerait sinon en Frénésie ; Int → incantation fiable
    E.skills = [{ id: 'langue', spec: 'magick', advances: 40, characteristic: 'intelligence' } as never];
    E.spells = ['flechette']; // Projectile magique (NI 0 → fiable), offensif
    E.weapons = []; // DÉSARMÉ → aucune mêlée concurrente ; le sort est la seule action
    E.pos = { x: 10, y: 7 }; H.pos = { x: 10, y: 10 }; // héros en LdV, à 3 cases (en portée du sort, hors mêlée)
    banc.setState({ battle: { ...banc.getState().battle! } });
    expect(banc.getState().aiWouldCast(E.id)).toBe(true); // sa meilleure action est un sort
    aiMaybeFrenzy(banc.getState, banc.setState, actorIn(banc.getState(), E.id)!); // FM 99 : maximum des Blessures déplacé, l'acteur se relit
    expect(isFrenzied(banc.getState().battle!.combatants.find((c) => c.id === E.id)!)).toBe(false); // reporté
  });

  it('aiMaybeFrenzy : AUCUN sort jouable (aiWouldCast faux) → entre bien en Frénésie', () => {
    banc.getState().seedRng(5);
    const { E } = setupBattle();
    E.traits = [{ id: 'frenesie' }];
    E.characteristics['force-mentale'] = 99;
    E.spells = []; // rien à préparer
    banc.setState({ battle: { ...banc.getState().battle! } });
    expect(banc.getState().aiWouldCast(E.id)).toBe(false);
    aiMaybeFrenzy(banc.getState, banc.setState, actorIn(banc.getState(), E.id)!); // FM 99 : maximum des Blessures déplacé, l'acteur se relit
    expect(isFrenzied(banc.getState().battle!.combatants.find((c) => c.id === E.id)!)).toBe(true);
  });

  it('aiAvailableFreeAttack : attaque de mêlée LIBRE contre un héros → SA défense s’ouvre, puis l’Action reste intacte', () => {
    banc.getState().seedRng(4);
    const { E, H } = setupBattle();
    (E.psychState ??= []).push({ type: 'frenesie' });
    E.weapons = [MELEE];
    banc.setState({ battle: { ...banc.getState().battle!, acted: false } });
    const logBefore = banc.getState().battle!.log.length;
    aiAvailableFreeAttack(banc.getState, banc.setState, E);
    // #989 : la défense du héros est SURFACÉE — l'attaque gratuite ne la roule plus en silence.
    expect(banc.getState().pendingDefense?.defenderId).toBe(H.id);
    banc.getState().defenseRoll();
    banc.getState().defenseConfirm();
    const st = banc.getState();
    expect(st.battle!.log.length).toBeGreaterThan(logBefore); // une attaque a bien été résolue
    expect(st.battle!.acted).toBe(false); // gratuite : l'Action n'est pas consommée
  });

  it('aiAvailableFreeAttack : aucun adversaire adjacent → no-op', () => {
    const { E } = setupBattle();
    (E.psychState ??= []).push({ type: 'frenesie' });
    E.pos = { x: 1, y: 1 }; // loin du héros (10,10)
    E.weapons = [MELEE];
    banc.setState({ battle: { ...banc.getState().battle!, acted: false } });
    const logBefore = banc.getState().battle!.log.length;
    aiAvailableFreeAttack(banc.getState, banc.setState, E);
    expect(banc.getState().battle!.log.length).toBe(logBefore);
  });
});

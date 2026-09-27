// @vitest-environment jsdom
/**
 * #1004 — un verdict que l'OPPOSITION peut encore invalider ne s'énonce pas comme appliqué.
 *
 * Deux surfaces, même défaut :
 *  - modale d'ATTAQUE : quand une fenêtre de Défense va s'interposer (`surfacedDefensePending`), le
 *    `res` affiché est une résolution `defense:'none'` contre PERSONNE (touche + Dégâts CHIFFRÉS) →
 *    remplacée par l'attente neutre « En attente de la Défense de {cible}. » (libellé validé
 *    utilisateur 2026-07-31) ;
 *  - modale d'INCANTATION opposée : la ligne de résolution du lanceur (« … = 8 Blessures ») se tait
 *    quand le Contre-sort DISSIPE (ou reste à jouer).
 *
 * Le prédicat d'attente est CELUI du moteur (`surfacedDefensePending`, consommé aussi par
 * `openSurfacedDefense`) : le cas DIVERGENT forgé ici (défenseur surfacé mais Surpris → il ne se
 * défendra pas) échoue dès qu'on re-dérive le prédicat dans l'UI à partir de `defenseSurfaced` seul.
 */
import { describe, it, expect, beforeEach, afterEach, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { useGame, type BattleState } from '../state/store';
import { openAttackCascade, surfacedDefensePending, attackWeaponOf, firedWeapon } from '../state/combatFlow';
import { seedBattleRng } from '../state/battleRng';
import { addCondition, COND } from '../engine/conditions';
import { testScene } from '../scenes/test-fixture';
import { useAttackJetProps } from './jetProps/useAttackJetProps';
import { RollShell } from './RollShell';
import { CastModal } from './CastModal';
import type { Combatant, Weapon } from '../engine/types';

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

const chars = { 'capacite-de-combat': 60, 'capacite-de-tir': 50, force: 45, endurance: 35, initiative: 30, agilite: 40, dexterite: 30, intelligence: 30, 'force-mentale': 40, sociabilite: 30 };
const mk = (id: string, kind: 'hero' | 'enemy', pos: { x: number; y: number }, weapons: Weapon[] = []): Combatant =>
  ({ id, name: id, label: id, kind, characteristics: { ...chars }, conditions: [], traumas: [], engagedWith: [], skills: [], talents: [], items: [],
     weapons, advantage: 0, size: 'moyenne', pos, wounds: { current: 18, max: 18 }, resilience: 2, fortune: 2,
     species: 'humains-reiklander', bodyShape: 'humanoide', movement: 4,
     armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 } } as unknown as Combatant);
const sword: Weapon = { name: 'Épée', label: 'Épée', type: 'melee', damage: { plusBF: true, flat: 0, bare: true }, uid: 'sw', qualities: [] } as unknown as Weapon;
const bow: Weapon = { name: 'Arc', label: 'Arc', type: 'ranged', damage: { plusBF: false, flat: 4 }, range: 60, qualities: [], uid: 'bw' } as unknown as Weapon;
/** Arme de JET à portée FAIBLE : à 1 case (2 m) la cible n'est PLUS à Bout Portant → `rangedDefenseModes`
 *  vide → aucun mode de défense RAW (LDB 13 l.125). Sert la divergence d'ARME de la SONDE2. */
const dart: Weapon = { name: 'Fléchette', label: 'Fléchette', type: 'ranged', damage: { plusBF: false, flat: 2 }, range: 6, qualities: [], uid: 'dt' } as unknown as Weapon;

/** Duel MJ : l'ENNEMI est conduit à la main (siège MJ → attaque PILOTÉE, modale d'attaque) et le
 *  héros défenseur est SURFACÉ (`defenseSurfaced`) — quadrant exact du défaut. */
function duel(opts?: { gmSeat?: number; heroAi?: boolean; surpris?: boolean; atkWeapons?: Weapon[] }) {
  const enemy = mk('Rôdeur', 'enemy', { x: 1, y: 0 }, opts?.atkWeapons ?? [sword]);
  const hero = mk('Grunni', 'hero', { x: 0, y: 0 }, [sword]);
  if (opts?.heroAi) hero.aiControlled = true;
  if (opts?.surpris) addCondition(hero, COND.surpris);
  const battle: BattleState = {
    combatants: [enemy, hero], order: [enemy.id, hero.id], baseOrder: [enemy.id, hero.id],
    turn: 0, round: 1, action: null, selectedSpellId: null, reachable: new Map(),
    movementUsed: 0, movedPreAction: false, acted: false, log: [], over: null,
  } as unknown as BattleState;
  useGame.setState({
    battle, mode: 'battle', scene: testScene(), party: [hero],
    pendingDefense: null, pendingAttack: null, pendingCascade: null, pendingCast: null,
    pendingCastOpposition: null, pendingCounterspell: null,
    net: { ...useGame.getState().net, mode: 'local', mySeat: 0, gmSeat: opts?.gmSeat ?? 0, ownership: {} },
  });
  return { enemy, hero };
}

/** Joue la déclaration + le jet d'attaque PILOTÉ de l'ennemi sur le héros, à la graine `seed`.
 *  `pa` complète la déclaration (Tir rapide en interruption, manœuvre à arme naturelle…). */
function playAttack(seed: number, opts?: Parameters<typeof duel>[0], pa?: Record<string, unknown>) {
  const { enemy, hero } = duel(opts);
  seedBattleRng(seed);
  const g = useGame.getState;
  openAttackCascade(g, useGame.setState, { attackerId: enemy.id, targetId: hero.id, location: null, result: null, weaponUid: opts?.atkWeapons ? opts.atkWeapons[0]?.uid : 'sw', ...pa } as never, 'Attaque', 'action/attack');
  g().attackRoll();
  return { enemy, hero, pa: g().pendingAttack! };
}

/** Graine DÉTERMINISTE : une attaque qui TOUCHE et fait perdre des Blessures — sans elle, l'absence
 *  du faux verdict chiffré ne prouverait rien (une ligne de Dégâts inexistante est absente d'office). */
let HIT_SEED = 0;
for (let sd = 1; sd <= 400 && !HIT_SEED; sd++) {
  const { pa } = playAttack(sd);
  if (pa.result?.hit && (pa.result.woundsLost ?? 0) > 0) HIT_SEED = sd;
}

/** Modale d'attaque montée POUR DE VRAI (le hook + sa coquille), comme en jeu. */
function AttackModal() {
  const props = useAttackJetProps();
  return props ? <RollShell {...props} /> : null;
}

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  useGame.setState({ pendingAttack: null, pendingDefense: null, pendingCascade: null, pendingCast: null,
    pendingCastOpposition: null, pendingCounterspell: null, battle: null, party: [] });
});

describe('#1004 sonde d’état — le faux verdict EXISTE avant d’être masqué', () => {
  it('défenseur surfacé : `surfacedDefensePending` vrai ALORS QUE `pa.result.hit` et les Dégâts sont déjà calculés', () => {
    expect(HIT_SEED, 'une graine de touche chiffrée existe').toBeGreaterThan(0);
    const { enemy, hero, pa } = playAttack(HIT_SEED);
    expect(pa.result!.defenderDetail, 'aucune défense roulée au jet d’attaque (le défenseur est surfacé)').toBeUndefined();
    expect(pa.result!.hit, 'la résolution `defense:’none’` a déjà tranché… contre PERSONNE').toBe(true);
    expect(pa.result!.woundsLost, 'et elle a déjà chiffré des Blessures').toBeGreaterThan(0);
    expect(pa.result!.log, 'le journal du moteur porte bien ce verdict chiffré').toMatch(/Blessure/);
    expect(surfacedDefensePending(useGame.getState(), enemy, hero, enemy.weapons[0], pa),
      'une fenêtre de Défense va pourtant s’interposer').toBe(true);
  });
});

describe('#1004 modale d’attaque — attente neutre au lieu du verdict', () => {
  it('défenseur SURFACÉ : `res.log` absent, « En attente de la Défense de {cible}. » présent', () => {
    const { pa } = playAttack(HIT_SEED);
    act(() => { root.render(<AttackModal />); });
    expect(host.textContent, 'le verdict chiffré serait invalidé par la Défense qui suit').not.toContain(pa.result!.log);
    expect(host.textContent, 'ni le mot Blessures, ni « touche »').not.toMatch(/Blessure|touche/);
    expect(host.textContent).toContain('En attente de la Défense de Grunni.');
  });

  it('l’attente occupe SA zone (note au ton `attente`, bloc aux tokens du cadre d’issue), jamais la note de pied', () => {
    playAttack(HIT_SEED);
    act(() => { root.render(<AttackModal />); });
    const zone = host.querySelector('.rm-note[data-ton="attente"]');
    expect(zone, 'le libellé validé à l’écran a sa zone propre').not.toBeNull();
    expect(zone!.textContent).toContain('En attente de la Défense de Grunni.');
    expect(host.querySelector('.modal-log'), 'pas la note atténuée de pied de modale').toBeNull();
    // Le rendu de cette zone est celui d'un BLOC (fond, respiration, texte aligné à gauche) — le
    // vérifier ICI garde le ton d'être vidé de sa matière ailleurs.
    const css = readFileSync(join(process.cwd(), 'src/ui/styles/components.css'), 'utf8');
    const rule = css.slice(css.indexOf(".rm-note[data-ton='attente'] {"));
    expect(rule.slice(0, rule.indexOf('}'))).toMatch(/background:[^;]+;[\s\S]*text-align: left/);
  });

  it('NON-RÉGRESSION — défenseur non surfacé (héros piloté-IA) : verdict IMMÉDIAT inchangé, aucune attente', () => {
    const { pa } = playAttack(HIT_SEED, { heroAi: true });
    expect(pa.result!.defenderDetail, 'le héros piloté-IA oppose sa défense INLINE').toBeTruthy();
    act(() => { root.render(<AttackModal />); });
    expect(host.textContent).toContain(pa.result!.log);
    expect(host.textContent).not.toContain('En attente de la Défense');
  });

  it('SOURCE UNIQUE — cas DIVERGENT : défenseur surfacé mais SURPRIS (il ne se défendra pas) → verdict immédiat', () => {
    // `defenseSurfaced` est VRAI ici ; seul le prédicat COMPLET du moteur (`cannotDefend`, LDB 16
    // l.135) sait qu'aucune fenêtre ne s'ouvrira. Une re-dérivation UI sur `defenseSurfaced` seul
    // afficherait une attente qui ne viendra jamais.
    const { enemy, hero, pa } = playAttack(HIT_SEED, { surpris: true });
    expect(surfacedDefensePending(useGame.getState(), enemy, hero, enemy.weapons[0], pa),
      'aucune fenêtre : le Surpris ne se défend pas').toBe(false);
    act(() => { root.render(<AttackModal />); });
    expect(host.textContent, 'le verdict est FINAL : il s’affiche').toContain(pa.result!.log);
    expect(host.textContent).not.toContain('En attente de la Défense');
  });
});

describe('#1004 instance adjacente — sort DISSIPÉ : la ligne de Dégâts ne s’affiche pas', () => {
  const DMG_LOG = 'Rôdeur lance Fléchette sur Grunni : 11 dégâts − 3 (BE+PA) = 8 Blessures';
  const MISSILE = { cast: true, hit: true, roll: 20, target: 50, sl: 5, isCritical: false, isFumble: false, log: DMG_LOG };

  /** Incantation ENNEMIE (missile touché) opposée par le Contre-sort du héros, dissipée ou non. */
  function castVsCounter(dispelled: boolean) {
    const { hero } = duel();
    useGame.setState({
      pendingCast: { casterId: 'Rôdeur', targetId: hero.id, spellId: 'drain', missile: true, focused: false, result: { ...MISSILE } } as never,
      pendingCounterspell: { participants: [{ id: hero.id, interactive: true,
        result: { dispelled, counter: { roll: 11, target: 50, sl: 4, success: true }, casterNetSL: dispelled ? -1 : 2, log: '' } }] } as never,
    });
    act(() => { root.render(<CastModal />); });
  }

  it('Contre-sort RÉUSSI : « Dissipé ! » est le verdict — aucune ligne « = 8 Blessures »', () => {
    castVsCounter(true);
    expect(host.textContent, 'la rangée du Contre-sort porte bien le verdict').toContain('Dissipé !');
    expect(host.textContent, 'le calcul d’un résultat INVALIDÉ ne s’affiche pas comme appliqué').not.toContain(DMG_LOG);
    expect(host.textContent).not.toContain('Blessures');
  });

  it('TÉMOIN — Contre-sort RATÉ : la même ligne de Dégâts s’affiche (le gate ne mange pas le cas valide)', () => {
    castVsCounter(false);
    expect(host.textContent).not.toContain('Dissipé !');
    expect(host.textContent, 'le sort passe : son résultat s’énonce').toContain(DMG_LOG);
  });

  it('Contre-sort PAS ENCORE JOUÉ (jet de réponse en attente) : la ligne de Dégâts reste tue', () => {
    const { hero } = duel();
    useGame.setState({
      pendingCast: { casterId: 'Rôdeur', targetId: hero.id, spellId: 'drain', missile: true, focused: false, result: { ...MISSILE } } as never,
      pendingCounterspell: { participants: [{ id: hero.id, interactive: true, result: null }] } as never,
    });
    act(() => { root.render(<CastModal />); });
    expect(host.textContent).not.toContain(DMG_LOG);
  });

  /** T3 — l'autre opposition : une CIBLE qui RÉSISTE annule le sort tout autant qu'une Dissipation. */
  it('OPPOSITION de cible GAGNÉE (« Résiste ! ») : la ligne de Dégâts du lanceur ne s’affiche pas non plus', () => {
    const { hero } = duel();
    useGame.setState({
      pendingCast: { casterId: 'Rôdeur', targetId: hero.id, spellId: 'drain', missile: true, focused: false, result: { ...MISSILE } } as never,
      pendingCastOpposition: { kind: 'resist', char: 'force-mentale', menace: 'magie',
        participants: [{ id: hero.id, interactive: true, result: { resisted: true, margin: 2, oppose: { roll: 12, target: 40, sl: 2, success: true } } }] } as never,
    });
    act(() => { root.render(<CastModal />); });
    expect(host.textContent, 'la rangée d’opposition porte le verdict').toContain('Résiste !');
    expect(host.textContent, 'le sort est annulé pour cette cible : aucun chiffre de Dégâts').not.toContain(DMG_LOG);
  });

  it('TÉMOIN — opposition de cible PERDUE : la ligne de Dégâts s’affiche', () => {
    const { hero } = duel();
    useGame.setState({
      pendingCast: { casterId: 'Rôdeur', targetId: hero.id, spellId: 'drain', missile: true, focused: false, result: { ...MISSILE } } as never,
      pendingCastOpposition: { kind: 'resist', char: 'force-mentale', menace: 'magie',
        participants: [{ id: hero.id, interactive: true, result: { resisted: false, margin: -3, oppose: { roll: 72, target: 40, sl: -3, success: false } } }] } as never,
    });
    act(() => { root.render(<CastModal />); });
    expect(host.textContent).toContain(DMG_LOG);
  });

  /**
   * F1 — GRAIN du gate. La Résistance n'annule le Sort que pour SA cible ; la ligne de résolution,
   * elle, est mono-cible (`pc.targetId`). Un gate posé sur « au moins un participant a résisté »
   * effacerait le verdict VRAI de la cible affichée dès qu'une AUTRE cible résiste.
   */
  const multiOpposition = (grunniResists: boolean) => {
    const { hero } = duel();
    const autre = mk('Autre', 'hero', { x: 0, y: 1 }, [sword]);
    const battle = useGame.getState().battle!;
    useGame.setState({
      battle: { ...battle, combatants: [...battle.combatants, autre], order: [...battle.order, autre.id] } as never,
      pendingCast: { casterId: 'Rôdeur', targetId: hero.id, spellId: 'drain', missile: true, focused: false, result: { ...MISSILE } } as never,
      pendingCastOpposition: { kind: 'resist', char: 'force-mentale', menace: 'magie', participants: [
        { id: hero.id, interactive: true, result: { resisted: grunniResists, margin: grunniResists ? 3 : -3, oppose: { roll: grunniResists ? 12 : 72, target: 40, sl: grunniResists ? 3 : -3, success: grunniResists } } },
        { id: autre.id, interactive: true, result: { resisted: true, margin: 4, oppose: { roll: 8, target: 40, sl: 4, success: true } } },
      ] } as never,
    });
    act(() => { root.render(<CastModal />); });
  };

  it('MULTI-CIBLES — une AUTRE cible résiste : le verdict de la cible AFFICHÉE (Grunni, qui subit) reste dit', () => {
    multiOpposition(false);
    expect(host.textContent, 'la fixture DOIT porter une Résistance à ne PAS propager').toContain('Résiste !');
    expect(host.textContent, 'la ligne concerne Grunni, qui n’a rien résisté : la taire cacherait une information VRAIE').toContain(DMG_LOG);
  });

  it('MULTI-CIBLES — c’est la cible AFFICHÉE qui résiste : sa ligne se tait (le grain n’est pas un opt-out)', () => {
    multiOpposition(true);
    expect(host.textContent).not.toContain(DMG_LOG);
  });
});

/**
 * T1 — ATTENTE SANS FENÊTRE. `attackConfirm` traite le Tir rapide en INTERRUPTION (LDB 10) dans une
 * branche qui APPLIQUE le tir sans passer par la couture de Défense (#997) : annoncer une attente y
 * serait un mensonge d'écran. Le prédicat porte donc l'exclusion, et le TÉMOIN (même fixture, sans
 * `interrupt`) prouve que la fenêtre s'ouvre pour de vrai autrement — sans lui, un `false` constant
 * passerait le test.
 */
describe('#1004 T1 — Tir rapide en interruption : verdict immédiat, aucune fenêtre', () => {
  const RANGED = { atkWeapons: [bow] };

  it('TÉMOIN (tir NORMAL, Bout Portant) : attente affichée ET fenêtre de Défense réellement ouverte', () => {
    const { enemy, hero, pa } = playAttack(3, { ...RANGED });
    expect(surfacedDefensePending(useGame.getState(), enemy, hero, attackWeaponOf(useGame.getState().battle!, enemy, hero, pa), pa)).toBe(true);
    act(() => { root.render(<AttackModal />); });
    expect(host.textContent).toContain('En attente de la Défense de Grunni.');
    act(() => { useGame.getState().attackConfirm(); });
    expect(useGame.getState().pendingDefense, 'la fenêtre annoncée s’ouvre').toBeTruthy();
  });

  it('INTERRUPTION : aucune attente, verdict immédiat — et `attackConfirm` n’ouvre AUCUNE fenêtre', () => {
    const { enemy, hero, pa } = playAttack(3, { ...RANGED }, { interrupt: true });
    expect(surfacedDefensePending(useGame.getState(), enemy, hero, attackWeaponOf(useGame.getState().battle!, enemy, hero, pa), pa),
      'ce chemin d’application ne passe par aucune couture de Défense (#997)').toBe(false);
    act(() => { root.render(<AttackModal />); });
    expect(host.textContent, 'annoncer une Défense qui ne viendra jamais = écran menteur').not.toContain('En attente de la Défense');
    expect(host.textContent).toContain(pa.result!.log);
    act(() => { useGame.getState().attackConfirm(); });
    expect(useGame.getState().pendingDefense, 'et de fait, aucune fenêtre ne s’ouvre').toBeNull();
  });
});

/**
 * T2/SONDE2 (#1026) — FENÊTRE SANS ATTENTE. L'arme employée se résolvait en DEUX endroits : l'écran
 * lisait `firedWeapon` seul (l'arme de JET équipée), l'application `freeNatural ?? firedWeapon`
 * (l'arme NATURELLE de la manœuvre). Sur cette fixture les deux rendent des verdicts d'interposition
 * OPPOSÉS — l'écran annonçait le verdict chiffré, puis la fenêtre s'ouvrait et l'invalidait.
 */
describe('#1026 SONDE2 — une seule vérité d’ARME entre l’écran et l’application', () => {
  const NATURAL = { atkWeapons: [dart] };
  const PA = { freeKind: 'morsure', weaponUid: undefined };

  it('divergence FORGÉE : les deux résolutions d’arme rendaient des verdicts opposés', () => {
    const { enemy, hero, pa } = playAttack(3, { ...NATURAL }, PA);
    const battle = useGame.getState().battle!;
    const wShared = attackWeaponOf(battle, enemy, hero, pa);
    const wLegacy = firedWeapon(enemy, hero, pa.weaponUid, battle.combatants);
    expect([wShared.type, wLegacy.type], 'la fixture DOIT opposer arme naturelle et arme de jet').toEqual(['melee', 'ranged']);
    expect(surfacedDefensePending(useGame.getState(), enemy, hero, wShared, pa), 'Morsure au contact : une fenêtre s’ouvre').toBe(true);
    expect(surfacedDefensePending(useGame.getState(), enemy, hero, wLegacy, pa), 'Fléchette hors Bout Portant : aucun mode RAW').toBe(false);
  });

  it('l’écran et l’application s’accordent : attente affichée ET fenêtre réellement ouverte', () => {
    const { pa } = playAttack(3, { ...NATURAL }, PA);
    act(() => { root.render(<AttackModal />); });
    expect(host.textContent, 'l’écran doit suivre l’arme RÉELLEMENT employée').toContain('En attente de la Défense de Grunni.');
    expect(host.textContent).not.toContain(pa.result!.log);
    act(() => { useGame.getState().attackConfirm(); });
    expect(useGame.getState().pendingDefense, 'la fenêtre annoncée s’ouvre bel et bien').toBeTruthy();
  });
});

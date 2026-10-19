// @vitest-environment jsdom
/**
 * Défense réactive — conformité Z1 du contrat d'affichage d'un jet (#1143, `docs/charte-ui.md` §Z0-Z15).
 * La fenêtre est montée ENTIÈRE (`RollShell` via le hook, comme la rend `CascadeModal`) : Z1 est le
 * sous-titre « Acteur — Action (Compétence) » composé par `composeRollLabel`, porté par l'acteur DU JET
 * (le défenseur) ; l'identité de l'attaquant reste à Z3 (`VsHeader`, `.rm-vs`). Le sous-titre SUIT le
 * mode choisi : Parade = Test de Corps à corps, Esquive = Compétence Esquive (`LDB 13 l.161-167`).
 */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import { setRule, resetRule } from '../../engine/policy';
import { useGame, type BattleState } from '../../state/store';
import { openAttackCascade, aiCreatureFreeAttacks } from '../../state/combatFlow';
import { seedBattleRng } from '../../state/battleRng';
import { testScene } from '../../scenes/test-fixture';
import type { Combatant, Weapon } from '../../engine/types';
import { RollShell } from '../RollShell';
import { useDefenseJetProps } from './useDefenseJetProps';
import { ANONYMES } from '../RollLine';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const chars = { 'capacite-de-combat': 45, 'capacite-de-tir': 50, force: 35, endurance: 35, initiative: 30, agilite: 40, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 };
const sword: Weapon = { name: 'Épée', label: 'Épée', type: 'melee', damage: { plusBF: true, flat: 0, bare: true }, uid: 'sw', subType: 'base', qualities: [] } as unknown as Weapon;
const mk = (id: string, label: string, kind: 'hero' | 'enemy', pos: { x: number; y: number }): Combatant =>
  ({ id, name: label, label, kind, characteristics: { ...chars }, conditions: [], engagedWith: [], skills: [], talents: [],
     weapons: [sword], advantage: 0, size: 'moyenne', pos, wounds: { current: 18, max: 18 },
     armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 }, movement: 4, resilience: 1 } as unknown as Combatant);

function Probe() {
  const props = useDefenseJetProps();
  return props ? <RollShell {...props} /> : null;
}

let root: Root | null = null;
let host: HTMLDivElement | null = null;
afterEach(() => {
  if (root) act(() => root!.unmount());
  host?.remove();
  root = null; host = null;
});

/** Ouvre la fenêtre de Défense d'un héros attaqué en mêlée, et la monte.
 *  `defenderWeapon` remplace l'arme (donc l'arme de parade par défaut) du défenseur ; `prepare` complète
 *  la fiche du héros et le combat avant l'attaque ; `atkDie` fixe le dé de l'attaque. */
function openDefense(defenderWeapon?: Weapon, prepare?: (hero: Combatant, battle: BattleState) => void, atkDie?: number): HTMLDivElement {
  const enemy = mk('e', 'Rat géant', 'enemy', { x: 1, y: 0 });
  const hero = mk('h', 'Gunnar', 'hero', { x: 0, y: 0 });
  if (defenderWeapon) hero.weapons = [defenderWeapon];
  const battle: BattleState = {
    combatants: [enemy, hero], order: [enemy.id, hero.id], baseOrder: [enemy.id, hero.id],
    turn: 0, round: 1, action: null, selectedSpellId: null, reachable: new Map(),
    movementUsed: 0, movedPreAction: false, acted: false, log: [], over: null,
  } as unknown as BattleState;
  prepare?.(hero, battle);
  useGame.setState({
    battle, mode: 'battle', scene: testScene(), pendingDefense: null, pendingAttack: null, pendingCascade: null, codexOverlay: null,
    net: { ...useGame.getState().net, mode: 'local', mySeat: 0, gmSeat: 0, ownership: {} },
  });
  const g = useGame.getState;
  seedBattleRng(3);
  openAttackCascade(g, useGame.setState, { attackerId: enemy.id, targetId: hero.id, location: null, result: null, weaponUid: 'sw' }, 'Attaque', 'action/attack');
  g().attackRoll();
  if (atkDie != null) g().attackSetForcedRoll(atkDie);
  g().attackConfirm();
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  act(() => root!.render(<Probe />));
  return host;
}

/** Ouvre la fenêtre de Défense d'un héros contre une attaque GRATUITE de créature (Morsure, LDB 85
 *  l.237) — chemin de la MACHINE : la frappe entre par `aiCreatureFreeAttacks`, et c'est elle qui dit
 *  à la fenêtre ce qu'elle annonce. Le héros encaisse sans tomber (la fin de combat clorait tout). */
function openBiteDefense(): HTMLDivElement {
  const enemy = mk('e', 'Rat géant', 'enemy', { x: 1, y: 0 });
  const hero = mk('h', 'Gunnar', 'hero', { x: 0, y: 0 });
  hero.wounds = { current: 200, max: 200 } as Combatant['wounds'];
  enemy.traits = [{ id: 'morsure', value: 14 }];
  enemy.advantage = 1;
  const battle: BattleState = {
    combatants: [enemy, hero], order: [enemy.id, hero.id], baseOrder: [enemy.id, hero.id],
    turn: 0, round: 1, action: null, selectedSpellId: null, reachable: new Map(),
    movementUsed: 0, movedPreAction: false, acted: false, log: [], over: null,
  } as unknown as BattleState;
  useGame.setState({
    battle, mode: 'battle', scene: testScene(), pendingDefense: null, pendingAttack: null, pendingCascade: null,
    net: { ...useGame.getState().net, mode: 'local', mySeat: 0, gmSeat: 0, ownership: {} },
  });
  seedBattleRng(3);
  aiCreatureFreeAttacks(useGame.getState, useGame.setState, enemy);
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  act(() => root!.render(<Probe />));
  return host;
}

const subtitle = () => host!.querySelector('.rm-subtitle')?.textContent;
/** Libellé de la rangée TÉMOIN (l'attaque figée), rangée [0] du panneau. */
const attackRowText = () => host!.querySelectorAll('.rr-row')[0]?.textContent ?? '';

describe('Défense — Z1 « Acteur — Action (Compétence) »', () => {
  it('Parade : le sous-titre nomme le DÉFENSEUR et sa Compétence de parade', () => {
    const view = openDefense();
    expect(useGame.getState().pendingDefense!.mode).toBe('parade');
    expect(view.querySelector('h3')?.textContent).toBe('Défense');
    expect(subtitle()).toBe('Gunnar — Défense (Corps à corps (Base))');
    // Z3 reste le SEUL A→B : le sous-titre ne redit pas l'attaquant.
    expect(view.querySelectorAll('.rm-vs')).toHaveLength(1);
    expect(subtitle()).not.toContain('Rat géant');
  });

  it('Esquive : basculer de mode change la Compétence du sous-titre', () => {
    openDefense();
    act(() => { useGame.getState().defenseSetMode('esquive'); });
    expect(subtitle()).toBe('Gunnar — Défense (Esquive)');
  });

  it('Parade avec une arme à résolution alternative (Bélier) : le sous-titre nomme la CARACTÉRISTIQUE', () => {
    // La base de la parade est celle de `defenseValue` (Force 35 ici, `combatValue` court-circuite CC 45) :
    // le sous-titre doit nommer la même Caractéristique, sinon il annonce un Test qui n'est pas celui joué.
    const belier = { name: 'Bélier', label: 'Bélier', type: 'melee', damage: { plusBF: true, flat: 10 }, uid: 'bl', qualities: [], resolveChar: 'force' } as unknown as Weapon;
    const view = openDefense(belier);
    // Parer d'un Bélier (Force 35) vaut moins qu'esquiver (Agilité 40) : le mode par défaut est l'Esquive,
    // le joueur choisit la parade — c'est ce choix que le sous-titre doit suivre.
    act(() => { useGame.getState().defenseSetMode('parade'); });
    expect(subtitle()).toBe('Gunnar — Défense (Force)');
    expect(view.textContent).not.toContain('Défense (Corps à corps)');
  });
});

/**
 * CE QUE LA FENÊTRE ANNONCE vient de la frappe qui l'a OUVERTE (#1858) — et le siège INVITÉ, qui ne
 * reçoit le pending que par le snapshot coop (JSON pur, `netSnapshot`), rend la MÊME fenêtre.
 */
describe('Défense — l’attaque annoncée, et son voyage jusqu’à l’invité', () => {
  it('Morsure gratuite : la rangée témoin annonce la MORSURE, pas une attaque générique', () => {
    openBiteDefense();
    expect(useGame.getState().pendingDefense!.defenderId).toBe('h');
    expect(attackRowText()).toContain('Morsure');
  });

  for (const [nom, ouvrir] of [['pilotée', openDefense], ['gratuite de la machine', openBiteDefense]] as const) {
    it(`chemin INVITÉ (${nom}) : la fenêtre rendue depuis le pending passé par JSON est la même`, () => {
      ouvrir();
      const attendu = attackRowText();
      const voyage = JSON.parse(JSON.stringify(useGame.getState().pendingDefense));
      act(() => { useGame.setState({ pendingDefense: voyage }); });
      expect(subtitle()).toBe('Gunnar — Défense (Corps à corps (Base))');
      expect(attackRowText()).toBe(attendu);
    });
  }
});

describe('Défense : les modificateurs de la VALEUR sont des lignes NOMMÉES', () => {
  const rangeeDefenseur = () => host!.querySelectorAll('.rr-row')[1]?.textContent ?? '';
  const poser = (char: 'capacite-de-combat' | 'agilite') => {
    const h = useGame.getState().battle!.combatants.find((c) => c.id === 'h')!;
    h.activeEffects = [{ label: 'Sonde de valeur', bonus: 0, duration: { scale: 'rounds', left: 3 }, testModChar: char, testMod: -10 }];
    act(() => root!.render(<Probe />));
  };
  it('Parade : l’effet actif de CC apparaît sous son nom', () => {
    openDefense(); poser('capacite-de-combat');
    expect(rangeeDefenseur()).toContain('Sonde de valeur');
  });
  it('Esquive : l’effet actif d’Agilité apparaît sous son nom', () => {
    openDefense();
    act(() => { useGame.getState().defenseSetMode('esquive'); });
    poser('agilite');
    expect(rangeeDefenseur()).toContain('Sonde de valeur');
  });
});

/** Les volets de Talent de la fenêtre : titre ouvrant la fiche, option hors de portée refusée avec sa cause. */
describe('Défense : volets Riposte et Porte-bouclier', () => {
  const RAPIERE = { ...sword, name: 'Rapière', label: 'Rapière', uid: 'rp', qualities: [{ id: 'rapide' }] } as unknown as Weapon;
  const BOUCLIER = { name: 'Bouclier', label: 'Bouclier', uid: 'sh', trappingId: 'bouclier', type: 'melee', damage: { plusBF: true, flat: 2, bare: false }, qualities: [] } as unknown as Weapon;
  const volet = (titre: string) => [...host!.querySelectorAll('.rm-loc-inline')].find((el) => el.querySelector('.mini-title')?.textContent?.startsWith(titre)) ?? null;
  const segment = (titre: string, libelle: string) => [...(volet(titre)?.querySelectorAll('.seg button') ?? [])].find((b) => b.textContent === libelle) as HTMLButtonElement | undefined;
  const riposteur = (portees: number) => (h: Combatant) => {
    h.talents = [{ talentId: 'riposte', times: 1 }] as Combatant['talents'];
    h.ripostesThisRound = portees;
  };
  const porteBouclier = (h: Combatant, b: BattleState) => {
    h.weapons = [BOUCLIER];
    h.talents = [{ talentId: 'porte-bouclier', times: 1 }] as Combatant['talents'];
    h.advantage = 3;
    (b as BattleState & { advantagePools: { allies: number; foes: number } }).advantagePools = { allies: 3, foes: 0 };
  };

  it('Riposte au plafond du Niveau : Oui et Non refusés avec la cause, aucun pressé', () => {
    openDefense(RAPIERE, riposteur(1));
    const oui = segment('Riposte', 'Oui')!;
    expect(oui.getAttribute('aria-disabled')).toBe('true');
    expect(oui.getAttribute('aria-pressed')).toBe('false');
    expect(segment('Riposte', 'Non')!.getAttribute('aria-pressed')).toBe('false');
    const cause = document.getElementById(oui.getAttribute('aria-describedby') ?? '')?.textContent;
    expect(cause).toBe('Riposte déjà portée 1 fois ce Round : Niveau 1.');
  });

  it('Riposte sous le plafond : Oui offert et pressé', () => {
    openDefense(RAPIERE, riposteur(0));
    const oui = segment('Riposte', 'Oui')!;
    expect(oui.getAttribute('aria-disabled')).toBeNull();
    expect(oui.getAttribute('aria-pressed')).toBe('true');
  });

  it('Riposte déclarée : le choix reste visible après le jet, figé, Oui pressé', () => {
    openDefense(RAPIERE, riposteur(0), 90);
    act(() => { useGame.getState().defenseRoll(); useGame.getState().defenseSetForcedRoll(5); });
    expect(useGame.getState().pendingDefense!.result!.advantageTo).toBe('defender');
    const oui = segment('Riposte', 'Oui')!;
    expect(oui.getAttribute('aria-pressed')).toBe('true');
    expect(oui.getAttribute('aria-disabled')).toBe('true');
    expect(segment('Riposte', 'Non')!.getAttribute('aria-pressed')).toBe('false');
  });

  it('le titre du volet Riposte ouvre la fiche au clic et au clavier', () => {
    openDefense(RAPIERE, riposteur(0));
    const titre = volet('Riposte')!.querySelector<HTMLElement>('.mini-title .codex-ref')!;
    expect(titre.getAttribute('role')).toBe('button');
    expect(titre.tabIndex).toBe(0);
    act(() => { titre.click(); });
    expect(useGame.getState().codexOverlay).toMatchObject({ category: 'talents', id: 'riposte' });
    act(() => { useGame.setState({ codexOverlay: null }); });
    act(() => { titre.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); });
    expect(useGame.getState().codexOverlay).toMatchObject({ category: 'talents', id: 'riposte' });
  });

  describe('Porte-bouclier (variante Avantage de groupe)', () => {
    afterEach(() => resetRule('combat-aa-avantage-groupe'));

    it('« Dégâts » déclaré, Défense perdue : le volet reste après le jet, Dégâts refusé avec sa cause', () => {
      setRule('combat-aa-avantage-groupe', true);
      openDefense(undefined, porteBouclier, 5);
      act(() => { useGame.getState().defenseSetShieldReaction('damage'); });
      act(() => { useGame.getState().defenseRoll(); useGame.getState().defenseSetForcedRoll(97); });
      expect(useGame.getState().pendingDefense!.result!.hit).toBe(true);
      const degats = segment('Porte-bouclier', 'Dégâts')!;
      expect(degats.getAttribute('aria-pressed')).toBe('true');
      expect(degats.getAttribute('aria-disabled')).toBe('true');
      const cause = document.getElementById(degats.getAttribute('aria-describedby') ?? '')?.textContent;
      expect(cause).toBe('Défense non gagnée : pas de Dégâts.');
    });

    it('« Dégâts » déclaré, Défense gagnée : Dégâts reste pressé, refusé seulement parce que le jet est lancé', () => {
      setRule('combat-aa-avantage-groupe', true);
      openDefense(undefined, porteBouclier, 90);
      act(() => { useGame.getState().defenseSetShieldReaction('damage'); });
      act(() => { useGame.getState().defenseRoll(); useGame.getState().defenseSetForcedRoll(5); });
      expect(useGame.getState().pendingDefense!.result!.advantageTo).toBe('defender');
      const degats = segment('Porte-bouclier', 'Dégâts')!;
      expect(degats.getAttribute('aria-pressed')).toBe('true');
      const cause = document.getElementById(degats.getAttribute('aria-describedby') ?? '')?.textContent;
      expect(cause).toBe('Le jet est lancé : la réaction se déclare avant.');
    });

    it('« Dégâts » déclaré, Test opposé à égalité : l\'attaque ne touche pas, Dégâts refusé comme au moteur', () => {
      setRule('combat-aa-avantage-groupe', true);
      openDefense(undefined, porteBouclier, 30);
      act(() => { useGame.getState().defenseSetShieldReaction('damage'); });
      act(() => { useGame.getState().defenseRoll(); useGame.getState().defenseSetForcedRoll(65); });
      const res = useGame.getState().pendingDefense!.result!;
      expect(res.hit).toBe(false);
      expect(res.advantageTo).toBeNull();
      const degats = segment('Porte-bouclier', 'Dégâts')!;
      const cause = document.getElementById(degats.getAttribute('aria-describedby') ?? '')?.textContent;
      expect(cause).toBe('Défense non gagnée : pas de Dégâts.');
    });

    it('le titre du volet Porte-bouclier ouvre la fiche au clic', () => {
      setRule('combat-aa-avantage-groupe', true);
      openDefense(undefined, porteBouclier);
      const titre = volet('Porte-bouclier')!.querySelector<HTMLElement>('.mini-title .codex-ref')!;
      expect(titre.tabIndex).toBe(0);
      act(() => { titre.click(); });
      expect(useGame.getState().codexOverlay).toMatchObject({ category: 'talents', id: 'porte-bouclier' });
    });
  });
});

/**
 * CIBLE BORNÉE d'une ligne de Test opposé : l'écrêtage est MESURÉ par le constructeur du `TestResult`
 * (`evaluateTest`, `hydrateTR`, `engine/tests.ts`, par `clampTarget`) et la ligne RENDUE le lit tel
 * quel, avant le jet (`testPending`, même `clampTarget`) comme après (`bd`, `engine/combat.ts`, par
 * `cibleMesuree`) ; l'attaque figée se ré-hydrate de sa cible brute (`cibleBrute`) et se re-mesure.
 * MUTATION : retirer `clampTarget` d'`evaluateTest` ou de `hydrateTR` → la rangée témoin rend « autres » ;
 * dériver la cible de `testPending` sans `clampTarget` → ma rangée pré-jet annonce −20.
 */
describe('Défense : une cible écrêtée nomme son plafond ou son plancher, jamais « autres »', () => {
  const blocs = () => Array.from(host!.querySelectorAll('.rm-roll-block')) as HTMLElement[];
  const chips = (b: HTMLElement) => Array.from(b.querySelectorAll('.rm-mod')).map((c) => c.textContent);
  const calcul = (b: HTMLElement) => b.querySelector('.rm-roll-calc')?.textContent;
  const sonneEtAvantage = (hero: Combatant, battle: BattleState) => {
    hero.characteristics = { ...hero.characteristics, agilite: 10 };
    hero.conditions = [{ id: 'sonne', value: 3 }] as Combatant['conditions'];
    battle.combatants[0].advantage = 6;
  };

  it('Esquive Sonné 3 sous le plancher, attaque à fort Avantage au-dessus du plafond', () => {
    ANONYMES.count = 0;
    openDefense(undefined, sonneEtAvantage);
    act(() => { useGame.getState().defenseSetMode('esquive'); });
    const [, maLigne] = blocs();
    expect(calcul(maLigne), 'pré-jet : la cible annoncée est celle que le dé affrontera').toBe('10 −9 = 1');
    expect(chips(maLigne)).toEqual(['−30 Sonné', '+21 plancher 1']);
    act(() => { useGame.getState().defenseRoll(); });
    const [temoin, resolue] = blocs();
    expect(chips(temoin)).toEqual(['+70 Avantage', '−16 plafond 99']);
    expect(chips(resolue)).toEqual(['−30 Sonné', '+21 plancher 1']);
    expect(host!.textContent).not.toContain('autres');
    expect(ANONYMES.count, 'la sonde DEV ne compte aucune chip anonyme').toBe(0);
  });
});

/**
 * DÉ CHOISI sur une cible bornée : le dé FIXÉ comme le dé de RÉSILIENCE (LDB 17 l.68) se réévaluent à la
 * cible BRUTE du jet posé (`deDuJet`, `state/rollFlowFactory.ts`, par `cibleBrute`), que le constructeur
 * re-borne et re-mesure (`evaluateTest`, `forcedTR`, `engine/tests.ts`), au plancher comme au plafond ;
 * aucun appelant ne relaie l'écrêtage.
 * MUTATION : retirer `clampTarget` d'`evaluateTest` → le dé fixé rend « autres » ; retirer `clampTarget`
 * de `forcedTR` → le dé de Résilience rend « autres ».
 */
describe('Défense : un dé choisi sur une cible écrêtée nomme son plafond ou son plancher', () => {
  const resolue = () => Array.from(host!.querySelectorAll('.rm-roll-block'))[1] as HTMLElement;
  const chips = () => Array.from(resolue().querySelectorAll('.rm-mod')).map((c) => c.textContent);
  const plancher = (hero: Combatant) => {
    hero.characteristics = { ...hero.characteristics, agilite: 10 };
    hero.conditions = [{ id: 'sonne', value: 3 }] as Combatant['conditions'];
  };
  const plafond = (hero: Combatant) => {
    hero.characteristics = { ...hero.characteristics, agilite: 95 };
    hero.advantage = 3;
  };
  const choisir = (resilience: boolean, de: number) => act(() => {
    useGame.getState().defenseSetMode('esquive');
    useGame.getState().defenseRoll();
    if (resilience) useGame.getState().defenseForceSuccess();
    useGame.getState().defenseSetForcedRoll(de);
  });

  for (const resilience of [false, true]) {
    const dé = resilience ? 'dé de Résilience' : 'dé fixé';
    it(`${dé} au plancher : « plancher 1 », jamais « autres »`, () => {
      ANONYMES.count = 0;
      openDefense(undefined, plancher);
      choisir(resilience, 1);
      expect(useGame.getState().pendingDefense!.def!.roll).toBe(1);
      expect(chips()).toEqual(['−30 Sonné', '+21 plancher 1']);
      expect(ANONYMES.count).toBe(0);
    });
    it(`${dé} au plafond : « plafond 99 », jamais « autres »`, () => {
      ANONYMES.count = 0;
      openDefense(undefined, plafond);
      choisir(resilience, 40);
      expect(useGame.getState().pendingDefense!.def!.roll).toBe(40);
      expect(chips()).toEqual(['+30 Avantage', '−26 plafond 99']);
      expect(ANONYMES.count).toBe(0);
    });
  }
});

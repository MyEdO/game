/**
 * LA SAUVEGARDE « 1d10 ≥ Indice » PASSE PAR LA PORTE (#1508 T3b) — jumeau de `chute-a-la-porte.test.ts`.
 *
 * `LDB 85 l.98` (Démoniaque) : « Lancez 1d10 après chaque coup reçu, si la créature obtient le nombre de
 * l'*Indice* ou plus, le coup est ignoré, même s'il s'agit d'un critique. » ; `LDB 85 l.278` (Protection) ;
 * `LDB 47 l.410` (le Dôme OCTROIE Protection (6+) contre les attaques magiques ou à distance du dehors).
 *
 * Ce que ces contrats tiennent :
 *  - le dé NAÎT NON RÉSOLU en étape de cascade, AVANT toute mutation de la cible (le coup est SUSPENDU) ;
 *  - l'étape PORTE son seuil, donc la fenêtre peut MONTRER contre quoi le dé tombe ;
 *  - le dé POSÉ décide : ≥ Indice → « le coup est ignoré » (aucune Blessure, aucun Critique) ; < Indice →
 *    le coup s'applique normalement ;
 *  - deux Traits = deux dés, le second n'existant QUE si le premier a raté (grappe dépendante) ;
 *  - AUCUNE scission par kind de porteur : un démon touché par un héros reçoit la MÊME étape ;
 *  - le Projectile magique suspend PAR CIBLE, sans rien rouler en silence ;
 *  - un dé déclaré ARRÊTE la chaîne des modifiers : aucun modifier d'ordre supérieur (Martyr LDB 43
 *    l.107, Perturbante LDB 62 l.272-274) ne mute quoi que ce soit avant le dé, ni deux fois ;
 *  - ce que l'appelant allait faire APRÈS le coup (maillon de balayage, Action d'une frappe gratuite)
 *    est parqué sur SON étape, par IDENTITÉ, et rendu à la reprise.
 */
import { tableTotale } from '../../lib/tableTotale';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { useGame, type BattleState } from '../store';
import { aiCreatureFreeAttacks, applyAttackResult, applyCast, autoCleave, freeAttackHookImpl, resolveDeviation } from '../combatFlow';
import { evaluateMissile, type CastResult } from '../../engine/magic';
import { seedBattleRng } from '../battleRng';
import { setRule, resetRule } from '../../engine/policy';
import { emptyScene } from '../scene';
import { stepInteraction } from '../cascade';
import type { CascadeStep } from '../pendings';
import { CHAR_KEYS, type Combatant, type Weapon } from '../../engine/types';
import type { AttackResult } from '../../engine/combat';

const CHARS = { 'capacite-de-combat': 45, 'capacite-de-tir': 45, force: 40, endurance: 40, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 };

const mk = (kind: Combatant['kind'], id: string, over: Partial<Combatant> = {}): Combatant =>
  ({
    id, label: id, kind, characteristics: { ...CHARS },
    wounds: { current: 30, max: 30 }, advantage: 0, conditions: [], traumas: [], criticalWounds: 0,
    weapons: [], items: [], skills: [], talents: [], traits: [], movement: 4, bodyShape: 'humanoide',
    pos: { x: 0, y: 0 }, fate: 0, engagedWith: [], size: 'moyenne',
    armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    ...over,
  } as unknown as Combatant);

function setBattle(combatants: Combatant[]): void {
  const battle = {
    combatants, order: combatants.map((c) => c.id), baseOrder: combatants.map((c) => c.id),
    turn: 0, round: 1, action: null, selectedSpellId: null, reachable: new Map(),
    movementUsed: 0, movedPreAction: false, acted: false, log: [], over: null,
  } as unknown as BattleState;
  useGame.setState({ battle, mode: 'battle', scene: emptyScene(), gameTime: 720, party: [], journal: [], pendingCascade: null, pendingFateSave: null, pendingLogQueue: [] });
}

const arc = { label: 'Arc', type: 'ranged', damage: { plusBF: false, flat: 7 }, range: 30, qualities: [] } as unknown as Weapon;
const touche = (): AttackResult => ({
  hit: true, attackerRoll: 30, netSL: 3, location: 'corps', damage: 6, woundsLost: 4,
  critical: false, advantageTo: null, defenderDefeated: false, log: 'touche.',
});

/** Aura de Dôme portée par `gardien`, d'Indice `indice` (la DONNÉE du sort, op `domeWard`). */
const dome = (indice: number): Combatant['activeEffects'] =>
  ([{ label: 'Dôme', bonus: 0, domeWard: { radiusMeters: 4, ward: { id: 'protection', value: indice } } }] as unknown as Combatant['activeEffects']);

/** L'étape COURANTE de la séquence en vol (celle que la fenêtre servirait). */
const etapeCourante = (): CascadeStep | undefined => {
  const p = useGame.getState().pendingCascade;
  return p?.participants[p.cursor];
};

/** Les étapes de sauvegarde NON RÉSOLUES de la séquence. */
const sauvegardesOuvertes = (): CascadeStep[] =>
  (useGame.getState().pendingCascade?.participants ?? []).filter((s) => s.kind === 'sauvegarde' && !s.de?.result);

/** Ce que le joueur a LU : une séquence peut se CLORE en cours de route, donc les lignes se captent au
 *  fil de l'eau (même geste que `cascadeTestKit.draineEtLit`), jamais à la fin sur un slot vidé. */
let lues: string[] = [];
function capter(): void {
  for (const s of useGame.getState().pendingCascade?.participants ?? []) {
    for (const l of s.outcome ?? []) if (!lues.includes(l.text)) lues.push(l.text);
  }
}

/** POSE un dé sur l'étape courante et la valide — le geste du joueur, jamais un appel moteur. */
function poser(valeur: number): void {
  const st = etapeCourante()!;
  expect(st, 'aucune étape à jouer').toBeDefined();
  useGame.getState().cascadeDieSetForcedRoll(st.id, valeur);
  useGame.getState().cascadeNext();
  capter();
}

/** Les lignes que le joueur a lues sur les étapes de la séquence (captes + état courant + journal). */
const lignesLues = (): string[] => {
  capter();
  return [...lues, ...useGame.getState().journal, ...(useGame.getState().battle?.log ?? []).map((l) => l.text)];
};

beforeEach(() => {
  seedBattleRng(1);
  lues = [];
  useGame.setState({ battle: null, party: [], journal: [], pendingCast: null, pendingCascade: null });
});

describe('coup physique — le dé naît à la porte, AVANT toute mutation', () => {
  const monteDome = (): { gardien: Combatant; cible: Combatant; archer: Combatant } => {
    const gardien = mk('hero', 'gardien', { pos: { x: 5, y: 5 }, activeEffects: dome(6) });
    const cible = mk('hero', 'couvert', { pos: { x: 6, y: 5 } });
    const archer = mk('enemy', 'archer', { pos: { x: 20, y: 5 } });
    setBattle([gardien, cible, archer]);
    return { gardien, cible, archer };
  };

  it('un TIR du dehors SUSPEND le coup : étape de dé NON résolue, portant son seuil, et rien n’a bougé', () => {
    const { cible, archer } = monteDome();
    const suspendu = applyAttackResult(useGame.getState, useGame.setState, archer, cible, arc, touche());
    expect(suspendu, 'la résolution est suspendue tant que le dé n’est pas tombé').toBe(true);
    const st = etapeCourante()!;
    expect(st.kind).toBe('sauvegarde');
    expect(stepInteraction(st), 'le dé reste à jeter').toBe('de');
    expect(st.de?.spec, 'un 1d10, celui du RAW').toEqual({ n: 1, sides: 10 });
    expect(st.de?.seuil, 'l’étape PORTE son seuil — la fenêtre peut le montrer').toEqual({ indice: 6, traitId: 'protection', dome: true });
    expect(st.actorId, 'le porteur du dé est la cible').toBe(cible.id);
    expect(cible.wounds.current, 'aucune Blessure avant le dé').toBe(30);
    expect((useGame.getState().pendingCascade?.participants ?? []).some((s) => s.kind === 'deviation'), 'aucune fenêtre de Critique avant la sauvegarde').toBe(false);
  });

  it('dé POSÉ à 6 (= Indice) : « le coup est ignoré » — aucune Blessure, et la ligne le dit', () => {
    const { cible, archer } = monteDome();
    applyAttackResult(useGame.getState, useGame.setState, archer, cible, arc, touche());
    poser(6);
    expect(cible.wounds.current, 'LDB 85 l.278 : « supérieur ou égal » sauve').toBe(30);
    expect(lignesLues().some((l) => /ignore le coup — sauvegarde 1d10 : 6 ≥ Protection \(6\+\) du Dôme\./.test(l)), lignesLues().join(' | ')).toBe(true);
  });

  it('dé POSÉ à 5 (< Indice) : le coup s’applique, et la RATÉE s’écrit aussi', () => {
    const { cible, archer } = monteDome();
    applyAttackResult(useGame.getState, useGame.setState, archer, cible, arc, touche());
    poser(5);
    expect(cible.wounds.current, 'la sauvegarde a manqué : les Blessures tombent').toBeLessThan(30);
    expect(lignesLues().some((l) => /n’ignore pas le coup — sauvegarde 1d10 : 5 < Protection \(6\+\) du Dôme\./.test(l)), lignesLues().join(' | ')).toBe(true);
  });

  it('GRAPPE : le 2ᵉ dé n’existe QUE si le 1ᵉʳ a raté, et les deux lignes s’écrivent', () => {
    const gardien = mk('hero', 'gardien', { pos: { x: 5, y: 5 }, activeEffects: dome(6) });
    const cible = mk('hero', 'couvert', { pos: { x: 6, y: 5 }, traits: [{ id: 'demoniaque', value: 8 }] as never });
    const archer = mk('enemy', 'archer', { pos: { x: 20, y: 5 } });
    setBattle([gardien, cible, archer]);
    applyAttackResult(useGame.getState, useGame.setState, archer, cible, arc, touche());
    expect(sauvegardesOuvertes().length, 'un seul dé ouvert à la fois : aucune grappe mintée d’avance').toBe(1);
    poser(3); // Démoniaque (8+) raté → le Trait du Dôme reste à jouer
    expect(sauvegardesOuvertes().length, 'le dé suivant ne s’ouvre qu’APRÈS l’échec du précédent').toBe(1);
    expect(cible.wounds.current, 'toujours aucune mutation : la grappe n’est pas finie').toBe(30);
    poser(9); // Protection (6+) du Dôme → sauvé
    expect(cible.wounds.current, 'le second Trait a sauvé : le coup est ignoré').toBe(30);
    const lues = lignesLues();
    const rate = lues.findIndex((l) => /n’ignore pas le coup — sauvegarde 1d10 : 3 < Démoniaque \(8\+\)\./.test(l));
    const sauve = lues.findIndex((l) => /ignore le coup — sauvegarde 1d10 : 9 ≥ Protection \(6\+\) du Dôme\./.test(l));
    expect(rate, `la ratée du Trait propre manque : ${lues.join(' | ')}`).toBeGreaterThanOrEqual(0);
    expect(sauve, `la réussie du Dôme manque : ${lues.join(' | ')}`).toBeGreaterThanOrEqual(0);
    expect(rate, 'les dés se lisent dans l’ordre où ils sont tombés').toBeLessThan(sauve);
  });

  it('UN SEUL dé quand la sauvegarde a déjà été décidée : la fenêtre de Critique ne la rejoue pas', () => {
    // Le coup repasse par le registre à chaque ré-entrée (Déviation Critique) : sans la décision portée
    // par la touche, un second dé s'ouvrirait — et le porteur sauverait deux fois du même coup.
    const { cible, archer } = monteDome();
    applyAttackResult(useGame.getState, useGame.setState, archer, cible, arc, { ...touche(), woundsLost: 40, damage: 40 });
    poser(1); // raté : le coup s'applique, dépassement → fenêtre de Critique
    expect(sauvegardesOuvertes().length, 'aucune 2ᵉ sauvegarde pour le même coup').toBe(0);
  });
});

describe('aucune scission par KIND de porteur (canon : la porte pousse pour tous)', () => {
  it('un démon frappé par un héros reçoit la MÊME étape, à son nom', () => {
    const hero = mk('hero', 'hardi', { pos: { x: 0, y: 0 } });
    const demon = mk('enemy', 'demon', { pos: { x: 1, y: 0 }, traits: [{ id: 'demoniaque', value: 8 }] as never });
    setBattle([hero, demon]);
    const epee = { label: 'Épée', type: 'melee', damage: { plusBF: true, flat: 0 }, qualities: [] } as unknown as Weapon;
    const suspendu = applyAttackResult(useGame.getState, useGame.setState, hero, demon, epee, touche());
    expect(suspendu, 'le coup est suspendu pour un porteur ENNEMI aussi').toBe(true);
    const st = etapeCourante()!;
    expect(st.kind).toBe('sauvegarde');
    expect(st.actorId, 'le dé appartient au démon').toBe(demon.id);
    expect(st.de?.seuil).toEqual({ indice: 8, traitId: 'demoniaque', dome: false });
    expect(demon.wounds.current, 'rien n’est appliqué avant son dé').toBe(30);
    poser(8);
    expect(demon.wounds.current, '1d10 ≥ 8 : le coup est ignoré (LDB 85 l.98)').toBe(30);
  });
});

describe('Projectile magique — une étape PAR CIBLE, rien roulé en silence', () => {
  /** Projectile arcane MINIMAL (non curé → aucun Flow) : Dégâts 8 + DR + BFM. */
  const missileSpell = (): never =>
    ({ id: 'dard-test', label: 'Dard', ecole: 'sort', subType: null, family: 'arcane', cn: 0, range: null, target: 1, duration: null, desc: '', source: { book: 'LDB', page: 0 }, missile: true, damage: 8 }) as never;

  it('un Dard sur la protégée ouvre SA sauvegarde avant toute Blessure, et le dé posé décide', () => {
    const gardien = mk('hero', 'gardien', { pos: { x: 5, y: 5 }, activeEffects: dome(6) });
    const cible = mk('hero', 'couvert', { pos: { x: 6, y: 5 } });
    const mage = mk('enemy', 'mage', { pos: { x: 20, y: 5 } });
    setBattle([gardien, cible, mage]);
    const spell = missileSpell();
    const cast: CastResult = { cast: true, roll: 44, target: 60, sl: 4, isCritical: false, isFumble: false, log: '' };
    applyCast(useGame.getState, useGame.setState, mage, cible, spell, evaluateMissile(mage, cible, spell, cast), true, false, undefined, undefined);
    const st = etapeCourante()!;
    expect(st.kind, 'la touche magique EST un coup reçu (LDB 85 l.98)').toBe('sauvegarde');
    expect(st.de?.seuil).toEqual({ indice: 6, traitId: 'protection', dome: true });
    expect(cible.wounds.current, 'aucune Blessure avant le dé').toBe(30);
    poser(6);
    expect(cible.wounds.current, 'le Dôme a sauvé : le Projectile est ignoré').toBe(30);
  });
});

describe('un dé déclaré ARRÊTE la chaîne des modifiers', () => {
  /** Cible sous Dôme, GARDÉE par un prêtre (Martyr, LDB 43 l.107) : ce modifier d'ordre 40 MUTE l'état
   *  (`loseWounds` sur le prêtre) et tournait AVANT le dé de la sauvegarde (ordre 10), puis une SECONDE
   *  fois à la ré-entrée. */
  const monteMartyr = (): { pretre: Combatant; cible: Combatant; archer: Combatant } => {
    const gardien = mk('hero', 'gardien', { pos: { x: 5, y: 5 }, activeEffects: dome(6) });
    const pretre = mk('hero', 'pretre', { pos: { x: 4, y: 5 } });
    const cible = mk('hero', 'couvert', {
      pos: { x: 6, y: 5 },
      activeEffects: ([{ label: 'Martyr', bonus: 0, martyrGuard: 'pretre' }] as unknown as Combatant['activeEffects']),
    });
    const archer = mk('enemy', 'archer', { pos: { x: 20, y: 5 } });
    setBattle([gardien, pretre, cible, archer]);
    return { pretre, cible, archer };
  };

  it('MARTYR (ordre 40) ne prend RIEN avant le dé, et ne le prend QU’UNE fois', () => {
    const { pretre, cible, archer } = monteMartyr();
    applyAttackResult(useGame.getState, useGame.setState, archer, cible, arc, touche());
    expect(pretre.wounds.current, 'la chaîne s’arrête sur la déclaration du dé : le prêtre n’a encore rien encaissé').toBe(30);
    poser(1); // sauvegarde RATÉE : le coup s’applique, et le Martyr joue — une seule fois
    expect(pretre.wounds.current, 'le Martyr encaisse UNE fois (il en prenait deux : avant le dé, puis à la ré-entrée)').toBe(29);
    expect(cible.wounds.current, 'la cible ne perd rien : le prêtre a pris le coup à sa place').toBe(30);
  });

  it('MARTYR ne joue pas du tout quand la sauvegarde RÉUSSIT : il n’y a plus de Blessure à encaisser', () => {
    const { pretre, cible, archer } = monteMartyr();
    applyAttackResult(useGame.getState, useGame.setState, archer, cible, arc, touche());
    poser(6);
    expect(pretre.wounds.current, 'le coup est ignoré (LDB 85 l.278) : rien à encaisser pour personne').toBe(30);
    expect(cible.wounds.current).toBe(30);
  });

  it('PERTURBANTE (ordre 50) ne consomme pas son mode ni ne repousse avant le dé', () => {
    const gardien = mk('hero', 'gardien', { pos: { x: 5, y: 5 }, activeEffects: dome(6) });
    const cible = mk('hero', 'couvert', { pos: { x: 6, y: 5 }, traits: [{ id: 'demoniaque', value: 8 }] as never });
    // Arme forgée pour le contrat, portant la qualité du CATALOGUE par son id (`src/data/qualities.json`
    // id `perturbante`, portée en donnée par le groupe d'armes `fleau`) — jamais un drapeau ad hoc.
    const baton = { label: 'Bâton', type: 'melee', damage: { plusBF: true, flat: 0 }, qualities: [{ id: 'perturbante' }] } as unknown as Weapon;
    const brute = mk('enemy', 'brute', { pos: { x: 7, y: 5 }, weapons: [baton], pushbackMode: true } as never);
    setBattle([gardien, cible, brute]);
    applyAttackResult(useGame.getState, useGame.setState, brute, cible, baton, touche());
    expect(brute.pushbackMode, 'le mode Repousser n’est pas consommé tant que la touche n’est pas connue').toBe(true);
    expect(cible.pos, 'personne n’a reculé avant le dé').toEqual({ x: 6, y: 5 });
    poser(8); // Démoniaque (8+) : le coup est ignoré — la chaîne rejoue ENTIÈREMENT, une seule fois
    expect(cible.wounds.current).toBe(30);
    expect(brute.pushbackMode, 'la chaîne rejouée à la reprise consomme le mode UNE fois').toBe(false);
  });
});

describe('ce que l’appelant allait faire APRÈS le coup est parqué sur SON étape (identité, pas position)', () => {
  it('BALAYAGE : 2ᵉ et 3ᵉ cibles sauvegardantes — les trois sont frappées, dans l’ordre', () => {
    // Pendant une application, la poussée entre dans la FENÊTRE d’insertion, pas dans `participants`
    // (`cascade.ts:974-981`) : un parquage « dernière du tableau » muterait l’étape DÉJÀ résolue et
    // perdrait la chaîne en silence.
    const demon = { id: 'demoniaque', value: 8 };
    const fort = { ...CHARS, 'capacite-de-combat': 90 };
    const faible = tableTotale(CHAR_KEYS, () => 1); // aucune défense possible : le contrat porte sur la CHAÎNE, pas sur le jet
    const griffe = { label: 'Griffe', type: 'melee', damage: { plusBF: true, flat: 0 }, qualities: [] } as unknown as Weapon;
    const ogre = mk('enemy', 'ogre', { pos: { x: 5, y: 5 }, characteristics: fort, size: 'enorme', weapons: [griffe] } as never);
    const h1 = mk('hero', 'h1', { pos: { x: 5, y: 6 }, characteristics: faible, aiControlled: true } as never);
    const h2 = mk('hero', 'h2', { pos: { x: 4, y: 5 }, characteristics: faible, aiControlled: true, traits: [demon] } as never);
    const h3 = mk('hero', 'h3', { pos: { x: 6, y: 5 }, characteristics: faible, aiControlled: true, traits: [demon] } as never);
    const h4 = mk('hero', 'h4', { pos: { x: 5, y: 4 }, characteristics: faible, aiControlled: true, traits: [demon] } as never);
    setBattle([ogre, h1, h2, h3, h4]);
    seedBattleRng(4); // graine où les deux enchaînements TOUCHENT (le contrat porte sur la chaîne, pas sur le jet)
    // Le balayage part de la touche sur h1 (`res.cleave`, LDB 85 l.362) : h2 puis h3 enchaînent.
    autoCleave(useGame.getState, useGame.setState, ogre, h1, { ...touche(), cleave: true } as AttackResult);
    // Les porteurs sont AUTO (aucun siège humain ne les tient) : leurs dés se résolvent d'office, et la
    // séquence s'avance comme le ferait le pilote. Ce que le contrat mesure est la CHAÎNE, pas le jet.
    const vus: string[] = [];
    for (let garde = 0; garde < 12 && useGame.getState().pendingCascade; garde++) {
      const casc = useGame.getState().pendingCascade!;
      const st = casc.participants[casc.cursor];
      if (!st) break;
      for (const x of casc.participants) if (x.kind === 'sauvegarde' && x.actorId && !vus.includes(x.actorId)) vus.push(x.actorId);
      if (st.de && !st.de.result) useGame.getState().cascadeDieSetForcedRoll(st.id, 1);
      useGame.getState().cascadeNext();
      capter();
    }
    const lignes = lignesLues();
    const vu = `sauvegardes : ${vus.join(', ')} — PB h2=${h2.wounds.current} h3=${h3.wounds.current} h4=${h4.wounds.current} — ${lignes.join(' | ')}`;
    const rang = (id: string): number => lignes.findIndex((l) => new RegExp(`${id}.*sauvegarde 1d10`).test(l));
    expect(rang('h2'), `h2 a joué SA sauvegarde — ${vu}`).toBeGreaterThanOrEqual(0);
    expect(rang('h3'), `h3 aussi — ${vu}`).toBeGreaterThanOrEqual(0);
    // h4 est le maillon PARQUÉ DEPUIS UN APPLIER : sa poussée vit dans la fenêtre d'insertion, pas dans
    // `participants` — c'est LUI que perdait un parquage « dernière du tableau ».
    expect(rang('h4'), `h4 aussi : le maillon parqué pendant une application n’est pas perdu — ${vu}`).toBeGreaterThanOrEqual(0);
    expect(rang('h2'), 'les dés se lisent dans l’ordre du balayage').toBeLessThan(rang('h3'));
    expect(rang('h3'), 'les dés se lisent dans l’ordre du balayage').toBeLessThan(rang('h4'));
    expect(h2.wounds.current, `h2 a bien été frappé — ${vu}`).toBeLessThan(30);
    expect(h3.wounds.current, `h3 a bien été frappé — ${vu}`).toBeLessThan(30);
  });

  it('ATTAQUE GRATUITE : l’Action n’est pas consommée quand la cible a une sauvegarde', () => {
    const epee = { label: 'Épée', type: 'melee', damage: { plusBF: true, flat: 0 }, qualities: [] } as unknown as Weapon;
    // Frappeur sûr de sa touche / démon sans défense : le contrat porte sur l'Action, pas sur le jet.
    const frappeur = mk('hero', 'frappeur', { pos: { x: 0, y: 0 }, weapons: [epee], characteristics: { ...CHARS, 'capacite-de-combat': 90 } } as never);
    const nul = tableTotale(CHAR_KEYS, () => 1);
    const demon = mk('enemy', 'demon', { pos: { x: 1, y: 0 }, characteristics: nul, traits: [{ id: 'demoniaque', value: 8 }] } as never);
    setBattle([frappeur, demon]);
    freeAttackHookImpl(useGame.getState, useGame.setState, frappeur,
      { op: 'grantFreeAttack' } as never, { targetId: demon.id, cap: 1, key: 'frappe-reactive' });
    const st = etapeCourante();
    expect(st?.kind, 'la frappe gratuite a bien ouvert la sauvegarde du démon').toBe('sauvegarde');
    poser(1); // sauvegarde RATÉE : le coup porte, et la RÉ-ENTRÉE rejoue `markActed`
    expect(demon.wounds.current, 'la frappe a bien été appliquée à la reprise').toBeLessThan(30);
    expect(useGame.getState().battle!.acted, 'une frappe GRATUITE ne consomme pas l’Action, même suspendue par une sauvegarde').toBe(false);
  });
});

describe('une fenêtre DE PLUS sur le même coup ne perd pas la suite (sauvegarde PUIS Déviation)', () => {
  // La Déviation Critique (LDB 63 l.30) rouvre une fenêtre APRÈS la sauvegarde : ce que l’appelant fera
  // après le coup doit traverser les DEUX, sans quoi la dernière reprise joue un coup amputé de sa suite.
  const nul = (): typeof CHARS => tableTotale(CHAR_KEYS, () => 1);
  const blindee = { tete: 2, brasG: 2, brasD: 2, corps: 2, jambeG: 2, jambeD: 2 };

  /** Joue la séquence jusqu'au bout comme le pilote : dés posés à 1 (toute sauvegarde RATE), choix au
   *  défaut. Renvoie les `kind` d'étapes traversés. */
  const derouler = (): string[] => {
    const vus: string[] = [];
    for (let garde = 0; garde < 12 && useGame.getState().pendingCascade; garde++) {
      const casc = useGame.getState().pendingCascade!;
      const st = casc.participants[casc.cursor];
      if (!st) break;
      vus.push(st.kind);
      if (st.de && !st.de.result) useGame.getState().cascadeDieSetForcedRoll(st.id, 1);
      useGame.getState().cascadeNext();
      capter();
    }
    return vus;
  };

  beforeEach(() => setRule('combat-critical-deflect', true)); // la fenêtre de Déviation existe (règle optionnelle)
  afterEach(() => resetRule('combat-critical-deflect'));

  /** Les étapes de DÉVIATION de la séquence (même lecture que `deviation-paths.test.ts:53`). */
  const etapesDeviation = (): CascadeStep[] =>
    (useGame.getState().pendingCascade?.participants ?? []).filter((x) => x.kind === 'deviation');

  it('la suite du coup traverse la sauvegarde PUIS la DÉVIATION — l’Avantage différé n’est pas crédité à la reprise', () => {
    // Montage repris de `deviation-paths.test.ts:314-326` (« héros blindé subissant un dépassement →
    // SUSPEND ») : héros TENU (ni `aiControlled`, ni siège distant), armure DÉVIABLE à la localisation,
    // `res` FORGÉ passé DIRECTEMENT à `applyAttackResult` — ce qui court-circuite `maybeOpenDefense`.
    // S'y ajoute la Protection (6+) du porteur : la SAUVEGARDE s'ouvre d'abord, la DÉVIATION ensuite, sur
    // le MÊME coup. La suite sous contrat est l'Avantage DIFFÉRÉ du Maniement de deux armes (LDB 10
    // l.767-773) : c'est la seule dont l'effet se MESURE après les deux fenêtres (l'attaque GRATUITE et le
    // maillon de balayage entrent, eux, avec `deviated: false` — un enchaînement n'ouvre PAS de fenêtre de
    // Déviation imbriquée, `combatFlow.ts:3444`).
    const gourdin = { label: 'Gourdin', type: 'melee', damage: { plusBF: true, flat: 0, bare: true }, qualities: [] } as unknown as Weapon;
    const brute = mk('enemy', 'brute', { pos: { x: 1, y: 0 }, weapons: [gourdin] });
    const porteur = mk('hero', 'porteur', {
      pos: { x: 0, y: 0 }, armour: { tete: 0, brasG: 0, brasD: 0, corps: 3, jambeG: 0, jambeD: 0 },
      wounds: { current: 3, max: 15 }, traits: [{ id: 'protection', value: 6 }],
    } as never);
    setBattle([brute, porteur]);
    // Dépassement (LDB 18 l.53) : `woundsLost` (8) > PB courants (3), `critical: false`.
    const depassement = { ...touche(), damage: 12, woundsLost: 8, location: 'corps', advantageTo: 'attacker' } as AttackResult;

    // 1) La SAUVEGARDE s'ouvre la première, avant toute mutation.
    const suspendu = applyAttackResult(useGame.getState, useGame.setState, brute, porteur, gourdin, depassement,
      undefined, undefined, { deferAttackerAdvantage: true });
    expect(suspendu, 'la sauvegarde suspend AVANT toute mutation').toBe(true);
    expect(etapeCourante()!.kind).toBe('sauvegarde');
    expect(etapesDeviation(), 'aucune fenêtre de Critique avant le dé').toHaveLength(0);

    // 2) Dé POSÉ sous l'Indice → la sauvegarde ÉCHOUE → ré-entrée → le dépassement ouvre la DÉVIATION,
    //    et SA charge porte la suite du coup.
    poser(5);
    const dev = etapesDeviation();
    expect(dev, 'UNE fenêtre de Déviation, ouverte APRÈS la sauvegarde').toHaveLength(1);
    expect(dev[0].kind).toBe('deviation');
    expect(dev[0].critSeverity?.suite, 'la charge de la 2ᵉ fenêtre porte la suite du coup').toEqual({ deferAttackerAdvantage: true });

    // 3) Le joueur joue la fenêtre : d100 de sévérité DANS l'étape (patron `deviation-paths.test.ts:294`),
    //    puis « Dévier » — et la reprise finale honore toujours la suite.
    useGame.getState().cascadeTableRoll(dev[0].id);
    const apres = etapesDeviation()[0];
    expect(apres.deviation?.mode === 'melee' ? apres.deviation.suite : undefined, 'le PLI post-dé reconduit la suite dans la `PendingDeviation`').toEqual({ deferAttackerAdvantage: true });
    resolveDeviation(useGame.getState, useGame.setState, apres.deviation!, true);
    expect(brute.advantage, 'Avantage DIFFÉRÉ (LDB 10 l.767-773) : la reprise d’après-Déviation ne le crédite pas').toBe(0);
    expect(etapesDeviation(), 'une seule fenêtre de Critique pour ce coup').toHaveLength(1);
  });

  it('BALAYAGE : un maillon qui part en DÉVIATION (sans sauvegarde) ne casse ni ne rejoue la chaîne', () => {
    const griffe = { label: 'Griffe', type: 'melee', damage: { plusBF: true, flat: 0 }, qualities: [] } as unknown as Weapon;
    const demon = { id: 'demoniaque', value: 8 };
    const ogre = mk('enemy', 'ogre', { pos: { x: 5, y: 5 }, characteristics: { ...CHARS, 'capacite-de-combat': 90 }, size: 'enorme', weapons: [griffe] } as never);
    const h1 = mk('hero', 'h1', { pos: { x: 5, y: 6 }, characteristics: nul(), aiControlled: true } as never);
    const h2 = mk('hero', 'h2', { pos: { x: 4, y: 5 }, characteristics: nul(), aiControlled: true, traits: [demon] } as never);
    // h3 n'a AUCUNE sauvegarde : son maillon suspend par la DÉVIATION (1 PB → dépassement, armure déviable).
    const h3 = mk('hero', 'h3', { pos: { x: 6, y: 5 }, characteristics: nul(), aiControlled: true, wounds: { current: 1, max: 30 }, armour: blindee } as never);
    const h4 = mk('hero', 'h4', { pos: { x: 5, y: 4 }, characteristics: nul(), aiControlled: true, traits: [demon] } as never);
    setBattle([ogre, h1, h2, h3, h4]);
    autoCleave(useGame.getState, useGame.setState, ogre, h1, { ...touche(), cleave: true } as AttackResult);
    derouler();
    const coups = (useGame.getState().battle?.log ?? []).map((l) => l.text).filter((t) => /^ogre touche/.test(t));
    const vu = coups.join(' | ');
    // TROIS enchaînements (h2, h3, h4) et pas un de plus : une suite rejouée en aurait ajouté.
    expect(coups.length, `un coup par maillon, aucun rejoué — ${vu}`).toBe(3);
    expect(coups.filter((t) => /h4/.test(t)).length, `h4 est frappé UNE fois, à travers la Déviation de h3 — ${vu}`).toBe(1);
  });
});

describe('LE CHEMIN RÉEL : la queue du coup entre PAR LE HAUT dans `attackConfirm`/`defenseConfirm`', () => {
  // Ce que ces quatre contrats tiennent : ce qui DÉPEND de l'issue du coup ne se joue plus au retour de
  // l'appel (le dé n'est pas tombé) mais à la REPRISE, une fois — la suite voyage avec le coup.
  const epee = { uid: 'm', label: 'Épée', type: 'melee', hand: 'main', hands: 1, damage: { plusBF: true, flat: 0 }, qualities: [] } as unknown as Weapon;
  const dague = { uid: 'o', label: 'Dague', type: 'melee', hand: 'off', hands: 1, damage: { plusBF: true, flat: 0 }, qualities: [] } as unknown as Weapon;
  const griffe = { label: 'Griffe', type: 'melee', damage: { plusBF: true, flat: 0 }, qualities: [] } as unknown as Weapon;
  const demoniaque = [{ id: 'demoniaque', value: 8 }] as never;
  const nul = (): typeof CHARS => tableTotale(CHAR_KEYS, () => 1);

  /** La sauvegarde du porteur est l'étape COURANTE, et rien n'a encore bougé. */
  const sauvegardeEnCours = (porteur: Combatant): CascadeStep => {
    const st = etapeCourante();
    expect(st?.kind, `l’étape courante devrait être la sauvegarde de ${porteur.id}`).toBe('sauvegarde');
    expect(st!.actorId).toBe(porteur.id);
    expect(porteur.wounds.current, 'aucune mutation avant le dé').toBe(30);
    return st!;
  };

  it('(i) FRAPPE MORTELLE : l’enchaînement n’est armé qu’APRÈS le dé — il doit VOIR la mort', () => {
    setRule('combat-frappe-mortelle', true);
    try {
      const heros = mk('hero', 'hardi', { pos: { x: 0, y: 0 }, weapons: [epee] } as never);
      const demon = mk('enemy', 'demon', { pos: { x: 1, y: 0 }, characteristics: nul(), traits: demoniaque } as never);
      const sbire = mk('enemy', 'sbire', { pos: { x: 2, y: 0 }, characteristics: nul() } as never);
      setBattle([heros, demon, sbire]);
      // Un coup qui TUE (40 PB perdus sur 30) : la Frappe Mortelle (LDB 14 l.9) n'enchaîne qu'en tuant.
      useGame.setState({ pendingAttack: { attackerId: heros.id, targetId: demon.id, location: 'corps', result: { ...touche(), damage: 40, woundsLost: 40 } } as never });
      useGame.getState().attackConfirm();
      sauvegardeEnCours(demon);
      expect(useGame.getState().pendingCleave, 'le balayage ne s’arme pas sur une mort qui n’a pas encore eu lieu').toBeNull();
      poser(5); // sauvegarde RATÉE (< 8) : le coup porte, le démon tombe
      expect(demon.wounds.current, 'le coup a porté à la reprise').toBe(0);
      expect(useGame.getState().pendingCleave, 'la Frappe Mortelle est offerte à la reprise, sur la mort RÉELLE').not.toBeNull();
      expect(useGame.getState().pendingCleave!.attackerId).toBe(heros.id);
    } finally {
      resetRule('combat-frappe-mortelle');
    }
  });

  it('(ii) MANŒUVRE GRATUITE : l’Action est rendue, et l’État n’est posé que si le coup n’est pas ignoré', () => {
    // Attaque caudale (LDB 85 l.47) : la manœuvre POSE À Terre sur une cible plus petite, en DONNÉE.
    const monte = (): { heros: Combatant; demon: Combatant } => {
      const heros = mk('hero', 'colosse', { pos: { x: 0, y: 0 }, weapons: [epee], size: 'enorme', traits: [{ id: 'attaque-caudale', value: 9 }] } as never);
      const demon = mk('enemy', 'demon', { pos: { x: 1, y: 0 }, characteristics: nul(), size: 'moyenne', traits: demoniaque } as never);
      setBattle([heros, demon]);
      useGame.setState({ pendingAttack: { attackerId: heros.id, targetId: demon.id, location: 'corps', freeKind: 'caudale', result: touche() } as never });
      useGame.getState().attackConfirm();
      return { heros, demon };
    };
    const aTerre = (c: Combatant): unknown => c.conditions.find((x) => x.id === 'a-terre');

    const sauve = monte();
    sauvegardeEnCours(sauve.demon);
    poser(8); // ≥ 8 : « le coup est ignoré » (LDB 85 l.98)
    expect(useGame.getState().battle!.acted, 'une manœuvre GRATUITE ne consomme pas l’Action').toBe(false);
    expect(aTerre(sauve.demon), 'un coup IGNORÉ ne pose pas l’État de la manœuvre').toBeUndefined();

    lues = [];
    const rate = monte();
    sauvegardeEnCours(rate.demon);
    poser(5); // < 8 : le coup porte
    expect(useGame.getState().battle!.acted, 'gratuite : l’Action est rendue par la reprise').toBe(false);
    expect(aTerre(rate.demon), 'le coup a porté : l’État de la manœuvre est posé').toBeDefined();
  });

  it('(iii) MANIEMENT DE DEUX ARMES : la 2ᵉ frappe s’ouvre à la reprise, avec la valeur du Critique', () => {
    const heros = mk('hero', 'bretteur', { pos: { x: 0, y: 0 }, weapons: [epee, dague] } as never);
    const demon = mk('enemy', 'demon', { pos: { x: 1, y: 0 }, characteristics: nul(), traits: demoniaque } as never);
    setBattle([heros, demon]);
    const critique = { ...touche(), critical: true, attackerDetail: { roll: 30, target: 50, success: true, sl: 3 } } as AttackResult;
    useGame.setState({ pendingAttack: { attackerId: heros.id, targetId: demon.id, location: 'corps', dualMode: true, result: critique } as never });
    useGame.getState().attackConfirm();
    sauvegardeEnCours(demon);
    expect(useGame.getState().pendingDualStrike, 'aucune 2ᵉ frappe tant que le dé n’est pas tombé').toBeNull();
    poser(5); // < 8 : le coup porte, le Critique s'applique, SON étape est appendue
    const ds = useGame.getState().pendingDualStrike;
    expect(ds, 'la 2ᵉ frappe s’ouvre à la reprise').not.toBeNull();
    expect(ds!.offWeaponUid, 'la main secondaire est celle du héros').toBe('o');
    expect(ds!.mainRoll, 'le jet de la main directrice voyage avec la suite').toBe(30);
    const crit = [...(useGame.getState().pendingCascade?.participants ?? [])].reverse().find((s) => s.kind === 'critical');
    expect(crit, 'le Critique a bien appendu SON étape à la reprise').toBeDefined();
    expect(ds!.critValue, 'la 2ᵉ frappe lit la valeur du tableau des Critiques (LDB 10 l.767-773)').toBe(crit!.reveal?.dice);
    expect(useGame.getState().pendingCascade, 'la cascade reste OUVERTE : la 2ᵉ frappe s’y rendra').not.toBeNull();
  });

  it('(iv) `defenseConfirm` : le maillon de balayage PARQUÉ reprend après le dé, sans balayage neuf', () => {
    const ogre = mk('enemy', 'ogre', { pos: { x: 5, y: 5 }, characteristics: { ...CHARS, 'capacite-de-combat': 90 }, size: 'enorme', weapons: [griffe] } as never);
    const h1 = mk('hero', 'h1', { pos: { x: 5, y: 6 }, characteristics: nul(), traits: [{ id: 'protection', value: 6 }] } as never);
    const h2 = mk('hero', 'h2', { pos: { x: 4, y: 5 }, characteristics: nul(), aiControlled: true } as never);
    setBattle([ogre, h1, h2]);
    seedBattleRng(4);
    useGame.setState({ pendingDefense: { attackerId: ogre.id, defenderId: h1.id, weapon: griffe, mode: 'parade', result: touche(), suite: { mode: 'machine', coup: { enchainement: { mode: 'chaine', hitIds: [h1.id], n: 0, bcc: 2, fm: false } } } } as never });
    useGame.getState().defenseConfirm();
    sauvegardeEnCours(h1);
    expect(h2.wounds.current, 'le maillon suivant attend le dé du maillon courant').toBe(30);
    poser(5); // < 6 : le coup porte sur h1, puis la chaîne PARQUÉE reprend
    expect(h1.wounds.current, 'la sauvegarde a manqué : h1 encaisse').toBeLessThan(30);
    const coups = (useGame.getState().battle?.log ?? []).map((l) => l.text).filter((x) => /^ogre touche/.test(x));
    expect(coups.filter((x) => /h2/.test(x)).length, `la chaîne parquée reprend sur h2 — ${coups.join(' | ')}`).toBe(1);
  });

  it('(v) L’ENCHAÎNEMENT SE DÉCLARE : une frappe du Maniement de deux armes n’ouvre AUCUN balayage, même conduite par l’IA', () => {
    // Un héros conduit par l'IA (`aiControlled`) passe la garde `aiDriven` d'`autoCleave` ; sa frappe de
    // main directrice pose `res.cleave` (plus grand, LDB 85 l.362). C'est le SITE D'ORIGINE qui tranche :
    // `attackConfirm` n'a jamais balayé sur cette branche — la queue partagée ne doit pas le faire à sa place.
    const heros = mk('hero', 'bretteur', { pos: { x: 0, y: 0 }, weapons: [epee, dague], size: 'enorme', aiControlled: true } as never);
    const e1 = mk('enemy', 'e1', { pos: { x: 1, y: 0 }, characteristics: nul() } as never);
    const e2 = mk('enemy', 'e2', { pos: { x: 0, y: 1 }, characteristics: nul() } as never);
    setBattle([heros, e1, e2]);
    const coup = { ...touche(), cleave: true, attackerDetail: { roll: 30, target: 50, success: true, sl: 3 } } as AttackResult;
    useGame.setState({ pendingAttack: { attackerId: heros.id, targetId: e1.id, location: 'corps', dualMode: true, result: coup } as never });
    useGame.getState().attackConfirm();
    expect(useGame.getState().pendingDualStrike, 'la 2ᵉ frappe s’ouvre bien (la suite est jouée)').not.toBeNull();
    expect(useGame.getState().pendingCleave, 'aucun balayage interactif n’est armé').toBeNull();
    const vu = (useGame.getState().battle?.log ?? []).map((l) => l.text);
    expect(vu.filter((x) => /e2/.test(x)), `e2 n’est pas touchée : ce coup ne déclare AUCUN enchaînement — ${vu.join(' | ')}`).toHaveLength(0);
    expect(e2.wounds.current, 'la 2ᵉ cible adjacente est intacte').toBe(30);
  });

  it('(vi) MANŒUVRE GRATUITE d’une créature de Taille (IA, non suspendue) : effets posés, Action rendue, et le balayage de la machine suit', () => {
    // LDB 85 l.362 : « Toutes les frappes réussies activent la règle optionnelle Frappe Mortelle » — la
    // queue non suspendue d'une manœuvre gratuite est la MÊME écriture que celle de la reprise,
    // enchaînement compris (la queue inline de `applyFreeAttack` n'en jouait, elle, que la moitié).
    const monte = (voisine: boolean): { ogre: Combatant; h1: Combatant; h2: Combatant } => {
      const ogre = mk('enemy', 'ogre', {
        pos: { x: 5, y: 5 }, size: 'enorme', characteristics: { ...CHARS, 'capacite-de-combat': 90 },
        weapons: [griffe], advantage: 3, traits: [{ id: 'attaque-caudale', value: 9 }], pendingFreeAttacks: ['caudale'],
      } as never);
      const h1 = mk('hero', 'h1', { pos: { x: 5, y: 6 }, characteristics: nul(), aiControlled: true } as never);
      const h2 = mk('hero', 'h2', { pos: { x: 4, y: 5 }, characteristics: nul(), aiControlled: true } as never);
      setBattle(voisine ? [ogre, h1, h2] : [ogre, h1]);
      seedBattleRng(4);
      aiCreatureFreeAttacks(useGame.getState, useGame.setState, ogre);
      return { ogre, h1, h2 };
    };

    // (a) SEULE cible : rien à balayer — l'Action gratuite est rendue et les effets de la manœuvre posés.
    const seul = monte(false);
    const vuA = (useGame.getState().battle?.log ?? []).map((l) => l.text).join(' | ');
    expect(useGame.getState().battle!.acted, 'une manœuvre GRATUITE ne consomme pas l’Action').toBe(false);
    expect(seul.h1.wounds.current, `la manœuvre a porté — ${vuA}`).toBeLessThan(30);
    expect(seul.h1.conditions.find((c) => c.id === 'a-terre'), 'Attaque caudale (LDB 85 l.47) : À Terre sur une cible plus petite').toBeDefined();

    // (b) Une 2ᵉ cible adjacente : le balayage de la machine suit le coup, comme après tout coup de l'IA.
    const avecVoisine = monte(true);
    const vuB = (useGame.getState().battle?.log ?? []).map((l) => l.text).join(' | ');
    expect(avecVoisine.h2.wounds.current, `le balayage de la machine suit la manœuvre — ${vuB}`).toBeLessThan(30);
  });

  it('(vii) La MALADRESSE du défenseur est due même sur un maillon de balayage repris (LDB 14 l.19)', () => {
    const ogre = mk('enemy', 'ogre', { pos: { x: 5, y: 5 }, characteristics: { ...CHARS, 'capacite-de-combat': 90 }, size: 'enorme', weapons: [griffe] } as never);
    const h1 = mk('hero', 'h1', { pos: { x: 5, y: 6 }, characteristics: nul(), weapons: [epee], traits: [{ id: 'protection', value: 6 }] } as never);
    const h2 = mk('hero', 'h2', { pos: { x: 4, y: 5 }, characteristics: nul(), aiControlled: true } as never);
    setBattle([ogre, h1, h2]);
    seedBattleRng(4);
    // Parade RATÉE sur un DOUBLE (66) : « tout Test de combat qui est un échec et dont le résultat du jet
    // est un double est une Maladresse » (LDB 14 l.19) — due que ce coup soit un maillon de chaîne ou non.
    const rate = { ...touche(), defenderDetail: { roll: 66, target: 20, success: false, sl: -4 } } as AttackResult;
    useGame.setState({ pendingDefense: { attackerId: ogre.id, defenderId: h1.id, weapon: griffe, mode: 'parade', result: rate, suite: { mode: 'machine', coup: { enchainement: { mode: 'chaine', hitIds: [h1.id], n: 0, bcc: 2, fm: false } } } } as never });
    useGame.getState().defenseConfirm();
    sauvegardeEnCours(h1);
    poser(5); // < 6 : le coup porte sur h1 → Maladresse DUE, puis la chaîne parquée reprend
    const etapes = useGame.getState().pendingCascade?.participants ?? [];
    expect(etapes.filter((s) => s.kind === 'fumbleJet' && s.actorId === h1.id),
      `la Maladresse de h1 est poussée — étapes vues : ${etapes.map((s) => s.kind).join(', ')}`).toHaveLength(1);
    const coups = (useGame.getState().battle?.log ?? []).map((l) => l.text).filter((x) => /^ogre touche/.test(x));
    expect(coups.filter((x) => /h2/.test(x)).length, `la chaîne reprend tout de même sur h2 — ${coups.join(' | ')}`).toBe(1);
  });

  it('(viii) TIR RAPIDE d’INTERRUPTION sur un porteur de sauvegarde : la cascade-hôte n’est pas détruite, et le tour n’avance pas', () => {
    const arcTireur = { uid: 'a', label: 'Arc', type: 'ranged', damage: { plusBF: false, flat: 7 }, range: 30, qualities: [], loaded: true } as unknown as Weapon;
    const tireur = mk('hero', 'tireur', { pos: { x: 0, y: 0 }, weapons: [arcTireur], talents: [{ talentId: 'tir-rapide', times: 1 }] } as never);
    // Indice 10 : la sauvegarde ne passe qu'à 10 — le dé, POSÉ D'OFFICE (aucun siège ne tient le démon
    // pendant la pause de début de Round), rate, et la reprise applique le coup.
    const demon = mk('enemy', 'demon', { pos: { x: 3, y: 0 }, characteristics: nul(), traits: [{ id: 'protection', value: 10 }] } as never);
    setBattle([tireur, demon]);
    seedBattleRng(2);
    // Pause de début de Round : le tireur n'est PAS actif (l'interruption est hors de l'ordre, LDB 11 l.97-103).
    useGame.setState({ pendingRoundStart: { round: 2, promoted: null } as never });
    useGame.getState().preemptRangedShot(tireur.id, demon.id);
    const pa = useGame.getState().pendingAttack;
    expect(pa?.interrupt, 'le tir d’interruption a bien ouvert sa cascade-hôte').toBe(true);
    useGame.setState({ pendingAttack: { ...pa!, result: touche() } as never });
    const tourAvant = useGame.getState().battle!.turn;
    useGame.getState().attackConfirm();
    // Le coup a été SUSPENDU par la sauvegarde poussée DANS la cascade-hôte : refermer celle-ci d'office
    // l'aurait emportée avec le coup — le tir n'aurait JAMAIS été appliqué.
    expect(demon.wounds.current, 'le tir d’interruption s’applique, à travers sa sauvegarde').toBeLessThan(30);
    expect(tireur.loseNextAction, 'le PRIX du tir est dû quelle que soit l’issue').toBe(true);
    expect(tireur.loseNextMovement, 'le PRIX du tir est dû quelle que soit l’issue').toBe(true);
    expect(useGame.getState().pendingCascade, 'la cascade se referme par ses propres étapes, une fois épuisées').toBeNull();
    expect(useGame.getState().pendingRoundStart, 'toujours à la pause de début de Round').not.toBeNull();
    expect(useGame.getState().battle!.turn, 'aucun tour avancé').toBe(tourAvant);
  });
});

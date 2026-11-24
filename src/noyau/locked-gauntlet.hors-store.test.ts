/** AA 08 l.234-238 */
import { describe, it, expect, beforeEach } from 'vitest';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { aiHandGate, applyBladeTrap, applyCriticalToTarget, openAttackCascade } from './combatFlow';
import { resolveCritique } from '../engine/critical';
import { desDuTest, desEnSuite } from '../engine/dice.testkit';
import { seedBattleRng } from './battleRng';
import { gestesDeLObjet } from './gestesDeLObjet';
import { ficheDuPorteur } from './ficheDuPorteur';
import { auContact, heroDuDuel, ouvrirLeCombat, reluDans } from './combatDeTest.testkit';
import { testScene } from '../scenes/test-fixture';
import { idsDeTest } from '../engine/idsDeTest.testkit';
import { itemFromTrappingById } from '../engine/items';
import { applyOps } from '../engine/ops';
import { activeCharTestMod, tickDurations } from '../engine/conditions';
import type { Combatant, Main } from '../engine/types';
import type { GesteDuNoyau } from './actionsDuNoyau';
import type { BladeTrapFreeze } from './pendings';

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });

/** Le héros du duel (Arme simple en main d'arme, Dague en main secondaire) au groupe, hors combat, `n` gantelets
 *  verrouillés au sac, d'uids `g1`, `g2`… */
function auGroupe(n: number): void {
  const h = heroDuDuel();
  const gantelets = Array.from({ length: n }, (_, i) => ({ ...itemFromTrappingById('gantelet-verrouille', idsDeTest)!, uid: `g${i + 1}` }));
  h.items = [...(h.items ?? []), ...gantelets];
  banc.setState({ screen: 'campaign', party: [h] });
}

const heros = (): Combatant => banc.getState().party[0];
const jouer = (g: GesteDuNoyau): void => (banc.getState()[g.verbe] as (...a: unknown[]) => void)(...g.args);

/** Le geste « porter » que la fiche offre pour l'objet `uid`, joué. */
function porter(uid: string): void {
  const porter = gestesDeLObjet(banc.getState(), heros().id, uid)?.porter;
  expect(porter, `${uid} se porte`).toBeTruthy();
  expect(porter!.refus).toBeNull();
  jouer(porter!.geste);
}

/** Le geste qui tient l'objet `uid` en main `main`, joué. */
function tenir(uid: string, main: Main): void {
  const mains = gestesDeLObjet(banc.getState(), heros().id, uid)?.mains;
  expect(mains?.[main].refus).toBeNull();
  jouer(mains![main].geste);
}

/** Le duel ouvert avec le groupe tel qu'équipé ; rend le héros et son adversaire. */
function auCombat(): { H: () => Combatant; E: Combatant } {
  ouvrirLeCombat(banc, testScene(), banc.getState().party, 'enc-mutants');
  const { H, E, patch } = auContact(banc.getState());
  banc.setState(patch);
  return { H: () => reluDans(banc.getState, H), E };
}

const armeEn = (c: Combatant, main: Main) => c.weapons.find((w) => w.hand === main)!;
const tient = (c: Combatant, uid: string) => c.weapons.some((w) => w.uid === uid);
const malusCC = (c: Combatant, main: Main) => activeCharTestMod(c, 'capacite-de-combat', { weaponHand: main });

/** Piège-lame gagné par `E` contre l'arme `uid` de `H`, marge nette 2 : désarmement sans casse (LDB 62 l.280). */
function piegeALame(H: Combatant, E: Combatant, uid: string): void {
  const bt: BladeTrapFreeze = { attackerId: H.id, weaponUid: uid, defSL: 0, attackerSL: 0 };
  applyBladeTrap(banc.getState, banc.setState, E, bt, 2);
}

/** Un Critique qui fait lâcher l'objet tenu au bras touché. */
const critiqueQuiDesarme = (c: Combatant, main: Main): void => {
  applyOps(c, [{ op: 'disarm' }], { idNeuf: idsDeTest, rng: desDuTest, location: main === 'main' ? 'brasD' : 'brasG' });
};

describe('Gantelet verrouillé : la fiche le porte', () => {
  it('le geste « porter » l’offre et le porte ; un troisième ôte le premier', () => {
    auGroupe(3);
    porter('g1');
    porter('g2');
    porter('g3');
    const portes = heros().items!.filter((i) => i.equipped && i.uid.startsWith('g')).map((i) => i.uid);
    expect(portes).toEqual(['g2', 'g3']);
  });

  it('la fiche dit le gantelet porté équipé', () => {
    auGroupe(1);
    porter('g1');
    expect(ficheDuPorteur(banc.getState(), heros().id)!.possessions.find((p) => p.uid === 'g1')?.equipee).toBe(true);
  });

  it('porter un gantelet tenu le retire de la main : il ne couvre qu’une main, l’arme de la main d’arme reste retenue', () => {
    auGroupe(1);
    tenir('g1', 'secondaire');
    porter('g1');
    const { H, E } = auCombat();
    expect(tient(H(), 'g1')).toBe(false);
    const arme = armeEn(H(), 'main').uid!;
    critiqueQuiDesarme(H(), 'main');
    expect(tient(H(), arme)).toBe(true);
    piegeALame(H(), E, arme);
    expect(tient(H(), arme)).toBe(false);
  });

  it('un gantelet porté ne se tient pas en main', () => {
    auGroupe(1);
    porter('g1');
    expect(gestesDeLObjet(banc.getState(), heros().id, 'g1')?.mains?.secondaire.refus).toBeTruthy();
  });

  it('un gantelet tenu compte au plafond de deux mains : en porter deux autres ôte le premier porté', () => {
    auGroupe(3);
    tenir('g1', 'secondaire');
    porter('g2');
    porter('g3');
    expect(heros().items!.filter((i) => i.equipped && i.uid.startsWith('g')).map((i) => i.uid)).toEqual(['g3']);
  });

  it('le plafond vaut pour chaque set : un gantelet tenu dans un autre set compte aussi', () => {
    auGroupe(3);
    const premier = heros().activeLoadoutId!;
    banc.getState().creerLaPanoplie(heros().id);
    tenir('g3', 'main');
    banc.getState().prendreLaPanoplie(heros().id, premier);
    porter('g1');
    porter('g2');
    expect(heros().items!.filter((i) => i.equipped && i.uid.startsWith('g')).map((i) => i.uid)).toEqual(['g2']);
  });

  it('deux gantelets tenus : un troisième ne se porte pas ; deux portés : un troisième ne se tient pas', () => {
    auGroupe(3);
    tenir('g1', 'main');
    tenir('g2', 'secondaire');
    expect(gestesDeLObjet(banc.getState(), heros().id, 'g3')?.porter?.refus).toBeTruthy();
    auGroupe(3);
    porter('g1');
    porter('g2');
    expect(gestesDeLObjet(banc.getState(), heros().id, 'g3')?.mains?.main.refus).toBeTruthy();
  });
});

// AA 07 l.117
describe('Main ensanglantée : le gantelet porté retient l’arme et l’Action se poursuit', () => {
  /** Le héros au combat, un gantelet porté, la main d'arme sous Main ensanglantée. */
  function gate(): { H: () => Combatant; E: Combatant; arme: string } {
    auGroupe(1);
    porter('g1');
    const { H, E } = auCombat();
    H().handGates = ['main'];
    return { H, E, arme: armeEn(H(), 'main').uid! };
  }

  it('joueur : Test raté, l’arme reste en main et l’attaque déclarée s’ouvre, à −20', () => {
    const { H, E, arme } = gate();
    openAttackCascade(banc.getState, banc.setState, { attackerId: H().id, targetId: E.id, location: null, result: null, weaponUid: arme }, 'Attaque', 'action/attaquer');
    const pg = banc.getState().pendingHandGate!;
    banc.setState({ pendingHandGate: { ...pg, roll: 99, success: false, sl: -3 } });
    banc.getState().jetValider('mainEnsanglantee');
    expect(tient(H(), arme)).toBe(true);
    expect(banc.getState().pendingAttack?.weaponUid).toBe(arme);
    expect(malusCC(H(), 'main')).toBe(-20);
  });

  it('IA : Test raté, l’arme reste en main et le coup se poursuit', () => {
    auGroupe(0);
    const { E } = auCombat();
    const ennemi = (): Combatant => reluDans(banc.getState, E);
    ennemi().items = [...(ennemi().items ?? []), { ...itemFromTrappingById('gantelet-verrouille', idsDeTest)!, uid: 'g1', equipped: true }];
    ennemi().handGates = ['main'];
    const armes = ennemi().weapons.map((w) => w.uid);
    for (let graine = 1; ; graine++) {
      expect(graine, 'une graine d’échec').toBeLessThan(50);
      seedBattleRng(graine);
      const poursuit = aiHandGate(banc.getState, banc.setState, ennemi());
      if (!banc.getState().battle!.log.some((e) => e.text.includes('→ échec'))) continue;
      expect(poursuit).toBe(true);
      expect(ennemi().weapons.map((w) => w.uid)).toEqual(armes);
      return;
    }
  });
});

describe.each([
  ['Piège-lame', (H: Combatant, E: Combatant, uid: string) => piegeALame(H, E, uid)],
  ['Critique qui désarme', (H: Combatant, _E: Combatant, uid: string) => critiqueQuiDesarme(H, H.weapons.find((w) => w.uid === uid)!.hand!)],
] as const)('%s : le gantelet porté retient l’arme de sa main', (_nom, lacher) => {
  it('un gantelet porté : l’arme de la main d’arme est retenue, −20 aux Tests de cette main seule', () => {
    auGroupe(1);
    porter('g1');
    const { H, E } = auCombat();
    const arme = armeEn(H(), 'main').uid!;
    lacher(H(), E, arme);
    expect(tient(H(), arme)).toBe(true);
    expect(malusCC(H(), 'main')).toBe(-20);
    expect(malusCC(H(), 'secondaire')).toBe(0);
  });

  it('un second évènement pendant la période : l’arme tombe, et la retenue avec elle', () => {
    auGroupe(1);
    porter('g1');
    const { H, E } = auCombat();
    const arme = armeEn(H(), 'main').uid!;
    lacher(H(), E, arme);
    lacher(H(), E, arme);
    expect(tient(H(), arme)).toBe(false);
    expect(malusCC(H(), 'main')).toBe(0);
  });

  it('le −20 tient le Round entamé et tout le Round suivant ; la période écoulée, un nouvel évènement est retenu à nouveau', () => {
    auGroupe(1);
    porter('g1');
    const { H, E } = auCombat();
    const arme = armeEn(H(), 'main').uid!;
    lacher(H(), E, arme);
    tickDurations(H());
    expect(malusCC(H(), 'main')).toBe(-20);
    tickDurations(H());
    expect(malusCC(H(), 'main')).toBe(0);
    lacher(H(), E, arme);
    expect(tient(H(), arme)).toBe(true);
  });

  it('sans gantelet, l’arme tombe', () => {
    auGroupe(0);
    const { H, E } = auCombat();
    const arme = armeEn(H(), 'main').uid!;
    lacher(H(), E, arme);
    expect(tient(H(), arme)).toBe(false);
  });

  it('un gantelet porté ne couvre pas la main secondaire : la Dague tombe', () => {
    auGroupe(1);
    porter('g1');
    const { H, E } = auCombat();
    const dague = armeEn(H(), 'secondaire').uid!;
    lacher(H(), E, dague);
    expect(tient(H(), dague)).toBe(false);
  });

  it('deux gantelets portés couvrent les deux mains : la Dague est retenue', () => {
    auGroupe(2);
    porter('g1');
    porter('g2');
    const { H, E } = auCombat();
    const dague = armeEn(H(), 'secondaire').uid!;
    lacher(H(), E, dague);
    expect(tient(H(), dague)).toBe(true);
    expect(malusCC(H(), 'secondaire')).toBe(-20);
    expect(malusCC(H(), 'main')).toBe(0);
  });

  it('un gantelet tenu comme arme couvre sa main', () => {
    auGroupe(1);
    tenir('g1', 'secondaire');
    const { H, E } = auCombat();
    expect(armeEn(H(), 'secondaire').uid).toBe('g1');
    lacher(H(), E, 'g1');
    expect(tient(H(), 'g1')).toBe(true);
    expect(malusCC(H(), 'secondaire')).toBe(-20);
  });
});

// AA 08 l.236, l.240
describe('La retenue dure tant que dure la circonstance du lâcher, un Round au moins', () => {
  /** Le Critique de bras droit tiré au `jet` (table du Livre de base), appliqué au héros. */
  function critiqueAuBras(H: Combatant, jet: number, id: string): void {
    const crit = resolveCritique('ldb', H, 'brasD', desEnSuite([jet], { boucle: true, borne: true }), { overkill: 0 });
    expect(crit.entryId).toBe(id);
    applyCriticalToTarget(H, 'brasD', 0, [], banc.setState, { prerolled: crit, get: banc.getState });
  }

  it('Cassure nette : le −20 dure jusqu’à l’Aide Médicale, puis s’éteint au Round suivant', () => {
    auGroupe(1);
    porter('g1');
    const { H } = auCombat();
    const arme = armeEn(H(), 'main').uid!;
    critiqueAuBras(H(), 53, 'cassure-nette');
    expect(tient(H(), arme)).toBe(true);
    for (let i = 0; i < 5; i++) tickDurations(H());
    expect(malusCC(H(), 'main')).toBe(-20);
    applyOps(H(), [{ op: 'aideMedicale' }], { idNeuf: idsDeTest, rng: desDuTest });
    tickDurations(H());
    expect(malusCC(H(), 'main')).toBe(0);
  });

  it('un Critique sans séquelle (Choc au bras) : le Round minimum seul', () => {
    auGroupe(1);
    porter('g1');
    const { H } = auCombat();
    critiqueAuBras(H(), 5, 'choc-au-bras');
    expect(H().activeEffects!.find((e) => e.testModHand === 'main')?.tantQue).toBeUndefined();
  });

  it('Clef de bras : le −20 dure autant que le bras inutilisable', () => {
    auGroupe(1);
    porter('g1');
    const { H } = auCombat();
    seedBattleRng(3);
    critiqueAuBras(H(), 43, 'clef-de-bras');
    const bras = H().activeEffects!.find((e) => e.passive?.some((o) => o.op === 'maxWeaponHands'))!;
    const retenue = H().activeEffects!.find((e) => e.testModHand === 'main')!;
    expect(retenue.duration).toEqual({ scale: 'rounds', left: Math.max(2, bras.duration.scale === 'rounds' ? bras.duration.left : 0) });
  });

  it('Main ensanglantée : le −20 dure tant que la main reste gatée', () => {
    auGroupe(1);
    porter('g1');
    const { H, E } = auCombat();
    H().handGates = ['main'];
    const arme = armeEn(H(), 'main').uid!;
    openAttackCascade(banc.getState, banc.setState, { attackerId: H().id, targetId: E.id, location: null, result: null, weaponUid: arme }, 'Attaque', 'action/attaquer');
    const pg = banc.getState().pendingHandGate!;
    banc.setState({ pendingHandGate: { ...pg, roll: 99, success: false, sl: -3 } });
    banc.getState().jetValider('mainEnsanglantee');
    for (let i = 0; i < 5; i++) tickDurations(H());
    expect(malusCC(H(), 'main')).toBe(-20);
    delete H().handGates;
    tickDurations(H());
    expect(malusCC(H(), 'main')).toBe(0);
  });
});

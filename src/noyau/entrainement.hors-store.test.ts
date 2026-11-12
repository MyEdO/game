/**
 * Entraînement (LDB 23 l.130-136) : Compétence de Base/Caractéristique hors carrière — PX + 1D10 sc,
 * Compétence Avancée — tuteur doublé. PAS de jet (achat direct, comme Passer commande/Banque).
 */
import { idsDeTest } from '../engine/idsDeTest.testkit';
import { describe, it, expect, beforeEach } from 'vitest';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { draineCascade } from './cascade.testkit';
import { createHero } from '../engine/character';
import { makeRNG, roll as rollDice } from '../engine/dice';
import { toBrass, fromBrass } from '../engine/money';
import { partyMoneyTotal, creditBourse, debitBourse } from './bourseFlow';
import { bourseOf } from '../engine/bourse';
import { advanceCost } from '../engine/advancement';
import { cleDEntrainement, entrainementOptions, type EntrainementOption } from '../engine/activities';
import { testScene } from '../scenes/test-fixture';
import { memeSpecialisation } from '../data/schemas/grammaire/ref';
import { pratiquer } from './interlude.testkit';

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });

function setup() {
  const h = createHero({ idNeuf: idsDeTest, speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', seed: 1 });
  banc.setState({ party: [h], battle: null, interlude: null, bank: [], pendingOrders: [], pendingActivity: null, journal: [] });
  banc.getState().lancerLaScene(testScene());
  creditBourse(banc.getState, banc.setState, h.id, fromBrass(20000));
  banc.getState().ensemencerLeTirage(13);
  banc.getState().ouvrirLInterlude(3);
  draineCascade(banc.getState); // les dés d'Événement sont des étapes de séquence : elle se joue avant les Activités
  const itl = banc.getState().interlude!;
  itl.perHero[h.id] = { ...itl.perHero[h.id], fx: undefined, left: 3 };
  banc.setState({ interlude: { ...itl } });
  return h.id;
}

function hero() { return banc.getState().party[0]; }
function st(heroId: string) { return banc.getState().interlude!.perHero[heroId]; }
/** Une option de Base et une Avancée disponibles pour CE héros — recalculées après chaque achat. */
function pickSkill(advanced: boolean): EntrainementOption {
  const o = entrainementOptions(hero()).find((x) => x.kind === 'competence' && x.advanced === advanced);
  if (!o) throw new Error('aucune option de skill trouvée pour ce test');
  return o;
}
function pickChar(): EntrainementOption {
  const o = entrainementOptions(hero()).find((x) => x.kind === 'caracteristique');
  if (!o) throw new Error('aucune Caractéristique hors carrière trouvée pour ce test');
  return o;
}

describe('Entraînement (LDB 23 l.130-136)', () => {
  it('Compétence de Base hors carrière : coût EXACT = PX doublé hors carrière (LDB 07 l.91) + 1d10 sc de tuteur (le d10 SEEDÉ)', () => {
    const heroId = setup();
    hero().xp = 2000;
    const opt = pickSkill(false);
    const xpBefore = hero().xp!;
    const moneyBefore = toBrass(partyMoneyTotal(banc.getState));
    const leftBefore = st(heroId).left;
    // Re-seed juste avant l'action : le tirage du tuteur est le PREMIER jet consommé depuis là.
    banc.getState().ensemencerLeTirage(42);
    const expectedTutor = rollDice(1, 10, makeRNG(42));
    pratiquer(banc.getState, heroId, 'entrainement', { entrainement: cleDEntrainement(opt) });
    const h = hero();
    const owned = h.skills.find((s) => s.id === opt.id && memeSpecialisation(s.spec, opt.spec));
    expect(owned?.advances).toBe(opt.advances + 1);
    expect(h.xp).toBe(xpBefore - opt.xpCost);
    expect(opt.xpCost).toBe(advanceCost(opt.advances, 'competence', false));
    expect(toBrass(partyMoneyTotal(banc.getState))).toBe(moneyBefore - expectedTutor);
    expect(st(heroId).left).toBe(leftBefore - 1);
  });

  it('Compétence Avancée : le tutorat coûte le DOUBLE du montant (l.135) — le PX, lui, n’est pas re-doublé', () => {
    const heroId = setup();
    hero().xp = 2000;
    const opt = pickSkill(true);
    const xpBefore = hero().xp!;
    const moneyBefore = toBrass(partyMoneyTotal(banc.getState));
    banc.getState().ensemencerLeTirage(42);
    const expectedTutor = rollDice(1, 10, makeRNG(42)) * 2;
    pratiquer(banc.getState, heroId, 'entrainement', { entrainement: cleDEntrainement(opt) });
    const h = hero();
    const owned = h.skills.find((s) => s.id === opt.id && memeSpecialisation(s.spec, opt.spec));
    expect(owned?.advances).toBe(opt.advances + 1);
    expect(h.xp).toBe(xpBefore - opt.xpCost);
    expect(opt.xpCost).toBe(advanceCost(opt.advances, 'competence', false)); // même coût PX que la Base
    expect(toBrass(partyMoneyTotal(banc.getState))).toBe(moneyBefore - expectedTutor);
  });

  it('Caractéristique hors carrière : +1 à la valeur, tuteur simple (non doublé)', () => {
    const heroId = setup();
    hero().xp = 2000;
    const opt = pickChar();
    const charKey = opt.id as import('../engine/types').CharKey;
    const charBefore = hero().characteristics[charKey];
    const xpBefore = hero().xp!;
    const moneyBefore = toBrass(partyMoneyTotal(banc.getState));
    banc.getState().ensemencerLeTirage(7);
    const expectedTutor = rollDice(1, 10, makeRNG(7));
    pratiquer(banc.getState, heroId, 'entrainement', { entrainement: cleDEntrainement(opt) });
    const h = hero();
    expect(h.characteristics[charKey]).toBe(charBefore + 1);
    expect(h.xp).toBe(xpBefore - opt.xpCost);
    expect(opt.xpCost).toBe(advanceCost(opt.advances, 'caracteristique', false));
    expect(toBrass(partyMoneyTotal(banc.getState))).toBe(moneyBefore - expectedTutor);
  });

  it('refuse une Caractéristique DE la carrière (Capacité de Combat, Soldat niv.1) — sans jet, sans coût', () => {
    const heroId = setup();
    hero().xp = 2000;
    const moneyBefore = toBrass(partyMoneyTotal(banc.getState));
    const before = hero().characteristics['capacite-de-combat'];
    pratiquer(banc.getState, heroId, 'entrainement', { entrainement: 'capacite-de-combat' });
    expect(hero().characteristics['capacite-de-combat']).toBe(before);
    expect(hero().xp).toBe(2000);
    expect(toBrass(partyMoneyTotal(banc.getState))).toBe(moneyBefore);
  });

  it('PX insuffisants : rien n’est débité, aucune Augmentation posée', () => {
    const heroId = setup();
    const opt = pickSkill(false);
    hero().xp = opt.xpCost - 1;
    const moneyBefore = toBrass(partyMoneyTotal(banc.getState));
    const leftBefore = st(heroId).left;
    pratiquer(banc.getState, heroId, 'entrainement', { entrainement: cleDEntrainement(opt) });
    expect(hero().skills.find((s) => s.id === opt.id && memeSpecialisation(s.spec, opt.spec))).toBeUndefined();
    expect(hero().xp).toBe(opt.xpCost - 1);
    expect(toBrass(partyMoneyTotal(banc.getState))).toBe(moneyBefore);
    expect(st(heroId).left).toBe(leftBefore);
  });

  it('bourse insuffisante pour le tuteur : rien n’est débité, aucune Augmentation posée', () => {
    const heroId = setup();
    hero().xp = 2000;
    const opt = pickSkill(false);
    debitBourse(banc.getState, banc.setState, heroId, bourseOf(hero())); // vide la bourse : ne couvre même pas 1 sc
    const leftBefore = st(heroId).left;
    pratiquer(banc.getState, heroId, 'entrainement', { entrainement: cleDEntrainement(opt) });
    expect(hero().skills.find((s) => s.id === opt.id && memeSpecialisation(s.spec, opt.spec))).toBeUndefined();
    expect(hero().xp).toBe(2000);
    expect(st(heroId).left).toBe(leftBefore);
  });

  it('consomme le budget d’Activités comme les autres (left −1) ; refusé, et dit, à 0', () => {
    const heroId = setup();
    hero().xp = 2000;
    const opt = pickSkill(false);
    const itl = banc.getState().interlude!;
    itl.perHero[heroId] = { ...st(heroId), left: 0 };
    banc.setState({ interlude: { ...itl } });
    pratiquer(banc.getState, heroId, 'entrainement', { entrainement: cleDEntrainement(opt) });
    expect(hero().skills.find((s) => s.id === opt.id && memeSpecialisation(s.spec, opt.spec))).toBeUndefined();
    expect(st(heroId).left).toBe(0);
    expect(banc.getState().journal.slice(-1)[0]).toBe('H n’a plus d’Activité d’interlude.');
  });
});

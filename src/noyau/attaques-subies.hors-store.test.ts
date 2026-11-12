/**
 * La série d'attaques subies hors bataille (#3892) : l'op `attaquesSubies` appliquée par l'effet de scène `ops`, `battle`
 * nul, ouvre son dé `nombre` à la porte (`nombreDAttaquesSubies`) ; le dé tombé, la Défense du héros s'ouvre par la
 * chaîne d'une attaque d'ennemi (`doAttack` → `maybeOpenDefense`) et se ferme par `jetValider('defense')` ; refusée, le coup
 * se résout par `resolveAttack`. MDG 15
 * l.163-164, l.177-178 ; `.claude/rules/moteur-et-flux.md:13`.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { horsBataille } from './coupHorsBataille.testkit';
import { imposerLesD100 } from './battleRng.testkit';
import { battleRng } from './battleRng';
import { applyEffects, EFFECT_HANDLERS, type EffectRefCtx } from './combatEffects';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { heroFaceAUnEnnemi } from './combatDeTest.testkit';
import { fermerLaSerieSubie } from './combatFlow';
import { refusDeSauvegarde } from './persistance/save';
import { applyOps } from '../engine/ops';
import { touchActors } from './combatOrParty';
import { fenetreDeDefense } from './fenetreDeDefense';
import { porteurParId } from './monde/combatants';
import { testScene } from '../scenes/test-fixture';
import { entreeEnRencontre } from '../engine/persistence';
import type { Effect } from '../data/schemas/defs-scenes/effets';
import { t } from '../i18n';
import { gameOpSchema } from '../data/schemas/grammaire/mecanique';
import { ligneDuCoup } from '../engine/combat';
import { resetRule, setRule } from '../engine/policy';

afterEach(() => {
  vi.restoreAllMocks();
  resetRule('combat-cible-inconsciente');
});

const rats = { type: 'statblock', label: 'Rats géants', char: { 'capacite-de-combat': 35 }, traits: [{ id: 'arme', value: 5 }] };
const op = gameOpSchema.parse({ op: 'attaquesSubies', assaillant: { statblock: rats }, nombre: '1d10' });
const attaques = (on: 'hero' | 'party', heroId?: string): Effect => ({ type: 'ops', on, ...(heroId ? { heroId } : {}), ops: [op] });

/** Le héros du groupe, aucune bataille, l'op appliquée : le dé `nombre` ouvert à la porte, non tombé. */
function deOuvert() {
  const { banc, H } = horsBataille(testScene());
  applyEffects(banc.getState, banc.setState, [attaques('hero', H.id)]);
  return { banc, H, etape: banc.getState().pendingCascade!.participants[0] };
}

/** La série ouverte : le dé `nombre` POSÉ à `nombre` (7) à la porte, les d100 de la série imposés (`des`). */
function serieOuverte(des: number[] = [65, 23], nombre = 7) {
  const { banc, H, etape } = deOuvert();
  imposerLesD100(...des);
  banc.getState().jetImposerLeResultat('cascadeTirage', nombre, etape.id);
  banc.getState().jetValider('cascade');
  return { banc, H };
}

/** L'état que l'application de l'op ne doit pas toucher quand elle est refusée. */
const etatTouche = (s: ReturnType<Banc['getState']>) =>
  ({ party: s.party, battle: s.battle, serieSubie: s.serieSubie, pendingCascade: s.pendingCascade, pendingDefense: s.pendingDefense });

describe('série d’attaques subies hors bataille (#3892)', () => {
  it('le dé `nombre` passe par la porte : étape à dé nu du héros, aucune série avant qu’il tombe', () => {
    const { banc, H, etape } = deOuvert();
    expect(etape).toMatchObject({ kind: 'nombreDAttaquesSubies', actorId: H.id, de: { spec: { n: 1, sides: 10 } } });
    expect(etape.meta).toMatchObject({ differeLaSuite: true, attaquesSubies: [op] });
    expect(banc.getState().serieSubie).toBeNull();
    expect(banc.getState().party[0]).toBe(H);
  });

  it('pose `serieSubie` au dé tombé : l’assaillant né du statbloc, `restantes` = le d10 posé, le héros sous sa forme de rencontre', () => {
    const { banc, H } = serieOuverte();
    const s = banc.getState();
    expect(s.battle).toBeNull();
    expect(s.serieSubie).toMatchObject({ cibleId: H.id, restantes: 7, avant: H });
    expect(s.serieSubie!.assaillant).toMatchObject({ label: 'Rats géants', kind: 'enemy' });
    expect(s.serieSubie!.assaillant.pos).toBeUndefined();
    expect(s.party[0]).not.toBe(H);
    expect(s.party[0]).toEqual(entreeEnRencontre(H));
  });

  it('`porteurParId` rend l’assaillant de la série', () => {
    const { banc } = serieOuverte();
    const s = banc.getState();
    expect(porteurParId(s, s.serieSubie!.assaillant.id)).toBe(s.serieSubie!.assaillant);
  });

  it('la Défense du héros s’ouvre : `pendingDefense` posé, fenêtre de Défense non nulle', () => {
    const { banc, H } = serieOuverte();
    const s = banc.getState();
    expect(s.pendingDefense).toMatchObject({ attackerId: s.serieSubie!.assaillant.id, defenderId: H.id });
    expect(fenetreDeDefense(s)).toMatchObject({ attaquantId: s.serieSubie!.assaillant.id, defenseurId: H.id });
  });

  it('deux cibles (« on: party », deux héros) : refus, aucun état posé', () => {
    const { banc, H } = horsBataille(testScene());
    banc.setState({ party: [H, { ...structuredClone(H), id: 'second', label: 'Second' }] });
    expect(() => applyEffects(banc.getState, banc.setState, [attaques('party')])).toThrow(t('eff.attaquesSubiesSansCibleUnique', { on: 'party' }));
    const s = banc.getState();
    expect(s.serieSubie).toBeNull();
    expect(s.pendingDefense).toBeNull();
  });

  it('deux ops `attaquesSubies` dans la même feuille : refus, au lancer comme à l’éditeur', () => {
    const { banc, H } = horsBataille(testScene());
    const feuille: Extract<Effect, { type: 'ops' }> = { type: 'ops', on: 'hero', heroId: H.id, ops: [op, op] };
    const message = t('eff.attaquesSubiesUneParFeuille', { on: 'hero', n: 2 });
    expect(EFFECT_HANDLERS.ops.refs!(feuille, {} as EffectRefCtx)).toEqual([{ level: 'error', message }]);
    const avant = etatTouche(banc.getState());
    expect(() => applyEffects(banc.getState, banc.setState, [feuille])).toThrow(message);
    expect(etatTouche(banc.getState())).toEqual(avant);
  });

  it('en bataille : refus nommé, aucun état posé', () => {
    const banc = ouvrirLeBanc();
    const { H } = heroFaceAUnEnnemi(banc, testScene());
    const avant = etatTouche(banc.getState());
    expect(() => applyEffects(banc.getState, banc.setState, [attaques('hero', H.id)])).toThrow(t('eff.attaquesSubiesSerieEngagee'));
    expect(etatTouche(banc.getState())).toEqual(avant);
  });

  it('une série déjà ouverte : refus nommé, la série en cours n’est pas écrasée', () => {
    const { banc, H } = serieOuverte();
    const avant = etatTouche(banc.getState());
    expect(() => applyEffects(banc.getState, banc.setState, [attaques('hero', H.id)])).toThrow(t('eff.attaquesSubiesSerieEngagee'));
    expect(etatTouche(banc.getState())).toEqual(avant);
  });

  it('la sortie rend au groupe le héros d’avant, augmenté de ce qui sort de la rencontre', () => {
    const { banc, H } = serieOuverte();
    const enRencontre = banc.getState().party[0];
    enRencontre.engagedWith = ['quelquun'];
    enRencontre.wounds = { ...enRencontre.wounds, current: enRencontre.wounds.current - 2 };
    fermerLaSerieSubie(banc.getState, banc.setState);
    const s = banc.getState();
    expect(s.serieSubie).toBeNull();
    expect(s.party[0].engagedWith).toEqual(H.engagedWith);
    expect(s.party[0].wounds.current).toBe(H.wounds.current - 2);
  });

  /** Le héros lance sa Défense dans la fenêtre, le d100 `defense` POSÉ, puis la valide : rend le coup tranché. */
  function defendre(banc: Banc, defense: number) {
    const g = banc.getState;
    g().jetLancer('defense');
    g().jetImposerLeResultat('defense', defense);
    const res = g().pendingDefense!.result!;
    g().jetValider('defense');
    return res;
  }

  it('Défense surfacée perdue : le coup s’applique hors bataille, Blessures retirées, ligne au journal', () => {
    const { banc, H } = serieOuverte([20, 23]);
    const avant = banc.getState().party[0].wounds.current;
    const res = defendre(banc, 97);
    const s = banc.getState();
    expect(res.hit && !!res.woundsLost).toBe(true);
    expect(s.party[0].wounds.current).toBe(avant - res.woundsLost!);
    expect(s.journal).toContain(ligneDuCoup(res));
    expect(s.serieSubie).toMatchObject({ cibleId: H.id, restantes: 6 });
    expect(s.pendingDefense).toMatchObject({ attackerId: s.serieSubie!.assaillant.id, defenderId: H.id });
  });

  it('Défense surfacée gagnée : aucune Blessure, la ligne du coup au journal', () => {
    const { banc, H } = serieOuverte([20, 23]);
    const avant = banc.getState().party[0].wounds.current;
    const res = defendre(banc, 5);
    const s = banc.getState();
    expect(res.hit).toBe(false);
    expect(s.party[0].wounds.current).toBe(avant);
    expect(s.journal).toContain(ligneDuCoup(res));
    expect(s.serieSubie).toMatchObject({ cibleId: H.id, restantes: 6 });
    expect(s.pendingDefense).toMatchObject({ attackerId: s.serieSubie!.assaillant.id, defenderId: H.id });
  });

  it('série de 3 attaques jusqu’à son terme : une Défense par attaque, puis le héros rendu au groupe, Blessures reportées', () => {
    const { banc, H } = serieOuverte([20, 20, 20], 3);
    const perdue = defendre(banc, 97);
    expect(banc.getState().serieSubie).toMatchObject({ restantes: 2 });
    expect(defendre(banc, 5).hit).toBe(false);
    expect(banc.getState().serieSubie).toMatchObject({ restantes: 1 });
    expect(defendre(banc, 5).hit).toBe(false);
    const s = banc.getState();
    expect(perdue.hit && !!perdue.woundsLost).toBe(true);
    expect(s.serieSubie).toBeNull();
    expect(s.pendingDefense).toBeNull();
    expect(s.party[0].engagedWith).toEqual(H.engagedWith);
    expect(s.party[0].wounds.current).toBe(H.wounds.current - perdue.woundsLost!);
  });

  it('l’assaillant qui perd son Action (`loseTurn`) : l’attaque suivante est décomptée sans être jouée', () => {
    const { banc } = serieOuverte([20, 20], 3);
    applyOps(banc.getState().serieSubie!.assaillant, [{ op: 'loseTurn', what: 'action' }], { idNeuf: banc.getState().forgerUnId, rng: battleRng() });
    banc.setState(touchActors(banc.getState()));
    defendre(banc, 5);
    const s = banc.getState();
    expect(s.serieSubie).toMatchObject({ restantes: 1 });
    expect(s.serieSubie!.assaillant.loseNextAction).toBe(false);
    expect(s.journal).toContain(t('cf.perdLAction', { name: s.serieSubie!.assaillant.label }));
    expect(s.pendingDefense).not.toBeNull();
    defendre(banc, 5);
    expect(banc.getState().serieSubie).toBeNull();
  });

  it('la cible hors d’action avant la fin : la série se ferme au terme du coup en cours', () => {
    const { banc, H } = serieOuverte([20, 20]);
    const inconscient = gameOpSchema.parse({ op: 'condition', id: { id: 'inconscient' }, value: 1 });
    applyEffects(banc.getState, banc.setState, [{ type: 'ops', on: 'hero', heroId: H.id, ops: [inconscient] }]);
    expect(banc.getState().serieSubie).toMatchObject({ restantes: 7 });
    defendre(banc, 5);
    const s = banc.getState();
    expect(s.serieSubie).toBeNull();
    expect(s.pendingDefense).toBeNull();
    expect(s.party[0].conditions).toContainEqual({ id: 'inconscient', value: 1 });
  });

  it('la sauvegarde est refusée pendant la série', () => {
    const { banc } = serieOuverte();
    expect(refusDeSauvegarde(banc.getState(), 0)).toBe('combat');
  });

  it('héros qui ne peut pas se défendre (Inconscient, mort-auto) : aucune fenêtre, le coup résolu hors bataille : LDB 16 l.113', () => {
    const { banc, H } = horsBataille(testScene());
    setRule('combat-cible-inconsciente', 'mort-auto');
    const inconscient = gameOpSchema.parse({ op: 'condition', id: { id: 'inconscient' }, value: 1 });
    applyEffects(banc.getState, banc.setState, [{ type: 'ops', on: 'hero', heroId: H.id, ops: [inconscient] }, attaques('hero', H.id)]);
    imposerLesD100(20);
    banc.getState().jetImposerLeResultat('cascadeTirage', 7, banc.getState().pendingCascade!.participants[0].id);
    banc.getState().jetValider('cascade');
    const s = banc.getState();
    const assaillant = s.serieSubie!.assaillant;
    expect(s.pendingDefense).toBeNull();
    expect(s.party[0].wounds.current).toBe(0);
    expect(s.journal.join(' ')).toContain(t('cf.achevementSansDefense', { name: assaillant.label, foe: H.label }));
    expect(s.pendingFateSave).toMatchObject({ heroId: H.id, foeId: assaillant.id });
    expect(s.serieSubie).toMatchObject({ cibleId: H.id, restantes: 7 });
  });
});

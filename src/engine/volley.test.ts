import { describe, it, expect, afterEach } from 'vitest';
import { resolveVolley } from './volley';
import { causeDuCoupCritique, toucheAuJetPose } from './combat';
import { critiquesDuCoup, relanceLaLocalisation } from './critical';
import { crewTestSuccess } from './crewMorale';
import { setRule, resetRule } from './policy';
import type { RNG } from './dice';
import type { Combatant, ShipPoste } from './types';
import { deFixe } from './dice.testkit';

const gunner = (id: string, over: Partial<Combatant> = {}): Combatant =>
  ({ id, label: id, kind: 'npc', characteristics: { 'capacite-de-combat': 0, 'capacite-de-tir': 0, force: 0, endurance: 0, initiative: 0, agilite: 0, dexterite: 0, intelligence: 0, 'force-mentale': 0, sociabilite: 0 }, conditions: [], wounds: { current: 10, max: 10, base: 10 }, items: [], ...over }) as unknown as Combatant;

/** Pièce d'artillerie : Dégâts plats `flat`, qualités optionnelles, servie par `crewIds`. */
const poste = (crewIds: string[], flat = 14, qualities: { id: string; value?: number }[] = []): ShipPoste =>
  ({ side: 'tribord', item: { uid: 'gun-' + crewIds.join('') + flat, label: 'Canon', kind: 'ranged', subType: 'armes-de-siege', damage: { flat, plusBF: false }, range: 75, qualities }, crewIds }) as unknown as ShipPoste;

const ship = (): Combatant => ({ id: 'ship', label: 'Navire', kind: 'npc', bodyShape: 'vehicule', conditions: [], weapons: [] }) as unknown as Combatant;

const hull = (E: number, armourCorps = 0, wounds = 90): Combatant =>
  ({ id: 'target', label: 'Coque', kind: 'enemy', bodyShape: 'vehicule', characteristics: { 'capacite-de-combat': 0, 'capacite-de-tir': 0, force: 0, endurance: E, initiative: 0, agilite: 0, dexterite: 0, intelligence: 0, 'force-mentale': 0, sociabilite: 0 }, armour: { corps: armourCorps }, conditions: [], wounds: { current: wounds, max: 90, base: 90 } }) as unknown as Combatant;

/** Coque À PROFIL NAVAL (`profilNavalDe`) : la cogue du schéma `vehicles`. */
const navire = (wounds: number, blindage = 0): Combatant => ({ ...hull(40, blindage, wounds), creatureId: 'cogue' }) as Combatant;

const fixed = deFixe;

/** La volée, puis chaque coup né de son jet sur `cible`, comme `jouerLesTirsDeBordee` le fait naître. */
const volee = (postes: ShipPoste[], cible: Combatant, dr: number, success: boolean, crew: Combatant[], rng: RNG) =>
  resolveVolley(ship(), postes, dr, success, crew, rng).map((s) => ({ ...s, coup: toucheAuJetPose(s.tireur, cible, s.weapon, s.jet, s.jet.sl, { rng }) }));

describe('resolveVolley — la bordée RÉUTILISE le pipeline de tir (MDG 14 l.128)', () => {
  const target = () => hull(40); // BE 4

  it('pièce servie : Dégâts = arme + DR partagé − BE ; une pièce NON servie ne tire pas', () => {
    const r = volee([poste(['g1']), poste([])], target(), 3, true, [gunner('g1')], fixed(34));
    expect(r).toHaveLength(1); // seule la pièce servie tire
    expect(r[0].coup.damage).toBe(17); // 14 + 3
    expect(r[0].coup.woundsLost).toBe(13); // 17 − BE 4
  });

  it('« pour le meilleur et pour le pire » (l.128) : sur un Test RÉUSSI, un DR de 0 n’ajoute ni ne retire rien', () => {
    const r = volee([poste(['g1'])], target(), 0, true, [gunner('g1')], fixed(34));
    expect(r[0].coup.damage).toBe(14); // 14 + 0
    expect(r[0].coup.woundsLost).toBe(10); // 14 − BE 4
  });

  it('munition fusionnée : Dégâts de la munition s’appliquent (réutilise weaponWithAmmo)', () => {
    const g = gunner('g1', { items: [{ uid: 'boulet', label: 'Boulet', kind: 'ammo', subType: 'munition-de-siege', damage: { flat: 4, plusBF: false }, qualities: [], qty: 5 } as never] });
    const r = volee([poste(['g1'])], target(), 3, true, [g], fixed(34));
    expect(r[0].coup.damage).toBe(21); // 14 + 4 (boulet) + 3
    expect(r[0].ammo?.label).toBe('Boulet');
  });

  it('Perforante de la munition perce le Blindage de la Coque (MDG 12 l.232)', () => {
    const armored = () => navire(90, 4); // BE 4 + Blindage 4
    const plain = volee([poste(['g1'])], armored(), 3, true, [gunner('g1')], fixed(34));
    const perf = gunner('g1', { items: [{ uid: 'p', label: 'Carreau', kind: 'ammo', subType: 'munition-de-siege', damage: { flat: 0, plusBF: false }, qualities: [{ id: 'perforante' }], qty: 5 } as never] });
    const r = volee([poste(['g1'])], armored(), 3, true, [perf], fixed(34));
    expect(r[0].coup.woundsLost).toBeGreaterThan(plain[0].coup.woundsLost!); // Perforante réduit la PA → plus de Blessures
  });

  it('sous-effectif (Arme d’équipe 3 à 1 servant) → Imprécise : −1 DR sur la pièce', () => {
    const adE = [{ id: 'arme-d-equipe', value: 3 }];
    const full = volee([poste(['a', 'b', 'c'], 14, adE)], target(), 5, true, [gunner('a'), gunner('b'), gunner('c')], fixed(34));
    const short = volee([poste(['a'], 14, adE)], target(), 5, true, [gunner('a')], fixed(34));
    expect(short[0].coup.damage).toBe(full[0].coup.damage! - 1); // Imprécise (−1 DR) du sous-effectif
  });

  it('coque à 0 Blessure → tout coup est un Critique (MDG 13 l.656)', () => {
    const cible = navire(0);
    const r = volee([poste(['g1'])], cible, 3, true, [gunner('g1')], fixed(34));
    expect(r[0].coup.critical, '34 ≠ double : pas de Coup Critique').toBe(false);
    const compte = critiquesDuCoup(cible, { coupCritique: causeDuCoupCritique(r[0].coup), prise: true, current: 0, touche: true, relance: relanceLaLocalisation(cible, { coupCritique: causeDuCoupCritique(r[0].coup), prise: true, current: 0 }), blessures: r[0].coup.woundsLost ?? 0 });
    expect(compte.critiques.map((c) => c.origine)).toEqual(['a-zero']);
  });

  it('double sur le 1d100 → Critique', () => {
    const r = volee([poste(['g1'])], target(), 3, true, [gunner('g1')], fixed(33));
    expect(r[0].coup.critical).toBe(true);
  });
});

/**
 * Le Test d'équipage de Tir de batterie TIENT LIEU du jet de touche de chaque pièce (MDG 14 l.128) :
 * son succès (MDG 14 l.13) commande les Dégâts, les Atouts « Test réussi » (LDB 62 l.288) et le
 * Critique de navire (MDG 13 l.656 : « un jet d'attaque RÉUSSI … donne un double »). #1019
 */
describe('resolveVolley — Test d’équipage RATÉ : la bordée manque en bloc (MDG 14 l.13)', () => {
  const target = () => hull(40); // BE 4
  const POINTUE = [{ id: 'pointue' }];

  it('les pièces font feu (Recharge + munition consommables) mais n’infligent NI Dégâts NI Blessures', () => {
    const g = gunner('g1', { items: [{ uid: 'boulet', label: 'Boulet', kind: 'ammo', subType: 'munition-de-siege', damage: { flat: 4, plusBF: false }, qualities: [], qty: 5 } as never] });
    const r = volee([poste(['g1'])], target(), -1, false, [g], fixed(34));
    expect(r).toHaveLength(1); // la pièce a fait feu : l'appelant la décharge et consomme la munition
    expect(r[0].ammo?.uid).toBe('boulet');
    expect(r[0].coup.damage ?? 0).toBe(0);
    expect(r[0].coup.woundsLost ?? 0).toBe(0);
    expect(r[0].coup.hit).toBe(false);
  });

  it('Pointue (+1 DR « à tout Test réussi », LDB 62 l.288) est MUETTE sur un Test raté', () => {
    const sans = volee([poste(['g1'])], target(), -1, false, [gunner('g1')], fixed(34));
    const avec = volee([poste(['g1'], 14, POINTUE)], target(), -1, false, [gunner('g1')], fixed(34));
    expect(avec[0].coup.damage).toBe(sans[0].coup.damage);
    expect(avec[0].coup.damage ?? 0).toBe(0);
  });

  it('Pointue paie EN REVANCHE sur un Test réussi : +1 DR (non-régression)', () => {
    const sans = volee([poste(['g1'])], target(), 3, true, [gunner('g1')], fixed(34));
    const avec = volee([poste(['g1'], 14, POINTUE)], target(), 3, true, [gunner('g1')], fixed(34));
    expect(avec[0].coup.damage).toBe(sans[0].coup.damage! + 1);
  });

  it('AUCUN Critique sur un Test raté — ni sur un double de localisation, ni sur une coque à 0', () => {
    const dbl = volee([poste(['g1'])], target(), -1, false, [gunner('g1')], fixed(33)); // 33 = double
    expect(dbl[0].coup.critical).toBe(false);
    const sunk = volee([poste(['g1'])], navire(0), -1, false, [gunner('g1')], fixed(34));
    expect(sunk[0].coup.critical).toBe(false);
  });

  it('SONDE #1019 (DR d’équipage 3 / 1 / 0 / −1 / −20, pièce Pointue) : Dégâts nuls dès que le Test est raté', () => {
    const mesure = (dr: number) => volee([poste(['g1'], 14, POINTUE)], target(), dr, crewTestSuccess(dr), [gunner('g1')], fixed(34))[0].coup;
    expect(mesure(3).damage).toBe(18); // 14 + 3 + 1 (Pointue, Test réussi)
    expect(mesure(1).damage).toBe(16); // 14 + 1 + 1
    expect(mesure(0).damage ?? 0).toBe(0); // total 0 = échec par défaut (l.13)
    expect(mesure(-1).damage ?? 0).toBe(0);
    expect(mesure(-20).damage ?? 0).toBe(0); // sonde du juge : valait −5, Pointue payant sur un Test RATÉ
    expect(mesure(-20).woundsLost ?? 0).toBe(0);
  });
});

/**
 * Seuil de succès d'un Test d'équipage — MDG 14 l.13 : « Si le total est de 1 DR ou plus, le résultat
 * global est un succès. Le MJ peut aussi considérer un résultat de 0 comme un succès en fonction des
 * circonstances. » La seconde phrase est la règle optionnelle `crew-test-zero-success`.
 */
describe('crewTestSuccess — seuil de succès du Test d’équipage (MDG 14 l.13)', () => {
  afterEach(() => resetRule('crew-test-zero-success'));

  it('par défaut : 1 DR ou plus = succès, 0 = échec', () => {
    expect(crewTestSuccess(1)).toBe(true);
    expect(crewTestSuccess(4)).toBe(true);
    expect(crewTestSuccess(0)).toBe(false);
    expect(crewTestSuccess(-1)).toBe(false);
  });

  it('règle optionnelle « 0 DR compte comme un succès » : le 0 bascule, le négatif reste un échec', () => {
    setRule('crew-test-zero-success', true);
    expect(crewTestSuccess(0)).toBe(true);
    expect(crewTestSuccess(1)).toBe(true);
    expect(crewTestSuccess(-1)).toBe(false);
  });

  it('bordée à DR 0 : muette par défaut, portante sous l’option (les DEUX bords)', () => {
    const volleyAt0 = () => volee([poste(['g1'])], hull(40), 0, crewTestSuccess(0), [gunner('g1')], fixed(34));
    expect(volleyAt0()[0].coup.damage ?? 0).toBe(0); // défaut : 0 = échec → la bordée manque
    setRule('crew-test-zero-success', true);
    expect(volleyAt0()[0].coup.damage).toBe(14); // Succès Minime : 14 + 0
    expect(volleyAt0()[0].coup.woundsLost).toBe(10); // 14 − BE 4
  });
});

/**
 * Chaque coup de bordée est la touche d'un tir ordinaire, résolue selon sa CIBLE (MDG 14 l.128 « un ennemi »,
 * EDOC 07 l.332) : une créature encaisse à la localisation de son corps (LDB 11), BE + PA, Critique sur un
 * double (LDB 11), Percutante comptée (LDB 298) ; aucun gréement naval ne s'en mêle.
 */
describe('resolveVolley — une CRÉATURE ciblée encaisse comme sous un tir ordinaire', () => {
  const PA = 2;
  const pirate = (): Combatant =>
    ({ ...gunner('pirate', { kind: 'enemy' }), characteristics: { ...gunner('x').characteristics, endurance: 30 },
      armour: { tete: PA, brasG: PA, brasD: PA, corps: PA, jambeG: PA, jambeD: PA }, wounds: { current: 30, max: 30, base: 30 } }) as Combatant;
  const PERCUTANTE = [{ id: 'percutante' }];

  it('localisation corporelle, Blessures = Dégâts − BE − PA, Percutante ajoute le dé des unités', () => {
    const r = volee([poste(['g1'], 14, PERCUTANTE)], pirate(), 3, true, [gunner('g1')], fixed(34));
    expect(['tete', 'brasG', 'brasD', 'corps', 'jambeG', 'jambeD']).toContain(r[0].coup.location);
    expect(r[0].coup.damage).toBe(14 + 3 + 4); // Percutante : unités de 34
    expect(r[0].coup.woundsLost).toBe(14 + 3 + 4 - 3 - PA); // BE 3, PA 2 à toute localisation
    expect(r[0].coup.critical).toBe(false);
  });

  it('un double sur le jet posé → Critique ordinaire de personnage', () => {
    const r = volee([poste(['g1'])], pirate(), 3, true, [gunner('g1')], fixed(44));
    expect(r[0].coup.critical).toBe(true);
  });
});

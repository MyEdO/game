/**
 * LES FAITS DU COUP AU JET (#4574 lot 3, PR 2b), par le chemin produit (banc du noyau) : ce que la fenêtre d'attaque
 * prévoit (`fenetreDAttaque(s).issue.faits` : Localisation, Blessures plafonnées, armure de Taille, Avantage) est ce que
 * `jetValider('attaque')` applique, Avantage par combattant comme par camp (mode groupe), Porte-Bouclier compris ;
 * l'après-coup ne se prévoit que si aucun dé non tiré ne le précède ; le gain d'Avantage d'un vainqueur sans variation
 * marque quand même son gain du Round.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { initialNet, type BattleState } from './etat';
import { openAttackCascade } from './combatFlow';
import { fenetreDeDefense } from './fenetreDeDefense';
import { testScene } from '../scenes/test-fixture';
import { seedBattleRng } from './battleRng';
import { avanceEtapeCascade, cascadeDeTest } from './cascade.testkit';
import { fenetreDAttaque } from './fenetreDAttaque';
import { setRule, resetRule } from '../engine/policy';
import { advantageCampOf } from '../engine/advantagePool';
import { itemFromTrappingById, weaponFromItem } from '../engine/items';
import { idsDeTest } from '../engine/idsDeTest.testkit';
import { blessuresSurLeProfil, blessuresDeBase } from '../engine/combattantDeTest.testkit';
import type { AttackResult } from '../engine/combat';
import type { FaitApplique } from '../engine/faits';
import type { Combatant, HitLocation, Weapon } from '../engine/types';

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });
afterEach(() => resetRule('combat-aa-avantage-groupe'));
const g = () => banc.getState();

const CHARS = { 'capacite-de-combat': 45, 'capacite-de-tir': 30, force: 40, endurance: 40, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 };
/** La Hache de Hardi : Taille (LDB 62 l.307). */
const HACHE: Weapon = { label: 'Hache', type: 'melee', damage: { plusBF: true, flat: 0, bare: true }, qualities: [{ id: 'taille' }] };
const SHIELD: Weapon = { ...weaponFromItem(itemFromTrappingById('bouclier', idsDeTest)!), label: 'Bouclier', trappingId: 'bouclier', type: 'melee', qualities: [{ id: 'protectrice', value: 2 }] } as Weapon;

const mk = (id: string, kind: Combatant['kind'], over: Partial<Combatant> = {}): Combatant =>
  (blessuresSurLeProfil({
    id, name: id, label: id, kind, important: true, characteristics: { ...CHARS }, wounds: blessuresDeBase(30),
    advantage: 0, conditions: [], movement: 4, skills: [], talents: [], traits: [], engagedWith: [], size: 'moyenne',
    weapons: [], items: [], criticalWounds: 0, fate: 0, armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    ...over,
  }) as unknown as Combatant);

/** Hardi (héros, 1 Avantage, Hache) contre la Brute (ennemi, 2 Avantages, 2 PA de statbloc au Corps). */
const hardi = (over: Partial<Combatant> = {}) => mk('h1', 'heros', { weapons: [HACHE], advantage: 1, pos: { x: 0, y: 0 }, ...over });
const brute = (over: Partial<Combatant> = {}) => mk('e1', 'ennemi', { advantage: 2, pos: { x: 1, y: 0 }, armour: { tete: 0, brasG: 0, brasD: 0, corps: 2, jambeG: 0, jambeD: 0 }, ...over });

/** Le coup tranché de Hardi : touche au Corps, 3 Blessures, Test opposé gagné sur une Parade ratée sans double. */
const TOUCHE: AttackResult = {
  hit: true, attackerRoll: 23, defenderRoll: 75, netSL: 2, location: 'corps', damage: 7, woundsLost: 3, critical: false,
  advantageTo: 'attaquant', defenderDefeated: false, log: 'Touché',
  attackerDetail: { target: 45, roll: 23, sl: 2, success: true } as never,
  defenderDetail: { target: 45, roll: 75, sl: -3, success: false } as never,
};

/** L'attaque de `attaquant` sur `cible` en attente de validation, son coup `res` tombé ; `autres` au combat. */
function poserLAttaque(attaquant: Combatant, cible: Combatant, res: AttackResult, pools?: BattleState['advantagePools'], autres: Combatant[] = []): void {
  seedBattleRng(20261123);
  const combatants = [attaquant, cible, ...autres];
  const battle = {
    combatants, order: combatants.map((c) => c.id), baseOrder: combatants.map((c) => c.id),
    turn: 0, round: 1, action: null, selectedSpellId: null, reachable: new Map(),
    movementUsed: 0, movedPreAction: false, acted: false, log: [], over: null, ...(pools ? { advantagePools: pools } : {}),
  } as unknown as BattleState;
  banc.setState({
    battle, mode: 'battle', pendingDefense: null,
    pendingAttack: { attackerId: attaquant.id, targetId: cible.id, location: null, result: res },
    pendingCascade: cascadeDeTest([{ id: 'attack-jet', kind: 'jetDAttaque', jet: 'attaque', actorId: attaquant.id }], { title: 'Attaque', icon: 'action/attaquer', purpose: 'combat' }),
  });
}

interface Releve { avantage: Record<string, number>; reserves: Record<string, number>; blessures: Record<string, number>; armure: Record<string, number> }

/** L'état que les faits du coup décrivent : Avantage par combattant, réserves des camps, Blessures, PA par Localisation. */
function releve(): Releve {
  const b = g().battle!;
  const r: Releve = { avantage: {}, reserves: { ...(b.advantagePools ?? { allies: 0, adversaires: 0 }) }, blessures: {}, armure: {} };
  for (const c of b.combatants) {
    r.avantage[c.id] = c.advantage;
    r.blessures[c.id] = c.wounds.current;
    for (const [lieu, pa] of Object.entries(c.armour)) r.armure[`${c.id}/${lieu}`] = pa;
  }
  return r;
}

const ecart = (a: Record<string, number>, b: Record<string, number>): Record<string, number> =>
  Object.fromEntries(Object.keys(a).flatMap((k) => (b[k] - a[k] ? [[k, b[k] - a[k]]] : [])));

/** Les écarts que `faits` annoncent, sur les mêmes clés que `releve` : en mode groupe, l'Avantage va aux réserves. */
function annonces(faits: FaitApplique[], groupe: boolean): Omit<Releve, 'avantage' | 'reserves'> & { avantage: Record<string, number> } {
  const somme = (r: Record<string, number>, k: string, v: number) => { r[k] = (r[k] ?? 0) + v; };
  const out = { avantage: {} as Record<string, number>, blessures: {} as Record<string, number>, armure: {} as Record<string, number> };
  const porteurs = g().battle!.combatants;
  for (const f of faits) {
    if (f.genre === 'avantage') somme(out.avantage, groupe ? advantageCampOf(porteurs.find((c) => c.id === f.cible)!) : f.cible, f.valeur);
    if (f.genre === 'blessures') somme(out.blessures, f.cible, f.valeur);
    if (f.genre === 'objet' && 'armure' in f.objet) somme(out.armure, `${f.cible}/${f.objet.armure}`, f.valeur);
  }
  return out;
}

/** Prévoit, valide, et rend les faits prévus avec les écarts appliqués. */
function preverPuisValider(groupe = false, flux: 'attaque' | 'defense' = 'attaque'): { faits: FaitApplique[]; applique: ReturnType<typeof annonces> } {
  const faits = (flux === 'attaque' ? fenetreDAttaque(g()) : fenetreDeDefense(g()))!.issue!.faits;
  const avant = releve();
  g().jetValider(flux);
  const apres = releve();
  return { faits, applique: { avantage: groupe ? ecart(avant.reserves, apres.reserves) : ecart(avant.avantage, apres.avantage), blessures: ecart(avant.blessures, apres.blessures), armure: ecart(avant.armure, apres.armure) } };
}

const sur = (c: string, camp: 'groupe' | 'hostile') => ({ cible: c, camp });
const LOC = (lieu: HitLocation) => ({ genre: 'localisation', ...sur('e1', 'hostile'), valeur: lieu });

describe('la prévision d’attaque est ce que la validation applique', () => {
  it('par combattant : Localisation, Blessures, armure de Taille, +1 à l’attaquant, Avantage de la cible remis à 0', () => {
    poserLAttaque(hardi(), brute(), TOUCHE);
    const { faits, applique } = preverPuisValider();
    expect(faits).toEqual([
      LOC('corps'),
      { genre: 'blessures', ...sur('e1', 'hostile'), valeur: -3 },
      { genre: 'objet', ...sur('e1', 'hostile'), objet: { armure: 'corps' }, valeur: -1, issue: 'usee' },
      { genre: 'avantage', ...sur('h1', 'groupe'), valeur: 1, total: 2 },
      { genre: 'avantage', ...sur('e1', 'hostile'), valeur: -2, total: 0 },
    ]);
    expect(applique).toEqual(annonces(faits, false));
  });

  it('les Blessures prévues sont celles que la cible peut perdre', () => {
    poserLAttaque(hardi(), brute({ wounds: blessuresDeBase(30, 2) }), { ...TOUCHE, woundsLost: 5 });
    const { faits, applique } = preverPuisValider();
    expect(faits.filter((f) => f.genre === 'blessures')).toEqual([{ genre: 'blessures', ...sur('e1', 'hostile'), valeur: -2 }]);
    expect(applique.blessures).toEqual({ e1: -2 });
  });

  it('mode groupe : le gain va à la réserve du camp de l’attaquant, aucune remise à 0', () => {
    setRule('combat-aa-avantage-groupe', true);
    poserLAttaque(hardi(), brute(), TOUCHE, { allies: 1, adversaires: 2 });
    const { faits, applique } = preverPuisValider(true);
    expect(faits.filter((f) => f.genre === 'avantage')).toEqual([{ genre: 'avantage', ...sur('h1', 'groupe'), valeur: 1, total: 2 }]);
    expect(applique.avantage).toEqual({ allies: 1 });
    expect(applique.avantage).toEqual(annonces(faits, true).avantage);
  });

  it('mode groupe, défense gagnée : le défenseur gagne pour la réserve de son camp', () => {
    setRule('combat-aa-avantage-groupe', true);
    poserLAttaque(hardi(), brute(), { ...TOUCHE, hit: false, woundsLost: 0, advantageTo: 'defenseur', defenderDetail: { target: 45, roll: 12, sl: 3, success: true } as never }, { allies: 1, adversaires: 2 });
    const { faits, applique } = preverPuisValider(true);
    expect(faits).toEqual([{ genre: 'avantage', ...sur('e1', 'hostile'), valeur: 1, total: 3 }]);
    expect(applique.avantage).toEqual({ adversaires: 1 });
  });

  it('Porte-Bouclier (LDB 10 l.972) : la défense perdue au Bouclier rend ses Niveaux au défenseur', () => {
    poserLAttaque(hardi(), brute({ advantage: 0, talents: [{ talentId: 'porte-bouclier', times: 2 }], weapons: [SHIELD] }), { ...TOUCHE, parryWeapon: SHIELD });
    const { faits, applique } = preverPuisValider();
    expect(faits.filter((f) => f.genre === 'avantage')).toEqual([
      { genre: 'avantage', ...sur('h1', 'groupe'), valeur: 1, total: 2 },
      { genre: 'avantage', ...sur('e1', 'hostile'), valeur: 2, total: 2 },
    ]);
    expect(applique).toEqual(annonces(faits, false));
  });

  it('le vainqueur Distrait ne gagne rien, mais son gain du Round est marqué (LDB 10 l.364)', () => {
    poserLAttaque(hardi({ distractedRounds: 1 }), brute(), TOUCHE);
    const { faits, applique } = preverPuisValider();
    expect(faits.some((f) => f.genre === 'avantage' && f.cible === 'h1'), 'aucun Avantage gagné').toBe(false);
    expect(applique.avantage.h1).toBeUndefined();
    expect(g().battle!.combatants.find((c) => c.id === 'h1')!.gainedAdvThisRound).toBe(true);
  });
});

describe('borne de la prévision : l’après-coup suit un dé non tiré', () => {
  it('sans dé avant lui, l’après-coup se prévoit ; derrière un double défensif à la Parade, non', () => {
    poserLAttaque(hardi(), brute(), TOUCHE);
    expect(fenetreDAttaque(g())!.issue!.faits.filter((f) => f.genre === 'avantage' && f.cible === 'e1')).toEqual([{ genre: 'avantage', ...sur('e1', 'hostile'), valeur: -2, total: 0 }]);
    poserLAttaque(hardi(), brute(), { ...TOUCHE, parryWeapon: HACHE, defenderDetail: { target: 45, roll: 44, sl: 0, success: true } as never });
    expect(fenetreDAttaque(g())!.issue!.faits.filter((f) => f.genre === 'avantage')).toEqual([{ genre: 'avantage', ...sur('h1', 'groupe'), valeur: 1, total: 2 }]);
  });
});

describe('la prévision de défense est ce que la validation applique', () => {
  it('la Brute frappe Hardi, qui pare : les faits de la fenêtre de Défense sont les écarts de sa validation', () => {
    seedBattleRng(7);
    const battle = {
      combatants: [brute({ weapons: [HACHE] }), hardi({ weapons: [{ ...HACHE, uid: 'ha' }] })], order: ['e1', 'h1'], baseOrder: ['e1', 'h1'],
      turn: 0, round: 1, action: null, selectedSpellId: null, reachable: new Map(),
      movementUsed: 0, movedPreAction: false, acted: false, log: [], over: null,
    } as unknown as BattleState;
    banc.setState({ battle, mode: 'battle', scene: testScene(), pendingDefense: null, pendingAttack: null, pendingCascade: null, net: { ...initialNet(), mode: 'local', mySeat: 0, gmSeat: 0, ownership: {} } });
    openAttackCascade(g, banc.setState, { attackerId: 'e1', targetId: 'h1', location: null, result: null }, 'Attaque', 'action/attaquer');
    g().jetLancer('attaque');
    g().jetValider('attaque');
    g().jetLancer('defense');
    const res = g().pendingDefense!.result!;
    const { faits, applique } = preverPuisValider(false, 'defense');
    expect(faits.map((f) => [f.genre, f.cible]), `fixture : la touche de la Brute, gagnante (${res.advantageTo})`).toEqual([['localisation', 'h1'], ['blessures', 'h1'], ['avantage', 'e1'], ['avantage', 'h1']]);
    expect(applique).toEqual(annonces(faits, false));
  });
});

/** Le coup de Hardi au double : Coup Critique au Corps (LDB 13 l.183). */
const AU_DOUBLE: AttackResult = { ...TOUCHE, attackerRoll: 22, critical: true, critLocation: 'corps', attackerDetail: { target: 45, roll: 22, sl: 2, success: true } as never };

describe('la touche se prévoit sur le plan des Blessures critiques que l’application suivra', () => {
  it('l’automate dévie le Critique (LDB 63 l.30, l.32) : Blessures recomptées à PA−1, Taille sur la pièce entamée, après-coup prévu', () => {
    poserLAttaque(hardi(), brute(), { ...AU_DOUBLE, woundsLost: 1 });
    const { faits, applique } = preverPuisValider();
    expect(faits).toEqual([
      LOC('corps'),
      { genre: 'blessures', ...sur('e1', 'hostile'), valeur: -2 },
      { genre: 'objet', ...sur('e1', 'hostile'), objet: { armure: 'corps' }, valeur: -1, issue: 'usee' },
      { genre: 'avantage', ...sur('h1', 'groupe'), valeur: 1, total: 2 },
      { genre: 'avantage', ...sur('e1', 'hostile'), valeur: -2, total: 0 },
    ]);
    const { armure, ...horsArmure } = annonces(faits, false);
    expect({ ...applique, armure: {} }).toEqual({ ...horsArmure, armure: {} });
    expect(armure, 'la Taille de la touche ; la Déviation de l’automate a son étape').toEqual({ 'e1/corps': -1 });
    expect(applique.armure).toEqual({ 'e1/corps': -2 });
  });

  it('une cible tenue par un humain tranche sa Déviation : la touche ne prévoit que sa Localisation, et chaque choix applique autre chose', () => {
    const appliques = (['devier', 'subir'] as const).map((choix) => {
      poserLAttaque(brute({ weapons: [HACHE] }), hardi({ armour: { tete: 0, brasG: 0, brasD: 0, corps: 2, jambeG: 0, jambeD: 0 } }), { ...AU_DOUBLE, woundsLost: 1 });
      const faits = fenetreDAttaque(g())!.issue!.faits;
      expect(faits.filter((f) => f.genre !== 'avantage')).toEqual([{ genre: 'localisation', ...sur('h1', 'groupe'), valeur: 'corps' }]);
      const avant = releve();
      g().jetValider('attaque');
      const etape = g().pendingCascade!.participants[g().pendingCascade!.cursor];
      expect(etape.kind, 'fixture : la fenêtre de Blessure critique de Hardi').toBe('deviation');
      avanceEtapeCascade(g, () => 1, () => choix);
      const apres = releve();
      return { blessures: ecart(avant.blessures, apres.blessures), armure: ecart(avant.armure, apres.armure) };
    });
    expect(appliques[0]).not.toEqual(appliques[1]);
  });

  it('mort automatique (LDB 16 l.113) : la cible perd ses Blessures courantes, l’armure reste', () => {
    poserLAttaque(hardi(), brute({ wounds: blessuresDeBase(30, 12) }), { ...TOUCHE, autoKill: true, advantageTo: null, defenderDetail: undefined });
    const { faits, applique } = preverPuisValider();
    expect(faits).toEqual([LOC('corps'), { genre: 'blessures', ...sur('e1', 'hostile'), valeur: -12 }]);
    expect(applique).toEqual(annonces(faits, false));
  });
});

describe('la touche se prévoit après les modificateurs de touche que l’application joue', () => {
  it('Martyr (LDB 43 l.107) : le prêtre perd les Blessures, la cible garde les siennes et son Avantage', () => {
    const pretre = mk('p1', 'ennemi', { pos: { x: 2, y: 0 } });
    poserLAttaque(hardi({ advantage: 0 }), brute({ activeEffects: [{ label: 'Martyr', bonus: 0, martyrGuard: 'p1' }] as Combatant['activeEffects'] }), TOUCHE, undefined, [pretre]);
    const { faits, applique } = preverPuisValider();
    expect(faits.filter((f) => f.genre === 'blessures')).toEqual([{ genre: 'blessures', ...sur('p1', 'hostile'), valeur: -1 }]);
    expect(faits.some((f) => f.genre === 'avantage' && f.cible === 'e1'), 'la cible sans Blessure garde son Avantage').toBe(false);
    expect(applique).toEqual(annonces(faits, false));
  });

  it('Protection (LDB 85 l.278) : le dé de sauvegarde reste à tirer, la touche ne prévoit que sa Localisation et l’Avantage de la touche', () => {
    poserLAttaque(hardi({ advantage: 0 }), brute({ traits: [{ id: 'protection', value: 6 }] as Combatant['traits'] }), TOUCHE);
    expect(fenetreDAttaque(g())!.issue!.faits).toEqual([LOC('corps'), { genre: 'avantage', ...sur('h1', 'groupe'), valeur: 1, total: 1 }]);
  });
});

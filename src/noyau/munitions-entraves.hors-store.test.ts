import { beforeEach, describe, expect, it, onTestFinished } from 'vitest';
import type { TrappingData } from '../data';
import { datasetArray, setDataset } from '../data/overrides';
import { combattantDeTest } from '../engine/combattantDeTest.testkit';
import { idsDeTest } from '../engine/idsDeTest.testkit';
import { compatibleAmmo, itemFromTrappingById, loadedAmmo, loadWeapon, recomputeLoadout } from '../engine/items';
import { weaponLoaded } from '../engine/weaponLoad';
import { ouvrirLeBanc } from './banc.testkit';
import { firedAttackBlock } from './combatFlow';
import { cliquerSurLeCombattant } from './combatOrParty';
import type { BattleState } from './etat';
import { emptyScene } from './monde/scene';

const LIEN = 'lien-de-banc';
const PROPULSEUR = 'propulseur-de-banc';
const CARREAU = 'carreau-de-banc';
const PLOMB = 'plomb-de-banc';
const MECANISME = 'mecanisme-de-banc';
const LABEL_CARREAU = 'Carreau de banc';

function objetDeBanc(id: string, label: string, categorie: TrappingData['categorie'], groupe: string): TrappingData {
  return {
    id, label, categorie, subType: { id: groupe }, enc: 0, availability: null,
    range: 10, damage: { plusBF: false, flat: 4 }, qualities: [], price: null,
    source: { book: 'livre-de-base', page: 1 },
  };
}

beforeEach(() => {
  const original = [...datasetArray('trappings')];
  onTestFinished(() => setDataset('trappings', original));
  setDataset('trappings', [
    ...original,
    objetDeBanc(LIEN, 'Lien de banc', 'distance', 'entraves'),
    {
      ...objetDeBanc(PROPULSEUR, 'Propulseur de banc', 'distance', 'entraves'),
      qualities: [{ id: 'recharge', value: 2 }],
      munitions: [CARREAU],
    },
    objetDeBanc(MECANISME, 'Mécanisme de banc', 'distance', 'arbalete'),
    { ...objetDeBanc(CARREAU, LABEL_CARREAU, 'ammunition', 'arbalete'), packSize: 2 },
    { ...objetDeBanc(PLOMB, 'Plomb de banc', 'ammunition', 'entraves'), packSize: 2 },
  ]);
});

function ouvrirLeCombat(armeId: string, munitionId?: string, { ancienneSauvegarde = false } = {}) {
  const objet = itemFromTrappingById(armeId, idsDeTest)!;
  if (ancienneSauvegarde) delete objet.defaultAmmo;
  const munition = munitionId ? itemFromTrappingById(munitionId, idsDeTest)! : undefined;
  const heros = combattantDeTest({
    id: 'tireur', kind: 'heros', pos: { x: 2, y: 2 },
    characteristics: { 'capacite-de-tir': 60, force: 40 },
    items: munition ? [objet, munition] : [objet],
    loadouts: [{ id: 'tir', main: objet.uid }], activeLoadoutId: 'tir',
  });
  recomputeLoadout(heros);
  const arme = heros.weapons.find((w) => w.uid === objet.uid)!;
  loadWeapon(heros, arme);
  const cible = combattantDeTest({ id: 'cible', kind: 'ennemi', pos: { x: 5, y: 2 } });
  const battle: BattleState = {
    combatants: [heros, cible], order: [heros.id, cible.id], turn: 0, round: 1,
    action: null, selectedSpellId: null, reachable: new Map(),
    movementUsed: 0, movedPreAction: false, acted: false, log: [], over: null,
  };
  const banc = ouvrirLeBanc({
    graine: 2,
    etat: { battle, mode: 'battle', party: [heros], scene: { ...emptyScene('essai-entraves'), metresPerTile: 1 } },
  });
  const tireur = () => banc.getState().battle!.combatants.find((c) => c.id === heros.id)!;
  const cliquerLaCible = () => cliquerSurLeCombattant(banc.getState, cible.id, { confirm: true });
  const resoudreLAttaque = () => {
    expect(banc.getState().pendingAttack).toMatchObject({ attackerId: heros.id, targetId: cible.id });
    banc.actions.jetLancer('attaque');
    banc.actions.jetValider('attaque');
    expect(banc.getState().pendingAttack).toBeNull();
    expect(banc.getState().battle!.acted).toBe(true);
  };
  return { banc, arme, cible, tireur, munition, cliquerLaCible, resoudreLAttaque };
}

describe('Entraves sans projectile (LDB 62 l.74-76, l.101 ; ADE II 02 l.687 ; ZI 02 l.176)', () => {
  it('attaque sans munition', () => {
    const { cliquerLaCible, resoudreLAttaque } = ouvrirLeCombat(LIEN);
    cliquerLaCible();
    resoudreLAttaque();
  });

  it('attaque sans charger ni consommer le projectile du même groupe en inventaire', () => {
    const { arme, tireur, munition, cliquerLaCible, resoudreLAttaque } = ouvrirLeCombat(LIEN, PLOMB);
    const quantite = munition!.qty;
    expect(compatibleAmmo(tireur(), arme)).toEqual([]);
    expect(loadedAmmo(tireur(), arme)).toBeUndefined();
    cliquerLaCible();
    resoudreLAttaque();
    expect(tireur().items!.find((i) => i.uid === munition!.uid)?.qty).toBe(quantite);
  });
});

describe('Arme qui nomme un projectile (ADE II 02 l.639-640, l.673)', () => {
  it.each([
    { stock: 'vide', munitionId: undefined, ancienneSauvegarde: false },
    { stock: 'du même groupe mais incompatible', munitionId: PLOMB, ancienneSauvegarde: false },
    { stock: 'vide dans une sauvegarde antérieure', munitionId: undefined, ancienneSauvegarde: true },
  ])('refuse le tir si le stock est $stock', ({ munitionId, ancienneSauvegarde }) => {
    const { banc, arme, cible, tireur, cliquerLaCible } = ouvrirLeCombat(PROPULSEUR, munitionId, { ancienneSauvegarde });
    expect(weaponLoaded(tireur(), arme)).toBe(true);
    expect(firedAttackBlock(banc.getState, tireur(), cible, arme.uid)).toMatchObject({ reason: 'noammo', need: LABEL_CARREAU });
    cliquerLaCible();
    expect(banc.getState().pendingAttack).toBeNull();
    expect(banc.getState().battle!.acted).toBe(false);
  });

  it('charge le projectile nommé et en consomme un au tir', () => {
    const { arme, tireur, munition, cliquerLaCible, resoudreLAttaque } = ouvrirLeCombat(PROPULSEUR, CARREAU);
    const quantite = munition!.qty!;
    expect(loadedAmmo(tireur(), arme)?.uid).toBe(munition!.uid);
    cliquerLaCible();
    resoudreLAttaque();
    expect(tireur().items!.find((i) => i.uid === munition!.uid)?.qty).toBe(quantite - 1);
    expect(weaponLoaded(tireur(), arme)).toBe(false);
  });

  it('une arme de la famille du projectile ne charge pas un projectile réservé ailleurs', () => {
    const { arme, tireur } = ouvrirLeCombat(MECANISME, CARREAU);
    expect(compatibleAmmo(tireur(), arme)).toEqual([]);
  });
});

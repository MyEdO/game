import { findTrappingById } from '../data';
import { describe, expect, it } from 'vitest';
import { combattantDeTest } from '../engine/combattantDeTest.testkit';
import { appliquerAtoutOptionnel } from '../engine/atoutsOptionnels';
import { backstabWeapon, resolveMelee } from '../engine/combat';
import { deSelonLaPlage } from '../engine/dice.testkit';
import { idsDeTest } from '../engine/idsDeTest.testkit';
import { itemFromTrappingRef, weaponFromItem } from '../engine/items';
import { hasQuality } from '../engine/qualities/dispatch';
import type { Weapon } from '../engine/types';
import { gesteDuVerbe, SANS_PISTE } from '../hote/geste';
import { fenetreADessiner } from '../hote/gestes';
import { testScene } from '../scenes/test-fixture';
import { seedBattleRng } from './battleRng';
import { ouvrirLeBanc } from './banc.testkit';
import { attackWeaponOf, firedWeapon, openAttackCascade } from './combatFlow';
import { heroFaceAUnEnnemi } from './combatDeTest.testkit';
import { fenetreDAttaque } from './fenetreDAttaque';

const hallebarde = (tailleAttachee = false) => weaponFromItem(itemFromTrappingRef({
  id: 'hallebarde', ...(tailleAttachee ? { qualities: [{ id: 'taille' }] } : {}),
}, idsDeTest)!, 'main');
const profil = (arme: Weapon) => (['defensive', 'taille', 'empaleuse'] as const).filter((id) => hasQuality(arme, id));

function ouvrirLattaque(aa: boolean, usee = false) {
  const banc = ouvrirLeBanc({ reglesMaison: { 'combat-aa-armement': aa } });
  const { H, E } = heroFaceAUnEnnemi(banc, testScene());
  const arme = hallebarde();
  if (usee) arme.damageTaken = 4;
  H.weapons = [arme];
  openAttackCascade(banc.getState, banc.setState, { attackerId: H.id, targetId: E.id, location: null, result: null }, 'Attaque', 'action/attaquer');
  const armeDuCoup = () => {
    const s = banc.getState();
    return attackWeaponOf(findTrappingById, s.scene, s.battle!, H, E, s.pendingAttack!);
  };
  return { banc, H, E, arme, armeDuCoup };
}

describe('Atouts optionnels (AA 08 l.69-77, l.302)', () => {
  it('profil LDB (LDB 62 l.24) : Taille et Empaleuse restent simultanés, sans réglage', () => {
    const { banc, armeDuCoup } = ouvrirLattaque(false);
    expect(profil(armeDuCoup())).toEqual(['defensive', 'taille', 'empaleuse']);
    expect(fenetreDAttaque(banc.getState())?.choixDAtout).toBeNull();
  });

  it('le choix porté par le pont change l’arme du Test et reste figé au jet et à la relance', () => {
    const { banc, arme, armeDuCoup } = ouvrirLattaque(true);
    const etat = banc.getState;
    expect(profil(armeDuCoup())).toEqual(['defensive', 'taille']);
    const geste = fenetreADessiner(etat())?.gestes.find((g) => g.cle === 'jetRegler@attaque#atoutOptionnel');
    expect(geste).toMatchObject({ ouvert: true, arguments: expect.arrayContaining([
      expect.objectContaining({ valeur: 'taille', valeurs: [{ valeur: 'taille', libelle: 'Taille', refus: null }, { valeur: 'empaleuse', libelle: 'Empaleuse', refus: null }] }),
    ]) });
    const lire = (id: string) => gesteDuVerbe(etat(), { type: 'jetRegler', args: ['attaque', 'atoutOptionnel', id] }, SANS_PISTE);
    expect(() => lire('precise')).toThrow(/precise/);
    etat().jetRegler('attaque', 'atoutOptionnel', 'precise');
    expect(etat().pendingAttack?.atoutChoisi).toBeUndefined();
    const args = lire('empaleuse').args as ['attaque', 'atoutOptionnel', string];
    etat().jetRegler(...args);
    expect(profil(armeDuCoup())).toEqual(['defensive', 'empaleuse']);
    const apercu = fenetreDAttaque(etat())?.jet;
    expect(apercu).toHaveProperty('pending');
    seedBattleRng(3);
    etat().jetLancer('attaque');
    const tombe = etat().pendingAttack!;
    expect(tombe.weapon).toMatchObject({ uid: arme.uid, atoutOptionnel: 'empaleuse' });
    expect(profil(tombe.weapon!)).toEqual(['defensive', 'empaleuse']);
    expect(tombe.result?.attackerDetail?.target).toBe(apercu && 'pending' in apercu ? apercu.pending.target : undefined);
    expect(fenetreDAttaque(etat())?.choixDAtout).toBeNull();
    etat().jetRegler('attaque', 'atoutOptionnel', 'taille');
    expect(etat().pendingAttack?.atoutChoisi).toEqual({ weaponUid: arme.uid, id: 'empaleuse' });
    etat().jetRelancer('attaque');
    expect(etat().pendingAttack?.rerolled).toBe(true);
    expect(etat().pendingAttack?.weapon).toBe(tombe.weapon);
  });

  it('sur le tirage 10, la voie directe prend Taille par défaut et Empaleuse quand l’arme est déjà réglée', () => {
    const { H, E, arme, banc } = ouvrirLattaque(true);
    const attaquant = combattantDeTest({ characteristics: { 'capacite-de-combat': 65 } });
    const defenseur = combattantDeTest({ bodyShape: 'humanoide' });
    const roll = (w: Weapon) => resolveMelee(attaquant, defenseur, w, deSelonLaPlage((min, max) => max === 100 ? 10 : min), { defense: 'aucune' });
    expect(roll(arme)).toMatchObject({ hit: true, attackerRoll: 10, critical: false });
    expect(roll(appliquerAtoutOptionnel(arme, 'empaleuse'))).toMatchObject({ hit: true, attackerRoll: 10, critical: true });
    expect(profil(firedWeapon(findTrappingById, banc.getState().scene, H, E))).toEqual(['defensive', 'taille']);
  });

  it('la Taille attachée à la dotation survit au retrait de son occurrence imprimée', () => {
    ouvrirLattaque(true);
    const arme = hallebarde(true);
    const retenue = appliquerAtoutOptionnel(arme, 'empaleuse');
    expect(retenue.qualities.filter((q) => q.id === 'taille')).toHaveLength(1);
    expect(profil(retenue)).toEqual(['defensive', 'taille', 'empaleuse']);
    expect(appliquerAtoutOptionnel(retenue)).toBe(retenue);
  });

  it('le coup dans le dos pendant la Fuite utilise le profil improvisé de la Hallebarde usée', () => {
    const { H, arme } = ouvrirLattaque(true, true);
    const frappe = backstabWeapon(H);
    expect(frappe).toMatchObject({ uid: arme.uid, trappingId: 'hallebarde' });
    expect(profil(frappe)).toEqual([]);
    expect(frappe.qualities.map((q) => q.id)).toEqual(['desequilibree', 'inoffensive']);
  });

  it('quand l’usure oblige à improviser, le flux ne présente ni ne remet un Atout du profil initial', () => {
    const { banc, armeDuCoup } = ouvrirLattaque(true, true);
    expect(fenetreDAttaque(banc.getState())?.choixDAtout).toBeNull();
    expect(profil(armeDuCoup())).toEqual([]);
    banc.getState().jetRegler('attaque', 'atoutOptionnel', 'empaleuse');
    expect(banc.getState().pendingAttack?.atoutChoisi).toBeUndefined();
    banc.getState().jetLancer('attaque');
    const arme = banc.getState().pendingAttack?.weapon;
    expect(arme).toBeDefined();
    expect(profil(arme!)).toEqual([]);
  });
});

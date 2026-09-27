import { describe, it, expect } from 'vitest';
import { recomputeLoadout, totalEncumbrance, maxEncumbrance, itemFromTrappingById, weaponWithAmmo, compatibleAmmo, selectedAmmo, emptyArmour, damageArmour, weaponHands, activeLoadout, ensureDefaultLoadout, unarmedWeapon, loadoutCreate, loadoutDelete, loadoutSetActive, loadoutSetSlot, loadoutLabel, isOffHandEligible, armourLayer, equipConflicts, isCapeItem, buildInventory, damageString, hydratePoste, mannedPosteWeapon, itemLabel, customTrapping, wornArmourPoints, isWearable, reachIdOf, reachRankOf, isUnarmed } from './items';
import { effectiveWeaponRange } from './weaponDamage';
import { rangeBandName } from './combat';
import { trappings, type TrappingRef } from '../data';
import { Combatant, ItemInstance, Weapon } from './types';

/** Résolveur de test : résout un LIBELLÉ d'objet → instance par id (authoring). Inconnu → null. */
const itemFromTrapping = (label: string): ItemInstance | null => {
  const t = trappings.find((x) => x.label === label);
  return t ? itemFromTrappingById(t.id) : null;
};
/** Réfs de catalogue par libellé (pour buildInventory). */
const refsByLabel = (labels: string[]): TrappingRef[] => labels.map((l) => ({ id: trappings.find((t) => t.label === l)!.id }));

const item = (o: Partial<ItemInstance>): ItemInstance =>
  ({ uid: 'u', label: 'x', kind: 'misc', qualities: [], enc: 0, equipped: false, ...o }) as ItemInstance;

describe('itemLabel — id STABLE → libellé FR (jamais l’id brut)', () => {
  it('un objet CATALOGUÉ rangé affiche le libellé FR, jamais son id kebab-case (même si name a dérivé)', () => {
    const it = itemFromTrappingById('epee-batarde')!;
    it.label = 'epee-large'; // name FAUTIF (save ancienne / donnée corrompue) : ne doit PAS fuir à l'affichage
    it.inside = 'sac-1'; // objet RANGÉ dans un contenant
    expect(itemLabel(it)).toBe('Épée bâtarde');
    expect(itemLabel(it)).not.toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)+$/); // aucun id kebab-case rendu
  });
  it('objet CUSTOM (hors-base, sans trappingId) : repli sur le nom libre', () => {
    expect(itemLabel(customTrapping('Fiole de sang'))).toBe('Fiole de sang');
  });
});

describe('weaponHands (latéralité)', () => {
  const it_ = (p: Partial<ItemInstance>): ItemInstance =>
    ({ uid: 'w', label: 'X', kind: 'melee', qualities: [], enc: 0, equipped: false, ...p } as ItemInstance);

  it('`hands` posé fait foi', () => {
    expect(weaponHands(it_({ label: 'Hallebarde', subType: "Armes d'hast", hands: 2 }))).toBe(2);
    expect(weaponHands(it_({ label: 'Epee', subType: 'Base', hands: 1 }))).toBe(1);
  });
  it('fallback sans `hands` typé : Groupe Deux-mains (subType)', () => {
    expect(weaponHands(it_({ label: 'Espadon', subType: 'deux-mains' }))).toBe(2); // id de Groupe
    expect(weaponHands(it_({ label: 'Epee', subType: 'Base' }))).toBe(1);
  });
  it('itemFromTrapping pose `hands` depuis le champ typé — mêlée ET distance', () => {
    expect(itemFromTrapping('Arc')?.hands).toBe(2);
    expect(itemFromTrapping('Arbalète de poing')?.hands).toBe(1);
    expect(itemFromTrapping('Pistolet')?.hands).toBe(1);
    expect(itemFromTrapping('Hallebarde')?.hands).toBe(2);
  });
  it('Poudre noire/Ingénierie classées par le champ typé `hands` (LDB 62) : arquebuses 2 mains, pistolets 1 main', () => {
    expect(itemFromTrapping('Arquebuse')?.hands).toBe(2);
    expect(itemFromTrapping('Tromblon')?.hands).toBe(2);
    expect(itemFromTrapping("Long fusil d'Hochland")?.hands).toBe(2);
    expect(itemFromTrapping('Pistolet à répétition')?.hands).toBe(1);
  });
});

describe('itemFromTrapping — Allonge (mêlée) ⊥ Portée (distance), LDB 62', () => {
  it('arme à distance : reach nul, Portée dérivée en mètres (pas de doublon « Allonge 50 · Portée 50 »)', () => {
    const arc = itemFromTrapping('Arc')!;
    expect(arc.kind).toBe('ranged');
    expect(arc.reach).toBeNull(); // un projectile n'a pas d'Allonge
    expect(arc.range).toBe(50);
  });
  it('arme de mêlée : Allonge renseignée, pas de Portée', () => {
    const hall = itemFromTrapping('Hallebarde')!;
    expect(hall.kind).toBe('melee');
    expect(hall.reach).toBe('Longue');
    expect(hall.range).toBeNull();
  });
});

describe('mutateurs de loadout (purs)', () => {
  const w = (uid: string, name: string, p: Partial<ItemInstance> = {}): ItemInstance =>
    ({ uid, label: name, kind: 'melee', qualities: [], enc: 1, equipped: true, hands: 1, ...p } as ItemInstance);
  const hero = (items: ItemInstance[]): Combatant =>
    ({ id: 'h', label: 'H', kind: 'hero', items, loadouts: [], activeLoadoutId: undefined } as unknown as Combatant);

  it('loadoutCreate ajoute un loadout vide et le rend actif', () => {
    const c = hero([w('e', 'Epee')]);
    const id = loadoutCreate(c);
    const lo = c.loadouts!.find((l) => l.id === id)!;
    expect(lo.main).toBeUndefined();
    expect(lo.off).toBeUndefined();
    expect(c.activeLoadoutId).toBe(id);
  });

  it('loadoutSetSlot pose une arme ; une arme 2 mains en main vide le slot off', () => {
    const c = hero([w('h2', 'Hallebarde', { hands: 2 }), w('b', 'Bouclier')]);
    const id = loadoutCreate(c);
    loadoutSetSlot(c, id, 'off', 'b');
    loadoutSetSlot(c, id, 'main', 'h2'); // 2 mains → off effacé
    const lo = c.loadouts!.find((l) => l.id === id)!;
    expect(lo.main).toBe('h2');
    expect(lo.off).toBeUndefined();
  });

  it('loadoutSetSlot(slot, null) vide le slot', () => {
    const c = hero([w('e', 'Epee')]);
    const id = loadoutCreate(c);
    loadoutSetSlot(c, id, 'main', 'e');
    loadoutSetSlot(c, id, 'main', null);
    expect(c.loadouts!.find((l) => l.id === id)!.main).toBeUndefined();
  });

  it('loadoutSetActive (ignore un id invalide)', () => {
    const c = hero([w('e', 'Epee')]);
    const id = loadoutCreate(c);
    loadoutCreate(c); // actif = le 2e
    loadoutSetActive(c, id);
    expect(c.activeLoadoutId).toBe(id);
    loadoutSetActive(c, 'inconnu');
    expect(c.activeLoadoutId).toBe(id);
  });

  it('loadoutDelete : supprime ; si actif, bascule sur le 1er restant', () => {
    const c = hero([w('e', 'Epee')]);
    const a = loadoutCreate(c);
    const b = loadoutCreate(c); // actif = b
    loadoutDelete(c, b);
    expect(c.loadouts!.map((l) => l.id)).toEqual([a]);
    expect(c.activeLoadoutId).toBe(a);
  });

  it('loadoutSetSlot : une même arme ne peut occuper les DEUX mains (déplacée, pas dupliquée)', () => {
    const c = hero([w('e', 'Epee'), w('d', 'Dague')]);
    const id = loadoutCreate(c);
    loadoutSetSlot(c, id, 'off', 'e'); // Épée en 2nde
    loadoutSetSlot(c, id, 'main', 'e'); // puis en principale → retirée de la 2nde
    const lo = c.loadouts!.find((l) => l.id === id)!;
    expect(lo.main).toBe('e');
    expect(lo.off).toBeUndefined();
  });
});

describe('loadoutLabel (auto-étiquetage par contenu)', () => {
  const it_ = (uid: string, name: string): ItemInstance =>
    ({ uid, label: name, kind: 'melee', qualities: [], enc: 1, equipped: true, hands: 1 } as ItemInstance);
  const c = ({ items: [it_('e', 'Épée'), it_('b', 'Bouclier')] } as unknown) as Combatant;

  it('main + off → « X + Y »', () => {
    expect(loadoutLabel({ id: 'l', main: 'e', off: 'b' }, c)).toBe('Épée + Bouclier');
  });
  it('main seule → « X »', () => {
    expect(loadoutLabel({ id: 'l', main: 'e' }, c)).toBe('Épée');
  });
  it('set vide → « Mains nues »', () => {
    expect(loadoutLabel({ id: 'l' }, c)).toBe('Mains nues');
  });
});

describe('isOffHandEligible (LDB 14 l.138 — main secondaire)', () => {
  const melee = (hands: 1 | 2): ItemInstance =>
    ({ uid: 'm', label: 'X', kind: 'melee', qualities: [], enc: 1, equipped: true, hands } as ItemInstance);

  it('mêlée à une main → éligible ; à deux mains → exclue', () => {
    expect(isOffHandEligible(melee(1))).toBe(true);
    expect(isOffHandEligible(melee(2))).toBe(false);
  });
  it('arme à distance NON-pistolet (Arc) → exclue', () => {
    expect(isOffHandEligible(itemFromTrapping('Arc')!)).toBe(false);
  });
  it('pistolet (Atout Pistolet) → éligible ; Arbalète de poing (même Atout) aussi', () => {
    expect(isOffHandEligible(itemFromTrapping('Pistolet')!)).toBe(true);
    expect(isOffHandEligible(itemFromTrapping('Arbalète de poing')!)).toBe(true);
  });
});

describe('unarmedWeapon (Mains nues canoniques, LDB 62 l.28)', () => {
  it('dérivées du trapping : +BF+0, Personnelle, Inoffensive (pas +BF-2)', () => {
    const u = unarmedWeapon();
    expect(damageString(u.damage)).toBe('+BF+0');
    expect(u.reach).toBe('Personnelle');
    expect(u.qualities.some((q) => q.id === 'inoffensive')).toBe(true); // runtime = id de qualité (pas le libellé)
    expect(u.hand).toBe('main');
  });
});

describe('activeLoadout', () => {
  const base = (over: Partial<Combatant>): Combatant =>
    ({ id: 'h', label: 'H', kind: 'hero', items: [], ...over } as unknown as Combatant);

  it('aucun loadout → null (chemin legacy)', () => {
    expect(activeLoadout(base({}))).toBeNull();
  });
  it('renvoie le loadout actif par id', () => {
    const c = base({ loadouts: [{ id: 'a' }, { id: 'b' }], activeLoadoutId: 'b' });
    expect(activeLoadout(c)?.id).toBe('b');
  });
  it('id inconnu → 1er loadout (repli)', () => {
    const c = base({ loadouts: [{ id: 'a' }], activeLoadoutId: 'zzz' });
    expect(activeLoadout(c)?.id).toBe('a');
  });
});

describe('recomputeLoadout piloté par loadout', () => {
  const heroWith = (items: ItemInstance[], lo?: { loadouts: any[]; activeLoadoutId: string }): Combatant =>
    ({ id: 'h', label: 'H', kind: 'hero', characteristics: { force: 30, endurance: 30 } as any, items,
       talents: [], skills: [], conditions: [], wounds: { current: 10, max: 10 }, advantage: 0, ...lo } as unknown as Combatant);
  const w = (uid: string, name: string, p: Partial<ItemInstance> = {}): ItemInstance =>
    ({ uid, label: name, kind: 'melee', qualities: [], enc: 1, equipped: true, ...p } as ItemInstance);

  it('loadout 1 main + bouclier → 2 armes taguées main/off, SANS Mains nues (set armé, #1348)', () => {
    const epee = w('e', 'Epee', { subType: 'Base', hands: 1 });
    const bouc = w('b', 'Bouclier', { subType: 'Base', hands: 1, qualities: [{ id: 'defensive' }] });
    const c = heroWith([epee, bouc], { loadouts: [{ id: 'l1', name: 'EB', main: 'e', off: 'b' }], activeLoadoutId: 'l1' });
    recomputeLoadout(c);
    expect(c.weapons.map((x) => [x.label, x.hand])).toEqual([
      ['Epee', 'main'], ['Bouclier', 'off'],
    ]);
  });

  it('loadout arme 2 mains → slot off ignoré', () => {
    const halle = w('h', 'Hallebarde', { subType: "Armes d'hast", hands: 2 });
    const bouc = w('b', 'Bouclier', { subType: 'Base', hands: 1 });
    const c = heroWith([halle, bouc], { loadouts: [{ id: 'l', name: 'H', main: 'h', off: 'b' }], activeLoadoutId: 'l' });
    recomputeLoadout(c);
    expect(c.weapons.map((x) => x.label)).toEqual(['Hallebarde']); // set armé : pas de Mains nues (#1348)
  });

  it('auto-prune : un slot référençant une arme absente (vendue/transférée) est vidé', () => {
    const c = heroWith([w('e', 'Epee', { subType: 'Base', hands: 1 })], { loadouts: [{ id: 'l', name: 'L', main: 'e', off: 'disparu' }], activeLoadoutId: 'l' });
    recomputeLoadout(c);
    const lo = c.loadouts!.find((l) => l.id === 'l')!;
    expect(lo.main).toBe('e');
    expect(lo.off).toBeUndefined(); // 'disparu' nettoyé
  });

  it('sans loadout : recompute AUTO-GÉNÈRE un loadout par défaut (un seul modèle, plus de « toutes équipées »)', () => {
    const a = w('a', 'A', { subType: 'Base', hands: 1, damage: { plusBF: true, flat: 4 } });
    const b = w('b', 'B', { subType: 'Base', hands: 1, damage: { plusBF: true, flat: 0, bare: true } });
    const c = heroWith([a, b]);
    recomputeLoadout(c);
    expect((c.loadouts ?? []).length).toBeGreaterThanOrEqual(1); // loadout créé à la volée
    expect(c.weapons.map((x) => [x.label, x.hand])).toEqual([['A', 'main'], ['B', 'off']]);
  });
});

describe('warMachineResolveChar (DÉRIVÉ, via recomputeLoadout) — bélier → Force (ADE II 8 l.233)', () => {
  const heroWith = (items: ItemInstance[], lo?: { loadouts: any[]; activeLoadoutId: string }): Combatant =>
    ({ id: 'h', label: 'H', kind: 'hero', characteristics: { force: 30, endurance: 30 } as any, items,
       talents: [], skills: [], conditions: [], wounds: { current: 10, max: 10 }, advantage: 0, ...lo } as unknown as Combatant);
  const w = (uid: string, name: string, p: Partial<ItemInstance> = {}): ItemInstance =>
    ({ uid, label: name, kind: 'melee', qualities: [], enc: 1, equipped: true, ...p } as ItemInstance);

  it('arme de MÊLÉE du Groupe machine-de-guerre (le bélier) → resolveChar Force', () => {
    const belier = w('bel', 'Bélier', { kind: 'melee', weaponGroup: 'machine-de-guerre', hands: 2 });
    const c = heroWith([belier], { loadouts: [{ id: 'l', name: 'B', main: 'bel' }], activeLoadoutId: 'l' });
    recomputeLoadout(c);
    expect(c.weapons.find((x) => x.label === 'Bélier')?.resolveChar).toBe('force');
  });

  it('arme à DISTANCE du même Groupe (Baliste ADE II) → PAS de resolveChar (Projectiles normal)', () => {
    const baliste = w('bal', 'Baliste', { kind: 'ranged', weaponGroup: 'machine-de-guerre', hands: 2 });
    const c = heroWith([baliste], { loadouts: [{ id: 'l', name: 'BA', main: 'bal' }], activeLoadoutId: 'l' });
    recomputeLoadout(c);
    expect(c.weapons.find((x) => x.label === 'Baliste')?.resolveChar).toBeUndefined();
  });

  it('arme de mêlée HORS Groupe machine-de-guerre → jamais de resolveChar (non-régression)', () => {
    const epee = w('e', 'Epee', { kind: 'melee', subType: 'base', hands: 1 });
    const c = heroWith([epee], { loadouts: [{ id: 'l', name: 'E', main: 'e' }], activeLoadoutId: 'l' });
    recomputeLoadout(c);
    expect(c.weapons.find((x) => x.label === 'Epee')?.resolveChar).toBeUndefined();
  });
});

describe('machine de guerre (Qualité `equipe` — ADE II 8 l.233) : jamais en loadout SOLO', () => {
  const heroWith = (items: ItemInstance[], lo?: { loadouts: any[]; activeLoadoutId: string }): Combatant =>
    ({ id: 'h', label: 'H', kind: 'hero', characteristics: { force: 30, endurance: 30 } as any, items,
       talents: [], skills: [], conditions: [], wounds: { current: 10, max: 10 }, advantage: 0, ...lo } as unknown as Combatant);

  it('belier-ade2 (subType armes-de-siege) en `items` équipé : PAS d’arme dérivée — Mains nues seulement', () => {
    const belier = itemFromTrappingById('belier-ade2')!;
    belier.equipped = true;
    const c = heroWith([belier]);
    recomputeLoadout(c);
    expect(c.weapons.map((w) => w.label)).not.toContain('Bélier');
    expect(c.weapons.map((w) => w.label)).toEqual(['Mains nues']); // repli seul, aucune arme de siège tenue
  });

  it('belier-ade2 : art d’affût `belier` (PAS l’affût de baliste recyclé) + empreinte 2 (#210, ADE II 8 l.239/258)', () => {
    const t = trappings.find((x) => x.id === 'belier-ade2')!;
    expect(t.siegeRig).toBe('belier');
    expect(t.siegeFootprint).toBe(2);
  });

  it('item hors `armes-de-siege` mais portant la Qualité `equipe` : même veto (non-régression sur les armes ordinaires)', () => {
    const engin = { uid: 'x', label: 'Engin', kind: 'melee', qualities: [{ id: 'equipe', value: 4 }], enc: 1, equipped: true, hands: 1 } as unknown as ItemInstance;
    const c = heroWith([engin], { loadouts: [{ id: 'l', main: 'x' }], activeLoadoutId: 'l' });
    recomputeLoadout(c);
    expect(c.weapons.map((w) => w.label)).not.toContain('Engin');
  });

  it('arme ORDINAIRE (ni armes-de-siege, ni Qualité equipe) : non-régression, dérivée normalement', () => {
    const epee = { uid: 'e', label: 'Epee', kind: 'melee', subType: 'base', qualities: [], enc: 1, equipped: true, hands: 1, damage: { plusBF: true, flat: 4 } } as unknown as ItemInstance;
    const c = heroWith([epee], { loadouts: [{ id: 'l', main: 'e' }], activeLoadoutId: 'l' });
    recomputeLoadout(c);
    expect(c.weapons.map((w) => w.label)).toContain('Epee');
  });
});

describe('ensureDefaultLoadout', () => {
  const w = (uid: string, name: string, p: Partial<ItemInstance> = {}): ItemInstance =>
    ({ uid, label: name, kind: 'melee', qualities: [], enc: 1, equipped: true, damage: { plusBF: true, flat: 4 }, ...p } as ItemInstance);
  const hero = (items: ItemInstance[]): Combatant =>
    ({ id: 'h', label: 'H', kind: 'hero', items } as unknown as Combatant);

  it('crée « Set I » = meilleure arme de mêlée en main, bouclier en secondaire', () => {
    const c = hero([
      w('e', 'Epee', { subType: 'Base', hands: 1, damage: { plusBF: true, flat: 4 } }),
      w('b', 'Bouclier', { subType: 'Base', hands: 1, damage: { plusBF: true, flat: 0, bare: true }, qualities: [{ id: 'defensive' }] }),
    ]);
    ensureDefaultLoadout(c);
    const lo = c.loadouts![0]; // 1er set = mêlée
    expect(lo.main).toBe('e');
    expect(lo.off).toBe('b');
    expect(c.activeLoadoutId).toBe(lo.id);
  });

  it('crée TOUJOURS deux sets : le 2nd porte la 1re arme à distance (sinon vide)', () => {
    const c = hero([
      w('e', 'Epee', { subType: 'Base', hands: 1 }),
      w('arc', 'Arc', { kind: 'ranged', subType: 'Arc', hands: 2, equipped: true, damage: { plusBF: false, flat: 9 } }),
    ]);
    ensureDefaultLoadout(c);
    expect(c.loadouts!).toHaveLength(2);
    expect(c.loadouts![1].main).toBe('arc'); // 2nd set = distance
    const soloMelee = hero([w('e', 'Epee', { subType: 'Base', hands: 1 })]);
    ensureDefaultLoadout(soloMelee);
    expect(soloMelee.loadouts!.map((l) => l.main)).toEqual(['e', undefined]);
  });

  it('héros sans arme distance équipée : actif = Set I ; sans mêlée : actif = Set II', () => {
    const c = hero([w('arc', 'Arc', { kind: 'ranged', subType: 'Arc', hands: 2, equipped: true, damage: { plusBF: false, flat: 9 } })]);
    ensureDefaultLoadout(c);
    expect(c.activeLoadoutId).toBe(c.loadouts![1].id); // pas de mêlée → actif = 2nd set (distance)
  });

  it('idempotent : ne recrée pas si loadouts déjà présents', () => {
    const c = hero([w('e', 'Epee', { subType: 'Base', hands: 1 })]);
    c.loadouts = [{ id: 'x', main: 'e' }];
    c.activeLoadoutId = 'x';
    ensureDefaultLoadout(c);
    expect(c.loadouts).toHaveLength(1);
    expect(c.activeLoadoutId).toBe('x');
  });
});

describe('couches d’armure (LDB 63) — armourLayer / equipConflicts', () => {
  const hero = (items: ItemInstance[]): Combatant => ({ id: 'h', items } as unknown as Combatant);

  it('armourLayer lit la donnée réelle : Cuir souple / Flexible (Mailles) / rigide (Cuir bouilli, Plate)', () => {
    expect(armourLayer(itemFromTrapping('Justaucorps de cuir')!)).toBe('souple'); // subType Cuir souple (LDB 63 l.41)
    expect(armourLayer(itemFromTrapping('Chemise de mailles')!)).toBe('flexible'); // qualité Flexible (l.105-106)
    expect(armourLayer(itemFromTrapping('Plastron de cuir')!)).toBe('rigide'); // Cuir bouilli
    expect(armourLayer(itemFromTrapping('Plastron')!)).toBe('rigide'); // Plate
  });

  it('2 cuirs souples sur le Corps = conflit ; souple + maille + plate se superposent sans conflit', () => {
    const justau = { ...itemFromTrapping('Justaucorps de cuir')!, equipped: true };
    const veste = itemFromTrapping('Veste de cuir')!; // souple, Bras+Corps
    const maille = { ...itemFromTrapping('Chemise de mailles')!, equipped: true };
    const plastron = { ...itemFromTrapping('Plastron')!, equipped: true };
    const c = hero([justau, veste, maille, plastron]);
    expect(equipConflicts(c, veste).map((i) => i.label)).toEqual(['Justaucorps de cuir']); // même couche, loc commune
    expect(equipConflicts(c, justau)).toEqual([]); // déjà porté : maille/plate = autres couches
    expect(equipConflicts(c, maille)).toEqual([]);
    expect(equipConflicts(c, plastron)).toEqual([]);
  });

  it('pas de conflit sans localisation commune (calotte vs justaucorps, tous deux souples)', () => {
    const calotte = { ...itemFromTrapping('Calotte de cuir')!, equipped: true };
    const justau = itemFromTrapping('Justaucorps de cuir')!;
    expect(equipConflicts(hero([calotte, justau]), justau)).toEqual([]);
  });

  it('isCapeItem reconnaît Cape/Manteau (trappings sans stats) ; une seule cape portée', () => {
    const cape = { ...itemFromTrapping('Cape')!, equipped: true };
    const manteau = itemFromTrapping('Manteau')!;
    expect(isCapeItem(cape)).toBe(true);
    expect(isCapeItem(manteau)).toBe(true);
    expect(isCapeItem(itemFromTrapping('Justaucorps de cuir')!)).toBe(false);
    expect(equipConflicts(hero([cape, manteau]), manteau).map((i) => i.label)).toEqual(['Cape']);
  });

  it('buildInventory n’équipe qu’UNE pièce par couche × localisation (meilleure PA)', () => {
    const items = buildInventory(refsByLabel(['Justaucorps de cuir', 'Veste de cuir', 'Chemise de mailles', 'Plastron']));
    const worn = items.filter((i) => i.equipped).map((i) => i.label).sort();
    // Justaucorps et Veste sont tous deux Cuir souple sur le Corps → une seule des deux portée.
    expect(worn).toContain('Chemise de mailles');
    expect(worn).toContain('Plastron');
    expect(worn.filter((n) => n === 'Justaucorps de cuir' || n === 'Veste de cuir')).toHaveLength(1);
  });

  it('buildInventory fusionne les Atouts ATTACHÉS de la ref (`qualities`) aux qualités de base du catalogue (#657 Lot 1)', () => {
    const epeeBatarde = trappings.find((t) => t.label === 'Épée bâtarde')!;
    const [item] = buildInventory([{ id: epeeBatarde.id, qualities: [{ id: 'solide' }] }]);
    const ids = item.qualities.map((q) => q.id);
    expect(ids).toContain('solide'); // Atout ATTACHÉ (joker de qualité résolu)
    expect(ids).toContain('devastatrice'); // qualité de BASE du catalogue, conservée
    expect(ids).toContain('defensive');
  });

  it('buildInventory préserve la `value` (Indice) d\'un Atout ATTACHÉ — « Solide 3 » (correctif juge Lot 1)', () => {
    const epeeBatarde = trappings.find((t) => t.label === 'Épée bâtarde')!;
    const [item] = buildInventory([{ id: epeeBatarde.id, qualities: [{ id: 'solide', value: 3 }] }]);
    expect(item.qualities.find((q) => q.id === 'solide')).toEqual({ id: 'solide', value: 3 });
  });
});

describe('items — recomputeLoadout / encombrement', () => {
  it('recomputeLoadout dérive armes ET armure actives des objets ÉQUIPÉS', () => {
    const c = {
      characteristics: { force: 30, endurance: 30 },
      items: [
        item({ label: 'Hache', kind: 'melee', damage: { plusBF: true, flat: 4 }, equipped: true }),
        item({ label: 'Plastron', kind: 'armor', pa: 2, locs: ['corps'], equipped: true }),
        item({ label: 'Casque rangé', kind: 'armor', pa: 3, locs: ['tete'], equipped: false }),
      ],
    } as unknown as Combatant;
    recomputeLoadout(c);
    expect(c.weapons.map((w) => w.label)).toContain('Hache');
    expect(c.weapons.map((w) => w.label)).not.toContain('Mains nues'); // set armé de la Hache (#1348)
    expect(c.armour.corps).toBe(2); // armure équipée appliquée à sa localisation
    expect(c.armour.tete).toBe(0); // l'armure NON équipée ne compte pas
  });
  it('recomputeLoadout propage le SKIN d’un objet légendaire au Weapon actif (rendu recoloré)', () => {
    const c = { items: [item({ label: 'Lame du Crépuscule', kind: 'melee', damage: { plusBF: true, flat: 5 }, equipped: true, skin: { metal: '#caa64a' } })] } as unknown as Combatant;
    recomputeLoadout(c);
    expect(c.weapons.find((w) => w.label === 'Lame du Crépuscule')?.skin).toEqual({ metal: '#caa64a' });
    expect(c.weapons.find((w) => w.label === 'Mains nues')?.skin).toBeUndefined();
  });
  it("totalEncumbrance somme l'encombrement de tous les objets portés", () => {
    const c = { items: [item({ enc: 2 }), item({ enc: 3 }), item({ enc: 0 })] } as unknown as Combatant;
    expect(totalEncumbrance(c)).toBe(5);
  });
  it('totalEncumbrance : la monnaie personnelle (Bourse) ajoute 1 Enc / 200 PIÈCES (LDB 61 l.29) — le NOMBRE de pièces, pas leur valeur en sous', () => {
    const bourse200 = { items: [item({ enc: 0, money: { gold: 0, silver: 0, brass: 200 } })] } as unknown as Combatant;
    expect(totalEncumbrance(bourse200)).toBe(1);
    const bourse199 = { items: [item({ enc: 0, money: { gold: 0, silver: 0, brass: 199 } })] } as unknown as Combatant;
    expect(totalEncumbrance(bourse199)).toBe(0);
    const bourse400 = { items: [item({ enc: 0, money: { gold: 0, silver: 0, brass: 400 } })] } as unknown as Combatant;
    expect(totalEncumbrance(bourse400)).toBe(2);
    // mêlées de pièces réparties sur les 3 dénominations : le compte total de pièces prime, pas la valeur.
    const mixed = { items: [item({ enc: 0, money: { gold: 100, silver: 150, brass: 150 } })] } as unknown as Combatant; // 400 pièces
    expect(totalEncumbrance(mixed)).toBe(2);
  });
  it('amputation de main : arme à deux mains exclue de la dotation ; Merveille PORTÉE la rétablit (LDB 18 l.263 / 73)', () => {
    const c = {
      characteristics: { force: 30, endurance: 30 },
      traumas: [{ label: 'Main', location: 'brasD', ops: [{ op: 'maxWeaponHands', hands: 1 }], prosthesis: [{ trappingId: 'merveille-d-ingenierie', cancels: 'all' }] }],
      items: [item({ label: 'Espadon', kind: 'melee', damage: { plusBF: true, flat: 5 }, subType: 'deux-mains', equipped: true })],
    } as unknown as Combatant;
    recomputeLoadout(c);
    expect(c.weapons.map((w) => w.label)).not.toContain('Espadon'); // pas d'arme à 2 mains avec une main amputée
    c.items!.push(item({ trappingId: 'merveille-d-ingenierie', label: "Merveille d'ingénierie", subType: 'protheses', equipped: true }));
    recomputeLoadout(c);
    expect(c.weapons.map((w) => w.label)).toContain('Espadon'); // prothèse portée → arme à 2 mains de nouveau utilisable
  });
  it('Crochet porté (prothèse) fournit une arme « Dague » (+BF+2, LDB 73)', () => {
    const c = { characteristics: { force: 30, endurance: 30 }, items: [{ ...itemFromTrapping('Crochet')!, equipped: true }] } as unknown as Combatant;
    recomputeLoadout(c);
    const cr = c.weapons.find((w) => w.label === 'Crochet');
    expect(damageString(cr!.damage)).toBe('+BF+2');
  });
  it('amputation de main : loadout Arc (2 mains) exclu → Mains nues ; loadout Arbalète de poing (1 main) utilisable', () => {
    const c = {
      characteristics: { force: 30, endurance: 30 },
      traumas: [{ label: 'Main', location: 'brasD', ops: [{ op: 'maxWeaponHands', hands: 1 }] }],
      items: [
        item({ uid: 'arc', label: 'Arc long', kind: 'ranged', subType: 'Arc', hands: 2, equipped: true }),
        item({ uid: 'arb', label: 'Arbalète de poing', kind: 'ranged', subType: 'Arbalète', hands: 1, equipped: true }),
      ],
      loadouts: [{ id: 'larc', name: 'Arc', main: 'arc' }, { id: 'larb', name: 'Arbalète', main: 'arb' }],
      activeLoadoutId: 'larc',
    } as unknown as Combatant;
    recomputeLoadout(c);
    expect(c.weapons.map((w) => w.label)).toEqual(['Mains nues']); // Arc à 2 mains exclu par l'amputation
    c.activeLoadoutId = 'larb';
    recomputeLoadout(c);
    expect(c.weapons.map((w) => w.label)).toContain('Arbalète de poing'); // 1 main → utilisable
  });
  it('amputation de la main SECONDAIRE (brasG) : le bouclier (slot off) tombe ; l’arme directrice reste (LDB 18)', () => {
    const c = {
      characteristics: { force: 30, endurance: 30 },
      traumas: [{ label: 'Main', location: 'brasG', ops: [{ op: 'maxWeaponHands', hands: 1 }] }],
      items: [
        item({ uid: 'ep', label: 'Épée', kind: 'melee', damage: { plusBF: true, flat: 4 }, equipped: true }),
        item({ uid: 'bo', label: 'Bouclier', kind: 'melee', damage: { plusBF: true, flat: 0, bare: true }, qualities: [{ id: 'protectrice', value: 1 }, { id: 'defensive' }], equipped: true }),
      ],
      loadouts: [{ id: 'l1', name: 'Épée+Bouclier', main: 'ep', off: 'bo' }],
      activeLoadoutId: 'l1',
    } as unknown as Combatant;
    recomputeLoadout(c);
    expect(c.weapons.map((w) => w.label)).toContain('Épée');
    expect(c.weapons.map((w) => w.label)).not.toContain('Bouclier'); // main secondaire amputée → impossible de tenir le bouclier
  });
  it('amputation de la main DIRECTRICE (brasD) : arme directrice conservée (−20, adaptation) ; la 2e arme (slot off) tombe', () => {
    const c = {
      characteristics: { force: 30, endurance: 30 },
      traumas: [{ label: 'Main', location: 'brasD', ops: [{ op: 'maxWeaponHands', hands: 1 }] }],
      items: [
        item({ uid: 'ep', label: 'Épée', kind: 'melee', damage: { plusBF: true, flat: 4 }, equipped: true }),
        item({ uid: 'da', label: 'Dague', kind: 'melee', damage: { plusBF: true, flat: 0, bare: true }, equipped: true }),
      ],
      loadouts: [{ id: 'l1', name: 'Deux armes', main: 'ep', off: 'da' }],
      activeLoadoutId: 'l1',
    } as unknown as Combatant;
    recomputeLoadout(c);
    expect(c.weapons.map((w) => w.label)).toContain('Épée'); // conservée (il reste une main)
    expect(c.weapons.map((w) => w.label)).not.toContain('Dague'); // une seule main fonctionnelle → la 2e arme tombe
  });
  it('amputation des DEUX mains : Mains nues seulement', () => {
    const c = {
      characteristics: { force: 30, endurance: 30 },
      traumas: [
        { label: 'Main', location: 'brasD', ops: [{ op: 'maxWeaponHands', hands: 1 }] },
        { label: 'Main', location: 'brasG', ops: [{ op: 'maxWeaponHands', hands: 1 }] },
      ],
      items: [item({ uid: 'ep', label: 'Épée', kind: 'melee', damage: { plusBF: true, flat: 4 }, equipped: true })],
      loadouts: [{ id: 'l1', name: 'X', main: 'ep' }],
      activeLoadoutId: 'l1',
    } as unknown as Combatant;
    recomputeLoadout(c);
    expect(c.weapons.map((w) => w.label)).toEqual(['Mains nues']);
  });
  it('auto-prune : un slot pointant vers une arme DÉTRUITE (Incident de Tir / usure) est vidé', () => {
    const c = {
      characteristics: { force: 30, endurance: 30 },
      items: [item({ uid: 'ep', label: 'Épée', kind: 'melee', damage: { plusBF: true, flat: 4 }, equipped: true, destroyed: true })],
      loadouts: [{ id: 'l1', name: 'X', main: 'ep' }],
      activeLoadoutId: 'l1',
    } as unknown as Combatant;
    recomputeLoadout(c);
    expect(c.loadouts![0].main).toBeUndefined(); // slot vidé (l'arme détruite n'est plus tenable)
    expect(c.weapons.map((w) => w.label)).toEqual(['Mains nues']);
  });
  it('Merveille d’ingénierie (cancels all) sur la main secondaire amputée : le bouclier reste utilisable (LDB 73)', () => {
    const c = {
      characteristics: { force: 30, endurance: 30 },
      traumas: [{ label: 'Main', location: 'brasG', ops: [{ op: 'maxWeaponHands', hands: 1 }], prosthesis: [{ trappingId: 'merveille-d-ingenierie', cancels: 'all' }] }],
      items: [
        item({ uid: 'ep', label: 'Épée', kind: 'melee', damage: { plusBF: true, flat: 4 }, equipped: true }),
        item({ uid: 'bo', label: 'Bouclier', kind: 'melee', damage: { plusBF: true, flat: 0, bare: true }, qualities: [{ id: 'protectrice', value: 1 }], equipped: true }),
        item({ trappingId: 'merveille-d-ingenierie', label: "Merveille d'ingénierie", subType: 'protheses', equipped: true }),
      ],
      loadouts: [{ id: 'l1', name: 'X', main: 'ep', off: 'bo' }],
      activeLoadoutId: 'l1',
    } as unknown as Combatant;
    recomputeLoadout(c);
    expect(c.weapons.map((w) => w.label)).toContain('Bouclier'); // prothèse « tout » → main rétablie, bouclier de nouveau tenu
  });
  it('prothèse PORTÉE = Enc 0 ; possédée mais non portée = son Enc (LDB 73)', () => {
    const worn = { items: [item({ label: 'Fausse jambe', subType: 'protheses', enc: 2, equipped: true })] } as unknown as Combatant;
    expect(totalEncumbrance(worn)).toBe(0);
    const carried = { items: [item({ label: 'Fausse jambe', subType: 'protheses', enc: 2, equipped: false })] } as unknown as Combatant;
    expect(totalEncumbrance(carried)).toBe(2);
  });
  it("maxEncumbrance = Bonus de Force + Bonus d'Endurance (LDB)", () => {
    expect(maxEncumbrance({ characteristics: { force: 35, endurance: 42 } } as unknown as Combatant)).toBe(3 + 4);
  });
  it('maxEncumbrance : +2 par niveau de Costaud (LDB talents)', () => {
    const c = { characteristics: { force: 30, endurance: 30 }, talents: [{ talentId: 'costaud', times: 1 }] } as unknown as Combatant;
    expect(maxEncumbrance(c)).toBe(3 + 3 + 2); // BF+BE + Costaud×2
  });
  it("totalEncumbrance : `sizeFor` ne double JAMAIS l'Enc à l'exécution — le catalogue ogre est déjà saisi à son Enc final (ADE II 2 l.604/l.708, valeurs vérifiées contre les tables l.609-654)", () => {
    const native = { items: [item({ label: 'Massue ogre', enc: 2, sizeFor: 'grande' })] } as unknown as Combatant;
    expect(totalEncumbrance(native)).toBe(2);
    const noSizeFor = { items: [item({ label: 'Épée', enc: 1 })] } as unknown as Combatant;
    expect(totalEncumbrance(noSizeFor)).toBe(1);
  });
  it("catalogue ogre réel (`massue-ogre`) : Enc au total = son Enc de catalogue tel quel (2), jamais doublé", () => {
    const massue = itemFromTrapping('Massue ogre')!;
    expect(massue.sizeFor).toBe('grande');
    const c = { items: [{ ...massue, equipped: false }] } as unknown as Combatant;
    expect(totalEncumbrance(c)).toBe(2);
  });
  it('totalEncumbrance : une armure ÉQUIPÉE (portée) compte −1 ; arme tenue et armure rangée non (LDB Enc. l.22)', () => {
    const c = {
      items: [
        item({ label: 'Armure de cuir', kind: 'armor', enc: 1, equipped: true }), // portée → 0
        item({ label: 'Cotte de mailles', kind: 'armor', enc: 2, equipped: true }), // portée → 1
        item({ label: 'Plastron rangé', kind: 'armor', enc: 2, equipped: false }), // rangé → 2
        item({ label: 'Épée', kind: 'melee', enc: 1, equipped: true }), // tenue, non « portée » → 1
      ],
    } as unknown as Combatant;
    expect(totalEncumbrance(c)).toBe(0 + 1 + 2 + 1);
  });
  it('itemFromTrapping : trapping inconnu → null', () => {
    expect(itemFromTrapping('Objet Totalement Imaginaire XYZ')).toBeNull();
  });
  it('itemFromTrapping : objet du catalogue = identifié (qualités connues) (#2)', () => {
    const it = itemFromTrapping('Hallebarde');
    expect(it).toBeTruthy();
    expect(it!.identified).not.toBe(false); // connu (undefined = identifié par défaut)
  });
});

describe('isWearable — objet PORTABLE sur le corps (#640, LDB 61 l.21 / LDB 73)', () => {
  it('une armure est toujours portable', () => {
    expect(isWearable(item({ kind: 'armor' }))).toBe(true);
  });
  it('misc « vêtements et accessoires » (bijoux/vêtements) et « prothèses » sont portables', () => {
    expect(isWearable(item({ kind: 'misc', subType: 'vetements-et-accessoires' }))).toBe(true);
    expect(isWearable(item({ kind: 'misc', subType: 'protheses' }))).toBe(true);
  });
  it('misc TRANSPORTÉ (outils, sacs, possessions diverses) n’est PAS portable — pas d’exploit d’Encombrement', () => {
    expect(isWearable(item({ kind: 'misc', subType: 'outils-et-necessaires' }))).toBe(false);
    expect(isWearable(item({ kind: 'misc', subType: 'sacs-et-contenants' }))).toBe(false);
    expect(isWearable(item({ kind: 'misc', subType: 'possessions-diverses' }))).toBe(false);
  });
  it('contrat anti-exploit : un misc TRANSPORTÉ équipé ne réduit PAS son Enc, un vêtement équipé le réduit de 1 (LDB 61 l.21)', () => {
    const corde = itemFromTrapping('Corde')!; // possessions-diverses, enc 1
    expect(corde.subType).toBe('possessions-diverses');
    const equippedCorde = { items: [{ ...corde, equipped: true }] } as unknown as Combatant;
    expect(totalEncumbrance(equippedCorde)).toBe(corde.enc); // pas de réduction : la corde se TRANSPORTE

    const vetements = itemFromTrapping('Vêtements')!; // vetements-et-accessoires, enc 1
    expect(vetements.subType).toBe('vetements-et-accessoires');
    const equippedVetements = { items: [{ ...vetements, equipped: true }] } as unknown as Combatant;
    expect(totalEncumbrance(equippedVetements)).toBe(Math.max(0, vetements.enc - 1));
  });
});

describe('totalEncumbrance — qualités d’artisanat (LDB 60 l.18/62)', () => {
  const enc = (items: ItemInstance[]) => totalEncumbrance({ items } as unknown as Combatant);
  it('Léger réduit l’Enc de 1 (plancher 0)', () => {
    expect(enc([item({ kind: 'misc', enc: 2, qualities: [{ id: 'leger' }] })])).toBe(1);
    expect(enc([item({ kind: 'misc', enc: 1, qualities: [{ id: 'leger' }] })])).toBe(0);
  });
  it('Volumineux augmente l’Enc de 1 (objet NON porté)', () => {
    expect(enc([item({ kind: 'melee', enc: 2, qualities: [{ id: 'volumineux' }] })])).toBe(3);
  });
  it('armure portée : -1 (existant) ; Volumineux porté = Enc 1 ; Léger porté cumule (l.62)', () => {
    expect(enc([item({ kind: 'armor', enc: 2, equipped: true })])).toBe(1); // 2-1 (inchangé)
    expect(enc([item({ kind: 'armor', enc: 2, equipped: true, qualities: [{ id: 'volumineux' }] })])).toBe(1); // forcé à 1
    expect(enc([item({ kind: 'armor', enc: 3, equipped: true, qualities: [{ id: 'leger' }] })])).toBe(1); // (3-1)-1 = 1
  });
});

describe('Dégâts d’armure (LDB 63 l.19-21)', () => {
  const heroWith = (items: ItemInstance[]): Combatant =>
    ({ characteristics: { force: 30, endurance: 30 }, items, armour: emptyArmour() }) as unknown as Combatant;

  it('recomputeLoadout dérive la PA NETTE des dégâts (pa − damageTaken, plancher 0)', () => {
    const c = heroWith([item({ kind: 'armor', pa: 3, locs: ['corps'], equipped: true, damageTaken: 1 })]);
    recomputeLoadout(c);
    expect(c.armour.corps).toBe(2);
  });
  it('pièce réduite à 0 (damageTaken ≥ pa) → n’apporte plus de PA', () => {
    const c = heroWith([item({ kind: 'armor', pa: 2, locs: ['corps'], equipped: true, damageTaken: 5 })]);
    recomputeLoadout(c);
    expect(c.armour.corps).toBe(0);
  });
  it('damageArmour (héros) : endommage la pièce la plus solide + re-dérive', () => {
    const c = heroWith([item({ kind: 'armor', pa: 3, locs: ['corps'], equipped: true })]);
    recomputeLoadout(c);
    expect(damageArmour(c, 'corps')).toBe(true);
    expect(c.armour.corps).toBe(2);
  });
  it('damageArmour (ennemi sans items : armure plate) : décrément direct', () => {
    const enemy = { armour: { ...emptyArmour(), tete: 2 } } as unknown as Combatant;
    expect(damageArmour(enemy, 'tete')).toBe(true);
    expect(enemy.armour.tete).toBe(1);
  });
  it('damageArmour : pas d’armure utilisable → false', () => {
    expect(damageArmour({ armour: emptyArmour() } as unknown as Combatant, 'corps')).toBe(false);
  });
});

describe('Munitions & rechargement', () => {
  it('itemFromTrapping lit subType + qty (préfixe) pour une munition', () => {
    const fleche = itemFromTrapping('Flèche')!;
    expect(fleche.kind).toBe('ammo');
    expect(fleche.subType).toBe('arc'); // id de Groupe
    expect(fleche.qty).toBe(12);
    expect(fleche.qualities.some((q) => q.id === 'empaleuse')).toBe(true); // runtime = id
  });
  it('weaponWithAmmo combine Dégâts (concaténés) et fusionne les Atouts', () => {
    const arc: Weapon = { label: 'Arc', type: 'ranged', damage: { plusBF: false, flat: 9 }, range: 60, qualities: [], subType: 'arc', reload: 0 };
    const fleche = itemFromTrapping('Flèche')!;
    const w = weaponWithAmmo(arc, fleche);
    expect(w.qualities.some((q) => q.id === 'empaleuse')).toBe(true); // runtime = id
    // La Flèche n'a pas de modificateur de Dégâts → reste +9.
    expect(damageString(w.damage)).toBe('+9');
  });
  it('compatibleAmmo filtre par subType et qty>0', () => {
    const c = { items: [itemFromTrapping('Flèche'), itemFromTrapping('Carreau')] } as unknown as Combatant;
    const arc: Weapon = { label: 'Arc', type: 'ranged', damage: { plusBF: false, flat: 9 }, qualities: [], subType: 'arc', reload: 0 };
    const list = compatibleAmmo(c, arc);
    expect(list.length).toBe(1);
    expect(list[0].label).toBe('Flèche');
  });
  it('compatibleAmmo : Poudre noire ET Ingénierie acceptent les munitions « Poudre noire et ingénierie » (LDB 62 l.120)', () => {
    const c = { items: [itemFromTrapping('Balle et Poudre')] } as unknown as Combatant;
    const pistolet: Weapon = { label: 'Pistolet', type: 'ranged', damage: { plusBF: false, flat: 8 }, qualities: [{ id: 'pistolet' }], subType: 'poudre-noire', reload: 1 };
    const arqRep: Weapon = { label: 'Arquebus à répétition', type: 'ranged', damage: { plusBF: false, flat: 9 }, qualities: [], subType: 'ingenierie', reload: 5 };
    expect(compatibleAmmo(c, pistolet).map((a) => a.label)).toContain('Balle et Poudre');
    expect(compatibleAmmo(c, arqRep).map((a) => a.label)).toContain('Balle et Poudre');
  });
  it('recomputeLoadout dérive reload depuis « Recharge N » + subType', () => {
    const c = {
      items: [{ ...itemFromTrapping('Tromblon')!, equipped: true }],
      weapons: [],
      armour: emptyArmour(),
      characteristics: { 'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 30, endurance: 30, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 },
    } as unknown as Combatant;
    recomputeLoadout(c);
    const tromblon = c.weapons.find((w) => w.label === 'Tromblon')!;
    expect(tromblon.reload).toBe(2);
    expect(tromblon.subType).toBe('poudre-noire'); // id de Groupe
  });
  it('munition à modificateur de Portée sélectionnée → la Portée (et la bande) de l’arme est modifiée (LDB 62)', () => {
    const bow: Weapon = { label: 'Arc', type: 'ranged', damage: { plusBF: false, flat: 9 }, range: 60, qualities: [], subType: 'arc', reload: 0 };
    const heavy = { ...itemFromTrapping('Flèche')!, ammoRangeMod: { mult: 0.5 as number }, qty: 10 };
    const c = { items: [heavy], ammoUid: heavy.uid } as unknown as Combatant;
    // selectedAmmo récupère la munition équipée et porte son modificateur.
    expect(selectedAmmo(c, bow)?.ammoRangeMod).toEqual({ mult: 0.5 });
    // Portée pleine 60 m → 30 m avec la munition (expression EXACTE des sites combat).
    const full = effectiveWeaponRange(bow, null, 3);
    const withAmmo = effectiveWeaponRange(bow, selectedAmmo(c, bow)?.ammoRangeMod, 3);
    expect(full).toBe(60);
    expect(withAmmo).toBe(30);
    // À 6 m (distanceTiles 3) la fourchette se décale : « Bout portant » (pleine) → « Courte portée » (½).
    expect(rangeBandName(3, full!)).toBe('Bout portant');
    expect(rangeBandName(3, withAmmo!)).toBe('Courte portée');
  });
  it('recomputeLoadout : Arc (sans « Recharge ») → reload 0', () => {
    const c = {
      items: [{ ...itemFromTrapping('Arc')!, equipped: true }],
      weapons: [],
      armour: emptyArmour(),
      characteristics: { 'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 30, endurance: 30, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 },
    } as unknown as Combatant;
    recomputeLoadout(c);
    const arc = c.weapons.find((w) => w.label === 'Arc')!;
    expect(arc.reload).toBe(0);
    expect(arc.subType).toBe('arc'); // id de Groupe
  });
});

// #222 — hydratation d'un poste d'artillerie : la base est RÉSOLUE du catalogue au spawn, l'état d'instance
// préservé ; l'ancienne forme (item copié) est MIGRÉE ; une réf inconnue échoue franchement (fail-fast).
describe('hydratePoste (#222) — réf catalogue → arme hydratée, migration de l’ancienne forme, fail-fast', () => {
  const chef = { characteristics: { 'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 30, endurance: 30, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 }, weapons: [] } as unknown as Combatant;

  it('forme NEUVE : `{ trappingId }` → item complet du catalogue, arme dérivée FONCTIONNELLE', () => {
    const p = hydratePoste({ trappingId: 'canon-moyen', side: 'tribord', crewIds: ['g1'] });
    expect(p.item.trappingId).toBe('canon-moyen');
    const cat = itemFromTrappingById('canon-moyen')!;
    expect(p.item.damage).toEqual(cat.damage); // base RÉSOLUE (jamais copiée en donnée)
    expect(p.item.qualities.map((q) => q.id)).toEqual(cat.qualities.map((q) => q.id));
    expect(p.side).toBe('tribord');
    expect(p.crewIds).toEqual(['g1']);
    const w = mannedPosteWeapon(chef, p)!; // tir/recharge : l'arme dérivée porte le canon complet
    expect(w.type).toBe('ranged');
    expect(w.mountSide).toBe('tribord');
    expect(w.reload).toBeGreaterThan(0); // Recharge N (canon moyen)
  });

  it('uid : préservé s’il est authoré, sinon frais', () => {
    expect(hydratePoste({ trappingId: 'pierrier', uid: 'itm-fixe-1' }).item.uid).toBe('itm-fixe-1');
    expect(hydratePoste({ trappingId: 'pierrier' }).item.uid).toBeTruthy();
  });

  it('MIGRATION de l’ancienne forme : `{ item }` complet → base re-résolue, uid conservé, base copiée jetée', () => {
    const old = itemFromTrappingById('canon-moyen')!;
    old.uid = 'itm-legacy-9';
    (old.damage as { flat: number }).flat = 999; // base copiée PÉRIMÉE (dérive du catalogue)
    const p = hydratePoste({ item: old, side: 'babord' });
    expect(p.item.trappingId).toBe('canon-moyen');
    expect(p.item.uid).toBe('itm-legacy-9'); // état d'instance préservé
    expect(p.item.damage).toEqual(itemFromTrappingById('canon-moyen')!.damage); // base FRAÎCHE (la copie périmée est jetée)
    expect(p.side).toBe('babord');
  });

  it('fail-fast : `trappingId` inconnu → throw explicite', () => {
    expect(() => hydratePoste({ trappingId: 'engin-inexistant-222' })).toThrow(/trappingId inconnu/);
  });

  it('fail-fast : ni `trappingId` ni `item.trappingId` → throw explicite', () => {
    expect(() => hydratePoste({ crewIds: ['g1'] })).toThrow(/réf catalogue absente/);
  });
});

describe('wornArmourPoints (#612) — une pièce `destroyed` ne fournit plus de PA', () => {
  const armor = (p: Partial<ItemInstance> = {}): ItemInstance =>
    ({ uid: 'a', label: 'Cuirasse', kind: 'armor', qualities: [], enc: 1, equipped: true, pa: 2, locs: ['corps'], ...p } as unknown as ItemInstance);

  it('équipée et NON détruite : sa PA nette compte', () => {
    const pa = wornArmourPoints([armor()]);
    expect(pa.corps).toBe(2);
  });

  it('équipée mais `destroyed: true` : ne compte plus (0 PA sur ses localisations)', () => {
    const pa = wornArmourPoints([armor({ destroyed: true })]);
    expect(pa.corps).toBe(0);
  });
});

describe('axe d’ALLONGE — ids STABLES (LDB 62 l.156-164)', () => {
  it('les libellés d’Allonge du catalogue tombent sur l’axe, dans l’ordre RAW', () => {
    const catalogue = [...new Set(trappings.map((t) => t.reach).filter((r): r is NonNullable<typeof r> => !!r))];
    // Toute Allonge du CATALOGUE tombe sur l'axe, SAUF « Variable » — la valeur que le livre imprime
    // pour l'Arme improvisée (LDB 62 l.31), hors axe par nature (elle dépend de l'objet saisi).
    expect(catalogue.filter((r) => reachIdOf(r) == null)).toEqual(['Variable']);
    expect(reachIdOf('Très courte')).toBe('tres-courte');
    expect(reachIdOf('Considérable')).toBe('considerable');
    const rangs = ['Personnelle', 'Très courte', 'Courte', 'Moyenne', 'Longue', 'Très longue', 'Considérable'].map(reachRankOf);
    expect(rangs).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });

  it('une Allonge absente ou hors de l’axe n’a pas de rang', () => {
    expect(reachRankOf(null)).toBeNull();
    expect(reachRankOf(undefined)).toBeNull();
    expect(reachRankOf('Variable')).toBeNull();
    expect(reachIdOf('BFx3')).toBeNull();
  });
});

/**
 * Test de CÂBLAGE — les Mains nues sont LUES dans l'entrée `mains-nues` de `trappings.json`
 * (LDB 62 l.28), pas recopiées en dur : un résolveur injecté portant d'autres valeurs déplace l'arme
 * rendue. Et l'entrée absente est bruyante : aucun repli deviné ne la couvre.
 */
describe('unarmedWeapon — arme LUE dans la donnée (`mains-nues`)', () => {
  const fakeTrapping = (over: Record<string, unknown>) =>
    ({ id: 'mains-nues', label: 'Mains nues', type: 'melee', qualities: [], ...over }) as never;

  it('suit la donnée : dégâts, Allonge, Atouts et Groupe viennent de l’entrée résolue', () => {
    const w = unarmedWeapon(() => fakeTrapping({
      label: 'Poings', damage: { plusBF: true, flat: 3 }, reach: 'Courte', qualities: [{ id: 'assommante' }], subType: 'parade',
    }));
    expect(w.label).toBe('Poings');
    expect(w.damage).toEqual({ plusBF: true, flat: 3 });
    expect(w.reach).toBe('Courte');
    expect(w.subType).toBe('parade');
    expect(w.qualities.some((q) => q.id === 'assommante')).toBe(true);
  });

  it('donnée réelle (LDB 62 l.28) : +BF+0, Personnelle, Inoffensive', () => {
    const w = unarmedWeapon();
    expect(w.damage).toEqual({ plusBF: true, flat: 0 });
    expect(w.reach).toBe('Personnelle');
    expect(w.qualities.some((q) => q.id === 'inoffensive')).toBe(true);
  });

  it('entrée absente = donnée cassée, BRUYANTE — plus aucun repli codé en dur', () => {
    expect(() => unarmedWeapon(() => undefined)).toThrow(/mains-nues/);
  });
});

/**
 * `isUnarmed` lit la MARQUE du catalogue (`TrappingData.unarmed`) sur l'IDENTITÉ de l'arme, et cette
 * identité a DEUX porteurs : le marqueur built-in (`builtinId`, posé par `unarmedWeapon` et persisté
 * dans les sauvegardes) et l'id de catalogue d'une arme dérivée d'une Possession (`trappingId`). Les
 * deux doivent répondre — une arme construite depuis l'entrée `mains-nues` du catalogue (sans
 * `builtinId`) était jusque-là comptée comme arme TENUE (choisissable en attaque/parade, hors
 * empoignade) : elle ne l'est plus.
 */
describe('isUnarmed — la marque du catalogue est lue par les DEUX porteurs d’identité', () => {
  const w = (over: Partial<Weapon>): Weapon =>
    ({ uid: 'w1', label: 'Mains nues', type: 'melee', damage: { plusBF: true, flat: 0 }, qualities: [], ...over }) as Weapon;

  it('`builtinId` (arme canonique, sauvegardes) → mains nues', () => {
    expect(isUnarmed(w({ builtinId: 'mains-nues' }))).toBe(true);
  });

  it('`trappingId` SEUL (arme dérivée de l’entrée de catalogue, sans builtinId) → mains nues aussi', () => {
    expect(isUnarmed(w({ trappingId: 'mains-nues' }))).toBe(true);
  });

  it('une arme réelle du catalogue n’est jamais « mains nues », ni une arme sans identité', () => {
    expect(isUnarmed(w({ trappingId: 'epee', label: 'Épée' }))).toBe(false);
    expect(isUnarmed(w({ label: 'Arme de créature' }))).toBe(false);
  });
});

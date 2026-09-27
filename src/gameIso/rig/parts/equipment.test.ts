import { describe, it, expect } from 'vitest';
import { weaponPart, weaponFamily, shieldPart, armourPart, armourMaterial, equipFromCombatant, isShield } from './equipment';
import { pickView } from './types';
import type { Combatant, Weapon, ItemInstance } from '../../../engine/types';
import { trappings } from '../../../data';
import { itemFromGive, recomputeLoadout, weaponFromItem } from '../../../engine/items';
import { weaponGroup } from '../../../engine/weaponGroup';

const wep = (name: string, type: 'melee' | 'ranged', q: { id: string; value?: number }[] = [], subType?: string): Weapon =>
  ({ label: name, type, damage: { plusBF: false, flat: 4 }, qualities: q, subType } as Weapon);
const wpv = (name: string, type: 'melee' | 'ranged' = 'melee') => pickView(weaponPart(wep(name, type)), 'front');
/** Arme routée PAR SHAPE (id stable) — plus aucun routage par libellé au runtime. */
const wepShape = (shape: string, type: 'melee' | 'ranged' = 'melee'): Weapon =>
  ({ label: 'x', type, damage: { plusBF: false, flat: 4 }, qualities: [], shape } as Weapon);
const famShape = (shape: string, type: 'melee' | 'ranged' = 'melee') => weaponFamily(wepShape(shape, type));

describe('weaponPart', () => {
  it('rend un SVG non vide pour une arme connue', () => {
    expect(wpv('Dague')).toContain('<');
  });
  it('arme inconnue → part générique mêlée non vide', () => {
    expect(wpv('Truc bizarre')).toContain('<');
  });
});

// Contrat « 1 forme par arme » routé PAR SHAPE (id stable), jamais par LIBELLÉ (lookup par libellé =
// bug multilingue) : chaque arme garde une silhouette (slug) distincte ; une arme sans shape retombe
// sur le défaut de son Groupe.
describe('weaponFamily — 1 forme par arme, routée par shape (anti-collapse)', () => {
  it('chaque shape catalogué résout vers lui-même (formes distinctes préservées)', () => {
    expect(famShape('arc_court', 'ranged')).toBe('arc_court');
    expect(famShape('javelot', 'ranged')).not.toBe(famShape('lance_cavalerie'));
    expect(famShape('main_gauche')).not.toBe(famShape('brise_epee'));
    expect(famShape('main_gauche')).not.toBe(famShape('dague'));
    expect(famShape('pioche_2m')).not.toBe(famShape('grande_hache'));
    expect(famShape('fleuret')).not.toBe(famShape('zweihander'));
  });
  it('une arme SANS shape ne route plus par son nom → repli par Groupe', () => {
    expect(weaponFamily(wep('Épée bâtarde', 'melee', [], 'deux-mains'))).toBe('epee_batarde'); // Groupe deux-mains → défaut
    expect(weaponFamily(wep('Truc inconnu', 'melee'))).toBe('epee'); // défaut mêlée
  });
});

describe('isShield', () => {
  it('reconnaît un bouclier par qualité ou nom, pas une épée', () => {
    expect(isShield({ label: 'Targe', qualities: [{ id: 'protectrice', value: 1 }] })).toBe(true);
    expect(isShield({ label: 'Bouclier', qualities: [] })).toBe(true);
    expect(isShield({ label: 'Épée', qualities: [] })).toBe(false);
  });
});

describe('armourMaterial — corrections audit', () => {
  const mat = (name: string, pa: number) =>
    armourMaterial({ uid: 'x', label: name, kind: 'armor', qualities: [], pa, locs: ['corps'], enc: 1, equipped: true } as ItemInstance);
  it('« Plastron de cuir » = cuir (cuir prime sur plaque)', () => {
    expect(mat('Plastron de cuir', 2)).toBe('cuir');
  });
  it('« Plastron » (plaque) = plaque', () => {
    expect(mat('Plastron', 5)).toBe('plaque');
  });
  it('« Jambières d’acier » et « Brassards » = plaque', () => {
    expect(mat("Jambières d'acier", 2)).toBe('plaque');
    expect(mat('Brassards', 2)).toBe('plaque');
  });
  it('« Cotte de mailles » = maille', () => {
    expect(mat('Cotte de mailles', 2)).toBe('maille');
  });
});

describe('armourPart', () => {
  const mail: ItemInstance = { uid: '1', label: 'Cotte de mailles', kind: 'armor', qualities: [], pa: 2, locs: ['corps'], enc: 1, equipped: true };
  it('mappe une pièce de corps sur le slot torse', () => {
    expect(pickView(armourPart(mail, 'torse'), 'front')).toContain('<');
  });
  it('ne renvoie rien si la pièce ne couvre pas l’emplacement', () => {
    expect(armourPart(mail, 'jambes')).toBeNull();
  });
});

describe('shieldPart', () => {
  it('renvoie un SVG de bouclier non vide', () => {
    expect(pickView(shieldPart(wep('Bouclier', 'melee')), 'front')).toContain('<');
  });
});

describe('equipFromCombatant', () => {
  it('extrait armes actives + pièces d’armure équipées + bouclier', () => {
    const c = {
      weapons: [wep('Épée', 'melee'), wep('Bouclier', 'melee')],
      items: [
        { uid: 'a', label: 'Plastron', kind: 'armor', qualities: [], pa: 1, locs: ['corps'], enc: 1, equipped: true } as ItemInstance,
        { uid: 'b', label: 'Heaume', kind: 'armor', qualities: [], pa: 1, locs: ['tete'], enc: 0, equipped: false } as ItemInstance,
      ],
    } as unknown as Combatant;
    const e = equipFromCombatant(c);
    expect(e.armour.map((i) => i.label)).toEqual(['Plastron']); // 'Heaume' non équipé exclu
    expect(e.shield).toBeTruthy();
    expect(e.weapons.length).toBe(2);
  });

  it('superposition : la couche du DESSUS s’affiche (plaque > maille > cuir), par slot', () => {
    const piece = (uid: string, name: string, locs: string[]): ItemInstance =>
      ({ uid, label: name, kind: 'armor', qualities: [], pa: 1, locs, enc: 1, equipped: true } as ItemInstance);
    const c = {
      weapons: [],
      items: [
        piece('cuir', 'Veste de cuir', ['brasG', 'brasD', 'corps']),
        piece('maille', 'Chemise de mailles', ['corps']),
        piece('plate', 'Plastron', ['corps']),
      ],
    } as unknown as Combatant;
    const e = equipFromCombatant(c);
    expect(e.armour.map((i) => i.label)).toEqual(['Plastron', 'Chemise de mailles', 'Veste de cuir']);
    // resolve.ts prend la 1re pièce couvrant le slot → torse = plate, bras = cuir (seule à couvrir).
    expect(pickView(armourPart(e.armour.find((i) => (i.locs ?? []).includes('corps'))!, 'torse'), 'front'))
      .toBe(pickView(armourPart(e.armour[0], 'torse'), 'front'));
  });

  it('cape/manteau porté → EquipCtx.cape (cosmétique) ; non porté → absent', () => {
    const cape = { uid: 'c', label: 'Cape', trappingId: 'cape', kind: 'misc', qualities: [], enc: 0, equipped: true } as ItemInstance;
    const c = { weapons: [], items: [cape] } as unknown as Combatant;
    expect(equipFromCombatant(c).cape?.label).toBe('Cape');
    cape.equipped = false;
    expect(equipFromCombatant(c).cape).toBeUndefined();
  });

  it('chaque trapping d’arme à Groupe (`subType`) garde son Groupe jusqu’à l’arme tenue par le héros (#602)', () => {
    const tenues: string[] = [], enPoste: string[] = [], perdues: string[] = [];
    for (const t of trappings.filter((x) => (x.categorie === 'melee' || x.categorie === 'ranged') && x.subType)) {
      const it = itemFromGive({ trappingId: t.id });
      it.equipped = true;
      const c = { id: 'h', label: 'Héros', items: [it], loadouts: [{ id: 'lo', main: it.uid }], activeLoadoutId: 'lo' } as unknown as Combatant;
      recomputeLoadout(c);
      const tenue = equipFromCombatant(c).weapons.find((w) => w.uid === it.uid);
      const w = tenue ?? weaponFromItem(it); // machine à Équipe (ADE II 8 l.233) : hors loadout, servie en poste
      (tenue ? tenues : enPoste).push(t.id);
      if (weaponGroup(w) !== t.subType) perdues.push(`${t.id}: ${t.subType} → ${String(weaponGroup(w))}`);
    }
    expect(perdues).toEqual([]);
    expect([tenues.length, enPoste.length]).toEqual([122, 22]);
  });
});

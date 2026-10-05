import { describe, it, expect } from 'vitest';
import { weaponPart, weaponFamily, shieldPart, armourPart, armourMaterial, equipPorte, isShield, pieceDeDessin, armeDeDessin, armePrincipale, equipDe } from './equipment';
import { entree as entreeDeGroupe } from '../../../data/schemas/defs/weaponGroups';
import { resolveParts } from './resolve';
import { rigAttackDef, rigDefenseDef } from '../anim/actorAnimSelect';
import { contexteDeGeste } from '../../fx/animTracks';
import { weaponFromId } from '../../../engine/creatureEquip';
import { viewOrFront } from './types';
import type { Combatant, Weapon, ItemInstance, HitLocation } from '../../../engine/types';
import { findMutationById, trappings, weaponGroups } from '../../../data';
import { itemFromTrappingById, recomputeLoadout, weaponFromItem } from '../../../engine/items';
import { weaponGroup } from '../../../engine/weaponGroup';
import { objetDeTest } from '../../../engine/objetDeTest.testkit';

const wep = (name: string, type: 'melee' | 'ranged', q: { id: string; value?: number }[] = [], subType?: string): Weapon =>
  ({ label: name, type, damage: { plusBF: false, flat: 4 }, qualities: q, subType } as Weapon);
const wpv = (name: string, type: 'melee' | 'ranged' = 'melee') => viewOrFront(weaponPart(wep(name, type)), 'front');
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
  it('reconnaît un bouclier par l’id de sa Qualité Protectrice, jamais par son libellé', () => {
    expect(isShield({ qualities: [{ id: 'protectrice', value: 1 }] })).toBe(true);
    expect(isShield({ qualities: [] })).toBe(false);
    expect(isShield(wep('Bouclier', 'melee'))).toBe(false);
  });

  it('catalogue : chaque arme au libellé de bouclier porte Protectrice, et se dessine en bouclier ; la potion homonyme non', () => {
    const armes = trappings.filter((t) => (t.categorie === 'melee' || t.categorie === 'ranged') && /bouclier/i.test(t.label));
    expect(armes.map((t) => t.id)).toContain('bouclier');
    for (const t of armes) {
      const w = weaponFromItem(itemFromTrappingById(t.id)!);
      expect(isShield(w), t.id).toBe(true);
      expect(viewOrFront(shieldPart(w), 'front'), t.id).toContain('<');
    }
    expect(isShield(itemFromTrappingById('bouclier-de-la-forge')!)).toBe(false);
  });
});

describe('armourMaterial — le matériau dessiné du Groupe de la pièce (`subType`), sinon le palier de ses PA', () => {
  it('le matériau dessiné vit sur l’entrée de Groupe d’armure : le schéma le REQUIERT, et le refuse ailleurs', () => {
    const plate = weaponGroups.find((g) => g.id === 'plate')!;
    const { dessin: _dessin, ...sansDessin } = plate;
    expect(entreeDeGroupe.safeParse(plate).success).toBe(true);
    expect(entreeDeGroupe.safeParse(sansDessin).success).toBe(false);
    const arme = weaponGroups.find((g) => g.kind === 'weapon')!;
    expect(entreeDeGroupe.safeParse({ ...arme, dessin: 'plaque' }).success).toBe(false);
  });
  it('chaque Groupe d’armure se dessine par SON matériau, lu dans la donnée', () => {
    for (const g of weaponGroups.filter((x) => x.kind === 'armour')) expect(armourMaterial({ subType: g.id, pa: 0 }), g.id).toBe(g.dessin);
  });
  it('le Groupe prime sur les PA : Mailles à 4 PA reste maille, Cuir souple à 5 PA reste cuir', () => {
    expect(armourMaterial({ subType: 'mailles', pa: 4 })).toBe('maille');
    expect(armourMaterial({ subType: 'cuir-souple', pa: 5 })).toBe('cuir');
    expect(armourMaterial({ subType: 'plate', pa: 1 })).toBe('plaque');
  });
  it('sans Groupe (armure de statbloc dessinée), le palier de PA', () => {
    expect([0, 1, 2, 4].map((pa) => armourMaterial({ pa }))).toEqual(['rembourre', 'cuir', 'maille', 'plaque']);
  });
  it('les armures du catalogue au Groupe Plate se dessinent en plaque, Léviathan et Pansière ogre comprises', () => {
    const plates = trappings.filter((t) => t.categorie === 'armor' && t.subType === 'plate').map((t) => t.id);
    expect(plates).toEqual(expect.arrayContaining(['armure-de-plates-du-leviathan', 'pansiere-ogre']));
    expect(plates.filter((id) => armourMaterial(itemFromTrappingById(id)!) !== 'plaque')).toEqual([]);
  });
});

describe('armourPart', () => {
  const mail = pieceDeDessin(objetDeTest({ uid: '1', trappingId: 'cotte-de-mailles', kind: 'armor', qualities: [], pa: 2, locs: ['corps'], enc: 1, equipped: true }));
  it('mappe une pièce de corps sur le slot torse', () => {
    expect(viewOrFront(armourPart(mail, 'torse'), 'front')).toContain('<');
  });
  it('ne renvoie rien si la pièce ne couvre pas l’emplacement', () => {
    expect(armourPart(mail, 'jambes')).toBeNull();
  });
});

describe('shieldPart', () => {
  it('renvoie un SVG de bouclier non vide', () => {
    expect(viewOrFront(shieldPart(wep('Bouclier', 'melee', [{ id: 'protectrice', value: 1 }])), 'front')).toContain('<');
  });
});

describe('equipPorte', () => {
  it('extrait armes actives + pièces d’armure équipées + bouclier', () => {
    const c = {
      weapons: [wep('Épée', 'melee'), wep('Bouclier', 'melee', [{ id: 'protectrice', value: 1 }])],
      items: [
        objetDeTest({ uid: 'a', trappingId: 'plastron', kind: 'armor', qualities: [], pa: 1, locs: ['corps'], enc: 1, equipped: true }),
        objetDeTest({ uid: 'b', trappingId: 'heaume', kind: 'armor', qualities: [], pa: 1, locs: ['tete'], enc: 0, equipped: false }),
      ],
    } as unknown as Combatant;
    const e = equipPorte(c);
    expect(e.armour.map((i) => i.locs)).toEqual([['corps']]); // 'Heaume' non équipé exclu
    expect(e.shield).toBeTruthy();
    expect(e.weapons.length).toBe(2);
  });

  it('superposition : la couche du DESSUS s’affiche (plaque > maille > cuir), par slot', () => {
    const piece = (uid: string, subType: string, locs: HitLocation[]): ItemInstance =>
      objetDeTest({ uid, trappingId: uid, subType, kind: 'armor', pa: 1, locs, enc: 1, equipped: true });
    const c = {
      weapons: [],
      items: [
        piece('cuir', 'cuir-souple', ['brasG', 'brasD', 'corps']),
        piece('maille', 'mailles', ['corps']),
        piece('plate', 'plate', ['corps']),
      ],
    } as unknown as Combatant;
    const e = equipPorte(c);
    expect(e.armour.map((i) => i.materiau)).toEqual(['plaque', 'maille', 'cuir']);
    // resolve.ts prend la 1re pièce couvrant le slot → torse = plate, bras = cuir (seule à couvrir).
    expect(viewOrFront(armourPart(e.armour.find((i) => (i.locs ?? []).includes('corps'))!, 'torse'), 'front'))
      .toBe(viewOrFront(armourPart(e.armour[0], 'torse'), 'front'));
  });

  it('cape/manteau porté → EquipCtx.cape (cosmétique) ; non porté → absent', () => {
    const cape = objetDeTest({ uid: 'c', trappingId: 'cape', kind: 'misc', qualities: [], enc: 0, equipped: true });
    const c = { weapons: [], items: [cape] } as unknown as Combatant;
    expect(equipPorte(c).cape).toBe(true);
    cape.equipped = false;
    expect(equipPorte(c).cape).toBeUndefined();
  });

  it('chaque trapping d’arme à Groupe (`subType`) garde son Groupe jusqu’à l’arme tenue par le héros (#602)', () => {
    const tenues: string[] = [], enPoste: string[] = [], perdues: string[] = [];
    for (const t of trappings.filter((x) => (x.categorie === 'melee' || x.categorie === 'ranged') && x.subType)) {
      const it = itemFromTrappingById(t.id)!;
      it.equipped = true;
      const c = { id: 'h', label: 'Héros', items: [it], loadouts: [{ id: 'lo', main: it.uid }], activeLoadoutId: 'lo' } as unknown as Combatant;
      recomputeLoadout(c);
      const tenue = c.weapons?.find((w) => w.uid === it.uid);
      if (tenue) expect(equipPorte(c).weapons, `${t.id} : l’arme tenue manque à l’équipement porté`).toContainEqual(armeDeDessin(tenue));
      const w = armeDeDessin(tenue ?? weaponFromItem(it)); // machine à Équipe (ADE II 8 l.233) : hors loadout, servie en poste
      (tenue ? tenues : enPoste).push(t.id);
      if (weaponGroup(w) !== t.subType) perdues.push(`${t.id}: ${t.subType} → ${String(weaponGroup(w))}`);
    }
    expect(perdues).toEqual([]);
    expect([tenues.length, enPoste.length]).toEqual([122, 22]);
  });
});

// Mutation Cornes asymétriques (`grantNaturalWeapon`) : une attaque NATURELLE (`Weapon.natural`), rien en main.
describe('héros cornu sans arme au set : le rig ne dessine aucune arme pour les Cornes', () => {
  it('les Cornes sont naturelles, leur forme est vide', () => {
    const hero = { id: 'h', label: 'h', kind: 'hero', items: [], weapons: [], traits: [], activeEffects: [], mutations: [findMutationById('cornes-asymetriques')!] } as unknown as Combatant;
    recomputeLoadout(hero);
    expect(hero.weapons?.[0]?.label, 'PRÉMISSE : les Cornes sont la première arme du set').toBe('Cornes');
    const cornes = armePrincipale(equipPorte(hero))!;
    expect(cornes.natural).toBe(true);
    expect(weaponFamily(cornes)).toBe('');
  });
});

describe('#2097 J6 — porteur d’un bouclier SEUL : ses gestes suivent ce qui est dessiné, main droite vide', () => {
  const bouclier = weaponFromId('bouclier')!;
  const equip = equipDe([bouclier], []);
  const ctx = contexteDeGeste(equip);

  it('aucune arme principale : l’os `arme` ne dessine rien', () => {
    expect(isShield(bouclier), 'PRÉMISSE : l’arme du catalogue est un bouclier').toBe(true);
    expect(ctx.mainWeapon).toBeUndefined();
    expect(resolveParts('humain', 'M', 'soldat', equip, {}, 1).arme?.svg ?? '').toBe('');
  });

  it('parade : main nue, bouclier levé — jamais la prise d’une lame', () => {
    expect(rigDefenseDef({ kind: 'weapon', defense: 'parade' }, ctx)?.key).toBe('rig:parry:pied:nu:bouclier');
  });

  it('attaque sans arme postée : à mains nues', () => {
    expect(rigAttackDef({ kind: 'weapon' }, ctx).key).toBe('rig:attack:pied:nu');
  });
});

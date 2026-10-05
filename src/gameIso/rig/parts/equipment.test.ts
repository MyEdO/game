import { describe, it, expect } from 'vitest';
import { weaponPart, weaponFamily, shieldPart, armourPart, armourMaterial, equipPorte, pieceDeDessin, armeDeDessin, armePrincipale, equipDe, bouclierDeDessin, type FormeDArme } from './equipment';
import { resolveParts } from './resolve';
import { rigAttackDef, rigDefenseDef } from '../anim/actorAnimSelect';
import { contexteDeGeste } from '../../fx/animTracks';
import { weaponFromId } from '../../../engine/creatureEquip';
import { viewOrFront } from './types';
import type { Combatant, Weapon, ItemInstance } from '../../../engine/types';
import { findMutationById, trappings } from '../../../data';
import { isShieldItem, itemFromGive, recomputeLoadout, weaponFromItem } from '../../../engine/items';
import { weaponGroup } from '../../../engine/weaponGroup';

const wep = (name: string, type: 'melee' | 'ranged', q: { id: string; value?: number }[] = [], subType?: string): Weapon =>
  ({ label: name, type, damage: { plusBF: false, flat: 4 }, qualities: q, subType } as Weapon);
const wpv = (name: string, type: 'melee' | 'ranged' = 'melee') => viewOrFront(weaponPart(armeDeDessin(wep(name, type))), 'front');
/** Projection de forme déjà RÉSOLUE (id stable) — plus aucun routage par libellé au runtime. */
const wepShape = (forme: string, type: 'melee' | 'ranged' = 'melee'): FormeDArme => ({ type, forme });
const famShape = (shape: string, type: 'melee' | 'ranged' = 'melee') => weaponFamily(wepShape(shape, type));

describe('weaponPart', () => {
  it('rend un SVG non vide pour une arme connue', () => {
    expect(wpv('Dague')).toContain('<');
  });
  it('arme inconnue → part générique mêlée non vide', () => {
    expect(wpv('Truc bizarre')).toContain('<');
  });
});

// Contrat « 1 forme par arme » routé PAR FORME résolue (id stable), jamais par LIBELLÉ (lookup par
// libellé = bug multilingue) : chaque arme garde une silhouette (slug) distincte ; une arme sans forme
// résolue retombe sur le défaut de son Groupe.
describe('weaponFamily — 1 forme par arme, routée par la forme résolue (anti-collapse)', () => {
  it('chaque forme résolue cataloguée résout vers elle-même (formes distinctes préservées)', () => {
    expect(famShape('arc_court', 'ranged')).toBe('arc_court');
    expect(famShape('javelot', 'ranged')).not.toBe(famShape('lance_cavalerie'));
    expect(famShape('main_gauche')).not.toBe(famShape('brise_epee'));
    expect(famShape('main_gauche')).not.toBe(famShape('dague'));
    expect(famShape('pioche_2m')).not.toBe(famShape('grande_hache'));
    expect(famShape('fleuret')).not.toBe(famShape('zweihander'));
  });
  it('une arme SANS forme résolue ne route pas par son nom → repli par Groupe', () => {
    expect(weaponFamily(armeDeDessin(wep('Épée bâtarde', 'melee', [], 'deux-mains')))).toBe('epee_batarde'); // Groupe deux-mains → défaut
    expect(weaponFamily(armeDeDessin(wep('Truc inconnu', 'melee')))).toBe('epee'); // défaut mêlée
  });
});

describe('isShieldItem — la marque de l’entrée fait le bouclier (LDB 62 l.33-35)', () => {
  it('ni le libellé ni l’Atout Protectrice sans marque : une arme hors catalogue n’est pas un bouclier', () => {
    expect(isShieldItem(wep('Bouclier', 'melee', [{ id: 'protectrice', value: 2 }]))).toBe(false);
  });

  it('la potion homonyme n’est pas un bouclier', () => {
    expect(isShieldItem(itemFromGive({ trappingId: 'bouclier-de-la-forge' }))).toBe(false);
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
  const mail = pieceDeDessin({ uid: '1', label: 'Cotte de mailles', kind: 'armor', qualities: [], pa: 2, locs: ['corps'], enc: 1, equipped: true });
  it('mappe une pièce de corps sur le slot torse', () => {
    expect(viewOrFront(armourPart(mail, 'torse'), 'front')).toContain('<');
  });
  it('ne renvoie rien si la pièce ne couvre pas l’emplacement', () => {
    expect(armourPart(mail, 'jambes')).toBeNull();
  });
});

describe('shieldPart', () => {
  it('renvoie un SVG de bouclier non vide', () => {
    expect(viewOrFront(shieldPart(bouclierDeDessin(weaponFromId('bouclier')!)), 'front')).toContain('<');
  });
});

describe('equipPorte', () => {
  it('extrait armes actives + pièces d’armure équipées + bouclier', () => {
    const c = {
      weapons: [wep('Épée', 'melee'), weaponFromId('bouclier')!],
      items: [
        { uid: 'a', label: 'Plastron', kind: 'armor', qualities: [], pa: 1, locs: ['corps'], enc: 1, equipped: true } as ItemInstance,
        { uid: 'b', label: 'Heaume', kind: 'armor', qualities: [], pa: 1, locs: ['tete'], enc: 0, equipped: false } as ItemInstance,
      ],
    } as unknown as Combatant;
    const e = equipPorte(c);
    expect(e.armour.map((i) => i.locs)).toEqual([['corps']]); // 'Heaume' non équipé exclu
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
    const e = equipPorte(c);
    expect(e.armour.map((i) => i.materiau)).toEqual(['plaque', 'maille', 'cuir']);
    // resolve.ts prend la 1re pièce couvrant le slot → torse = plate, bras = cuir (seule à couvrir).
    expect(viewOrFront(armourPart(e.armour.find((i) => (i.locs ?? []).includes('corps'))!, 'torse'), 'front'))
      .toBe(viewOrFront(armourPart(e.armour[0], 'torse'), 'front'));
  });

  it('cape/manteau porté → EquipCtx.cape (cosmétique) ; non porté → absent', () => {
    const cape = { uid: 'c', label: 'Cape', trappingId: 'cape', kind: 'misc', qualities: [], enc: 0, equipped: true } as ItemInstance;
    const c = { weapons: [], items: [cape] } as unknown as Combatant;
    expect(equipPorte(c).cape).toBe(true);
    cape.equipped = false;
    expect(equipPorte(c).cape).toBeUndefined();
  });

  it('chaque trapping d’arme à Groupe (`subType`) garde son Groupe jusqu’à l’arme tenue par le héros (#602)', () => {
    const tenues: string[] = [], enPoste: string[] = [], perdues: string[] = [];
    for (const t of trappings.filter((x) => (x.categorie === 'melee' || x.categorie === 'ranged') && x.subType)) {
      const it = itemFromGive({ trappingId: t.id });
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
    expect(isShieldItem(bouclier), 'PRÉMISSE : l’arme du catalogue est un bouclier').toBe(true);
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

import { describe, it, expect } from 'vitest';
import { compareEquip, isShieldItem } from './equipCompare';
import type { Combatant, ItemInstance, Weapon } from './types';
import { REACH_LABELS } from './types';
import { objetDeTest, type SurchargeDObjet } from './objetDeTest.testkit';

// « Actuellement équipé » = l'arme tenue dans le set actif (Weapon dérivés `c.weapons`) ; l'armure reste pilotée
// par `items.equipped`. On modélise donc l'équipement courant via `weapons` (armes) et `items` (armure).
const hero = (p: { weapons?: Partial<Weapon>[]; items?: SurchargeDObjet[] }): Combatant =>
  ({ id: 'h', name: 'H', weapons: (p.weapons ?? []) as Weapon[], items: (p.items ?? []) as ItemInstance[] } as unknown as Combatant);
const it_ = (p: SurchargeDObjet): ItemInstance =>
  objetDeTest({ uid: p.uid ?? 'n', trappingId: 'arme-simple', kind: 'melee', qualities: [], enc: 0, equipped: false, ...p });

describe('compareEquip (accordéon « équiper » du marchand)', () => {
  it('mêlée : améliore les Dégâts et l’Allonge vs l’arme actuelle', () => {
    const h = hero({ weapons: [{ uid: 'cur', label: 'Dague', type: 'melee', damage: { plusBF: true, flat: 0, bare: true }, reach: 'Très courte', qualities: [] }] });
    const epee = it_({ uid: 'new', trappingId: 'arme-simple', kind: 'melee', damage: { plusBF: true, flat: 4 }, reach: 'Moyenne', qualities: [{ id: 'precise' }] });
    const c = compareEquip(epee, h);
    expect(c.slot).toBe('melee');
    expect(c.currentName).toBe('Dague');
    const dmg = c.rows.find((r) => r.label === 'Dégâts')!;
    expect(dmg.next).toBe('+BF+4');
    expect(dmg.trend).toBe('up');
    expect(c.rows.find((r) => r.label === 'Allonge')!.trend).toBe('up');
  });

  it('mêlée sans arme tenue : base de comparaison = mains nues +BF+0 (LDB 62 l.28), pas de currentName', () => {
    const h = hero({ weapons: [{ uid: 'mn', label: 'Mains nues', type: 'melee', damage: { plusBF: true, flat: 0 }, qualities: [], builtinId: 'mains-nues' }] });
    const c = compareEquip(it_({ trappingId: 'dague', damage: { plusBF: true, flat: 0, bare: true }, reach: 'Très courte' }), h);
    expect(c.currentName).toBeNull(); // les Mains nues ne comptent pas comme arme « actuelle »
    const dmg = c.rows.find((r) => r.label === 'Dégâts')!;
    expect(dmg.current).toBe('+BF+0 (mains nues)'); // base = mains nues +BF+0 (pas +BF-2)
    expect(dmg.trend).toBe('same'); // une arme à +BF+0 ne surclasse pas les mains nues
  });

  it('mêlée : downgrade signalé (Dégâts inférieurs)', () => {
    const h = hero({ weapons: [{ uid: 'cur', label: 'Zweihänder', type: 'melee', damage: { plusBF: true, flat: 6 }, reach: 'Longue', qualities: [] }] });
    const c = compareEquip(it_({ trappingId: 'couteau', damage: { plusBF: true, flat: -1 }, reach: 'Très courte' }), h);
    expect(c.rows.find((r) => r.label === 'Dégâts')!.trend).toBe('down');
    expect(c.rows.find((r) => r.label === 'Allonge')!.trend).toBe('down');
  });

  it('mêlée : une Pique (Considérable) allonge le bras face à une Moyenne (LDB 62 l.156-164)', () => {
    const h = hero({ weapons: [{ uid: 'cur', label: 'Épée', type: 'melee', damage: { plusBF: true, flat: 4 }, reach: 'Moyenne', qualities: [] }] });
    const c = compareEquip(it_({ trappingId: 'pique', damage: { plusBF: true, flat: 4 }, reach: 'Considérable' }), h);
    const allonge = c.rows.find((r) => r.label === 'Allonge')!;
    expect(allonge.next).toBe('Considérable');
    expect(allonge.trend).toBe('up');
  });

  it('mêlée sans arme tenue : l’Allonge se compare aux mains nues (Personnelle, LDB 62 l.158)', () => {
    const h = hero({ weapons: [{ uid: 'mn', label: 'Mains nues', type: 'melee', damage: { plusBF: true, flat: 0 }, reach: 'Personnelle', qualities: [], builtinId: 'mains-nues' }] });
    const c = compareEquip(it_({ trappingId: 'pique', damage: { plusBF: true, flat: 4 }, reach: 'Considérable' }), h);
    const allonge = c.rows.find((r) => r.label === 'Allonge')!;
    expect(allonge.current).toBe('Personnelle (mains nues)');
    expect(allonge.trend).toBe('up');
  });

  it('mêlée : Personnelle est le bas de l’axe — une Très courte l’améliore, l’inverse la dégrade', () => {
    const poings = { uid: 'cur', label: 'Cestus', type: 'melee' as const, damage: { plusBF: true, flat: 0 }, reach: REACH_LABELS.personnelle, qualities: [] };
    const up = compareEquip(it_({ trappingId: 'dague', damage: { plusBF: true, flat: 0 }, reach: 'Très courte' }), hero({ weapons: [poings] }));
    expect(up.rows.find((r) => r.label === 'Allonge')!.trend).toBe('up');
    const dague = { uid: 'cur', label: 'Dague', type: 'melee' as const, damage: { plusBF: true, flat: 0 }, reach: REACH_LABELS['tres-courte'], qualities: [] };
    const down = compareEquip(it_({ trappingId: 'coup-de-poing', damage: { plusBF: true, flat: 0 }, reach: 'Personnelle' }), hero({ weapons: [dague] }));
    expect(down.rows.find((r) => r.label === 'Allonge')!.trend).toBe('down');
  });

  it('mêlée : l’Allonge « Variable » (Arme improvisée, LDB 62 l.31) n’affirme ni hausse ni baisse', () => {
    const h = hero({ weapons: [{ uid: 'cur', label: 'Épée', type: 'melee', damage: { plusBF: true, flat: 4 }, reach: 'Moyenne', qualities: [] }] });
    const c = compareEquip(it_({ trappingId: 'arme-improvisee', damage: { plusBF: true, flat: 1 }, reach: 'Variable' }), h);
    const allonge = c.rows.find((r) => r.label === 'Allonge')!;
    expect(allonge.next).toBe('Variable');
    expect(allonge.trend).toBe('same');
    const inverse = compareEquip(it_({ trappingId: 'arme-simple', damage: { plusBF: true, flat: 4 }, reach: 'Moyenne' }), hero({ weapons: [{ uid: 'cur', label: 'Arme improvisée', type: 'melee', damage: { plusBF: true, flat: 1 }, reach: 'Variable', qualities: [] }] }));
    expect(inverse.rows.find((r) => r.label === 'Allonge')!.trend).toBe('same');
  });

  it('distance : compare la Portée, n’exige pas d’arme de mêlée tenue', () => {
    const h = hero({ weapons: [{ uid: 'm', label: 'Épée', type: 'melee', damage: { plusBF: true, flat: 4 }, qualities: [] }] });
    const arc = it_({ trappingId: 'arc', kind: 'ranged', damage: { plusBF: false, flat: 9 }, range: 90, qualities: [] });
    const c = compareEquip(arc, h);
    expect(c.slot).toBe('ranged');
    expect(c.currentName).toBeNull(); // pas d'arme à distance tenue
    expect(c.rows.find((r) => r.label === 'Portée')!.trend).toBe('up');
  });

  it('armure : PA par zone, gain sur le Corps quand la neuve fait mieux', () => {
    const h = hero({ items: [objetDeTest({ uid: 'cur', trappingId: 'veste-de-cuir', kind: 'armor', pa: 1, locs: ['corps'], qualities: [], equipped: true })] });
    const maille = it_({ trappingId: 'chemise-de-mailles', kind: 'armor', pa: 3, locs: ['corps'], qualities: [] });
    const c = compareEquip(maille, h);
    expect(c.slot).toBe('armor');
    const corps = c.rows.find((r) => r.label === 'PA Corps')!;
    expect(corps.current).toBe('1');
    expect(corps.next).toBe('3');
    expect(corps.trend).toBe('up');
  });

  it('bouclier : compare la Protection (Protectrice N), exclut l’objet lui-même', () => {
    expect(isShieldItem({ qualities: [{ id: 'protectrice', value: 1 }] })).toBe(true);
    const h = hero({ weapons: [{ uid: 'cur', label: 'Bouclier (Targe)', type: 'melee', qualities: [{ id: 'protectrice', value: 1 }, { id: 'defensive' }] }] });
    const grand = it_({ uid: 'new', trappingId: 'bouclier-grand', kind: 'melee', qualities: [{ id: 'protectrice', value: 3 }, { id: 'defensive' }] });
    const c = compareEquip(grand, h);
    expect(c.slot).toBe('shield');
    expect(c.currentName).toBe('Bouclier (Targe)');
    expect(c.rows[0].trend).toBe('up');
  });
});

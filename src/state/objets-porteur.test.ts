import { describe, it, expect, beforeEach } from 'vitest';
import { useGame } from './store';
import type { Combatant, ItemInstance } from '../engine/types';
import { heroCarrier } from '../engine/carrier';
import {
  addItemToHero, itemFromTrappingById, loadoutCreate, loadoutSetSlot, recomputeLoadout, receiveItems, totalEncumbrance,
  isWeaponActive, buildInventory, weaponItem,
} from '../engine/items';
import { applyOps } from '../engine/ops';
import { gearFromEffects } from './combatEffects';
import { ensureBourse, ensureBourseInstance, bourseInstanceOf } from '../engine/bourse';
import { equipConjuredWeapon } from '../engine/conjuredWeapons';
import { pregen, PREGEN } from '../data/pregens';
import { testScenarios } from '../scenes/test-scenarios';

/**
 * #1473/#1985 — un objet d'un porteur est dans UN placement (tenu dans un set, porté, rangé, libre) et
 * entre chez lui par `receiveItems`. Après chaque geste : aucun uid à la fois dans un emplacement de
 * set et `inside` (ni porté et rangé), et l'encombrement lu égale celui d'un inventaire re-dérivé.
 */
function verifie(h: Combatant): void {
  const items = h.items ?? [];
  const tenus = new Set((h.loadouts ?? []).flatMap((lo) => [lo.main, lo.off]).filter((u): u is string => !!u));
  const deuxPlacements = items.filter((i) => i.inside && (tenus.has(i.uid) || i.equipped)).map((i) => i.label);
  expect(deuxPlacements, h.label).toEqual([]);
  const rederive: Combatant = structuredClone(h);
  recomputeLoadout(rederive);
  expect(h.encumbrance, h.label).toBe(rederive.encumbrance);
}

const trapping = (id: string): ItemInstance => itemFromTrappingById(id)!;
const dernier = (h: Combatant): ItemInstance => h.items![h.items!.length - 1];
const sacDe = (h: Combatant) => (h.items ?? []).find((i) => i.container && i.trappingId !== 'bourse')!;
const heros = (i: number) => useGame.getState().party[i];

describe('placement — écrivains de `inside`, `equipped` et des sets', () => {
  beforeEach(() => useGame.setState({ party: [], possessions: [] }));

  it('assigner à un set une arme rangée la sort du sac (`loadoutSetSlot` → `unstow`)', () => {
    const h = addItemToHero(pregen(PREGEN.chasseur), 'arc');
    const arc = dernier(h);
    expect(arc.inside).toBe(sacDe(h).uid);
    useGame.setState({ party: [h] });
    useGame.getState().setLoadoutSlot(h.id, loadoutCreate(h), 'main', arc.uid);
    expect(heros(0).items!.find((i) => i.uid === arc.uid)!.inside).toBeUndefined();
    verifie(heros(0));
  });

  it('ranger l’arme d’un set INACTIF la retire du set : l’activer laisse les mains vides', () => {
    const base = addItemToHero(pregen(PREGEN.chasseur), 'arc');
    const arc = dernier(base);
    const lo2 = loadoutCreate(base);
    loadoutSetSlot(base, lo2, 'main', arc.uid);
    base.activeLoadoutId = base.loadouts![0].id;
    recomputeLoadout(base);
    useGame.setState({ party: [base] });
    useGame.getState().stowItem(base.id, arc.uid, sacDe(base).uid);
    verifie(heros(0));
    expect(heros(0).loadouts!.some((l) => l.main === arc.uid || l.off === arc.uid)).toBe(false);
    useGame.getState().setActiveLoadout(base.id, lo2);
    const fin = heros(0);
    expect(isWeaponActive(fin, arc.uid)).toBe(false);
    expect(fin.loadouts!.find((l) => l.id === lo2)).toEqual({ id: lo2 });
    verifie(fin);
  });

  it('porter un objet rangé le sort du sac ; le sortir le laisse en vrac', () => {
    const h = addItemToHero(pregen(PREGEN.chasseur), 'cape');
    const cape = dernier(h);
    expect(cape.inside).toBeDefined();
    useGame.setState({ party: [h] });
    useGame.getState().toggleEquip(h.id, cape.uid);
    const porte = heros(0).items!.find((i) => i.uid === cape.uid)!;
    expect([porte.equipped, porte.inside]).toEqual([true, undefined]);
    verifie(heros(0));
    useGame.getState().stowItem(h.id, cape.uid, sacDe(h).uid);
    useGame.getState().stowItem(h.id, cape.uid, null);
    const vrac = heros(0).items!.find((i) => i.uid === cape.uid)!;
    expect([vrac.equipped, vrac.inside]).toEqual([false, undefined]);
    verifie(heros(0));
  });

  it('`buildInventory` et `ensureDefaultLoadout` : aucune arme portée n’est rangée, sur chaque pré-tiré', () => {
    for (const id of Object.values(PREGEN)) verifie(pregen(id));
    const inv = buildInventory([{ id: 'epee' }, { id: 'arc' }, { id: 'veste-de-cuir' }, { id: 'justaucorps-de-cuir' }]);
    expect(inv.filter((i) => i.equipped && i.inside)).toEqual([]);
  });

  it('chaque héros des scénarios de test sort de sa mise en place sans double placement', () => {
    for (const sc of testScenarios) for (const h of sc.construire().party) verifie(h);
  });

  it('Écuries : l’arc d’Aelindra est en main, hors de la Besace, Enc 7', () => {
    const sc = testScenarios.find((s) => s.id === 'ecuries-clayonnage')!;
    const h = sc.construire().party.find((x) => x.items?.some((i) => i.trappingId === 'arc'))!;
    const arc = h.items!.find((i) => i.trappingId === 'arc')!;
    expect(isWeaponActive(h, arc.uid)).toBe(true);
    expect(arc.inside).toBeUndefined();
    expect(totalEncumbrance(h)).toBe(7);
  });
});

describe('entrée — `receiveItems` et ses flux', () => {
  beforeEach(() => useGame.setState({ party: [], possessions: [] }));

  it('donner une Bourse qui contient une flèche : la flèche reste dans la Bourse chez le receveur', () => {
    const A = ensureBourse(pregen(PREGEN.soldat));
    const bourse = bourseInstanceOf(A)!;
    const fleche: ItemInstance = { ...trapping('fleche'), inside: bourse.uid };
    receiveItems(heroCarrier(A), [fleche]);
    expect(A.items!.find((i) => i.uid === fleche.uid)!.inside).toBe(bourse.uid);
    const B = pregen(PREGEN.chasseur);
    useGame.setState({ party: [A, B] });
    useGame.getState().transferItem(bourse.uid, A.id, B.id);
    const recu = heros(1).items!;
    expect(recu.find((i) => i.uid === fleche.uid)!.inside).toBe(bourse.uid);
    expect(recu.find((i) => i.uid === bourse.uid)!.inside).toBeUndefined();
    expect(bourseInstanceOf(heros(0))).toBeUndefined();
    verifie(heros(0));
    verifie(heros(1));
  });

  it('donner un objet simple : il est rangé par défaut chez le receveur, jamais laissé pendre au sac du donneur', () => {
    const A = addItemToHero(pregen(PREGEN.chasseur), 'dague');
    const dague = dernier(A);
    expect(dague.inside).toBe(sacDe(A).uid);
    const B = pregen(PREGEN.apothicaire);
    useGame.setState({ party: [A, B] });
    useGame.getState().transferItem(dague.uid, A.id, B.id);
    expect(heros(1).items!.find((i) => i.uid === dague.uid)!.inside).toBe(sacDe(B).uid);
    verifie(heros(1));
  });

  it('donner d’un héros à une possession puis la re-donner : le sac y entre avec son contenu', () => {
    const A = addItemToHero(addItemToHero(pregen(PREGEN.soldat), 'sac-a-dos'), 'dague');
    const sac = A.items!.find((i) => i.trappingId === 'sac-a-dos')!;
    const dague = dernier(A);
    useGame.setState({ party: [{ ...A, items: A.items!.map((i) => (i.uid === dague.uid ? { ...i, inside: sac.uid } : i)) }] });
    const mule = useGame.getState().addPossession({ nature: 'bete', ref: { creatureId: 'mule' }, ownerId: A.id, location: { kind: 'avec-le-groupe' }, items: [] });
    useGame.getState().transferItem(sac.uid, A.id, mule);
    const surMule = useGame.getState().possessions[0].items;
    expect(surMule.map((i) => i.uid).sort()).toEqual([sac.uid, dague.uid].sort());
    expect(surMule.find((i) => i.uid === dague.uid)!.inside).toBe(sac.uid);
    expect(heros(0).items!.some((i) => i.uid === sac.uid || i.uid === dague.uid)).toBe(false);
    verifie(heros(0));
  });

  it('`receiveItems` sur une possession : copie non portée, rangée par défaut, sans re-dérivation de héros', () => {
    const sac = trapping('sac-a-dos');
    const uid = useGame.getState().addPossession({ nature: 'bete', ref: { creatureId: 'mule' }, ownerId: 'h', location: { kind: 'avec-le-groupe' }, items: [sac] });
    const mule = useGame.getState().possessions.find((p) => p.uid === uid)!;
    const epee = { ...trapping('epee'), equipped: true };
    const [entree] = receiveItems({ kind: 'possession', possession: mule }, [epee]);
    expect(entree).not.toBe(epee);
    expect([entree.equipped, entree.inside]).toEqual([false, sac.uid]);
  });

  it('flux d’entrée : achat, op `giveTrapping`, Bourse, arme invoquée, butin de victoire', () => {
    const achat = addItemToHero(pregen(PREGEN.soldat), 'corde');
    verifie(achat);

    const op = pregen(PREGEN.soldat);
    applyOps(op, [{ op: 'giveTrapping', trappingId: 'ration', count: 2 }], { label: 'Test' });
    expect(op.items!.filter((i) => i.trappingId === 'ration' && i.inside).length).toBeGreaterThanOrEqual(2);
    verifie(op);

    const b1 = ensureBourse({ ...pregen(PREGEN.soldat), items: [] });
    verifie(b1);
    const b2 = { ...pregen(PREGEN.soldat), items: [] as ItemInstance[] };
    const inst = ensureBourseInstance(b2)!;
    expect(bourseInstanceOf(b2)).toBe(inst);
    verifie(b2);

    const c = pregen(PREGEN.soldat);
    const arme = weaponItem({ label: 'Arme aethyrique', damage: { plusBF: true, flat: 1 }, conjured: true, uid: { prefix: 'conjure' } });
    const set = equipConjuredWeapon(c, arme);
    expect(c.activeLoadoutId).toBe(set.loadoutId);
    expect(isWeaponActive(c, arme.uid)).toBe(true);
    verifie(c);

    useGame.setState({
      party: [pregen(PREGEN.soldat)],
      pendingVictory: { xp: 0, gold: { gold: 0, silver: 0, brass: 0 }, gear: gearFromEffects([{ type: 'giveTrapping', trappingId: 'dague' }]).gear, defeated: [] },
    });
    useGame.getState().assignVictoryGear(0, heros(0).id);
    expect(dernier(heros(0)).trappingId).toBe('dague');
    verifie(heros(0));
  });
});

/**
 * Pièces de créature (ZI 13 l.282, l.294, l.319 ; #1988 B4a-i) : une entrée de catalogue MARQUÉE
 * `exigeUneCreature`, désignée par `PIECES_DE_CREATURE_TRAPPING_ID`, qui ne naît que par la fabrique de
 * don (`instancesDeDon` → `pieceDeCreature`) avec la créature dont elle provient.
 */
import { describe, it, expect } from 'vitest';
import { creatures, findTrappingById, trappings, trappingsInstanciables } from '../data';
import { DONNABLE, EXIGE_UNE_CREATURE, INSTANCIABLE_PAR_ID, RECOLTABLE } from '../data/schemas/grammaire/sousListes';
import { dansLaSousListe, idsDeLaSousListe } from '../data/schemas/grammaire/ref';
import { giveTrappingSchema } from '../data/schemas/defs-scenes/effets';
import { compteDObjetsSchema, gameOpSchema, OP_DEFS } from '../data/schemas/grammaire/mecanique';
import { fr } from '../i18n/messages/fr';
import type { MsgKey } from '../i18n';
import { giveTrappingLabel, instancesDeDon, itemFromTrappingById, itemLabel, itemsEncumbrance, pieceDeCreature, type TrappingResolver } from './items';
import { applyOps } from './ops';
import { conjureFormOptions } from './conjuredWeapons';
import { orderCatalog } from './activities';
import { PIECES_DE_CREATURE_TRAPPING_ID, valeurDUnePiece } from './harvest';
import { toBrass } from './money';
import type { Combatant, ItemInstance } from './types';

const RECOLTABLES = creatures.filter((c) => c.harvest);
const SANS_RECOLTE = creatures.find((c) => !c.harvest)!;
const GRIFFON = 'griffon';
const sansUid = ({ uid: _uid, ...reste }: ItemInstance) => reste;
const effet = (don: object) => giveTrappingSchema.safeParse({ type: 'giveTrapping', ...don });
const messages = (r: { error?: { issues: { message: string }[] } }) => (r.error?.issues ?? []).map((i) => i.message).join('\n');

describe('contrat de la constante `PIECES_DE_CREATURE_TRAPPING_ID`', () => {
  it('l’entrée existe, porte `exigeUneCreature`, pèse 1 Enc (ZI 13 l.282), hors commerce, et `itemFromTrappingById` la refuse', () => {
    const t = findTrappingById(PIECES_DE_CREATURE_TRAPPING_ID)!;
    expect(t).toBeDefined();
    expect(t.exigeUneCreature).toBe(true);
    expect(t.enc).toBe(1);
    expect(t.price).toBeNull();
    expect(t.availability).toBeNull();
    expect(() => itemFromTrappingById(PIECES_DE_CREATURE_TRAPPING_ID)).toThrow(/INSTANCIABLE_PAR_ID[\s\S]*pieceDeCreature/);
  });
});

describe('composition `DONNABLE` / `INSTANCIABLE_PAR_ID`', () => {
  it('`INSTANCIABLE_PAR_ID` = `DONNABLE` + `EXIGE_UNE_CREATURE`, aucun nom de marqueur redit', () => {
    expect(INSTANCIABLE_PAR_ID.horsMarqueurs).toEqual([...DONNABLE.horsMarqueurs, EXIGE_UNE_CREATURE]);
  });

  it('parcouru sur le catalogue : donnable sans être instanciable ⇔ l’entrée porte `exigeUneCreature`', () => {
    const ecart = trappings.filter((t) => (dansLaSousListe(DONNABLE, t) && !dansLaSousListe(INSTANCIABLE_PAR_ID, t)) !== (t.exigeUneCreature === true));
    expect(ecart.map((t) => t.id)).toEqual([]);
    expect(trappings.some((t) => t.exigeUneCreature)).toBe(true);
  });

  it('`RECOLTABLE` (inclusion) retient exactement les créatures qui portent `harvest`', () => {
    expect([...idsDeLaSousListe('creature', RECOLTABLE)]).toEqual(RECOLTABLES.map((c) => c.id));
    expect(creatures.filter((c) => dansLaSousListe(RECOLTABLE, c)).map((c) => c.id)).toEqual(RECOLTABLES.map((c) => c.id));
  });
});

describe('marqueur, classe entière — parcouru sur le catalogue', () => {
  const HORS = trappings.filter((t) => !dansLaSousListe(INSTANCIABLE_PAR_ID, t));
  const formes = new Set(conjureFormOptions({ skills: [] }).map((f) => f.weapon));

  it('témoin : la classe porte un service ET la pièce', () => {
    expect(HORS.some((t) => t.service)).toBe(true);
    expect(HORS.map((t) => t.id)).toContain(PIECES_DE_CREATURE_TRAPPING_ID);
  });

  it.each(HORS.map((t) => [t.id, t] as const))('%s : lève à l’instanciation, refusé par l’op, absent des producteurs', (id) => {
    expect(() => itemFromTrappingById(id)).toThrow(/INSTANCIABLE_PAR_ID/);
    expect(gameOpSchema.safeParse({ op: 'giveTrapping', trappingId: id }).success).toBe(false);
    expect(formes.has(id)).toBe(false);
    expect(trappingsInstanciables().some((t) => t.id === id)).toBe(false);
    expect(orderCatalog().some((t) => t.id === id)).toBe(false);
  });

  it('l’Effet refuse tout service et admet la pièce avec sa créature', () => {
    for (const t of HORS.filter((x) => x.service)) expect(messages(effet({ trappingId: t.id })), t.id).toMatch(/porte « Objet-service »/);
    expect(effet({ trappingId: PIECES_DE_CREATURE_TRAPPING_ID, creatureId: GRIFFON }).success).toBe(true);
  });
});

describe('invariant de l’Effet : `creatureId` présent ⇔ l’entrée porte `exigeUneCreature`', () => {
  it('refusé sans `creatureId` sur l’entrée marquée', () => {
    expect(messages(effet({ trappingId: PIECES_DE_CREATURE_TRAPPING_ID }))).toMatch(/porte « Exige une créature » : le don nomme la créature dont la pièce provient\./);
  });
  it('refusé avec un `creatureId` sur une autre entrée', () => {
    expect(messages(effet({ trappingId: 'dague', creatureId: GRIFFON }))).toMatch(/« dague » ne porte pas « Exige une créature » : le don ne nomme aucune créature\./);
  });
  it('refusé avec une créature inconnue', () => {
    expect(effet({ trappingId: PIECES_DE_CREATURE_TRAPPING_ID, creatureId: 'creature-inexistante' }).success).toBe(false);
  });
  it('refusé avec une créature SANS profil de récolte', () => {
    expect(messages(effet({ trappingId: PIECES_DE_CREATURE_TRAPPING_ID, creatureId: SANS_RECOLTE.id }))).toMatch(/ne porte pas « Récolte »/);
  });
});

describe('structure', () => {
  it('`price` est mort du schéma de l’Effet', () => {
    expect('price' in giveTrappingSchema.shape).toBe(false);
    expect(effet({ trappingId: 'dague', price: { gold: 1 } }).success).toBe(false);
  });

  it('`eff.harvestPart` est morte du catalogue des messages', () => {
    // @ts-expect-error — la clé n'existe plus
    const cle: MsgKey = 'eff.harvestPart';
    expect(cle in fr).toBe(false);
  });

  it('le schéma de compte est le MÊME objet pour l’Effet et pour l’op', () => {
    const opGive = OP_DEFS.giveTrapping as unknown as { shape: { count: { unwrap(): unknown } } };
    expect(giveTrappingSchema.shape.count.unwrap()).toBe(compteDObjetsSchema);
    expect(opGive.shape.count.unwrap()).toBe(compteDObjetsSchema);
    expect(compteDObjetsSchema.safeParse(0).success || compteDObjetsSchema.safeParse(1.5).success).toBe(false);
  });
});

describe('fabrique : `pieceDeCreature` et `instancesDeDon`', () => {
  it('une pièce porte l’entrée, sa créature et 1 Enc ; son libellé compose la créature', () => {
    const p = pieceDeCreature(GRIFFON);
    expect(p.trappingId).toBe(PIECES_DE_CREATURE_TRAPPING_ID);
    expect(p.creatureId).toBe(GRIFFON);
    expect(p.enc).toBe(1);
    expect(itemLabel(p)).toBe('Pièces de créature brutes (Griffon)');
    expect(giveTrappingLabel({ trappingId: PIECES_DE_CREATURE_TRAPPING_ID, creatureId: GRIFFON })).toBe(itemLabel(p));
  });

  it('`instancesDeDon` rend N pièces distinctes, chacune portant sa créature', () => {
    const its = instancesDeDon({ trappingId: PIECES_DE_CREATURE_TRAPPING_ID, creatureId: GRIFFON }, 4);
    expect(its).toHaveLength(4);
    expect(new Set(its.map((i) => i.uid)).size).toBe(4);
    expect(its.map(sansUid)).toEqual(Array(4).fill(sansUid(pieceDeCreature(GRIFFON))));
    expect(itemsEncumbrance(its)).toBe(4);
  });

  it('les discordances entre l’entrée et `creatureId` lèvent avec leur nom', () => {
    expect(() => instancesDeDon({ trappingId: PIECES_DE_CREATURE_TRAPPING_ID }, 1)).toThrow(/n'a pas de `creatureId`/);
    expect(() => instancesDeDon({ trappingId: 'dague', creatureId: GRIFFON }, 1)).toThrow(/entrée sans `exigeUneCreature`/);
    expect(() => pieceDeCreature(SANS_RECOLTE.id)).toThrow(/RECOLTABLE[\s\S]*ne porte pas « Récolte »/);
  });

  it('le marqueur CLASSE : toute entrée qui porte `exigeUneCreature` naît en pièce de sa créature', () => {
    const autre = { ...findTrappingById(PIECES_DE_CREATURE_TRAPPING_ID)!, id: 'autre-piece' };
    const resoudre: TrappingResolver = (id) => (id === autre.id ? autre : findTrappingById(id));
    const [it] = instancesDeDon({ trappingId: autre.id, creatureId: GRIFFON }, 1, { resoudre });
    expect(it.trappingId).toBe(autre.id);
    expect(it.creatureId).toBe(GRIFFON);
  });

  it('l’op `giveTrapping` rend les instances de la fabrique', () => {
    const hero = { id: 'h', label: 'H', items: [] } as unknown as Combatant;
    applyOps(hero, [{ op: 'giveTrapping', trappingId: 'dague', count: 2 }], {});
    expect(hero.items!.map(sansUid)).toEqual(instancesDeDon({ trappingId: 'dague' }, 2).map(sansUid));
  });
});

describe('valeur d’une pièce par degré (ZI 13 l.402-405), sur toute créature récoltable', () => {
  it.each(RECOLTABLES.map((c) => [c.id, c] as const))('%s : ×2, standard, moitié, 1/8 Exotique/Unique sinon 0', (_id, c) => {
    const p = c.harvest!;
    const v = (d: Parameters<typeof valeurDUnePiece>[1]) => toBrass(valeurDUnePiece(p, d));
    const standard = v('Conservé');
    expect(standard).toBeGreaterThan(0);
    expect(v('Frais')).toBe(2 * standard);
    expect(v('Faisandé')).toBe(standard / 2);
    // ZI 13 l.400 / l.405 : #2137.
    expect(v('Pourri')).toBe(p.rarity === 'Exotique' || p.rarity === 'Unique' ? standard / 8 : 0);
  });
});

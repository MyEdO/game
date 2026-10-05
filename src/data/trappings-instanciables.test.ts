/**
 * `INSTANCIABLE_PAR_ID` (#1988) : UNE sous-liste, jugée sur l'ENTRÉE au runtime (`dansLaSousListe`,
 * `trappingsInstanciables`, `itemFromTrappingById`) et sur l'id au schéma (`idDe`, `refusDuMarqueur`),
 * lue par tout producteur d'ids d'objet.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { trappings, trappingsInstanciables, armesChoisissables, trappingDesObjetsPuisDuCatalogue, type TrappingData } from './index';
import { setDataset } from './overrides';
import { itemFromTrappingById, itemLabel } from '../engine/items';
import { craftCatalog, orderCatalog } from '../engine/activities';
import { INSTANCIABLE_PAR_ID } from './schemas/grammaire/sousListes';
import { idsDeLaSousListe } from './schemas/grammaire/ref';
import { giveTrappingSchema } from './schemas/defs-scenes/effets';
import { gameOpSchema } from './schemas/grammaire/mecanique';

const LIVRES: TrappingData[] = [...trappings];
afterEach(() => setDataset('trappings', LIVRES));

const idsDeLaVue = (): string[] => trappingsInstanciables().map((t) => t.id);
const horsDeLaVue = (): string[] => trappings.filter((t) => !idsDeLaVue().includes(t.id)).map((t) => t.id);
const messages = (r: { success: boolean; error?: { issues: { message: string }[] } }): string => (r.error?.issues ?? []).map((i) => i.message).join('\n');
const effet = (trappingId: string) => giveTrappingSchema.safeParse({ type: 'giveTrapping', trappingId });
const op = (trappingId: string) => gameOpSchema.safeParse({ op: 'giveTrapping', trappingId });
const forme = (form: string) => gameOpSchema.safeParse({ op: 'grantWeapon', damage: 1, form });

describe('vue `trappingsInstanciables`', () => {
  it('tout id de la vue s’instancie sans lever', () => {
    for (const id of idsDeLaVue()) expect(itemFromTrappingById(id), id).not.toBeNull();
  });

  it('tout id du catalogue HORS de la vue lève à l’instanciation (témoin non vide)', () => {
    expect(horsDeLaVue().length).toBeGreaterThan(0);
    for (const id of horsDeLaVue()) expect(() => itemFromTrappingById(id), id).toThrow(/INSTANCIABLE_PAR_ID/);
  });

  it('la vue (jugée sur l’entrée) et les ids admis du registre (jugés sur l’id) ne font qu’un', () => {
    expect(idsDeLaVue()).toEqual([...idsDeLaSousListe('trapping', INSTANCIABLE_PAR_ID)]);
  });
});

describe('producteurs d’ids d’objet — aucun id hors de la vue', () => {
  const PRODUCTEURS: readonly (readonly [string, () => readonly { id: string }[]])[] = [
    ['craftCatalog', craftCatalog],
    ['orderCatalog', orderCatalog],
    ['armesChoisissables', armesChoisissables],
  ];
  it.each(PRODUCTEURS)('%s', (_nom, produire) => {
    const vue = new Set(idsDeLaVue());
    const produits = produire().map((o) => o.id);
    expect(produits.length).toBeGreaterThan(0);
    expect(produits.filter((id) => !vue.has(id))).toEqual([]);
    for (const id of produits) expect(() => itemFromTrappingById(id), id).not.toThrow();
  });
});

describe('régime vivant — le marqueur posé au seam déplace l’entrée partout', () => {
  const service = trappings.find((t) => t.service)!;
  const objet = trappings.find((t) => t.id === 'dague')!;

  it('poser `service` sur un objet le sort de la vue, du schéma (op, forme, Effet) et de l’instanciation', () => {
    expect(idsDeLaVue()).toContain(objet.id);
    expect(effet(objet.id).success && op(objet.id).success && forme(objet.id).success).toBe(true);
    setDataset('trappings', LIVRES.map((t) => (t.id === objet.id ? { ...t, service: true } : t)));
    expect(idsDeLaVue()).not.toContain(objet.id);
    for (const r of [effet(objet.id), op(objet.id), forme(objet.id)]) expect(messages(r)).toMatch(/porte « Objet-service »/);
    expect(() => itemFromTrappingById(objet.id)).toThrow(/INSTANCIABLE_PAR_ID/);
  });

  it('retirer `service` d’un tarif le fait entrer dans la vue et dans le schéma', () => {
    expect(effet(service.id).success).toBe(false);
    const { service: _retire, ...sansMarqueur } = service;
    setDataset('trappings', LIVRES.map((t) => (t.id === service.id ? sansMarqueur : t)));
    expect(idsDeLaVue()).toContain(service.id);
    expect(effet(service.id).success).toBe(true);
    expect(op(service.id).success).toBe(true);
  });
});

describe('objet de campagne — jugé sur l’entrée résolue', () => {
  const OBJET: TrappingData = { ...trappings.find((t) => t.id === 'dague')!, id: 'campagne-sceau-du-comte', label: 'Sceau du comte' };
  const resoudre = (objets: readonly TrappingData[]) => {
    const parId = new Map(objets.map((o) => [o.id, o]));
    return (id: string) => trappingDesObjetsPuisDuCatalogue(parId, id);
  };

  it('sans marqueur, il s’instancie par le résolveur de campagne', () => {
    const it = itemFromTrappingById(OBJET.id, resoudre([OBJET]))!;
    expect(it.trappingId).toBe(OBJET.id);
    expect(itemLabel(it, resoudre([OBJET]))).toBe('Sceau du comte');
  });

  it('marqué `service`, il lève', () => {
    expect(() => itemFromTrappingById(OBJET.id, resoudre([{ ...OBJET, service: true }]))).toThrow(/INSTANCIABLE_PAR_ID/);
  });

  it('l’Effet qui le cite passe le parse : la feuille est OUVERTE aux ids absents du catalogue', () => {
    expect(effet(OBJET.id).success).toBe(true);
  });
});

describe('Effet `giveTrapping` — la feuille ouverte juge un id PRÉSENT', () => {
  it('un tarif de service est refusé au parse, message de la sous-liste', () => {
    const service = trappings.find((t) => t.service)!;
    expect(messages(effet(service.id))).toBe(`« ${service.id} » porte « Objet-service » : cette référence écarte du catalogue des objets (trappings.json) les entrées qui le portent.`);
  });

  it('l’op `giveTrapping` et la forme de `grantWeapon` refusent un id absent (feuilles fermées)', () => {
    expect(op('campagne-sceau-du-comte').success).toBe(false);
    expect(forme('campagne-sceau-du-comte').success).toBe(false);
  });
});

/**
 * `INSTANCIABLE_PAR_ID` (#1988) : UNE sous-liste, jugée sur l'ENTRÉE au runtime (`dansLaSousListe`,
 * `trappingsInstanciables`, `itemFromTrappingById`) et sur l'id au schéma (`idDe`, `refusDuMarqueur`),
 * lue par tout producteur d'ids d'objet.
 */
import { idsDeTest } from '../engine/idsDeTest.testkit';
import { describe, it, expect, afterEach } from 'vitest';
import {
  trappings,
  trappingsInstanciables,
  armesChoisissables,
  trappingDesObjetsPuisDuCatalogue,
  careers,
  findQualityById,
  findTrappingById,
  findCreatureById,
  findSpeciesById,
  groupeDeLArme,
  type TrappingData,
} from './index';
import { setDataset } from './overrides';
import { itemFromTrappingById } from '../engine/items';
import { isMagicWeapon } from '../engine/qualities/dispatch';
import { dotationsDuHeros, dotationsDuPnj, emplacementsDeDotation, porteurDeLEspece, porteurDuProfil, valeursDeLEmplacement } from '../engine/trappingChoices';
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
const forme = (id: string) => gameOpSchema.safeParse({ op: 'grantWeapon', label: 'Arme', damage: 1, form: { id } });

describe('vue `trappingsInstanciables`', () => {
  it('tout id de la vue s’instancie sans lever', () => {
    for (const id of idsDeLaVue()) expect(itemFromTrappingById(id, idsDeTest), id).not.toBeNull();
  });

  it('tout id du catalogue HORS de la vue lève à l’instanciation (témoin non vide)', () => {
    expect(horsDeLaVue().length).toBeGreaterThan(0);
    for (const id of horsDeLaVue()) expect(() => itemFromTrappingById(id, idsDeTest), id).toThrow(/INSTANCIABLE_PAR_ID/);
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
    for (const id of produits) expect(() => itemFromTrappingById(id, idsDeTest), id).not.toThrow();
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
    for (const r of [effet(objet.id), op(objet.id), forme(objet.id)]) expect(messages(r)).toMatch(/porte le marqueur « service »/);
    expect(() => itemFromTrappingById(objet.id, idsDeTest)).toThrow(/INSTANCIABLE_PAR_ID/);
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
    expect(itemFromTrappingById(OBJET.id, idsDeTest, resoudre([OBJET]))?.label).toBe('Sceau du comte');
  });

  it('marqué `service`, il lève', () => {
    expect(() => itemFromTrappingById(OBJET.id, idsDeTest, resoudre([{ ...OBJET, service: true }]))).toThrow(/INSTANCIABLE_PAR_ID/);
  });

  it('l’Effet et l’op qui le citent passent le parse hors de tout document : la feuille sous portée admet l’id absent du catalogue sans le juger', () => {
    expect(effet(OBJET.id).success).toBe(true);
    expect(op(OBJET.id).success).toBe(true);
  });
});

describe('Effet `giveTrapping` — la feuille sous portée juge un id PRÉSENT', () => {
  it('un tarif de service est refusé au parse, message de la sous-liste', () => {
    const service = trappings.find((t) => t.service)!;
    expect(messages(effet(service.id))).toBe(`« ${service.id} » porte le marqueur « service » : cette référence l'exclut du catalogue des objets (trappings.json).`);
  });

  it('la forme de `grantWeapon` refuse un id absent (feuille sans portée)', () => {
    expect(forme('campagne-sceau-du-comte').success).toBe(false);
  });
});

describe('arme au choix — aucune arme magique (ZI 13 l.862 ; VDM 12 l.3)', () => {
  const qualitesMagiques = (id: string): string[] =>
    (findTrappingById(id)?.qualities ?? []).filter((r) => findQualityById(r.id)?.capabilities?.magic).map((r) => r.id);
  const jokers = careers
    .flatMap((c) => emplacementsDeDotation([...dotationsDuHeros(c.id), ...dotationsDuPnj(c.id, 4)]))
    .filter((e) => e.sorte === 'joker');

  it('`armesChoisissables` n’offre aucune arme à qualité `capabilities.magic`', () => {
    expect(armesChoisissables().filter((a) => qualitesMagiques(a.id).length > 0).map((a) => a.id)).toEqual([]);
  });

  it('aucun joker d’arme de carrière, de Groupe ou nu, n’offre d’arme magique (`valeursDeLEmplacement`)', () => {
    expect(jokers.some((e) => e.ref.groupe !== undefined) && jokers.some((e) => e.ref.groupe === undefined)).toBe(true);
    for (const e of jokers) expect(valeursDeLEmplacement(e, { size: 'moyenne' }).filter((v) => qualitesMagiques(String(v)).length > 0), e.adresse).toEqual([]);
  });

  it.each(['broyeur-d-os', 'silence', 'vision-de-vie', 'baton-enchante'])('%s, instanciée, est une arme magique', (id) => {
    expect(isMagicWeapon(itemFromTrappingById(id, idsDeTest)!)).toBe(true);
  });
});

describe('arme au choix — à la Taille du porteur (ADE II 2 l.604 ; ADE II 2 l.710 ; arbitrage #4110)', () => {
  const jokers = careers
    .flatMap((c) => emplacementsDeDotation([...dotationsDuHeros(c.id), ...dotationsDuPnj(c.id, 4)]))
    .filter((e) => e.sorte === 'joker');
  const armesDOgre = trappingsInstanciables().filter((t) => (t.categorie === 'melee' || t.categorie === 'distance') && t.sizeFor === 'grande');

  it('aucun joker d’arme de carrière n’offre à un porteur de Taille Moyenne une arme taillée pour la Grande', () => {
    for (const e of jokers) expect(valeursDeLEmplacement(e, { size: 'moyenne' }).filter((v) => findTrappingById(String(v))!.sizeFor === 'grande'), e.adresse).toEqual([]);
  });

  it('un ogre se voit offrir les armes d’ogre du Groupe du joker, et elles seules', () => {
    const ogre = porteurDeLEspece(findSpeciesById('ogres')!);
    expect(ogre.size).toBe('grande');
    expect(armesDOgre.length).toBeGreaterThan(0);
    for (const e of jokers) {
      const groupe = e.ref.groupe?.id;
      const attendues = armesDOgre.filter((t) => groupe === undefined || groupeDeLArme(t)?.id === groupe).map((t) => t.id);
      expect(new Set(valeursDeLEmplacement(e, ogre)), e.adresse).toEqual(new Set(attendues));
    }
    expect(jokers.some((e) => valeursDeLEmplacement(e, ogre).length > 0)).toBe(true);
  });
});

describe('arme au choix — réservée à un peuple (arbitrage #4110, 2026-11-16)', () => {
  const jokers = careers
    .flatMap((c) => emplacementsDeDotation([...dotationsDuHeros(c.id), ...dotationsDuPnj(c.id, 4)]))
    .filter((e) => e.sorte === 'joker');
  const reservees = (ids: readonly (number | string)[]) => ids.filter((v) => findTrappingById(String(v))!.reserveeA !== undefined);

  it.each(['jezail-a-malepierre', 'canon-ratling', 'lance-maleflamme', 'pistolet-a-malepierre'])('%s, arme nommée par l’arbitrage, est réservée aux skavens', (id) => {
    expect(findTrappingById(id)!.reserveeA).toEqual({ id: 'skaven' });
  });

  it('aucun joker d’arme de carrière n’offre une arme réservée à un humain', () => {
    const humain = porteurDeLEspece(findSpeciesById('humains-reiklander')!);
    expect(humain.groups).toContain('humain');
    for (const e of jokers) expect(reservees(valeursDeLEmplacement(e, humain)), e.adresse).toEqual([]);
  });

  it('un skaven se voit offrir les armes qui lui sont réservées, du Groupe du joker et à sa Taille', () => {
    const skaven = porteurDuProfil(findCreatureById('skaven')!);
    expect(skaven.groups).toContain('skaven');
    const siennes = armesChoisissables().filter((a) => a.reserveeA === 'skaven' && a.sizeFor === undefined);
    expect(siennes.length).toBeGreaterThan(0);
    for (const e of jokers) {
      const groupe = e.ref.groupe?.id;
      const attendues = siennes.filter((a) => groupe === undefined || a.groupe === groupe).map((a) => a.id);
      expect(new Set(reservees(valeursDeLEmplacement(e, skaven))), e.adresse).toEqual(new Set(attendues));
    }
  });
});

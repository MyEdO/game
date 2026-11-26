/**
 * Les raffinements croisés de la grammaire et des defs se jugent contre le catalogue passé (#5070, `catalogueLu`) : le
 * trait octroyé (`grantTrait`), la Cible d'un état psy posé (`beginPsych`), les jeux de races (`especes-aleatoires.json`).
 * Fixtures : un trait, un état psy, une espèce et une règle optionnelle présents SEULEMENT dans le catalogue de la suite
 * (`catalogueAvec`).
 */
import { describe, expect, it } from 'vitest';
import type { z } from 'zod';
import { catalogueAvec } from './catalogueAvec.testkit';
import { catalogueDuProcessus } from './catalogueDuProcessus';
import { parserSousCatalogue } from './schemas/catalogue/references';
import { gameOpSchema, mecaniqueDe } from './schemas/grammaire/mecanique';
import { validateDataset } from './schemas/validate';
import { refMorte } from './schemas/grammaire/ref';
import especesAleatoiresJson from './especes-aleatoires.json';
import { garanti } from '../lib/garanti';

const TRAIT = 'trait-lanceur-du-livre-de-test';
const PSY = 'psy-a-cible-du-livre-de-test';
const ESPECE = 'gnomes-du-livre-de-test';
const REGLE: string = 'regle-du-livre-de-test';

const base = catalogueDuProcessus();
const copie = <E extends { id: string }>(entrees: readonly E[], id: string, neuf: string): E => ({ ...garanti(entrees.find((e) => e.id === id), id, 'entrée copiée'), id: neuf });
type Espece = (typeof base)['species.json'][number];
const especes = base['species.json'];
/** L'espèce du livre de test, gardée par la règle du livre de test : un id hors de l'index des ids typés (`Id<T>`). */
const espece: Espece = { ...copie(especes, 'gnomes', ESPECE), gatedByRule: { id: REGLE } as Espece['gatedByRule'] };

const CAT = catalogueAvec({
  'traits.json': [copie(base['traits.json'], 'lanceur-de-sorts', TRAIT)],
  'psychology.json': [copie(base['psychology.json'], 'haine', PSY)],
  'species.json': [espece],
});
const CAT_AVEC_LA_REGLE = catalogueAvec({
  'species.json': [espece],
  'reglesOptionnelles.json': [copie(base['reglesOptionnelles.json'], 'creation-gnome-jouable', REGLE)],
});

const messages = (schema: z.ZodType, op: unknown) => parserSousCatalogue(schema, op, CAT).error?.issues.map((i) => i.message) ?? [];
/** La famille où le choix d'un Trait octroyé est admis (`grantTrait.choix`, celle des rangées de `defs/tables.ts`). */
const opAChoix = mecaniqueDe({ 'grantTrait.choix': 'admis' }).gameOp;

describe('le trait octroyé (`grantTrait`) se lit dans le catalogue passé', () => {
  it('le choix d’un trait de lanceur de sorts du seul catalogue est admis', () => {
    expect(messages(opAChoix, { op: 'grantTrait', trait: { id: TRAIT }, choix: true })).toEqual([]);
  });
});

describe('la Cible d’un état psy posé (`beginPsych`) se lit dans le catalogue passé', () => {
  it('un état du seul catalogue qui vise un Groupe en admet un', () => {
    expect(messages(gameOpSchema, { op: 'beginPsych', type: { id: PSY }, cible: { id: 'nain' } })).toEqual([]);
  });
});

describe('les jeux de races (`especes-aleatoires.json`) se lisent dans le catalogue passé', () => {
  it('une espèce du seul catalogue, gardée par une règle qu’il ne porte pas, est refusée', () => {
    expect(validateDataset('especes-aleatoires.json', especesAleatoiresJson, CAT)).toContain(refMorte('regleOptionnelle', REGLE));
  });

  it('la même espèce, gardée par une règle du seul catalogue, est admise', () => {
    expect(validateDataset('especes-aleatoires.json', especesAleatoiresJson, CAT_AVEC_LA_REGLE)).toBeNull();
  });
});

/** #1595 — couverture des Tables d'effets (VDM 12 l.435 « 11+ »), patron `structureCriticals.test.ts`. */
import { describe, expect, it } from 'vitest';
import { validateDataset } from '../validate';
import tablesJson from '../../tables.json';

type Table = { id: string; die: string; entries: { min: number | null; max: number | null }[] };
const clone = () => structuredClone(tablesJson) as unknown as Table[];

describe('tables.json — chaque table couvre son dé depuis 1', () => {
  it('le schéma accepte le document RÉEL', () => {
    expect(validateDataset('tables.json', tablesJson)).toBeNull();
  });

  it('REFUSE une rangée du milieu sans plafond dans une table ouverte en haut', () => {
    const doc = clone();
    const ouverte = doc.find((t) => t.entries.some((r) => r.max === null));
    expect(ouverte, 'aucune table ouverte — la fixture ne mesure rien').toBeDefined();
    ouverte!.entries[2].max = null;
    expect(validateDataset('tables.json', doc)).toMatch(new RegExp(`${ouverte!.id} : .*la rangée n° 3 n'a pas de borne haute`));
  });

  it('REFUSE une table fermée qui ne couvre pas son dé', () => {
    const doc = clone();
    const fermee = doc.find((t) => t.die === 'd10' && t.entries.every((r) => r.max !== null))!;
    fermee.entries[fermee.entries.length - 1].max = 9;
    expect(validateDataset('tables.json', doc)).toMatch(new RegExp(`${fermee.id} : .*s'arrête à 9 au lieu de 10`));
  });

  it('la couverture se mesure sur l’étendue du dé : un 2d10 se couvre de 2 à 20', () => {
    const doc = clone();
    const fermee = doc.find((t) => t.die === 'd10' && t.entries.every((r) => r.max !== null))!;
    fermee.die = '2d10';
    expect(validateDataset('tables.json', doc)).toMatch(new RegExp(`${fermee.id} : les rangées ne couvrent pas le 2d10 d'un seul tenant`));
  });

  it('REFUSE un dé de tirage qui ne se lit pas en `DiceSpec`', () => {
    const doc = clone();
    doc[0].die = 'un dé';
    expect(validateDataset('tables.json', doc)).toMatch(/dé de tirage illisible/);
  });
});

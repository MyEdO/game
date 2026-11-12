/**
 * LE STOCKAGE DU PONT HORS D'UNE PAGE (#3009, `stockage.mjs`) : en mémoire sans fichier ; avec un fichier, relu à
 * l'ouverture et réécrit à chaque changement.
 */
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { stockageDuProcessus } from './stockage.mjs';

let dossier: string | null = null;
afterEach(() => { if (dossier) rmSync(dossier, { recursive: true, force: true }); dossier = null; });
/** Un fichier de stockage sous un dossier neuf, que rien ne porte au disque. */
const fichierNeuf = (): string => join((dossier = mkdtempSync(join(tmpdir(), 'wfrp-stockage-'))), 'sous', 'stockage.json');

describe('stockageDuProcessus', () => {
  it('sans fichier, ses clés vivent en mémoire', () => {
    const s = stockageDuProcessus(null);
    expect(s.getItem('a')).toBeNull();
    s.setItem('a', '1');
    expect(s.getItem('a')).toBe('1');
    s.removeItem('a');
    expect(s.getItem('a')).toBeNull();
  });

  it('avec un fichier, un stockage rouvert retrouve ce qui a été écrit, et plus ce qui a été retiré', () => {
    const fichier = fichierNeuf();
    const s = stockageDuProcessus(fichier);
    s.setItem('a', '1');
    s.setItem('b', '{"x":2}');
    s.removeItem('a');
    const rouvert = stockageDuProcessus(fichier);
    expect([rouvert.getItem('a'), rouvert.getItem('b')]).toEqual([null, '{"x":2}']);
    expect(JSON.parse(readFileSync(fichier, 'utf8')), 'un objet JSON de chaînes').toEqual({ b: '{"x":2}' });
  });

  it('un fichier illisible ou d’une autre forme s’ouvre vide, et se réécrit à la première écriture', () => {
    const fichier = fichierNeuf();
    stockageDuProcessus(fichier).setItem('a', '1');
    for (const contenu of ['{ tronqué', '[1,2]', '{"a":3}']) {
      writeFileSync(fichier, contenu);
      const s = stockageDuProcessus(fichier);
      expect(s.getItem('a'), contenu).toBeNull();
      s.setItem('c', '4');
      expect(JSON.parse(readFileSync(fichier, 'utf8')), contenu).toEqual({ c: '4' });
    }
  });
});

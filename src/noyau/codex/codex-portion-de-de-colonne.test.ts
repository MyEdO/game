/** #3908 — la fiche Codex d'une portion du Tableau des Classes et Carrières aléatoires (MDG 09 l.9) montre ses
 *  bandes au dé de sa colonne, et suit la surcharge de ce dé. */
import { describe, expect, it } from 'vitest';
import { CODEX } from './registry';
import { carrieresAleatoires } from '../../data';
import { setDataset } from '../../data/overrides';

const fiche = (id: string) => CODEX.find((c) => c.key === 'carrieresAleatoires')!.items.find((i) => i.id === id)!;
const badges = (id: string) => (fiche(id).sections ?? []).flatMap((s) => s.rows ?? []).map((r) => (r.t === 'ref' ? r.badge : undefined));

describe('Codex — une portion se lit au dé de sa colonne (MDG 09 l.9)', () => {
  it('les bandes de « cotiers-humain » portent le dé de la colonne « humain », surcharge comprise', () => {
    const imprimes = [...carrieresAleatoires];
    setDataset('carrieresAleatoires', imprimes.map((d) => (d.id === 'humain' && d.kind === 'colonne' ? { ...d, die: '2d50' } : d)));
    try {
      const vues = badges('cotiers-humain');
      expect(vues.length, 'la portion a des rangées').toBeGreaterThan(0);
      for (const b of vues) expect(b).toMatch(/^2d50 /);
      expect(fiche('cotiers-humain').sub).toContain('2d50');
    } finally {
      setDataset('carrieresAleatoires', imprimes);
    }
  });
});

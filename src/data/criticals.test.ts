import { describe, it, expect } from 'vitest';
import { CRITIQUE_DOCS, critiqueDoc, critiqueTable, critiqueEntries, critTableKeyFor, type CritTableKey, type JeuDeCritique } from './criticals';
import type { HitLocation } from '../engine/types';

/**
 * `criticals.json` — la COLLECTION de documents-tables (#1657 B2a, #1682) : 8 documents, un par
 * (`jeu` × `localisation`), chacun avec SON espace de tirage d100. Ce fichier garde la FORME de la
 * collection ; les lignes et leur résolution sont gardées par `src/engine/critical.test.ts`.
 */

const LOCS: HitLocation[] = ['tete', 'brasG', 'brasD', 'corps', 'jambeG', 'jambeD'];
const JEUX: JeuDeCritique[] = ['ldb', 'aa'];
const FAMILLES: CritTableKey[] = ['tete', 'bras', 'corps', 'jambe'];

describe('collection de documents-tables — 8 documents, 2 jeux × 4 Localisations', () => {
  it('les 8 documents sont là, identifiés, sans doublon d’id de document', () => {
    expect(CRITIQUE_DOCS.length).toBe(8);
    expect(new Set(CRITIQUE_DOCS.map((d) => d.id)).size).toBe(8);
    for (const d of CRITIQUE_DOCS) {
      expect(d.type).toBe('criticals');
      expect(d.label.length).toBeGreaterThan(0);
      expect(JEUX).toContain(d.jeu);
      expect(FAMILLES).toContain(d.localisation);
    }
    expect(CRITIQUE_DOCS.map((d) => `${d.jeu}/${d.localisation}`).sort()).toEqual(
      JEUX.flatMap((j) => FAMILLES.map((f) => `${j}/${f}`)).sort(),
    );
  });

  it('160 rangées au total, 20 par table, aucun id de rangée en collision entre les 8 documents', () => {
    const rangees = CRITIQUE_DOCS.flatMap((d) => d.entries);
    expect(rangees.length).toBe(160);
    for (const d of CRITIQUE_DOCS) expect(d.entries.length, d.id).toBe(20);
    expect(new Set(rangees.map((e) => e.id)).size).toBe(160);
  });

  it('chaque rangée porte sa provenance à l’ENTRÉE (le document, lui, n’a pas de folio)', () => {
    for (const d of CRITIQUE_DOCS) {
      for (const e of d.entries) {
        expect(e.source?.book, `${d.id}/${e.id}`).toBeTruthy();
        expect(typeof e.source?.page, `${d.id}/${e.id}`).toBe('number');
      }
    }
  });
});

describe.each(JEUX)('espace de tirage d100 (%s) — chaque table couvre 1..100 sans trou ni chevauchement', (jeu) => {
  for (const loc of LOCS) {
    it(`${loc} : couverture exhaustive`, () => {
      const table = critiqueTable(jeu, loc);
      expect(table.length).toBeGreaterThan(0);
      const couvert = new Array(101).fill(0); // index 1..100
      for (const e of table) for (let r = e.min; r <= Math.min(e.max ?? 100, 100); r++) couvert[r]++;
      for (let r = 1; r <= 100; r++) expect(couvert[r], `roll ${r} sur ${jeu}/${loc}`).toBe(1);
    });
    it(`${loc} : exactement une entrée létale, au plafond (« 00 ») ou ouverte`, () => {
      const letales = critiqueTable(jeu, loc).filter((e) => e.lethal);
      expect(letales.length).toBe(1);
      expect(letales[0].max).toBe(jeu === 'aa' ? null : 100); // LDB 18 ; AA 07 l.105, l.131, l.157, l.183
    });
  }
});

describe('critTableKeyFor / critiqueDoc — projection Localisation → table (LDB 18 : un tableau par membre)', () => {
  it('les deux côtés d’un membre projettent sur la MÊME famille', () => {
    expect(critTableKeyFor('brasG')).toBe('bras');
    expect(critTableKeyFor('brasD')).toBe('bras');
    expect(critTableKeyFor('jambeG')).toBe('jambe');
    expect(critTableKeyFor('jambeD')).toBe('jambe');
    expect(critTableKeyFor('tete')).toBe('tete');
    expect(critTableKeyFor('corps')).toBe('corps');
  });

  it('une Localisation SANS table dédiée retombe sur les Bras (LDB 76 l.21), dans son propre jeu', () => {
    for (const jeu of JEUX) {
      for (const exotic of ['tentacule', 'queue', 'aile'] as unknown as HitLocation[]) {
        expect(critTableKeyFor(exotic)).toBe('bras');
        expect(critiqueTable(jeu, exotic)).toBe(critiqueDoc(jeu, 'bras').entries);
      }
    }
  });
});

describe('accès FAIL-FAST — une donnée amputée est nommée, jamais absorbée', () => {
  it('`critiqueEntries` refuse un id de document inconnu, en listant les ids réels', () => {
    expect(() => critiqueEntries('criticals-inexistant')).toThrow(/criticals-inexistant/);
    expect(() => critiqueEntries('criticals-inexistant')).toThrow(/criticals-ldb-tete/);
  });
  it('`critiqueDoc` refuse un jeu sans document, en le nommant', () => {
    expect(() => critiqueDoc('jeu-absent' as JeuDeCritique, 'tete')).toThrow(/jeu-absent/);
  });
  it('les rangées servies sont la référence LIVE du document (l’édition Codex reste visible en jeu)', () => {
    expect(critiqueEntries('criticals-ldb-tete')).toBe(CRITIQUE_DOCS[0].entries);
    expect(critiqueTable('ldb', 'brasG')).toBe(critiqueTable('ldb', 'brasD'));
  });
});

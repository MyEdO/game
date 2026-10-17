import { describe, it, expect } from 'vitest';
import { CRITIQUE_DOCS, critiqueDoc, critiqueTable, critiqueEntries, critTableKeyFor, type CritTableKey, type JeuDeCritique } from './criticals';
import { facesDuDe, tableOuverte } from '../engine/tables';
import type { HitLocation } from '../engine/types';

/**
 * `criticals.json` — la COLLECTION de documents-tables (#1657 B2a, #1682) : un document par
 * (`jeu` × `localisation`), chacun avec SON espace de tirage d100. Ce fichier garde la FORME de la
 * collection ; les lignes et leur résolution sont gardées par `src/engine/critical.test.ts`.
 */

const JEUX: JeuDeCritique[] = ['ldb', 'aa'];
const FAMILLES: CritTableKey[] = ['tete', 'bras', 'corps', 'jambe'];

describe('collection de documents-tables — un document par jeu × famille de Localisation', () => {
  it('chaque couple (jeu, famille) a exactement un document, identifié, sans doublon d’id de document', () => {
    const ids = CRITIQUE_DOCS.map((d) => d.id);
    expect(new Set(ids).size, ids.join(', ')).toBe(ids.length);
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

  it('aucun id de rangée en collision entre les documents', () => {
    const ids = CRITIQUE_DOCS.flatMap((d) => d.entries.map((e) => e.id));
    const doublons = ids.filter((id, i) => ids.indexOf(id) !== i);
    expect(doublons).toEqual([]);
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

describe.each(CRITIQUE_DOCS.map((d) => [d.id, d] as const))('espace de tirage d100 (%s)', (_id, doc) => {
  it('couvre 1..100 sans trou ni chevauchement, bandes ouvertes comprises (AA 07 l.105, l.131, l.157, l.183)', () => {
    const bandes = tableOuverte(doc.entries);
    for (let r = 1; r <= facesDuDe('d100'); r++) {
      const couvrantes = bandes.filter((e) => r >= e.min && r <= e.max).map((e) => e.id);
      expect(couvrantes, `roll ${r} sur ${doc.id}`).toHaveLength(1);
    }
  });
  it('exactement une entrée létale, au plafond (« 00 ») ou ouverte', () => {
    const letales = doc.entries.filter((e) => e.lethal);
    expect(letales.map((e) => e.id)).toHaveLength(1);
    expect(letales[0].max).toBe(doc.jeu === 'aa' ? null : facesDuDe('d100')); // LDB 18 ; AA 07 l.105, l.131, l.157, l.183
  });
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
    expect(critiqueEntries('criticals-ldb-tete')).toBe(critiqueDoc('ldb', 'tete').entries);
    expect(critiqueTable('ldb', 'brasG')).toBe(critiqueTable('ldb', 'brasD'));
  });
});

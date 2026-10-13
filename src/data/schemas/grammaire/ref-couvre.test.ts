/**
 * `refCouvre` : la convention d'adressage d'une référence de Compétence ou de Talent (LDB 09 l.44),
 * et SA SOURCE UNIQUE. La garde cherche la FORME `spec == null || spec === …`, pas un nom.
 */
import { describe, it, expect } from 'vitest';
import { COUVERTURE_DE_SPEC, constructionsReserveesDuCorpus, scanConstructionsReservees } from '../../../../scripts/guards/lib/canonUnique.mjs';
import { corpusDesGardes } from '../../../../scripts/guards/lib/commentPoison.mjs';
import { refCouvre } from './ref';

const COUVERTURE = { ...COUVERTURE_DE_SPEC, foyer: 'src/data/schemas/grammaire/ref.ts' };
const fixture = (text: string) => ({ rel: 'fixture.ts', text });

describe('refCouvre — une référence couvre une entrée du même id (LDB 09 l.44)', () => {
  it('sans `spec` : toutes les Spécialisations de l’id ; avec `spec` : la sienne seule', () => {
    expect(refCouvre({ id: 'metier' }, { id: 'metier', spec: 'forgeron' })).toBe(true);
    expect(refCouvre({ id: 'metier' }, { id: 'metier' })).toBe(true);
    expect(refCouvre({ id: 'metier', spec: 'forgeron' }, { id: 'metier', spec: 'forgeron' })).toBe(true);
    expect(refCouvre({ id: 'metier', spec: 'forgeron' }, { id: 'metier', spec: 'apothicaire' })).toBe(false);
    expect(refCouvre({ id: 'metier', spec: 'forgeron' }, { id: 'metier' })).toBe(false);
    expect(refCouvre({ id: 'metier' }, { id: 'voile', spec: 'forgeron' })).toBe(false);
    expect(refCouvre({ id: 'metier' }, { id: undefined })).toBe(false);
  });

  it('la COUVERTURE ne s’écrit nulle part ailleurs dans `src/` — prod ET tests', () => {
    expect(constructionsReserveesDuCorpus(corpusDesGardes(), [COUVERTURE])).toEqual([]);
  });

  it('le scan lit la FORME, pas le nom : opérandes commutés, `undefined` et `!` compris', () => {
    const vu = (text: string) => scanConstructionsReservees(fixture(text), [COUVERTURE]).length;
    expect(vu('const ok = r.id === id && (r.spec == null || r.spec === spec);'), 'forme canonique').toBe(1);
    expect(vu('const ok = s.id === id && (spec == null || s.spec === spec);'), 'requête sans spec, fiche spécialisée').toBe(1);
    expect(vu('const ok = (spec === undefined || spec === s.spec);'), '`=== undefined`, égalité commutée').toBe(1);
    expect(vu('const ok = (null == tok.spec || tok.spec === q.spec);'), '`null` à gauche').toBe(1);
    expect(vu('const ok = (!cond.spec || t.spec === cond.spec);'), 'négation').toBe(1);
    expect(vu('const ok = (r.spec == null || q.spec === s.spec);'), 'égalité sans l’opérande testé').toBe(0);
    expect(vu('const ok = (r.mode == null || r.mode === mode);'), 'autre champ que `spec`').toBe(0);
    expect(vu('const ok = (a.spec ?? \'\') === (b.spec ?? \'\');'), 'identité d’instance, autre prédicat').toBe(0);
  });
});

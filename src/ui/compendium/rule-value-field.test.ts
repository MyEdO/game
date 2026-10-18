import { describe, it, expect } from 'vitest';
import { inferFields } from './editFields';
import { dedicatedFieldKeys, validateEntry, editableEntries } from '../editor/codex/CodexEdit';
import { datasetArray } from '../../data/overrides';

/**
 * B2 (V9 #1318) — la VALEUR d'une règle optionnelle ne se saisit pas au clavier libre.
 *
 * Le PIÈGE, mesuré ici et non supposé : `inferFields` type un champ sur le PREMIER échantillon
 * non-null du dataset (`editFields.ts`). `reglesOptionnelles.json` ouvre sur une règle `mode`
 * (`default: 'normal'`), donc `default` s'infère en `text` pour les 81 entrées — dont les `flag`
 * (booléen) et les `param` (nombre). `ruleValueSchema` étant l'union booléen|nombre|chaîne, `"false"`
 * y passerait le schéma ET l'écriture disque, et `rule(id) === true` ne reconnaîtrait plus rien : la
 * règle s'éteindrait sans un mot. Deux verrous, testés ici :
 *  (a) `default` et `action` SORTENT du formulaire générique (éditeur typé par `kind`) ;
 *  (b) `validateEntry` REFUSE bruyamment une valeur incompatible avec le `kind` — porte que doit
 *      franchir aussi un JSON édité à la main.
 */
describe('B2 — le piège du champ texte inféré pour `default` est RÉEL', () => {
  it('sonde : sans éditeur dédié, `default` s’infère en `text` (échantillon `mode`)', () => {
    const champs = inferFields(editableEntries('reglesOptionnelles') as Record<string, unknown>[]);
    const def = champs.find((f) => f.key === 'default');
    expect(def, '`default` a disparu du dataset').toBeDefined();
    expect(def!.kind, 'le piège a changé de forme — revoir le remède').toBe('text');
  });

  it('la population piégée est celle qu’on croit : des `flag` booléens et des `param` nombres', () => {
    const regles = datasetArray('reglesOptionnelles');
    const flags = regles.filter((r) => r.kind === 'flag');
    const params = regles.filter((r) => r.kind === 'param');
    expect(flags.length).toBeGreaterThan(0);
    expect(params.length).toBeGreaterThan(0);
    expect(flags.every((r) => typeof r.default === 'boolean')).toBe(true);
    expect(params.every((r) => typeof r.default === 'number')).toBe(true);
  });

  it('REMÈDE (a) : `default` et `action` sont couverts par un éditeur dédié, hors du formulaire générique', () => {
    const dedies = dedicatedFieldKeys('reglesOptionnelles');
    expect(dedies.has('default')).toBe(true);
    expect(dedies.has('action')).toBe(true);
    const generiques = inferFields(editableEntries('reglesOptionnelles') as Record<string, unknown>[])
      .filter((f) => !dedies.has(f.key))
      .map((f) => f.key);
    expect(generiques).not.toContain('default');
    expect(generiques).not.toContain('action');
  });
});

describe('B2 — REMÈDE (b) : validateEntry refuse une valeur incompatible avec le `kind`', () => {
  const entries = [{ id: 'autre', label: 'Autre', kind: 'flag', default: false }];
  const errs = (entry: Record<string, unknown>) => validateEntry('reglesOptionnelles', entry, [...entries, entry], 1);

  it('MORSURE — `"false"` (chaîne) sur un interrupteur → rouge', () => {
    const e = errs({ id: 'r', label: 'R', ref: 'LDB 12 l.28', group: 'Tests', kind: 'flag', default: 'false' });
    expect(e.some((x) => x.startsWith('default : un interrupteur'))).toBe(true);
  });

  it('MORSURE — `"10"` (chaîne) sur un nombre borné → rouge', () => {
    const e = errs({ id: 'r', label: 'R', ref: 'LDB 14 l.198', group: 'Combat', kind: 'param', default: '10', min: 1, max: 20 });
    expect(e.some((x) => x.startsWith('default : un nombre'))).toBe(true);
  });

  it('MORSURE — un défaut HORS des `options` d’un choix → rouge', () => {
    const e = errs({ id: 'r', label: 'R', ref: 'LDB 12 l.28', group: 'Tests', kind: 'mode', default: 'inconnu', options: ['normal', 'off'] });
    expect(e.some((x) => x.includes("n'est pas une des valeurs proposées"))).toBe(true);
  });

  it('MORSURE — un défaut numérique HORS de ses bornes → rouge', () => {
    const e = errs({ id: 'r', label: 'R', ref: 'LDB 14 l.198', group: 'Combat', kind: 'param', default: 99, min: 1, max: 20 });
    expect(e.some((x) => x.includes('sort des bornes'))).toBe(true);
  });

  it('MORSURE — `action.when` mal typé (même piège que `default`) → rouge', () => {
    const e = errs({
      id: 'r', label: 'R', ref: 'LDB 17 l.47', group: 'Destin', kind: 'flag', default: true,
      action: { when: 'true', label: 'Faire', icon: 'resource/fortune', run: 'restoreFortuneNow' },
    });
    expect(e.some((x) => x.startsWith('action.when : un interrupteur'))).toBe(true);
  });

  it('les 81 règles RÉELLES passent cette porte (aucune fausse accusation)', () => {
    const regles = datasetArray('reglesOptionnelles') as unknown as Record<string, unknown>[];
    const fautives = regles
      .map((r, i) => ({ id: r.id, errs: validateEntry('reglesOptionnelles', r, regles, i) }))
      .filter((x) => x.errs.length > 0);
    expect(fautives, `règle(s) réelle(s) refusée(s) :\n${fautives.map((f) => `${f.id} : ${f.errs.join(' / ')}`).join('\n')}`).toEqual([]);
  });
});

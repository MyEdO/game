import { describe, it, expect } from 'vitest';
import { validateEntry } from './atelierDuCodex';
import { traits, entryKey, type MutationData } from '.';
import { datasetArray, DATASET_KEYS } from './overrides';

type Entry = Record<string, unknown>;

describe('validateEntry — porte d’`enregistrerEntree` (Enregistrer bloqué tant que non vide)', () => {
  const traitEntries = traits as unknown as Entry[];

  it('entrée réelle saine → aucune erreur', () => {
    expect(validateEntry('traits', traitEntries[0], traitEntries, 0)).toEqual([]);
  });

  it('id vide → bloquant', () => {
    const errs = validateEntry('traits', { ...traitEntries[0], id: '' }, traitEntries, 0);
    expect(errs.some((e) => /id vide/.test(e))).toBe(true);
  });

  it('id dupliqué → bloquant (édition ET création)', () => {
    // Édition : reprendre l'id d'une AUTRE entrée.
    const errs = validateEntry('traits', { ...traitEntries[0], id: traitEntries[1].id }, traitEntries, 0);
    expect(errs.some((e) => /déjà pris/.test(e))).toBe(true);
    // Création (selfIndex −1) : reprendre un id existant.
    const errsNew = validateEntry('traits', { id: traitEntries[0].id, label: 'X' }, traitEntries, -1);
    expect(errsNew.some((e) => /déjà pris/.test(e))).toBe(true);
    // Garder SON id en éditant sa propre entrée n'est pas un doublon.
    expect(validateEntry('traits', traitEntries[0], traitEntries, 0).some((e) => /déjà pris/.test(e))).toBe(false);
  });

  it('libellé vide → bloquant', () => {
    const errs = validateEntry('traits', { ...traitEntries[0], label: '' }, traitEntries, 0);
    expect(errs.some((e) => /libellé vide/.test(e))).toBe(true);
  });
});

/**
 * #173 — garde de CLASSE : un éditeur de ref (datalist ou sélecteur) ne doit JAMAIS écrire un LIBELLÉ
 * dans un champ que le lecteur résout par ID. Ces cas couvrent une réf NICHÉE sous un sous-objet/sous-tableau
 * (`NESTED_REF_FIELDS`, ex. `mutationTables.entries[].mutation`, `domains.castBonus.perCondition`) ; un
 * champ typé par la grammaire se refuse au parse (`atelierDuCodex.test.ts`). Le dernier test balaie TOUTE
 * la donnée committée : round-trip = déjà résolvable.
 */
describe('validateEntry — #173 : réf par ID écrasée par un LIBELLÉ (datalist/sélecteur) → bloquant', () => {
  it('mutationTables.entries[].mutation (réf NICHÉE) : id résolvable → OK ; libellé → bloquant', () => {
    const tables = datasetArray('mutationTables') as unknown as Entry[];
    const goodId: MutationData['id'] = 'pattes-d-animaux';
    const base = tables[0];
    expect(validateEntry('mutationTables', { ...base, entries: [{ min: 1, max: 100, mutation: goodId }] }, tables, 0)).toEqual([]);
    const errs = validateEntry('mutationTables', { ...base, entries: [{ min: 1, max: 100, mutation: 'Pattes d’animaux' }] }, tables, 0);
    expect(errs.some((e) => /entries\[\]\.mutation.*introuvable/.test(e))).toBe(true);
  });

  it('domains.castBonus.perCondition (réf NICHÉE) : id d’État résolvable → OK ; libellé → bloquant', () => {
    const domains = datasetArray('domains') as unknown as Entry[];
    const base = domains[0];
    expect(validateEntry('domains', { ...base, castBonus: { perCondition: 'en-flammes', radiusStat: 'force-mentale', bonus: 10 } }, domains, 0)).toEqual([]);
    const errs = validateEntry('domains', { ...base, castBonus: { perCondition: 'En flammes', radiusStat: 'force-mentale', bonus: 10 } }, domains, 0);
    expect(errs.some((e) => /castBonus\.perCondition.*introuvable/.test(e))).toBe(true);
  });

  it('sweep GÉNÉRAL — TOUTE la donnée committée (tous les datasets éditables) résout déjà : round-trip = préserve la résolvabilité', () => {
    // Round-trip de TOUTE la donnée éditable : chaque réf résout déjà (aucun orphelin toléré) —
    // les dotations véhicules (barque/charrette/diligence) sont des références typées `{id, type: 'vehicle'}` (#610, #3012).
    for (const key of DATASET_KEYS) {
      const arr = datasetArray(key) as unknown as Entry[];
      arr.forEach((entry, i) => {
        const errs = validateEntry(key, entry, arr, i);
        expect(errs, `${key}[${i}] (${entryKey(entry)}) : ${errs.join('; ')}`).toEqual([]);
      });
    }
  });
});

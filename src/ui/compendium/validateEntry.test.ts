import { describe, it, expect } from 'vitest';
import { validateEntry } from './CodexEdit';
import { traits, creatures } from '../../data';
import { datasetArray, DATASET_KEYS } from '../../data/overrides';
import { entryKey } from './registry';

type Entry = Record<string, unknown>;

describe('validateEntry — garde du persist de CodexEdit (Enregistrer bloqué tant que non vide)', () => {
  const traitEntries = traits as unknown as Entry[];
  const creatureEntries = creatures as unknown as Entry[];

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

  it('réf {id} résolvable → OK ; introuvable → bloquant (choice descendu, {text} ignoré)', () => {
    const good: Entry = {
      id: '___test-validate___', label: 'Test',
      traits: [{ id: traitEntries[0].id }],
      trappings: [{ text: 'collection d’alcools' }], // narratif : jamais validé par-id
    };
    expect(validateEntry('creatures', good, creatureEntries, -1)).toEqual([]);
    const bad: Entry = { ...good, traits: [{ id: '___inexistant___' }] };
    const errs = validateEntry('creatures', bad, creatureEntries, -1);
    expect(errs.some((e) => /___inexistant___.*introuvable/.test(e))).toBe(true);
    // AdvancementRef en branche choice : l'id invalide est vu au fond de la branche.
    const badChoice: Entry = { ...good, skills: [{ choice: [{ ref: { id: '___inconnu___' } }] }] };
    expect(validateEntry('creatures', badChoice, creatureEntries, -1).some((e) => /___inconnu___/.test(e))).toBe(true);
  });
});

/**
 * #173 — garde de CLASSE : un éditeur de ref (datalist ou sélecteur) ne doit JAMAIS écrire un LIBELLÉ
 * dans un champ que le lecteur résout par ID. `validateEntry` est le gate PRE-PERSIST unique ; ces cas
 * couvrent (a) un champ-liste de CHAÎNES top-level (`REF_LIST_DATASET`, ex. `criticalsTete.traumas`),
 * (b) une réf NICHÉE sous un sous-objet/sous-tableau (`NESTED_REF_FIELDS`, ex. `mutationTables.
 * ranges[].mutation`, `domains.castBonus.perCondition`) — les deux mécanismes déclarés dans
 * `CodexEdit.tsx`. Le dernier test balaie TOUTE la donnée committée : round-trip = déjà résolvable.
 */
describe('validateEntry — #173 : réf par ID écrasée par un LIBELLÉ (datalist/sélecteur) → bloquant', () => {
  it('criticalsTete.traumas (string[] top-level, REF_LIST_DATASET) : id résolvable → OK ; libellé → bloquant', () => {
    const criticalsTete = datasetArray('criticalsTete') as unknown as Entry[];
    const goodId = (datasetArray('traumas') as { id: string }[])[0].id;
    const base = criticalsTete[0];
    expect(validateEntry('criticalsTete', { ...base, traumas: [goodId] }, criticalsTete, 0)).toEqual([]);
    // Reproduit EXACTEMENT le bug #173 : l'ancien datalist écrivait le LIBELLÉ choisi, pas l'id.
    const errs = validateEntry('criticalsTete', { ...base, traumas: ['Fracture'] }, criticalsTete, 0);
    expect(errs.some((e) => /traumas.*Fracture.*introuvable/.test(e))).toBe(true);
  });

  it('mutationTables.ranges[].mutation (réf NICHÉE) : id résolvable → OK ; libellé → bloquant', () => {
    const tables = datasetArray('mutationTables') as unknown as Entry[];
    const goodId = (datasetArray('mutations') as { id: string }[]).find((m) => m.id === 'pattes-d-animaux')!.id;
    const base = tables[0];
    expect(validateEntry('mutationTables', { ...base, ranges: [{ min: 1, max: 100, mutation: goodId }] }, tables, 0)).toEqual([]);
    const errs = validateEntry('mutationTables', { ...base, ranges: [{ min: 1, max: 100, mutation: 'Pattes d’animaux' }] }, tables, 0);
    expect(errs.some((e) => /ranges\[\]\.mutation.*introuvable/.test(e))).toBe(true);
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
    // les dotations véhicules (barque/charrette/diligence) sont migrées en `{vehicleId}` (#610).
    for (const key of DATASET_KEYS) {
      const arr = datasetArray(key) as unknown as Entry[];
      arr.forEach((entry, i) => {
        const errs = validateEntry(key, entry, arr, i);
        expect(errs, `${key}[${i}] (${entryKey(entry)}) : ${errs.join('; ')}`).toEqual([]);
      });
    }
  });
});

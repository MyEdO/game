import { describe, it, expect } from 'vitest';
import { readCorpus } from '../../../scripts/guards/lib/sourceCorpus.mjs';

/**
 * Garde bloquante #286 : `<datalist>` hand-rollé interdit dans l'UI — `RefField`
 * (`src/ui/compendium/RefField.tsx`) est le SEUL propriétaire du motif `<input list>`/`<datalist>`
 * (picker de référence unifié). Un `<datalist>` réinventé ailleurs double le picker.
 *
 * PÉRIMÈTRE ÉTENDU #410 (2026-07-13) : la garde balaie désormais TOUT `src/ui` (walk récursif) au
 * lieu du seul `src/ui/editor` — l'audit de couverture a trouvé le motif réinventé dans
 * `src/ui/compendium` (StructFields, CodexEdit), hors du dossier jadis surveillé.
 *
 * `RefField.tsx` HORS SCAN : c'est le foyer de la primitive, son implémentation EST le motif.
 *
 * BASELINE gelée (surface d'ATELIER DEV) : `StructFields` est l'éditeur de fiches du
 * Compendium (surface développeur, hors jeu joué) ; son `<datalist>` pioche par LIBELLÉ car
 * plusieurs fiches partagent un même libellé (cf. `CodexEdit.tsx`), là où `RefField` pioche par id.
 * Ce stock reste GELÉ et VISIBLE au cliquet : toute HAUSSE échoue, toute BAISSE abaisse la baseline.
 */

const UI = 'src/ui';

const EXCLUDED = (rel: string) => rel === 'src/ui/compendium/RefField.tsx';

/** Stock GELÉ de datalist en surface d'atelier DEV (#410, 2026-07-13). */
const BASELINE: Record<string, number> = {
  'src/ui/compendium/StructFields.tsx': 2,
};

/** Retire commentaires ligne/bloc (les JSDoc de RefField/CodexEdit CITENT `<datalist>` en prose). */
function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .map((l) => {
      const i = l.indexOf('//');
      return i >= 0 ? l.slice(0, i) : l;
    })
    .join('\n');
}

function countsByFile(): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const { rel, text } of readCorpus([UI])) {
    if (EXCLUDED(rel)) continue;
    const n = (stripComments(text).match(/<datalist\b/g) ?? []).length;
    if (n > 0) counts[rel] = n;
  }
  return counts;
}

describe('#286/#410 — <datalist> interdit dans src/ui (RefField = seul picker de réf)', () => {
  it('aucun fichier de src/ui ne dépasse sa baseline gelée de <datalist>', () => {
    const counts = countsByFile();
    const over: string[] = [];
    for (const [rel, n] of Object.entries(counts)) {
      const b = BASELINE[rel] ?? 0;
      if (n > b) over.push(`${rel} : ${n} <datalist> (baseline gelée ${b})`);
    }
    expect(
      over,
      '<datalist> hand-rollé — composer <RefField> (src/ui/compendium/RefField.tsx) :\n' + over.join('\n'),
    ).toEqual([]);
  });

  it('CLIQUET : toute baseline devenue trop haute (site purgé) doit être ABAISSÉE', () => {
    const counts = countsByFile();
    const stale: string[] = [];
    for (const [rel, b] of Object.entries(BASELINE)) {
      const n = counts[rel] ?? 0;
      if (n < b) stale.push(`${rel} : baseline ${b}, réel ${n} — ABAISSER`);
    }
    expect(stale, 'Baseline(s) PÉRIMÉE(s) — abaisser ces entrées de BASELINE').toEqual([]);
  });
});

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { auditDataset, EXEMPT_DATASETS, exemptionDeDataset, isCitedItem } from '../../scripts/guards/lib/citationCoverage.mjs';
import { listerDossier } from '../../scripts/guards/lib/lister.mjs';
import { SANS_LIVRE_DEFINITIF } from './schemas/grammaire/sans-livre';

/**
 * Garde-fou « citation par ENTRÉE » (#309, phase 1 — suite #278/#281). #278/#281 gardent la FORME
 * de `sourceRefSchema` ; ce garde mesure la COUVERTURE réelle par entrée (comptage entrée-aware,
 * `citationCoverage.mjs` — jamais les ids imbriqués) et l'empêche de RÉGRESSER.
 *
 * ABSOLUE : aucun dataset non exempté ne porte d'entrée SANS citation (tolérance zéro depuis la
 * phase 3, #309, 2026-07-11, qui a curé les 16 derniers manques).
 *
 * `exemptionDeDataset` lit SANS_LIVRE_DEFINITIF puis les exemptions résiduelles EXEMPT_DATASETS.
 * L’auto-purge porte sur ces exemptions résiduelles : une couverture intégrale les rend périmées.
 */

const DATA_DIR = __dirname;
/** Les datasets `.json` de `src/data`, en ordre total — UN listage pour les deux sites qui le lisent. */
const DATASETS = listerDossier(DATA_DIR).filter((f) => f.endsWith('.json'));

/** `reglesOptionnelles.json` (E8 du programme #1318) : le cliquet ouvert à 55 le 2026-08-16 est SOLDÉ
 *  au 2026-08-20 — les 54 entrées restantes portent leur `source: {book,page}`, folio IMPRIMÉ relevé
 *  au marqueur `data-folio` gouvernant la ligne de leur `ref` (les 27 autres portent `maison`). */
function missingByFile(): Record<string, number> {
  const missing: Record<string, number> = {};
  for (const f of DATASETS) {
    if (exemptionDeDataset(f)) continue;
    const data = JSON.parse(readFileSync(join(DATA_DIR, f), 'utf8'));
    const { total, cited } = auditDataset(data);
    const n = total - cited;
    if (n > 0) missing[f] = n;
  }
  return missing;
}

describe('exemptions de citation — source unique', () => {
  it('une exemption résiduelle ne recopie aucun dataset définitivement sans livre', () => {
    const doublons = Object.keys(EXEMPT_DATASETS).filter((f) => Object.keys(SANS_LIVRE_DEFINITIF).includes(f.replace(/\.json$/, '')));
    expect(doublons).toEqual([]);
  });

  it('une clé héritée sans déclaration ne dispense pas un dataset de citation', () => {
    expect(exemptionDeDataset('constructor.json')).toBeUndefined();
  });
});

describe('EXEMPT_DATASETS s’auto-purge — une exemption intégralement citée est morte (#1467 L1b)', () => {
  it('aucune entrée d’EXEMPT_DATASETS n’a `cited === total` (elle ne sert plus qu’à mentir)', () => {
    const mortes: string[] = [];
    for (const f of Object.keys(EXEMPT_DATASETS)) {
      let data: unknown;
      try {
        data = JSON.parse(readFileSync(join(DATA_DIR, f), 'utf8'));
      } catch {
        continue;
      }
      const { total, cited } = auditDataset(data);
      if (total > 0 && cited === total) mortes.push(`${f} : ${cited}/${total} entrée(s) citée(s)`);
    }
    expect(
      mortes,
      `exemption(s) MORTE(S) — le dataset est curé, retirer l’entrée d’EXEMPT_DATASETS :\n  ${mortes.join('\n  ')}`,
    ).toEqual([]);
  });

});

describe('garde-fou « citation par entrée » — couverture source:{book,page} (#309)', () => {
  it('aucun dataset non exempté ne porte d\'entrée sans citation', () => {
    const offenders = Object.entries(missingByFile()).map(([file, n]) => `${file} : ${n} entrées sans citation`);
    expect(
      offenders,
      `Nouvelle entrée sans citation — poser source:{book,page} (ou EXEMPT_DATASETS si vocabulaire app-interne) :\n${offenders.join('\n')}`,
    ).toEqual([]);
  });

  it('fail-closed : une entrée fictive sans source dans un dataset à 100% (skills.json) fait rouge, puis retirée redevient vert', () => {
    const real = JSON.parse(readFileSync(join(DATA_DIR, 'skills.json'), 'utf8'));
    const before = auditDataset(real);
    expect(before.total - before.cited).toBe(0);

    const contaminated = [...real, { id: 'test-fictif', label: 'Entrée fictive', characteristic: 'agilite', type: 'base', specs: [] }];
    const red = auditDataset(contaminated);
    expect(red.total - red.cited).toBe(1); // ROUGE

    const retired = contaminated.filter((e: { id: string }) => e.id !== 'test-fictif');
    const green = auditDataset(retired);
    expect(green.total - green.cited).toBe(0); // VERT : retirée
  });

  it('MORSURE (#563 Lot 1 item 1) : une entrée avec `alsoIn` compte CITÉE ; l\'ancien guard la ratait', () => {
    const withAlsoIn = { id: 'fixture', label: 'Fixture', alsoIn: [{ book: 'zoo-imperial', page: 23 }] };
    expect(isCitedItem(withAlsoIn)).toBe(true);

    // Ancien guard (trou permissif décrit #563 : ne voit QUE `source`, ignore `alsoIn`) — rétabli
    // ICI en local pour la preuve de morsure, jamais réintroduit dans citationCoverage.mjs.
    const ancienGuard = (item: unknown): boolean => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) return false;
      const rec = item as Record<string, unknown>;
      if (rec.source && typeof rec.source === 'object' && !Array.isArray(rec.source) && typeof (rec.source as Record<string, unknown>).book === 'string') return true;
      if (typeof rec._source === 'string' && rec._source.length > 0) return true;
      if (typeof rec.maison === 'string' && rec.maison.length > 0) return true;
      return false;
    };
    expect(ancienGuard(withAlsoIn)).toBe(false); // ROUGE avec l'ancien guard : bascule non-citée
  });

  it('FORME `array-of-documents` : les RANGÉES d’un dataset-liste de documents porteurs sont comptées, et un manquant est NOMMÉ `<doc>.<rangée>`', () => {
    // `miscast.json` (famille `entite`, charge `options.rangee`) : 5 documents + 111 rangées = 116.
    // Sans le bras `array-of-documents` d'`auditDataset`, le scan s'arrêtait au premier niveau (5/5)
    // et les 111 rangées — qui portent CHACUNE leur `source` — sortaient de la garde en silence.
    const reel = JSON.parse(readFileSync(join(DATA_DIR, 'miscast.json'), 'utf8')) as {
      id: string;
      entries: { id: string; source?: unknown }[];
    }[];
    const audit = auditDataset(reel);
    expect(audit.shape).toBe('array-of-documents');
    expect(audit.total).toBe(reel.length + reel.reduce((n, d) => n + d.entries.length, 0));
    expect(audit.cited).toBe(audit.total);
    expect(audit.missing).toEqual([]);

    // MORSURE : une source de RANGÉE retirée est comptée manquante ET nommée par son chemin d'ids.
    const cible = reel[0].entries[3];
    const mute = reel.map((d, i) =>
      i === 0 ? { ...d, entries: d.entries.map((e, j) => (j === 3 ? { ...e, source: undefined } : e)) } : d,
    );
    const rouge = auditDataset(mute);
    expect(rouge.total).toBe(audit.total);
    expect(rouge.cited).toBe(audit.cited - 1);
    expect(rouge.missing).toEqual([`${reel[0].id}.${cible.id}`]);
  });

  it('EXEMPT_DATASETS ne cible que des fichiers réellement présents', () => {
    const files = new Set(DATASETS);
    const dangling = Object.keys(EXEMPT_DATASETS).filter((f) => !files.has(f));
    expect(dangling, `Exemption(s) fantôme(s) (fichier absent) — nettoyer EXEMPT_DATASETS :\n${dangling.join('\n')}`).toEqual([]);
  });
});

/**
 * HAUSSE d'une collection à compte des SLOTS (#2705), mesurée sur une COPIE de l'arbre : un fichier à part
 * de `slots-contrat.test.ts`, pour qu'un worker ne porte pas les deux scans du corpus.
 */
import { describe, expect, it } from 'vitest';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { corpusDesComptes } from '../../scripts/guards/lib/corpusDesComptes.mjs';
import { COLLECTIONS_A_COMPTE_PAR_NOM, ecartsDeCollection, siteDeSlot } from '../../scripts/guards/lib/occurrencesStock.mjs';
import { SLOTS_INATTEIGNABLES, SLOTS_SANS_DECLARATION } from '../../scripts/guards/lib/slotsStock.mjs';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));

describe('registre des SLOTS — une hausse n’a que la cible pour remède (#2705)', () => {
  it('une référence de plus dans une COPIE de l’arbre MONTE les deux comptes, et leur seul remède est la CIBLE', { timeout: 60_000 }, () => {
    const copie = mkdtempSync(join(tmpdir(), 'slots-hausse-'));
    try {
      for (const racine of ['src/data', 'src/scenes']) cpSync(join(ROOT, racine), join(copie, racine), { recursive: true });
      const ecrire = (rel: string, muter: (entrees: Array<{ talents?: unknown[] }>) => void) => {
        const chemin = join(copie, rel);
        const entrees = JSON.parse(readFileSync(chemin, 'utf8')) as Array<{ talents?: unknown[] }>;
        muter(entrees);
        writeFileSync(chemin, JSON.stringify(entrees), 'utf8');
      };
      ecrire('src/data/creatures.json', (cs) => cs.find((c) => c.talents?.length)!.talents!.push({ id: 'lire-ecrire' }));
      ecrire('src/data/species.json', (es) => es.find((e) => JSON.stringify(e.talents ?? []).includes('random'))!.talents!.push({ random: 1 }));
      const apres = corpusDesComptes(copie);
      const couverture = ecartsDeCollection({
        nom: 'SLOTS_SANS_DECLARATION', observe: COLLECTIONS_A_COMPTE_PAR_NOM.SLOTS_SANS_DECLARATION.mesure(apres), stock: SLOTS_SANS_DECLARATION, cle: siteDeSlot,
      });
      const inatteignables = ecartsDeCollection({
        nom: 'SLOTS_INATTEIGNABLES', observe: COLLECTIONS_A_COMPTE_PAR_NOM.SLOTS_INATTEIGNABLES.mesure(apres), stock: SLOTS_INATTEIGNABLES, cle: siteDeSlot,
      });
      expect(couverture.accrues.filter((l) => l.startsWith('creatures.json | talents — HAUSSE'))).toEqual([
        expect.stringContaining('Migrer : adopter la fabrique `ref`/`refs`/`specRef`/`pick` (`idDe`) sur le schéma du champ.'),
      ]);
      expect(inatteignables.accrues.filter((l) => l.startsWith('species.json | talents — HAUSSE'))).toEqual([
        expect.stringContaining('Migrer : la référence se pose en chaîne'),
      ]);
      expect([...couverture.neuves, ...couverture.perimees, ...inatteignables.neuves, ...inatteignables.perimees], 'une hausse n’est ni une ligne neuve ni une ligne périmée.').toEqual([]);
      expect([...couverture.accrues, ...inatteignables.accrues].filter((l) => l.includes('--write')), 'aucun remède n’écrit une hausse.').toEqual([]);
    } finally {
      rmSync(copie, { recursive: true, force: true });
    }
  });
});

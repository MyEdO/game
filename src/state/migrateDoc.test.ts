/**
 * `migrateDoc` NOMME la raison de son refus (`RaisonDeRefus`) : l'appelant la lit pour dire son refus,
 * il ne la devine pas. Une raison par cas, et une migration qui aboutit.
 */
import { describe, it, expect } from 'vitest';
import { migrateDoc, type MigrationMap } from './migrateDoc';

const CHAINE = {
  1: (d) => d,
  2: (d) => ({ ...d, deux: true }),
} satisfies MigrationMap;

describe('migrateDoc — une issue, et un refus NOMMÉ', () => {
  it('un document à monter traverse la chaîne jusqu’à la version courante de la table, chaque pas posant `version`', () => {
    expect(migrateDoc({ version: 1 }, CHAINE)).toEqual({ ok: true, doc: { version: 3, deux: true } });
    expect(migrateDoc({ version: 3 }, CHAINE)).toEqual({ ok: true, doc: { version: 3 } });
  });

  it.each([
    ['pas un objet', null, { raison: 'non-objet' }],
    ['version absente', {}, { raison: 'version-absente', version: undefined }],
    ['version non numérique', { version: '2' }, { raison: 'version-absente', version: '2' }],
    ['version future', { version: 4 }, { raison: 'version-future', version: 4 }],
    ['migrateur manquant', { version: 0 }, { raison: 'migrateur-manquant', version: 0 }],
  ] as const)('%s → raison nommée', (_nom, doc, attendu) => {
    expect(migrateDoc(doc, CHAINE)).toMatchObject({ ok: false, ...attendu });
  });

  it('un migrateur qui LÈVE : `migrateur-en-echec`, son message gardé', () => {
    const casse: MigrationMap = { 1: () => { throw new TypeError('illisible'); } };
    expect(migrateDoc({ version: 1 }, casse)).toEqual({ ok: false, raison: 'migrateur-en-echec', version: 1, detail: 'illisible' });
  });
});

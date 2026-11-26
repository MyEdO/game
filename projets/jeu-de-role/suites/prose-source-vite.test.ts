/** Le plugin `wfrp:prose-source` sur un paquet livré, servi par un serveur Vite RÉEL sur le dépôt
 *  (`src/data/schemas/source/prose-source.test.ts` en tient le contrat sur fixture). */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createServer } from 'vite';
// @ts-expect-error - plugin ESM JS (pas de types) — même convention que `vitest.config.ts`
import { proseSource } from '../../../scripts/source/prose-source-plugin.mjs';
// @ts-expect-error - résolveur ESM JS (pas de types) — même convention que `vitest.config.ts`
import { resoudreProse } from '../../../scripts/source/resoudre.mjs';
// @ts-expect-error - lecteur ESM JS (pas de types) — même convention que `vitest.config.ts`
import { cheminChapitre } from '../../../scripts/source/lecteur-fs.mjs';
import { RACINE_DEPOT, cheminDuDepot } from '../../../scripts/source/adresses.mjs';

describe('plugin `wfrp:prose-source` — paquet livré', () => {
  it('serveur Vite RÉEL sur le dépôt : le preset de Gustav sort de la Diligence avec la prose de son adresse, à l’octet du `Source/`', async () => {
    const rel = 'projets/jeu-de-role/campagnes/diligence/diligence-projet.json';
    const disque = JSON.parse(readFileSync(join(RACINE_DEPOT, rel), 'utf8'));
    type Preset = { id: string; profil: { desc?: string; descRef?: { book: string; ch: string } } };
    const gustavDe = (doc: { narratif: { presetsPnj: Preset[] } }): Preset | undefined =>
      doc.narratif.presetsPnj.find((p) => p.id === 'edo-gustav-fondleburger');
    const surDisque = gustavDe(disque)!;
    expect(surDisque.profil.desc, 'le DISQUE ne porte que l’adresse').toBeUndefined();
    const ref = surDisque.profil.descRef!;
    const attendu = (resoudreProse({ descRef: ref }) as { md: string }).md;
    expect(readFileSync(cheminDuDepot(cheminChapitre(ref.book, ref.ch)), 'utf8'), 'le texte est celui du livre').toContain(attendu);

    const server = await createServer({
      configFile: false,
      root: RACINE_DEPOT,
      logLevel: 'silent',
      server: { middlewareMode: true, watch: null },
      optimizeDeps: { noDiscovery: true },
      plugins: [proseSource()],
    });
    try {
      const module = await server.ssrLoadModule(`/${rel}`);
      expect(gustavDe(module.default)?.profil.desc).toBe(attendu);
    } finally {
      await server.close();
    }
  });
});

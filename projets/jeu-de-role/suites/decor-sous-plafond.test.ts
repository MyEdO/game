/** #1343 sur les paquets livrés : aucun décor volumique ne traverse une dalle ni un toit (`src/noyau/monde/decorSousPlafond.testkit.ts`). */
import { describe, expect, it } from 'vitest';
import { listerProjetsLivres } from '../../../scripts/guards/lib/projetsLivres.mjs';
import { lireProjetLivre } from '../../../scripts/source/projetLivre.mjs';
import { parseProject } from '../../../src/noyau/worldMap';
import { resolveNappes } from '../../../src/noyau/monde/volume/toits';
import { decorsQuiTraversent } from '../../../src/noyau/monde/decorSousPlafond.testkit';

const SCENES = listerProjetsLivres().flatMap((rel) => parseProject(lireProjetLivre(rel)).scenes);

describe('aucun décor volumique ne traverse une dalle ni un toit — paquets livrés (#1343)', () => {
  it('les paquets livrés portent des scènes à étage ET des scènes coiffées de toits', () => {
    expect(SCENES.some((s) => s.layers.length > 1), 'une scène à étage au moins').toBe(true);
    expect(SCENES.some((s) => resolveNappes(s).size > 0), 'une nappe de toiture au moins').toBe(true);
  });

  it('dans chaque scène livrée, chaque corps reste sous le plafond de ses cases', () => {
    const fautes = SCENES.flatMap(decorsQuiTraversent);
    expect(fautes, fautes.join('\n')).toEqual([]);
  });
});

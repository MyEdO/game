/**
 * ÉCHELLE D'UNE MONTURE vue par son cavalier (`mountedSvg`, `k = cavalier / mount.scaleK`) : c'est
 * l'échelle du QUAD de la monture (`combatantTokenScale`, `ActorDrawInputs.scaleK`). Sur tout ce qui
 * peut être spawné comme monture (bestiaire, coques, engins de siège), elle vaut l'ancienne chaîne
 * art × Taille (`sizeTokenScale`), SAUF pour une réf à EMPREINTE propre (`footprint`), où elle suit
 * l'empreinte (`footprintTokenScale`) comme le quad.
 */
import { describe, expect, it, vi } from 'vitest';
import { creatures, trappings, vehicles } from '../../../data';
import { spawnEnemy } from '../../../state/spawn';
import { actorDrawInputs } from './sceneMeshes';
import { combatantRender, footprintTokenScale, sizeTokenScale } from '../../sizeScale';

describe('échelle d’une monture : art × Taille, ou empreinte', () => {
  it('seules les réfs à empreinte propre quittent la chaîne art × Taille, et elles suivent l’empreinte', () => {
    const muet = vi.spyOn(console, 'error').mockImplementation(() => {});
    const refs = [
      ...creatures.map((c) => c.id),
      ...vehicles.filter((v) => v.hull).map((v) => v.id),
      ...trappings.filter((t) => t.siegeRig).map((t) => t.id),
    ];
    const àEmpreinte: string[] = [];
    const écarts: string[] = [];
    for (const ref of refs) {
      const m = spawnEnemy({ ref } as never, 'm', { x: 0, y: 0 });
      const art = combatantRender(m).scale;
      const { scaleK } = actorDrawInputs(m);
      if (m.footprint) {
        àEmpreinte.push(ref);
        expect(scaleK, ref).toBe(art * footprintTokenScale(m.footprint));
        if (scaleK !== art * sizeTokenScale(m.size)) écarts.push(ref);
      } else {
        expect(scaleK, ref).toBe(art * sizeTokenScale(m.size));
      }
    }
    muet.mockRestore();
    expect(écarts.length, 'la sonde mord : des réfs à empreinte changent d’échelle').toBeGreaterThan(0);
  });
});

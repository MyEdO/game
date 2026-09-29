import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { TopoScene } from './TopoScene';
import { emptyScene } from '../state/scene';
import type { Station } from '../state/stations';

/**
 * SMOKE SSR de TopoScene (env node : rendu serveur, pas de DOM interactif — le contrat de CLIC est
 * couvert par le câblage direct `onSelectStation` + la géométrie pure `topoMarkers.test`). On vérifie
 * que le composant s'assemble (sols/murs symboliques + marqueur de station cliquable) sans erreur.
 */
function station(over: Partial<Station> = {}): Station {
  return {
    id: 's1',
    kind: 'poste',
    pos: { x: 1, y: 1 },
    label: 'Baliste',
    icon: 'action/serve-engine',
    faction: 'ally',
    assignedIds: ['c1'],
    manned: true,
    ref: { kind: 'poste', hullId: 'h1', posteUid: 'p1' },
    ...over,
  };
}

describe('TopoScene — smoke SSR', () => {
  it('rend un <svg> top-down + un marqueur de station en zone cliquable (role=button, badge)', () => {
    const html = renderToStaticMarkup(
      <TopoScene scene={emptyScene(3, 3)} stations={[station()]} selectedStationId="s1" onSelectStation={() => {}} />,
    );
    expect(html).toContain('class="topo-scene"');
    expect(html).toContain('class="topo-station"');
    expect(html).toContain('role="button"'); // zone cliquable réelle (pas de chasse au pixel)
    expect(html).toContain('>1</text>'); // badge = 1 équipier assigné
  });
});

/**
 * #892 — la minimap EST une vue du dessus : elle ne plane qu'UN étage à la fois. Sans étage demandé,
 * les builders recevaient `view` absent et empilaient les murs de TOUTES les couches — latent tant que
 * les seules scènes à station sont mono-niveau, faux dès qu'un plan porte un étage.
 */
describe('TopoScene — le plan ne montre QU’UN étage', () => {
  /** Deux planchers, UN SEUL mur, au REZ. En vue du dessus un mur se trace en traits de coupe (`mur-coupe`). */
  function twoStoreys() {
    const s = emptyScene(4, 4);
    s.layers.push({ z: 1, tiles: new Array(16).fill('herbe') });
    s.walls = [{ x: 1, y: 1, side: 'N' }];
    return s;
  }

  it('plan du REZ : le mur du rez y est ; plan de l’ÉTAGE : il n’y est pas', () => {
    const rez = renderToStaticMarkup(<TopoScene scene={twoStoreys()} stations={[]} z={0} />);
    const etage = renderToStaticMarkup(<TopoScene scene={twoStoreys()} stations={[]} z={1} />);
    expect(rez).toContain('class="mur-coupe mur-coeur"');
    expect(etage).not.toContain('class="mur-coupe mur-coeur"');
  });
});

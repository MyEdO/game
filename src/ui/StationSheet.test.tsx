import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { StationChips } from './StationSheet';
import type { Station } from '../noyau/stations';

/**
 * Bande de puces de Stations : un poste VIDE se voit d'un coup d'œil (recette navigateur 2c —
 * l'effectif seul, en gris comme tout le reste, obligeait à lire chaque chiffre). Le signal est la
 * variante de TON de la primitive `.chip` (`.tone-warn`, `components.css`), et le CHIFFRE reste posé :
 * jamais une information portée par la seule couleur.
 */
function station(id: string, label: string, assignedIds: string[]): Station {
  return {
    id,
    kind: 'poste',
    pos: { x: 0, y: 0 },
    label,
    icon: 'action/serve-engine',
    faction: 'ally',
    assignedIds,
    manned: assignedIds.length > 0,
    ref: { kind: 'poste', hullId: 'coque', posteUid: id },
  };
}

const puces = (html: string) => html.split('<button').slice(1);

describe('StationChips — un poste vide SIGNALE, un poste pourvu non', () => {
  const html = renderToStaticMarkup(
    <StationChips
      stations={[station('p1', 'Pierrier tribord', ['gunnar', 'lise']), station('p2', 'Pierrier bâbord', [])]}
      onSelect={() => {}}
    />,
  );
  const [pourvu, vide] = puces(html);

  it('le poste SANS personne prend le ton d’alarme de la primitive', () => {
    expect(vide).toContain('class="chip tone-warn"');
    expect(vide, 'le chiffre reste : le signal ne tient jamais à la seule couleur').toContain('<span class="count">0</span>');
  });

  it('le poste POURVU garde la puce nue — aucune alarme à porter', () => {
    expect(pourvu).toContain('class="chip"');
    expect(pourvu).not.toContain('tone-warn');
    expect(pourvu).toContain('<span class="count">2</span>');
  });

  it('l’alarme est keyée sur l’EFFECTIF, pas sur la sélection ni sur le libellé', () => {
    const selectionne = renderToStaticMarkup(
      <StationChips stations={[station('p2', 'Pierrier bâbord', [])]} selectedStationId="p2" onSelect={() => {}} />,
    );
    expect(selectionne).toContain('tone-warn');
    expect(selectionne).toContain('aria-pressed="true"');
    // Le même poste, une fois servi, rend la puce nue — même libellé, même id.
    const servi = renderToStaticMarkup(
      <StationChips stations={[station('p2', 'Pierrier bâbord', ['lise'])]} selectedStationId="p2" onSelect={() => {}} />,
    );
    expect(servi).not.toContain('tone-warn');
  });
});

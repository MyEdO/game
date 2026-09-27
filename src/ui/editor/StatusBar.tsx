/**
 * Barre de statut de l'éditeur (manque du POC) : case survolée + terrain, outil actif,
 * dimensions de la scène, et toggles de CALQUES (déplacés de la Palette — ils concernent la vue).
 */
import type { Dispatch, ReactNode, SetStateAction } from 'react';
import { garanti } from '../../state/combatants';
import { terrainLabel } from '../../state/terrain';
import { Icon } from '../Icon';
import type { Layers, Pt, Tool } from './editorState';
import { libelleDeValeur } from '../../data/schemas/grammaire/meta';
import { entityKindSchema } from '../../data/schemas/defs-scenes/scene';
import { creatureLabel, siegeEngines } from '../../data';
import { layerLabel } from './LayerField';
import { PROPS } from '../../gameIso/catalog/decor';

const LAYER_LABEL: Record<keyof Layers, string> = {
  triggers: 'Déclencheurs',
  spawns: 'Ennemis',
  roofs: 'Toits',
  entries: 'Entrées',
  rest: 'Repos',
  zones: 'Zones',
};

/** Libellé humain de l'outil actif. */
export function toolLabel(tool: Tool): ReactNode {
  switch (tool.mode) {
    case 'select': return '↖ Sélection';
    case 'tile': return <><Icon id="map-tool/paint" size="sm" /> {terrainLabel(tool.terrain) ?? tool.terrain}</>;
    case 'entity':
      if (tool.kind === 'prop') return <><Icon id="map-tool/prop" size="sm" /> {garanti(PROPS[tool.ref], tool.ref, 'décor de la palette').label}</>;
      if (tool.kind === 'personnage') return <><Icon id="map-tool/npc" size="sm" /> {creatureLabel(tool.ref)}</>;
      return <><Icon id="map-tool/start-flag" size="sm" /> {libelleDeValeur(entityKindSchema, tool.kind)}</>;
    case 'zone': return tool.zone === 'room' ? <><Icon id="rest/home" size="sm" /> Pièce</>
      : tool.zone === 'trigger' ? <><Icon id="map-tool/zone" size="sm" /> Zone trigger</>
      : tool.zone === 'rest' ? <><Icon id="rest/camp" size="sm" /> Zone de repos</>
      : <><Icon id="ui/warning" size="sm" /> Piège / hasard</>;
    case 'zoneTiles': return <><Icon id="map-tool/zone" size="sm" /> Emprise · {tool.paint === 'add' ? 'ajouter' : 'retirer'}</>;
    case 'entry': return <><Icon id="nav/entry-point" size="sm" /> Point d’entrée</>;
    case 'encounter': return <><Icon id="action/attack" size="sm" /> Placer des ennemis</>;
    case 'emplacement': return <><Icon id="scenario/siege" size="sm" /> {garanti(siegeEngines().find((t) => t.id === tool.trappingId), tool.trappingId, 'engin de la palette').label}</>;
    case 'wall': return tool.paint === 'door' ? <><Icon id="map-tool/door" size="sm" /> Porte</> : tool.paint === 'diagBack' || tool.paint === 'diagFwd' ? <><Icon id="map-tool/wall" size="sm" /> Diagonale</> : <><Icon id="map-tool/wall" size="sm" /> Cloison</>;
    case 'height': return <><Icon id="map-tool/height" size="sm" /> Hauteur {tool.metres} m</>;
    case 'stair': return <>↗ Volée → {layerLabel(tool.toZ)}</>;
    case 'crenellated': return <><Icon id="map-tool/crenel" size="sm" /> Crénelage{tool.structure ? '' : ' (gomme)'}</>;
    case 'erase': return <><Icon id="map-tool/erase" size="sm" /> Gomme</>;
  }
}

export function StatusBar({
  hover,
  hoverTerrain,
  tool,
  dims,
  layers,
  setLayers,
}: {
  hover: Pt | null;
  hoverTerrain: string | null;
  tool: Tool;
  dims: { w: number; h: number };
  layers: Layers;
  setLayers: Dispatch<SetStateAction<Layers>>;
}) {
  return (
    <div className="editor-status">
      <span className="es-cell">
        {hover ? `(${hover.x}, ${hover.y})` : '(—, —)'}
        {hoverTerrain ? ` · ${terrainLabel(hoverTerrain) ?? hoverTerrain}` : ''}
      </span>
      <span className="es-tool">{toolLabel(tool)}</span>
      <span>{dims.w}×{dims.h}</span>
      <span className="es-layers">
        Calques :
        {(Object.keys(LAYER_LABEL) as (keyof Layers)[]).map((k) => (
          <label key={k} className="es-layer">
            <input type="checkbox" checked={layers[k]} onChange={(e) => setLayers((l) => ({ ...l, [k]: e.target.checked }))} />
            {LAYER_LABEL[k]}
          </label>
        ))}
      </span>
    </div>
  );
}

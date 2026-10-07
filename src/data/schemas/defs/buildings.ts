import { nommerNoeud } from '../grammaire/meta';
/**
 * Schéma de `buildings.json` — LE catalogue des types de bâtiment (#1715), consommé comme
 * `BuildingDef[]` (`src/data/buildings.types.ts`). 7 entrées, UNE forme, aucun discriminant : tous
 * les bâtiments portent les mêmes clés et se distinguent par leurs VALEURS.
 *
 * Un bâtiment n'est PAS un volume : le monde le bâtit en murs d'arête (`WallSeg`) sur un sol de
 * terrain, et sa nappe de toit vient du pivot (`gameIso/builders/roofs.ts`). L'entrée porte la
 * couverture de référence du type et les ornements d'identité que le rendu pose en billboard
 * (`gameIso/builders/props.ts`).
 *
 * PROVENANCE — `buildings` est déclaré `SANS_LIVRE` (aucun folio n'imprime de catalogue de
 * bâtiments) ET chaque entrée EXIGE son `maison` (`exiges`), comme les 25 sols de `terrains.json` :
 * l'exemption couvre le DOCUMENT, elle ne dispense pas chaque bâtiment de dire ce qu'il arbitre.
 */
import { z } from 'zod';
import { document } from '../grammaire/document';
import { enumNomme } from '../grammaire/valeurs';
import { idDe, ref } from '../grammaire/ref';

export const file = 'buildings.json';
export const famille = 'entite';

/** Où un ornement d'identité s'accroche sur le bâtiment — vocabulaire lu par `builders/props.ts`. */
export const buildingAnchorSchema = enumNomme({
  ridge: 'Faîte',
  facade: 'Façade',
  front: 'Devant la porte',
});

const doc = document(
  'buildings',
  famille,
  {
    roofMaterial: idDe('material', 'roof'),
    features: z.array(ref('prop', { anchor: nommerNoeud(buildingAnchorSchema, { nom: 'ancrage' }) })).optional(),
  },
  {
    roofMaterial: {
      label: 'Couverture de référence',
      hint: 'Couverture de référence du type de bâtiment (`materials.json`, domaine toiture)',
    },
    features: {
      label: 'Ornements d’identité',
      hint: 'Décors qui font reconnaître le type au premier coup d’œil (clocheton, cheminée, enseigne, étal) : une entrée du catalogue de décor et son ancrage sur le bâtiment',
    },
  },
  {
    codex: { keys: ['buildings'] },
    edit: { dataset: 'buildings' },
  },
  {
    exiges: ['maison'],
  },
);

export const schema = doc.schema;
export const meta = doc.meta;

export const exposition = doc.exposition;

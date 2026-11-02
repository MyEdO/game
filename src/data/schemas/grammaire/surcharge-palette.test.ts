/**
 * PORTE d'une surcharge de palette persistée (#1903) : la palette d'une matière d'objet passe par
 * `surchargePaletteSchema` (clés dans `SLOTS`, valeurs `#rrggbb`). Une clé de rôle (`…O`/`…H`) ou une
 * couleur hors format est refusée.
 */
import { describe, it, expect } from 'vitest';
import materialsJson from '../../materials.json';
import { schema as materialsSchema } from '../defs/materials';

const BASE = { metal: '#8fd4ff' };
const ROLE = { metal: '#8fd4ff', metalH: '#e6f7ff' };
const HORS_FORMAT = { metal: 'bleu' };

const doc = (s: Record<string, string>) => [...materialsJson.filter((m) => m.domain !== 'objet'), { id: 'palette-test', type: 'materials', label: 'Essai', domain: 'objet', palette: s }];

describe('surcharge de palette persistée : clés dans SLOTS, valeurs #rrggbb (#1903)', () => {
  it('matière objet : une base #rrggbb passe', () => expect(materialsSchema.safeParse(doc(BASE)).success).toBe(true));
  it('matière objet : une clé de rôle est refusée', () => expect(materialsSchema.safeParse(doc(ROLE)).success).toBe(false));
  it('matière objet : une couleur hors format est refusée', () => expect(materialsSchema.safeParse(doc(HORS_FORMAT)).success).toBe(false));
});

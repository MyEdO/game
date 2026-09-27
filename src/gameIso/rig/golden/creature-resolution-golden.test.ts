/**
 * Golden master de la RÉSOLUTION nom → apparence (plan / espèce / def / échelle) — filet
 * anti-régression de la refonte « tuer le match-par-nom POC » (plan P1). On fige ici ce que la
 * résolution actuelle (regex + priorité) produit pour CHAQUE def du registre ET chaque entrée du
 * bestiaire. La résolution par clé DOIT reproduire ces snapshots à l'identique : sinon une créature
 * changerait d'apparence.
 *
 * Capture ce que rend `resolveRender` (`../bodyPlan`) :
 *   non-bipède → { plan, species, def=defById(species), scale=speciesScale }
 *   bipède     → { plan:'biped', species=espèce explicite ?? espèce du record ?? DEFAULT_RACE_ID, def=defById(species), scale=speciesScale }
 */
import { describe, it, expect } from 'vitest';
import { CREATURES, defById, defId } from '../creatures';
import { resolveById, resolveSpecies, type RenderResolution } from '../bodyPlan';
import { creatures as bestiary } from '../../../data';

type Resolved = { plan: string; species: string | null; def: string | null; scale: number };

/** Fige plan/espèce/def/échelle d'une résolution. Deux entrées : par ID d'espèce explicite (registre des
 *  defs) et par ID de record (bestiaire) — plus aucun chemin par libellé. */
const shape = (r: RenderResolution): Resolved =>
  ({ plan: r.plan, species: r.species || null, def: defById(r.species)?.label ?? null, scale: r.scale });

describe('golden — résolution espèce/id→apparence (anti-régression de-POC match-par-nom)', () => {
  it('defs du registre : id d’espèce → (plan, espèce, def, échelle)', () => {
    const ids = [...new Set(CREATURES.map((c) => defId(c)))].sort();
    expect(Object.fromEntries(ids.map((id) => [id, shape(resolveSpecies(id))]))).toMatchSnapshot();
  });
  it('bestiaire (creatures.json) : label → (plan, espèce, def, échelle)', () => {
    // Clé d'affichage = label ; résolution PAR ID (record du bestiaire).
    const entries = bestiary.map((c) => [c.label, shape(resolveById(c.id))] as const).sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
    expect(Object.fromEntries(entries)).toMatchSnapshot();
  });
});

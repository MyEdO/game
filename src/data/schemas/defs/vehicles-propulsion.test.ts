/**
 * #1595 — la propulsion de type d'un navire (MDG 12 l.131) est tenue au PARSE de `vehicles.json`,
 * sur le document RÉEL : la vapeur est une amélioration (MDG 12 l.195-199, l.311), jamais un type.
 */
import { describe, expect, it } from 'vitest';
import { schema } from './vehicles';
import vehiclesJson from '../../vehicles.json';

type Entree = { id: string; ship?: { sail?: unknown; oars?: unknown } };
const clone = (): Entree[] => structuredClone(vehiclesJson) as unknown as Entree[];

describe('vehicles.json — un navire porte Voiles ou Avirons', () => {
  it('m0 TÉMOIN : le document RÉEL parse', () => {
    expect(schema.safeParse(vehiclesJson).success).toBe(true);
  });

  it('un navire sans Voiles ni Avirons est refusé, en nommant le véhicule', () => {
    const doc = clone();
    const navire = doc.find((v) => v.ship?.sail && v.ship?.oars);
    expect(navire, 'aucun navire mixte — la fixture ne mesure rien').toBeDefined();
    delete navire!.ship!.sail;
    delete navire!.ship!.oars;
    const r = schema.safeParse(doc);
    expect(r.success).toBe(false);
    expect(r.success ? '' : r.error.issues.map((i) => i.message).join(' ')).toContain(`${navire!.id} : navire sans propulsion`);
  });

  it('un navire à Avirons seuls parse', () => {
    const doc = clone();
    const navire = doc.find((v) => v.ship?.sail && v.ship?.oars)!;
    delete navire.ship!.sail;
    expect(schema.safeParse(doc).success).toBe(true);
  });
});

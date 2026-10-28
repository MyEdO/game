/**
 * `opPsy` : seule graphie des ops psychologiques, à références emboîtées (`{ id }`) ; `traitOctroye` en est
 * le seul lecteur côté octroi (#1468, #1463). Entrées de donnée choisies par leur forme, jamais par leur nom.
 */
import { describe, it, expect } from 'vitest';
import { opPsy, traitOctroye } from './opsPsy';
import { ciblePsy } from './ciblage';
import { groups, psychologies } from '../../data';
import { gameOpSchema } from '../../data/schemas/grammaire/mecanique';

const ciblee = psychologies.find((p) => p.targeted);
const nonCiblee = psychologies.find((p) => !p.targeted && !p.becomes);
const groupe = groups[0];

describe('opPsy — références emboîtées', () => {
  it('précondition : un type ciblé, un type non ciblé, un Groupe', () => {
    expect(ciblee).toBeDefined();
    expect(nonCiblee).toBeDefined();
    expect(groupe).toBeDefined();
  });

  it('chaque fabrique rend une op que le schéma de donnée admet', () => {
    const cible = ciblePsy.groupe(groupe.id);
    for (const op of [
      opPsy.pose(nonCiblee!.id, { indice: 1 }),
      opPsy.pose(ciblee!.id, { cible }),
      opPsy.fin(nonCiblee!.id),
      opPsy.octroi(ciblee!.id, cible),
      opPsy.retrait(nonCiblee!.id),
      opPsy.retrait(),
    ]) expect(gameOpSchema.safeParse(op).success, JSON.stringify(op)).toBe(true);
  });

  it('le type et la Cible sont des `{ id }`, sans clé absente posée à `undefined`', () => {
    expect(opPsy.octroi(ciblee!.id, ciblePsy.groupe(groupe.id))).toEqual({ op: 'grantPsychTrait', psychType: { id: ciblee!.id }, cible: { id: groupe.id } });
    expect(Object.keys(opPsy.pose(nonCiblee!.id))).toEqual(['op', 'type']);
    expect(Object.keys(opPsy.retrait())).toEqual(['op']);
  });
});

describe('traitOctroye — le Trait d’un octroi', () => {
  it('rend le type et la Cible du moteur', () => {
    const cible = ciblePsy.groupe(groupe.id);
    expect(traitOctroye(opPsy.octroi(ciblee!.id, cible))).toEqual({ type: ciblee!.id, cible });
    expect(traitOctroye(opPsy.octroi(nonCiblee!.id))).toEqual({ type: nonCiblee!.id });
  });
});

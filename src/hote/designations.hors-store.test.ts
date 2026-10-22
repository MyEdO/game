/**
 * LES DÉSIGNATIONS DES VERBES (#2898, #2928) : la table du noyau (`DESIGNATIONS`, src/noyau/designations.ts) est la seule
 * source des ids qu'un paramètre de verbe désigne : les paramètres des verbes (`VERBES`, lus du type du noyau) portent
 * chacune de ses clés, et aucune autre ; `argumentsDuVerbe` (`geste.ts`) contrôle un id contre elle.
 */
import { describe, it, expect } from 'vitest';
import { DESIGNATIONS } from '../noyau/index';
import { VERBES } from './verbes.generated';
import type { Forme } from './formes';

/** Les désignations que les formes d'une liste de paramètres portent. */
function designationsDe(f: Forme): string[] {
  switch (f.genre) {
    case 'chaine': return f.designe ? [f.designe.cle] : [];
    case 'objet': return [...(f.designe ? [f.designe.cle] : []), ...(f.champs ?? []).flatMap((c) => designationsDe(c.forme))];
    case 'union': return f.membres.flatMap(designationsDe);
    case 'tableau': return designationsDe(f.element);
    default: return [];
  }
}

describe('la table du noyau est la seule source des désignations', () => {
  it('chaque désignation de la table est portée par un paramètre de verbe, et aucune autre', () => {
    const portees = new Set(Object.values(VERBES).flatMap((ps) => ps.flatMap((p) => designationsDe(p.forme))));
    expect([...portees].sort()).toEqual(Object.keys(DESIGNATIONS).sort());
  });
});

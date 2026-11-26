import { expect } from 'vitest';
import { avancer, herosDuGroupe, nouvellePartie, partir, recrue, PROFILS, type Etat, type RecitDeSalle, type Salle, type TypeDeSalle } from './index';

/** Une partie à la graine `graine` partie au Reikwald avec ses `renforts` (carrières du roster), ses premières salles
 *  remplacées par `premieres`, puis rechargée (aller-retour JSON, comme `sauver` et `charger`) ; aucune salle n'est
 *  encore ouverte. */
export function enRoute(graine: number, premieres: Salle[], renforts: string[] = []): Etat {
  const e = nouvellePartie(graine);
  const venus = renforts.map((id) => recrue(e, PROFILS.find((p) => p.id === id)!));
  e.roster.push(...venus);
  expect(partir(e, 'reikwald', [...e.roster.slice(0, 4 - venus.length), ...venus].map((h) => h.c.id))).toBeNull();
  e.expedition!.salles.splice(0, premieres.length, ...premieres);
  return JSON.parse(JSON.stringify(e)) as Etat;
}

/** `enRoute` avec une première salle du type `type`, posée comme `partir` pose une salle à choix, ouverte par
 *  `avancer`. */
export function devant(type: TypeDeSalle, graine: number, renforts: string[] = []): Etat {
  const e = enRoute(graine, [{ type, ennemis: [], faite: false }], renforts);
  expect(avancer(e)).toBeNull();
  return e;
}

/** Le récit d'une action jouée ; un refus fait échouer le test. */
export const recit = (r: RecitDeSalle | string): RecitDeSalle => { if (typeof r === 'string') throw new Error(r); return r; };

/** Les Blessures courantes de chaque héros du groupe, par id. */
export const blessures = (e: Etat) => new Map(herosDuGroupe(e).map((h) => [h.c.id, h.c.wounds.current]));

import { describe, expect, it } from 'vitest';
import { ameliorer, nouvellePartie, offresDeCarriere, recrue, roleDe, PROFILS, type Etat } from './index';

const profilDe = (id: string) => PROFILS.find((p) => p.id === id)!;
/** Une partie au relais `palier`, bâti par le jeu (`ameliorer`). */
function auRelais(graine: number, palier: number): Etat {
  const e = nouvellePartie(graine);
  e.or = 10_000; e.trophees = 10;
  for (let i = 0; i < palier; i++) expect(ameliorer(e, 'relais')).toBeNull();
  return e;
}

describe('recrues du relais', () => {
  it('une recrue de niveau 2 sort du noyau au niveau 2, son niveau 1 complété, sans PX restant', () => {
    const h = recrue(nouvellePartie(3), profilDe('repurgateur'));
    const o = offresDeCarriere(h);
    expect(h.c.careerLevel).toBe(2);
    expect(h.c.xp ?? 0).toBe(0);
    expect(o.niveau).toBe(2);
    expect(o.suivant?.niveau).toBe(3);
    for (const k of ['capacite-de-combat', 'endurance', 'force-mentale'] as const) expect(h.c.charAdvances?.[k] ?? 0).toBeGreaterThanOrEqual(5);
  });

  it('les candidats d’un même tirage ont des rôles distincts', () => {
    for (let graine = 1; graine <= 10; graine++) {
      for (const palier of [0, 1, 2]) {
        const e = auRelais(graine, palier);
        const roles = e.candidats.map((c) => roleDe(c.carriere));
        expect(roles).toHaveLength(2 + palier);
        expect(new Set(roles).size).toBe(roles.length);
      }
    }
  });

  it('la recrue tire une espèce que sa carrière admet', () => {
    const e = nouvellePartie(5);
    for (let i = 0; i < 6; i++) {
      expect(recrue(e, profilDe('tueur')).espece).toBe('nains');
      expect(recrue(e, profilDe('nonne')).espece).toBe('humains-reiklander');
    }
  });
});

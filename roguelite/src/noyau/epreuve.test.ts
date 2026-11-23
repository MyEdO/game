import { describe, expect, it } from 'vitest';
import { jouerLeCombat, jouerLEpreuve, nouvelleRecrue } from './index';
import { EPREUVES } from '../jeu/valeurs';

const CACHE = EPREUVES.tresor.epreuve;
const groupe = () => [
  nouvelleRecrue(31, 'soldat', 'humains-reiklander', 'Hans', { talent: { id: 'guerrier-ne' } }),
  nouvelleRecrue(32, 'chasseur', 'humains-reiklander', 'Greta', { talent: { id: 'dur-a-cuire' } }),
  nouvelleRecrue(33, 'hors-la-loi', 'humains-reiklander', 'Ulli', { talent: { id: 'vigilance' } }),
];
const GRAINE_REUSSIE = 7;
const GRAINE_RATEE = 1;

/** Les Blessures que la branche d'échec de la table retire, lues sur la table. */
function blessuresDuPiege(): number {
  const echec = CACHE.flux.echec;
  if (echec.kind !== 'effet' || echec.effet.type !== 'ops') throw new Error('branche d’échec hors forme');
  const op = echec.effet.ops[0];
  if (op?.op !== 'wounds' || typeof op.amount !== 'number') throw new Error('op hors forme');
  return op.amount;
}

describe('jouerLEpreuve — la cache piégée jouée par le noyau', () => {
  it('rejoue la même issue à graine fixe', () => {
    expect(jouerLEpreuve(groupe(), CACHE, GRAINE_RATEE)).toEqual(jouerLEpreuve(groupe(), CACHE, GRAINE_RATEE));
    expect(jouerLEpreuve(groupe(), CACHE, GRAINE_REUSSIE)).toEqual(jouerLEpreuve(groupe(), CACHE, GRAINE_REUSSIE));
  });

  it('réussite : un héros du groupe a jeté, le groupe revient tel qu’il est parti', () => {
    const avant = groupe();
    const r = jouerLEpreuve(avant, CACHE, GRAINE_REUSSIE);
    expect(r.reussite).toBe(true);
    expect(r.dr).toBeGreaterThanOrEqual(0);
    expect(avant.map((c) => c.id)).toContain(r.testeur);
    expect(r.groupe).toEqual(avant);
  });

  it('échec : le piège retire ses Blessures à exactement un héros, sans État résiduel', () => {
    const avant = groupe();
    const r = jouerLEpreuve(avant, CACHE, GRAINE_RATEE);
    expect(r.reussite).toBe(false);
    expect(avant.map((c) => c.id)).toContain(r.testeur);
    const pertes = r.groupe.map((c) => avant.find((a) => a.id === c.id)!.wounds.current - c.wounds.current);
    expect(pertes.filter((p) => p !== 0)).toEqual([blessuresDuPiege()]);
    for (const c of r.groupe) expect(c.conditions).toEqual([]);
    const victime = r.groupe.findIndex((_, i) => pertes[i] !== 0);
    expect({ ...r.groupe[victime], wounds: avant[victime].wounds }).toEqual(avant[victime]);
  });

  it('un combat joué après l’épreuve démarre propre : seules les Blessures de la victime ont changé', () => {
    const rendu = jouerLEpreuve(groupe(), CACHE, GRAINE_RATEE).groupe;
    const temoin = groupe().map((c, i) => ({ ...c, wounds: rendu[i].wounds }));
    expect(jouerLeCombat(rendu, ['gobelin'], 3)).toEqual(jouerLeCombat(temoin, ['gobelin'], 3));
  });
});

import { describe, expect, it } from 'vitest';
import { epreuveTentable, jouerLeCombat, jouerLEpreuve, nouvelleRecrue, type Epreuve } from './index';
import { EPREUVES, PROFILS } from '../jeu';

const { fouiller, desarmer } = EPREUVES.tresor.actions;
const FOUILLE = fouiller.epreuves[0];
const recrueDu = (graine: number, carriere: string, nom: string) => nouvelleRecrue(graine, carriere, 'humains-reiklander', nom, PROFILS.find((p) => p.id === carriere)!.identite);
const groupe = () => [recrueDu(31, 'soldat', 'Hans'), recrueDu(32, 'chasseur', 'Greta'), recrueDu(33, 'ratier', 'Ulli')];

/** Les Blessures que la branche d'échec de la table retire, lues sur la table. */
function blessuresDuPiege(ep: Epreuve): number {
  const echec = ep.flux.echec;
  if (echec.kind !== 'effet' || echec.effet.type !== 'ops') throw new Error('branche d’échec hors forme');
  const op = echec.effet.ops[0];
  if (op?.op !== 'wounds' || typeof op.amount !== 'number') throw new Error('op hors forme');
  return op.amount;
}
/** La première graine de 1 à 60 où `jouer` rend l'issue `reussite`. */
function graineOu<T extends { reussite: boolean }>(reussite: boolean, jouer: (graine: number) => T): number {
  for (let g = 1; g <= 60; g++) if (jouer(g).reussite === reussite) return g;
  throw new Error(`aucune graine ${reussite ? 'réussie' : 'ratée'}`);
}

describe('jouerLEpreuve — la cache piégée jouée par le noyau', () => {
  it('rejoue la même issue à graine fixe', () => {
    const seul = () => [groupe()[1]];
    for (const g of [1, 7]) expect(jouerLEpreuve(seul(), FOUILLE, g)).toEqual(jouerLEpreuve(seul(), FOUILLE, g));
  });

  it('la lame sans `on` frappe tout le groupe de l’épreuve', () => {
    const avant = groupe();
    const r = jouerLEpreuve(avant, FOUILLE, graineOu(false, (g) => jouerLEpreuve(groupe(), FOUILLE, g)));
    expect(r.groupe.map((c, i) => avant[i].wounds.current - c.wounds.current)).toEqual(avant.map(() => blessuresDuPiege(FOUILLE)));
  });

  it('un héros seul : il jette, et le piège ne frappe que lui, même à 2 Blessures', () => {
    const seul = () => { const c = groupe()[2]; c.wounds.current = 2; return [c]; };
    const r = jouerLEpreuve(seul(), FOUILLE, graineOu(false, (g) => jouerLEpreuve(seul(), FOUILLE, g)));
    expect(r.testeur).toBe(seul()[0].id);
    expect(r.groupe).toHaveLength(1);
    expect(r.groupe[0].wounds.current).toBe(Math.max(0, 2 - blessuresDuPiege(FOUILLE)));
  });

  it('réussite : le héros revient tel qu’il est parti', () => {
    const seul = () => [groupe()[1]];
    const r = jouerLEpreuve(seul(), FOUILLE, graineOu(true, (g) => jouerLEpreuve(seul(), FOUILLE, g)));
    expect(r.dr).toBeGreaterThanOrEqual(0);
    expect(r.groupe).toEqual(seul());
  });

  it('un combat joué après l’épreuve démarre propre : seules les Blessures de la victime ont changé', () => {
    const seul = () => [groupe()[0]];
    const rendu = jouerLEpreuve(seul(), FOUILLE, graineOu(false, (g) => jouerLEpreuve(seul(), FOUILLE, g))).groupe;
    const temoin = seul().map((c, i) => ({ ...c, wounds: rendu[i].wounds }));
    expect(jouerLeCombat(rendu, ['gobelin'], 3)).toEqual(jouerLeCombat(temoin, ['gobelin'], 3));
  });

  it('epreuveTentable : Piégeage pour qui le possède, rien pour qui n’a ni Piégeage ni Crochetage (LDB 09 l.30)', () => {
    const [soldat, chasseur] = groupe();
    expect(epreuveTentable(chasseur, desarmer.epreuves)?.flux.test.skill).toEqual({ id: 'piegeage' });
    expect(epreuveTentable(soldat, desarmer.epreuves)).toBeUndefined();
    expect(epreuveTentable(soldat, fouiller.epreuves)).toBe(FOUILLE);
  });
});

/**
 * Le JET (`jetSchema`, LDB 12 l.7, l.137) est UNE forme de la grammaire : le Test de flux, la
 * récupération d'un État et la racine d'un jeu de taverne la COMPOSENT — mêmes nœuds, jamais une copie.
 */
import { describe, expect, it } from 'vitest';
import { flowTestSchema, jetSchema } from './mecanique';
import { enfantsDe } from './descente';
import { noeudDeLEntree, noeudObjet } from '../validate';
import etats from '../../etats.json';
import tavernGames from '../../tavernGames.json';

const champ = (noeud: unknown, cle: string): unknown => enfantsDe(noeudObjet(noeud)).find((e) => e.cle === cle)?.noeud;
const CLES = ['skill', 'characteristic', 'difficulty'] as const;

describe('jetSchema — une forme, trois porteurs', () => {
  it('le Test de flux compose le jet', () => {
    for (const cle of CLES) expect(champ(flowTestSchema, cle), cle).toBe(champ(jetSchema, cle));
  });

  it('la récupération d’un État compose le jet', () => {
    const etat = (etats as { id: string; recover?: unknown }[]).find((e) => e.recover)!;
    const recover = champ(noeudDeLEntree('etats', etat), 'recover');
    for (const cle of CLES) expect(champ(recover, cle), cle).toBe(champ(jetSchema, cle));
  });

  it('la racine d’un jeu de taverne compose le jet', () => {
    const racine = noeudDeLEntree('tavernGames', tavernGames[0]);
    for (const cle of CLES) expect(champ(racine, cle), cle).toBe(champ(jetSchema, cle));
  });
});

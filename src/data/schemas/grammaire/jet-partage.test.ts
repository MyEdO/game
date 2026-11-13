/**
 * Le JET (`jetSchema`, LDB 12 l.7, l.137) est UNE forme de la grammaire : le Test de flux, la
 * récupération d'un État et la racine d'un jeu de taverne la COMPOSENT — mêmes nœuds, jamais une copie.
 * La DÉCISION d'un Test (`decisionDuTestSchema`, #1874) l'est aussi : le Test de flux et le Test étendu la composent.
 */
import { describe, expect, it } from 'vitest';
import { decisionDuTestSchema, extendedTestSchema, flowTestSchema, jetSchema } from './mecanique';
import { enfantsDe } from './descente';
import { CHAMPS_DE_DECISION } from '../../../engine/flowCore';
import { noeudDeLEntree, noeudObjet } from '../validate';
import { etats } from '../../index';
import tavernGames from '../../tavernGames.json';

const champ = (noeud: unknown, cle: string): unknown => enfantsDe(noeudObjet(noeud)).find((e) => e.cle === cle)?.noeud;
const CLES = ['skill', 'characteristic', 'difficulty'] as const;

describe('jetSchema — une forme, trois porteurs', () => {
  it('le Test de flux compose le jet', () => {
    for (const cle of CLES) expect(champ(flowTestSchema, cle), cle).toBe(champ(jetSchema, cle));
  });

  it('la récupération d’un État compose le jet', () => {
    const etat = etats.find((e) => e.recover);
    if (!etat) throw new Error('aucun État ne porte de récupération (`recover`)');
    const recover = champ(noeudDeLEntree('etats', etat), 'recover');
    for (const cle of CLES) expect(champ(recover, cle), cle).toBe(champ(jetSchema, cle));
  });

  it('la racine d’un jeu de taverne compose le jet', () => {
    const racine = noeudDeLEntree('tavernGames', tavernGames[0]);
    for (const cle of CLES) expect(champ(racine, cle), cle).toBe(champ(jetSchema, cle));
  });
});

describe('decisionDuTestSchema — une décision, deux porteurs', () => {
  it('la décision porte exactement `CHAMPS_DE_DECISION`', () => {
    expect(Object.keys(decisionDuTestSchema.shape).sort()).toEqual([...CHAMPS_DE_DECISION].sort());
  });

  it('le Test de flux et le Test étendu composent la décision et le jet', () => {
    for (const cle of CHAMPS_DE_DECISION) {
      expect(champ(flowTestSchema, cle), cle).toBe(champ(decisionDuTestSchema, cle));
      expect(champ(extendedTestSchema, cle), cle).toBe(champ(decisionDuTestSchema, cle));
    }
    for (const cle of CLES) expect(champ(extendedTestSchema, cle), cle).toBe(champ(jetSchema, cle));
  });
});

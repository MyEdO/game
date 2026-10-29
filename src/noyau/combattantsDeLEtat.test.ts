import { describe, it, expect } from 'vitest';
import { cheminsDeLaSession, COMBATTANT, ETAT } from '../../scripts/gen-combattants-de-l-etat.mjs';
import { libererSessions, virtualProgram, VIRTUAL_ROOT } from '../../scripts/guards/lib/tsProgram.mjs';

/**
 * Le générateur des chemins de combattants (`scripts/gen-combattants-de-l-etat.mjs`, #1463), sur un `EtatDeJeu`
 * fabriqué : ce qu'il lit du type, et le LIEU qu'il nomme quand un combattant y est hors de portée de la transition.
 */
const chemins = (champs: string, annexes = ''): string[][] => {
  const session = virtualProgram({
    [COMBATTANT.module]: `export interface ${COMBATTANT.type} { id: string }\n`,
    [ETAT.module]: `import type { ${COMBATTANT.type} } from '../engine/types';\n${annexes}\nexport interface ${ETAT.type} {\n${champs}\n}\n`,
  });
  try {
    return cheminsDeLaSession(session, VIRTUAL_ROOT);
  } finally {
    libererSessions([session]);
  }
};

describe('gen-combattants-de-l-etat — les chemins lus du type', () => {
  it('tableau, champ imbriqué, union avec null : chaque chemin, trié ; un champ sans combattant n’en donne aucun', () => {
    expect(chemins('party: Combatant[];\nbattle: { combatants: Combatant[] } | null;\nmassBattle: { ally: { combatant: Combatant } };\nmode: string;')).toEqual([
      ['battle', 'combatants', '[]'],
      ['massBattle', 'ally', 'combatant'],
      ['party', '[]'],
    ]);
  });
});

describe('gen-combattants-de-l-etat — le lieu d’un combattant hors de portée est NOMMÉ par son chemin', () => {
  it('signature d’index : le champ fautif, jamais le premier lieu où le type `Combatant` a été vu', () => {
    expect(() => chemins('travelPlan: { vehicle: Combatant };\ntroupes: Record<string, Combatant>;'))
      .toThrow('gen-combattants-de-l-etat : EtatDeJeu.troupes{} porte un Combatant que transitionDuJeu ne sait pas écrire');
    expect(() => chemins('troupes: Record<string, Combatant>;\ntravelPlan: { vehicle: Combatant };'))
      .toThrow('gen-combattants-de-l-etat : EtatDeJeu.troupes{} porte un Combatant que transitionDuJeu ne sait pas écrire');
  });

  it('`Map` imbriquée : le parent et le pas', () => {
    expect(() => chemins('party: Combatant[];\ngarnison: { postes: Map<string, Combatant> };'))
      .toThrow('gen-combattants-de-l-etat : EtatDeJeu.garnison.postes<Map> porte un Combatant que transitionDuJeu ne sait pas écrire');
  });

  it('type récursif : le chemin où il se referme', () => {
    expect(() => chemins('arbre: Noeud;', 'interface Noeud { porteur: Combatant; enfants: Noeud[] }'))
      .toThrow('gen-combattants-de-l-etat : EtatDeJeu.arbre.enfants[] porte un Combatant par un type récursif');
  });
});

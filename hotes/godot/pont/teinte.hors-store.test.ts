/**
 * LA TEINTE ET L'ARMURE D'UN CORPS (#3456 ; `CONTRAT.md`, section « Corps d'un combattant ») : au scénario
 * `teinte-au-combat`, sur les modèles commités, l'arme teinte monte à sa prise sous la palette de sa teinte, et l'armure,
 * équipée ou de statbloc déclarée portée, monte les éléments de ses pièces.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { findTeinteById } from '../../../src/noyau/index';
import { modelesCommites, servirLesModeles, suiteDe, table, vueDe } from './pont.testkit';
import type { CombattantProjete } from '../../../src/hote/projection';

const COMMITES = await modelesCommites();
const { appel } = table();

describe('la teinte et l’armure d’un combattant sur la base (#3456)', () => {
  let lame: CombattantProjete;
  let orc: CombattantProjete;
  beforeAll(() => {
    const liste = suiteDe(appel('demarrer', { scenario: 'teinte-au-combat', graine: 7 })).vue.projection.combat!.voisins.liste;
    lame = liste.find((c) => c.id === 'lame-aethyrique')!;
    orc = liste.find((c) => c.portee?.portees.some((p) => p.cle.champ === 'piece' && p.par === undefined))!;
  });

  it('l’épée teinte monte à sa prise sous la palette de sa teinte ; les brassards de la Lame et de l’armure de statbloc de l’orc montent leur élément', () => {
    servirLesModeles(appel, COMMITES);
    const { combattants } = vueDe(appel('vue')).corps;
    expect(combattants[lame.id]?.montes).toContainEqual({ ligne: 'main', element: 'humanoide--rigide--epee', palette: findTeinteById('aethyrique')!.palette });
    for (const c of [lame, orc]) expect(combattants[c.id]?.montes).toContainEqual({ ligne: 'ligne/piece/brassards', element: 'humanoide--armure--brassards' });
  });
});

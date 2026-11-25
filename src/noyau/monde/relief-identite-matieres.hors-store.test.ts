import { idsDeTest } from '../../engine/idsDeTest.testkit';
import { describe, it, expect } from 'vitest';
import { paquetDuJeu } from '../campagneLivree';
import { campagneDeTest } from '../../scenes/fixtures/contenuDuCommun';
import { testScenarios } from '../../scenes/test-scenarios';
import { ecarts, idsHorsDuDomaine } from './reliefIdentite.testkit';

describe('matières de relief — l’id émis est celui de la DONNÉE (scènes du commun, #1691)', () => {
  const scenes = [
    ...testScenarios.map((s) => ({ nom: `scenario:${s.id}`, scene: s.construire(idsDeTest).scene })),
    ...paquetDuJeu(campagneDeTest).scenes.map((scene) => ({ nom: `campagne:${campagneDeTest.id}/${scene.id}`, scene })),
  ];
  const mesures = scenes.map(({ nom, scene }) => ecarts(nom, scene));

  it('chaque gisement alimente le balayage, et le balayage émet des faces de relief', () => {
    expect(testScenarios.length, 'le registre des scénarios ne porte plus aucune scène').toBeGreaterThan(0);
    expect(paquetDuJeu(campagneDeTest).scenes.length, 'la campagne de test ne porte aucune scène').toBeGreaterThan(0);
    expect(mesures.reduce((n, m) => n + m.faces, 0), 'aucune face de relief émise : le contrat porterait sur rien').toBeGreaterThan(0);
  });

  it('chaque face de relief porte l’id que la donnée pose (terrain à bloc plein, sinon la scène)', () => {
    expect(mesures.flatMap((m) => m.fautes)).toEqual([]);
  });

  it('l’inventaire des ids émis est inclus dans le domaine `relief` de materials.json', () => {
    const emis = mesures.flatMap((m) => [...m.idsEmis]);
    expect(emis.length).toBeGreaterThan(0);
    expect(idsHorsDuDomaine(emis)).toEqual([]);
  });
});

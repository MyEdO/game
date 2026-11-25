import { describe, it, expect } from 'vitest';
import { campagnes } from '../campagnes';
import { paquetDuJeu } from '../../../src/noyau/campagneLivree';
import { ecarts, idsHorsDuDomaine } from '../../../src/noyau/monde/reliefIdentite.testkit';

describe('matières de relief — l’id émis est celui de la DONNÉE (campagnes livrées, #1691)', () => {
  const mesures = campagnes.flatMap((c) => paquetDuJeu(c).scenes.map((scene) => ecarts(`campagne:${c.id}/${scene.id}`, scene)));

  it('chaque campagne intégrée alimente le balayage, et le balayage émet des faces de relief', () => {
    for (const c of campagnes) {
      expect(paquetDuJeu(c).scenes.length, `campagne « ${c.id} » : aucune scène livrée — elle n’entre plus dans la mesure`).toBeGreaterThan(0);
    }
    expect(mesures.reduce((n, m) => n + m.faces, 0), 'aucune face de relief émise : le contrat porterait sur rien').toBeGreaterThan(0);
  });

  it('chaque face de relief porte l’id que la donnée pose (terrain à bloc plein, sinon la scène)', () => {
    expect(mesures.flatMap((m) => m.fautes)).toEqual([]);
  });

  it('l’inventaire des ids émis est inclus dans le domaine `relief` de materials.json', () => {
    expect(idsHorsDuDomaine(mesures.flatMap((m) => [...m.idsEmis]))).toEqual([]);
  });
});

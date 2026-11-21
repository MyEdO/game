import { expect, it } from 'vitest';
import { MINUTES_PER_DAY, minutesParSemaine } from '../engine/clock';
import { idsDeTest } from '../engine/idsDeTest.testkit';
import { tousLesHerosDeScenario } from '../scenes/test-scenarios/_heros';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { draineCascade } from './cascade.testkit';
import { emptyScene } from './monde/scene';
import { exporterLaSauvegarde, lireSave, snapshotSave } from './persistance/save';
import { chargerSurLeBanc, sauverLeBanc } from './persistance/save.testkit';
import type { WorldMap } from './worldMap';

const mer: WorldMap = {
  id: 'mer',
  label: 'Mer',
  places: [
    { id: 'A', label: 'Départ', pos: { x: 0, y: 0 }, scene: { id: 'port-a' } },
    { id: 'B', label: 'Escale', pos: { x: 10, y: 0 }, scene: { id: 'port-b' }, port: { taille: 3, richesse: 3, production: [] } },
    { id: 'C', label: 'Destination', pos: { x: 20, y: 0 }, scene: { id: 'port-c' } },
  ],
  routes: [
    { id: 'ab', a: { id: 'A' }, b: { id: 'B' }, km: 370, modes: ['mer'], sea: true, seaHeading: 'est' },
    { id: 'bc', a: { id: 'B' }, b: { id: 'C' }, km: 5000, modes: ['mer'], sea: true, seaHeading: 'est' },
  ],
};

function monter(graine: number): Banc {
  return ouvrirLeBanc({
    graine, desFixes: true,
    etat: {
      party: tousLesHerosDeScenario(idsDeTest).slice(0, 3),
      scene: emptyScene('port-a', 2, 2),
      worldMap: mer,
      lieu: 'A',
      gameTime: 160 * MINUTES_PER_DAY + 8 * 60,
      lastUpkeepDay: 160,
      vessel: { uid: 'navire-1', vehicleId: 'cogue', morale: { score: 75, lastMoraleWeek: 0, factors: [] } },
    },
  });
}

function jouerLesTests(banc: Banc) {
  return draineCascade(banc.getState, 200, (etape) => etape.kind === 'mer-evenement-de-bord' ? 60 : 1);
}

function reprendreApresLaNuit(banc: Banc): void {
  banc.actions.fenetreValider('repos');
  banc.reprendreTout();
}

// MDG 15 l.15, l.19
it.each([
  { cas: 'avec rechargement en mer', recharger: true },
  { cas: 'sans rechargement', recharger: false },
])('épuiser le d10 à travers une semaine au port ($cas)', ({ recharger }) => {
  const banc = monter(57);
  const get = banc.getState;
  get().partirEnVoyage('ab', 'mer', { cadence: 'jourParJour' });
  const compteursAvantEscale = [];
  for (const jour of [1, 2, 3, 4]) {
    expect(jouerLesTests(banc)).not.toContain('mer-evenement-de-bord');
    compteursAvantEscale.push(get().vessel?.daysToEvent);
    if (jour < 4) {
      expect(get().travelPlan?.sea?.daysAtSea).toBe(jour);
      expect(get().pendingRest?.places.bord).toBe(true);
      if (recharger && jour === 2) {
        chargerSurLeBanc(banc, sauverLeBanc(banc));
        expect(get().vessel?.daysToEvent).toBe(5);
      }
      reprendreApresLaNuit(banc);
    }
  }
  expect(compteursAvantEscale).toEqual([6, 5, 4, 3]);
  expect(get().travelPlan).toBeNull();
  expect(get().pendingShoreLeave?.to.id).toBe('B');
  get().ensemencerLeTirage(3);
  get().fenetreChoisir('relacheATerre', 'accorder', false);
  expect(get().lieu).toBe('B');
  expect(get().vessel?.escale).toBe('B');
  expect(get().vessel?.daysToEvent).toBe(3);

  const debutEscale = get().gameTime;
  get().avancerLeTemps(minutesParSemaine());
  jouerLesTests(banc);
  expect(get().gameTime - debutEscale).toBe(minutesParSemaine());
  expect(get().vessel?.daysToEvent).toBe(3);

  get().ensemencerLeTirage(3);
  get().partirEnVoyage('bc', 'mer', { cadence: 'jourParJour' });
  const compteursApresEscale = [];
  for (const jour of [1, 2, 3]) {
    jouerLesTests(banc);
    expect(get().travelPlan?.sea?.daysAtSea).toBe(jour);
    expect(get().pendingRest?.places.bord).toBe(true);
    if (jour < 3) {
      compteursApresEscale.push(get().vessel?.daysToEvent);
      reprendreApresLaNuit(banc);
    }
  }

  expect(get().travelPlan?.log?.map((jour) => jour.events?.length ?? 0)).toEqual([0, 0, 1]);
  expect(compteursApresEscale).toEqual([2, 1]);
  expect(get().vessel?.daysToEvent).toBeGreaterThanOrEqual(1);
  expect(get().vessel?.daysToEvent).toBeLessThanOrEqual(10);
});

it('refuse le format qui persistait le compteur sur le plan de voyage (#2404)', () => {
  const banc = monter(57);
  banc.getState().partirEnVoyage('ab', 'mer', { cadence: 'jourParJour' });
  const save = snapshotSave(banc.getState(), '2026-11-20T00:00:00.000Z');
  const lue = lireSave(exporterLaSauvegarde({ ...save, version: '02b354e859c2446d' }));
  expect(typeof lue === 'string' ? lue : lue.version).toBe('autreFormat');
});

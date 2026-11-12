/**
 * LES GESTES D'EXPLORATION À L'ÉTAGE (#3775) : à l'étage de La Diligence, chaque dénivelé du bord du plancher offre un
 * geste (`gesteDeDenivele`), que `gestesDExploration` rejoint par le chemin du groupe. Tous ces chemins viennent d'un
 * seul parcours depuis la case du groupe (`cheminsDepuis`) : le travail des gestes ne croît pas avec le nombre de
 * dénivelés. Les gestes lisent la scène moins de dix fois ce que lit un parcours entier (`pathTo` vers une case hors de
 * la carte), là où un parcours par dénivelé la lisait 265 fois. Ce parcours (`cheminsDuGroupe`) et les dénivelés de
 * l'étage (`aretesUtilisables`) ne tiennent qu'à la scène et à la case du groupe (#3954) : les mêmes gestes, redemandés
 * sans que l'une ni l'autre ait changé, lisent la scène moins qu'un seul parcours. Sonde : les LECTURES de la scène
 * (Proxy, celle de `roomPortals.test.ts`).
 */
import { describe, expect, it } from 'vitest';
import { idsDeTest } from '../engine/idsDeTest.testkit';
import { createHero } from '../engine/character';
import { ouvrirLeBanc } from './banc.testkit';
import { gestesDExploration } from './gestesDExploration';
import { pathTo } from './monde/path';
import { optionsDeCheminDuGroupe } from './monde/exploreNav';
import { diligenceCampaign, paquetDuJeu } from '../scenes/campaign';
import type { Scene } from './monde/scene';

describe('les gestes d’exploration à l’étage de La Diligence', () => {
  it('tous les dénivelés de l’étage se rejoignent par un seul parcours depuis la case du groupe, fait une fois par scène et par case', () => {
    const banc = ouvrirLeBanc();
    banc.setState({ party: [createHero({ idNeuf: idsDeTest, speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', seed: 1 })], battle: null, journal: [] });
    banc.getState().lancerLaScene(paquetDuJeu(diligenceCampaign).scenes.find((sc) => sc.id === 'la-diligence')!);
    banc.setState({ partyPos: { x: 18, y: 18, z: 1 } });
    let lectures = 0;
    const scene = new Proxy(banc.getState().scene!, {
      get(cible, prop, recepteur) { lectures++; return Reflect.get(cible, prop, recepteur); },
    }) as Scene;
    const s = { ...banc.getState(), scene };

    lectures = 0;
    expect(pathTo(scene, s.partyPos, { x: -1, y: -1 }, optionsDeCheminDuGroupe(s.party)), 'une case hors de la carte : le parcours entier').toBeNull();
    const unParcours = lectures;
    lectures = 0;
    const gestes = gestesDExploration(s);
    const desGestes = lectures;

    expect(gestes.filter((g) => g.libelle.includes('depuis (')).length, 'l’étage offre des dénivelés à rejoindre').toBeGreaterThan(0);
    expect(desGestes / unParcours, `les gestes lisent la scène ${desGestes} fois, un parcours ${unParcours} fois`).toBeLessThan(10);

    lectures = 0;
    expect(gestesDExploration(s), 'la même scène, la même case : les mêmes gestes').toEqual(gestes);
    expect(lectures / unParcours, `les gestes redemandés lisent la scène ${lectures} fois, un parcours ${unParcours} fois`).toBeLessThan(1);
  });
});

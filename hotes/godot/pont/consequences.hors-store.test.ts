/**
 * LES CONSÉQUENCES PAR LE PONT (#4574 lot 3) : la rangée d'un jet de cascade publie, dans `projection.jets`, les faits
 * que son étape a appliqués, tels que Godot les reçoit en JSON.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { drainer, table } from './pont.testkit';
import type { Pont } from './pont';
import { imposerLesD100 } from '../../../src/noyau/battleRng.testkit';
import { surUnBancHorsTest } from '../../../src/noyau/banc.testkit';
import { recueillirLesRumeurs } from '../../../src/noyau/innFlow';
import { createHero } from '../../../src/engine/character';
import { idsDeTest } from '../../../src/engine/idsDeTest.testkit';
import { buildScene } from '../../../src/noyau/mapSpec';
import { ecrireLaSauvegarde } from '../../../src/hote/sauvegardes';
import { snapshotSave } from '../../../src/noyau/persistance/save';
import { applyCoupCritiqueSec, instantaneAvantLeCoup } from '../../../src/noyau/combatFlow';
import { lancerLeScenario } from '../../../src/noyau/lancementDeScenario';
import { lancementDuScenario } from '../../../src/scenes/test-scenarios/_shared';
import { testScenarios } from '../../../src/scenes/test-scenarios';
import { seedBattleRng } from '../../../src/noyau/battleRng';

let ouvert: Pont | null = null;
afterEach(() => { ouvert?.appeler('quitter'); ouvert = null; vi.restoreAllMocks(); });

describe('projection.jets[].consequences', () => {
  it('les rumeurs d’auberge ratées (EDOC 8 l.133) : l’Exténué appliqué, sur la rangée du jet', () => {
    const sauvegarde = surUnBancHorsTest((banc) => {
      const g = banc.getState;
      g().fixerLeGroupe([createHero({ idNeuf: idsDeTest, speciesId: 'humains-reiklander', careerId: 'marchand', label: 'Artur', motivation: 'x', seed: 11, id: 'h-artur' })]);
      g().chargerLeProjet({
        scenes: [buildScene({ id: 'auberge-a', label: 'Auberge du Cerf', desc: '.', size: [8, 6], terrain: 'planches', heroStart: [2, 3] })], entryId: 'auberge-a', projet: null,
        worldMap: { id: 'm', label: 'Le Reik', routes: [], places: [{ id: 'A', label: 'Auberge du Cerf', pos: { x: 0, y: 0 }, scene: { id: 'auberge-a' }, services: [{ id: 'cerf', kind: { id: 'auberge' } }] }] },
      });
      recueillirLesRumeurs(g, banc.setState, 'cerf');
      imposerLesD100(100);
      g().jetLancer('cascade');
      vi.restoreAllMocks();
      return snapshotSave(g(), '2026-11-22T20:00:00Z', {});
    });
    const { pont, appel, stockage } = table();
    ouvert = pont;
    expect(ecrireLaSauvegarde(stockage, 1, sauvegarde)).toBe(true);
    const { suite } = drainer(appel, appel('charger', { charger: 1, graine: 7 }));
    const json = JSON.parse(JSON.stringify(suite.vue.projection.jets)) as typeof suite.vue.projection.jets;
    expect(json.flatMap((j) => j.lignes.flatMap((l) => l.consequences ?? []))).toEqual([
      { genre: 'etat', valeur: 1, qui: 'h-artur', ton: 'echec', detail: { id: 'extenue' } },
    ]);
  });
});

describe('projection.fenetre.etape.consequences', () => {
  it('le Coup Critique sec d’un héros blindé (LDB 14 l.3 ; LDB 63 l.30), sans table : sa fenêtre prévoit la Localisation par son id', () => {
    const { sauvegarde, heros, lieu } = surUnBancHorsTest((banc) => {
      const g = banc.getState;
      lancerLeScenario(g, banc.setState, lancementDuScenario(testScenarios.find((sc) => sc.id === 'siege-enceinte')!, idsDeTest));
      g().fenetreValider('debutDuRound');
      banc.abandonner();
      const cible = g().battle!.combatants.find((c) => c.kind === 'heros')!;
      cible.armour = { tete: 3, brasG: 3, brasD: 3, corps: 3, jambeG: 3, jambeD: 3 };
      seedBattleRng(7);
      applyCoupCritiqueSec(g, banc.setState, cible, 11, 'double', {}, [], undefined, instantaneAvantLeCoup(cible));
      const etape = g().pendingCascade!.participants[g().pendingCascade!.cursor];
      expect(etape.deviation?.mode, 'la fenêtre du Critique pré-tiré, sans table').toBe('self');
      return { sauvegarde: snapshotSave(g(), '2026-11-23T10:00:00Z', {}), heros: cible.id, lieu: etape.deviation!.mode === 'self' ? etape.deviation!.location : null };
    });
    const { pont, appel, stockage } = table();
    ouvert = pont;
    expect(ecrireLaSauvegarde(stockage, 1, sauvegarde)).toBe(true);
    const { suite } = drainer(appel, appel('charger', { charger: 1, graine: 7 }));
    const etape = JSON.parse(JSON.stringify(suite.vue.projection.fenetre?.etape)) as NonNullable<typeof suite.vue.projection.fenetre>['etape'];
    expect(etape?.genre).toBe('deviation');
    expect(etape?.consequences?.[0]).toEqual({ genre: 'localisation', valeur: lieu, qui: heros, ton: 'echec' });
  });
});

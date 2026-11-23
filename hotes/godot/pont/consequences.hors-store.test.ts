/**
 * LES CONSÉQUENCES PAR LE PONT (#4574 lot 3) : la rangée d'un jet publie, dans `projection.jets`, les faits que son
 * étape a appliqués, ou que sa fenêtre prévoit, tels que Godot les reçoit en JSON.
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
import { cascadeDeTest } from '../../../src/noyau/cascade.testkit';
import type { Weapon } from '../../../src/engine/types';

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

describe('projection.jets[].consequences : la prévision d’attaque', () => {
  it('la touche de Taille tranchée, avant sa validation : la Localisation par son id et l’armure entamée (LDB 62 l.307)', () => {
    const { sauvegarde, cible } = surUnBancHorsTest((banc) => {
      const g = banc.getState;
      lancerLeScenario(g, banc.setState, lancementDuScenario(testScenarios.find((sc) => sc.id === 'siege-enceinte')!, idsDeTest));
      g().fenetreValider('debutDuRound');
      banc.abandonner();
      const heros = g().battle!.combatants.find((c) => c.kind === 'heros')!;
      const ennemi = g().battle!.combatants.find((c) => c.kind !== 'heros')!;
      heros.weapons = [{ label: 'Hache', type: 'melee', hand: 'main', damage: { plusBF: true, flat: 0, bare: true }, qualities: [{ id: 'taille' }] } as Weapon];
      banc.setState({
        pendingAttack: { attackerId: heros.id, targetId: ennemi.id, location: null, result: {
          hit: true, attackerRoll: 23, netSL: 2, location: 'corps', damage: 5, woundsLost: 1, critical: false, advantageTo: null, defenderDefeated: false, log: 'Touché',
          attackerDetail: { label: 'Corps à corps', target: 45, roll: 23, sl: 2, success: true } as never,
        } },
        pendingCascade: cascadeDeTest([{ id: 'attack-jet', kind: 'jetDAttaque', jet: 'attaque', actorId: heros.id }], { title: 'Attaque', icon: 'action/attaquer', purpose: 'combat' }),
      });
      return { sauvegarde: snapshotSave(g(), '2026-11-23T12:00:00Z', {}), cible: ennemi.id };
    });
    const { pont, appel, stockage } = table();
    ouvert = pont;
    expect(ecrireLaSauvegarde(stockage, 1, sauvegarde)).toBe(true);
    const { suite } = drainer(appel, appel('charger', { charger: 1, graine: 7 }));
    const json = JSON.parse(JSON.stringify(suite.vue.projection.jets)) as typeof suite.vue.projection.jets;
    const consequences = json.find((j) => j.flux === 'attaque')?.lignes[0]?.consequences;
    expect(consequences).toContainEqual({ genre: 'localisation', valeur: 'corps', qui: cible, ton: 'reussite' });
    expect(consequences).toContainEqual({ genre: 'objet', valeur: -1, qui: cible, ton: 'reussite', detail: { objet: { armure: 'corps' }, issue: 'usee' } });
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

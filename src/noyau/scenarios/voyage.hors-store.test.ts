import { idsDeTest } from '../../engine/idsDeTest.testkit';
import { describe, it, beforeEach, expect, afterEach } from 'vitest';
import { ouvrirLeBanc, type Banc } from '../banc.testkit';
import { poserLesRegles, resetRule } from '../../engine/policy';
import { seedBattleRng } from '../../noyau/battleRng';
import { distributeCredit } from '../../noyau/bourseFlow';
import { interludeCatalog } from '../../noyau/interludeFlow';
import { draineCascade } from '../../noyau/cascade.testkit';
import { scenario } from '../../scenes/test-scenarios/voyage';

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });
const scenarioConstruit = scenario.construire(idsDeTest);

/** Les 5 sous-scènes sont produites par `buildScene(MapSpec)` (WorldMap/extraScenes restent sur
 *  le TestScenario). Ce bloc verrouille l'équivalence en jeu des Scenes PRODUITES : dimensions, terrain,
 *  météo/repos, entités/dialogues déclaratifs, et l'embuscade cachée (members + hiddenUntilCombat). */
describe('16-voyage — Scenes produites par buildScene', () => {
  const byId = (id: string) => [scenarioConstruit.scene, ...(scenarioConstruit.extraScenes ?? [])].find((s) => s.id === id)!;

  it('produit les 5 sous-scènes attendues (village + 4 extra), la scène d’entrée = le village', () => {
    expect(scenarioConstruit.scene.id).toBe('test-voyage-village');
    expect((scenarioConstruit.extraScenes ?? []).map((s) => s.id)).toEqual([
      'test-voyage-hameau', 'test-voyage-bourg', 'test-voyage-cite', 'test-voyage-embuscade',
    ]);
  });

  it('village : 14×9, pluie, auberge, départ (3,4), aubergiste + dialogue', () => {
    const v = byId('test-voyage-village');
    expect(v.dimensions).toEqual({ w: 14, h: 9 });
    expect(v.weather).toBe('pluie');
    expect(v.rest).toEqual({ auberge: true });
    expect(v.entities.find((e) => e.kind === 'heroStart')?.pos).toEqual({ x: 3, y: 4 });
    expect(v.entities.find((e) => e.id === 'aubergiste')?.dialogueId).toEqual({ id: 'dlg-auberge' });
    expect(v.dialogues.find((d) => d.id === 'dlg-auberge')).toBeTruthy();
  });

  it('cité : cercle runique + trigger d’interlude (rect 5,3,3×3)', () => {
    const c = byId('test-voyage-cite');
    expect(c.entities.find((e) => e.id === 'cercle')?.decor?.id).toBe('cercle-runique');
    const interlude = c.triggers.find((t) => t.id === 'interlude')!;
    expect(interlude.rect).toEqual({ x: 5, y: 3, w: 3, h: 3 });
  });

  it('embuscade : 2 gobelins cachés (hiddenUntilCombat) + rencontre surprise « party »', () => {
    const e = byId('test-voyage-embuscade');
    const enc = e.encounters.find((x) => x.id === 'enc-vembuscade')!;
    expect(enc.surprise).toBe('groupe');
    expect(enc.members).toEqual([{ entityId: 'enemy-enc-vembuscade-0' }, { entityId: 'enemy-enc-vembuscade-1' }]);
    const gobs = e.entities.filter((x) => x.creature?.id === 'gobelin');
    expect(gobs).toHaveLength(2);
    expect(gobs.every((g) => g.combat?.hiddenUntilCombat === true)).toBe(true);
    expect(gobs.map((g) => g.pos)).toEqual([{ x: 9, y: 3 }, { x: 10, y: 5 }]);
  });
});

describe('16-voyage — intégration Voyage par Étapes', () => {
  afterEach(() => resetRule('voyage-etapes'));
  it('règle pré-activée → postes résolus, véhicule à coque bâti, météo d’Étape journalisée', () => {
    poserLesRegles(scenario.rules ?? {});
    seedBattleRng(7);
    banc.getState().fixerLeGroupe(scenario.construire(idsDeTest).party);
    // La LONGUE route part du hameau : on entre à p-hameau pour la prendre en diligence.
    banc.getState().chargerLeProjet({ scenes: [scenarioConstruit.scene, ...(scenarioConstruit.extraScenes ?? [])], entryId: 'test-voyage-hameau', worldMap: scenarioConstruit.worldMap!, projet: null });
    if (scenario.money) distributeCredit(banc.getState, banc.setState, scenario.money); // bourses du groupe (SOCLE POSSESSIONS #531)
    banc.getState().partirEnVoyage('r-longue', 'diligence', { classeId: 'exterieur' });
    const plan = banc.getState().travelPlan;
    expect(plan?.vehicle?.bodyShape).toBe('vehicule'); // diligence E45/B50
    // Les jets d'Étape du jour sont une cascade influençable (`travelDay`) : la drainer pour que les
    // lignes de postes/Exposition arrivent au journal (comme la halte de nuit du fluvial).
    draineCascade(banc.getState);
    const j = banc.getState().journal;
    expect(j.some((l) => l.includes('Météo'))).toBe(true);
    // Postes résolus : leurs conséquences arrivent au journal en lignes STRUCTURÉES (batch #328 + #295) —
    // Exténué DÉRIVÉ de l'op, carte d'itinéraire (Test étendu cumulé), ou ration fourragée à l'agrégation.
    expect(j.some((l) => l.includes('Exténué') || l.includes('itinéraire') || l.includes('ration'))).toBe(true);
  });
});

describe('16-voyage — lieu « altdorf » : Activités d’Altdorf (ACE Annexe I, #96) atteignables à l’arrivée', () => {

  it('la cité d’arrivée (Altdorf) est le lieu `altdorf` de la carte du monde', () => {
    expect(scenarioConstruit.worldMap!.places.find((p) => p.scene.id === 'test-voyage-cite')?.id).toBe('altdorf');
  });

  it('interludeCatalog : à Altdorf, les Activités gatées `where:[altdorf]` sont proposées', () => {
    banc.setState({ lieu: 'altdorf', worldMap: scenarioConstruit.worldMap, massBattle: null });
    const cat = interludeCatalog(banc.getState());
    expect(cat.some((d) => d.id === 'penitence')).toBe(true);
    expect(cat.some((d) => d.id === 'entrainement-arme-inhabituelle')).toBe(true);
  });

  it('hors d’Altdorf (autre lieu du même voyage), ces Activités disparaissent du catalogue', () => {
    banc.setState({ lieu: 'p-village', worldMap: scenarioConstruit.worldMap, massBattle: null });
    const cat = interludeCatalog(banc.getState());
    expect(cat.some((d) => d.id === 'penitence')).toBe(false);
  });
});

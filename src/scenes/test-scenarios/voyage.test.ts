import { describe, it, expect, afterEach } from 'vitest';
import { useGame } from '../../state/store';
import { setRule, resetRule } from '../../engine/policy';
import { seedBattleRng } from '../../state/battleRng';
import { distributeCredit } from '../../state/bourseFlow';
import { currentPlaceId, interludeCatalog } from '../../state/interludeFlow';
import { draineCascade } from '../../state/cascadeTestKit';
import { scenario } from './voyage';
const scenarioConstruit = scenario.construire();

/** Les 5 sous-scènes sont désormais produites par `buildScene(MapSpec)` (WorldMap/extraScenes restent sur
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
    expect(v.entities.find((e) => e.id === 'aubergiste')?.dialogueId).toBe('dlg-auberge');
    expect(v.dialogues.find((d) => d.id === 'dlg-auberge')).toBeTruthy();
  });

  it('cité : cercle runique + trigger d’interlude (rect 5,3,3×3)', () => {
    const c = byId('test-voyage-cite');
    expect(c.entities.find((e) => e.id === 'cercle')?.ref).toBe('cercle-runique');
    const interlude = c.triggers.find((t) => t.id === 'interlude')!;
    expect(interlude.rect).toEqual({ x: 5, y: 3, w: 3, h: 3 });
  });

  it('embuscade : 2 gobelins cachés (hiddenUntilCombat) + rencontre surprise « party »', () => {
    const e = byId('test-voyage-embuscade');
    const enc = e.encounters.find((x) => x.id === 'enc-vembuscade')!;
    expect(enc.surprise).toBe('party');
    expect(enc.members).toEqual([{ entityId: 'enemy-enc-vembuscade-0' }, { entityId: 'enemy-enc-vembuscade-1' }]);
    const gobs = e.entities.filter((x) => x.ref === 'gobelin');
    expect(gobs).toHaveLength(2);
    expect(gobs.every((g) => g.combat?.hiddenUntilCombat === true)).toBe(true);
    expect(gobs.map((g) => g.pos)).toEqual([{ x: 9, y: 3 }, { x: 10, y: 5 }]);
  });
});

describe('16-voyage — intégration Voyage par Étapes', () => {
  afterEach(() => resetRule('travel-etapes'));
  it('règle pré-activée → postes résolus, véhicule à coque bâti, météo d’Étape journalisée', () => {
    for (const [id, v] of Object.entries(scenario.rules ?? {})) setRule(id, v as any);
    seedBattleRng(7);
    useGame.getState().setParty(scenario.construire().party);
    // La LONGUE route part du hameau : on entre à p-hameau pour la prendre en diligence.
    useGame.getState().loadProject([scenarioConstruit.scene, ...(scenarioConstruit.extraScenes ?? [])], 'test-voyage-hameau', scenarioConstruit.worldMap!);
    if (scenario.money) distributeCredit(useGame.getState, useGame.setState, scenario.money); // bourses du groupe (SOCLE POSSESSIONS #531)
    useGame.getState().startTravel('r-longue', 'diligence', { classeId: 'exterieur' });
    const plan = useGame.getState().travelPlan;
    expect(plan?.vehicle?.bodyShape).toBe('vehicule'); // diligence E45/B50
    // Les jets d'Étape du jour sont une cascade influençable (`travelDay`) : la drainer pour que les
    // lignes de postes/Exposition arrivent au journal (comme la halte de nuit du fluvial).
    draineCascade(useGame.getState);
    const j = useGame.getState().journal;
    expect(j.some((l) => l.includes('Météo'))).toBe(true);
    // Postes résolus : leurs conséquences arrivent au journal en lignes STRUCTURÉES (batch #328 + #295) —
    // Exténué DÉRIVÉ de l'op, carte d'itinéraire (Test étendu cumulé), ou ration fourragée à l'agrégation.
    expect(j.some((l) => l.includes('Exténué') || l.includes('itinéraire') || l.includes('ration'))).toBe(true);
  });
});

describe('16-voyage — lieu « altdorf » : Activités d’Altdorf (ACE Annexe I, #96) atteignables à l’arrivée', () => {
  const byId = (id: string) => [scenarioConstruit.scene, ...(scenarioConstruit.extraScenes ?? [])].find((s) => s.id === id)!;

  it('la cité d’arrivée (Altdorf) est le lieu `altdorf` de la carte du monde', () => {
    expect(scenarioConstruit.worldMap!.places.find((p) => p.scene === 'test-voyage-cite')?.id).toBe('altdorf');
  });

  it('currentPlaceId + interludeCatalog : arrivé à Altdorf, les Activités gatées `where:[altdorf]` sont proposées', () => {
    const cite = byId('test-voyage-cite');
    useGame.setState({ scene: cite, worldMap: scenarioConstruit.worldMap, massBattle: null });
    expect(currentPlaceId(useGame.getState())).toBe('altdorf');
    const cat = interludeCatalog(useGame.getState());
    expect(cat.some((d) => d.id === 'penitence')).toBe(true);
    expect(cat.some((d) => d.id === 'entrainement-arme-inhabituelle')).toBe(true);
  });

  it('hors d’Altdorf (autre scène du même voyage), ces Activités disparaissent du catalogue', () => {
    const village = byId('test-voyage-village');
    useGame.setState({ scene: village, worldMap: scenarioConstruit.worldMap, massBattle: null });
    expect(currentPlaceId(useGame.getState())).not.toBe('altdorf');
    const cat = interludeCatalog(useGame.getState());
    expect(cat.some((d) => d.id === 'penitence')).toBe(false);
  });
});

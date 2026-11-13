import { idsDeTest } from '../../engine/idsDeTest.testkit';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ouvrirLeBanc, type Banc } from '../banc.testkit';
import { runFlow } from '../../noyau/combatEffects';
import { idsDuJeu, poserLesRegles, resetRule } from '../../engine/policy';
import { seedBattleRng } from '../../noyau/battleRng';
import { hasTalent } from '../../engine/magic';
import type { SkillInstance } from '../../engine/types';
import { scenario } from '../../scenes/test-scenarios/18-effets-scriptes';
import { draineCascade } from '../../noyau/cascade.testkit';

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });
const scenarioConstruit = scenario.construire(idsDeTest);

/**
 * « Effets scriptés » (#96/#97) : chaque `it` prouve qu'un déclencheur RÉEL du scénario (dialogue,
 * décor interactif, trigger de zone) fait tourner un moteur déjà testé isolément, jusqu'à l'état
 * observable — quatre interactions indépendantes, chacune UNE fois (rien à répéter).
 */
describe('Scénario « Effets scriptés » : moteurs orphelins câblés à un déclencheur réel', () => {
  const scene = scenarioConstruit.scene;

  beforeEach(() => {
    banc.setState({ battle: null, flags: {}, journal: [], mode: 'exploration', scene, party: scenario.construire(idsDeTest).party });
    poserLesRegles(scenario.rules ?? {});
  });
  afterEach(() => { for (const id of idsDuJeu(scenario.rules ?? {})) resetRule(id); });

  it('medicalAid : le dialogue du médecin ouvre l’infirmerie payante (entityId → PNJ, tarif à l’acte)', () => {
    const choice = scene.dialogues.find((d) => d.id === 'dlg-medecin')!.nodes[0].choices[0];
    runFlow(banc.getState, banc.setState, choice.flow!);
    const medic = banc.getState().medic;
    expect(medic?.npc?.id).toBe('medecin');
    expect(medic?.npc?.acts.map((a) => a.act)).toEqual(['blessures', 'hemorragie']);
    expect(medic?.npc?.acts[0].cost).toEqual({ silver: 5 });
  });

  it('petitePriere : l’autel exauce un non-Béni (option `priere-petites`, seuil relevé par la Compétence Prière)', () => {
    const p = banc.getState().party.find((h) => !hasTalent(h, 'beni'))!;
    expect(p).toBeTruthy(); // au moins un non-Béni chez les pré-tirés
    const sk = p.skills.find((s) => s.id === 'priere');
    if (sk) sk.advances = 200; else p.skills.push({ id: 'priere', characteristic: 'sociabilite', advances: 200 } as SkillInstance);
    p.xp = 0;
    banc.setState({ party: [...banc.getState().party] });
    const autel = scene.entities.find((e) => e.id === 'autel')!;
    seedBattleRng(1);
    runFlow(banc.getState, banc.setState, autel.usable!.actions![0].flow);
    expect(banc.getState().party.find((h) => h.id === p.id)!.xp).toBe(20); // reward authoré (giveXp)
    expect(banc.getState().journal.join('\n')).toMatch(/entend/);
  });

  it('ambitionLost : le dialogue du messager anéantit une Ambition → Trauma (Calme Accessible échoué)', () => {
    const hero = banc.getState().party[0];
    hero.characteristics = { ...hero.characteristics, 'force-mentale': 10 }; // Calme Accessible (+20) → cible basse, échec garanti à la graine 1
    banc.setState({ party: [...banc.getState().party] });
    seedBattleRng(1);
    const choice = scene.dialogues.find((d) => d.id === 'dlg-messager')!.nodes[0].choices[0];
    runFlow(banc.getState, banc.setState, choice.flow!);
    expect(banc.getState().party[0].psychTraits).toEqual([{ type: 'trauma' }]);
  });

  it('fall + inflictTrauma : la trappe vermoulue chute (dégâts/m réduits par le BE), blesse, et repositionne le groupe', () => {
    const trig = scene.triggers.find((t) => t.id === 'trappe-cave')!;
    banc.setState({ partyPos: { x: 9, y: 5 } });
    const before = banc.getState().party[0].wounds.current;
    seedBattleRng(1);
    runFlow(banc.getState, banc.setState, trig.flow);
    draineCascade(banc.getState); // le 1d10 des Dégâts de chute passe par la porte (#1508)
    const h = banc.getState().party[0];
    expect(h.wounds.current).toBeLessThan(before); // 3 Dégâts/m (3 m) + 1d10, réduits par le BE
    expect(h.traumas?.length ?? 0).toBeGreaterThan(0); // Blessure Critique (déchirure) posée
    expect(h.criticalWounds).toBe(1);
    expect(banc.getState().partyPos).toEqual({ x: 9, y: 6 }); // repositionné hors de la trappe (LDB 15 l.78-84)
  });

  it('anti-grind : les quatre déclencheurs sont chacun UNE interaction unique (aucune mécanique à répéter)', () => {
    expect(scene.dialogues.find((d) => d.id === 'dlg-medecin')!.nodes).toHaveLength(1);
    expect(scene.dialogues.find((d) => d.id === 'dlg-messager')!.nodes).toHaveLength(1);
    expect(scene.entities.find((e) => e.id === 'autel')!.usable!.actions![0].consume).toBe(false); // ré-utilisable mais l'issue est jouée en 1 jet
    expect(scene.triggers.find((t) => t.id === 'trappe-cave')!.once).toBe(true); // une seule chute possible
  });
});

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { useGame } from '../../state/store';
import { runFlow } from '../../state/combatEffects';
import { setRule, resetRule } from '../../engine/policy';
import { seedBattleRng } from '../../state/battleRng';
import { hasTalent } from '../../engine/magic';
import type { SkillInstance } from '../../engine/types';
import { scenario } from './18-effets-scriptes';
import { draineCascade } from '../../state/cascadeTestKit';

/**
 * « Effets scriptés » (#96/#97) : chaque `it` prouve qu'un déclencheur RÉEL du scénario (dialogue,
 * décor interactif, trigger de zone) fait tourner un moteur déjà testé isolément, jusqu'à l'état
 * observable — quatre interactions indépendantes, chacune UNE fois (rien à répéter).
 */
describe('Scénario « Effets scriptés » : moteurs orphelins câblés à un déclencheur réel', () => {
  const scene = scenario.scene;

  beforeEach(() => {
    useGame.setState({ battle: null, flags: {}, journal: [], mode: 'exploration', scene, party: scenario.makeParty() });
    for (const [id, v] of Object.entries(scenario.rules ?? {})) setRule(id, v as never);
  });
  afterEach(() => { for (const id of Object.keys(scenario.rules ?? {})) resetRule(id); });

  it('medicalAid : le dialogue du médecin ouvre l’infirmerie payante (entityId → PNJ, tarif à l’acte)', () => {
    const choice = scene.dialogues.find((d) => d.id === 'dlg-medecin')!.nodes[0].choices[0];
    runFlow(useGame.getState, useGame.setState, choice.flow!);
    const medic = useGame.getState().medic;
    expect(medic?.npc?.id).toBe('medecin');
    expect(medic?.npc?.acts.map((a) => a.act)).toEqual(['wounds', 'bleed']);
    expect(medic?.npc?.acts[0].cost).toEqual({ silver: 5 });
  });

  it('petitePriere : l’autel exauce un non-Béni (option `prayer-petites`, seuil relevé par la Compétence Prière)', () => {
    const p = useGame.getState().party.find((h) => !hasTalent(h, 'beni'))!;
    expect(p).toBeTruthy(); // au moins un non-Béni chez les pré-tirés
    const sk = p.skills.find((s) => s.id === 'priere');
    if (sk) sk.advances = 200; else p.skills.push({ id: 'priere', characteristic: 'sociabilite', advances: 200 } as SkillInstance);
    p.xp = 0;
    useGame.setState({ party: [...useGame.getState().party] });
    const autel = scene.entities.find((e) => e.id === 'autel')!;
    seedBattleRng(1);
    runFlow(useGame.getState, useGame.setState, autel.usable!.actions![0].flow);
    expect(useGame.getState().party.find((h) => h.id === p.id)!.xp).toBe(20); // reward authoré (giveXp)
    expect(useGame.getState().journal.join('\n')).toMatch(/entend/);
  });

  it('ambitionLost : le dialogue du messager anéantit une Ambition → Trauma (Calme Accessible échoué)', () => {
    const hero = useGame.getState().party[0];
    hero.characteristics = { ...hero.characteristics, 'force-mentale': 10 }; // Calme Accessible (+20) → cible basse, échec garanti à la graine 1
    useGame.setState({ party: [...useGame.getState().party] });
    seedBattleRng(1);
    const choice = scene.dialogues.find((d) => d.id === 'dlg-messager')!.nodes[0].choices[0];
    runFlow(useGame.getState, useGame.setState, choice.flow!);
    expect(useGame.getState().party[0].psychTraits).toEqual([{ type: 'trauma' }]);
  });

  it('fall + inflictTrauma : la trappe vermoulue chute (dégâts/m réduits par le BE), blesse, et repositionne le groupe', () => {
    const trig = scene.triggers.find((t) => t.id === 'trappe-cave')!;
    useGame.setState({ partyPos: { x: 9, y: 5 } });
    const before = useGame.getState().party[0].wounds.current;
    seedBattleRng(1);
    runFlow(useGame.getState, useGame.setState, trig.flow);
    draineCascade(useGame.getState); // le 1d10 des Dégâts de chute passe par la porte (#1508)
    const h = useGame.getState().party[0];
    expect(h.wounds.current).toBeLessThan(before); // 3 Dégâts/m (3 m) + 1d10, réduits par le BE
    expect(h.traumas?.length ?? 0).toBeGreaterThan(0); // Blessure Critique (déchirure) posée
    expect(h.criticalWounds).toBe(1);
    expect(useGame.getState().partyPos).toEqual({ x: 9, y: 6 }); // repositionné hors de la trappe (LDB 15 l.78-84)
  });

  it('anti-grind : les quatre déclencheurs sont chacun UNE interaction unique (aucune mécanique à répéter)', () => {
    expect(scene.dialogues.find((d) => d.id === 'dlg-medecin')!.nodes).toHaveLength(1);
    expect(scene.dialogues.find((d) => d.id === 'dlg-messager')!.nodes).toHaveLength(1);
    expect(scene.entities.find((e) => e.id === 'autel')!.usable!.actions![0].consume).toBe(false); // ré-utilisable mais l'issue est jouée en 1 jet
    expect(scene.triggers.find((t) => t.id === 'trappe-cave')!.once).toBe(true); // une seule chute possible
  });
});

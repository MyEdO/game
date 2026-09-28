import { flowEffects, EMPTY_FLOW, type Flow } from '../../state/flow';
import { describe, it, expect, beforeEach } from 'vitest';
import { validateScene } from '../../state/validateScene';
import { isWalkable, layerTiles, type Effect } from '../../state/scene';
import { pathTo } from '../../state/path';
import { useGame } from '../../state/store';
import { applyEffects } from '../../state/combatEffects';
import { createHero } from '../../engine/character';
import { scenario } from './opera';
const scenarioConstruit = scenario.construire();

/**
 * La salle est désormais COMPILÉE depuis un `MapSpec` par `buildScene` (headless-editor) : la grille
 * reste authorée en ASCII (une par étage), la logique d'intrigue vit dans `triggers`/`dialogues`, et le
 * roster de la rencontre optionnelle est attaché à la scène produite. Ce bloc verrouille l'ÉQUIVALENCE
 * de la Scene produite : dimensions/couches/tuiles/hauteurs/entités attendues, comme l'ancienne plomberie
 * impérative les posait (mêmes choix : '#'/'D' en tuiles pleines, scène +1 m, rampes 0→1→2 m, étage à 2 m).
 */
describe('Scénario « Opéra — Théâtre » : Scene produite par buildScene(MapSpec)', () => {
  const scene = scenarioConstruit.scene;
  const idx = (x: number, y: number) => y * scene.dimensions.w + x;

  it('a l’id/nom/dimensions/ambiance attendus (scalaires du spec)', () => {
    expect(scene.id).toBe('test-opera-theatre');
    expect(scene.label).toBe('Opéra — Le théâtre');
    expect(scene.dimensions).toEqual({ w: 21, h: 17 });
    expect(scene.ambiance).toBe('interieur');
  });

  it('pose le mur/porte en TUILE PLEINE (choix conservé : # → mur, D → porte, base z0 = mur)', () => {
    const t0 = layerTiles(scene, 0);
    expect(t0[idx(0, 0)]).toBe('mur'); // char '#' → mur
    expect(t0[idx(4, 4)]).toBe('porte'); // char 'D' (porte de scène gauche)
    expect(t0[idx(1, 5)]).toBe('mur'); // '.' du bord parterre → base 'mur'
    expect(t0[idx(5, 5)]).toBe('marbre'); // parterre
    expect(t0[idx(6, 2)]).toBe('plancher'); // scène
    // aucune arête de mur : la géométrie de jeu reste des tuiles pleines, pas des murs d'arête
    expect(scene.walls ?? []).toHaveLength(0);
  });

  it('reproduit les hauteurs métriques : scène +1 m, rampes d’angle 0→1→2 m, étage z1 à 2 m', () => {
    const h0 = scene.layers.find((l) => l.z === 0)!.height!;
    const h1 = scene.layers.find((l) => l.z === 1)!.height!;
    // scène surélevée (rect x5..15, y2..4)
    expect(h0[idx(5, 2)]).toBe(1);
    expect(h0[idx(15, 4)]).toBe(1);
    expect(h0[idx(4, 2)]).toBe(0); // coulisse voisine au sol
    // rampes jumelles : haut 2 m (y13), bas 1 m (y14), plat ailleurs
    for (const x of [1, 2, 18, 19]) {
      expect(h0[idx(x, 13)]).toBe(2);
      expect(h0[idx(x, 14)]).toBe(1);
    }
    expect(h0[idx(10, 8)]).toBe(0); // parterre au sol
    // étage entier à 2 m
    expect(h1.every((v) => v === 2)).toBe(true);
  });

  it('porte l’intrigue dans les champs du spec : trigger d’armement, dialogue gaté, rencontre roster', () => {
    // le trigger d'intrigue (recopié tel quel) est présent avec sa zone et son once
    const arm = scene.triggers.find((t) => t.id === 'armer-bombe')!;
    expect(arm).toBeDefined();
    expect(arm.rect).toEqual({ x: 4, y: 5, w: 13, h: 8 });
    expect(arm.once).toBe(true);
    // la plante piégée (interact avec test) est bien une entité posée sur z1
    const plante = scene.entities.find((e) => e.id === 'plante-bombe')!;
    expect(plante.z).toBe(1);
    expect(plante.usable?.actions?.[0].flow.kind).toBe('test');
    // le dialogue gaté de la Comtesse est présent (branche `when: flag bombeDesamorcee`)
    const dlg = scene.dialogues.find((d) => d.id === 'dlg-comtesse')!;
    expect(dlg.nodes[0].choices.some((c) => c.when?.kind === 'flag' && c.when.expr === 'bombeDesamorcee')).toBe(true);
    // la rencontre optionnelle enrôle les DEUX étudiants pré-posés (members → entités existantes)
    const enc = scene.encounters.find((e) => e.id === 'enc-etudiants')!;
    expect(enc.members?.map((m) => m.entityId)).toEqual(['etudiant-1', 'etudiant-2']);
    for (const id of ['etudiant-1', 'etudiant-2']) expect(scene.entities.some((e) => e.id === id)).toBe(true);
  });

  it('passe validateScene sans erreur (avertissements tolérés)', () => {
    const errors = validateScene([scene]).filter((w) => w.level === 'error');
    expect(errors).toEqual([]);
  });

  it('est bien multi-niveaux : parterre (z0) + galerie de loges (z1)', () => {
    expect(scene.layers.map((l) => l.z).sort()).toEqual([0, 1]);
    // la loge royale (galerie, z1) est marchable
    expect(isWalkable(scene, 10, 13, 1)).toBe(true);
    // le parterre est marchable au sol
    expect(isWalkable(scene, 10, 8, 0)).toBe(true);
    // une case « vide » d'étage (au-dessus du parterre central) reste infranchissable
    expect(isWalkable(scene, 10, 8, 1)).toBe(false);
  });

  it('le mobilier et les PNJ sont posés à leur étage (entités z=1 présentes)', () => {
    const upper = scene.entities.filter((e) => (e.z ?? 0) === 1);
    expect(upper.length).toBeGreaterThan(5);
    // la Comtesse siège dans la loge royale (z1)
    const comtesse = scene.entities.find((e) => e.id === 'comtesse')!;
    expect(comtesse.z).toBe(1);
    expect(comtesse.kind).toBe('personnage');
    // tout prop/PNJ d'étage référence un niveau existant
    const zs = new Set(scene.layers.map((l) => l.z));
    for (const e of scene.entities) expect(zs.has(e.z ?? 0)).toBe(true);
  });

  it('la loge royale est ATTEIGNABLE depuis l’entrée par l’escalier (pathfinding 3D)', () => {
    const start = scene.entities.find((e) => e.kind === 'heroStart')!.pos;
    // depuis le vestibule, on doit traverser le hall, monter un escalier (z change) et gagner la loge royale
    const path = pathTo(scene, { x: start.x, y: start.y, z: 0 }, { x: 10, y: 13, z: 1 }, { blocked: new Set<string>() });
    expect(path).not.toBeNull();
    expect(path!.some((p) => (p.z ?? 0) === 1)).toBe(true);
  });

  it('la scène est accessible depuis le parterre (plan connexe au sol)', () => {
    const start = scene.entities.find((e) => e.kind === 'heroStart')!.pos;
    expect(pathTo(scene, { x: start.x, y: start.y }, { x: 10, y: 3 }, { blocked: new Set<string>() })).not.toBeNull();
  });
});

describe('Opéra — Théâtre : intrigue n°1 (la bombe de la loge royale)', () => {
  const arm = scenarioConstruit.scene.triggers.find((t) => t.id === 'armer-bombe')!;
  const plante = scenarioConstruit.scene.entities.find((e) => e.id === 'plante-bombe')!;
  const detect = plante.usable!.actions![0].flow as Extract<Flow, { kind: 'test' }>;
  /** Le nœud Test « voleur » niché dans le flow du delayedEffect des pétards (à 20h30). */
  const spotNode = (): Extract<Flow, { kind: 'test' }> => {
    const petards = flowEffects(arm.flow).find((e): e is Extract<Effect, { type: 'delayedEffect' }> => e.type === 'delayedEffect' && e.afterMinutes === 10)!;
    const steps = petards.flow.kind === 'seq' ? petards.flow.steps : [petards.flow];
    return steps.find((s) => s.kind === 'test') as Extract<Flow, { kind: 'test' }>;
  };

  beforeEach(() => useGame.setState({ battle: null, flags: {}, scheduledEffects: [], gameTime: 20 * 60, partyPos: { x: 10, y: 14, z: 1 } }));
  function lonePartyAt(wounds: number) {
    const h = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'A', seed: 1 });
    h.wounds = { current: wounds, max: wounds };
    useGame.setState({ party: [h] });
    return h;
  }

  it('la plante piégée est posée dans la loge royale (z1) et se détecte mieux avec la Poudre noire', () => {
    expect(plante.z).toBe(1);
    expect(detect.test.easierIf?.hasSkill).toEqual({ id: 'projectiles', spec: 'poudre-noire' });
  });

  it('entrer dans l’auditorium baisse les lumières et programme la soirée (pétards + mèche)', () => {
    lonePartyAt(35);
    applyEffects(useGame.getState, useGame.setState, flowEffects(arm.flow));
    expect(useGame.getState().lightLevel).toBe(0.35); // les lumières baissent (mise en scène)
    expect(useGame.getState().scheduledEffects).toHaveLength(3); // pétards (10), retour lumière (11), bombe (60)
  });

  it('retirer le détonateur empêche l’explosion finale', () => {
    const before = lonePartyAt(35).wounds.current;
    applyEffects(useGame.getState, useGame.setState, flowEffects(arm.flow));
    applyEffects(useGame.getState, useGame.setState, flowEffects(detect.success)); // désamorçage
    useGame.getState().advanceTime(120);
    expect(useGame.getState().party[0].wounds.current).toBe(before); // intacte (pétards à l'écart, bombe annulée)
  });

  it('les pétards (intrigue n°2) éclatent à 20h30 : flash puis pénombre rétablie', () => {
    lonePartyAt(35);
    applyEffects(useGame.getState, useGame.setState, flowEffects(arm.flow));
    useGame.getState().advanceTime(10); // 20h30 : la mèche éclaire, les pétards éclatent
    expect(useGame.getState().lightLevel).toBe(0.8); // flash
    useGame.getState().advanceTime(1); // la salle se rassoit
    expect(useGame.getState().lightLevel).toBe(0.35);
  });

  it('le spot-check Glimbrin (intrigue n°2) a ses deux issues (clés sauves / volées)', () => {
    const spot = spotNode();
    expect(spot.test.skill).toEqual({ id: 'perception' });
    lonePartyAt(35);
    applyEffects(useGame.getState, useGame.setState, flowEffects(spot.fail));
    expect(useGame.getState().flags.clesVolees).toBe(true);
    applyEffects(useGame.getState, useGame.setState, flowEffects(spot.success));
    expect(useGame.getState().flags.glimbrinDejoue).toBe(true);
  });

  it('la Comtesse remercie si la bombe a été déjouée (branche gatée par flag)', () => {
    const dlg = scenarioConstruit.scene.dialogues.find((d) => d.id === 'dlg-comtesse')!;
    const grateful = dlg.nodes.find((n) => n.id === 'n0')!.choices.find((c) => c.when?.kind === 'flag' && c.when.expr === 'bombeDesamorcee');
    expect(grateful?.next).toBe('merci');
    const merci = dlg.nodes.find((n) => n.id === 'merci')!;
    expect(merci.choices[0].flow && flowEffects(merci.choices[0].flow).some((e) => e.type === 'giveMoney')).toBe(true);
  });

  it('chaque intrigue résolue récompense les PX canoniques (50 / 15 / 10)', () => {
    const xpIn = (effs: Effect[] | undefined) =>
      (effs ?? []).filter((e): e is Extract<Effect, { type: 'giveXp' }> => e.type === 'giveXp').reduce((n, e) => n + e.amount, 0);
    expect(xpIn(flowEffects(detect.success))).toBe(50); // bombe déjouée (l.275)
    expect(xpIn(flowEffects(spotNode().success))).toBe(15); // vol de clés empêché (l.297)
    expect(xpIn(flowEffects(scenarioConstruit.scene.encounters.find((e) => e.id === 'enc-etudiants')!.onVictory ?? EMPTY_FLOW))).toBe(10); // étudiants arrêtés (l.277)
  });

  it('confronter les étudiants offre un combat optionnel (les arrêter)', () => {
    const enc = scenarioConstruit.scene.encounters.find((e) => e.id === 'enc-etudiants')!;
    expect(enc.members?.map((m) => m.entityId)).toEqual(['etudiant-1', 'etudiant-2']);
    const dlg = scenarioConstruit.scene.dialogues.find((d) => d.id === 'dlg-etudiants')!;
    const fight = dlg.nodes.flatMap((n) => n.choices).flatMap((c) => c.flow ? flowEffects(c.flow) : []);
    expect(fight.some((e) => e.type === 'startCombat' && e.encounter === 'enc-etudiants')).toBe(true);
  });

  it('sans désamorçage, l’explosion frappe l’antichambre au bout de la mèche', () => {
    const before = lonePartyAt(35).wounds.current;
    applyEffects(useGame.getState, useGame.setState, flowEffects(arm.flow));
    useGame.getState().advanceTime(60);
    expect(useGame.getState().party[0].wounds.current).toBeLessThanOrEqual(before - 15);
  });
});

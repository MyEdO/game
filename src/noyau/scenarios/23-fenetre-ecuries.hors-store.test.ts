import { idsDeTest } from '../../engine/idsDeTest.testkit';
import { describe, it, expect, beforeEach } from 'vitest';
import { emptyScene, heightAt, isWalkable, porteMasquee, startOf, type WallSeg } from '../../noyau/monde/scene';
import { validateScene } from '../../noyau/validateScene';
import { planFranchissement } from '../../noyau/fallMove';
import { scenePlanDefects } from '../../noyau/planDefects';
import { portesDeLaPiece } from '../../noyau/monde/decouvertePorteSecrete';
import { roomFocusAt } from '../../noyau/monde/rooms';
import { reachableCells } from '../../noyau/mapQC';
import { ouvrirLeBanc, type Banc } from '../banc.testkit';
import { avanceEtapeCascade } from '../../noyau/cascade.testkit';
import { scenario } from '../../scenes/test-scenarios/23-fenetre-ecuries';
import { poserLeGroupe } from '../../noyau/marcheDuGroupe';

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });

/**
 * « La fenêtre sur les écuries » : la croisée d'étage (EDO 01 l.229-231) et la porte secrète du bureau
 * (EDO 08 l.404) se lisent sur la Scène PRODUITE par `buildScene`, par les coutures du moteur.
 */
describe('Scénario « La fenêtre sur les écuries »', () => {
  const scene = scenario.construire(idsDeTest).scene;
  const couloir = { x: 7, y: 2, z: 1 };
  const ecuries = { x: 8, y: 2 };
  const porte = (): WallSeg => scene.walls!.find((w) => w.x === 3 && w.y === 2 && w.side === 'E' && w.z === 1)!;

  it('la scène parse : validateScene sans erreur', () => {
    expect(validateScene([scene]).filter((w) => w.level === 'error')).toEqual([]);
  });

  it('la cachette, close par la seule porte secrète, est atteignable pour l’auteur (EDO 08 l.404)', () => {
    const inatteignables = (sc: typeof scene) => validateScene([sc]).filter((w) => w.message.includes('inatteignable à pied')).map((w) => w.message);
    expect(inatteignables(scene)).toEqual([]);
    // Opposé : la même arête en mur nu, la cachette est réellement close — signalée.
    const muree = { ...scene, walls: scene.walls!.map((w) => (w === porte() ? { x: w.x, y: w.y, side: w.side, z: w.z } : w)) };
    expect(inatteignables(muree)).toEqual([expect.stringContaining('« Cachette »')]);
  });

  it('aucun défaut de plan (`scenePlanDefects` vide)', () => {
    expect(scenePlanDefects(scene)).toEqual([]);
  });

  it('la croisée du couloir : saut de 4 m (hauteur réelle de la carte), se suspendre = 2 m', () => {
    expect(heightAt(scene, couloir.x, couloir.y, 1) - heightAt(scene, ecuries.x, ecuries.y, 0)).toBe(4);
    expect(planFranchissement(scene, couloir, ecuries)).toEqual({ kind: 'fall', metres: 4, to: { x: 8, y: 2, z: 0 }, suspendu: 2, allege: 1 });
  });

  it('des écuries, on remonte à pied au couloir (porte de la salle basse + escalier)', () => {
    expect(reachableCells(scene, { x: 8, y: 2, z: 0 }).has('7,6,1')).toBe(true);
  });

  it('la porte secrète est masquée, et Fouiller le bureau la vise', () => {
    expect(porteMasquee(scene, porte())).toBe(true);
    const bureau = roomFocusAt(scene, { x: 2, y: 2, z: 1 })!;
    expect(bureau.id).toBe('bureau');
    expect(portesDeLaPiece(scene, bureau)).toEqual([porte()]);
  });

  it('la cachette ne la vise pas (face non découvrable)', () => {
    expect(portesDeLaPiece(scene, roomFocusAt(scene, { x: 4, y: 2, z: 1 })!)).toEqual([]);
  });

  it('le départ du groupe est hors de la zone d’approche ; entrer au bureau en vue de la face ouvre le Test (Complexe)', () => {
    banc.setState({ party: scenario.construire(idsDeTest).party });
    banc.getState().lancerLaScene(scene);
    banc.setState({ lightLevel: 1 });
    expect(startOf(scene)).toEqual({ x: 7, y: 6, z: 1 });
    expect(banc.getState().pendingTest).toBeNull();
    banc.setState({ partyPos: { x: 1, y: 3, z: 1 } });
    poserLeGroupe(banc.getState, banc.setState, { x: 2, y: 2, z: 1 });
    const pt = banc.getState().pendingTest!;
    expect(pt.sujet?.skill?.id).toBe('perception');
    expect(pt.difficulty).toBe('complexe');
  });

  it('le groupe démarre à l’ÉTAGE du départ authored (`startOf`), par `lancerLaScene` comme par `quitterLaScene`', () => {
    banc.setState({ party: scenario.construire(idsDeTest).party });
    banc.getState().lancerLaScene(scene);
    expect(banc.getState().partyPos).toEqual({ x: 7, y: 6, z: 1 });
    banc.getState().lancerLaScene(emptyScene('depart-sans-etage'));
    banc.getState().quitterLaScene(scene.id);
    expect(banc.getState().partyPos).toEqual({ x: 7, y: 6, z: 1 });
  });

  it('la rencontre `enc-homme-de-main` s’ouvre par le dialogue de l’homme de main, à l’étage', () => {
    const homme = scene.entities.find((e) => e.id === 'homme-de-main')!;
    expect(homme.z).toBe(1);
    expect(scene.encounters.find((e) => e.id === 'enc-homme-de-main')?.members).toEqual([{ entityId: 'homme-de-main' }]);
    const dlg = scene.dialogues.find((d) => d.id === homme.dialogueId?.id)!;
    expect(JSON.stringify(dlg)).toContain('"encounter":"enc-homme-de-main"');
  });

  beforeEach(() => banc.setState({ battle: null, flags: {}, pendingTest: null, dialogue: null }));
});

describe('Scénario « La fenêtre sur les écuries » — formation de début de combat', () => {
  const scene = scenario.construire(idsDeTest).scene;
  /** Ouvre la rencontre de l'homme de main, le groupe en `partyPos` ; rend les cases des héros. */
  function formation(partyPos: { x: number; y: number; z?: number }) {
    banc.setState({ party: scenario.construire(idsDeTest).party });
    banc.getState().lancerLaScene(scene);
    banc.setState({ partyPos });
    banc.getState().lancerLeCombat('enc-homme-de-main');
    return banc.getState().battle!.combatants.filter((c) => c.kind === 'heros' && !c.mountable).map((c) => c.pos!);
  }

  for (const depart of [{ x: 7, y: 6, z: 1 }, { x: 6, y: 2, z: 1 }]) {
    it(`à l’étage, groupe en (${depart.x},${depart.y}) : chaque héros tient debout sur une case DISTINCTE du plancher de z1`, () => {
      const cases = formation(depart);
      expect(cases.length).toBeGreaterThan(1);
      for (const p of cases) {
        expect(p.z, `(${p.x},${p.y}) hors de l’étage`).toBe(1);
        expect(isWalkable(scene, p.x, p.y, 1), `(${p.x},${p.y},1) sans plancher`).toBe(true);
      }
      expect(new Set(cases.map((p) => `${p.x},${p.y}`)).size, 'deux héros sur la même case').toBe(cases.length);
    });
  }

  it('au rez, la colonne voisine du groupe tient sur le sol : la formation reste la colonne (x − 1, y + i)', () => {
    const cases = formation({ x: 9, y: 0, z: 0 });
    expect(cases).toEqual(cases.map((_, i) => ({ x: 8, y: i })));
  });
});

describe('Scénario « La fenêtre sur les écuries » — l’homme de main se bat à SON étage (#2139)', () => {
  const scene = scenario.construire(idsDeTest).scene;

  it('il s’approche sur le plancher de z1 et frappe un héros de l’étage', () => {
    const g = banc.getState;
    banc.setState({ party: scenario.construire(idsDeTest).party });
    g().lancerLaScene(scene);
    banc.setState({ partyPos: { x: 7, y: 6, z: 1 } });
    g().lancerLeCombat('enc-homme-de-main');
    const homme = () => g().battle!.combatants.find((c) => c.id === 'homme-de-main')!;
    expect(homme().pos!.z).toBe(1);
    for (let i = 0; i < 80 && !g().pendingDefense; i++) {
      if (g().pendingRoundStart) g().fenetreValider('debutDuRound');
      while (g().pendingCascade) avanceEtapeCascade(g);
      const b = g().battle!;
      const actif = b.combatants.find((c) => c.id === b.order[b.turn]);
      if (actif?.kind === 'heros') g().terminerLeTour();
      banc.avancer(1000);
      expect(homme().pos!.z, `tour ${i} : l’homme de main a quitté l’étage`).toBe(1);
    }
    const def = g().pendingDefense!;
    expect(def.attackerId).toBe('homme-de-main');
    const cible = g().battle!.combatants.find((c) => c.id === def.defenderId)!;
    expect(cible.pos!.z).toBe(1);
    expect(homme().pos!.z).toBe(1);
  });
});

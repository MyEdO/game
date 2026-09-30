import { describe, it, expect, beforeEach } from 'vitest';
import { emptyScene, heightAt, porteMasquee, startOf, type WallSeg } from '../../state/scene';
import { validateScene } from '../../state/validateScene';
import { planFranchissement } from '../../state/fallMove';
import { scenePlanDefects } from '../../state/planDefects';
import { portesDeLaPiece } from '../../state/decouvertePorteSecrete';
import { roomFocusAt } from '../../state/rooms';
import { reachableCells } from '../../state/mapQC';
import { useGame } from '../../state/store';
import { scenario } from './23-fenetre-ecuries';

/**
 * « La fenêtre sur les écuries » : la croisée d'étage (EDO 01 l.229-231) et la porte secrète du bureau
 * (EDO 08 l.402) se lisent sur la Scène PRODUITE par `buildScene`, par les coutures du moteur.
 */
describe('Scénario « La fenêtre sur les écuries »', () => {
  const scene = scenario.construire().scene;
  const couloir = { x: 7, y: 2, z: 1 };
  const ecuries = { x: 8, y: 2 };
  const porte = (): WallSeg => scene.walls!.find((w) => w.x === 3 && w.y === 2 && w.side === 'E' && w.z === 1)!;

  it('la scène parse : validateScene sans erreur', () => {
    expect(validateScene([scene]).filter((w) => w.level === 'error')).toEqual([]);
  });

  it('aucun défaut de plan (`scenePlanDefects` vide)', () => {
    expect(scenePlanDefects(scene)).toEqual([]);
  });

  it('la croisée du couloir : saut de 4 m (hauteur réelle de la carte), se suspendre = 2 m', () => {
    expect(heightAt(scene, couloir.x, couloir.y, 1) - heightAt(scene, ecuries.x, ecuries.y, 0)).toBe(4);
    expect(planFranchissement(scene, couloir, ecuries)).toEqual({ kind: 'fall', metres: 4, to: { x: 8, y: 2, z: 0 }, suspendu: 2, croisee: true });
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
    useGame.setState({ party: scenario.construire().party });
    useGame.getState().startScene(scene);
    useGame.setState({ lightLevel: 1 });
    expect(startOf(scene)).toEqual({ x: 7, y: 6, z: 1 });
    expect(useGame.getState().pendingTest).toBeNull();
    useGame.setState({ partyPos: { x: 1, y: 3, z: 1 } });
    useGame.getState().moveParty({ x: 2, y: 2, z: 1 });
    const pt = useGame.getState().pendingTest!;
    expect(pt.skillId).toBe('perception');
    expect(pt.difficulty).toBe('complexe');
  });

  it('le groupe démarre à l’ÉTAGE du départ authored (`startOf`), par `startScene` comme par `transitionTo`', () => {
    useGame.setState({ party: scenario.construire().party });
    useGame.getState().startScene(scene);
    expect(useGame.getState().partyPos).toEqual({ x: 7, y: 6, z: 1 });
    useGame.getState().startScene({ ...emptyScene(), id: 'depart-sans-etage' });
    useGame.getState().transitionTo(scene.id);
    expect(useGame.getState().partyPos).toEqual({ x: 7, y: 6, z: 1 });
  });

  it('la rencontre `enc-homme-de-main` s’ouvre par le dialogue de l’homme de main, à l’étage', () => {
    const homme = scene.entities.find((e) => e.id === 'homme-de-main')!;
    expect(homme.z).toBe(1);
    expect(scene.encounters.find((e) => e.id === 'enc-homme-de-main')?.members).toEqual([{ entityId: 'homme-de-main' }]);
    const dlg = scene.dialogues.find((d) => d.id === homme.dialogueId)!;
    expect(JSON.stringify(dlg)).toContain('"encounter":"enc-homme-de-main"');
  });

  beforeEach(() => useGame.setState({ battle: null, flags: {}, pendingTest: null, dialogue: null }));
});

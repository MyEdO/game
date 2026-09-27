/**
 * GARDE ABSOLUE (#1869) — tout dialogue d'une scène a un OUVREUR dans cette scène.
 *
 * Un dialogue s'ouvre par la capacité « parler » d'une entité (`dialogueId`, `store.ts`) ou par un
 * effet dont le handler déclare `ouvreDialogue` (`combatEffects.ts`) ; le runtime le cherche dans la
 * scène COURANTE. Un dialogue qu'aucun ouvreur ne cite est injouable : `validateScene` en avertit
 * l'éditeur, et aucun contenu livré n'en porte.
 *
 * ABSOLUE : aucun stock, aucune exemption — le compte attendu est ZÉRO, et la garde NOMME ses sites.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';
import { listerProjetsLivres } from '../../scripts/guards/lib/projetsLivres.mjs';
import { parseProject } from '../state/worldMap';
import { avisDialogueJamaisOuvert, validateScene, type Warning } from '../state/validateScene';
import { emptyScene, type Scene } from '../state/scene';
import { flowFromEffects } from '../state/flow';
import { testScenarios } from './test-scenarios';

const jamaisOuverts = (ws: Warning[]) =>
  ws.filter((w) => w.refId && w.message === avisDialogueJamaisOuvert(w.refId)).map((w) => `${w.sceneId} › ${w.refId}`);

const projetsLivres = listerProjetsLivres()
  .map((rel) => parseProject(JSON.parse(readFileSync(join(__dirname, rel), 'utf8'))));

describe('#1869 — un dialogue sans ouvreur est injouable', () => {
  it('aucun scénario de test ni projet livré ne porte de dialogue jamais ouvert', () => {
    const trouves = [
      ...testScenarios.flatMap((s) => jamaisOuverts(validateScene([s.scene, ...(s.extraScenes ?? [])], s.worldMap))),
      ...projetsLivres.flatMap((doc) => jamaisOuverts(validateScene(doc.scenes, doc.worldMap))),
    ];
    expect(trouves, 'donner le dialogue à une entité, l’ouvrir par un effet, ou le supprimer').toEqual([]);
  });

  // COUVERTURE du détecteur, sur un projet jouet : sans elle, le vert ci-dessus ne dirait rien.
  const dialogue = (id: string) => ({ id, start: 'n', nodes: [{ id: 'n', desc: '…', choices: [] }] });
  const projet = (over: Partial<Scene>): Scene[] => [{ ...emptyScene(), id: 'jouet', dialogues: [dialogue('d')], ...over }];

  it('un dialogue que rien n’ouvre sort en AVERTISSEMENT, nommé', () => {
    const w = validateScene(projet({})).filter((x) => x.message === avisDialogueJamaisOuvert('d'));
    expect(w).toEqual([expect.objectContaining({ level: 'warn', scope: 'dialogue', sceneId: 'jouet', refId: 'd' })]);
  });

  it('la capacité « parler » d’une entité l’ouvre', () => {
    const entities: Scene['entities'] = [{ id: 'pnj', kind: 'personnage', ref: 'humain', pos: { x: 1, y: 1 }, dialogueId: 'd' }];
    expect(jamaisOuverts(validateScene(projet({ entities })))).toEqual([]);
  });

  it('un effet « Ouvrir un dialogue », même au fond d’un AUTRE dialogue, l’ouvre', () => {
    const accueil = { id: 'a', start: 'n', nodes: [{ id: 'n', desc: '…', choices: [{ label: 'Suite', flow: flowFromEffects([{ type: 'startDialogue', dialogue: 'd' }]) }] }] };
    const entities: Scene['entities'] = [{ id: 'pnj', kind: 'personnage', ref: 'humain', pos: { x: 1, y: 1 }, dialogueId: 'a' }];
    expect(jamaisOuverts(validateScene(projet({ entities, dialogues: [accueil, dialogue('d')] })))).toEqual([]);
  });
});

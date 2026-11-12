/**
 * #3059 — écrivains d'un dialogue : renommer le dialogue suit ses ouvreurs, renommer un nœud refuse un
 * doublon et suit chaque `next`, supprimer un nœud coupe les `next` qui le visent et refuse le départ.
 * Chaque résultat passe `validateScene` sans faute de dialogue.
 */
import { describe, it, expect } from 'vitest';
import { emptyScene, type Dialogue, type Scene, type SceneEntity } from './monde/scene';
import { addDialogueNode, removeDialogueNode, renameDialogue, renameDialogueNode } from './sceneEdit';
import { validateScene } from './validateScene';

const dialogue = (): Dialogue => ({
  id: 'd1', start: { id: 'n1' },
  nodes: [
    { id: 'n1', desc: 'un', choices: [{ id: 'choix-1', label: 'vers deux', next: { id: 'n2' } }] },
    { id: 'n2', desc: 'deux', choices: [{ id: 'choix-1', label: 'encore', next: { id: 'n2' } }, { id: 'choix-2', label: 'retour', next: { id: 'n1' } }] },
    { id: 'n3', desc: 'trois', choices: [] },
  ],
});
const ouvrir = (id: string) => ({ kind: 'effet' as const, effet: { type: 'startDialogue' as const, dialogue: { id } } });
const scene = (): Scene => ({
  ...emptyScene('scene-test', 8, 8),
  entities: [{ id: 'pnj', kind: 'personnage', creature: { id: 'humain' }, pos: { x: 1, y: 1 }, label: 'Aubergiste', dialogueId: { id: 'd1' } } as SceneEntity],
  triggers: [{ id: 't1', rect: { x: 0, y: 0, w: 1, h: 1 }, once: true, flow: { kind: 'sequence', etapes: [ouvrir('d1')] } }],
  dialogues: [dialogue(), { id: 'd2', start: { id: 'n1' }, nodes: [{ id: 'n1', desc: 'autre', choices: [{ id: 'choix-1', label: 'autre', flow: ouvrir('d1') }] }] }],
});
const fautesDeDialogue = (s: Scene) => validateScene([s]).filter((w) => w.level === 'error' && /dialogue/i.test(w.message)).map((w) => w.message);
const avec = (d: Dialogue): Scene => ({ ...scene(), dialogues: [d, scene().dialogues[1]] });

describe('renameDialogue', () => {
  it('suit le `dialogueId` des entités et chaque effet « Ouvrir un dialogue », un choix d’un autre dialogue compris', () => {
    const s = renameDialogue(scene(), 'd1', ' d-auberge ');
    expect(s.dialogues.map((d) => d.id)).toEqual(['d-auberge', 'd2']);
    expect(s.entities[0].dialogueId).toEqual({ id: 'd-auberge' });
    expect(s.triggers[0].flow).toEqual({ kind: 'sequence', etapes: [ouvrir('d-auberge')] });
    expect(s.dialogues[1].nodes[0].choices[0].flow).toEqual(ouvrir('d-auberge'));
    expect(fautesDeDialogue(s)).toEqual([]);
  });

  it('refuse un id vide, un id porté par un autre dialogue et un dialogue absent : scène inchangée', () => {
    const s = scene();
    for (const [from, to] of [['d1', '  '], ['d1', 'd2'], ['absent', 'neuf']]) expect(renameDialogue(s, from, to)).toBe(s);
  });
});

describe('écrivains de nœud', () => {
  it('addDialogueNode : un id frais `n<k>` qu’aucun nœud ne porte', () => {
    const out = addDialogueNode(dialogue());
    expect(out.id).toBe('n4');
    expect(out.dialogue.nodes[out.dialogue.nodes.length - 1]).toEqual({ id: 'n4', choices: [] });
  });

  it('renameDialogueNode : suit le départ et chaque `next`, la boucle sur soi comprise', () => {
    const d = renameDialogueNode(dialogue(), 'n1', 'accueil');
    expect(d.start).toEqual({ id: 'accueil' });
    expect(d.nodes.map((n) => n.id)).toEqual(['accueil', 'n2', 'n3']);
    expect(d.nodes[1].choices.map((c) => c.next)).toEqual([{ id: 'n2' }, { id: 'accueil' }]);
    const boucle = renameDialogueNode(dialogue(), 'n2', 'deux');
    expect(boucle.nodes[1].choices.map((c) => c.next)).toEqual([{ id: 'deux' }, { id: 'n1' }]);
    expect(fautesDeDialogue(avec(d))).toEqual([]);
    expect(fautesDeDialogue(avec(boucle))).toEqual([]);
  });

  it('renameDialogueNode : refuse un id vide ou déjà porté par un autre nœud — dialogue inchangé', () => {
    const d = dialogue();
    expect(renameDialogueNode(d, 'n2', 'n1')).toBe(d);
    expect(renameDialogueNode(d, 'n2', ' ')).toBe(d);
  });

  it('removeDialogueNode : coupe chaque `next` qui visait le nœud, le choix mène à la fin', () => {
    const d = removeDialogueNode(dialogue(), 'n2');
    expect(d.nodes.map((n) => n.id)).toEqual(['n1', 'n3']);
    expect(d.nodes[0].choices).toEqual([{ id: 'choix-1', label: 'vers deux' }]);
    expect(fautesDeDialogue(avec(d))).toEqual([]);
  });

  it('removeDialogueNode : refuse le nœud de départ, que `dialogueSchema.start` exige', () => {
    const d = dialogue();
    expect(removeDialogueNode(d, 'n1')).toBe(d);
  });
});

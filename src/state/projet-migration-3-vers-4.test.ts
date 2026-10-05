/**
 * GARDE — `PROJECT_MIGRATIONS[3]` : un projet AUTHORÉ AVANT le lot #1467 L1b V-P2 se charge encore.
 *
 * QUESTION : la forme du document de projet a changé (rôles de prose — `scenes[].description` →
 * `desc`, `DialogueNode.text` → `desc`, `DialogueChoice.text` → `label`, `text` des effets
 * `journal`/`document`/`setObjective` → `desc`, `meta.description` → `desc`, prose absente = clé
 * absente). Un `.json` exporté avant ce lot, resté dans une bibliothèque utilisateur, traverse-t-il
 * encore `parseProject` ?
 *
 * FIXTURE GELÉE : le document ci-dessous est extrait du dépôt à `caa16f23a` (l'arbre AVANT le lot) et
 * réduit à ce que la migration touche. Il est FIGÉ — le mettre à jour à la forme courante détruirait
 * ce que la garde mesure. Chaque porteur de rôle y est représenté AU MOINS une fois.
 */
import { describe, expect, it } from 'vitest';
import { parseProject, CURRENT_PROJECT_SCHEMA } from './worldMap';

/** Document schema 3 — FIGÉ. Ne pas « moderniser » : c'est le sujet de la mesure. */
const PROJET_FORMAT_3 = {
  schema: 3,
  meta: { id: 'campagne-gelee', label: 'Campagne gelée', version: 1, description: 'Prose de campagne, format 3.' },
  narratif: { affaires: [], indices: [], presetsPnj: [], objets: [] },
  scenes: [
    {
      id: 'quai',
      nom: 'Le quai',
      description: 'Un quai de chargement, format 3.',
      dimensions: { w: 4, h: 4 },
      layers: [{ z: 0, tiles: new Array(16).fill('plancher') }],
      entities: [
        {
          id: 'louve', kind: 'personnage', ref: 'loup-imperial', pos: { x: 1, y: 1 }, label: 'La Louve',
          // Snapshot d'`ItemInstance` embarqué : `desc: null` était la prose ABSENTE du format 3.
          postes: [{
            trappingId: 'canon-moyen', uid: 'poste-1', side: 'tribord', crewIds: [],
            ammo: [{ uid: 'ammo-1', trappingId: 'boulet-et-poudre', label: 'Boulet et poudre', kind: 'ammo', qualities: [], enc: 1, equipped: false, qty: 1, desc: null }],
          }],
        },
      ],
      dialogues: [
        {
          id: 'dlg',
          start: 'n1',
          nodes: [
            {
              id: 'n1',
              text: 'Le maître de quai vous toise.',
              choices: [
                { text: 'Le saluer', next: 'n2' },
                {
                  text: 'Insister',
                  flow: {
                    kind: 'seq',
                    steps: [
                      { kind: 'do', effect: { type: 'journal', text: 'Il hausse les épaules.' } },
                      { kind: 'do', effect: { type: 'document', title: 'Ordre de mission', text: 'Par ordre du baron…' } },
                      { kind: 'do', effect: { type: 'setObjective', id: 'obj-1', text: 'Trouver le baron' } },
                    ],
                  },
                },
              ],
            },
            { id: 'n2', text: 'Il grogne.', choices: [] },
          ],
        },
      ],
      triggers: [],
      encounters: [],
      flags: {},
    },
  ],
};

describe('PROJECT_MIGRATIONS[3] — un projet format 3 se charge à travers la migration (#1467 L1b)', () => {
  it('le document gelé est bien au format ANTÉRIEUR (sans quoi la garde ne mesurerait rien)', () => {
    expect(PROJET_FORMAT_3.schema).toBe(3);
    expect(PROJET_FORMAT_3.schema).toBeLessThan(CURRENT_PROJECT_SCHEMA);
    expect(PROJET_FORMAT_3.scenes[0]).toHaveProperty('description');
    expect(PROJET_FORMAT_3.scenes[0].dialogues[0].nodes[0]).toHaveProperty('text');
  });

  it('il se charge VERT, et chaque rôle de prose ressort sous sa clé courante', () => {
    const doc = parseProject(structuredClone(PROJET_FORMAT_3));
    const scene = doc.scenes[0];
    expect(scene.desc).toBe('Un quai de chargement, format 3.');
    expect(scene).not.toHaveProperty('description');
    // La prose de campagne ressort à la RACINE : la chaîne traverse aussi `PROJECT_MIGRATIONS[4]`,
    // qui aplatit la poche `meta` (#1467 L1b V-formeProjet).
    expect(doc.desc).toBe('Prose de campagne, format 3.');

    const node = scene.dialogues[0].nodes[0];
    expect(node.desc).toBe('Le maître de quai vous toise.');
    expect(node).not.toHaveProperty('text');
    expect(node.choices.map((c) => c.label)).toEqual(['Le saluer', 'Insister']);

    const steps = (node.choices[1].flow as { steps: { effect: Record<string, unknown> }[] }).steps;
    expect(steps.map((s) => s.effect)).toEqual([
      { type: 'journal', desc: 'Il hausse les épaules.' },
      { type: 'document', documentId: 'document-ordre-de-mission' },
      { type: 'setObjective', id: 'obj-1', desc: 'Trouver le baron' },
    ]);
    // Le texte du document, rebaptisé `desc` par cette migration, est SOULEVÉ au registre par
    // `PROJECT_MIGRATIONS[17]` (#679) : la chaîne entière le mène à `narratif.documents`.
    expect(doc.narratif.documents).toEqual([{ id: 'document-ordre-de-mission', titre: 'Ordre de mission', prose: 'Par ordre du baron…' }]);

    // Prose ABSENTE = clé absente : le `desc: null` du snapshot embarqué ne survit pas.
    const ammo = (scene.entities[0] as unknown as { postes: { ammo: Record<string, unknown>[] }[] }).postes[0].ammo[0];
    expect('desc' in ammo).toBe(false);
  });

  it('la migration ne DÉSARME pas le schéma : une clé inconnue reste REFUSÉE', () => {
    const fautif = structuredClone(PROJET_FORMAT_3) as Record<string, unknown>;
    (fautif.scenes as Record<string, unknown>[])[0].champInvente = 'poison';
    expect(() => parseProject(fautif)).toThrow(/champInvente/);
  });
});

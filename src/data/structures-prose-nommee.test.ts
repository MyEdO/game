import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { scannerDonnees } from '../../scripts/docs/lib/structures-scan.mjs';
import { sceneFlowSchema } from './schemas/defs-scenes/effets';
import { projetSchema } from './schemas/defs-scenes/projet';

const GRAMMAIRE = resolve(__dirname, 'schemas/grammaire/mecanique.ts');
const PROJET = 'sonde-prose-projet.json';
const CATALOGUE = 'sonde-prose-catalogue.json';

describe('le scan suit les déclarations de prose du schéma des projets', () => {
  it('classe les proses déclarées avec leur provenance et conserve les autres porteurs', () => {
    const adapteDe = { book: 'ennemi-dans-l-ombre', page: 12 };
    const descRef = {
      book: 'ennemi-dans-l-ombre', ch: '01',
      parts: [{ kind: 'blocs', sec: 'le-proprietaire', secOcc: 2, b0: 0, b1: 0, sum: '38e48aee36c04e9f' }],
    };
    const journal = { type: 'journal', desc: 'Journal.' };
    const objectif = { type: 'setObjective', id: 'objectif-sonde', desc: 'Objectif.' };
    const faveur = { type: 'grantFavor', level: 'mineure', owedTo: 'Créancier', desc: 'Faveur.' };
    const narration = { op: 'narrative', text: 'Narration.' };
    const sansSuite = { kind: 'sequence', etapes: [] };
    const choix = {
      kind: 'choix', invite: 'Poursuivre ?',
      oui: {
        kind: 'sequence',
        etapes: [
          ...[journal, objectif, faveur].flatMap((effet) => [
            { kind: 'effet', effet },
            { kind: 'effet', effet: { ...effet, adapteDe } },
          ]),
          { kind: 'effet', effet: { type: 'journal', descRef } },
          { kind: 'effet', effet: { type: 'ops', ops: [narration, { ...narration, adapteDe }] } },
          { kind: 'effet', effet: { type: 'startMassBattle', battle: { puissanceAlliee: 50, puissanceEnnemie: 50, terrain: 'Terrain.' } } },
          { kind: 'effet', effet: { type: 'designerHeros', etat: 'heros-sonde', invite: 'Désigner un héros.', adapteDe } },
          {
            kind: 'test',
            test: { skill: { id: 'crochetage' }, difficulty: 'intermediaire', stake: { authored: 'Enjeu.' } },
            reussite: sansSuite, echec: sansSuite,
          },
        ],
      },
    };
    const projet = {
      type: 'projet', id: 'projet-sonde', label: 'Sonde', maison: 'Projet de test.', versionContenu: 1,
      narratif: {
        affaires: [], indices: [], presetsPnj: [], objets: [], documents: [],
        etats: [{ id: 'heros-sonde', label: 'Héros', maison: 'État de test.', forme: { kind: 'heros' } }],
        ouverture: { titre: 'Ouverture', pitch: 'Accroche.' },
      },
      scenes: [{
        type: 'scene', id: 'scene-sonde', label: 'Scène', dimensions: { w: 4, h: 4 },
        reliefDefaults: { cliff: { id: 'terre' }, ramp: { id: 'terre' }, deck: { id: 'pierre' }, pilier: { id: 'pilier' } },
        roofDefaults: { material: { id: 'toit-ardoise' }, pitchDeg: 45, riseMaxStoreys: 1 },
        triggers: [{ id: 'trigger-sonde', rect: { x: 0, y: 0, w: 1, h: 1 }, flow: choix }],
        dialogues: [{
          id: 'dialogue-sonde', start: { id: 'depart' },
          nodes: [
            { id: 'depart', desc: 'Réplique.', choices: [{ id: 'reponse', label: 'Répondre', next: { id: 'fin' } }] },
            { id: 'fin', desc: 'Réplique adaptée.', adapteDe, choices: [] },
            { id: 'adresse', descRef, choices: [] },
          ],
        }],
      }],
      worldMap: {
        id: 'carte-sonde', label: 'Carte', routes: [],
        places: [
          { id: 'lieu-prose', label: 'Lieudit', pos: { x: 0, y: 0 }, scene: { id: 'scene-sonde' }, prose: 'Lieu décrit.' },
          { id: 'lieu-nu', label: 'Autre lieu', pos: { x: 2, y: 2 }, scene: { id: 'scene-sonde' } },
        ],
      },
    };
    const valide = projetSchema.safeParse(projet);
    expect(valide.success, valide.error?.message).toBe(true);

    const dossier = mkdtempSync(join(tmpdir(), 'structures-prose-nommee-'));
    try {
      const grammaire = join(dossier, 'src/data/schemas/grammaire');
      mkdirSync(grammaire, { recursive: true });
      mkdirSync(join(dossier, 'src/scenes'), { recursive: true });
      copyFileSync(GRAMMAIRE, join(grammaire, 'mecanique.ts'));
      const [scene] = projet.scenes;
      writeFileSync(join(dossier, 'src/scenes', PROJET), JSON.stringify({
        ...projet,
        scenes: [{
          ...scene,
          triggers: [
            ...scene.triggers,
            {
              id: 'trigger-leurre', rect: { x: 2, y: 2, w: 1, h: 1 },
              flow: { kind: 'effet', effet: { type: 'journal', adapteDe } },
            },
          ],
        }],
        horsSchema: [
          { effet: journal }, { effet: { ...journal, adapteDe } }, { effet: { adapteDe } },
          { ops: [narration, { ...narration, adapteDe }] },
          { flow: { kind: 'choix', invite: 'Homonyme.', oui: sansSuite } },
        ],
      }));
      writeFileSync(join(dossier, 'src/data', CATALOGUE), JSON.stringify({ flow: choix }));
      const { formes } = scannerDonnees(dossier, [
        { file: PROJET, root: 'src/scenes', famille: 'config', schema: projetSchema },
        { file: CATALOGUE, root: 'src/data', famille: 'config', schema: z.strictObject({ flow: sceneFlowSchema }) },
      ]);
      expect(formes.filter((f) => f.concept === 'prose-nommee').map(
        (f) => [f.dataset, f.champ, f.strate, f.signature, f.statut, f.occurrences],
      )).toEqual([
        [PROJET, 'battle', 'Document', 'texte+…', 'cible', 1],
        [PROJET, 'effet', 'Document', 'texte+…', 'cible', 7],
        [PROJET, 'flow', 'Document', 'texte+…', 'cible', 1],
        [PROJET, 'nodes', 'Document', 'texte+…', 'cible', 3],
        [PROJET, 'ops', 'Document', 'texte+…', 'cible', 2],
        [PROJET, 'places', 'Document', 'texte+…', 'cible', 1],
        [PROJET, 'stake', 'Document', 'texte', 'cible', 1],
      ]);
      expect(formes.filter((f) => f.dataset === PROJET && ['ouverture', 'effet-d-etat'].includes(f.concept)).map(
        (f) => [f.concept, f.champ, f.signature, f.statut, f.occurrences],
      )).toEqual([
        ['effet-d-etat', 'effet', 'etat,invite,type+…', 'cible', 1],
        ['ouverture', 'ouverture', 'pitch,titre', 'cible', 1],
      ]);
    } finally {
      rmSync(dossier, { recursive: true, force: true });
    }
  });
});

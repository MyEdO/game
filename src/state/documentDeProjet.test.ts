/**
 * `documentDeProjet` est L'ENVELOPPE que l'application écrit — la SEULE, partagée par les trois
 * sorties d'un projet (« Enregistrer »/« Exporter JSON » de l'éditeur, import de fichier à la
 * bibliothèque, export d'une entrée) et par les générateurs de campagne (`projectDoc`,
 * `scripts/campagne/lib.mjs`). Ce que ce banc tient : l'ORDRE des clés, celui des paquets GÉNÉRÉS
 * (figé à l'octet par `src/scenes/generateurs-byte-stables.test.ts`), et le fait qu'une clé
 * optionnelle non fournie ne s'écrive PAS — un `worldMap: undefined` posé se lirait « carte
 * effacée » au diff du document.
 */
import { describe, it, expect } from 'vitest';
import { documentDeProjet, parseProject, type ProjectIdentite } from './worldMap';
import { emptyScene, type Scene } from './scene';
import { emptyNarratif } from './campaignNarratif';

const IDENTITE: ProjectIdentite = {
  type: 'projet',
  id: 'proj-banc',
  label: 'Campagne du banc',
  versionContenu: 3,
  maison: 'fixture de test',
};

const SCENES = (): Scene[] => [{ ...emptyScene(4, 4), id: 'scene-banc', label: 'Salle du banc' }];

describe('documentDeProjet — l’enveloppe UNIQUE du document de projet', () => {
  it('écrit `id`, `type`, `label` EN TÊTE, puis le reste de l’identité, `narratif`, `scenes` — aucun numéro de forme', () => {
    const doc = documentDeProjet(IDENTITE, SCENES(), { narratif: emptyNarratif() });
    expect(Object.keys(doc)).toEqual(['id', 'type', 'label', 'versionContenu', 'maison', 'narratif', 'scenes']);
  });

  it('une clé optionnelle NON fournie n’est pas écrite (absente, jamais `undefined`)', () => {
    const doc = documentDeProjet(IDENTITE, SCENES(), { narratif: emptyNarratif() });
    expect('worldMap' in doc, 'aucune carte fournie').toBe(false);
    expect('activeAxes' in doc, 'aucun axe fourni').toBe(false);
  });

  it('une carte NULLE vaut ABSENTE (l’éditeur porte `worldMap: WorldMap | null`)', () => {
    const doc = documentDeProjet(IDENTITE, SCENES(), { worldMap: null, narratif: emptyNarratif() });
    expect('worldMap' in doc).toBe(false);
  });

  it('les clés optionnelles FOURNIES sont écrites, à leur rang, après `scenes`', () => {
    const doc = documentDeProjet(IDENTITE, SCENES(), {
      worldMap: { id: 'monde-banc', label: 'Monde du banc', places: [], routes: [] },
      activeAxes: ['negoce'],
      narratif: emptyNarratif(),
    });
    expect(Object.keys(doc)).toEqual(
      ['id', 'type', 'label', 'versionContenu', 'maison', 'narratif', 'scenes', 'worldMap', 'activeAxes'],
    );
    expect(doc.activeAxes).toEqual(['negoce']);
  });

  it('ce qu’il construit repasse la porte `parseProject` — écrire et relire ont un seul propriétaire', () => {
    const doc = documentDeProjet(IDENTITE, SCENES(), { narratif: emptyNarratif() });
    expect(() => parseProject(doc)).not.toThrow();
    expect(parseProject(doc).scenes.map((s) => s.id)).toEqual(['scene-banc']);
  });
});

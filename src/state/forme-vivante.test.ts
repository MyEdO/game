/**
 * `validerFormeVivante` (#2001, `data/schemas/validate.ts`) — la porte d'une forme VIVANTE valide le
 * schéma sur la forme disque (`versDisque`) et la complétude de la prose (`proseNonMaterialisee`) sur
 * le reçu, à ses trois sites : `parseProject`, `parseSceneDeProjet` et `validateScene`.
 */
import { describe, it, expect } from 'vitest';
import { parseProject, parseSceneDeProjet, projetVersDepot, ProjetRefuse } from './worldMap';
import { validateScene } from './validateScene';
import { emptyScene, type Scene } from './scene';
import { flowFromEffects } from './flow';
import { lireBlocsAvances } from '../ui/editor/Editor';
import { lireProjetLivre } from '../../scripts/source/projetLivre.mjs';
import { emptyNarratif } from './campaignNarratif';

const DESC_REF = {
  book: 'ennemi-dans-l-ombre',
  ch: '01',
  parts: [{ kind: 'blocs', sec: 'le-proprietaire', secOcc: 2, b0: 0, b1: 0, sum: '38e48aee36c04e9f' }],
};
const ADAPTE = { book: 'ennemi-dans-l-ombre', page: 14 };
const TEXTE = 'Le propriétaire essuie un gobelet.';

/** Une scène dont l'unique nœud de dialogue et l'unique journal portent `prose`. */
function scene(noeud: Record<string, unknown>, journal: Record<string, unknown> = noeud): Scene {
  const sc = emptyScene(4, 4);
  sc.id = 's1';
  sc.label = 'Salle';
  sc.dialogues = [{ id: 'dlg', start: 'n1', nodes: [{ id: 'n1', choices: [], ...noeud }] }] as Scene['dialogues'];
  sc.triggers = [{ id: 't', rect: { x: 0, y: 0, w: 1, h: 1 }, flow: flowFromEffects([{ type: 'journal', ...journal } as never]) }];
  return sc;
}
const projet = (sc: Scene) => ({
  type: 'projet', id: 'proj', label: 'Projet', versionContenu: 1,
  maison: 'fixture de test', narratif: emptyNarratif(), scenes: [sc],
});
const MATERIALISE = { desc: TEXTE, descRef: DESC_REF };

function refus(geste: () => unknown): ProjetRefuse {
  try {
    geste();
  } catch (e) {
    if (e instanceof ProjetRefuse) return e;
    throw e;
  }
  throw new Error('la porte a laissé passer le document');
}
const CHEMIN_NOEUD = ['scenes', 0, 'dialogues', 0, 'nodes', 0];

describe('parseProject — forme vivante', () => {
  it('T1 : nœud et journal MATÉRIALISÉS acceptés, `desc` intact', () => {
    const sc = parseProject(projet(scene(MATERIALISE))).scenes[0];
    expect(sc.dialogues[0].nodes[0]).toMatchObject(MATERIALISE);
    expect(JSON.stringify(sc.triggers[0].flow)).toContain(TEXTE);
  });

  it('T2 : la forme DISQUE est refusée, `prose-non-materialisee`, chaque nœud à son chemin', () => {
    const r = refus(() => parseProject(projet(scene({ descRef: DESC_REF }))));
    expect(r.cause).toBe('prose-non-materialisee');
    expect(r.fautes.map((f) => f.chemin)).toContainEqual(CHEMIN_NOEUD);
    expect(r.fautes).toHaveLength(2);
    expect(r.message).toMatch(/^Projet invalide : scenes\[0\]\.dialogues\[0\]\.nodes\[0\], .+ — passage adressé sans son texte\.$/);
  });

  it('T3 : `desc: \'\'` sous une adresse est refusé', () => {
    const r = refus(() => parseProject(projet(scene({ desc: '', descRef: DESC_REF }))));
    expect(r.cause).toBe('prose-non-materialisee');
    expect(r.fautes.map((f) => f.chemin)).toContainEqual(CHEMIN_NOEUD);
  });

  it('T3 : un JOURNAL à `desc` vide sous une adresse (changement de type, `ui/editor/AddMenu.tsx`) est refusé à son chemin', () => {
    const r = refus(() => parseProject(projet(scene(MATERIALISE, { desc: '', descRef: DESC_REF }))));
    expect(r.cause).toBe('prose-non-materialisee');
    expect(r.fautes.map((f) => f.chemin.slice(0, 4))).toEqual([['scenes', 0, 'triggers', 0]]);
  });

  it('T4 : `descRef` + `adapteDe` est refusé au chemin `…adapteDe`', () => {
    const r = refus(() => parseProject(projet(scene({ ...MATERIALISE, adapteDe: ADAPTE }, MATERIALISE))));
    expect(r.cause).toBe('schema');
    expect(r.fautes.map((f) => f.chemin)).toEqual([[...CHEMIN_NOEUD, 'adapteDe']]);
  });

  it('T5 : une adresse dans un livre NON extrait est refusée', () => {
    const r = refus(() => parseProject(projet(scene({ desc: TEXTE, descRef: { ...DESC_REF, book: 'boite-d-initiation' } }, MATERIALISE))));
    expect(r.cause).toBe('schema');
    expect(r.fautes.map((f) => f.chemin)).toEqual([[...CHEMIN_NOEUD, 'descRef', 'book']]);
  });

  it('T8 : `projetVersDepot` rend la forme disque — l’adresse seule', () => {
    const lu = parseProject(projet(scene(MATERIALISE)));
    const depot = projetVersDepot(lu);
    expect(depot.scenes[0].dialogues[0].nodes[0]).toEqual({ id: 'n1', choices: [], descRef: DESC_REF });
  });
});

describe('la modale « Avancé » (`lireBlocsAvances`), la même porte', () => {
  const blocs = (noeud: Record<string, unknown>) => ({ dialogues: [{ id: 'dlg', start: 'n1', nodes: [{ id: 'n1', choices: [], ...noeud }] }] });

  it('P1 : un nœud adressé MATÉRIALISÉ (la forme de l’éditeur) fait l’aller-retour, son texte gardé', () => {
    const porte = lireBlocsAvances(blocs(MATERIALISE));
    expect(porte.ok).toBe(true);
    expect(porte.ok && porte.lu.dialogues?.[0].nodes[0]).toMatchObject(MATERIALISE);
  });

  it('P2 : la forme DISQUE (adresse sans texte) est refusée, au chemin du nœud', () => {
    const porte = lireBlocsAvances(blocs({ descRef: DESC_REF }));
    expect(porte.ok).toBe(false);
    expect(porte.ok ? '' : porte.rapport).toContain('passage adressé sans son texte.');
  });
});

describe('P5 — un preset ADAPTÉ dont le profil ADRESSE sa description est refusé', () => {
  it('Diligence, Gustav : `source` → `adapteDe` sous un profil adressé, refusé au chemin `…adapteDe`', () => {
    const doc = structuredClone(lireProjetLivre('diligence/diligence-projet.json')) as { narratif: { presetsPnj: Record<string, unknown>[] } };
    const i = doc.narratif.presetsPnj.findIndex((x) => x.id === 'edo-gustav-fondleburger');
    const p = doc.narratif.presetsPnj[i];
    expect((p.profil as { descRef?: unknown }).descRef).toBeDefined();
    p.adapteDe = p.source;
    delete p.source;
    const r = refus(() => parseProject(doc));
    expect(r.cause).toBe('schema');
    expect(r.fautes.map((f) => ({ chemin: f.chemin, message: f.message }))).toEqual([
      { chemin: ['narratif', 'presetsPnj', i, 'adapteDe'], message: 'texte adapté, alors que la description du profil est la copie adressée du livre.' },
    ]);
  });
});

describe('T6 — parseSceneDeProjet, la même porte', () => {
  it('matérialisée acceptée ; disque refusée ; `descRef` + `adapteDe` refusé', () => {
    expect(parseSceneDeProjet(scene(MATERIALISE)).dialogues[0].nodes[0]).toMatchObject(MATERIALISE);
    const disque = refus(() => parseSceneDeProjet(scene({ descRef: DESC_REF })));
    expect(disque.cause).toBe('prose-non-materialisee');
    expect(disque.fautes.map((f) => f.chemin)).toContainEqual(['dialogues', 0, 'nodes', 0]);
    const double = refus(() => parseSceneDeProjet(scene({ ...MATERIALISE, adapteDe: ADAPTE }, MATERIALISE)));
    expect(double.fautes.map((f) => f.chemin)).toEqual([['dialogues', 0, 'nodes', 0, 'adapteDe']]);
  });
});

describe('T6 — validateScene, la même porte', () => {
  const erreurs = (sc: Scene) => validateScene([sc]).filter((w) => w.level === 'error' && w.scope === 'dialogue').map((w) => w.message);

  it('matérialisée : aucune erreur de dialogue ; disque et `descRef` + `adapteDe` : une erreur chacune', () => {
    expect(erreurs(scene(MATERIALISE))).toEqual([]);
    expect(erreurs(scene({ descRef: DESC_REF }))).toEqual([expect.stringContaining('passage adressé sans son texte')]);
    expect(erreurs(scene({ ...MATERIALISE, adapteDe: ADAPTE }, MATERIALISE))).toEqual([expect.stringContaining('texte à la fois copié et adapté')]);
  });
});

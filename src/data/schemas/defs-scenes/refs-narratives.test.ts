/**
 * Le visiteur UNIQUE des références narratives d'un projet (#679) : il trouve chaque clé de
 * `REFERENCES_NARRATIVES` et chaque `stade` là où un projet les porte (entité, Flow de scène, Flow
 * porté, péripétie de carte, stade d'indice) ; `referencesA` et `renommeRef` le lisent ; la FK de la
 * porte (`refsNarrativesPendantes`) aussi.
 */
import { describe, it, expect } from 'vitest';
import { fautesDeSites, lieuDuSite, referencesA, refsNarrativesPendantes, renommeRef, sitesDuProjet } from './refs-narratives';

const narratif = () => ({
  affaires: [{ id: 'aff' }],
  indices: [{ id: 'ind', affaireId: 'aff', stades: [{ id: 'lue', documentId: 'doc' }, { id: 'dechiffree' }] }],
  presetsPnj: [{ id: 'pnj' }],
  documents: [{ id: 'doc' }],
  objets: [],
});

const scene = () => ({
  id: 'relais',
  label: 'Le relais',
  entities: [{ id: 'e', presetId: 'pnj' }],
  triggers: [{
    id: 't',
    flow: { kind: 'seq', steps: [
      { kind: 'do', effect: { type: 'document', documentId: 'doc' } },
      { kind: 'do', effect: { type: 'revealClue', indiceId: 'ind', stade: 'dechiffree' } },
    ] },
  }],
});

const carte = () => ({ routes: [{ perils: [{ effects: [{ type: 'discreditClue', indiceId: 'ind' }] }] }] });

const projet = () => ({ scenes: [scene(), { id: 'vide', label: 'Vide', entities: [], triggers: [] }], worldMap: carte(), narratif: narratif() });
type Projet = ReturnType<typeof projet>;
const effet = (p: Projet, i: number) => p.scenes[0].triggers[0].flow.steps[i].effect as Record<string, unknown>;

describe('sitesDuProjet — chaque référence, à son chemin', () => {
  it('entité, Flow de scène, péripétie de carte et stade d’indice', () => {
    const sites = sitesDuProjet(projet()).map((s) => `${s.chemin.join('.')}:${s.cle}=${s.id}`);
    expect(sites).toEqual(expect.arrayContaining([
      'scenes.0.entities.0:presetId=pnj',
      'scenes.0.triggers.0.flow.steps.0.effect:documentId=doc',
      'scenes.0.triggers.0.flow.steps.1.effect:indiceId=ind',
      'scenes.0.triggers.0.flow.steps.1.effect:stade=dechiffree',
      'worldMap.routes.0.perils.0.effects.0:indiceId=ind',
      'narratif.indices.0:affaireId=aff',
      'narratif.indices.0.stades.0:documentId=doc',
    ]));
  });
});

describe('referencesA — qui désigne une entrée', () => {
  it('un document : la scène ET le stade qui le portent, lieux nommés', () => {
    const p = projet();
    const sites = referencesA(p, { registre: 'documents', id: 'doc' });
    expect(sites.map((s) => lieuDuSite(p, s))).toEqual([{ racine: 'scene', nom: 'Le relais' }, { racine: 'indice', nom: 'ind' }]);
  });

  it('un stade : seul le site `stade` de CET indice', () => {
    const sites = referencesA(projet(), { registre: 'indices', id: 'ind', stade: 'dechiffree' });
    expect(sites.map((s) => s.chemin.join('.'))).toEqual(['scenes.0.triggers.0.flow.steps.1.effect']);
  });

  it('une entrée que rien ne désigne : aucun site', () => {
    expect(referencesA(projet(), { registre: 'presetsPnj', id: 'autre' })).toEqual([]);
  });
});

describe('renommeRef — le renommage propagé, PUR', () => {
  it('un indice renommé : scène, carte réécrites ; racines intactes non copiées ; l’original inchangé', () => {
    const p = projet();
    const r = renommeRef(p, { registre: 'indices', id: 'ind' }, 'ind2');
    expect(referencesA(r, { registre: 'indices', id: 'ind2' }).length).toBe(2);
    expect(referencesA(r, { registre: 'indices', id: 'ind' })).toEqual([]);
    expect(r.scenes[1]).toBe(p.scenes[1]);
    expect(r.narratif).toBe(p.narratif);
    expect(referencesA(p, { registre: 'indices', id: 'ind' }).length).toBe(2);
  });

  it('un stade renommé : seul le `stade` de l’Effect bouge', () => {
    const r = renommeRef(projet(), { registre: 'indices', id: 'ind', stade: 'dechiffree' }, 'traduite');
    expect(r.scenes[0].triggers[0].flow.steps[1].effect).toEqual({ type: 'revealClue', indiceId: 'ind', stade: 'traduite' });
  });
});

describe('fautes — la FK de la porte lit le MÊME visiteur', () => {
  it('id vide : « aucun document choisi » ; id inconnu : nommé', () => {
    const p = projet();
    effet(p, 0).documentId = '';
    p.scenes[0].entities[0].presetId = 'fantome';
    const messages = refsNarrativesPendantes(p, narratif()).map((f) => f.message);
    expect(messages).toContain('aucun document choisi : choisissez-en un au sélecteur (narratif.documents).');
    expect(messages.some((m) => m.includes('« fantome »'))).toBe(true);
  });

  it('réf VIDE : absence chez l’entité et le stade (#1882, leur schéma en juge), faute chez l’Effect qui l’exige', () => {
    const p = projet();
    p.scenes[0].entities[0].presetId = '';
    (p.narratif.indices[0].stades[0] as Record<string, unknown>).documentId = '';
    effet(p, 0).documentId = '';
    expect(fautesDeSites(sitesDuProjet(p), narratif()).map((f) => f.chemin.join('.'))).toEqual(['scenes.0.triggers.0.flow.steps.0.effect.documentId']);
  });

  it('stade inconnu de son indice', () => {
    const p = projet();
    effet(p, 1).stade = 'brulee';
    expect(fautesDeSites(sitesDuProjet(p), narratif()).map((f) => f.message)).toEqual(["stade inconnu « brulee » de l'indice « ind »."]);
  });
});

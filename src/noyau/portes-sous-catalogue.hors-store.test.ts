/**
 * Les PORTES D'ENTRÉE du noyau jugent sous le catalogue qu'elles reçoivent (#5070, étape B) : une donnée qui désigne
 * une entrée absente de l'index des ids, présente au catalogue passé, passe chaque porte ; un id mort y est refusé.
 */
import { describe, it, expect } from 'vitest';
import { catalogueAvec } from '../data/catalogueAvec.testkit';
import { emptyStatblock } from '../data/valeursNeuves';
import { emptyScene, type Scene, type SceneEntity } from './monde/scene';
import { emptyNarratif } from './monde/campaignNarratif';
import { parseProject, parseSceneDeProjet } from './worldMap';
import { buildScene } from './mapSpec';
import { exigerUnProjetJouable, validateScene } from './validateScene';
import { ficheEditee } from './sceneEditLecture';
import { campagneDuPaquet } from './campagneLivree';
import {
  compositionDuPreset,
  lireApparenceDAuteur,
  lireComposition,
  lireSurchargesDEmblemes,
  presetDeComposition,
  type Composition,
} from './apparence/composition';
import { presetsDePersonnage } from '../data';
import { etatInitialDuJeu, exporterLaSauvegarde, lireSave, snapshotSave, type EtatDeJeu } from './index';

const GROUPE = 'groupe-du-catalogue-des-portes';
const LIVRE = 'livre-du-catalogue-des-portes';
const COULEUR = 'couleur-du-catalogue-des-portes';
const EMBLEME = 'embleme-du-catalogue-des-portes';
const MORT = 'id-mort-du-catalogue-des-portes';

const CAT = catalogueAvec({
  'groups.json': [{ id: GROUPE, type: 'groups', label: 'Groupe du catalogue des portes' }],
  'books.json': [{ id: LIVRE, type: 'books', label: 'Livre du catalogue des portes', abbr: 'LCP', language: 'VF', folder: null }],
  'materials.json': [{ id: COULEUR, type: 'materials', label: 'Couleur du catalogue des portes', domain: 'couleur', color: '#123456' }],
  'garde-robe.json': [{ id: EMBLEME, type: 'garde-robe', label: 'Emblème du catalogue des portes', kind: 'embleme', svg: '<svg xmlns="http://www.w3.org/2000/svg"/>' }],
});

/** Une scène vide qui porte le groupe `groupe`. */
const scene = (groupe: string): Scene => ({ ...emptyScene('scene-des-portes', 3, 3), label: 'Scène des portes', groups: [groupe] });

/** Un PNJ à statbloc qui porte le groupe `groupe`. */
const pnj = (groupe: string): SceneEntity => ({ kind: 'personnage', id: 'pnj-des-portes', pos: { x: 1, y: 1 }, statblock: { ...emptyStatblock('PNJ des portes'), groups: [groupe] } }) as SceneEntity;

/** Un document de projet d'une scène. */
const projet = (s: Scene) => ({ type: 'projet', id: 'projet-des-portes', label: 'Projet des portes', versionContenu: 1, maison: 'fixture de test', narratif: emptyNarratif(), scenes: [s] });

/** Le texte de la save d'un état où la scène courante est `s`, et où l'instance de `s` réinjecte `entites`. */
const save = (s: Scene, entites: SceneEntity[] = []): string =>
  exporterLaSauvegarde(snapshotSave({ ...etatInitialDuJeu(), scene: s, sceneInstances: { [s.id]: { entitesChangees: entites } } } as EtatDeJeu, '2026-11-26T00:00:00.000Z'));

const erreursDeSchema = (s: Scene) => validateScene([s], undefined, undefined, CAT).filter((w) => w.level === 'error');

describe('portes du noyau — chaque id jugé sous le catalogue passé', () => {
  it('parseSceneDeProjet', () => {
    expect(parseSceneDeProjet(scene(GROUPE), CAT).groups).toEqual([GROUPE]);
    expect(() => parseSceneDeProjet(scene(MORT), CAT)).toThrow(MORT);
  });

  it('parseProject', () => {
    expect(parseProject(projet(scene(GROUPE)), CAT).scenes[0].groups).toEqual([GROUPE]);
    expect(() => parseProject(projet(scene(MORT)), CAT)).toThrow(MORT);
  });

  it('lireSave : ses scènes', () => {
    expect(lireSave(save(scene(GROUPE)), CAT)).not.toBe('sceneInvalide');
    expect(lireSave(save(scene(MORT)), CAT)).toBe('sceneInvalide');
  });

  it('lireSave : les entités qu’une instance de scène réinjecte', () => {
    expect(lireSave(save(scene(GROUPE), [pnj(GROUPE)]), CAT)).not.toBe('sceneInvalide');
    expect(lireSave(save(scene(GROUPE), [pnj(MORT)]), CAT)).toBe('sceneInvalide');
  });

  it('buildScene', () => {
    const spec = (groupe: string) => ({ id: 'scene-des-portes', label: 'Scène des portes', size: [3, 3] as [number, number], entities: [pnj(groupe)] });
    expect(buildScene(spec(GROUPE), CAT).entities).toHaveLength(1);
    expect(() => buildScene(spec(MORT), CAT)).toThrow(MORT);
  });

  it('validateScene', () => {
    expect(erreursDeSchema(scene(GROUPE))).toEqual([]);
    expect(erreursDeSchema(scene(MORT)).map((w) => w.message).join('\n')).toContain(MORT);
  });

  it('exigerUnProjetJouable', () => {
    expect(() => exigerUnProjetJouable([scene(GROUPE)], undefined, undefined, CAT)).not.toThrow();
    expect(() => exigerUnProjetJouable([scene(MORT)], undefined, undefined, CAT)).toThrow(MORT);
  });

  it('ficheEditee', () => {
    expect(ficheEditee(pnj(GROUPE), emptyNarratif(), CAT)).toBeDefined();
    expect(ficheEditee(pnj(MORT), emptyNarratif(), CAT)).toBeUndefined();
  });

  it('campagneDuPaquet : l’identité du paquet', () => {
    const paquet = (livre: string) => ({ ...projet(scene(GROUPE)), icon: 'fichier/document', source: { book: livre, page: 1 } });
    expect(campagneDuPaquet(paquet(LIVRE), 'projet-des-portes.json', CAT).source).toEqual({ book: LIVRE, page: 1 });
    expect(() => campagneDuPaquet(paquet(MORT), 'projet-des-portes.json', CAT)).toThrow(MORT);
  });

  it('lireComposition, lireApparenceDAuteur et presetDeComposition', () => {
    /** Le type de `Composition` ferme ses couleurs aux ids de l'index : celle du catalogue passé s'y force. */
    const composition = (couleur: string): Composition => ({ ...compositionDuPreset(presetsDePersonnage[0]), couleurs: { peau: { id: couleur as never } } });
    expect(lireComposition(composition(COULEUR), CAT).ok).toBe(true);
    expect(lireComposition(composition(MORT), CAT).ok).toBe(false);
    expect(lireApparenceDAuteur({ couleurs: { peau: { id: COULEUR } } }, CAT).ok).toBe(true);
    expect(lireApparenceDAuteur({ couleurs: { peau: { id: MORT } } }, CAT).ok).toBe(false);
    const verdict = (couleur: string) => {
      const p = presetDeComposition(composition(couleur), undefined, CAT);
      return p.ok ? p.verdict.filter((f) => f.chemin[0] === 'couleurs') : p.presets;
    };
    expect(verdict(COULEUR)).toEqual([]);
    expect(verdict(MORT)).not.toEqual([]);
  });

  it('lireSurchargesDEmblemes', () => {
    expect(lireSurchargesDEmblemes({ torse: { id: EMBLEME } }, CAT).ok).toBe(true);
    expect(lireSurchargesDEmblemes({ torse: { id: MORT } }, CAT).ok).toBe(false);
  });
});

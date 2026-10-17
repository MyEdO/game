/**
 * GARDE — le SCHÉMA des semences de scène (#1716) refuse une semence qui poserait le faux défaut sur
 * CHAQUE scène créée ensuite.
 *
 * Trois portes, chacune tenue par la grammaire partagée et non par un contrôle local : un TERRAIN
 * hors du registre (`idDe('terrain')`), un ÉCLAIRAGE qui n'est pas un palier réel
 * (`idDe('lightLevel')` — plus strict que `Scene.ambientLight`, chaîne libre ; ABSENT = `auto`, la
 * sentinelle est l'absence du champ), une PENTE hors de
 * `PENTE_TOIT_DEG` (`sceneRoofDefaultsSchema`, le schéma de la scène lui-même, jamais une copie).
 *
 * Le document LIVRÉ est validé en premier : sans lui, les trois refus ne prouveraient rien (un
 * schéma qui refuse tout refuse aussi le faux).
 */
import { describe, expect, it } from 'vitest';
import { validateDataset } from './schemas/validate';
import { semencesDeScene } from './index';
import { emptyScene } from '../state/scene';

const FICHIER = 'semences-de-scene.json';
/** Le document livré, tel qu'il est sur disque (enveloppe comprise) — base de chaque mutation. */
const LIVRE = {
  id: 'semences-de-scene', type: 'semences-de-scene', label: 'Semences de scène',
  maison: 'fixture de test — la raison réelle vit au dataset',
  ambiance: semencesDeScene.ambiance,
  metresPerTile: semencesDeScene.metresPerTile,
  terrain: semencesDeScene.terrain,
  reliefDefaults: { ...semencesDeScene.reliefDefaults },
  roofDefaults: { ...semencesDeScene.roofDefaults },
};

describe('semences-de-scene.json — le schéma refuse une semence qui mentirait à toutes les scènes (#1716)', () => {
  it('le document LIVRÉ parse (sans quoi les refus ci-dessous ne mesureraient rien)', () => {
    expect(validateDataset(FICHIER, LIVRE)).toBeNull();
  });

  it('un TERRAIN hors du registre des sols est refusé, nommément', () => {
    const erreur = validateDataset(FICHIER, { ...LIVRE, terrain: 'lave-de-nulle-part' });
    expect(erreur).toContain('terrain');
    expect(erreur).toContain('lave-de-nulle-part');
  });

  it('un ÉCLAIRAGE qui n’est pas un palier de `lightLevels.json` est refusé — `auto` COMPRIS', () => {
    expect(validateDataset(FICHIER, { ...LIVRE, ambientLight: 'plein-jour-inconnu' })).toContain('Éclairage');
    // La sentinelle « suit l'horloge » est l'ABSENCE du champ, jamais une valeur : `auto` n'est pas un
    // palier de `lightLevels.json`, et un champ typé `idDe('lightLevel')` le refuse comme tout autre
    // id mort — `emptyScene` rend `auto` sur la SCÈNE, dont le champ est une chaîne libre.
    expect(validateDataset(FICHIER, { ...LIVRE, ambientLight: 'auto' })).toContain('Éclairage');
    expect(validateDataset(FICHIER, { ...LIVRE, ambientLight: 'nuit' })).toBeNull();
  });

  it('une PENTE de toiture hors de la plage du schéma de scène est refusée', () => {
    const erreur = validateDataset(FICHIER, { ...LIVRE, roofDefaults: { ...LIVRE.roofDefaults, pitchDeg: 80 } });
    expect(erreur).toContain('Toiture par défaut › pente en degrés');
  });

  it('une MATIÈRE de relief hors de la sous-liste `relief` est refusée', () => {
    const erreur = validateDataset(FICHIER, { ...LIVRE, reliefDefaults: { ...LIVRE.reliefDefaults, cliff: 'toit-ardoise' } });
    expect(erreur).toContain('Matières de relief › falaise');
  });

  it('une AMBIANCE hors du vocabulaire de la scène est refusée (même énumération que `Scene.ambiance`)', () => {
    expect(validateDataset(FICHIER, { ...LIVRE, ambiance: 'souterrain' })).toContain('Ambiance');
  });

  it('ÉCLAIRAGE absent de la semence → la scène neuve porte `auto` EN CLAIR (#841 FU-A tenu)', () => {
    // Le câblage de la SENTINELLE : côté semence l’absence dit « suit l’horloge » (champ typé
    // `idDe('lightLevel')`, qui ne connaît aucun `auto`) ; côté SCÈNE le défaut reste ÉCRIT, pour que
    // l’inspecteur affiche la valeur réellement effective au lieu d’un vide à deviner.
    expect(semencesDeScene.ambientLight, 'la semence livrée ne doit nommer AUCUN palier').toBeUndefined();
    expect(emptyScene().ambientLight).toBe('auto');
  });
});

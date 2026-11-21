import { describe, expect, it } from 'vitest';
import { combattantDeTest } from '../../engine/combattantDeTest.testkit';
import { rosterDeTest } from '../../engine/idsDeTest.testkit';
import { newDraft } from '../creation/brouillon';
import { etatInitialDuJeu, exporterLaSauvegarde, lireSave, snapshotSave } from '../index';
import { ecrireLeRoster, lireLeRoster, rosterExport, rosterImport, type RosterEntry } from './roster';

const FORMAT_SAVE_AVANT_LES_REGLES = 'f642d26deb938799';
const FORMAT_ROSTER_AVANT_LES_REGLES = '974d8daa87ece06f';
const FORMAT_EXPORT_AVANT_LES_REGLES = '372cd4f616141f86';

function entreeDeTest(): RosterEntry {
  const id = rosterDeTest('formats-des-regles')('hero');
  const hair = { label: 'Brun clair' };
  const eyes = [
    { id: 'marron-fonce', colonne: 'elfe-sylvain' },
    { id: 'gris-pale', colonne: 'elfe-sylvain' },
  ] as const;
  return {
    hero: { ...combattantDeTest({ id, kind: 'heros', details: { age: 24, hair, eyes } }), id },
    wealth: { gold: 1, silver: 2, brass: 3 },
    draft: { ...newDraft(7), label: 'Brouillon', hair, eyes },
  };
}

describe('Formats de même forme avant les réglages de Chirurgie et de Frénésie', () => {
  it('relit la sauvegarde précédente sous le format courant', () => {
    const etat = { ...etatInitialDuJeu(), party: [entreeDeTest().hero] };
    const courante = snapshotSave(etat, '2026-11-21T06:30:00.000Z', { 'test-dr-rapide': true });
    const ancienne = { ...courante, version: FORMAT_SAVE_AVANT_LES_REGLES };

    expect(lireSave(exporterLaSauvegarde(ancienne))).toEqual(courante);
  });

  it('relit le roster précédent avec le même héros et son brouillon', () => {
    const heros = [entreeDeTest()];
    const courant = JSON.parse(ecrireLeRoster(heros));
    const ancien = { ...courant, version: FORMAT_ROSTER_AVANT_LES_REGLES };

    expect(lireLeRoster(JSON.stringify(ancien))).toEqual({ heros, retraits: null });
  });

  it('importe l’export héros précédent avec les mêmes données', () => {
    const entry = entreeDeTest();
    const courant = JSON.parse(rosterExport(entry));
    const ancien = { ...courant, version: FORMAT_EXPORT_AVANT_LES_REGLES };

    expect(rosterImport(JSON.stringify(ancien))).toEqual({ entry });
  });
});

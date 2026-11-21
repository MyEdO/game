import { describe, expect, it } from 'vitest';
import { combattantDeTest } from '../../engine/combattantDeTest.testkit';
import { rosterDeTest } from '../../engine/idsDeTest.testkit';
import { newDraft } from '../creation/brouillon';
import { etatInitialDuJeu, exporterLaSauvegarde, lireSave, snapshotSave } from '../index';
import { ecrireLeRoster, lireLeRoster, rosterExport, rosterImport, type RosterEntry } from './roster';
import { t } from '../../i18n';
import { FORMAT_EXPORT_HEROS, FORMAT_ROSTER, FORMAT_SAVE } from './formats.generated';
import { formatAvantLesReglesDeChirurgieEtFrenesie } from './formatsDesRegles';

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
  it.each([
    ['save', FORMAT_SAVE_AVANT_LES_REGLES, '82d04f67e7828613', FORMAT_SAVE],
    ['roster', FORMAT_ROSTER_AVANT_LES_REGLES, '495a3f0fa90e7f2c', FORMAT_ROSTER],
    ['exportHeros', FORMAT_EXPORT_AVANT_LES_REGLES, '5a7b7626e88e0172', FORMAT_EXPORT_HEROS],
  ] as const)('réserve la reprise de %s à la paire de même forme', (document, avant, apres, courant) => {
    expect(formatAvantLesReglesDeChirurgieEtFrenesie(document, apres)).toBe(avant);
    expect(formatAvantLesReglesDeChirurgieEtFrenesie(document, courant)).toBe(courant);
  });

  it('relit la sauvegarde courante et refuse l’empreinte qui précède les nouvelles références', () => {
    const etat = { ...etatInitialDuJeu(), party: [entreeDeTest().hero] };
    const courante = snapshotSave(etat, '2026-11-21T06:30:00.000Z', { 'test-dr-rapide': true });
    const ancienne = { ...courante, version: FORMAT_SAVE_AVANT_LES_REGLES };

    expect(lireSave(exporterLaSauvegarde(courante))).toEqual(courante);
    expect(lireSave(exporterLaSauvegarde(ancienne))).toBe('autreFormat');
  });

  it('relit le héros et son brouillon au format courant du roster', () => {
    const heros = [entreeDeTest()];
    const courant = JSON.parse(ecrireLeRoster(heros));
    const ancien = { ...courant, version: FORMAT_ROSTER_AVANT_LES_REGLES };

    expect(lireLeRoster(JSON.stringify(courant))).toEqual({ heros, retraits: null });
    expect(lireLeRoster(JSON.stringify(ancien))).toBeNull();
  });

  it('importe le héros au format d’export courant', () => {
    const entry = entreeDeTest();
    const courant = JSON.parse(rosterExport(entry));
    const ancien = { ...courant, version: FORMAT_EXPORT_AVANT_LES_REGLES };

    expect(rosterImport(JSON.stringify(courant))).toEqual({ entry });
    expect(rosterImport(JSON.stringify(ancien))).toEqual({ error: t('picker.import.error.autreFormat') });
  });
});

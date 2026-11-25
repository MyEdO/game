/**
 * La porte `parseProject` sur les paquets COMMITTÉS du jeu (`src/noyau/parseProject-porte.test.ts` en tient le
 * contrat sur le commun) : gelés, ils passent intacts ; leur forme disque est refusée, servie elle passe.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';
import { dossierDesProjetsLivres, listerProjetsLivres } from '../../../scripts/guards/lib/projetsLivres.mjs';
import { lireProjetLivre } from '../../../scripts/source/projetLivre.mjs';
import { parseProject } from '../../../src/noyau/worldMap';
import { gele, refusDe } from '../../../src/noyau/porteDuProjet.testkit';

const SCENES_DIR = dossierDesProjetsLivres();
const PAQUETS = listerProjetsLivres().map((rel) => join(SCENES_DIR, rel));

describe('parseProject — la porte n’altère JAMAIS son entrée', () => {
  it('au moins un paquet committé porte une carte à ports (sans quoi la pureté ne mesurerait rien)', () => {
    const ports = PAQUETS.flatMap((f) => (JSON.parse(readFileSync(f, 'utf8')).worldMap?.places ?? []).filter((p: { port?: unknown }) => p.port));
    expect(ports.length).toBeGreaterThan(0);
  });

  it.each(listerProjetsLivres().map((rel) => [rel] as const))('%s GELÉ en profondeur passe la porte, intact', (rel) => {
    const avant = JSON.stringify(lireProjetLivre(rel));
    const doc = gele(lireProjetLivre(rel));
    expect(() => parseProject(doc)).not.toThrow();
    expect(JSON.stringify(doc)).toBe(avant);
  });

});

describe('parseProject — le refus est une DONNÉE (`ProjetRefuse`)', () => {
  it('la FORME DISQUE d’un projet livré (prose adressée sans son texte) : `prose-non-materialisee`, chaque nœud à son chemin ; servie, elle passe', () => {
    const rel = 'jeu-de-role/campagnes/diligence/diligence-projet.json';
    const disque = JSON.parse(readFileSync(join(SCENES_DIR, rel), 'utf8')) as { narratif: { presetsPnj: { id: string; profil?: { descRef?: unknown } }[] } };
    const adresses = disque.narratif.presetsPnj.flatMap<[string, string, number, string]>((p, i) => (p.profil?.descRef ? [['narratif', 'presetsPnj', i, 'profil']] : []));
    expect(adresses.length, 'aucun preset adressé sur le disque — le refus ne mesurerait rien').toBeGreaterThan(0);
    const refus = refusDe(disque);
    expect(refus.cause).toBe('prose-non-materialisee');
    expect(refus.fautes.map((f) => f.chemin)).toEqual(adresses);
    const [, , premier] = adresses[0];
    expect(refus.message).toContain(`Bloc narratif › PNJ « ${disque.narratif.presetsPnj[premier].id} » › profil`);
    expect(() => parseProject(lireProjetLivre(rel)), 'la forme SERVIE (`materialiser`) passe la porte').not.toThrow();
  });
});

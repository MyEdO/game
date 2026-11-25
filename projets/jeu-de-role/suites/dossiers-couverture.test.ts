/**
 * Garde d'intégrité RÉFÉRENTIELLE des liens paquet → fiche de dossier de chapitre (#2290) : dans chaque projet
 * livré (`listerProjetsLivres`), tout `couvre` et tout `narratif.ecartes[].entree` résout à une entrée d'une
 * fiche que remet le contenu du jeu de rôle (`contenu.dossiers`, `projets/jeu-de-role/contenu.ts`), et aucune entrée n'est à la fois couverte et
 * écartée dans le même paquet. Une entrée NON couverte n'est jamais une faute : un chapitre non adapté est un
 * état normal (`npm run jeu-de-role:docs` le mesure). Contrat de la lecture : `src/data/source/couvertures.test.ts`.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';
import { dossierDesProjetsLivres, listerProjetsLivres } from '../../../scripts/guards/lib/projetsLivres.mjs';
import { entreesDesFiches } from '../../../src/data/dossiers';
import { contenu } from '../contenu';
import { couverturesDuProjet, fautesDeReference, type ProjetLu } from '../../../src/data/source/couvertures';

/** Le disque suffit : `couvre` et `ecartes` ne sont pas de la prose adressée. */
const PROJETS = listerProjetsLivres().map((rel) => [rel, JSON.parse(readFileSync(join(dossierDesProjetsLivres(), rel), 'utf8')) as ProjetLu] as const);
const ENTREES = entreesDesFiches(contenu.dossiers);
const CONNUES = new Set(ENTREES.map((e) => e.id));

describe('liens `couvre` / `ecartes` des projets livrés (#2290)', () => {
  it('les fiches commitées sont lues', () => {
    expect(contenu.dossiers.length).toBeGreaterThan(0);
    expect(CONNUES.size).toBe(ENTREES.length);
  });

  it('chaque lien résout à une entrée de fiche commitée, et aucune entrée n’est couverte ET écartée dans un même paquet', () => {
    expect(PROJETS.length).toBeGreaterThan(0);
    expect(PROJETS.flatMap(([rel, projet]) => fautesDeReference(rel, couverturesDuProjet(projet), CONNUES))).toEqual([]);
  });
});

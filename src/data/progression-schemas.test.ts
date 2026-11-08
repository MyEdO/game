/**
 * Garde du SCHÉMA DE PROGRESSION (#905) : l'affectation marque -> Caractéristique de chaque niveau de
 * Carrière est celle que le PDF FR imprime. `refs-migrated.test.ts` ne contrôle que la CARDINALITÉ
 * (3/1/1/1) et la DISJONCTION — une PERMUTATION entre deux niveaux les satisfait toutes les deux
 * (mesuré sur `tueur`, LDB folio 76, niveaux 3 et 4 intervertis, garde verte).
 *
 * La lecture des PDF vit dans `scripts/data/gen-progression-schemas.py` et se fige dans l'artefact
 * committé `progression-schemas.derived.json` (le PDF n'est pas rejouable en CI). La COMPARAISON vit
 * dans `scripts/guards/lib/progressionSchemas.mjs` — partagée avec l'étape `docs:check`
 * (`scripts/data/check-progression-schemas.mjs`) : un seul comparateur, deux points d'entrée.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, writeFileSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  auditProgressionSchemas,
  formatViolation,
  normTitle,
} from '../../scripts/guards/lib/progressionSchemas.mjs';
import { serializeDataset } from './serialize';
import careers from './careers.json';
import careerLevels from './careerLevels.json';
import artefact from './progression-schemas.derived.json';

const audit = auditProgressionSchemas();

describe('schémas de progression (PDF -> careerLevels.json)', () => {
  it("l'affectation de chaque marque est celle du PDF, niveau par niveau", () => {
    expect(audit.violations.map(formatViolation)).toEqual([]);
  });

  it('chaque bande lue est rapprochée dune seule Carrière (aucune ambiguïté de titre)', () => {
    expect(audit.ambigus).toEqual([]);
  });

  it('les 108 Carrières de la donnée sont couvertes — tout angle mort est NOMMÉ', () => {
    // Le jour où un livre à Carrières entre sans extraction lisible, ce test le nomme au lieu de le taire.
    expect(audit.nonCouvertes).toEqual({});
    expect(audit.couvertes).toBe(audit.totalCarrieres);
  });

  it('les 3 bandes du PDF que la donnée ne réclame pas sont NOMMÉES, pas tues', () => {
    // Une Carrière imprimée mais jamais curée doit se voir : ces 3 bandes sont attendues, et une 4e
    // qui apparaîtrait (nouvelle Carrière d'un livre, ou titre qui cesse d'être rapproché) échoue ici.
    expect(
      audit.bandesHorsDonnee.map((b) => `${b.book} folio ${b.page} y=${b.y} ${b.titres[0]}`),
    ).toEqual([
      'livre-de-base folio 46 y=389.5 CARRIÈRES', // exemple pédagogique du chapitre « Classes et Carrières »
      'vents-de-la-magie folio 188 y=753.1 FAMILIER DE COMBAT', // bande de tête, colonne de droite : aucun titre ne la coiffe
      'vents-de-la-magie folio 188 y=373.8 FAMILIER DE SORTS',
    ]);
    // La bande de tête de la colonne de droite n'emprunte le titre de PERSONNE : `career` est nul.
    const tete = artefact.schemas.find((s) => s.book === 'vents-de-la-magie' && s.y === 753.1);
    expect(tete?.career).toBeNull();
    // Et celle du bas porte SON titre, pas celui du haut de page (le bug d'attribution de #905).
    const bas = artefact.schemas.find((s) => s.book === 'vents-de-la-magie' && s.y === 373.8);
    expect(bas?.career).toBe('FAMILIER DE SORTS');
  });

  it('le CLI de garde SORT en 1 et NOMME le désaccord (chemin d’échec, pas seulement le vert)', () => {
    const mute = JSON.parse(JSON.stringify(careerLevels)) as typeof careerLevels;
    const lv2 = mute.find((l) => l.career.id === 'tueur' && l.level === 2)!;
    lv2.characteristics = ['sociabilite'];
    const tmp = join(tmpdir(), `careerLevels-905-${process.pid}.json`);
    writeFileSync(tmp, JSON.stringify(mute), 'utf8');
    try {
      const r = spawnSync(
        process.execPath,
        [fileURLToPath(new URL('../../scripts/data/check-progression-schemas.mjs', import.meta.url)), '--careerLevels', tmp],
        { encoding: 'utf8' },
      );
      expect(r.status).toBe(1);
      expect(r.stderr).toContain('DÉSACCORD tueur niveau 2');
      expect(r.stderr).toContain('livre-de-base folio 76');
      expect(r.stderr).toContain('JSON [sociabilite] vs PDF [endurance]');
      expect(r.stderr).toContain('1 désaccord(s)');
      // Le chemin VERT du même CLI, pour que l'échec ci-dessus ne puisse pas venir d'un CLI cassé.
      const ok = spawnSync(
        process.execPath,
        [fileURLToPath(new URL('../../scripts/data/check-progression-schemas.mjs', import.meta.url))],
        { encoding: 'utf8' },
      );
      expect(ok.status).toBe(0);
      expect(ok.stdout).toContain('BANDE HORS DONNÉE vents-de-la-magie folio 188');
    } finally {
      rmSync(tmp, { force: true });
    }
  });

  it('le folio DÉCLARÉ par careers.json est celui que le PDF imprime (#1640)', () => {
    expect(
      audit.folioEcarts.map((e) => `${e.career} (${e.book}) déclare p.${e.declare}, imprimé ${e.imprime}`),
    ).toEqual([]);
  });

  it('le CLI SORT en 1 et NOMME la Carrière dont le folio déclaré ment (#1640)', () => {
    const mute = JSON.parse(JSON.stringify(careers)) as typeof careers;
    const medecin = mute.find((c) => c.id === 'medecin')!;
    medecin.source.page = 88; // le folio de l'extraction fausse — le PDF imprime 89
    const tmp = join(tmpdir(), `careers-1640-${process.pid}.json`);
    writeFileSync(tmp, JSON.stringify(mute), 'utf8');
    try {
      const r = spawnSync(
        process.execPath,
        [fileURLToPath(new URL('../../scripts/data/check-progression-schemas.mjs', import.meta.url)), '--careers', tmp],
        { encoding: 'utf8' },
      );
      expect(r.status).toBe(1);
      expect(r.stderr).toContain(
        'FOLIO medecin (livre-de-base) : careers.json déclare p.88, le PDF imprime la page 89',
      );
      expect(r.stderr).toContain('1 désaccord(s)');
    } finally {
      rmSync(tmp, { force: true });
    }
  });

  it('chaque niveau déclare le folio de la Carrière qu’il prolonge (careers.json ⇄ careerLevels.json)', () => {
    // Un niveau porte SON `source.{book,page}` : rien ne l'arrime à celui de sa Carrière tant qu'une
    // garde ne le tient — un folio corrigé d'un côté seul se rétablit en silence. Jointure par id :
    // `careerLevels[].career` -> `careers[].id`.
    const parId = new Map(careers.map((c) => [c.id, c]));
    const desaccords = careerLevels.flatMap((l) => {
      const c = parId.get(l.career.id);
      if (!c) return [`${l.id} : aucune Carrière « ${l.career.id} » dans careers.json`];
      if (l.source.book === c.source.book && l.source.page === c.source.page) return [];
      return [
        `${l.id} : niveau ${l.source.book} p.${l.source.page} vs Carrière ${c.source.book} p.${c.source.page}`,
      ];
    });
    expect(desaccords).toEqual([]);
  });

  it("l'artefact couvre EXACTEMENT les livres qui portent des Carrières, et porte son ENVELOPPE de document", () => {
    // Vérité INDÉPENDANTE de l'artefact : les livres qui portent une Carrière dans la DONNÉE.
    // L'artefact, lui, tient sa liste du lecteur de PDF (`gen-progression-schemas.py`, champ
    // `livres`) — les deux se rejoignent ou l'extraction a sauté un livre. Aucune liste n'est
    // écrite ici : un livre à Carrières de plus se MESURE au lieu de se recopier (#1825).
    const porteursDeCarriere = [...new Set(careers.map((c) => c.source.book))].sort();
    expect(porteursDeCarriere.length).toBeGreaterThan(0);
    expect([...audit.livresArtefact].sort()).toEqual(porteursDeCarriere);
    // L'ORDRE de `livres` est celui du parcours d'extraction : l'artefact ne le promet pas, et le
    // figer ici gèlerait un accident de génération. C'est l'ENSEMBLE qui est le contrat.
    // #1467 L1b V-FLIP-CONFIG : l'artefact ne porte aucune prose de provenance (aucune clé `__…`) —
    // « généré par » décrit le def, et vit au JSDoc de `defs/progression-schemas-derived.ts`. Ce volet
    // gèle l'ENVELOPPE de document, dont le `type` est ce que la fabrique vérifie au parse.
    expect(artefact.id).toBe('progression-schemas-derived');
    expect(artefact.type).toBe('progression-schemas.derived');
    expect(artefact.label).toBe('Schémas de progression (relevé dérivé)');
    expect(Object.keys(artefact).filter((k) => k.startsWith('__'))).toEqual([]);
  });

  it('la garde REFUSE une permutation entre deux niveaux (ce que la cardinalité laissait passer)', () => {
    // Réfutation par construction sur `tueur` (LDB folio 76) : le défaut fondateur de #905, rejoué sur
    // une COPIE de la donnée — les niveaux 3 et 4 échangés, tout le reste intact.
    const mute = JSON.parse(JSON.stringify(careerLevels)) as typeof careerLevels;
    const lv3 = mute.find((l) => l.career.id === 'tueur' && l.level === 3)!;
    const lv4 = mute.find((l) => l.career.id === 'tueur' && l.level === 4)!;
    [lv3.characteristics, lv4.characteristics] = [lv4.characteristics, lv3.characteristics];
    const ko = auditProgressionSchemas({ careerLevels: mute });
    expect(ko.violations.map((v) => `${v.career} ${v.level}`)).toEqual(['tueur 3', 'tueur 4']);
    // Le rapport porte de quoi rouvrir la page : folio, page PDF, colonne et teinte mesurée.
    const msg = formatViolation(ko.violations[0]);
    expect(msg).toContain('livre-de-base folio 76');
    expect(msg).toContain('page PDF 78');
    expect(msg).toMatch(/teinte [\d.]+\/[\d.]+\/[\d.]+/);
    // La cardinalité (3/1/1/1) et la disjonction, elles, restent satisfaites par la permutation :
    // c'est bien ce trou-là que cette garde ferme.
    const tueur = mute.filter((l) => l.career.id === 'tueur');
    expect(tueur.map((l) => l.characteristics.length).sort()).toEqual([1, 1, 1, 3]);
    expect(new Set(tueur.flatMap((l) => l.characteristics)).size).toBe(6);
  });

  it('le rapprochement de titre ignore casse, accents et recollage de petites capitales', () => {
    expect(normTitle('Frère Loup')).toBe(normTitle('frèreloup'));
    expect(normTitle("Joueur d'épée")).toBe(normTitle('JOUEUR D’ÉPÉE'));
  });

  it("le générateur écrit la forme CANONIQUE des datasets (serializeDataset), pas un JSON à lui", () => {
    // `src/data/serialize.test.ts` exige le round-trip byte-identique sur TOUT `src/data/*.json` :
    // un artefact généré doit sortir de Python exactement comme `JSON.stringify(v, null, 2)`.
    const raw = readFileSync(fileURLToPath(new URL('./progression-schemas.derived.json', import.meta.url)), 'utf8');
    expect(raw).toBe(serializeDataset(artefact));
    expect(raw.includes('\r')).toBe(false);
    const cles = artefact.schemas.map((s) => `${s.book} ${s.pdfpage} ${s.y}`);
    expect(new Set(cles).size).toBe(cles.length);
  });
});

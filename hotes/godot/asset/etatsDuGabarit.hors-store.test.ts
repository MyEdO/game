import { describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { BUILD_NEUTRE } from '../../../src/lib/corpulence.ts';
import { tableTotale } from '../../../src/lib/tableTotale.ts';
import { jouet } from '../../../scripts/personnage-3d/base/gabarit.testkit.ts';
import { etatsAuxFacteursNeutres, etatsDuGabarit, type EtatDuGabarit } from './etatsDuGabarit.ts';
import { grilleDesAppuis } from './evaluateur/grilleDesAppuis.ts';
import { cellulesDeSilhouettesAtteignables, coinsDeSilhouettesAtteignables, poidsDeSilhouettes, poidsDuGabarit, sensCuitsDuGabarit } from './gabarit.ts';
import { CARRURE_MOINS, CARRURE_PLUS, CORPULENCE } from './silhouettes.ts';
import { FACTEURS_NEUTRES, sontNeutres } from './facteursDuGabarit.ts';
import { fauteDeBornesDuGabarit, validerManifesteDeBase } from './manifesteDeBase.ts';

describe('domaine des silhouettes et du gabarit (#3104)', () => {
  it('tient pour neutres les seuls facteurs égaux chacun au neutre de sa propre clé', () => {
    expect(sontNeutres(FACTEURS_NEUTRES)).toBe(true);
    for (const cle of Object.keys(FACTEURS_NEUTRES) as (keyof typeof FACTEURS_NEUTRES)[]) {
      expect(sontNeutres({ ...FACTEURS_NEUTRES, [cle]: FACTEURS_NEUTRES[cle] + 0.1 }), cle).toBe(false);
    }
  });

  it('rend les états aux facteurs neutres, un par coin de silhouettes atteignable', () => {
    const { table, silhouettes } = jouet(), noms = silhouettes.map((s) => s.nom);
    for (const selection of [[], noms]) {
      const neutres = etatsAuxFacteursNeutres(table, selection);
      expect(neutres.every((e) => sontNeutres(e.facteurs))).toBe(true);
      expect(neutres.map((e) => e.poidsSilhouettes)).toEqual(coinsDeSilhouettesAtteignables(table, selection));
    }
  });

  it('refuse par son nom une liste de silhouettes absente aux opérations de domaine', () => {
    for (const operation of ['etatsAuxFacteursNeutres', 'appuis']) {
      const resultat = spawnSync(process.execPath, [fileURLToPath(new URL('../../../scripts/personnage-3d/base/gabarit.mjs', import.meta.url))], {
        input: JSON.stringify({ operation }), encoding: 'utf8',
      });
      expect(resultat.status).not.toBe(0);
      expect(resultat.stderr).toContain('silhouettes-absentes : liste des silhouettes requise');
    }
  });

  it('valide chaque plage autour du neutre reçu et la pondération neutre de chaque facteur', () => {
    const { table } = jouet();
    for (const neutre of Object.values(FACTEURS_NEUTRES)) {
      expect(fauteDeBornesDuGabarit({ min: neutre, max: neutre }, neutre)).toBeUndefined();
      expect(fauteDeBornesDuGabarit({ min: neutre + 0.1, max: neutre + 1 }, neutre)).toBeDefined();
    }
    expect(Object.values(poidsDuGabarit(FACTEURS_NEUTRES, table.bornes, {})).every((p) => p === 0)).toBe(true);
    for (const [st, attendu] of [
      [{ min: FACTEURS_NEUTRES.st - 0.1, max: FACTEURS_NEUTRES.st + 0.1 }, false],
      [{ min: FACTEURS_NEUTRES.st + 0.2, max: FACTEURS_NEUTRES.st + 0.4 }, true],
    ] as const) {
      const verdict = validerManifesteDeBase({ gabarit: { ...table, st } }, new Uint8Array());
      expect(verdict.ok).toBe(false);
      if (!verdict.ok) expect(verdict.ecarts.some((e) => e.ou === 'gabarit.st')).toBe(attendu);
    }
  });
  it('croise exactement les dix coins atteignables avec chaque jeu de facteurs', () => {
    const { table, silhouettes } = jouet(), noms = silhouettes.map((s) => s.nom);
    const etats = etatsDuGabarit(table, noms);
    const groupes = new Map<string, EtatDuGabarit[]>();
    for (const e of etats) {
      const cle = JSON.stringify(e.facteurs);
      groupes.set(cle, [...(groupes.get(cle) ?? []), e]);
    }
    expect(groupes.size).toBe(13);
    expect(etats).toHaveLength(13 * 10);
    for (const groupe of groupes.values()) {
      expect(groupe).toHaveLength(10);
      for (const sex of ['M', 'F'] as const) for (const build of [BUILD_NEUTRE, 1]) for (const st of [table.st.min, FACTEURS_NEUTRES.st, table.st.max]) {
        const poids = poidsDeSilhouettes({ sex, build, st }, table);
        expect(groupe.some((e) => noms.every((nom) => e.poidsSilhouettes[nom] === poids[nom]))).toBe(true);
      }
    }
    for (const e of etats) {
      expect(e.poidsSilhouettes[CARRURE_MOINS] * e.poidsSilhouettes[CARRURE_PLUS]).toBe(0);
      expect(e.poidsSilhouettes[CORPULENCE] * e.poidsSilhouettes[CARRURE_PLUS]).toBe(0);
      expect(e.poidsGabarit).toEqual(poidsDuGabarit(e.facteurs, table.bornes, e.poidsSilhouettes));
      expect(e.poidsReference).toEqual(poidsDuGabarit(e.facteurs, table.bornes, tableTotale(noms, () => 0)));
    }
  });

  it('partage les coins atteignables avec la grille des appuis pour chaque sous-ensemble de silhouettes', () => {
    const { table, silhouettes } = jouet();
    const noms = silhouettes.map((s) => s.nom);
    const sousEnsembles = noms.reduce<string[][]>((ensembles, nom) => [...ensembles, ...ensembles.map((s) => [...s, nom])], [[]]);
    for (const selection of sousEnsembles) {
      const domaine = etatsAuxFacteursNeutres(table, selection);
      const grille = grilleDesAppuis({ gabarit: table, silhouettes: selection });
      const attendus = new Set(domaine.map((e) => JSON.stringify(e.poidsSilhouettes)));
      expect(new Set(grille.map((e) => JSON.stringify(e.silhouettes)))).toEqual(attendus);
      const coins = coinsDeSilhouettesAtteignables(table, selection);
      expect(coins).toHaveLength(attendus.size);
      expect(new Set(coins.map((p) => JSON.stringify(p))).size).toBe(coins.length);
    }
  });

  it('émet quatre cellules affines qui couvrent les poids continus, l’axe de carrure_plus seul hors du cumul', () => {
    const { table, silhouettes } = jouet(), noms = silhouettes.map((s) => s.nom);
    const cellules = cellulesDeSilhouettesAtteignables(table, noms);
    expect(cellules).toHaveLength(4);
    const point = (cellule: (typeof cellules)[number], u: number, v: number) =>
      tableTotale(noms, (nom) => cellule.origine[nom] + u * cellule.colonnes[0][nom] + v * cellule.colonnes[1][nom]);
    for (const [index, cellule] of cellules.entries()) {
      const sex = index < 2 ? 'M' : 'F';
      const plus = index % 2 === 1;
      const extremite = plus ? table.st.max : table.st.min;
      if (plus) expect(noms.every((nom) => cellule.colonnes[0][nom] === 0)).toBe(true);
      for (const u of [0, 0.37, 1]) for (const v of [0, 0.61, 1]) {
        const poids = poidsDeSilhouettes({ sex, build: BUILD_NEUTRE + u * (1 - BUILD_NEUTRE),
          st: FACTEURS_NEUTRES.st + v * (extremite - FACTEURS_NEUTRES.st) }, table);
        const attendu = !plus ? point(cellule, u, v) : u >= v ? point(cellules[index - 1], u, 0) : point(cellule, 0, v);
        for (const nom of noms) expect(attendu[nom]).toBeCloseTo(poids[nom], 14);
      }
    }
    expect(cellulesDeSilhouettesAtteignables(table, [])).toEqual([]);
    expect(coinsDeSilhouettesAtteignables(table, [])).toEqual([{}]);
  });

  it('refuse une silhouette inconnue dans les deux consommateurs du domaine', () => {
    const { table } = jouet();
    const silhouettes = ['feminin', 'inconnue'];
    expect(() => etatsDuGabarit(table, silhouettes)).toThrow('silhouette-inconnue : inconnue');
    expect(() => grilleDesAppuis({ gabarit: table, silhouettes })).toThrow('silhouette-inconnue : inconnue');
  });

  it('marque exactement les sens cuits sans silhouette pour les normales de la porte', () => {
    const { table, silhouettes } = jouet(), noms = silhouettes.map((s) => s.nom);
    const points = etatsDuGabarit(table, noms).filter((e) => e.pointCuisson);
    const sens = sensCuitsDuGabarit(table.bornes);
    expect(points).toHaveLength(sens.length);
    for (const { cle, extremite } of sens) {
      expect(points.some((e) => JSON.stringify(e.facteurs) === JSON.stringify({ ...FACTEURS_NEUTRES, [cle]: extremite })
        && Object.values(e.poidsSilhouettes).every((p) => p === 0))).toBe(true);
    }
  });

  it('quotiente les coins équivalents quand des silhouettes sont absentes', () => {
    const { table } = jouet();
    const neutres = etatsDuGabarit(table, []);
    expect(neutres).toHaveLength(13);
    expect(neutres.find((e) => e.nom === 'neutre')?.facteurs).toEqual(FACTEURS_NEUTRES);
    const feminin = etatsDuGabarit(table, ['feminin']);
    expect(feminin).toHaveLength(13 * 2);
    expect(new Set(feminin.map((e) => JSON.stringify([e.facteurs, e.poidsSilhouettes]))).size).toBe(feminin.length);
  });
});

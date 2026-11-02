import { describe, it, expect } from 'vitest';
import { traumaById, consolidateAmputations, setTraumaCount, traumaCumulOps, traumaCharPenalties, traumaFicheById, permanentAmputations } from './trauma';
import type { Combatant, Trauma, HitLocation } from './types';
import { blessuresSurLeProfil, blessuresDeBase } from './combattantDeTest.testkit';

/**
 * #1318 E4/C-γ — la règle de COMPTAGE d'une séquelle vit sur SON entrée de `traumas.json`
 * (`TraumaFiche.cumul`) ; le moteur applique la règle déclarée sans énumérer aucune séquelle.
 * Un axe par test : `portee`, `unite`, `parPalier`, `escalade` (mode `remplace` ET `ajoute`).
 * RAW : LDB 18 l.247 (dents, « pour chaque paire… 1 Point de Sociabilité », « 1d10 dents » l.213 des
 * tables), l.251 (doigts, « 4 doigts ou plus → règle de la main tranchée »), l.273/277 (2 yeux/oreilles),
 * l.281 (« pour chaque orteil perdu, −1 Agilité et −1 Capacité de Combat »).
 */
const C = (traumas: Trauma[]): Combatant =>
  (blessuresSurLeProfil({
    id: 'c', label: 'C', kind: 'hero', conditions: [], skills: [], items: [],
    characteristics: { 'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 30, endurance: 30, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 },
    wounds: blessuresDeBase(10), traumas,
  }) as unknown as Combatant);

const pose = (id: string, loc: HitLocation, n?: number): Trauma => {
  const t = traumaById(id, undefined, loc);
  return n == null ? t : setTraumaCount(t, traumaFicheById(id), n);
};

describe('AXE `portee` — le regroupement est celui que l’entrée DÉCLARE', () => {
  it('`localisation` (doigts, l.251 « cette main ») : les deux bras restent DEUX séquelles', () => {
    const c = C([pose('doigt-ampute', 'brasG'), pose('doigt-ampute', 'brasD'), pose('doigt-ampute', 'brasD')]);
    consolidateAmputations(c);
    const doigts = (c.traumas ?? []).filter((t) => t.traumaId === 'doigt-ampute');
    expect(doigts).toHaveLength(2);
    expect(doigts.find((t) => t.location === 'brasG')!.count).toBe(1);
    expect(doigts.find((t) => t.location === 'brasD')!.count).toBe(2);
  });

  it('`localisation` (orteils, l.281) : chaque jambe garde SA séquelle — les zones restent identifiables', () => {
    const c = C([pose('orteil-ampute', 'jambeG'), pose('orteil-ampute', 'jambeD')]);
    consolidateAmputations(c);
    const orteils = (c.traumas ?? []).filter((t) => t.traumaId === 'orteil-ampute');
    expect(orteils.map((t) => t.location).sort()).toEqual(['jambeD', 'jambeG']);
    // …et la pénalité TOTALE reste celle du RAW (« pour chaque orteil perdu, −1 Ag et −1 CC ») : les ops
    // sont GLOBALES au porteur, donc la somme par membre vaut la somme d'un cumul global.
    expect(traumaCharPenalties(c, 'agilite').reduce((s, n) => s + n, 0)).toBe(-2);
    expect(traumaCharPenalties(c, 'capacite-de-combat').reduce((s, n) => s + n, 0)).toBe(-2);
  });

  it('`porteur` (dents, l.247) : une seule séquelle, quelle que soit la Localisation d’origine', () => {
    const c = C([pose('dents-perdues', 'tete', 3), pose('dents-perdues', 'tete', 2)]);
    consolidateAmputations(c);
    const dents = (c.traumas ?? []).filter((t) => t.traumaId === 'dents-perdues');
    expect(dents).toHaveLength(1);
    expect(dents[0].count).toBe(5);
  });
});

describe('AXE `unites` — la QUANTITÉ est déclarée par la LIGNE de Critique, pas par la séquelle', () => {
  it('les unités de la ligne ne comptent QUE pour les séquelles cumulatives', () => {
    const s = permanentAmputations(['langue-amputee', 'dents-perdues'], 'tete', 6);
    expect(s.find((x) => x.traumaId === 'dents-perdues')!.count).toBe(6);
    expect(s.find((x) => x.traumaId === 'langue-amputee')!.count).toBeUndefined();
  });

  it('sans unités déclarées, une occurrence = 1 unité', () => {
    const [doigt] = permanentAmputations(['doigt-ampute'], 'brasD');
    expect(doigt.count).toBe(1);
  });
});

describe('AXE `parPalier` — l’effet est l’op déclarée, à l’échelle du nombre de paliers', () => {
  it('dents : palier de 2 (l.247 « pour chaque paire ») — 1 dent = rien, 3 = −1 Soc, 4 = −2 Soc', () => {
    const fiche = traumaFicheById('dents-perdues');
    expect(traumaCumulOps(fiche, 1)).toEqual([]);
    expect(traumaCumulOps(fiche, 3)).toEqual([{ op: 'charMod', char: 'sociabilite', mod: -1 }]);
    expect(traumaCumulOps(fiche, 4)).toEqual([{ op: 'charMod', char: 'sociabilite', mod: -2 }]);
  });

  it('orteils : palier de 1 (l.281) — 3 orteils = −3 Ag ET −3 CC', () => {
    const ops = traumaCumulOps(traumaFicheById('orteil-ampute'), 3);
    expect(ops).toContainEqual({ op: 'charMod', char: 'agilite', mod: -3 });
    expect(ops).toContainEqual({ op: 'charMod', char: 'capacite-de-combat', mod: -3 });
  });

  it('les ops de BASE (non palières) survivent au comptage : l’œil garde sa perte de sens', () => {
    const ops = traumaCumulOps(traumaFicheById('oeil-perdu'), 2);
    expect(ops).toContainEqual({ op: 'senseLoss', sense: 'vue' });
    expect(ops).toContainEqual({ op: 'testMod', amount: -10, char: 'sociabilite' }); // −5 par orbite vide (l.273)
  });
});

describe('AXE `escalade` — seuil + mode déclarés par l’entrée', () => {
  it('`remplace` (doigts → main tranchée, l.251) : au seuil, les doigts DISPARAISSENT au profit de la main', () => {
    const c = C([pose('doigt-ampute', 'brasD', 4)]);
    const log = consolidateAmputations(c);
    expect((c.traumas ?? []).some((t) => t.traumaId === 'doigt-ampute')).toBe(false);
    expect((c.traumas ?? []).some((t) => t.traumaId === 'main-bras-ampute' && t.location === 'brasD')).toBe(true);
    expect(log.join(' ')).toMatch(/Main\/bras amputé/);
  });

  it('`remplace` : SOUS le seuil, rien n’escalade (3 doigts restent des doigts)', () => {
    const c = C([pose('doigt-ampute', 'brasD', 3)]);
    consolidateAmputations(c);
    expect((c.traumas ?? []).find((t) => t.traumaId === 'doigt-ampute')!.count).toBe(3);
    expect((c.traumas ?? []).some((t) => t.traumaId === 'main-bras-ampute')).toBe(false);
  });

  it('le JOURNAL nomme la séquelle atteinte ET son effet, DÉRIVÉ de ses ops déclarées', () => {
    const c = C([pose('oeil-perdu', 'tete'), pose('oeil-perdu', 'tete')]);
    const [ligne] = consolidateAmputations(c);
    expect(ligne).toContain('Cécité'); // le LABEL de la fiche cible, pas un id
    expect(ligne).toContain('−30 en'); // l'effet chiffré, lu sur les ops de la fiche
    expect(ligne).toContain('Esquive');
    expect(ligne).not.toMatch(/cecite|oeil-perdu/); // aucun id à l'écran
  });

  it('`ajoute` (oreilles → Surdité, l.277) : la séquelle comptée SURVIT à l’escalade', () => {
    const c = C([pose('oreille-perdue', 'tete'), pose('oreille-perdue', 'tete')]);
    consolidateAmputations(c);
    expect((c.traumas ?? []).find((t) => t.traumaId === 'oreille-perdue')!.count).toBe(2);
    expect((c.traumas ?? []).some((t) => t.traumaId === 'surdite')).toBe(true);
  });

  it('l’escalade `localisation` ne franchit pas le membre : 4 doigts à droite laissent la main GAUCHE intacte', () => {
    const c = C([pose('doigt-ampute', 'brasD', 4), pose('doigt-ampute', 'brasG', 2)]);
    consolidateAmputations(c);
    expect((c.traumas ?? []).some((t) => t.traumaId === 'main-bras-ampute' && t.location === 'brasG')).toBe(false);
    expect((c.traumas ?? []).find((t) => t.traumaId === 'doigt-ampute')!.location).toBe('brasG');
  });
});

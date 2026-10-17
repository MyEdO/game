/**
 * Tests comportementaux — Fièvre Cérébrale Pourpre + symptômes Délire / Gonflement
 * Source : EDO (L'Ennemi dans l'Ombre) Appendice 2, p. 145-147.
 *
 * Prouve :
 *  1. La maladie se contracte, produit les bons symptômes, et guérit correctement.
 *  2. Les symptômes Délire et Gonflement existent dans le catalogue et ont la bonne source.
 *  3. Les passifs combinés (Convulsions + Fièvre) pénalisent les bonnes caractéristiques.
 *  4. Le Test de fin Persistant (Difficile) résout la guérison sur réussite.
 *
 * NOTE — Tableaux d'exposition hydrique MSRC 16 : les 3 tableaux (Source d'eau, Blessures/États,
 * Maladies transmissibles) sont des données purement référentielles (toutes les maladies référencées
 * existent déjà dans maladies.json). Ils n'ont pas été câblés dans le moteur car aucun sous-système
 * d'exposition n'existe encore ; ils sont « not-yet-wired » et ne nécessitent pas de nouvelle entité.
 */
import { describe, it, expect } from 'vitest';
import type { Combatant } from './types';
import { makeRNG } from './dice';
import { MINUTES_PER_DAY } from './clock';
import { contractDisease, tickDisease, diseasePassiveOps } from './disease';
import { porteEntretien, applique } from './upkeepPorte.testkit';
import { findSymptomById, findDiseaseById } from '../data';

const sick = (over: Partial<Combatant> = {}): Combatant =>
  ({ label: 'Cobaye', diseases: [], ...over }) as Combatant;

// ── Maladie ────────────────────────────────────────────────────────────────────────────────────

describe('Fièvre Cérébrale Pourpre — EDO App.2 p.145', () => {
  it("contractDisease → incubation 1d10 HEURES (sous-journalière, EDO App.2) — vrai temps, plus arrondi à 0", () => {
    // incubation 1d10 heures (jet=5 → 300 min) : la dette « heures ≈ 0 jour » est levée → phase incubation.
    const dz = contractDisease('fievre-cerebrale-pourpre', { int: () => 5 })!;
    expect(dz).not.toBeNull();
    expect(dz.phase).toBe('incubation');
    expect(dz.minutesLeft).toBe(5 * 60);
    const c = sick({ diseases: [dz] });
    tickDisease(c, 5 * 60, { int: () => 5 }, () => {}); // 5 h écoulées (sous la journée) → symptômes ACTIFS
    expect(c.diseases![0].phase).toBe('active');
  });

  it("symptômes requis (6) : convulsions, delire, fievre, gonflement, persistant, toxine", () => {
    const dz = contractDisease('fievre-cerebrale-pourpre', makeRNG(1))!;
    expect(dz.symptoms.map((s) => s.symptomId).sort()).toEqual([
      'convulsions', 'delire', 'fievre', 'gonflement', 'persistant', 'toxine',
    ]);
  });

  it("fièvre porte severity 'grave' ; persistant porte difficulty 'difficile'", () => {
    const dz = contractDisease('fievre-cerebrale-pourpre', makeRNG(1))!;
    const fievre = dz.symptoms.find((s) => s.symptomId === 'fievre');
    expect(fievre?.severity).toBe('grave');
    const persistant = dz.symptoms.find((s) => s.symptomId === 'persistant');
    expect(persistant?.difficulty).toBe('difficile');
    expect(dz.persistDifficulty).toBe('difficile');
  });

  it("passifs cumulés (convulsions −10 + fièvre −10) : CC, CT, F, E, Ag, Dex pénalisés ×2 ; Soc pénalisé ×1", () => {
    const dz = contractDisease('fievre-cerebrale-pourpre', makeRNG(1), { incubation: 0, duration: 3 })!;
    const c = sick({ diseases: [dz] });
    const ops = diseasePassiveOps(c);
    const mods = ops.map((m) => m.op).filter((o) => o.op === 'testMod') as { op: string; char: string; amount: number }[];
    const byChar: Record<string, number> = {};
    for (const m of mods) byChar[m.char] = (byChar[m.char] ?? 0) + m.amount;
    // Convulsions passive (−10 sur CC/CT/F/E/Ag/Dex) + Fièvre passive (−10 sur CC/CT/F/E/Ag/Dex/Soc)
    expect(byChar['capacite-de-combat']).toBe(-20);
    expect(byChar['sociabilite']).toBe(-10); // fièvre seule
  });

  it("tick jour 1 — Toxine (Très Facile) réussit ; Persistant (Difficile) réussit → guérison", () => {
    const dz = contractDisease('fievre-cerebrale-pourpre', makeRNG(1), { incubation: 0, duration: 1 })!;
    const c = sick({ diseases: [dz] });
    // Les deux Tests (Toxine Très Facile, Persistant Difficile) partent à la porte ; issues INJECTÉES : réussis.
    const { specs, defer } = porteEntretien();
    tickDisease(c, MINUTES_PER_DAY, { int: () => 1 }, defer);
    const log = specs.flatMap((s) => applique(c, s, { success: true }));
    expect(c.diseases).toHaveLength(0);
    expect(log.some((l) => /guérit/.test(l))).toBe(true);
  });

  it("findDiseaseById résout la maladie", () => {
    const def = findDiseaseById('fievre-cerebrale-pourpre');
    expect(def).toBeTruthy();
    expect(def!.label).toBe('Fièvre Cérébrale Pourpre');
    expect(def!.contractDifficulty).toBe('accessible');
  });
});

// ── Symptôme Délire ────────────────────────────────────────────────────────────────────────────

describe('Symptôme Délire — EDO App.2 p.145', () => {
  it("existe dans le catalogue avec id, label et source corrects", () => {
    const s = findSymptomById('delire');
    expect(s).toBeTruthy();
    expect(s!.id).toBe('delire');
    expect(s!.label).toBe('Délire');
    expect(s!.source).toEqual({ book: 'ennemi-dans-l-ombre', page: 145 });
  });

  it("purely descriptif : pas de passive ni onTick ni capabilities (test FM toutes les heures = non exprimable dans le moteur actuel)", () => {
    const s = findSymptomById('delire')!;
    expect(s.passive).toBeUndefined();
    expect(s.onTick).toBeUndefined();
    expect(s.capabilities).toBeUndefined();
  });

  it("desc contient la table d10 (heures-scale) et le traitement", () => {
    const s = findSymptomById('delire')!;
    expect(s.desc).toContain('Force Mentale');
    expect(s.desc).toContain('toutes les heures');
    expect(s.desc).toContain('Épisode lucide');
    expect(s.desc).toContain('Hallucinations');
    expect(s.desc).toContain('Traitement');
  });
});

// ── Symptôme Gonflement ────────────────────────────────────────────────────────────────────────

describe('Symptôme Gonflement — EDO App.2 folio 146', () => {
  it("existe dans le catalogue avec id, label et source corrects", () => {
    const s = findSymptomById('gonflement');
    expect(s).toBeTruthy();
    expect(s!.id).toBe('gonflement');
    expect(s!.label).toBe('Gonflement');
    // Folio MESURÉ au `data-folio` : le début de l'App.2 est folio 145 (marqueur l.56), mais le
    // symptôme Gonflement (l.143) suit le marqueur l.129 → folio 146. Son voisin Délire (l.127) reste
    // en 145 : les deux enjambent la coupure. La valeur 145 verrouillée ici venait du folio d'OUVERTURE
    // de l'appendice, pas de la page du symptôme — corrigée avec le stock (#1117 L0b).
    expect(s!.source).toEqual({ book: 'ennemi-dans-l-ombre', page: 146 });
  });

  it("purely descriptif : pas de passive ni onTick (effets dépendent de la localisation)", () => {
    const s = findSymptomById('gonflement')!;
    expect(s.passive).toBeUndefined();
    expect(s.onTick).toBeUndefined();
  });

  it("desc contient la table de localisation (Tête, Bras, Corps, Jambe)", () => {
    const s = findSymptomById('gonflement')!;
    expect(s.desc).toContain('Tête');
    expect(s.desc).toContain('Bras');
    expect(s.desc).toContain('Corps');
    expect(s.desc).toContain('Jambe');
    expect(s.desc).toContain('Guérison Difficile');
  });
});

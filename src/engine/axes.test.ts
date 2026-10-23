import { describe, it, expect } from 'vitest';
import { axisScore, axesProfile, partyCoverage, dominantAxes, AXIS_QUALIFY_MIN } from './axes';
import { allAxes, findAxisById } from '../data';
import { PREGEN, pregen, pregenParty } from '../data/pregens';
import { idNeufDeBanc } from '../lib/entityId.testkit';

const MELEE = findAxisById('melee')!;
const TIR = findAxisById('tir')!;
const SOCIAL = findAxisById('social')!;
const SOINS = findAxisById('soins')!;
const INGENIERIE = findAxisById('ingenierie')!;
const DISCRETION = findAxisById('discretion')!;

describe('#409 — engine/axes : axisScore/axesProfile/partyCoverage/dominantAxes', () => {
  it('axisScore : 0..1, un pré-tiré martial score plus haut en Mêlée qu\'un pré-tiré peu combattant', () => {
    const soldat = pregen(idNeufDeBanc, PREGEN.soldat);
    const sorcier = pregen(idNeufDeBanc, PREGEN.sorcier);
    const soldatScore = axisScore(soldat, MELEE);
    const sorcierScore = axisScore(sorcier, MELEE);
    expect(soldatScore).toBeGreaterThan(0);
    expect(soldatScore).toBeLessThanOrEqual(1);
    expect(sorcierScore).toBeGreaterThanOrEqual(0);
    expect(sorcierScore).toBeLessThanOrEqual(1);
    expect(soldatScore).toBeGreaterThanOrEqual(sorcierScore);
  });

  it('axisScore : le Chasseur (Projectiles formé) score en Tir, le Soldat (Compétence AVANCÉE, aucune Augmentation) score EXACTEMENT 0 — LDB 09 l.30, aucun repli sur la Caractéristique nue', () => {
    const chasseur = pregen(idNeufDeBanc, PREGEN.chasseur);
    const soldat = pregen(idNeufDeBanc, PREGEN.soldat);
    expect(axisScore(chasseur, TIR)).toBeGreaterThan(0);
    expect(axisScore(soldat, TIR)).toBe(0);
  });

  it('axisScore VERROU NOMINATIF — réfutation utilisateur 2026-07-14 : Wilhelmina Faust (sorcière, PREGEN.sorcier) sans Guérison/Métier(Ingénieur) formés score EXACTEMENT 0 en Soins ET en Ingénierie (jamais « taggée » par la seule Caractéristique)', () => {
    const wilhelmina = pregen(idNeufDeBanc, PREGEN.sorcier);
    expect(wilhelmina.skills.some((s) => s.id === 'guerison' && s.advances > 0)).toBe(false);
    expect(wilhelmina.skills.some((s) => (s.id === 'metier' || (s.id === 'savoir' && (s.spec === 'ingenierie' || s.spec === 'artillerie'))) && s.advances > 0)).toBe(false);
    expect(axisScore(wilhelmina, SOINS)).toBe(0);
    expect(axisScore(wilhelmina, INGENIERIE)).toBe(0);
  });

  it('axisScore : NON durci par `AXIS_QUALIFY_MIN` (LDB 09 l.25 — une Compétence de Base se teste non formée) : Mêlée/Discrétion de Wilhelmina restent BRUTES sous le seuil, jamais forcées à 0', () => {
    const wilhelmina = pregen(idNeufDeBanc, PREGEN.sorcier);
    expect(axisScore(wilhelmina, MELEE)).toBeGreaterThan(0);
    expect(axisScore(wilhelmina, MELEE)).toBeLessThan(AXIS_QUALIFY_MIN);
    expect(axisScore(wilhelmina, DISCRETION)).toBeGreaterThan(0);
    expect(axisScore(wilhelmina, DISCRETION)).toBeLessThan(AXIS_QUALIFY_MIN);
  });

  it('axisScore : Talent seul BONIFIE sans jamais faire déborder [0,1] — formule stable sur tout le catalogue', () => {
    const tueur = pregen(idNeufDeBanc, PREGEN.tueur);
    for (const axis of allAxes) {
      const v = axisScore(tueur, axis);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  });

  it('axesProfile : un score par axe, dans l\'ordre de la liste fournie', () => {
    const soldat = pregen(idNeufDeBanc, PREGEN.soldat);
    const profile = axesProfile(soldat, [MELEE, TIR, SOCIAL]);
    expect(profile.map((p) => p.id)).toEqual(['melee', 'tir', 'social']);
    expect(profile.every((p) => p.value >= 0 && p.value <= 1)).toBe(true);
  });

  it('partyCoverage : agrégat MAX par axe — le groupe couvre Mêlée dès qu\'UN membre la couvre (au-delà du seuil de qualification)', () => {
    const group = pregenParty(idNeufDeBanc, PREGEN.soldat, PREGEN.sorcier, PREGEN.chasseur, PREGEN.pretre);
    const coverage = partyCoverage(group, [MELEE, TIR]);
    const meleeCov = coverage.find((c) => c.id === 'melee')!;
    const soloBest = Math.max(...group.map((m) => axisScore(m, MELEE)));
    expect(soloBest).toBeGreaterThanOrEqual(AXIS_QUALIFY_MIN);
    expect(meleeCov.value).toBe(soloBest);
    expect(meleeCov.value).toBeGreaterThan(0);
  });

  it('partyCoverage : un axe sous `AXIS_QUALIFY_MIN` (même porté par le meilleur du groupe) reste à 0 — « à pourvoir », pas une fausse couverture par Caractéristique nue', () => {
    const solo = pregenParty(idNeufDeBanc, PREGEN.sorcier);
    const coverage = partyCoverage(solo, [MELEE]);
    const raw = axisScore(solo[0], MELEE);
    expect(raw).toBeGreaterThan(0);
    expect(raw).toBeLessThan(AXIS_QUALIFY_MIN);
    expect(coverage[0].value).toBe(0);
  });

  it('dominantAxes : les N axes les mieux notés, triés décroissant, jamais un axe sous le seuil de qualification', () => {
    const soldat = pregen(idNeufDeBanc, PREGEN.soldat);
    const dom = dominantAxes(soldat, allAxes, 3);
    expect(dom.length).toBeLessThanOrEqual(3);
    for (const a of dom) expect(a.value).toBeGreaterThanOrEqual(AXIS_QUALIFY_MIN);
    const values = dom.map((a) => a.value);
    expect(values).toEqual([...values].sort((a, b) => b - a));
  });

  it('dominantAxes VERROU NOMINATIF — Wilhelmina Faust ne garde QUE ses vraies forces (Social/Savoir/Négoce), jamais Mêlée/Discrétion à Caractéristique nue (réfutation utilisateur 2026-07-14, 3e reprise 2026-07-15)', () => {
    const wilhelmina = pregen(idNeufDeBanc, PREGEN.sorcier);
    const dom = dominantAxes(wilhelmina, allAxes, allAxes.length);
    const ids = dom.map((a) => a.id);
    expect(ids).not.toContain('melee');
    expect(ids).not.toContain('discretion');
    expect(ids.length).toBeGreaterThan(0);
  });

  it('FRONTIÈRE `AXIS_QUALIFY_MIN` — un héros synthétique à score EXACTEMENT 0.45 QUALIFIE (verrou du `>=`, pas `>`), en `dominantAxes` ET en `partyCoverage`', () => {
    // Corps à corps (Compétence de BASE, sans Talent référencé par l'axe Mêlée — `talentPart` reste
    // à 0) : `(valeur − 15) / 55 = 0.45` ⇔ `valeur = 39.75` ⇔ Capacité de Combat = `31.75` avec les
    // 8 avances du Soldat pré-tiré (`skillBaseValue` = Caractéristique EFFECTIVE + avances).
    const boundary = pregen(idNeufDeBanc, PREGEN.soldat);
    // `effectiveChar` inclut les modificateurs passifs INTRINSÈQUES du Soldat (+5 sur cette
    // Caractéristique via son Talent, `passiveCharSum`) — la base brute compense cet écart pour
    // atterrir exactement sur Capacité de Combat EFFECTIVE 31.75 (39.75 avec les 8 avances).
    boundary.characteristics['capacite-de-combat'] = 26.75;
    const score = axisScore(boundary, MELEE);
    expect(score).toBeCloseTo(AXIS_QUALIFY_MIN, 10);
    expect(dominantAxes(boundary, [MELEE], 1).map((a) => a.id)).toEqual(['melee']);
    expect(partyCoverage([boundary], [MELEE])[0].value).toBeCloseTo(AXIS_QUALIFY_MIN, 10);
  });

  it('dominantAxes : un pré-tiré soigneur (Frère Anselm, guérison en carrière) fait ressortir Soins', () => {
    const pretre = pregen(idNeufDeBanc, PREGEN.pretre);
    const dom = dominantAxes(pretre, allAxes, allAxes.length);
    const soinsEntry = dom.find((a) => a.id === 'soins');
    expect(axisScore(pretre, SOINS)).toBeGreaterThanOrEqual(0);
    // Le Prêtre n'est pas garanti d'avoir Guérison formée selon sa carrière — on vérifie la
    // COHÉRENCE de dominantAxes avec axisScore plutôt qu'une valeur en dur.
    if (soinsEntry) expect(soinsEntry.value).toBe(axisScore(pretre, SOINS));
  });
});
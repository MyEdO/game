/**
 * Colère des dieux, rangées 26-30 et 56-60 (LDB 40 l.61, l.70) : « vous subissez une pénalité de -10 à toutes
 * les Compétences [à une Compétence] associées à votre divinité (déterminées par le MJ) pour les 1d10 + (Points
 * de Péché) prochaines heures [prochains jours] ».
 *
 * Contrat : la liste du dieu du prêtre (`GodData.associatedSkills`, maison, arbitrage #1653) porte le malus ;
 * 26-30 les frappe toutes pour des HEURES, 56-60 une seule tirée au hasard pour des JOURS ; à l'échéance
 * d'horloge, le malus tombe. Sans divinité ou sans liste, la rangée est sans effet et le dit.
 */
import { idsDeTest } from '../engine/idsDeTest.testkit';
import { describe, it, expect, beforeEach } from 'vitest';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { herosDeScenario } from '../scenes/test-scenarios/_heros';
import { findGodById, gods } from '../data';
import { setDataset } from '../data/overrides';
import { rollMiscast, miscastRowSource, miscastTableId } from '../engine/miscast';
import { applyOps } from '../engine/ops';
import { priestCult } from '../engine/magic';
import { testValue } from '../engine/skills';
import { MINUTES_PER_DAY } from '../engine/clock';
import { aucunDe, desEnSuite } from '../engine/dice.testkit';
import type { Combatant } from '../engine/types';
import type { RNG } from '../engine/dice';

const MAINTENANT = 8 * 60;

let banc: Banc;
beforeEach(() => {
  banc = ouvrirLeBanc();
  banc.setState({ gameTime: MAINTENANT });
});

const pretre = (): Combatant => herosDeScenario(idsDeTest, 'pretre') as Combatant;

/** Les Compétences associées au dieu du prêtre, lues dans la donnée. */
function associees(p: Combatant): string[] {
  const dieu = findGodById(priestCult(p)!);
  return dieu!.associatedSkills!;
}

/** Tire la rangée de Colère dont le dé NATUREL est `de` sous `peche` Points de Péché, puis l'applique. */
function subirLaColere(p: Combatant, peche: number, de: number, rng: RNG) {
  const m = rollMiscast('colere', aucunDe, peche, undefined, de);
  const lignes = applyOps(p, m.ops, { idNeuf: idsDeTest, rng, label: m.label, now: MAINTENANT, source: miscastRowSource(miscastTableId('colere'), m.rowId) });
  return { m, lignes };
}

const valeurs = (p: Combatant, skills: readonly string[]) => skills.map((s) => testValue(p, { skill: { id: s } }));
const echeances = (p: Combatant) => (p.activeEffects ?? []).map((e) => (e.duration.scale === 'clock' ? e.duration.until : null));

describe('Colère des dieux — malus aux Compétences associées à la divinité (LDB 40 l.61, l.70)', () => {
  it('26-30 « Vous ne comprenez pas ma volonté » : −10 à TOUTES les Compétences du dieu pour 1d10 + (Points de Péché) heures', () => {
    const p = pretre();
    const skills = associees(p);
    const avant = valeurs(p, skills);
    const horsListe = testValue(p, { skill: { id: 'escalade' } });
    const { m } = subirLaColere(p, 1, 16, desEnSuite([4])); // 16 + 10 × 1 = 26 ; 1d10 = 4 → 5 heures
    expect(m.rowId).toBe('colere-vous-ne-comprenez-pas-ma-volonte');
    expect(valeurs(p, skills)).toEqual(avant.map((v) => v - 10));
    expect(testValue(p, { skill: { id: 'escalade' } })).toBe(horsListe);
    expect(echeances(p)).toEqual([MAINTENANT + 5 * 60]);

    banc.setState({ party: [p] });
    banc.getState().avancerLeTemps(5 * 60 - 1);
    expect(valeurs(banc.getState().party[0], skills)).toEqual(avant.map((v) => v - 10));
    banc.getState().avancerLeTemps(1);
    expect(valeurs(banc.getState().party[0], skills)).toEqual(avant);
  });

  it('56-60 « Je ne vous aiderai pas » : −10 à UNE Compétence du dieu, tirée au hasard, pour 1d10 + (Points de Péché) jours', () => {
    const p = pretre();
    const skills = associees(p);
    const avant = valeurs(p, skills);
    const { m } = subirLaColere(p, 3, 26, desEnSuite([1, 7])); // 26 + 10 × 3 = 56 ; tirage → 2e Compétence ; 1d10 = 7 → 10 jours
    expect(m.rowId).toBe('colere-je-ne-vous-aiderai-pas');
    expect(valeurs(p, skills)).toEqual(avant.map((v, i) => (i === 1 ? v - 10 : v)));
    expect(echeances(p)).toEqual([MAINTENANT + 10 * MINUTES_PER_DAY]);

    banc.setState({ party: [p] });
    banc.getState().avancerLeTemps(10 * MINUTES_PER_DAY - 1);
    expect(valeurs(banc.getState().party[0], skills)).toEqual(avant.map((v, i) => (i === 1 ? v - 10 : v)));
    banc.getState().avancerLeTemps(1);
    expect(valeurs(banc.getState().party[0], skills)).toEqual(avant);
  });

  it('le tirage de 56-60 suit le dé : un autre tirage frappe une autre Compétence de la liste', () => {
    const p = pretre();
    const skills = associees(p);
    const avant = valeurs(p, skills);
    subirLaColere(p, 3, 26, desEnSuite([0, 7]));
    expect(valeurs(p, skills)).toEqual(avant.map((v, i) => (i === 0 ? v - 10 : v)));
  });

  it('sans divinité : la rangée est sans effet, aucun dé tiré, et le journal le dit', () => {
    const soldat = herosDeScenario(idsDeTest, 'soldat') as Combatant;
    expect(priestCult(soldat)).toBeUndefined();
    const effets = structuredClone(soldat.activeEffects ?? []);
    const { lignes } = subirLaColere(soldat, 1, 16, aucunDe);
    expect(soldat.activeEffects ?? []).toEqual(effets);
    expect(lignes.join('\n')).toMatch(/aucune Compétence associée à sa divinité/);
  });

  it('dieu sans liste : la rangée est sans effet, aucun dé tiré, et le journal le dit', () => {
    const p = pretre();
    const culte = priestCult(p)!;
    const initiaux = gods.slice();
    setDataset('gods', initiaux.map((g) => (g.id === culte ? { ...g, associatedSkills: undefined } : g)));
    try {
      const effets = structuredClone(p.activeEffects ?? []);
      const { lignes } = subirLaColere(p, 3, 26, aucunDe);
      expect(p.activeEffects ?? []).toEqual(effets);
      expect(lignes.join('\n')).toMatch(/aucune Compétence associée à sa divinité/);
    } finally {
      setDataset('gods', initiaux);
    }
  });
});

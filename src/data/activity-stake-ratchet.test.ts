/**
 * CLIQUET NOMINATIF « une Activité à JET dit son ENJEU » (#1117 L3) — troisième pendant des cliquets
 * du chantier, à l'étage de l'ACTIVITÉ : `state/cascade-step-stake-guard` tient les étapes de
 * cascade, `ui/mono-stake-ratchet` les coquilles de modale, celui-ci la DONNÉE qui les alimente.
 *
 * Le prédicat de jet est celui du moteur (`activityRolls`), pas un grep : une Activité LANCE si elle
 * déclare des `skills`/`char`/`freeSkill`, ou si son résolveur dérive la compétence du héros
 * (Revenus, Artisanat, Apprentissage, Réputation). Symétrie EXIGÉE dans les deux sens :
 *  - une Activité qui LANCE et qui est JOUABLE porte son enjeu (stock restant nominatif, décroissant) ;
 *  - une Activité SANS Test n'en porte AUCUN (pas de zone d'enjeu muette au pied du volet).
 */
import { describe, it, expect } from 'vitest';
import { ACTIVITIES, activityRolls } from '../engine/activities';
import {
  resolveStake, activityStakeRef, hasActivityStake,
  regles, skills, symptoms, etats, talents, qualities, spells, characteristics, psychologies,
} from './index';

/** Activités à JET encore SANS enjeu — chacune motivée. Retirer un id d'ici est le geste de solde. */
const SANS_ENJEU: Record<string, string> = {};

/** Activités à JET dont la dette `blocked` retire l'entrée de tous les catalogues jouables : leur
 *  issue n'est pas écrite, donc rien de mécanique à mettre en jeu. Elles reviennent avec leur
 *  résolveur — l'enjeu naîtra avec lui. Mesuré le 2026-08-06 : 7 sur 53 Activités à jet. */
const BLOQUEES_SANS_ISSUE = [
  'accomplir-un-rituel', 'alchimie-ordinaire', 'ameliorer-un-familier', 'brasser-une-potion',
  'ecrire-des-parchemins', 'haute-alchimie', 'reunir-des-ingredients',
];

describe('cliquet — une Activité à JET dit son ENJEU (#1117 L3)', () => {
  const aJet = ACTIVITIES.filter((a) => activityRolls(a));
  const jouables = aJet.filter((a) => !a.blocked);

  it('le stock mesuré est celui attendu (le prédicat de jet ne dérive pas en silence)', () => {
    // 53 → 54 et 46 → 47 (#1612, 2026-09-06) : l'Activité Mendier (`LDB 09 l.97`) entre au catalogue.
    // Elle LANCE (Test de Charme) et n'est pas `blocked` : elle porte donc son `stake`, comme ses 46
    // sœurs jouables. Le compte des Activités SANS jet ne bouge pas.
    expect(aJet.length).toBe(54);
    expect(jouables.length).toBe(47);
    expect(ACTIVITIES.filter((a) => !activityRolls(a)).length).toBe(9);
  });

  it('toute Activité JOUABLE qui lance porte son enjeu (stock restant EXACTEMENT celui énuméré)', () => {
    const sans = jouables.filter((a) => !a.stake).map((a) => a.id).sort();
    const neufs = sans.filter((id) => !(id in SANS_ENJEU));
    expect(neufs, 'Activité à jet SANS enjeu — le joueur doit savoir ce que son Test met en jeu (`stake`, activities.json)').toEqual([]);
    const perimes = Object.keys(SANS_ENJEU).filter((id) => !sans.includes(id));
    expect(perimes, 'stock PÉRIMÉ : ces Activités ont désormais leur enjeu — retirer leur ligne').toEqual([]);
  });

  it('les Activités à jet SANS enjeu bloquées sont EXACTEMENT celles énumérées', () => {
    const bloquees = aJet.filter((a) => a.blocked && !a.stake).map((a) => a.id).sort();
    expect(bloquees).toEqual([...BLOQUEES_SANS_ISSUE].sort());
  });

  it('aucune Activité SANS Test ne porte d’enjeu (pas de zone muette au pied du volet)', () => {
    const muettes = ACTIVITIES.filter((a) => !activityRolls(a) && a.stake).map((a) => a.id);
    expect(muettes, 'une Activité sans Test n’a rien à mettre en jeu').toEqual([]);
  });

  it('chaque enjeu RÉSOUT par la porte unique, et rend une porte de lecture vivante', () => {
    const FOYERS: Record<string, { id: string }[]> = {
      regles, skills, symptoms, etats, talents, qualities, spells, characteristics, psychologies,
      activities: ACTIVITIES,
    };
    const morts: string[] = [];
    for (const a of ACTIVITIES.filter((x) => x.stake)) {
      const r = resolveStake(activityStakeRef(a.id));
      expect(r.text, `${a.id} : enjeu vide`).not.toBe('');
      const rule = r.rule!;
      if (!(FOYERS[rule.category] ?? []).some((x) => x.id === rule.id)) morts.push(`${a.id} → ${rule.category}:${rule.id}`);
    }
    expect(morts, 'renvoi vers un foyer inexistant').toEqual([]);
  });

  it('le FOYER par défaut est l’Activité elle-même, et il PORTE la règle (desc verbatim)', () => {
    // Amendement A (#1117) : pas de fiche `regles.json` doublon — mais un foyer sans règle serait
    // une porte qui n'ouvre sur rien : une Activité dont l'enjeu ne nomme pas d'autre foyer doit
    // porter sa `desc` verbatim.
    const creuses = ACTIVITIES.filter((a) => a.stake && !a.rule && !a.desc).map((a) => a.id);
    expect(creuses, 'enjeu renvoyant à une fiche d’Activité SANS desc verbatim — le ⓘ n’ouvrirait sur aucune règle').toEqual([]);
    // Le seul foyer DÉPORTÉ mesuré : l'Augure, dont la règle jouée est la table des Symboles.
    expect(ACTIVITIES.filter((a) => a.rule).map((a) => `${a.id} → ${a.ruleCategory}:${a.rule}`))
      .toEqual(['augure → regles:tableau-augure']);
  });

  it('FAIL-CLOSED : la porte refuse une Activité sans enjeu et un id inconnu', () => {
    expect(hasActivityStake('recuperer')).toBe(false); // Activité SANS Test (EDOC 8 l.176)
    expect(hasActivityStake('revenus')).toBe(true);
    expect(() => activityStakeRef('recuperer')).toThrow(/aucun enjeu authoré/);
    expect(() => activityStakeRef('id-qui-n-existe-pas')).toThrow(/aucun enjeu authoré/);
  });

  it('FAIL-CLOSED : le prédicat de jet voit les 4 formes, et ne voit pas une Activité sans Test', () => {
    expect(activityRolls({ skills: [{ id: 'ragot' }] })).toBe(true);
    expect(activityRolls({ char: 'intelligence' })).toBe(true);
    expect(activityRolls({ freeSkill: [{ id: 'orientation' }] })).toBe(true);
    expect(activityRolls({ resolver: 'income' })).toBe(true); // compétence dérivée du héros
    // Un résolveur QUELCONQUE ne suffit pas : seuls ceux qui DÉRIVENT la compétence comptent
    // (`identify` lance par ses `skills` authorées, pas par son résolveur).
    expect(activityRolls({ resolver: 'identify' })).toBe(false);
    // Le Rassemblement (ADE II 8 l.122) lance par ses `skills` en donnée : Résistance.
    expect(activityRolls(ACTIVITIES.find((a) => a.id === 'rassemblement')!)).toBe(true);
    expect(activityRolls({})).toBe(false);
    expect(activityRolls({ skills: [] })).toBe(false);
  });
});

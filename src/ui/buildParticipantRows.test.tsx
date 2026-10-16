// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { ReactNode } from 'react';
import { buildParticipantRows, crewRoleRow, type ParticipantRow } from './buildParticipantRows';
import { isBuiltRollRow } from './rollRowBuild';
import { RollShell } from './RollShell';
import { refLabel } from '../data';
import { refusNePeutTenter } from '../engine/skills';
import type { Combatant } from '../engine/types';

/**
 * #1117 G1 — SOURCE UNIQUE du libellé de LIGNE d'une rangée-participant (Z5) : il se DÉRIVE de la
 * paire `{skillId, spec}` par le résolveur canonique. Le producteur peut porter un libellé de RÔLE
 * (provenance) : il ne doit JAMAIS devenir le nom de la ligne — c'est le défaut vu en recette
 * (« Timonier » là où le jet est « Voile (Chaland) »).
 */
const actor = { id: 'h1', label: 'Hilda', kind: 'hero' } as Combatant;

const bundle = {
  onRoll: () => {}, onReroll: () => {}, onBonusSL: () => {}, onDarkPact: () => {}, onForce: () => {},
  // La modale ne fournit QUE sa présentation — ici avec un libellé de rôle, comme le naval le faisait.
  row: (part: { label?: string }, a: Combatant) => ({ combatant: a, pending: { label: part.label ?? a.label, base: 40, target: 40 } }),
};

describe('buildParticipantRows — le libellé de ligne vient de {skillId, spec} (#1117)', () => {
  it('la spécialisation est rendue : « Voile (Chaland) », jamais le rôle', () => {
    const rows = buildParticipantRows(
      [{ id: 'h1', interactive: true, result: null, skillId: 'voile', spec: 'chaland', label: 'Timonier' } as never],
      [actor], bundle as never,
    );
    expect(rows[0].row.pending!.label).toBe(refLabel('skills', { id: 'voile', spec: 'chaland' }));
    expect(rows[0].row.pending!.label).not.toBe('Timonier');
  });

  it('sans paire déclarée, la présentation de la modale fait foi (aucune invention)', () => {
    const rows = buildParticipantRows(
      [{ id: 'h1', interactive: true, result: null, label: 'Timonier' } as never],
      [actor], bundle as never,
    );
    expect(rows[0].row.pending!.label).toBe('Timonier');
  });

  it('post-jet : la ligne résolue porte AUSSI la Compétence dérivée', () => {
    const withResult = {
      onRoll: () => {}, onReroll: () => {}, onBonusSL: () => {}, onDarkPact: () => {}, onForce: () => {},
      row: (part: { label?: string }, a: Combatant) => ({ combatant: a, d: { label: part.label ?? a.label, base: 40, modifier: 0, target: 40, roll: 12, success: true, sl: 3 } }),
    };
    const rows = buildParticipantRows(
      [{ id: 'h1', interactive: true, result: { roll: 12, target: 40, sl: 3, success: true }, skillId: 'ramer', label: 'Mousse' } as never],
      [actor], withResult as never,
    );
    expect(rows[0].row.d!.label).toBe(refLabel('skills', { id: 'ramer' }));
  });
});

/**
 * #1262 L0 — le monteur MULTI naît de la PORTE (`participantRow`) : équivalence MESURÉE à la bascule
 * par sonde différentielle (6 consommateurs — CascadeModal:624, CrewTestModal:75, DisengageModal:123,
 * ForceDoorModal:37, ShipBatteryModal:43, ShipManeuverModal:57 — × 4 phases : pré-jet, post-jet
 * réussi, raté, résultat NU sans `success`), zéro delta champ à champ. Ce test fige le CONTRAT que la
 * sonde a mesuré : le jeu de champs produit, la définition UNIQUE de `rolled`, la marque de montage.
 */
type Res = ParticipantRow['result'];
const OK: Res = { roll: 34, target: 45, sl: 1, success: true };

const dRow = (label: string) => (a: Combatant, res: Res) => (res
  ? { combatant: a, d: { label, base: 40, modifier: 5, target: res.target, roll: res.roll, success: res.success, sl: res.sl } }
  : { combatant: a, pending: { label, base: 40, target: 45 } });

const CHAMPS = ['actor', 'interactive', 'key', 'onBonusSL', 'onDarkPact', 'onForce', 'onReroll', 'onRoll', 'rerolled', 'rolled', 'row'];

/** Les 6 consommateurs, par ce qui les DISTINGUE au monteur (le reste est identique par construction). */
const profils: { nom: string; bundle: Record<string, unknown>; champs: string[] }[] = [
  { nom: 'CascadeModal:624 — issues + Test étendu + interactiveOf',
    bundle: { row: (_p: ParticipantRow, a: Combatant, res: Res) => dRow('Ténacité')(a, res),
      issues: (_p: ParticipantRow, _a: Combatant, res: Res) => (res ? 'issue-post' : 'issue-pré') as ReactNode,
      extendedDrOf: () => ({ cum: 2, target: 5 }), interactiveOf: (p: ParticipantRow) => p.interactive !== false },
    champs: [...CHAMPS, 'extendedDr'] },
  { nom: 'CrewTestModal:75 — note + interactiveOf',
    bundle: { row: (_p: ParticipantRow, a: Combatant, res: Res) => dRow('Timonier ★')(a, res), note: () => 'note' as ReactNode, interactiveOf: (p: ParticipantRow) => !!p.interactive },
    champs: CHAMPS },
  { nom: 'DisengageModal:123 — présentation SANS pending (d conditionnel)',
    bundle: { row: (_p: ParticipantRow, a: Combatant, res: Res) => ({ combatant: a, d: res ? { label: 'Corps à corps (dans le dos)', base: 40, modifier: 0, target: res.target, roll: res.roll, success: res.success, sl: res.sl } : undefined }), note: () => 'dos' as ReactNode },
    champs: CHAMPS },
  { nom: 'ForceDoorModal:37 — rollLabel de bundle',
    bundle: { row: (_p: ParticipantRow, a: Combatant, res: Res) => dRow('Bagarre')(a, res), note: () => 'porte' as ReactNode, interactiveOf: () => true, rollLabel: 'Frapper' as ReactNode },
    champs: [...CHAMPS, 'rollLabel'] },
  { nom: 'ShipBatteryModal:43 — note + interactiveOf',
    bundle: { row: (_p: ParticipantRow, a: Combatant, res: Res) => dRow('Canonnier ★')(a, res), note: () => 'DR ×2' as ReactNode, interactiveOf: (p: ParticipantRow) => !!p.interactive },
    champs: CHAMPS },
  { nom: 'ShipManeuverModal:57 — note + interactiveOf',
    bundle: { row: (_p: ParticipantRow, a: Combatant, res: Res) => dRow('Timonier')(a, res), note: () => 'DR' as ReactNode, interactiveOf: (p: ParticipantRow) => !!p.interactive },
    champs: CHAMPS },
];

describe('#1262 L0 — la rangée-participant vient du NOYAU (contrat mesuré sur les 6 consommateurs)', () => {
  for (const p of profils) {
    it(`${p.nom} : mêmes champs aux DEUX phases, et la marque de montage`, () => {
      for (const res of [null, OK] as Res[]) {
        const rows = buildParticipantRows([{ id: 'h1', interactive: true, result: res }], [actor], p.bundle as never);
        expect(Object.keys(rows[0]).sort()).toEqual([...p.champs].sort());
        expect(isBuiltRollRow(rows[0]), 'la rangée porte la marque du monteur').toBe(true);
        // Post-traitement par SPREAD (CascadeModal:644, DisengageModal:137) : la marque survit.
        expect(isBuiltRollRow({ ...rows[0], flowKey: 'cascadeBatch' as const })).toBe(true);
        expect(rows[0].rolled, 'sur ces 6 présentations, « un dé affiché » ⇔ « un résultat »').toBe(!!res);
      }
    });
  }

  it('`rolled` suit la DONNÉE AFFICHÉE (définition du noyau), pas le résultat du participant', () => {
    // Présentation qui tait le dé malgré un résultat (forme de DisengageModal:130, `d` conditionnel).
    const rows = buildParticipantRows([{ id: 'h1', interactive: true, result: OK }], [actor], {
      onRoll: () => {}, onReroll: () => {}, onBonusSL: () => {}, onDarkPact: () => {}, onForce: () => {},
      row: (_p: ParticipantRow, a: Combatant) => ({ combatant: a }),
    } as never);
    expect(rows[0].rolled).toBe(false);
  });

  it('la relance GRATUITE d’un participant vient de son ACTEUR (dérivée UNE fois, jamais recopiée)', () => {
    const beni = { ...actor, fortune: 0, activeEffects: [{ label: 'Bénédiction de Chance', bonus: 0, duration: { scale: 'rounds', left: 6 }, freeReroll: true }] } as unknown as Combatant;
    const rows = buildParticipantRows([{ id: 'h1', interactive: true, result: { roll: 78, target: 45, sl: -3, success: false } }], [beni], {
      onRoll: () => {}, onReroll: () => {}, onBonusSL: () => {}, onDarkPact: () => {}, onForce: () => {},
      row: (_p: ParticipantRow, a: Combatant, res: Res) => dRow('Ténacité')(a, res),
    } as never);
    expect(rows[0].rerolled, 'seuls les FAITS du slot voyagent sur la rangée').toBe(false);
    const html = renderToStaticMarkup(<RollShell title="T" rows={rows} rolled actions={[]} />);
    expect(html, 'sans Point de Chance, la relance offerte est celle de la Bénédiction').toContain('Bénédiction de Chance');
  });
});

/**
 * Rangée de Test d'équipage par rôle (MDG 14) : un marin qui ne peut pas tenir son rôle (LDB 09 l.30 ;
 * #2588 Q1) annonce son refus ; un dé JETÉ s'affiche tel qu'il est tombé, contre sa cible.
 */
describe('crewRoleRow — refus du rôle non tentable, dé jeté contre sa cible', () => {
  const marin = {
    id: 'm1', label: 'Gunnar', kind: 'hero', conditions: [{ id: 'inconscient', value: 1 }], skills: [], talents: [],
    characteristics: { 'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 30, endurance: 40, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 },
    wounds: { current: 12, max: 12 }, advantage: 0, weapons: [], items: [], movement: 4,
    armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
  } as unknown as Combatant;
  const part = { id: 'm1', roleId: 'timonier', essential: true, result: null, interactive: true };

  it('non jetée : la rangée annonce le refus nommé, aucun jet en attente', () => {
    const row = crewRoleRow(part as never, marin, null);
    expect(row.note).toBe(refusNePeutTenter(marin, { skill: 'voile' }));
    expect(row.pending).toBeUndefined();
  });

  it('jetée : le dé s’affiche contre sa cible, sans refus', () => {
    const row = crewRoleRow(part as never, { ...marin, conditions: [], skills: [{ id: 'voile', advances: 10 }] as Combatant['skills'] }, { roll: 23, target: 41, sl: 1 });
    expect(row.note).toBeUndefined();
    expect(row.d).toMatchObject({ roll: 23, target: 41, sl: 1 });
  });
});

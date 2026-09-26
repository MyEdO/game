/**
 * #1882 (T2d) — `PROJECT_MIGRATIONS[13]` : une réf. vivante d'effet semée VIDE avant le resserrement
 * (`livingRefSchema.creatureId`, `givePossession.ref.vehicleId`, `setVessel.vehicleId` → `idDe`) reçoit ce que l'outil sème
 * (`creatureSemee`, `vehiculeSeme`, `navireSeme`) où que l'effet vive dans le DOCUMENT — Scène comme
 * péril de route de `worldMap` ; pendant du script de dépôt
 * `scripts/migrations/2026-09-24-1882-refs-vivantes-semees.mjs`, dont la PARITÉ se mesure ici.
 */
import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, copyFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseProject, CURRENT_PROJECT_SCHEMA, PROJECT_MIGRATIONS } from './worldMap';
import { DEFAULT_RELIEF_DEFAULTS, DEFAULT_ROOF_DEFAULTS } from './scene';
import { creatureSemee, vehiculeSeme, navireSeme, creatures, vehicles } from '../data';

/** Document schema 13 — FIGÉ, porteur des trois graines vides d'avant. */
const PROJET_FORMAT_13 = {
  type: 'projet',
  schema: 13,
  id: 'campagne-gelee-13',
  label: 'Campagne gelée (format 13)',
  versionContenu: 1,
  maison: 'fixture de test — aucun livre ne la publie',
  narratif: { affaires: [], indices: [], presetsPnj: [], objets: [] },
  scenes: [{
    type: 'scene',
    id: 'route',
    label: 'La route',
    dimensions: { w: 2, h: 2 },
    reliefDefaults: { ...DEFAULT_RELIEF_DEFAULTS },
    roofDefaults: { ...DEFAULT_ROOF_DEFAULTS },
    layers: [{ z: 0, tiles: ['herbe', 'herbe', 'herbe', 'herbe'] }],
    entities: [],
    encounters: [{
      id: 'embuscade',
      onVictory: { kind: 'seq', steps: [
        { kind: 'do', effect: { type: 'startPursuit', partyRole: 'fleeing', distance: 4, skill: { id: 'athletisme' }, foes: [{ ref: { creatureId: '' } }], encounter: '' } },
        { kind: 'do', effect: { type: 'givePossession', nature: 'bete', ref: { creatureId: '' } } },
        { kind: 'do', effect: { type: 'givePossession', nature: 'vehicule', ref: { vehicleId: '' } } },
      ] },
    }],
  }],
};

describe('PROJECT_MIGRATIONS[13] — les graines vides d’un effet se chargent à travers la migration (#1882)', () => {
  it('la réf. semée est la PREMIÈRE offerte par le catalogue', () => {
    expect([creatureSemee(), vehiculeSeme(), navireSeme()]).toEqual([creatures[0].id, vehicles[0].id, vehicles.find((v) => v.ship)!.id]);
    expect(PROJET_FORMAT_13.schema).toBeLessThan(CURRENT_PROJECT_SCHEMA);
  });

  it('chaque réf. vide reçoit la réf. semée, où que l’effet soit niché', () => {
    const doc = parseProject(structuredClone(PROJET_FORMAT_13));
    const flow = doc.scenes[0].encounters[0].onVictory as { steps: { effect: Record<string, unknown> }[] };
    expect(flow.steps.map((s) => s.effect)).toEqual([
      expect.objectContaining({ type: 'startPursuit', foes: [{ ref: { creatureId: creatureSemee() } }] }),
      expect.objectContaining({ type: 'givePossession', ref: { creatureId: creatureSemee() } }),
      expect.objectContaining({ type: 'givePossession', ref: { vehicleId: vehiculeSeme() } }),
    ]);
  });

  it('SANS le migrateur, le projet serait REFUSÉ au parse', () => {
    let refus = '';
    try { parseProject({ ...structuredClone(PROJET_FORMAT_13), schema: CURRENT_PROJECT_SCHEMA }); } catch (e) { refus = (e as Error).message; }
    expect(refus).toMatch(/creatureId/);
    expect(refus).toMatch(/vehicleId/);
  });
});

const RACINE = fileURLToPath(new URL('../../', import.meta.url));
const SCRIPT = '2026-09-24-1882-refs-vivantes-semees.mjs';
const PERIL_POSSESSION = { type: 'givePossession', nature: 'bete', ref: { creatureId: '' } };
const PERIL_POURSUITE = { type: 'startPursuit', partyRole: 'fleeing', distance: 4, skill: { id: 'athletisme' }, foes: [{ ref: { creatureId: '' } }], encounter: '' };
const PERIL_NAVIRE = { type: 'setVessel', vehicleId: '' };

/** Un vrai projet du dépôt ramené au format 13, dont le 1er péril de route porte les graines vides. */
function projetAPeril13(): Record<string, unknown> {
  const doc = JSON.parse(readFileSync(join(RACINE, 'src/scenes/diligence/diligence-projet.json'), 'utf8'));
  doc.schema = 13;
  doc.worldMap.routes[0].perils = [{ label: 'Péril', chancePct: 10, effects: [PERIL_POSSESSION, PERIL_POURSUITE, PERIL_NAVIRE] }];
  return doc;
}

describe('PROJECT_MIGRATIONS[13] — le DOCUMENT entier, péril de route compris (#1882)', () => {
  it('un péril de route à graines vides se charge : chaque réf. reçoit la réf. semée', () => {
    const doc = parseProject(projetAPeril13()) as unknown as { worldMap: { routes: { perils: { effects: unknown[] }[] }[] } };
    expect(doc.worldMap.routes[0].perils[0].effects).toEqual([
      expect.objectContaining({ type: 'givePossession', ref: { creatureId: creatureSemee() } }),
      expect.objectContaining({ type: 'startPursuit', foes: [{ ref: { creatureId: creatureSemee() } }] }),
      expect.objectContaining({ type: 'setVessel', vehicleId: navireSeme() }),
    ]);
  });

  it('PARITÉ : le script de dépôt et le migrateur rendent le MÊME document', () => {
    const doc = projetAPeril13();
    const dir = mkdtempSync(join(tmpdir(), 'mig-1882-parite-'));
    try {
      mkdirSync(join(dir, 'scripts', 'migrations'), { recursive: true });
      mkdirSync(join(dir, 'src', 'data'), { recursive: true });
      mkdirSync(join(dir, 'src', 'scenes', 'camp'), { recursive: true });
      copyFileSync(join(RACINE, 'scripts', 'migrations', SCRIPT), join(dir, 'scripts', 'migrations', SCRIPT));
      for (const f of ['creatures.json', 'vehicles.json']) copyFileSync(join(RACINE, 'src', 'data', f), join(dir, 'src', 'data', f));
      const cible = join(dir, 'src', 'scenes', 'camp', 'camp-projet.json');
      writeFileSync(cible, `${JSON.stringify(doc, null, 1)}\n`, 'utf8');
      execFileSync(process.execPath, [join(dir, 'scripts', 'migrations', SCRIPT)], { encoding: 'utf8', stdio: 'pipe' });
      const script = JSON.parse(readFileSync(cible, 'utf8'));
      const { version: _v, ...migre } = PROJECT_MIGRATIONS[13](structuredClone(doc)) as Record<string, unknown>;
      void _v;
      expect(script).toEqual(migre);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

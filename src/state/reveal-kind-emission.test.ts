import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { unionKinds, scanRevealProducers } from '../../scripts/guards/lib/revealKindEmission.mjs';
import { readCorpus } from '../../scripts/guards/lib/sourceCorpus.mjs';

/**
 * Garde-fou « kind de RevealEntry ↔ site d'émission » (#942, L0 puis L8). L'union `RevealEntry['kind']`
 * décrit ce que le jeu peut RÉVÉLER : chaque membre doit avoir un producteur dans les sources (hors
 * tests), et tout producteur doit citer un membre de l'union. Un membre orphelin laisse vivre son
 * câblage UI (icône `REVEAL_ICON`, libellé de table, branche de rendu de `ui/RevealBody.tsx`) pour un
 * cas qui n'arrive jamais. `pushReveal` (forme 1) est l'ÉMETTEUR UNIQUE : toute révélation entre dans
 * la séquence par lui, y compris la carte d'entrée de zone (option `own`).
 */

const ROOT = fileURLToPath(new URL('../..', import.meta.url)); // src/state/ → ../../ = racine du projet

/** Sites producteurs de `src/**` hors tests — la marche et la lecture viennent de `readCorpus`. */
function producers(): { kind: string; site: string }[] {
  const out: { kind: string; site: string }[] = [];
  for (const { rel, text } of readCorpus(['src'])) {
    for (const p of scanRevealProducers(rel, text)) {
      out.push({ kind: p.kind, site: `${rel}:${p.line} (forme ${p.forme})` });
    }
  }
  return out;
}

const UNION = () => unionKinds(readFileSync(join(ROOT, 'src/noyau/pendings.ts'), 'utf8'));

describe('garde-fou RevealEntry — un kind déclaré = un kind émis (#942 L0)', () => {
  it('chaque membre de l’union a au moins un site producteur', () => {
    const emitted = new Set(producers().map((p) => p.kind));
    const orphans = UNION().filter((k) => !emitted.has(k));
    expect(
      orphans,
      `Kind(s) de RevealEntry sans aucun site d'émission — purger le membre d'union ET son câblage UI/routage :\n${orphans.join(', ')}`,
    ).toEqual([]);
  });

  it('aucun producteur ne cite un kind hors union', () => {
    const union = new Set(UNION());
    const strays = producers().filter((p) => !union.has(p.kind)).map((p) => `${p.kind} @ ${p.site}`);
    expect(strays, `Producteur(s) d'un kind absent de l'union RevealEntry :\n${strays.join('\n')}`).toEqual([]);
  });

  it('les trois formes de production sont couvertes (fail-closed du scanner)', () => {
    const found = (src: string) => scanRevealProducers('src/x.ts', src).map((p) => `${p.forme}:${p.kind}`);
    expect(found("pushReveal(set, {\n  kind: 'round', title: 'A', lines: [],\n});")).toEqual(['1:round']);
    expect(found("env.pushReveal({ kind: 'effet', title: 'A', lines: [] });")).toEqual(['1:effet']);
    expect(found("const r: RevealEntry = { kind: 'miscast', title: 'A', lines: [] };")).toEqual(['2:miscast']);
    expect(found("export function f(t: X): RevealEntry {\n  return { kind: 'critical', lines: [] };\n}")).toEqual(['3:critical']);
    // Le kind d'ENTRÉE DE ZONE passe lui aussi par l'émetteur unique, sous garde du message de scène.
    // L'échantillon n'est pas RÉÉCRIT ICI : il est LU dans `entreeEnScene.ts`, donc un renommage de champ
    // ou un déplacement de l'émission rougit ce cas au lieu de laisser vivre un littéral périmé.
    const emissions = readFileSync(join(ROOT, 'src/noyau/entreeEnScene.ts'), 'utf8')
      .split('\n').filter((l) => l.includes("kind: 'sceneEntry'")).map((l) => l.trim());
    expect(emissions.length, 'entreeEnScene.ts doit porter les émissions d’entrée de zone').toBeGreaterThan(0);
    for (const l of emissions) {
      expect(l, 'le titre de la carte d’entrée est le LIBELLÉ de la scène visée').toMatch(/title: \w+\.label,/);
      expect(found(l)).toEqual(['1:sceneEntry']);
    }
    // TABLEAU annoté : chaque entrée est un producteur.
    expect(found("const q: RevealEntry[] = [{ kind: 'round', lines: [] }, { kind: 'effet', lines: [] }];")).toEqual(['2:round', '2:effet']);
    // RECORD de FABRIQUES annoté par son type de retour.
    expect(found("const F: Record<string, () => RevealEntry> = { a: () => ({ kind: 'mutation', lines: [] }) };")).toEqual(['2:mutation']);
    // FLÈCHE annotée.
    expect(found("const g = (t: X): RevealEntry => ({ kind: 'critical', lines: [] });")).toEqual(['3:critical']);
    // Un appel par VARIABLE n'est pas un producteur (c'est la variable annotée qui l'est).
    expect(found('pushReveal(set, entry);')).toEqual([]);
  });

  it('ANGLE MORT ÉNONCÉ (fail-open) : shorthand et littéral non annoté ne sont PAS vus — la garde ne vaut jamais permis de purge à elle seule', () => {
    const found = (src: string) => scanRevealProducers('src/x.ts', src).map((p) => `${p.forme}:${p.kind}`);
    expect(found("const kind = 'round' as const;\npushReveal(set, { kind, title: 'A', lines: [] });")).toEqual([]);
    expect(found("const e = { kind: 'round' as const, lines: [] };\npushReveal(set, e);")).toEqual([]);
    // Ces deux formes sont documentées en tête de `scripts/guards/lib/revealKindEmission.mjs` : un « 0
    // producteur » exige une recherche MANUELLE du kind avant toute suppression d'un membre d'union.
  });

  it('les producteurs réels de l’arbre couvrent les kinds attendus (le scanner voit bien les vrais sites)', () => {
    const byKind = new Map<string, string[]>();
    for (const p of producers()) byKind.set(p.kind, [...(byKind.get(p.kind) ?? []), p.site]);
    for (const k of UNION()) expect(byKind.get(k)?.length ?? 0, `kind ${k}`).toBeGreaterThan(0);
  });
});

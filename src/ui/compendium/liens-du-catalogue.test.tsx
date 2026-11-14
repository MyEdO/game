/**
 * GARDE §1c du périmètre du liage (#1392 Lot E) — le CHIFFRE, pas la promesse.
 *
 * Sur TOUT le catalogue (`CODEX`) et sur les sections d'un statbloc de combattant
 * (`combatantSections`, rendues par `InspectPanel` SANS entrée), on rend chaque rangée `t:'text'`
 * exactement comme `CodexRowView` la rend, et on vérifie l'invariant :
 *
 *   une rangée SANS porteur rend ZÉRO lien.
 *
 * Le compte des liens PAR ÉMETTEUR (catégorie | section) est imprimé : c'est le chiffre publié au
 * pilotage, et la trace qui rend un futur écart lisible au lieu d'être une surprise.
 */
import { idsDeTest } from '../../engine/idsDeTest.testkit';
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { Prose } from '../Prose';
import { CODEX, combatantSections, type CodexRow, type CodexSection } from '../../noyau/codex/registry';
import { porteurDeRangee } from '../../noyau/codex/porteur'; // la SEULE composition rangée+entrée — celle du rendu
import { HEROS_DE_SCENARIO, herosDeScenario, type RoleDeScenario } from '../../scenes/test-scenarios/_heros';

interface Rangee {
  cat: string;
  item: string;
  sec: string;
  texte: string;
  porteur?: { type: string; id: string; chemin: string };
  liens: string[];
}

function liensDe(row: Extract<CodexRow, { t: 'text' }>, entree?: { type: string; id: string }): { porteur?: { type: string; id: string; chemin: string }; liens: string[] } {
  const porteur = porteurDeRangee(row, entree);
  const html = renderToStaticMarkup(<Prose md={row.text} porteur={porteur} />);
  return { porteur, liens: [...html.matchAll(/class="[^"]*codex-ref[^"]*"[^>]*>([^<]*)/g)].map((m) => m[1]) };
}

function balaye(rows: CodexRow[], cat: string, item: string, sec: string, entree: { type: string; id: string } | undefined, acc: Rangee[]): void {
  for (const r of rows) {
    if (r.t !== 'text') continue;
    const { porteur, liens } = liensDe(r, entree);
    acc.push({ cat, item, sec, texte: r.text, porteur, liens });
  }
}

/** Toutes les rangées texte du catalogue, rendues comme à l'écran. */
const RANGEES: Rangee[] = (() => {
  const acc: Rangee[] = [];
  for (const c of CODEX) {
    for (const it of c.items) {
      const entree = { type: c.key, id: it.id };
      const secs: CodexSection[] = [...(it.sections ?? []), ...(it.tabs ?? []).flatMap((t) => t.sections)];
      for (const s of secs) balaye(s.rows, c.key, it.id, s.title, entree, acc);
      if (it.statblock) balaye(it.statblock.traits, c.key, it.id, 'statbloc', entree, acc);
    }
  }
  // Statbloc d'inspection : rendu SANS entrée (un combattant n'est pas une entrée de dataset).
  for (const key of Object.keys(HEROS_DE_SCENARIO) as RoleDeScenario[]) {
    const c = herosDeScenario(idsDeTest, key);
    for (const s of combatantSections(c)) balaye(s.rows, 'combattant', String(key), s.title, undefined, acc);
  }
  return acc;
})();

describe('liens du catalogue — une rangée SANS porteur ne lie RIEN (#1392 §1c)', () => {
  it('aucun lien sur une rangée nue, sur TOUT le catalogue', () => {
    const fautives = RANGEES.filter((r) => !r.porteur && r.liens.length).map((r) => `${r.cat}/${r.item} [${r.sec}] liens=${JSON.stringify(r.liens)} :: ${r.texte.slice(0, 90)}`);
    expect(fautives).toEqual([]);
  });

  it('les sections d’un COMBATTANT (statbloc d’inspection) sont nues de bout en bout', () => {
    const duCombattant = RANGEES.filter((r) => r.cat === 'combattant');
    expect(duCombattant.every((r) => !r.porteur && r.liens.length === 0)).toBe(true);
  });

  it('le compte des liens PAR ÉMETTEUR est publié (trace de pilotage)', () => {
    const par = new Map<string, { rangees: number; liens: number; portees: number }>();
    for (const r of RANGEES) {
      const k = `${r.cat} | ${r.sec}`;
      const e = par.get(k) ?? { rangees: 0, liens: 0, portees: 0 };
      e.rangees++;
      e.liens += r.liens.length;
      if (r.porteur) e.portees++;
      par.set(k, e);
    }
    const lignes = [...par]
      .sort((a, b) => b[1].rangees - a[1].rangees)
      .map(([k, e]) => `${e.rangees}r ${e.portees}p ${e.liens}l\t${k}`);
    const totalRangees = RANGEES.length;
    const totalLiens = RANGEES.reduce((s, r) => s + r.liens.length, 0);
    const totalPortees = RANGEES.filter((r) => r.porteur).length;
    console.log([`TOTAL rangées t:'text' = ${totalRangees} · portées = ${totalPortees} · liens rendus = ${totalLiens}`, ...lignes].join('\n'));
    expect(totalRangees).toBeGreaterThan(0);
  });
});

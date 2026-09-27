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
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { Prose } from '../Prose';
import { CODEX, combatantSections, type CodexRow, type CodexSection } from './registry';
import { CHEMINS_ADRESSES } from '../liage';
import { porteurDeRangee } from './CodexEntry'; // la SEULE composition rangée+entrée — celle du rendu
import { pregen, PREGEN } from '../../data/pregens';
import { readCorpus } from '../../../scripts/guards/lib/sourceCorpus.mjs';
import { detenteur } from '../../detenteur.testkit';

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
  for (const key of Object.keys(PREGEN) as (keyof typeof PREGEN)[]) {
    const c = pregen(PREGEN[key]);
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

describe('câblage `CHEMINS_ADRESSES` ⇄ porteurs réellement émis (#1392 §10)', () => {
  /** Un chemin émis, ramené à sa forme DÉCLARÉE : les index et les clés variables sont génériques. */
  const forme = (chemin: string): string => chemin.replace(/\[\d+\]/g, '[]').replace(/bySpecies\.[^.]+$/, 'bySpecies.<espèce>');
  const emis = new Set(RANGEES.filter((r) => r.porteur).map((r) => `${r.porteur!.type}|${forme(r.porteur!.chemin)}`));

  it('tout porteur émis par le registre est DANS la liste fermée', () => {
    const declares = new Set(CHEMINS_ADRESSES.map((c) => `${c.type}|${c.chemin}`));
    const generiques = new Set(CHEMINS_ADRESSES.filter((c) => c.type === '*').map((c) => c.chemin));
    const hors = [...emis].filter((e) => {
      const [, chemin] = e.split('|');
      return !declares.has(e) && !generiques.has(chemin);
    }).sort();
    expect(hors).toEqual([]);
  });

  /* CÂBLAGE des chemins de PROJET : l'inventaire (`CHAMPS_PROSE_DE_SCENE`) ne vaut que si CHAQUE
   * chemin a son SITE DE DÉCLARATION dans les defs de scène. Recopier le triplet attendu ici ne
   * prouverait que la recopie ; on le confronte donc au CODE RÉEL des defs (corpus partagé). */
  const DEFS_SCENES = readCorpus(['src/data/schemas/defs-scenes']);
  const DECLARES = detenteur(
    () => new Set(DEFS_SCENES.flatMap(({ text }) => [...text.matchAll(/proseDeScene\(\s*'([^']+)'\s*\)/g)].map((m) => m[1]))),
  );

  it('chaque chemin de PROJET est DÉCLARÉ par un `proseDeScene()` d’une def de scène', () => {
    const projets = CHEMINS_ADRESSES.filter((c) => c.type === 'projet').map((c) => c.chemin);
    expect(projets.length).toBeGreaterThan(0);
    expect(projets.filter((c) => !DECLARES().has(c)).sort()).toEqual([]);
  });

  it('aucune def de scène ne déclare un chemin HORS inventaire', () => {
    const projets = new Set(CHEMINS_ADRESSES.filter((c) => c.type === 'projet').map((c) => c.chemin));
    expect([...DECLARES()].filter((c) => !projets.has(c)).sort()).toEqual([]);
  });
});

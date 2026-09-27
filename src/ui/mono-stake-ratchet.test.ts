/**
 * CLIQUET « une modale de jet dit son ENJEU » (#1117 L1b) — pendant, à l'étage de l'UI, du cliquet
 * `state/cascade-step-stake-guard` (les étapes de cascade) : toute coquille `RollShell` montée par une
 * modale doit passer la prop `stake` (une `StakeRef`, jamais un texte : le type l'interdit).
 *
 * Lecture STRUCTURELLE, pas un grep de ligne : pour chaque `flowKey="…"`, on remonte à l'ouverture de
 * la balise JSX qui le porte et on lit CETTE balise jusqu'à sa fermeture (profondeur d'accolades) —
 * une prop posée n'importe où dans la balise compte, une prop d'une AUTRE balise ne compte pas.
 *
 * Baseline NOMINATIVE et DÉCROISSANTE : chaque `flowKey` encore muet est listé avec sa raison. Un
 * site NEUF muet échoue ; un site doté dont la ligne reste ici échoue aussi (baseline périmée).
 */
import { describe, it, expect } from 'vitest';
import { readCorpus } from '../../scripts/guards/lib/sourceCorpus.mjs';

const UI = 'src/ui';

/** Les modales de la RACINE de `src/ui` — c'est là que vivent les coquilles de jet ; les
 *  sous-dossiers (atelier, créateur, compendium) ne montent pas de `RollShell`. Nom NU du fichier,
 *  la forme que porte le message. */
const MODALES = readCorpus([UI], { exts: ['.tsx'] })
  .filter(({ rel }) => !rel.slice(UI.length + 1).includes('/'))
  .map(({ rel, text }) => ({ nom: rel.slice(UI.length + 1), code: text }));

/** Balise JSX ouvrante qui contient l'index `i` : de son `<` jusqu'au `>` de même profondeur. */
function openingTag(src: string, i: number): string {
  const start = src.lastIndexOf('<', i);
  if (start < 0) return '';
  let depth = 0;
  for (let j = start; j < src.length; j++) {
    const ch = src[j];
    if (ch === '{') depth++;
    else if (ch === '}') depth--;
    else if (ch === '>' && depth === 0) return src.slice(start, j + 1);
  }
  return src.slice(start);
}

/** `flowKey` des coquilles de jet SANS prop `stake`, dans une source donnée. */
export function shellsWithoutStake(src: string): string[] {
  const out: string[] = [];
  for (const m of src.matchAll(/flowKey="(\w+)"/g)) {
    const tag = openingTag(src, m.index!);
    if (!/^<RollShell\b/.test(tag)) continue; // `flowKey` d'une RANGÉE (RollRowData) : l'enjeu est sur la coquille
    if (/\bstake=\{/.test(tag)) continue;
    out.push(m[1]);
  }
  return out;
}

/**
 * Coquilles encore MUETTES, par flux, avec leur motif. Chaque ligne tombe avec le lot qui la traite —
 * L2 (combat), L3 (activités), L4+ (multi d'équipage). Un flux ABSENT d'ici doit être doté.
 */
const BASELINE: Record<string, string> = {
  // COMBAT — mesuré en L2 par la FORME (target/roll), pas par grep de kind : le dataset `combat-stakes`
  // naît avec ce lot, ces coquilles s'y branchent d'un coup.
  maneuver: 'L2 — combat-stakes',
  grapple: 'L2 — combat-stakes',
  handGate: 'L2 — combat-stakes',
  approach: 'L2 — combat-stakes',
  // MAGIE — le renvoi vise la fiche du SORT (design §4), lot magie.
  cast: 'L2 — renvoi CodexRef vers la fiche du sort',
  focus: 'L2 — renvoi CodexRef vers la fiche du sort',
  // ACTIVITÉS — `activity` est SOLDÉ (L3 : `ActivityDef.stake`, dataset `activity`).
  bargain: 'L3 — négoce (marchand), lot des activités marchandes',
  // ÉQUIPAGE & NAVIRE — jumeaux de `crewTest`, à doter avec leurs types de Test (même patron).
  shipManeuver: 'L4 — jumeau de crewTest, entryId = type de Test',
  shipBattery: 'L4 — jumeau de crewTest, entryId = type de Test',
  // Porte à enfoncer : les 5 candidats relevés au ticket #1117 sont INSTRUITS (L2, 2026-08-06) —
  // EDO 7 l.184 / PDT 9 l.285 posent un statbloc de porte, PDT 8 l.370 est de la prose de MJ,
  // Ubersreik 10 l.183 pose une procédure LOCALE divergente (Force +20), MSRC 7 n'en parle pas.
  // LA règle vit ailleurs : EDO 11 l.89-101 (« Portes »), extraction FR présente et citable — c'est
  // la procédure que la modale joue déjà. Reste à curer sa fiche et son entrée `flow-stakes`.
  forceDoor: 'L2 — passage instruit (EDO 11 l.89-101) ; fiche + entrée d’enjeu à curer',
};

describe('cliquet — une modale de jet dit son ENJEU (#1117 L1b)', () => {
  it('aucune coquille NEUVE sans enjeu, et toute baseline soldée est RETIRÉE', () => {
    const muets = new Map<string, string[]>(); // flowKey → fichiers
    for (const { nom, code } of MODALES) {
      for (const k of shellsWithoutStake(code)) {
        muets.set(k, [...(muets.get(k) ?? []), nom]);
      }
    }
    const neufs = [...muets].filter(([k]) => !(k in BASELINE)).map(([k, fs]) => `${k} (${fs.join(', ')})`);
    expect(neufs, ['Coquille de jet SANS enjeu — le joueur doit savoir ce que le jet met en jeu (`stake`, flow-stakes.json) :', ...neufs].join('\n')).toEqual([]);

    const perimees = Object.keys(BASELINE).filter((k) => !muets.has(k));
    expect(perimees, ['Baseline PÉRIMÉE : ces flux ont désormais leur enjeu — retirer leur ligne :', ...perimees].join('\n')).toEqual([]);
  });

  it('FAIL-CLOSED : une coquille synthétique sans enjeu est DÉTECTÉE, avec enjeu elle ne l’est pas', () => {
    const sans = `<RollShell flowKey="run" title="X" rows={[]} />`;
    const avec = `<RollShell flowKey="run" stake={flowStakeRef('run-roll')} title="X" rows={[]} />`;
    // Une prop d'une AUTRE balise ne doit pas compter — l'enjeu doit être SUR la coquille.
    const voisin = `<div stake={x}><RollShell flowKey="run" title="X" /></div>`;
    // `flowKey` d'une RANGÉE (RollRowData) : hors périmètre, l'enjeu est porté par la coquille.
    const rangee = `<RollRow flowKey="flee" />`;
    expect(shellsWithoutStake(sans)).toEqual(['run']);
    expect(shellsWithoutStake(avec)).toEqual([]);
    expect(shellsWithoutStake(voisin)).toEqual(['run']);
    expect(shellsWithoutStake(rangee)).toEqual([]);
  });
});

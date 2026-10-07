import { describe, it, expect } from 'vitest';
import { scanCharKeyLegacy } from '../../scripts/guards/lib/charKeyLegacy.mjs';
import { readCorpus } from '../../scripts/guards/lib/sourceCorpus.mjs';

/**
 * Garde-fou « anciens tokens CharKey en valeur de caractéristique » (#302, pérennise le grep de
 * sortie #311, commit 78d04b4a). `CharKey` = slugs pleins (`capacite-de-combat`…) — plus jamais
 * `'CC'|'CT'|'F'|'E'|'I'|'Ag'|'Dex'|'Int'|'FM'|'Soc'` en VALEUR mécanique (clé de `Characteristics`,
 * champ `char`/`resolveChar`/`testModChar`/`characteristic`). Cible `src/data` + `src/state` +
 * `src/engine` + `src/ui` + `src/gameIso` (datasets, state, moteur, rendu, UI) — jamais l'AFFICHAGE
 * dérivé (`charAbr`, issu de `characteristics.json` par id). Extension #410 : moteur/UI/rendu ajoutés
 * au périmètre (recensement 2026-07-13 — ZÉRO offender, extension à coût nul, tout nouveau dossier
 * naît couvert plutôt que d'attendre un opt-in par dossier).
 */

const SCAN_DIRS = ['src/data', 'src/state', 'src/engine', 'src/ui', 'src/gameIso'];

function countsByFile(): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const { rel, text } of readCorpus(SCAN_DIRS)) {
    const n = scanCharKeyLegacy(rel, text).length;
    if (n > 0) counts[rel] = n;
  }
  return counts;
}

describe('garde-fou « CharKey » — anciens tokens courts en valeur (cliquet, #302/#311)', () => {
  it('aucun fichier de src/data|state|engine|ui|gameIso ne réintroduit CC/CT/F/E/I/Ag/Dex/Int/FM/Soc en valeur', () => {
    const counts = countsByFile();
    const offenders = Object.entries(counts).map(([rel, n]) => `${rel} : ${n} site(s)`);
    expect(
      offenders,
      `Réapparition d'un ancien token CharKey (#311) — utiliser le slug plein (capacite-de-combat…) :\n${offenders.join('\n')}`,
    ).toEqual([]);
  });

  it('fail-closed : le scanner détecte une écriture SYNTHÉTIQUE du motif', () => {
    const regressed = "const c = { characteristics: { CC: 40, FM: 30 } };";
    expect(scanCharKeyLegacy('src/state/x.ts', regressed).length).toBeGreaterThan(0);
  });
});

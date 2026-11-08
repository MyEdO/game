import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { readCorpus } from '../../scripts/guards/lib/sourceCorpus.mjs';

/** Le site unique de la barre de DR de rangée, lu dans les sources de l'écran. */
describe('barre de DR de rangée — site de rendu unique (`RollRow`)', () => {
  const lire = (f: string) => readFileSync(`src/ui/${f}`, 'utf8');

  // VERROU (#329, arbitrage user 2026-07-11) : la barre de DR de RANGÉE d'un Test étendu a UN SEUL site
  // de rendu (la primitive `RollRow`), alimenté par la DONNÉE `extendedDr` — jamais un `<DrBar>` recodé
  // dans la modale de cascade ou le builder de rangées (ni une branche spécifique voyage).
  it('la barre de DR de rangée a UN site de rendu unique (RollRow), pas dans CascadeModal/buildParticipantRows', () => {
    expect(lire('RollRow.tsx')).toMatch(/extendedDr && <DrBar/); // SITE unique de rendu de la barre de rangée
    expect(lire('CascadeModal.tsx')).not.toMatch(/DrBar/); // la modale ne pose QUE la donnée, plus le composant
    expect(lire('buildParticipantRows.tsx')).not.toMatch(/DrBar/);
  });

  // VERROU RESSERRÉ (vague « lisibilité du voyage » 2/2, arbitrage user 2026-07-11) : `DrBar` n'est
  // IMPORTÉ que par son site unique (`RollRow.tsx`) + les exceptions nommées ci-dessous, chacune avec
  // sa raison. ActivityModal/FocusModal/DispelModal/ReloadModal/useExtendedTestJetProps sont CONVERGÉS
  // sur `RollRow.extendedDr` (plus d'import direct) — toute réapparition d'un import fait échouer ce test.
  it('DrBar : import limité au site unique RollRow + exceptions nommées', () => {
    const importers: string[] = [];
    for (const { rel, text } of readCorpus(['src/ui'], { tests: true })) {
      const path = rel.slice('src/ui/'.length);
      if (path === 'DrBar.tsx') continue; // le composant ne s'importe pas lui-même
      // La VITRINE n'est pas un site de jeu : `src/ui/gallery/gallery-exhaustive.test.ts` y EXIGE un
      // spécimen de toute primitive du manifeste.
      if (path.startsWith('gallery/')) continue;
      if (/from ['"].*\/DrBar['"]/.test(text)) importers.push(path);
    }
    // Exception nommée : `MedicModal.tsx` — état d'opération de Chirurgie ARMÉE, visible AVANT/ENTRE
    // les passes (hors de toute rangée de jet ; `useSurgeryJetProps` n'a pas de rangée tant qu'aucune passe
    // n'est ouverte) — pas la barre d'UN jet, le cumul PERSISTANT de l'opération.
    const NAMED_EXCEPTIONS = new Set(['MedicModal.tsx']);
    expect(new Set(importers)).toEqual(new Set(['RollRow.tsx', ...NAMED_EXCEPTIONS]));
  });
});

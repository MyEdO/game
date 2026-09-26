import { describe, it, expect } from 'vitest';
import { readCorpus } from '../../scripts/guards/lib/sourceCorpus.mjs';
import { scanHeroDebout } from '../../scripts/guards/lib/heroDebout.mjs';
import { estFichierVitest } from '../../scripts/guards/lib/fichierVitest.mjs';

/**
 * Garde-fou « héros DEBOUT » (#1362, lot L1a) — ABSOLU : ni stock, ni baseline, ni liste blanche.
 * `estDebout` (`src/state/combatants.ts`) = `!isOutOfAction(h) && h.wounds.current > 0` est la
 * définition CANONIQUE dont dérive l'élection du meneur (`meneurDuMonde`). Une recopie du prédicat
 * est une SECONDE définition : c'est elle qui faisait pivoter le regard d'un héros que le plateau ne
 * dessinait pas, grimper un troisième, et qui — recopiée sur `dead` seul — faisait mener un
 * Inconscient. Le FOYER (`combatants.ts`) est exclu par NOM de fichier, pas par exemption de site.
 *
 * Ce que la garde détecte : la CO-OCCURRENCE, dans une même instruction du texte APLATI, du GROUPE
 * (`party`), de la moitié « hors d'action » (`dead` ou `isOutOfAction`) et d'une comparaison de
 * `wounds.current` à 0/1 — toute GRAPHIE, y compris multi-ligne, destructurée ou négative.
 * COUVERTURE : `src/state`, `src/ui`, `src/gameIso`, `src/engine`, `src/scenes`, `src/net`, `src/data` — tout
 * code qui peut tenir un `party`, tests compris (`tests: true`), hors fichiers de banc Vitest.
 * Ce qu'elle ne détecte PAS, et pourquoi (un détecteur ne vaut que sa couverture DITE) :
 *  — le moteur de COMBAT, qui accouple les mêmes jetons pour une autre notion (« vient de tomber à
 *    0 », `applyZeroWounds` ; « réduit la cible à 0 Blessure », LDB 47 l.340) : il ne parle jamais du
 *    `party`, et ces sites ne se migrent pas vers `estDebout` sans changer la règle ;
 *  — une recopie dont l'instruction ne nomme pas le `party` : alias local déjà détaché du roster
 *    (`const h = s.party; h.find(…)`), autre nom de collection (`roster.find(…)`,
 *    `group.members.filter(…)`), ou identifiant seulement PRÉFIXÉ par `party` dont la source est
 *    ailleurs (`const partyVivants = p.filter(…)` — mordu, lui, puisque `party` y apparaît, mais
 *    `const vivants = p.filter(…)` ne l'est pas).
 *
 * Le littéral `party[0]` n'est PAS gardé : il a des lecteurs légitimes hors du rôle de meneur
 * (destinataire par défaut du marchand, patient par défaut du médecin, PX de groupe, devtools) —
 * une garde dessus serait un stock, pas un invariant.
 */

const SCAN_DIRS = ['src/state', 'src/ui', 'src/gameIso', 'src/engine', 'src/scenes', 'src/net', 'src/data'];
const FOYER = 'src/state/combatants.ts';

/** Les NEUF graphies du même prédicat — une garde par graphie n'en voyait que deux. */
const GRAPHIES: Record<string, string> = {
  'canonique `!dead && > 0`': 'party.find((h) => !h.dead && h.wounds.current > 0)',
  'ordre inversé': 'party.find((h) => h.wounds.current > 0 && !h.dead)',
  'seuil `>= 1`': 'party.find((h) => !h.dead && h.wounds.current >= 1)',
  'égalité `dead === false`': 'party.find((h) => h.dead === false && h.wounds.current > 0)',
  'forme NÉGATIVE `!(dead || <= 0)`': 'party.filter((h) => !(h.dead || h.wounds.current <= 0))',
  'destructuration': 'party.find(({ dead, wounds }) => !dead && wounds.current > 0)',
  'multi-ligne': 'party.find((h) => !h.dead\n  && h.wounds.current > 0)',
  'double négation `!( <= 0)`': 'party.find((h) => !h.dead && !(h.wounds.current <= 0))',
  'inégalité `!== 0`': 'party.find((h) => h.wounds.current !== 0 && !h.dead)',
};

/** Trois NÉGATIFS : chacun porte une moitié du prédicat, ou les deux mais dans deux instructions. */
const NEGATIFS: Record<string, string> = {
  'Blessures seules (réveil d’un Inconscient)': 'if (target.wounds.current > 0) reveil(target);',
  '`dead` seul (liste des vivants)': 'const vivants = party.filter((c) => !c.dead);',
  'les deux jetons, mais à 200 caractères et DEUX instructions d’écart':
    'const morts = party.filter((c) => c.dead).map((c) => c.label).join(", ");'
    + ` const titre = ${'"'}${'x'.repeat(200)}${'"'};`
    + ' const blesse = cible.wounds.current > 0;',
};

function findingsParFichier(): Record<string, { line: number; detail: string }[]> {
  const out: Record<string, { line: number; detail: string }[]> = {};
  for (const { rel, text } of readCorpus(SCAN_DIRS, { tests: true })) {
    if (estFichierVitest(rel) || rel.replace(/\\/g, '/') === FOYER) continue;
    const f = scanHeroDebout(rel, text);
    if (f.length) out[rel] = f;
  }
  return out;
}

describe('garde-fou « estDebout » — prédicat du héros debout (ABSOLU, #1362)', () => {
  it('aucune recopie du prédicat hors de `src/state/combatants.ts`', () => {
    const offenders = Object.entries(findingsParFichier()).flatMap(([rel, f]) =>
      f.map((x) => `${rel}:${x.line} — ${x.detail}`),
    );
    expect(
      offenders,
      'Prédicat DEBOUT recopié — appeler `estDebout` / `meneurDuMonde` / `meneurDeboutDuMonde` ' +
        `(src/state/combatants.ts) :\n${offenders.join('\n')}`,
    ).toEqual([]);
  });

  it('le corpus scanné est NON VIDE (une garde sur zéro fichier serait verte à tort)', () => {
    const fichiers = readCorpus(SCAN_DIRS, { tests: true }).filter((f) => !estFichierVitest(f.rel));
    expect(fichiers.length).toBeGreaterThan(200);
  });

  it.each(Object.entries(GRAPHIES))('MORD sur la graphie : %s', (_nom, code) => {
    expect(scanHeroDebout('x.ts', code)).toHaveLength(1);
  });

  it.each(Object.entries(NEGATIFS))('ne mord PAS : %s', (_nom, code) => {
    expect(scanHeroDebout('x.ts', code)).toEqual([]);
  });

  it('une recopie par le canonique du moteur (`isOutOfAction`) est vue elle aussi', () => {
    expect(scanHeroDebout('x.ts', 'party.find((h) => !isOutOfAction(h) && h.wounds.current > 0)')).toHaveLength(1);
  });

  it('rapporte la LIGNE d’origine, même après un import MULTI-LIGNE et sur un prédicat coupé en deux', () => {
    // `codeSeul` BLANCHIT sur place (lignes ET colonnes préservées) : sinon le finding désignait une
    // ligne qui n'existe plus, et le message envoyait le lecteur au mauvais endroit.
    const src = [
      "import {",
      "  alpha,",
      "  beta,",
      "} from './x';",
      '/* un bloc',
      '   sur trois',
      '   lignes */',
      'const m = party.find((h) => !h.dead',
      '  && h.wounds.current > 0);',
    ].join('\n');
    expect(scanHeroDebout('x.ts', src).map((f) => f.line)).toEqual([8]);
  });
});

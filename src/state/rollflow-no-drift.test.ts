import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { readCorpus } from '../../scripts/guards/lib/sourceCorpus.mjs';

/**
 * ANTI-DÉRIVE DU SYSTÈME DE JET — « tout passe par notre système » (fabrique + atomes PARTAGÉS).
 *
 * Les verbes d'influence sont des règles GLOBALES (LDB 17 l.24/68), applicables à N'IMPORTE quel
 * Test, donc implémentées UNE SEULE FOIS et réutilisées par TOUS les flux :
 *   • Chance « +1 DR » (LDB 17 l.24) → `bumpSL(tr)` (ajoute un Degré, `success` INTACT) ;
 *   • Résilience « Je ne faillirai pas ! » (l.68/73) → `bestForcedRoll(cible)` (dé forcé DR-MAX
 *     SELON la policy : standard → 01, mais Fast DR (LDB 12 l.102) → dé le plus HAUT valide) + `forcedTR` ;
 *   • dé CHOISI (picker) → `evaluateTest(forced.roll, cible)` ; Résistance → `resist`.
 * La fabrique `makeRollFlow` compose ces verbes ; un flux ne fournit que sa FORME (`resolve`/`lens`/
 * `bonus`/`caps`) — il ne doit JAMAIS RE-CODER la mécanique dans son closure.
 *
 * Ce garde SCANNE TOUT le code de résolution (src/state + src/engine, hors tests) et CASSE si une
 * signature de RE-CODAGE réapparaît. Il est né de dérives RÉELLES : une session parallèle a dé-lentillé
 * `activity` en recodant le dé forcé à `01` en dur (`evaluateTest(1, cible)` → DR MINIMAL en Fast DR)
 * et un `+1 DR` forçant `success:true` (le +1 DR de Chance n'écrit pas `success` — LDB 17 l.24, LDB 12 l.11) ; le même
 * `evaluateTest(1, …)` dormait aussi dans `shipManeuver.forceCrewRole` ET dans la Détermination d'une
 * étape de cascade — d'où le scan LARGE (le recodage ne vit pas que dans rollFlowSpecs.ts).
 *
 * Portée assumée (comme `roll-modal-invariant.test.ts`) : scan statique — n'attrape pas une obfuscation
 * par variable. Le filet BEHAVIORAL exhaustif (piloter chaque `*ForceSuccess` sous Fast DR et exiger le
 * DR MAX) reste le complément à ajouter.
 */
const NOYAU_DIR = fileURLToPath(new URL('../noyau/', import.meta.url));

/** Toutes les occurrences `chemin:ligne` d'un motif dans le code de résolution (hors tests). */
function scan(re: RegExp): string[] {
  const out: string[] = [];
  for (const { rel, text: src } of readCorpus(['src/state', 'src/noyau', 'src/engine'], { exts: ['.ts'] })) {
    for (const m of src.matchAll(re)) out.push(`${rel}:${src.slice(0, m.index!).split('\n').length}`);
  }
  return out;
}

describe('Anti-dérive du système de jet — tout passe par la fabrique + les atomes partagés', () => {
  it('Résilience : le dé forcé PAR DÉFAUT passe par bestForcedRoll (jamais evaluateTest(1, …) en dur)', () => {
    // Le dé qui MAXIMISE le DR d'une réussite forcée DÉPEND de la policy (Fast DR → 01 = DR MINIMAL).
    // `bestForcedRoll(cible)` porte ce choix ; un `evaluateTest(1, …)` dans un résolveur forcé le recode
    // en dur = bug Fast DR. Le dé CHOISI par le joueur reste `evaluateTest(forced.roll, …)` (autorisé).
    const hits = scan(/evaluateTest\(\s*0?1\s*,/g);
    expect(
      hits,
      `Dé forcé « 01 » codé en dur (${hits.join(', ')}) — route par bestForcedRoll(cible) (policy-aware, LDB 17 l.68 + Fast DR LDB 12 l.102).`,
    ).toEqual([]);
  });

  it('Chance « +1 DR » ne force JAMAIS success (LDB 17 l.24) — bumpSL ou success recalculé', () => {
    // `success` reste dérivé du d100 face à la cible (LDB 12 l.11) : `bumpSL(tr)` le garde ; un
    // `bonus.derive` qui écrit `sl: …+1, success: true` travestit la règle (bug maneuver/battement).
    const hits = scan(/\.sl\s*\+\s*1\s*,\s*success:\s*true/g);
    expect(
      hits,
      `« +1 DR » forçant success:true (${hits.join(', ')}) — utilise bumpSL(tr) ou recalcule success (roll ≤ cible).`,
    ).toEqual([]);
  });

  it('Réussite FORCÉE : passe par forcedTR (jamais le littéral { …, success: true, …, isDouble: isDoubleRoll(r) } recopié)', () => {
    // `forcedTR(roll, target, sl)` = { roll, target, success: true, sl, isDouble: isDoubleRoll(roll) } : l'atome
    // UNIQUE d'un TestResult de réussite FORCÉE (Résilience « Je ne faillirai pas ! » LDB 17 l.68 / dé choisi).
    // Recopier ce littéral dans un résolveur forcé = dérive → on l'exige via l'atome. Portée du scan : `success:
    // true` COMBINÉ à `isDoubleRoll(` sur la MÊME construction (le littéral forcé). Faux positifs exclus PAR
    // CONSTRUCTION du motif (comme demandé) : la Résistance (Menace) écrit `isDouble: false` — PAS `isDoubleRoll(`
    // — et les lentilles `actorTR` lisent la réussite NATURELLE (`success: p.…`), jamais `success: true`. Le SEUL
    // site légitime qui reste est le CORPS de `forcedTR` lui-même (engine/tests.ts, forme abrégée `{ roll, … }`) —
    // on l'exclut nommément (c'est la définition de l'atome, pas un recodage).
    const hits = scan(/success:\s*true\b[^}\n]*isDoubleRoll\(/g).filter((h) => !h.startsWith('src/engine/tests.ts:'));
    expect(
      hits,
      `Réussite forcée recopiée à la main (${hits.join(', ')}) — construis-la avec forcedTR(roll, target, sl) (atome partagé, engine/tests.ts).`,
    ).toEqual([]);
  });

  it('rollFlowSpecs ne construit AUCUN isDouble à la main — les atomes (hydrateTR/forcedTR) le dérivent', () => {
    // Le registre des flux ne doit JAMAIS appeler `isDoubleRoll(…)` : un TestResult de réussite FORCÉE passe
    // par `forcedTR`, un TestResult RÉ-HYDRATÉ depuis un détail stocké par `hydrateTR` — les deux centralisent
    // `isDouble` dans engine/tests.ts. Tout `isDoubleRoll(` ICI = un littéral recopié, TOUTE variante comprise
    // (source imbriquée `st.result.roll`, champs coercés `!!p.success`/`?? 0`) — que le scan par-signature ratait.
    // (Lire `result.isDouble` déjà posé reste OK : c'est un accès de champ, pas un appel à `isDoubleRoll`.)
    const specs = readFileSync(join(NOYAU_DIR, 'rollFlowSpecs.ts'), 'utf8');
    const hits = specs.split('\n').flatMap((l, i) => (/isDoubleRoll\(/.test(l) ? [`rollFlowSpecs.ts:${i + 1}`] : []));
    expect(hits, `isDoubleRoll( dans le registre des flux (${hits.join(', ')}) — utilise hydrateTR(detail) ou forcedTR(roll,target,sl).`).toEqual([]);
  });

  it('les atomes partagés du système sont bien la source (bumpSL / bestForcedRoll / forcedTR / hydrateTR présents dans rollFlowSpecs)', () => {
    // Preuve POSITIVE minimale : les atomes du système sont présents dans le registre des flux. Si un
    // refactor les retire au profit d'un recodage local, ce test tombe (avec les gardes ci-dessus).
    // `forcedTR` a REJOINT la liste depuis le balayage « zéro copie » : les littéraux TestResult de réussite
    // forcée des flux opposés (attack/defense/counterspell/castOpposition/maneuver) passent par l'atome.
    // `hydrateTR` a REJOINT la liste depuis la fermeture de la ré-hydratation (`{ …, isDouble: isDoubleRoll(X.roll) }`).
    const specs = readFileSync(join(NOYAU_DIR, 'rollFlowSpecs.ts'), 'utf8');
    for (const atom of ['bumpSL', 'bestForcedRoll', 'forcedTR', 'hydrateTR']) {
      expect(specs.includes(atom), `atome partagé « ${atom} » absent de rollFlowSpecs.ts — le système de jet a-t-il été contourné ?`).toBe(true);
    }
  });
});

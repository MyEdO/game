import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readCorpus } from '../../scripts/guards/lib/sourceCorpus.mjs';
import { MACHINERY_RX, scanHardcode } from '../../scripts/guards/lib/hardcode.mjs';
import { estFichierVitest } from '../../scripts/guards/lib/fichierVitest.mjs';

/**
 * Garde-fou « tout migrer » des réactions de combat (docs/combat-events-coherence.md).
 *
 * Compte les SITES RÉACTIFS codés PAR-NOM dans TOUT `src/engine` + `src/state` (récursif, `.ts`/
 * `.tsx`, HORS `*.test.*`) : une réaction de combat (pénalité, dégâts par round, bonus, Riposte,
 * Cleave, infection, contenu caché dans un hook…) doit devenir de la DONNÉE (`TriggeredEffect`/
 * `passive`), pas une branche impérative nommant l'entité. Deux familles de marqueurs
 * (`hardcode.mjs`) : TRAIT/TALENT (`hasTraitKey(`, `isUnstable`…) et PAR-ÉTAT (`hasCondition(_, COND.*)`
 * / `stacks(_, COND.*)`, #160, et leur forme en chaîne littérale `hasCondition(_, 'id')` /
 * `stacks(_, "id")`, #411). La famille PAR-ÉTAT retranche les GATES/mesures de machinerie universelle
 * (mort, gating, géométrie, journal, sélecteur d'ouverture) via `MACHINERY_RX` — des RÈGLES d'arène
 * générales, jamais un nom d'État éditable.
 *
 * MODE CLIQUET : `BASELINES` gèle, PAR FICHIER, le nombre de sites tolérés. Le test échoue si un
 * fichier DÉPASSE sa baseline (= nouveau hardcode = régression) OU si une baseline est devenue trop
 * haute (fichier assaini sans qu'elle soit abaissée). Un fichier absent de `BASELINES` a une
 * baseline 0 implicite.
 *
 * Mécanique de détection (marqueurs réactifs par-nom, exclusion des imports) :
 * `scripts/guards/lib/hardcode.mjs`.
 */

const ROOT = fileURLToPath(new URL('../..', import.meta.url)); // src/state/ → ../../ = racine du projet
const SCAN_DIRS = ['src/engine', 'src/state'];
const EXCLUDED = (rel: string) => estFichierVitest(rel);

/** Baseline gelée par fichier. Chaque abaissement = une vraie migration vers la donnée ; chaque hausse
 *  = une régression. Un `hasTraitKey(`/`hasTalent(` ne compte que si son 2e argument (le nom
 *  d'entité) est un LITTÉRAL de chaîne (`nameCallHasLiteralArg`, #385) ; une lecture PAR-ÉTAT en
 *  ligne de machinerie n'est retranchée que sous la forme canonique `COND.*` (#413). */
const BASELINES: Record<string, number> = {
  'src/engine/traits/dispatch.ts': 2, // isUnstable, isBestial : marqueurs par-nom nus
  'src/state/ai.ts': 6, // isBestial ; recover/retreat par-nom en-flammes et empetre (#411)
  'src/state/combatManeuvers.ts': 1, // isBestial en défense (#402)
  // Formes en chaîne littérale (#411), GELÉES, à résorber (doctrine #295)
  'src/engine/rest.ts': 8, // gate repos, fatigue/veille extenue, inconscient, a-terre (#413)
  'src/engine/suffocation.ts': 2, // pose Inconscient par-nom à l'issue du décompte
  'src/state/combatEffects.ts': 2, // détection « mis à terre » par-nom (a-terre)
  'src/engine/combat.ts': 1, // isHelplessTarget — hasCondition(c, 'inconscient')
  'src/engine/healing.ts': 1, // Soin ciblant un Inconscient par-nom
  // TABLE de références Codex (#1078) : `determination: { category: 'characteristics', id: 'determination' }`
  // matche la signature textuelle `id: 'determination` de TRAIT_TALENT_RX. Ce n'est PAS une réaction
  // par-nom (aucune branche) mais une entrée de TABLE d'ids stables — le vocabulaire même que la
  // garde promeut. Une SECONDE occurrence dans ce fichier, elle, échouera.
  'src/engine/ruleRefs.ts': 1,
  // Littéraux en ligne de machinerie (#413), GELÉS
  'src/engine/conditions.ts': 1, // isOutOfAction coque — hasCondition(c, 'naufrage') derrière un gate de mort
  'src/engine/exposure.ts': 1, // gate hypothermie — hasCondition(c, 'inconscient') derrière wounds<=0
  'src/state/outOfCombatUpkeep.ts': 1, // gate de veille — hasCondition(c, …) derrière wounds<=0
  'src/state/travelFlow.ts': 1, // instrumentation voyage — stacks(h, 'extenue')
  'src/state/travelPostes.ts': 2, // instrumentation voyage — stacks(h, 'extenue')
};

/** Nombre de sites réactifs par-nom, par fichier relatif (uniquement les fichiers non-vides). */
function countsByFile(): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const { rel, text } of readCorpus(SCAN_DIRS, { tests: true })) {
    if (EXCLUDED(rel)) continue;
    const n = scanHardcode(rel, text).length;
    if (n > 0) counts[rel] = n;
  }
  return counts;
}

describe('garde-fou « tout migrer » — réactions de combat hardcodées (cliquet)', () => {
  it('aucun fichier de src/engine + src/state ne dépasse sa baseline gelée', () => {
    const counts = countsByFile();
    const offenders: string[] = [];
    for (const [rel, n] of Object.entries(counts)) {
      const baseline = BASELINES[rel] ?? 0;
      if (n > baseline) offenders.push(`${rel} : ${n} sites réactifs par-nom (baseline gelée ${baseline})`);
    }
    expect(
      offenders,
      'Nouveau(x) hardcode(s) réactif(s) par-nom — migrer vers la DONNÉE (TriggeredEffect/passive), ' +
        `ou si migration déjà faite ABAISSER la baseline du fichier :\n${offenders.join('\n')}`,
    ).toEqual([]);
  });

  it('#385 — arg LITTÉRAL de chaîne signalé, arg DONNÉE/variable/paramètre non signalé', () => {
    // (a) littéral => réaction par-nom en dur => signalée.
    expect(scanHardcode('src/x.ts', "if (hasTraitKey(c.traits, 'tentacules')) {").length).toBe(1);
    expect(scanHardcode('src/x.ts', "const b = hasTalent(c, 'Béni');").length).toBe(1);
    // (b) accès de propriété / variable / paramètre => data-driven => NON signalé.
    expect(scanHardcode('src/x.ts', 'if (hasTalent(c, spec.easierIf!.hasTalent)) {').length).toBe(0);
    expect(scanHardcode('src/x.ts', 'const b = hasTraitKey(c.traits, key);').length).toBe(0);
    expect(scanHardcode('src/x.ts', 'export function hasTalent(c: Combatant, name: string): boolean {').length).toBe(0);
    // gabarit avec interpolation = dynamique => NON littéral ; sans interpolation => littéral.
    expect(scanHardcode('src/x.ts', 'const b = hasTalent(c, `${prefix}-beni`);').length).toBe(0);
    expect(scanHardcode('src/x.ts', 'const b = hasTalent(c, `beni`);').length).toBe(1);
  });

  it('#385 — le site data-driven réel combatEffects.ts (spec.easierIf!.hasTalent) n’est pas signalé', () => {
    const src = readFileSync(join(ROOT, 'src/state/combatEffects.ts'), 'utf8');
    const findings = scanHardcode('src/state/combatEffects.ts', src);
    expect(findings.map((f) => f.detail).filter((d) => /easierIf/.test(d))).toEqual([]);
  });

  it('#413 — backtick statique signalé, interpolé non signalé', () => {
    expect(scanHardcode('src/x.ts', 'if (hasCondition(c, `inconscient`)) {').length).toBe(1);
    expect(scanHardcode('src/x.ts', 'if (hasCondition(c, `${cond}`)) {').length).toBe(0);
    expect(scanHardcode('src/x.ts', 'hasCondition(c, `etat-${x}`)').length).toBe(0);
  });

  it('#413 — arg littéral en ligne de machinerie compté ; COND.* canonique retranché', () => {
    expect(scanHardcode('src/x.ts', "const _ = stacks(c, 'inconscient');").length).toBe(1);
    expect(scanHardcode('src/x.ts', 'if (hasCondition(c, COND.surpris)) const n = stacks(c, "x");').length).toBe(1);
    expect(scanHardcode('src/x.ts', 'const before = stacks(c, COND.extenue);').length).toBe(0);
  });

  it('#160 — chaque famille de MACHINERY_RX retranche sa lecture COND.*', () => {
    const lectureCanonique = (ligne: string) => `if (hasCondition(c, COND.surpris)) ${ligne}`;
    // Témoin : hors machinerie, la même lecture est comptée ; un 0 ci-dessous est donc un retranchement.
    expect(scanHardcode('src/x.ts', lectureCanonique('foo();')).length).toBe(1);
    const machinerie = [
      'if (c.dead) return;',
      'if (c.wounds.current <= 0) out();',
      'if (canTakeAction(c)) x();',
      'return reach;',
      'if (hasActiveCapability(c, k)) x();',
      'removeCondition(c, k);',
      'const n = stacks(c, COND.extenue);',
      'battle.log.push(line);',
      "return 'ambush';",
    ];
    for (const ligne of machinerie) {
      expect(MACHINERY_RX.test(ligne), ligne).toBe(true);
      expect(scanHardcode('src/x.ts', lectureCanonique(ligne)).length, ligne).toBe(0);
    }
  });

  it('CLIQUET : toute baseline devenue trop haute (fichier assaini) doit être ABAISSÉE', () => {
    // Sans ce resserrage, la baseline ne fond jamais : un fichier nettoyé par un lot suivant
    // resterait toléré à son ancien niveau. Ici elle devient rouge → la dette se rembourse
    // mécaniquement au fil des migrations.
    const counts = countsByFile();
    const stale: string[] = [];
    for (const [rel, baseline] of Object.entries(BASELINES)) {
      const n = counts[rel] ?? 0;
      if (n < baseline) stale.push(`${rel} : baseline ${baseline}, réel ${n} — ABAISSER la baseline`);
    }
    expect(stale, 'Baseline(s) PÉRIMÉE(s) — abaisser ces entrées de BASELINES').toEqual([]);
  });
});

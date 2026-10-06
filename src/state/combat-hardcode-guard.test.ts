import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readCorpus } from '../../scripts/guards/lib/sourceCorpus.mjs';
import { scanHardcode } from '../../scripts/guards/lib/hardcode.mjs';
import { estFichierVitest } from '../../scripts/guards/lib/fichierVitest.mjs';

/**
 * Garde-fou « tout migrer » — chantier d'unification des événements/réactions de combat.
 * (cf. docs/combat-events-coherence.md — Recensement Lot 0.)
 *
 * Compte les SITES RÉACTIFS codés PAR-NOM dans TOUT `src/engine` + `src/state` (récursif, `.ts`/
 * `.tsx`, HORS `*.test.*`) : une réaction de combat (pénalité, dégâts par round, bonus, Riposte,
 * Cleave, infection, contenu caché dans un hook…) doit devenir de la DONNÉE (`TriggeredEffect`/
 * `passive`), pas une branche impérative nommant l'entité. Deux familles de marqueurs (cf.
 * `hardcode.mjs`) : TRAIT/TALENT (`hasTraitKey(`, `isUnstable`…) et PAR-ÉTAT (`hasCondition(_, COND.*)`
 * / `stacks(_, COND.*)`, généralisé à tout l'arbre — issue #160 — puis ÉTENDU à la forme en chaîne
 * littérale `hasCondition(_, 'id')`/`stacks(_, "id")`, issue #411 : la forme quotée contournait le
 * scan). La famille PAR-ÉTAT retranche les GATES/mesures de machinerie universelle (mort, gating,
 * géométrie, journal, sélecteur d'ouverture) via `MACHINERY_RX` — des RÈGLES d'arène générales,
 * jamais un nom d'État éditable.
 *
 * MODE CLIQUET (Lot 8 — généralisation du report-only Lot 0/4bis/6, qui ne portait que sur 3
 * fichiers nommés) : `BASELINES` gèle, PAR FICHIER, le nombre de sites tolérés au recensement.
 * Le test échoue si un fichier DÉPASSE sa baseline (= nouveau hardcode = régression) OU si une
 * baseline est devenue trop haute (fichier assaini sans qu'elle soit abaissée — patron repris de
 * `no-emoji-affordance.test.ts` CLIQUET, lignes 100-111). Un fichier absent de `BASELINES` a une
 * baseline 0 implicite : `engine/conditions.ts`, `state/combat/roundHooks.ts`,
 * `state/combatFlow.ts` (les 3 cibles historiques du Lot 0, migrées aux Lots 4/4bis/6) y restent.
 *
 * Mécanique de détection (marqueurs réactifs par-nom, exclusion des imports) :
 * `scripts/guards/lib/hardcode.mjs` (module .mjs pur, partagé avec le hook pre-commit).
 */

const ROOT = fileURLToPath(new URL('../..', import.meta.url)); // src/state/ → ../../ = racine du projet
const SCAN_DIRS = ['src/engine', 'src/state'];
const EXCLUDED = (rel: string) => estFichierVitest(rel);

/** Baseline gelée par fichier (recensement Lot 8, 2026-07-06 — total 12 sites sur 7 fichiers ;
 *  révision 2026-07-11, `TRAIT_TALENT_RX` étendue à `hasTalent(` — 4 sites de trait/talent codés
 *  PAR-NOM révélés (Diction instinctive/Harmonisation aethyrique/Béni×2), MIGRÉS en donnée (#317) :
 *  Diction instinctive/Harmonisation aethyrique → `CombatFeature.castNoMiscastOnDouble`/
 *  `focusNoMiscastOnDouble` (dispatch `hasInstinctiveDiction`/`hasFocusHarmony`, id-only, comme
 *  tout `combatFeatures/dispatch.ts`) ; Béni (sélection de cible « Petites Prières ») → comparaison
 *  directe par id (`talentId === 'beni'`, patron déjà en place dans combatGeometry.ts/psychology.ts/
 *  provisions.ts/mount.ts/vision.ts). `combatFlow.ts`/`combatSlice.ts` retombent à 0.
 *  Révision #385 : la mécanique de scan ne signale un `hasTraitKey(`/`hasTalent(` que si son
 *  2e argument (le nom d'entité) est un LITTÉRAL de chaîne (`nameCallHasLiteralArg`) — un argument
 *  DONNÉE/variable est data-driven. Trois faux positifs retranchés STRUCTURELLEMENT : le site
 *  data-driven `hasTalent(c, spec.easierIf!.hasTalent)` (combatEffects.ts → 0) et les DÉFINITIONS
 *  auto-référentes `hasTalent(c, name)` / `hasTraitKey(traits, id)` (dispatch.ts → 2 :
 *  restent isUnstable/isBestial, marqueurs par-nom nus, hors périmètre #385).
 *  Chaque abaissement = une vraie migration vers la donnée ; chaque hausse = une régression.
 *
 *  Extension #411 (2026-07-13) : `PER_ETAT_RX` couvrait UNIQUEMENT `hasCondition(_, COND.*)` /
 *  `stacks(_, COND.*)` — les mêmes appels en chaîne littérale (`hasCondition(c, 'inconscient')`,
 *  `stacks(c, "extenue")`) échappaient totalement au scan (audit #410). Étendue aux formes quotées
 *  (même fonctions, argument chaîne), même retranchement `MACHINERY_RX`. Recensement du stock
 *  révélé (aucune migration dans ce lot — la garde arrête la croissance, patron #410) : 6 fichiers,
 *  12 sites, tous des réactions par-nom (aucun n'est retranché par `MACHINERY_RX`, qui ne couvre
 *  que les gates/mesures universels déjà listés) — GELÉS ci-dessous.
 *
 *  #402 (2026-07-14) : les 4 derniers `hasTraitKey(traits, '<littéral>')` codés PAR-NOM migrés vers
 *  le vocabulaire de CAPABILITY (`TraitData.capabilities`, lu par `traitCapability`/helpers dédiés) :
 *  `lanceur-de-sorts` → `capabilities.spellcaster` (magic.ts), `frenesie` → `capabilities.frenzyCapable`
 *  (psychology.ts), `nerveux` → `capabilities.skittishMount` déjà porté par le trait, appel direct à
 *  `isSkittishMount` (mount.ts), `mort-vivant` → `capabilities.undead` — le TRAIT, pas le Groupe bestiaire
 *  (contre-preuve du juge de réfutation : Goule de crypte, du Groupe « mort-vivant » DÉCLARÉ par son entrée
 *  (`CreatureData.grantGroups`, #1357) mais SANS le Trait, reste ciblable par Hurlement fantomatique,
 *  LDB 85 l.170 — `traitCapability(c.traits, 'undead')`, combatManeuvers.ts ; test verrou
 *  `maneuver-effects.test.ts`).
 *  `magic.ts`/`psychology.ts`/`mount.ts` retombent à 0 (retirés de `BASELINES`, défaut implicite).
 *  `combatManeuvers.ts` passe de 2 à 1 (reste `isBestial`, hors périmètre #402).
 *
 *  Révision #413 (2026-07-14) : deux durcissements de la mécanique de scan (`hardcode.mjs`), ZÉRO
 *  migration dans ce lot — la garde arrête la croissance, elle ne résorbe pas :
 *   (a) `PER_ETAT_RX` couvrait la quote (`'…'`/`"…"`) mais pas le gabarit BACKTICK STATIQUE
 *       (`` hasCondition(c, `inconscient`) ``) — routé via `perEtatHasLiteralArg` (jugement sur le
 *       segment ENTIER jusqu'au backtick fermant, même mécanique que `nameCallHasLiteralArg` #385),
 *       pas via une classe de caractères sur la regex (un 1er essai `` `(?!\$\{) `` flaguait à tort
 *       un préfixe littéral suivi d'interpolation plus loin dans le segment, ex. `` `etat-${x}` `` —
 *       corrigé en passant la détection au helper, seul juge fiable de la littéralité d'un backtick) ;
 *   (b) loophole d'INSTRUMENTATION : une ligne de machinerie (`const _ = stacks(c, …)`,
 *       `removeCondition`, gate `wounds.current <= 0`…) retranchait TOUTE lecture PAR-ÉTAT qui la
 *       matchait, y compris quand son argument était un NOM D'ÉTAT LITTÉRAL (`stacks(c, 'inconscient')`)
 *       plutôt que la constante canonique `COND.*` — le contournement passait inaperçu derrière la
 *       machinerie. Seule la forme canonique `COND.*` reste retranchée ; un littéral en machinerie est
 *       désormais COMPTÉ. Stock révélé (aucun de ces sites n'était du hardcode NOUVEAU, seulement
 *       masqué par la machinerie) : `engine/conditions.ts` (l.446, gate `isOutOfAction` coque —
 *       `hasCondition(c, 'naufrage')`), `engine/exposure.ts` (l.111, gate hypothermie), `engine/rest.ts`
 *       (5 sites revélés : l.97/112/113/141/155, instrumentation `stacks(c, 'extenue'/'inconscient'/
 *       'a-terre')` masquée derrière `const/let … = stacks(` ou `removeCondition`), `state/
 *       outOfCombatUpkeep.ts` (l.11, gate de veille), `state/travelFlow.ts` (l.687) et `state/
 *       travelPostes.ts` (l.278,308) — fatigue `extenue` par-nom en instrumentation de voyage. */
const BASELINES: Record<string, number> = {
  'src/engine/traits/dispatch.ts': 2,
  'src/state/ai.ts': 6, // dont #411 : recover/retreat par-nom en-flammes (l.526) + empetre (l.682,1098)
  'src/state/combatManeuvers.ts': 1, // #402 : hasTraitKey(mort-vivant) littéral → capabilities.undead (Trait), reste isBestial (défense)
  // #411 (2026-07-13) — stock révélé par l'extension aux littéraux, GELÉ, à résorber (doctrine #295)
  'src/engine/rest.ts': 8, // #413 : gate repos (l.13) + fatigue/veille extenue+inconscient+a-terre (l.97,112,113,125,141,145,155)
  'src/engine/suffocation.ts': 2, // pose Inconscient par-nom à l'issue du décompte (l.43,51)
  'src/state/combatEffects.ts': 2, // détection « mis à terre » par-nom (a-terre, l.776,779)
  'src/engine/combat.ts': 1, // isHelplessTarget — hasCondition(c, 'inconscient') (l.651)
  'src/engine/healing.ts': 1, // Soin ciblant un Inconscient par-nom (l.86)
  // TABLE de références Codex (#1078) : `determination: { category: 'characteristics', id: 'determination' }`
  // matche la signature textuelle `id: 'determination` de TRAIT_TALENT_RX. Ce n'est PAS une réaction
  // par-nom (aucune branche) mais une entrée de TABLE d'ids stables — le vocabulaire même que la
  // garde promeut. Une SECONDE occurrence dans ce fichier, elle, échouera.
  'src/engine/ruleRefs.ts': 1,
  // #413 (2026-07-14) — stock révélé par la fermeture du loophole d'instrumentation, GELÉ
  'src/engine/conditions.ts': 1, // isOutOfAction coque — hasCondition(c, 'naufrage') derrière gate wounds<=0 (l.446)
  'src/engine/exposure.ts': 1, // gate hypothermie — hasCondition(c, 'inconscient') derrière wounds<=0 (l.111)
  'src/state/outOfCombatUpkeep.ts': 1, // gate de veille — hasCondition(c, …) derrière wounds<=0 (l.11)
  'src/state/travelFlow.ts': 1, // instrumentation voyage — stacks(h, 'extenue') (l.687)
  'src/state/travelPostes.ts': 2, // instrumentation voyage — stacks(h, 'extenue') (l.278,308)
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

describe('garde-fou « tout migrer » — réactions de combat hardcodées (cliquet généralisé, Lot 8)', () => {
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

  it('#385 — le site data-driven réel combatEffects.ts (spec.easierIf!.hasTalent) ne remonte plus', () => {
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
    expect(scanHardcode('src/x.ts', 'const before = stacks(c, COND.extenue);').length).toBe(0);
  });

  it('CLIQUET : toute baseline devenue trop haute (fichier assaini) doit être ABAISSÉE', () => {
    // Sans ce resserrage, la baseline ne fond jamais : un fichier nettoyé par un lot suivant
    // resterait toléré à son ancien niveau. Ici elle devient rouge → la dette se rembourse
    // mécaniquement au fil des migrations (même patron que no-emoji-affordance.test.ts).
    const counts = countsByFile();
    const stale: string[] = [];
    for (const [rel, baseline] of Object.entries(BASELINES)) {
      const n = counts[rel] ?? 0;
      if (n < baseline) stale.push(`${rel} : baseline ${baseline}, réel ${n} — ABAISSER la baseline`);
    }
    expect(stale, 'Baseline(s) PÉRIMÉE(s) — abaisser ces entrées de BASELINES').toEqual([]);
  });
});

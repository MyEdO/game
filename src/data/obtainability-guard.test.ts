import { describe, it, expect } from 'vitest';
import { fileURLToPath } from 'node:url';
import { computeObtainability } from '../../scripts/data/lib/obtainabilityGraph';

/**
 * Garde-fou « obtenabilité réelle » (#321 lentille 1, cliquet baseline patron `scripts/guards/lib/`) :
 * fige le compte de Talents/Sorts JAMAIS-obtenables en jeu (aucune carrière/espèce/créature-statblock/
 * Table aléatoire/GameOp `grantTalent`/scène `learnSpell`/Talent de lanceur ne les confère — mécanique
 * dans `scripts/data/lib/obtainabilityGraph.ts`).
 * Baseline gelée au recensement (2026-07-11) : 6 Talents / 11 Sorts.
 *
 * Triage RAW #326 (2026-07-11) — DESCEND à 1 Talent / 0 Sort, verdict par entrée :
 * - `sang-neuf` (ADE I 6 « Guide de la Laurelorn » l.185-193) : Talent réservé au lignage Éonir
 *   Harioth (« si un Joueur souhaite relever le défi, il peut… ajouter à son Personnage Harioth un
 *   Talent spécial »/« traitée avec condescendance par les Éonirs des autres lignages ») — l'espèce
 *   Éonir n'est PAS jouable dans `species.json` (0 entrée). Contenu de référence, `codexOnly:true`.
 * - `benediction-de-tzeentch`/`disciple-du-changement`/`double-vie` (EDOC 13 « La Main pourpre »
 *   l.81-101) : « Les Talents suivants sont parfois accordés aux cultistes de Tzeentch, mais ne sont
 *   pas accessibles à d'autres personnes dans des circonstances normales » (l.83) — RAW lui-même les
 *   déclare hors progression PJ standard. `codexOnly:true`.
 * - `empreint-de-la-magie` (EDOC 13 « Influence Maléfique de Tzeentch » l.248-258) : octroyé comme
 *   effet d'Incantation imparfaite dans une zone influencée par Tzeentch — mécanique de scène de
 *   campagne (« Main pourpre ») non authorée dans `src/scenes/`. `codexOnly:true`.
 * - `magie-du-chaos` (LDB 10 l.702-710 ; carrière concrète EDOC 13 l.137 « Magus du Culte de
 *   Tzeentch — destinée uniquement aux PNJ … utilisée par les PJ avec la permission du MJ ») : AUCUNE
 *   carrière/mutation de nos livres ne l'accorde à un PJ (vérifié `careerLevels.json`/mutations table
 *   Physique+Mentale EDOC 12 — aucune entrée « Magie du Chaos », seule « Fuite aethyrique » octroie
 *   le Talent DISTINCT `sorcier`). `codexOnly:true` — cascade sur les 10 Sorts `family:'chaos'` orphelins
 *   (`allure-demoniaque`, `aspect-sublime`, `decharge-de-corruption`, `dechirer-l-aethyr`,
 *   `esclave-des-tenebres`, `explosion-de-corruption`, `obsession`, `odieux-messager`,
 *   `pouvoir-du-chaos`, `flot-de-corruption`) + `consentement` : exemptés via le même flag
 *   (`obtainabilityGraph.ts` exclut la famille `chaos` de `spellNever` quand `magie-du-chaos` est
 *   `codexOnly`), pas un silence par-sort.
 * - `talent-aleatoire` (LDB 05 l.484) : entrée MÉTA, exemptée via `META_CATALOG_ENTRIES`
 *   (`scripts/guards/lib/entityConsumers.mjs`, SOURCE UNIQUE partagée avec `src/data/entity-orphans.test.ts`
 *   — le fait n'est plus déclaré ici).
 *
 * Curation VDM (#734, 2026-07-26) — +8 : `assistant-magique` (`VDM 13 l.487`) et les 7 `empreint-*`
 * neufs (`VDM 13 l.461`), sans source d'octroi à leur arrivée : plafond monté de 1 → 9, DETTE
 * explicite à solder par les lots qui curèrent ces sources.
 *
 * Curation VDM (#731, 2026-07-26) — −1 : `assistant-magique` est octroyé par le gabarit `familier-de-pouvoir`
 * (`VDM 13 l.270`, `creatures.json`) → 9 → 8. Les 7 `empreint-*` restent dus : les gabarits de familier
 * l'impriment « Empreint de (Vent au choix) » (`VDM 13 l.256/270/282`) et `CreatureData.talents`
 * (`TalentRef` = `{ id, spec?, times? }`) n'a AUCUN vocabulaire de choix — pas de `{choice}`/`{wildcard}`
 * comme `AdvancementRef` (espèces/carrières).
 *
 * Curation VDM (#734, 2026-07-26) — −7 : les 8 tables « Marques Arcaniques de <Vent> » (`tables.json`,
 * `VDM 04 l.156` … `VDM 11 l.142`) octroient chacune son Talent *Empreint* en rangée 10 (op
 * `grantTalent`) → 8 → 1. Le graphe lit désormais `tables.json` comme source d'octroi
 * (`obtainabilityGraph.ts`, tag `table:<id>`) ; câblage prouvé par `vdm-marques-arcaniques.test.ts`.
 * `talent-aleatoire` désormais exempté via `META_CATALOG_ENTRIES` (cf. ci-dessus) → 1 → 0.
 *
 * Toute RÉGRESSION (compte qui grimpe sans nouveau `codexOnly` justifié) fait échouer la garde ; une
 * baisse (contenu réellement câblé) doit ABAISSER ce nombre ici — jamais l'inverse.
 */
const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const BASELINE = { talents: 0, spells: 0 };

describe('garde-fou obtenabilité réelle (talents/sorts jamais obtenables)', () => {
  it('le compte de Talents JAMAIS-obtenables ne dépasse pas la baseline gelée', () => {
    const { talentNever } = computeObtainability(ROOT);
    expect(
      talentNever.length,
      `Talents sans chemin d'obtention : ${talentNever.map((t) => t.id).join(', ')} — soit câbler une source (carrière/espèce/créature/mutation/étoile/scène), soit documenter la référence codex-seulement et AJUSTER la baseline (${BASELINE.talents}) de ce test`,
    ).toBeLessThanOrEqual(BASELINE.talents);
  });

  it('le compte de Sorts JAMAIS-obtenables ne dépasse pas la baseline gelée', () => {
    const { spellNever } = computeObtainability(ROOT);
    expect(
      spellNever.length,
      `Sorts sans Talent de lanceur/Domaine/Culte/scène : ${spellNever.map((v) => v.id).join(', ')} — soit câbler une source, soit AJUSTER la baseline (${BASELINE.spells}) de ce test`,
    ).toBeLessThanOrEqual(BASELINE.spells);
  });
});

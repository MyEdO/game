import { describe, it, expect } from 'vitest';
import { readCorpus } from '../scripts/guards/lib/sourceCorpus.mjs';

/**
 * Garde-fou #498 — toute valeur de carac/compétence AFFICHÉE (`src/ui`, `src/state`) passe par les
 * lecteurs canoniques du moteur (`effectiveChar`/`skillBaseValue`, `src/engine`). Motif interdit :
 * un accès brut `.characteristics` (TOKEN large — pas seulement `.characteristics[...]`, un alias
 * `const x = y.characteristics; x[k]` contourne aussi bien mutations/traumas/talents actifs). Scan
 * structurel de `src/ui/**` et `src/state/**`, hors `*.test.ts(x)` (les `.d.ts` ne sont déjà dans
 * aucun corpus).
 *
 * `CHAR_ACCESS_EXEMPT` (patron des exemptions nominatives au SITE) porte les
 * seuls sites légitimes restants : un champ `characteristics: CharKey[]` d'un NIVEAU de carrière
 * (`CareerLevel`, rien à voir avec `Combatant.characteristics`), ou une garde d'EXISTENCE d'une carac
 * de créature (la VALEUR affichée passe déjà par `effectiveChar`) — jamais une dispense de la valeur
 * elle-même. Comptage PAR LIGNE (une ligne = un site) ; toute entrée dont le compte réel diverge du
 * compte déclaré échoue (zéro entrée fantôme), toute ligne non exemptée échoue aussi.
 */

const DIRS = ['src/ui', 'src/state', 'src/noyau'];

const CHAR_ACCESS_RX = /\.characteristics\b/;

/** Sites légitimes restants (entrée par entrée, exemption nominative AU SITE) — `match` = sous-chaîne exacte de la ligne,
 *  `count` = nombre de LIGNES de `file` qui la portent (fail-closed si divergent). */
const CHAR_ACCESS_EXEMPT: { file: string; match: string; count: number; reason: string }[] = [
  {
    file: 'src/ui/compendium/registry.ts',
    match: 'const ch = c.characteristics',
    count: 1,
    reason: "garde d'existence d'une carac de créature — la VALEUR affichée passe par effectiveChar.",
  },
  {
    file: 'src/ui/compendium/registry.ts',
    match: 'lv.characteristics',
    count: 2,
    reason: "champ `characteristics: CharKey[]` d'un NIVEAU de carrière (CareerLevel), pas un Combatant.",
  },
  {
    file: 'src/ui/creator/CharacterCreator.tsx',
    match: 'lvlExplored.characteristics',
    count: 1,
    reason: "idem — champ `characteristics: CharKey[]` d'un NIVEAU de carrière (CareerLevel), pas un Combatant.",
  },
  {
    file: 'src/ui/editor/codex/CodexEdit.tsx',
    match: 'entry.characteristics as CharKey[]',
    count: 1,
    reason: "éditeur Codex GÉNÉRIQUE de champ `characteristics: CharKey[]` (CareerLevel/DomainData) — édite une LISTE d'ids CharKey, pas une valeur de Combatant.",
  },
  {
    file: 'src/ui/compendium/relations.ts',
    match: 'lv.characteristics',
    count: 1,
    reason: "champ `characteristics: CharKey[]` d'un NIVEAU de carrière (CareerLevel), pas un Combatant.",
  },
  {
    file: 'src/ui/creator/draft.ts',
    match: 'draftLevel(d)?.characteristics',
    count: 1,
    reason: "champ `characteristics: CharKey[]` d'un NIVEAU de carrière (CareerLevel), pas un Combatant.",
  },
];

describe('garde-fou lecteurs canoniques carac/compétence à l’affichage (#498)', () => {
  it('aucun src/ui ou src/state n’accède aux caracs hors effectiveChar/skillBaseValue (hors exemptions nominatives)', () => {
    const offenders: string[] = [];
    const exemptHits = new Map<string, number>();

    for (const { rel, text } of readCorpus(DIRS)) {
      const lines = text.split('\n');
      lines.forEach((line, i) => {
        if (CHAR_ACCESS_RX.test(line)) {
          const exemption = CHAR_ACCESS_EXEMPT.find((e) => e.file === rel && line.includes(e.match));
          if (exemption) {
            const key = `${exemption.file}\u0000${exemption.match}`;
            exemptHits.set(key, (exemptHits.get(key) ?? 0) + 1);
          } else {
            offenders.push(`${rel}:${i + 1} [accès brut .characteristics] ${line.trim()}`);
          }
        }
      });
    }

    expect(
      offenders,
      `Accès non canonique carac/compétence détecté — utiliser effectiveChar(c, key) / skillBaseValue(c, skillId, spec) (src/engine/characteristics.ts, src/engine/skills.ts) :\n${offenders.join('\n')}`,
    ).toEqual([]);

    const staleExemptions = CHAR_ACCESS_EXEMPT.filter((e) => (exemptHits.get(`${e.file}\u0000${e.match}`) ?? 0) !== e.count).map(
      (e) => `${e.file} « ${e.match} » — attendu ${e.count}, trouvé ${exemptHits.get(`${e.file}\u0000${e.match}`) ?? 0}`,
    );
    expect(staleExemptions, `Exemption(s) périmée(s) (compte réel ≠ compte déclaré) — nettoyer CHAR_ACCESS_EXEMPT :\n${staleExemptions.join('\n')}`).toEqual([]);
  });
});

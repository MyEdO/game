/**
 * GARDE dérivée des INSTANCES — anti-dérive du SCHÉMA d'argument des Traits (filet exhaustif).
 *
 * Balaie CHAQUE instance de trait de la donnée et vérifie que la DÉCLARATION de schéma du trait
 * (`TraitData` : `indice` / `specsSource` / `specsOpen` / `specsMulti`, cf. `index.ts`) COUVRE ce que
 * l'instance porte. Trois INVARIANTS stricts, sans tolérance ad hoc ni baseline de dette (aucun élément
 * différé) — même esprit que la GARDE EXHAUSTIVE de `refs-migrated.test.ts` (walk + offenders + `expect([])`) :
 *   1. `value` numérique ⟹ le trait déclare `indice` (le sens de la valeur).            → « missing-indice »
 *   2. `arg` RÉSOUT dans le registre de sa source — sur une source FERMÉE c'est la seule issue ; sur une
 *      source OUVERTE (`specsOpen`), un `arg` qui NE résout PAS comme id mais reproduit EXACTEMENT le
 *      LIBELLÉ d'un id du même registre est encore un libellé pris pour un id (#145) → « label-as-id ».
 *      Un descripteur NATUREL/libre qui ne matche NI id NI libellé reste légitime (« Griffes », « Crocs »).
 *   3. Toute instance porteuse d'un `id` RÉSOUT dans `traits.json` (id de trait connu).    → « id fantôme »
 * Un `arg` sur un trait SANS `specsSource` est un descripteur TEXTE LIBRE (« Corruption (Mineure) », « Armure
 * (Cuir 2) ») — légitime, non contraint (même convention que `refs-migrated` : hors catalogue = verbatim).
 *
 * ── PÉRIMÈTRE ─────────────────────────────────────────────────────────────────────────────────────
 * Les instances vivent dans `creatures.json` (`traits[]` profil imprimé + `optionals[]`, LDB 76) ET dans
 * les STATBLOCS D'AUTEUR des scénarios de test (`src/scenes/test-scenarios/**`, registre `testScenarios`)
 * ET le PROJET d'éditeur de la campagne Arène
 * (`src/scenes/arene/arene-projet.json`, compilé via `parseProject`, #146) — un statbloc/projet de scène
 * est une SOURCE de données comme le bestiaire, la même dérive (libellé tapé à la main au lieu de l'id)
 * s'y produit (#145, #146). TOUTES sont id-based `{ id, value?, arg?, range?, count? }` — la liste
 * `optionals[]` du bestiaire peut AUSSI porter des OPTIONNELS COMPOSÉS (`OptionalEntry`, #174) : une
 * NOTE discriminée par `note` (« all-traits » = joker Mutant LDB 83 l.91 ; « swap » = variante « remplacer
 * des Traits par un bonus », Grand Loup/Griffon ZI). Ces notes n'ont ni `id` ni `value` de premier niveau
 * (le bonus vit sous `grant`) → naturellement hors des invariants #1/#2/#3, sans exclusion ad hoc.
 *
 * Les instances CONSTRUITES par op (`grantTrait { traitId, arg? }`, dans mutations/sorts/traits/États/
 * maladies) sont balayées par l'invariant #4 (même résolution, fermée ET ouverte, que #2). Toute dérive
 * FUTURE (un `value` sans `indice`, un `arg` pris pour un libellé, un `id` de trait fantôme, un
 * `grantTrait` à arg libellé) fait échouer la garde en LISTANT les fautifs.
 *   4. `grantTrait { traitId, arg }` (ops) : l'arg RÉSOUT dans le registre du trait ciblé.  → « op label-as-id »
 */
import { describe, it, expect } from 'vitest';
import { traits, creatures, mutations, spells, etats, maladies, SPEC_SOURCES, type SpecsSource, type TraitData } from './index';
import { testScenarios } from '../scenes/test-scenarios';
import { parseProject } from '../state/worldMap';
import areneProjetJson from '../scenes/arene/arene-projet.json';
import type { Scene } from '../state/scene';

/** Forme BRUTE d'une instance. Typage local : un `TraitInstance` porte `id` ; un OPTIONNEL COMPOSÉ
 *  (`OptionalEntry`, #174) porte `note` (et jamais `id`/`value` de premier niveau) → accès via ce shape. */
type RawTraitInstance = { id?: string; note?: string; value?: unknown; arg?: unknown; range?: unknown; count?: unknown };

const byId = new Map(traits.map((t) => [t.id, t] as const));

/** Sentinelle joker d'un statbloc RAW (« Animosité (un au choix) », « Peur (Au choix) ») — tolérée. */
const WILDCARD = /^(un |une |deux )?au choix$/i;

/** Résout un texte comme LIBELLÉ (pas id) d'une source de spéc partagée : l'id du POOL (choisissable,
 *  cf. doctrine `SPEC_SOURCES`) dont `.label()` reproduit EXACTEMENT ce texte. Sert l'invariant #2/#4 sur
 *  une source OUVERTE — un descripteur naturel/libre (« Griffes ») ne matche NI id NI libellé et reste
 *  légitime ; seul un texte qui EST le libellé d'un id réel est un libellé pris pour un id. */
function labelAsId(src: SpecsSource, text: string): string | undefined {
  return SPEC_SOURCES[src].pool().find((id) => SPEC_SOURCES[src].label(id) === text);
}

interface Row { inst: RawTraitInstance; def: TraitData | undefined; where: string; hasId: boolean; }

/** Scènes balayées par la garde : le registre des scénarios de test (menu « 🧪 Tests ») + le PROJET d'éditeur de la
 *  campagne Arène (`arene-projet.json`, compilé via `parseProject`/`buildScene` — MÊME schéma
 *  d'instance qu'un scénario de test). Un projet d'éditeur reste une SOURCE de données comme un
 *  scénario ou le bestiaire : la même dérive (libellé tapé à la main au lieu de l'id) s'y produit
 *  (#146, même classe que #145/#142) — plus d'exclusion par nature de fichier. */
const scenesToScan: Scene[] = [...testScenarios.map((s) => s.scene), ...parseProject(areneProjetJson).scenes];

/** Statblocs D'AUTEUR des scénarios de test/projets d'éditeur — même schéma d'instance que le
 *  bestiaire (id-based), soumis aux mêmes invariants #1/#2/#3. Balaie
 *  `statblock.traits` (profil d'auteur, ex. un statbloc de Nuée/Dragon) ET `combat.optionals` (Traits
 *  FACULTATIFS choisis sur une entité `ref`, LDB 76 l.45, ex. « Lanceur de Sorts » d'un cultiste) —
 *  même schéma `TraitInstance`, même dérive possible dans les deux. */
function* eachSceneInstance(): Generator<Row> {
  for (const scene of scenesToScan) {
    for (const ent of scene.entities) {
      const lists: [RawTraitInstance[], string][] = [
        [(ent.statblock?.traits ?? []) as unknown as RawTraitInstance[], 'traits'],
        [(ent.combat?.optionals ?? []) as unknown as RawTraitInstance[], 'optionals'],
      ];
      for (const [list, key] of lists) {
        for (const inst of list) {
          const def = typeof inst.id === 'string' ? byId.get(inst.id) : undefined;
          yield { inst, def, where: `scene:${scene.id}.${ent.id}.${key}[${String(inst.id)}]`, hasId: typeof inst.id === 'string' };
        }
      }
    }
  }
}

/** Toutes les instances de trait (`creatures.json` `traits[]`/`optionals[]` + statblocs de scène), def
 *  résolue par `id` (byId). Les OPTIONNELS COMPOSÉS (`note`, #174) n'ont pas d'`id` → def undefined,
 *  `hasId` faux : hors des invariants #1/#2/#3. `hasId` = l'instance porte un vrai `id` (⇒ soumise à #2/#3). */
function* eachInstance(): Generator<Row> {
  for (const c of creatures) {
    for (const list of ['traits', 'optionals'] as const) {
      for (const inst of (c[list] ?? []) as unknown as RawTraitInstance[]) {
        const def = typeof inst.id === 'string' ? byId.get(inst.id) : undefined;
        yield { inst, def, where: `${c.label}.${list}[${String(inst.id ?? inst.note)}]`, hasId: typeof inst.id === 'string' };
      }
    }
  }
  yield* eachSceneInstance();
}

/** Parts d'un `arg` : liste séparée par virgules si `specsMulti`, sinon l'arg entier. */
const argParts = (arg: string, multi: boolean): string[] =>
  (multi ? arg.split(',').map((s) => s.trim()) : [arg.trim()]).filter(Boolean);

describe('schéma d\'argument des traits — chaque instance est COUVERTE par la déclaration de son trait', () => {
  it('value numérique ⟹ le trait déclare `indice` (sens de la valeur)', () => {
    const offenders: string[] = [];
    for (const { inst, def, where } of eachInstance()) {
      if (!def || typeof inst.value !== 'number') continue;
      if (!def.indice) offenders.push(`${where} value=${inst.value} (aucun \`indice\` déclaré)`);
    }
    expect(offenders, `value numérique sans \`indice\` déclaré :\n${offenders.join('\n')}`).toEqual([]);
  });

  it('arg RÉSOUT dans le registre de sa source — jamais un libellé de catalogue pris pour un id (source FERMÉE ou OUVERTE)', () => {
    const offenders: string[] = [];
    for (const { inst, def, where, hasId } of eachInstance()) {
      if (!hasId || !def || typeof inst.arg !== 'string') continue;
      const src: SpecsSource | undefined = def.specsSource;
      if (!src) continue; // sans source = descripteur texte libre (légitime, non contraint)
      if (WILDCARD.test(inst.arg.trim())) continue; // sentinelle « au choix » sur l'arg entier
      for (const part of argParts(inst.arg, !!def.specsMulti)) {
        if (WILDCARD.test(part)) continue; // part joker « un au choix »
        if (SPEC_SOURCES[src].resolves(part)) continue; // id valide
        if (!def.specsOpen) { offenders.push(`${where} → ${src}: ${JSON.stringify(part)} (id inconnu du registre)`); continue; }
        // Source OUVERTE : légitime SAUF si le texte EST le libellé d'un id du même registre (#145).
        const asId = labelAsId(src, part);
        if (asId) offenders.push(`${where} → ${src}: ${JSON.stringify(part)} est le libellé de « ${asId} » — utiliser l'id`);
      }
    }
    expect(offenders, `arg non résolu (libellé pris pour un id ?) :\n${offenders.join('\n')}`).toEqual([]);
  });

  it('toute instance porteuse d\'un `id` RÉSOUT dans traits.json — jamais un id de trait fantôme (les entrées prose portent `key`, pas `id`)', () => {
    const offenders: string[] = [];
    for (const { inst, where, hasId } of eachInstance()) {
      if (!hasId) continue; // entrées prose non migrées : `key`, pas `id` → hors de cet invariant
      if (!byId.has(inst.id as string)) {
        const carries = [inst.value != null && 'value', inst.arg != null && 'arg', inst.range != null && 'range'].filter(Boolean).join('/');
        offenders.push(`${where} → id « ${String(inst.id)} » introuvable dans traits.json${carries ? ` (porte ${carries})` : ''}`);
      }
    }
    expect(offenders, `id de trait fantôme :\n${offenders.join('\n')}`).toEqual([]);
  });

  it('grantTrait { traitId, arg } (mutations/sorts/traits/États/maladies) : l\'arg RÉSOUT dans le registre du trait (fermé ou ouvert)', () => {
    const offenders: string[] = [];
    const walk = (node: unknown, where: string): void => {
      if (Array.isArray(node)) { for (const n of node) walk(n, where); return; }
      if (!node || typeof node !== 'object') return;
      const o = node as Record<string, unknown>;
      if (o.op === 'grantTrait' && typeof o.traitId === 'string' && typeof o.arg === 'string') {
        const def = byId.get(o.traitId);
        const src: SpecsSource | undefined = def?.specsSource;
        if (def && src && !WILDCARD.test(o.arg.trim())) {
          for (const part of argParts(o.arg, !!def.specsMulti)) {
            if (WILDCARD.test(part)) continue;
            if (SPEC_SOURCES[src].resolves(part)) continue;
            if (!def.specsOpen) { offenders.push(`${where} grantTrait ${o.traitId} → ${src}: ${JSON.stringify(part)}`); continue; }
            const asId = labelAsId(src, part);
            if (asId) offenders.push(`${where} grantTrait ${o.traitId} → ${src}: ${JSON.stringify(part)} est le libellé de « ${asId} » — utiliser l'id`);
          }
        }
      }
      for (const v of Object.values(o)) walk(v, where);
    };
    for (const m of mutations) walk(m, `mutation:${m.id}`);
    for (const t of traits) walk(t, `trait:${t.id}`);
    for (const s of spells) walk(s, `spell:${s.id}`);
    for (const e of etats) walk(e, `etat:${e.id}`);
    for (const md of maladies) walk(md, `maladie:${md.id}`);
    expect(offenders, `grantTrait à arg non résolu (libellé pris pour un id ?) :\n${offenders.join('\n')}`).toEqual([]);
  });
});

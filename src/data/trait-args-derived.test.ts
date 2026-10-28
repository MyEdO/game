/**
 * GARDE dérivée des INSTANCES — anti-dérive du SCHÉMA d'argument des Traits (filet exhaustif).
 *
 * Balaie CHAQUE instance de trait de la donnée et vérifie que la DÉCLARATION de schéma du trait
 * (`TraitData` : `indice` / `specsSource` / `specsOpen`, cf. `index.ts`) COUVRE ce que
 * l'instance porte. INVARIANTS stricts, sans tolérance ad hoc ni baseline de dette (aucun élément
 * différé) — même esprit que la GARDE EXHAUSTIVE de `refs-migrated.test.ts` (walk + offenders + `expect([])`) :
 *   1. `value` numérique ⟹ le trait déclare `indice` (le sens de la valeur).            → « missing-indice »
 *   2. `arg` : le prédicat du SCHÉMA d'instance (`refusDArgHorsRegistre`, `grammaire/reference.ts`) — sur
 *      un registre FERMÉ, l'`arg` résout un id ; sur un registre OUVERT (`specsOpen`), il ne reproduit
 *      pas le LIBELLÉ d'un id du registre (#145). Un descripteur libre qui ne matche NI id NI
 *      libellé reste légitime (« Griffes », « Crocs »).
 * L'`id` d'une instance est une feuille `idDe('trait')` du schéma : un id fantôme est refusé au parse.
 * Un `arg` sur un trait SANS `specsSource` ni `specsOpen` est un descripteur TEXTE LIBRE, non contraint.
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
 * (le bonus vit sous `grant`) → naturellement hors des invariants #1/#2, sans exclusion ad hoc.
 *
 * Le Trait OCTROYÉ par op (`grantTrait.trait`) est un Trait posé (`traitInstanceSchema`) : le parse lui
 * oppose les mêmes refus. Toute dérive FUTURE (un `value` sans `indice`, un `arg` pris pour un
 * libellé) fait échouer la garde en LISTANT les fautifs.
 */
import { describe, it, expect } from 'vitest';
import { traits, creatures, type TraitData } from './index';
import { testScenarios } from '../scenes/test-scenarios';
import { parseProject } from '../noyau/worldMap';
import areneProjetJson from '../scenes/arene/arene-projet.json';
import type { Scene } from '../noyau/monde/scene';
import { fileURLToPath } from 'node:url';
import { scanDuCorpus } from '../../scripts/docs/lib/structures-scan.mjs';
import { refusDArgHorsRegistre } from './schemas/grammaire/reference';

/** Entrées partielles embarquées du corpus des DEUX racines (`scanDuCorpus`), mesurées UNE fois. */
const ENTREES_PARTIELLES = scanDuCorpus(fileURLToPath(new URL('../..', import.meta.url))).scan.entreesPartielles;

/** Forme BRUTE d'une instance. Typage local : un `TraitInstance` porte `id` ; un OPTIONNEL COMPOSÉ
 *  (`OptionalEntry`, #174) porte `note` (et jamais `id`/`value` de premier niveau) → accès via ce shape. */
type RawTraitInstance = { id?: string; note?: string; value?: unknown; arg?: unknown; range?: unknown; count?: unknown };

const byId = new Map(traits.map((t) => [t.id, t] as const));

interface Row { inst: RawTraitInstance; def: TraitData | undefined; where: string; hasId: boolean; }

/** Scènes balayées par la garde : le registre des scénarios de test (menu « 🧪 Tests ») + le PROJET d'éditeur de la
 *  campagne Arène (`arene-projet.json`, compilé via `parseProject`/`buildScene` — MÊME schéma
 *  d'instance qu'un scénario de test). Un projet d'éditeur reste une SOURCE de données comme un
 *  scénario ou le bestiaire : la même dérive (libellé tapé à la main au lieu de l'id) s'y produit
 *  (#146, même classe que #145/#142) — plus d'exclusion par nature de fichier. */
const scenesToScan: Scene[] = [...testScenarios.map((s) => s.construire().scene), ...parseProject(areneProjetJson).scenes];

/** Statblocs D'AUTEUR des scénarios de test/projets d'éditeur — même schéma d'instance que le
 *  bestiaire (id-based), soumis aux mêmes invariants #1/#2. Balaie
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

/** ENTRÉES PARTIELLES de `creatures.json` embarquées ailleurs (`entreesPartiellesEmbarquees`,
 *  `scripts/docs/lib/structures-scan.mts`) — profils de presets de PNJ : mêmes `traits`/`optionals`
 *  que le bestiaire dont elles sont le patch, mêmes invariants. */
function* eachEntreePartielle(): Generator<Row> {
  for (const [objet, fiche] of ENTREES_PARTIELLES) {
    if (fiche.document !== 'creatures.json') continue;
    for (const list of ['traits', 'optionals'] as const) {
      for (const inst of ((objet as Record<string, unknown>)[list] ?? []) as RawTraitInstance[]) {
        const def = typeof inst.id === 'string' ? byId.get(inst.id) : undefined;
        yield { inst, def, where: `${fiche.hote}:${fiche.id ?? '?'}.${list}[${String(inst.id ?? inst.note)}]`, hasId: typeof inst.id === 'string' };
      }
    }
  }
}

/** Toutes les instances de trait (`creatures.json` `traits[]`/`optionals[]` + statblocs de scène), def
 *  résolue par `id` (byId). Les OPTIONNELS COMPOSÉS (`note`, #174) n'ont pas d'`id` → def undefined,
 *  `hasId` faux : hors des invariants #1/#2. `hasId` = l'instance porte un vrai `id` (⇒ soumise à #2). */
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
  yield* eachEntreePartielle();
}

/** Fautes de l'`arg` `arg` du Trait `def` : le prédicat du SCHÉMA (`refusDArgHorsRegistre`). */
function fautesDArg(def: TraitData, arg: string): string[] {
  const refus = refusDArgHorsRegistre(def.id, arg);
  return refus ? [refus] : [];
}

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
      for (const faute of fautesDArg(def, inst.arg)) offenders.push(`${where} → ${faute}`);
    }
    expect(offenders, `arg non résolu (libellé pris pour un id ?) :\n${offenders.join('\n')}`).toEqual([]);
  });
});

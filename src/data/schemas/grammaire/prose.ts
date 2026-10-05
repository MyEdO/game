/**
 * PROSE d'un document (#1389 Lot A, épique #1388) — la FORME que prend un texte de livre dans la
 * donnée, et les VERROUS qui rendent l'état interdit inexprimable au parse.
 *
 * Un texte, un PORTEUR : soit `desc` (la prose est écrite dans l'entrée), soit `descRef` (l'entrée
 * ADRESSE le passage du livre, qui reste sa seule copie). Les deux ensemble seraient deux vérités.
 *
 * Ce fichier est le SEUL endroit où cette forme et ses verrous se déclarent : `enveloppe()`
 * (`document.ts`) le compose pour les 122 documents, et `proseAdressable()` le compose pour un
 * schéma de RANGÉE dont la prose vit en rangée. Un scanner à côté du parse, ou une déclaration par
 * def, seraient la porte ouverte qu'on ferme ici.
 */
import { z } from 'zod';
import { descRefSchemaDe, type GenreDeFragment } from './valeurs';
import { estExtrait } from './livres-extraits';
import { PROSE_INLINE_TOLEREE } from './prose-inline';
import type { CheminProseDeScene } from './champs-prose-de-scene';

/**
 * DÉCLARE un champ de prose de scène : `z.string()` NOMMÉ par son chemin. Le type du paramètre est le
 * catalogue fermé `CHAMPS_PROSE_DE_SCENE` (`./champs-prose-de-scene`) — un champ de prose déclaré
 * sans être inventorié ne compile pas, et un chemin inventorié sans site de déclaration ici est
 * rouge à la garde de câblage (`src/ui/compendium/liens-du-catalogue.test.tsx`, qui balaie les defs).
 */
export function proseDeScene(_chemin: CheminProseDeScene) {
  return z.string();
}

/**
 * Les deux porteurs de prose, TOUJOURS optionnels au type : « exiger la prose » ne dit pas SOUS
 * QUELLE FORME, et c'est le refine (V4) qui l'exige — pas l'optionalité d'un des deux champs.
 *
 * `desc` porte un `.min(1)` STRUCTUREL, même classe que le `maison` de l'enveloppe : une chaîne vide
 * est un TROISIÈME état, vu « présent » par `search.ts` et « absent » par `CodexRef`. Absente plutôt
 * que vide ou nulle.
 */
export function champsProse(fragmentsAdmis?: readonly GenreDeFragment[]) {
  return {
    desc: z.string().min(1).optional(),
    descRef: descRefSchemaDe(fragmentsAdmis).optional(),
  };
}

/** Ce que le refine doit savoir du site qu'il garde. */
export interface ContexteProse {
  /** `type` du document — la clé que le stock de prose inline consulte. */
  readonly type: string;
  /** Nom du SITE gardé, pour un message qui distingue l'entrée de sa rangée (`criticals>rangee`). */
  readonly site: string;
  /** Ce site exige-t-il une prose (quel qu'en soit le porteur) ? */
  readonly exigeProse: boolean;
}

/** Forme d'un nœud, du seul point de vue de la prose et de sa provenance. */
interface NoeudProse {
  desc?: unknown;
  descRef?: { book?: unknown };
  source?: { book?: unknown };
}

/**
 * Les quatre verrous de la prose, à poser en `superRefine` PRÉ-sceau sur le nœud qui la porte.
 *
 * V1 EXCLUSIVITÉ — `desc` et `descRef` ensemble : deux porteurs pour un texte.
 * V2 RÉSOLUBILITÉ — une adresse dans un livre sans extraction FR sur disque ne rend rien.
 * V2b COHÉRENCE — l'adresse et la `source` doivent désigner le MÊME livre : une localisation
 *     secondaire vit dans `alsoIn`, pas dans une adresse qui contredit l'ancre.
 * V3 NON-RÉGRESSION — une prose recopiée d'un livre EXTRAIT s'ADRESSE, sauf tant que le type est au
 *     stock `PROSE_INLINE_TOLEREE` (dénominateur décroissant de #1390). `maison` ne dispense pas :
 *     le champ `maison` et une prose verbatim du livre COEXISTENT dans la donnée (mesuré 2026-09-05 :
 *     32 nœuds sur les deux racines) ; une prose sans folio, elle, n'a pas de `source` du tout
 *     (refine de provenance de `document.ts` : `source` ⊕ `maison`).
 * V4 OBLIGATION — un site qui exige la prose l'exige sous l'un des deux porteurs.
 */
export function refineProse(ctx: ContexteProse): (v: unknown, refine: z.RefinementCtx) => void {
  const { type, site, exigeProse } = ctx;
  return (v, refine) => {
    const n = (v ?? {}) as NoeudProse;
    const aDesc = typeof n.desc === 'string' && n.desc.length > 0;
    const adresse = n.descRef;
    const livreAdresse = typeof adresse?.book === 'string' ? adresse.book : undefined;
    const livreSource = typeof n.source?.book === 'string' ? n.source.book : undefined;

    if (aDesc && adresse !== undefined) {
      refine.addIssue({
        code: 'custom',
        path: ['descRef'],
        message: `document('${type}') · ${site} : \`desc\` ET \`descRef\` — un texte, un porteur (#1388 §2.2).`,
      });
    }
    if (adresse !== undefined && !estExtrait(livreAdresse)) {
      refine.addIssue({
        code: 'custom',
        path: ['descRef', 'book'],
        message: `document('${type}') · ${site} : adresse dans un livre sans extraction : irrésoluble (« ${String(livreAdresse)} » n'a pas de \`dir\` dans \`books.json\`).`,
      });
    }
    if (adresse !== undefined && livreSource !== undefined && livreSource !== livreAdresse) {
      refine.addIssue({
        code: 'custom',
        path: ['descRef', 'book'],
        message: `document('${type}') · ${site} : la source cite un autre livre que l'adresse (« ${livreSource} » ≠ « ${String(livreAdresse)} ») — une localisation secondaire vit dans \`alsoIn\`.`,
      });
    }
    if (aDesc && estExtrait(livreSource) && !(type in PROSE_INLINE_TOLEREE)) {
      refine.addIssue({
        code: 'custom',
        path: ['desc'],
        message: `document('${type}') · ${site} : prose recopiée d'un livre extrait : l'entrée l'ADRESSE (\`descRef\`).`,
      });
    }
    if (exigeProse && !aDesc && adresse === undefined) {
      refine.addIssue({
        code: 'custom',
        path: ['desc'],
        message: `document('${type}') · ${site} : prose obligatoire pour ce document — \`desc\` ou \`descRef\`.`,
      });
    }
  };
}

/**
 * Rend un schéma de RANGÉE porteur de prose ADRESSABLE : la même forme et le même refine que
 * l'enveloppe, une déclaration de plus. À composer par le schéma de rangée d'une famille dont la
 * prose vit en rangée, AU MOMENT de sa migration (`defs/criticals.ts`, Lot C).
 */
export function proseAdressable<S extends z.ZodObject<z.ZodRawShape>>(schema: S, ctx: ContexteProse): z.ZodObject<z.ZodRawShape> {
  return schema.extend(champsProse()).superRefine(refineProse(ctx)) as unknown as z.ZodObject<z.ZodRawShape>;
}

/**
 * FORME DISQUE d'une racine de document : la prose MATÉRIALISÉE d'un nœud adressé (le `desc` injecté
 * à la lecture) est retirée, à toute profondeur, tableaux compris. Un nœud sans `descRef` n'est pas
 * touché. Fonction PURE : elle rend une nouvelle structure, l'entrée n'est jamais mutée.
 * Consommée au site UNIQUE de sérialisation des routes d'édition (commit C3).
 */
export function versDisque<T>(racine: T): T {
  const copie = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(copie);
    if (!v || typeof v !== 'object') return v;
    const source = v as Record<string, unknown>;
    const adresse = source.descRef !== undefined;
    const out: Record<string, unknown> = {};
    for (const [k, x] of Object.entries(source)) {
      if (adresse && k === 'desc') continue;
      out[k] = copie(x);
    }
    return out;
  };
  return copie(racine) as T;
}

/**
 * Chemins des nœuds ADRESSÉS dont la prose n'est PAS matérialisée (`descRef` sans `desc` chaîne), à
 * toute profondeur, tableaux compris : la FORME DISQUE d'un document, que seule la lecture servie
 * (`materialiser`, `scripts/source/resoudre.mjs`) complète. Réciproque de `versDisque`. Fonction PURE.
 */
export function proseNonMaterialisee(racine: unknown): (string | number)[][] {
  const out: (string | number)[][] = [];
  const marche = (v: unknown, chemin: (string | number)[]): void => {
    if (Array.isArray(v)) {
      v.forEach((x, i) => marche(x, [...chemin, i]));
      return;
    }
    if (!v || typeof v !== 'object') return;
    const noeud = v as Record<string, unknown>;
    if (noeud.descRef !== undefined && typeof noeud.desc !== 'string') out.push(chemin);
    for (const [k, x] of Object.entries(noeud)) marche(x, [...chemin, k]);
  };
  marche(racine, []);
  return out;
}

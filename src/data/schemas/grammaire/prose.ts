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
import { descRefSchemaDe, sourceRefSchema, type GenreDeFragment } from './valeurs';
import { enfantsDe, type PointDeDonnee } from './descente';
import { estExtrait } from './livres-extraits';
import { PROSE_INLINE_TOLEREE } from './prose-inline';
import { PROSES_NOMMEES, type CheminProseDeScene, type ProseNommee } from './champs-prose-de-scene';
import { nommerChamps, metaDesChamps, type MetaDesChamps } from './meta';

export const META_PROSE = { desc: { label: 'texte' }, descRef: { label: 'adresse du texte' } };
export const META_ADAPTE_DE = { adapteDe: { label: 'adapté de' } };

type DefinitionNommee<C extends CheminProseDeScene> = (typeof PROSES_NOMMEES)[C];
type ChampsNommes<C extends CheminProseDeScene> = {
  [K in DefinitionNommee<C>['champ']]: DefinitionNommee<C>['presence'] extends 'requis' ? z.ZodString : z.ZodOptional<z.ZodString>;
} & { source: z.ZodOptional<typeof sourceRefSchema> } & (
  DefinitionNommee<C>['regime'] extends 'narration' ? ReturnType<typeof champAdapteDe> : object
);
const declarationsNommees = z.registry<{ chemin: CheminProseDeScene }>();

export function declarationProseNommee(noeud: unknown): ProseNommee | undefined {
  if (!(noeud instanceof z.ZodType)) return undefined;
  const declaration = declarationsNommees.get(noeud);
  return declaration ? PROSES_NOMMEES[declaration.chemin] : undefined;
}

export function proseNommee<S extends z.ZodRawShape, C extends CheminProseDeScene>(schema: z.ZodObject<S>, chemin: C) {
  const definition = PROSES_NOMMEES[chemin];
  const texte = definition.presence === 'requis' ? z.string().min(1, `${definition.champ} vide.`) : z.string().optional();
  const champs = {
    [definition.champ]: texte,
    source: sourceRefSchema.optional(),
    ...(definition.regime === 'narration' ? champAdapteDe() : {}),
  } as ChampsNommes<C>;
  const compose = schema.extend(champs);
  const resultat = definition.regime === 'narration' ? compose.superRefine(refineAdapteDe) : compose;
  nommerChamps(resultat, { ...metaDesChamps(schema, { exigees: true }), [definition.champ]: { label: definition.label }, source: { label: 'source' }, ...(definition.regime === 'narration' ? META_ADAPTE_DE : {}) } as MetaDesChamps<typeof resultat.shape>);
  declarationsNommees.add(resultat, { chemin });
  return resultat;
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
    desc: z.string().min(1, 'texte vide.').optional(),
    descRef: descRefSchemaDe(fragmentsAdmis).optional(),
  };
}

/** Les deux PORTEURS d'une prose : écrite dans l'entrée (`desc`), ou adressée au livre (`descRef`). */
export type PorteurDeProse = 'desc' | 'descRef';

/** Ce que le refine doit savoir du site qu'il garde. Le SITE d'une faute se lit à son CHEMIN, que les
 *  rapports rendent en libellés (`cheminLisible`, `../validate.ts`) : le message dit la faute seule. */
export interface ContexteProse {
  /** `type` du document — la clé que le stock de prose inline consulte. */
  readonly type: string;
  /** Ce site exige-t-il une prose (quel qu'en soit le porteur) ? */
  readonly exigeProse: boolean;
  /** Porteurs que ce site ADMET (V5) — défaut : les deux. */
  readonly porteurs?: readonly PorteurDeProse[];
}

/** Forme d'un nœud, du seul point de vue de la prose et de sa provenance. */
interface NoeudProse {
  desc?: unknown;
  descRef?: { book?: unknown };
  source?: { book?: unknown };
}

/**
 * Les cinq verrous de la prose, à poser en `superRefine` PRÉ-sceau sur le nœud qui la porte.
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
 * V4 OBLIGATION — un site qui exige la prose l'exige sous l'un des deux porteurs ; une `desc` VIDE est
 *     déjà la faute du `min(1)` de `champsProse` : une faute par défaut.
 * V5 PORTEUR — un site qui n'admet pas `desc` (`porteurs`) refuse toute prose inline, quel que soit le
 *     livre cité, extrait ou non.
 */
export function refineProse(ctx: ContexteProse): (v: unknown, refine: z.RefinementCtx) => void {
  const { type, exigeProse, porteurs } = ctx;
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
        message: 'texte en double : saisi ici et adressé au livre — garde l’un ou l’autre.',
      });
    }
    if (adresse !== undefined && !estExtrait(livreAdresse)) {
      refine.addIssue({
        code: 'custom',
        path: ['descRef', 'book'],
        message: `passage introuvable : le livre « ${String(livreAdresse)} » n’est pas extrait.`,
      });
    }
    if (adresse !== undefined && livreSource !== undefined && livreSource !== livreAdresse) {
      refine.addIssue({
        code: 'custom',
        path: ['descRef', 'book'],
        message: `la source cite « ${livreSource} », le passage adressé « ${String(livreAdresse)} » : une autre localisation va aux emplacements secondaires.`,
      });
    }
    if (aDesc && estExtrait(livreSource) && !(type in PROSE_INLINE_TOLEREE)) {
      refine.addIssue({
        code: 'custom',
        path: ['desc'],
        message: 'texte recopié d’un livre extrait : adresse le passage au lieu de le recopier.',
      });
    }
    if (aDesc && porteurs !== undefined && !porteurs.includes('desc')) {
      refine.addIssue({
        code: 'custom',
        path: ['desc'],
        message: 'texte saisi refusé : ce document adresse sa prose au livre, jamais inline.',
      });
    }
    if (exigeProse && n.desc === undefined && adresse === undefined) {
      refine.addIssue({
        code: 'custom',
        path: ['desc'],
        message: 'texte obligatoire.',
      });
    }
  };
}

/**
 * Le texte ADAPTÉ d'un passage (#2001) : une prose maison qui en dérive sans en être la copie, avec la
 * référence de ce passage — fiche `user-doctrine-regle-5-campagne-repliques-et-narration-maison`. Ni
 * `maison` de l'enveloppe (la RAISON d'un arbitrage, qui coexiste avec une prose verbatim, V3), ni
 * `source` (le folio dont la prose est la copie).
 */
export function champAdapteDe() {
  return { adapteDe: sourceRefSchema.optional() };
}

/** Forme d'un nœud, du seul point de vue de sa provenance verbatim ou adaptée. */
interface NoeudAdapte {
  adapteDe?: unknown;
  source?: unknown;
  descRef?: unknown;
}

/**
 * EXCLUSIVITÉ de `adapteDe`, à poser en `superRefine` sur le nœud qui le porte : son texte est le
 * verbatim d'un passage — `source` (le folio de la copie), `descRef` (l'adresse du passage) — OU il en
 * est adapté, jamais les deux. Le site se lit au chemin de la faute (`ContexteProse`).
 */
export function refineAdapteDe(v: unknown, refine: z.RefinementCtx): void {
  const n = (v ?? {}) as NoeudAdapte;
  if (n.adapteDe === undefined || (n.source === undefined && n.descRef === undefined)) return;
  refine.addIssue({
    code: 'custom',
    path: ['adapteDe'],
    message: 'texte à la fois copié et adapté d’un passage : garde l’un ou l’autre.',
  });
}

const estObjetSimple = (v: unknown): v is Record<string | number, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v);

/**
 * `source` HÉRITÉE d'un point de donnée : celle du plus proche ANCÊTRE qui en porte une, le point exclu
 * La racine n'est pas héritée ; une déclaration locale coupe la recherche, même sans référence.
 */
export function sourceHeritee(p: PointDeDonnee): Record<string | number, unknown> | undefined {
  if (p.noeuds.some((n) => declarationProseNommee(n) !== undefined)) return undefined;
  for (let a = p.parent; a; a = a.parent) {
    if (a.chemin.length === 0) return undefined;
    if (!estObjetSimple(a.valeur)) continue;
    if (a.valeur.adapteDe !== undefined) return undefined;
    if (estObjetSimple(a.valeur.source)) return a.valeur.source;
    if (a.noeuds.some((n) => enfantsDe(n).some((enfant) => enfant.cle === 'source' || enfant.cle === 'adapteDe'))) return undefined;
  }
  return undefined;
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
 * Chemins des nœuds ADRESSÉS dont la prose n'est PAS matérialisée (`descRef` sans `desc` chaîne non vide), à
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
    if (noeud.descRef !== undefined && (typeof noeud.desc !== 'string' || noeud.desc === '')) out.push(chemin);
    for (const [k, x] of Object.entries(noeud)) marche(x, [...chemin, k]);
  };
  marche(racine, []);
  return out;
}

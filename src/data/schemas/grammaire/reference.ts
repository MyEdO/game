import { nommerChamps, metaDesChamps } from './meta';
/**
 * RÉFÉRENCES de la grammaire de document (#1466 L1a) — les formes ACTUELLES de désignation d'une
 * entité par son id (réf simple, réf de Qualité, dotation, emplacement d'avancement, Trait posé).
 * Les fabriques FERMÉES qui les remplaceront vivent dans `ref.ts` ; leur adoption par les defs et
 * la migration de la donnée se font aux lots L2/L3 (#1463).
 */
import { z } from 'zod';
import { countSpecSchema, formuleSansTirageSchema, maisonSchema, parLocalisationSchema, plageSchema, secondarySourceRefSchema, sourceRefSchema } from './valeurs';
import { marquerProduit } from './interne/produits';
import { idDe, marqueurDeLaForme, porteLeMarqueur, refusDeSpec } from './ref';

/**
 * Trait POSÉ (`TraitPose`, la forme AUTHORÉE) — partagé entre le bestiaire (`creatures.json`
 * `traits`/`optionals`), l'espèce jouable (`species.json` `traits`, #572 : Ogre `{id:'ogre'}`), le statbloc
 * de scène, l'invocation (`summon.addTraits`) et l'octroi (`grantTrait.trait`, régime `octroi`). MÊME forme
 * partout — jamais recopiée. Le jeu n'en lit que l'instance RÉSOLUE (`TraitInstance`, `src/engine/statEntry.ts`),
 * rendue par `resoudreTrait`.
 */
/**
 * Refus de l'`arg` `arg` sur le Trait `id` quand cet `arg` n'est qu'un Indice ou qu'une Portée que la
 * def du Trait DÉCLARE (`marqueurDeLaForme`) — message nommé (id, valeur, champ attendu), sinon `null`.
 * Appelé par le schéma d'instance ci-dessous.
 */
export function refusDArgDeTrait(id: string, arg: string): string | null {
  const forme = marqueurDeLaForme('trait', id, arg);
  return forme ? `Trait « ${id} » : « ${arg} » est ${forme.nature} — il s'écrit en « ${forme.champ} » (nombre), jamais en « arg ».` : null;
}

/** Capacité que la def d'un Trait DÉCLARE pour admettre un champ d'instance : une fourchette fixe un
 *  Indice (`indice`), l'Indice par Localisation a la sienne (`parLocalisation`). */
const CAPACITES_DE_TRAIT = { plage: 'indice', parLocalisation: 'parLocalisation' } as const;
const declareLaCapacite = {
  plage: porteLeMarqueur('trait', CAPACITES_DE_TRAIT.plage),
  parLocalisation: porteLeMarqueur('trait', CAPACITES_DE_TRAIT.parLocalisation),
};

/** La def du Trait `id` admet-elle le champ d'instance `champ` ? Lu par le schéma d'instance ci-dessous,
 *  par la saisie (`parseTraitInstance`) et par l'éditeur. */
export function traitAdmet(id: string, champ: keyof typeof CAPACITES_DE_TRAIT): boolean {
  return declareLaCapacite[champ](id);
}

/** Refus du champ `champ` sur le Trait `id` quand sa def ne déclare pas la capacité qui l'admet — message
 *  nommé, sinon `null`. Appelé par le schéma d'instance ci-dessous. */
export function refusDeCapaciteDeTrait(id: string, champ: keyof typeof CAPACITES_DE_TRAIT): string | null {
  return traitAdmet(id, champ) ? null : `Trait « ${id} » : sa def ne déclare pas « ${CAPACITES_DE_TRAIT[champ]} » — « ${champ} » ne s'y pose pas.`;
}

/** Joker d'un `arg` de Trait d'un statbloc RAW (« Animosité (un au choix) », « Peur (Au choix) ») : il
 *  désigne un choix, jamais une entrée du registre. */
export const ARG_JOKER = /^(un |une |deux )?au choix$/i;

/**
 * Refus de l'`arg` `arg` sur le Trait `id` quand `refusDeSpec` le refuse parce qu'il ne résout aucune entrée
 * d'un registre FERMÉ (`horsCatalogue`) ou parce qu'il reproduit, sur un registre OUVERT (`specsOpen`), le
 * LIBELLÉ d'une de ses entrées (`libelle`) — message nommé, sinon `null`. Un joker n'est jamais refusé.
 * Prédicat UNIQUE, lu par le schéma d'instance ci-dessous et par `src/data/trait-args-derived.test.ts` ; un
 * registre ouvert admet tout autre texte libre. Une instance porte une seule spécialisation.
 */
export function refusDArgHorsRegistre(id: string, arg: string): string | null {
  const spec = arg.trim();
  if (!spec || ARG_JOKER.test(spec)) return null;
  const refus = refusDeSpec('trait', id, spec);
  return refus === 'horsCatalogue' || refus === 'libelle'
    ? `Trait « ${id} » : « ${spec} » ne résout aucune entrée de son registre — un id du registre, jamais un libellé.`
    : null;
}

/** L'id d'un Trait posé : le moteur porte des ids nus (`TraitInstance.id`, `engine/statEntry.ts`). */
const idDeTrait: z.ZodType<string, string> = idDe('trait');

/** Les libellés des champs du Trait posé, aux deux régimes. */
const CHAMPS_DU_TRAIT_POSE = { id: { label: "identifiant" }, value: { label: "valeur" }, arg: { label: "argument" }, count: { label: "nombre" }, range: { label: "portée" }, plage: { label: "fourchette" }, parLocalisation: { label: "par Localisation" }, natural: { label: "naturel" }, hidden: { label: "caché" }, source: { label: "source" }, alsoIn: { label: "autres sources" }, maison: { label: "arbitrage maison" } } as const;

/** Les refus du Trait posé, aux deux régimes : une seule clé de valeur, la capacité de la def, l'`arg`. */
function refusDuTraitPose(t: { id: string; value?: unknown; arg?: string; plage?: { min: number; max: number }; parLocalisation?: unknown }, ctx: z.RefinementCtx): void {
  const valeurs = (['value', 'plage', 'parLocalisation'] as const).filter((k) => t[k] !== undefined);
  if (valeurs.length > 1) ctx.addIssue({ code: 'custom', path: [valeurs[1]], message: `Trait « ${t.id} » : « ${valeurs.join(' » et « ')} » disent tous deux sa valeur — une seule de ces clés.` });
  if (t.parLocalisation && t.arg !== undefined) ctx.addIssue({ code: 'custom', path: ['arg'], message: `Trait « ${t.id} » : un Indice par Localisation nomme ses zones, sans Aspect.` });
  if (t.plage && !(Number.isInteger(t.plage.min) && Number.isInteger(t.plage.max) && t.plage.min >= 0 && t.plage.min < t.plage.max)) ctx.addIssue({ code: 'custom', path: ['plage'], message: `Trait « ${t.id} » : une fourchette d'Indice va d'un entier positif ou nul à un entier plus grand.` });
  for (const champ of ['plage', 'parLocalisation'] as const) {
    const refus = t[champ] === undefined ? null : refusDeCapaciteDeTrait(t.id, champ);
    if (refus) ctx.addIssue({ code: 'custom', path: [champ], message: refus });
  }
  if (t.arg === undefined) return;
  for (const refus of [refusDArgDeTrait(t.id, t.arg), refusDArgHorsRegistre(t.id, t.arg)]) {
    if (refus) ctx.addIssue({ code: 'custom', path: ['arg'], message: refus });
  }
}

/** L'Indice d'un Trait posé au statbloc : un nombre. */
const indiceDePose = z.number();

/**
 * Le Trait posé, régime `pose` : son Indice (`value`) est un nombre. Le régime `octroi` (`traitOctroyeSchema`)
 * en garde les clés et les refus.
 */
export const traitInstanceSchema = marquerProduit(nommerChamps(z.strictObject({
  id: idDeTrait,
  value: indiceDePose.optional(),
  arg: z.string().optional(),
  count: z.number().optional(),
  range: z.number().optional(),
  /** Fourchette imprimée à la place de l'Indice (« Peur 1-2 », ZI 13 l.31), tirée pour son porteur
   *  (`traitsDuPorteur`) ; admise si la def déclare un Indice. */
  plage: plageSchema.optional(),
  /** Indice par Localisation (AA 09 l.184), à la place de l'Indice unique ; admis si la def le déclare. */
  parLocalisation: parLocalisationSchema.optional(),
  natural: z.boolean().optional(),
  hidden: z.boolean().optional(),
  /** PROVENANCE de la valeur posée, quand elle ne vient pas du passage de l'entrée qui la porte : la
   *  `sourceRef` canonique (jugée par `folioLineAlign`), une seconde citation en `alsoIn`, ou la raison
   *  `maison`. Aucune lecture de jeu : `resoudreTrait` ne la transmet pas. */
  source: sourceRefSchema.optional(),
  alsoIn: z.array(secondarySourceRefSchema).optional(),
  maison: maisonSchema.optional(),
}).superRefine(refusDuTraitPose), CHAMPS_DU_TRAIT_POSE), 'traitPose', 'pose', { value: indiceDePose });

/** Le Trait OCTROYÉ (`grantTrait`, `grammaire/mecanique.ts`), régime `octroi` : son Indice est une formule
 *  sans tirage, lue sur le lanceur (LDB 47 l.441). */
export const traitOctroyeSchema = marquerProduit(nommerChamps(z.strictObject({
  ...traitInstanceSchema.shape,
  value: formuleSansTirageSchema.optional(),
}).superRefine(refusDuTraitPose), CHAMPS_DU_TRAIT_POSE), 'traitPose', 'octroi', { value: formuleSansTirageSchema });

/** La forme AUTHORÉE d'un Trait posé, inférée de son schéma. */
export type TraitPose = z.infer<typeof traitInstanceSchema>;
/** La forme AUTHORÉE d'un Trait octroyé, inférée de son schéma. */
export type TraitOctroye = z.infer<typeof traitOctroyeSchema>;

/**
 * `Ref` (`src/data/index.ts`) — réf structurée par id + spec optionnelle (talent/sort/manœuvre/dieu
 * ciblé). Dupliqué à l'identique dans `careerLevels`/`classes`/`creatures`/`gods`/`species`/`traits`.
 */
export const refSchema = nommerChamps(z.strictObject({ id: z.string(), spec: z.string().optional() }), { id: { label: "identifiant" }, spec: { label: "spécialisation" } });

/** `TalentRef` (`src/data/index.ts`) — référence + niveau facultatif (« Maîtrise du combat 2 »).
 *  Porte UNIQUE de la forme `{id, spec?, times?}` : `creatures` et les profils embarqués de scène en
 *  dépendent.
 *  Les trois clés sont ÉCRITES, jamais `...refSchema.shape` : le mesureur de redéclarations lit les
 *  littéraux par AST et ne résout pas un spread — la forme épandue lui présenterait la signature
 *  `times` seule, qu'il attribuerait à ce schéma sur tout littéral à clé `times` unique. */
export const talentRefSchema = nommerChamps(z.strictObject({ id: z.string(), spec: z.string().optional(), times: z.number().optional() }), { id: { label: "identifiant" }, spec: { label: "spécialisation" }, times: { label: "multiplicateur" } });

/** Référence par id portant une MAGNITUDE, et rien d'autre — forme CANONIQUE de la « référence
 *  indicée » du dépôt (`scripts/guards/lib/structuresStock.mjs`, signature `id,value` : Traits de
 *  créature, Atouts de `trappings.json`, Améliorations de navire). UNE graphie pour ce concept : les
 *  schémas qui l'expriment la RÉFÉRENCENT, ils ne la re-tapent pas (volet `redeclaration` de
 *  `src/data/grammaire-guard.test.ts`). Elle ne dérive PAS de `refSchema` : ce qu'une magnitude qualifie
 *  n'est pas une SPÉCIALISATION. */
export const refIndiceSchema = nommerChamps(z.strictObject({ id: z.string(), value: z.number().optional() }), { id: { label: "identifiant" }, value: { label: "valeur" } });

/** `QualityRef` (`src/data/index.ts`) — id + Indice éventuel (« Solide 3 », « Taillade (1A) » →
 *  `value`). Vue COMMUNE du joker de qualité d'une dotation (`TrappingRef.qualities`, #657 Lot 1) ET du
 *  catalogue `trappings.json` lui-même, qui l'importe (#1463 L-gram-2). C'est la référence INDICÉE
 *  ci-dessus : ce que le livre imprime entre parenthèses (`AA 08 l.87` « Taillade (XA) ») est une
 *  MAGNITUDE, portée par `value` et déclarée par la qualité (`QualityData.indice`) ; `spec` y était une
 *  seconde graphie de la même chose, que rien ne lisait — elle est désormais REFUSÉE au parse. */
export const qualityRefSchema = refIndiceSchema;


/** `TrappingRef` (`src/data/index.ts`) — par id de catalogue (+ quantité, + Atouts ATTACHÉS `qualities`
 *  ou joker « Atout au choix » `qualityChoice` — « X de qualité » LDB 60 Fabrication, #657 Lot 1),
 *  texte narratif hors catalogue (+ quantité), dotation VÉHICULE (`vehicleId`, foyer `vehicles.json` —
 *  grant de POSSESSION, matérialisé en T1), dotation BÊTE (`creatureId`, foyer `creatures.json` — SOCLE
 *  POSSESSIONS #615/#617 §9), choix « A ou B » (`choice`, RÉCURSIF, EN MIROIR d'`advancementRefSchema`),
 *  ou joker (`wildcard`). Dupliqué dans `careerLevels`/`classes`/`creatures`. */
type CountSpecInfer = z.infer<typeof countSpecSchema>;
type QualityRefInfer = z.infer<typeof qualityRefSchema>;
export const trappingRefSchema: z.ZodType<
  | { id: string; spec?: string; count?: CountSpecInfer; qualities?: QualityRefInfer[]; qualityChoice?: true }
  | { text: string; count?: CountSpecInfer }
  | { vehicleId: string; count?: CountSpecInfer; label?: string }
  | { creatureId: string; count?: CountSpecInfer; label?: string }
  | { choice: unknown[] }
  | { wildcard: string }
> = z.union([
  nommerChamps(refSchema.extend({
    count: countSpecSchema.optional(),
    qualities: z.array(qualityRefSchema).optional(),
    qualityChoice: z.literal(true).optional(),
  }), { ...metaDesChamps(refSchema, { exigees: true }), count: { label: 'nombre' }, qualities: { label: 'qualités' }, qualityChoice: { label: 'qualité au choix' } }),
  nommerChamps(z.strictObject({ text: z.string(), count: countSpecSchema.optional() }), { text: { label: "texte" }, count: { label: "nombre" } }),
  nommerChamps(z.strictObject({ vehicleId: z.string(), count: countSpecSchema.optional(), label: z.string().optional() }), { vehicleId: { label: "véhicule" }, count: { label: "nombre" }, label: { label: "libellé" } }),
  nommerChamps(z.strictObject({ creatureId: z.string(), count: countSpecSchema.optional(), label: z.string().optional() }), { creatureId: { label: "créature" }, count: { label: "nombre" }, label: { label: "libellé" } }),
  nommerChamps(z.strictObject({ choice: z.array(z.lazy(() => trappingRefSchema)) }), { choice: { label: "choix" } }),
  nommerChamps(z.strictObject({ wildcard: z.string() }), { wildcard: { label: "choix libre" } }),
]);


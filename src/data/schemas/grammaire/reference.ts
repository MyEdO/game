import { libelleDeValeur, nommerChamps } from './meta';
/**
 * RÉFÉRENCES de la grammaire de document (#1466 L1a) — les formes ACTUELLES de désignation d'une
 * entité par son id (réf simple, réf de Qualité, dotation, emplacement d'avancement, Trait posé).
 * Les fabriques FERMÉES qui les remplaceront vivent dans `ref.ts` ; leur adoption par les defs et
 * la migration de la donnée se font aux lots L2/L3 (#1463).
 */
import { z } from 'zod';
import { countSpecSchema, difficultySchema, formuleSansTirageSchema, maisonSchema, parLocalisationSchema, plageSchema, secondarySourceRefSchema, sourceRefSchema, varianteDeCibleSchema } from './valeurs';
import { marquerProduit } from './interne/produits';
import { idDe, idsDe, marqueurDeLaForme, messageDeRefusDeSpec, porteLeMarqueur, refMorte, refusDeSpec } from './ref';
import { findTraitById, psychologyLabel } from '../../index';
import { cibleDeLArg, individusNommes, varianteAdmise, varianteDe } from '../../../engine/psych/ciblage';

/**
 * Trait POSÉ (`TraitPose`, la forme AUTHORÉE) — partagé entre le bestiaire (`creatures.json`
 * `traits`/`optionals`), l'espèce jouable (`species.json` `traits`, #572 : Ogre `{id:'ogre'}`), le statbloc
 * de scène, l'invocation (`summon.addTraits`), l'octroi (`grantTrait.trait`) et le Trait CONFÉRÉ par une attaque
 * (`confere`). MÊME forme
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
 *  Indice (`indice`), l'Indice par Localisation a la sienne (`parLocalisation`), un Trait d'attaque confère
 *  des Traits à ses touches (`attaque`), la Difficulté de l'État qu'un Trait inflige a la sienne (`difficulte`). */
const CAPACITES_DE_TRAIT = { plage: 'indice', parLocalisation: 'parLocalisation', confere: 'attaque', difficulte: 'difficulte' } as const;
const declareLaCapacite = {
  plage: porteLeMarqueur('trait', CAPACITES_DE_TRAIT.plage),
  parLocalisation: porteLeMarqueur('trait', CAPACITES_DE_TRAIT.parLocalisation),
  confere: porteLeMarqueur('trait', CAPACITES_DE_TRAIT.confere),
  difficulte: porteLeMarqueur('trait', CAPACITES_DE_TRAIT.difficulte),
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

/** Ce que la Cible d'un Trait psy peut désigner selon le document qui la pose : le catalogue n'a que des
 *  Groupes, une scène a aussi ses personnages. #3045 */
type RegimeDeCible = 'catalogue' | 'scene';

/** Refus de toute Cible d'individu (`individusNommes`) de `valeur`, dans un `document` sans personnages de scène.
 *  EDOC 11 l.648 ; #3045 */
export function refuserLesIndividus(valeur: unknown, ctx: z.RefinementCtx, document: string): void {
  for (const id of new Set(individusNommes(valeur)))
    ctx.addIssue({ code: 'custom', message: `Cible psy « ${id} » : ${document} n'a pas de personnages de scène, sa Cible est un Groupe.` });
}

/** L'`arg` du Trait `id` désigne-t-il un individu (`@id`) à la place d'une Cible psy (`specsSource: ciblesPsy`) ? */
function argDIndividu(id: string, arg: string): boolean {
  const cible = cibleDeLArg(id, arg);
  return cible !== undefined && varianteDe(cible) === 'individu';
}

/** Refus de l'`arg` du Trait psy `id` dont le type (`capabilities.psychType`) n'admet pas la variante de Cible
 *  (`psychology.json`, `cibles`) — message nommé, sinon `null`. */
function refusDeVarianteDeCible(id: string, arg: string): string | null {
  const type = findTraitById(id)?.capabilities?.psychType;
  const cible = cibleDeLArg(id, arg);
  if (!type || cible === undefined || varianteAdmise(type, varianteDe(cible))) return null;
  return `Trait « ${id} » : ${psychologyLabel(type)} ne vise pas ${libelleDeValeur(varianteDeCibleSchema, varianteDe(cible))} (« ${arg} »).`;
}

/** L'id d'un Trait posé : le moteur porte des ids nus (`TraitInstance.id`, `engine/statEntry.ts`). */
const idDeTrait: z.ZodType<string, string> = idDe('trait');

/** Les libellés des champs du Trait posé. */
const CHAMPS_DU_TRAIT_POSE = { id: { label: "identifiant" }, value: { label: "valeur" }, arg: { label: "argument" }, count: { label: "nombre" }, range: { label: "portée" }, plage: { label: "fourchette" }, parLocalisation: { label: "par Localisation" }, difficulte: { label: "Difficulté" }, confere: { label: "Traits conférés" }, natural: { label: "naturel" }, hidden: { label: "caché" }, source: { label: "source" }, alsoIn: { label: "autres sources" }, maison: { label: "arbitrage maison" } } as const;

/** Les refus du Trait posé : une seule clé de valeur, la capacité de la def, l'`arg` (un individu, hors du
 *  registre, n'est admis que dans une scène, `regime`). EDOC 11 l.648 ; #3045 */
function refusDuTraitPose(t: { id: string; value?: unknown; arg?: string; plage?: { min: number; max: number }; parLocalisation?: unknown; confere?: unknown; difficulte?: unknown }, ctx: z.RefinementCtx, regime: RegimeDeCible): void {
  const valeurs = (['value', 'plage', 'parLocalisation'] as const).filter((k) => t[k] !== undefined);
  if (valeurs.length > 1) ctx.addIssue({ code: 'custom', path: [valeurs[1]], message: `Trait « ${t.id} » : « ${valeurs.join(' » et « ')} » disent tous deux sa valeur — une seule de ces clés.` });
  if (t.parLocalisation && t.arg !== undefined) ctx.addIssue({ code: 'custom', path: ['arg'], message: `Trait « ${t.id} » : un Indice par Localisation nomme ses zones, sans Aspect.` });
  if (t.plage && !(Number.isInteger(t.plage.min) && Number.isInteger(t.plage.max) && t.plage.min >= 0 && t.plage.min < t.plage.max)) ctx.addIssue({ code: 'custom', path: ['plage'], message: `Trait « ${t.id} » : une fourchette d'Indice va d'un entier positif ou nul à un entier plus grand.` });
  for (const champ of ['plage', 'parLocalisation', 'confere', 'difficulte'] as const) {
    const refus = t[champ] === undefined ? null : refusDeCapaciteDeTrait(t.id, champ);
    if (refus) ctx.addIssue({ code: 'custom', path: [champ], message: refus });
  }
  if (t.arg === undefined) return;
  const refusDIndividu = regime === 'scene' ? null : `Trait « ${t.id} » : « ${t.arg} » désigne une personne de la scène ; hors d'une scène, sa Cible est un Groupe.`;
  const refusDeRegistre = argDIndividu(t.id, t.arg) ? refusDIndividu : refusDArgHorsRegistre(t.id, t.arg);
  for (const refus of [refusDArgDeTrait(t.id, t.arg), refusDeRegistre, refusDeVarianteDeCible(t.id, t.arg)]) {
    if (refus) ctx.addIssue({ code: 'custom', path: ['arg'], message: refus });
  }
}

/** Les champs du Trait posé hors de la liste de ses Traits conférés. */
const champsDuTraitPose = {
  id: idDeTrait,
  value: formuleSansTirageSchema.optional(),
  arg: z.string().optional(),
  count: z.number().optional(),
  range: z.number().optional(),
  /** Fourchette imprimée à la place de l'Indice (« Peur 1-2 », ZI 13 l.31), tirée pour son porteur
   *  (`traitsDuPorteur`) ; admise si la def déclare un Indice. */
  plage: plageSchema.optional(),
  /** Indice par Localisation (AA 09 l.184), à la place de l'Indice unique ; admis si la def le déclare. */
  parLocalisation: parLocalisationSchema.optional(),
  /** Difficulté des Tests qui éliminent l'État que le Trait inflige (MDG 16 l.226 ; LDB 16 l.70) ; admise
   *  si la def la déclare. */
  difficulte: difficultySchema.optional(),
  natural: z.boolean().optional(),
  hidden: z.boolean().optional(),
  /** PROVENANCE de la valeur posée, quand elle ne vient pas du passage de l'entrée qui la porte : la
   *  `sourceRef` canonique (jugée par `folioLineAlign`), une seconde citation en `alsoIn`, ou la raison
   *  `maison`. Aucune lecture de jeu : `resoudreTrait` ne la transmet pas. */
  source: sourceRefSchema.optional(),
  alsoIn: z.array(secondarySourceRefSchema).optional(),
  maison: maisonSchema.optional(),
};

/** La forme AUTHORÉE d'un Trait posé : ses champs, inférés de leur schéma, et les Traits qu'il confère, de
 *  la même forme. */
export type TraitPose = z.infer<z.ZodObject<typeof champsDuTraitPose>> & { confere?: TraitPose[] };

/**
 * Le Trait posé. Son Indice (`value`) est une formule sans tirage, lue sur le profil du porteur au statbloc
 * (« Arme (BF +4) », Middenheim 04 l.29) ou sur le lanceur à l'octroi (LDB 47 l.441).
 */
const poseDeTrait = (regime: RegimeDeCible): z.ZodType<TraitPose> => {
  const pose: z.ZodType<TraitPose> = marquerProduit(nommerChamps(z.strictObject({
    ...champsDuTraitPose,
    /** Traits conférés aux touches de ce Trait d'attaque (ZI 03 l.75, l.77 ; ZI 06 l.32) ; admis si la def
     *  déclare `attaque`. */
    confere: z.array(z.lazy(() => pose)).optional(),
  }).superRefine((t, ctx) => refusDuTraitPose(t, ctx, regime)), CHAMPS_DU_TRAIT_POSE), 'traitPose', 'pose', { value: formuleSansTirageSchema });
  return pose;
};

/** Le Trait posé d'un document du CATALOGUE : la Cible d'un Trait psy y est un Groupe. */
export const traitInstanceSchema = poseDeTrait('catalogue');

/** Le Trait posé du statbloc d'une SCÈNE : la Cible d'un Trait psy y est aussi un individu (`@id`, EDOC 11
 *  l.648), dont `validateScene` juge l'existence. #3045 */
export const traitPoseDeSceneSchema = poseDeTrait('scene');

/** `TalentRef` (`src/data/index.ts`) — référence + niveau facultatif (« Maîtrise du combat 2 »).
 *  Porte UNIQUE de la forme `{id, spec?, times?}` : `creatures`, le statbloc de scène et le profil de
 *  PNJ embarqué en dépendent. Sa spécialisation est jugée par `refusDeSpec` ; la sentinelle y passe
 *  (pas de régime `choix`, #1463 L3), et un Talent sans catalogue porte un texte d'instance (#1621).
 *  Les trois clés sont ÉCRITES, jamais épandues d'un autre schéma : le mesureur de redéclarations lit
 *  les littéraux par AST et ne résout pas un spread — la forme épandue lui présenterait la signature
 *  `times` seule, qu'il attribuerait à ce schéma sur tout littéral à clé `times` unique. */
export const talentRefSchema = nommerChamps(z.strictObject({ id: z.string(), spec: z.string().optional(), times: z.number().optional() }).superRefine((r, ctx) => {
  if (r.spec === undefined) return;
  if (!idsDe('talent').has(r.id)) {
    ctx.addIssue({ code: 'custom', path: ['id'], message: refMorte('talent', r.id) });
    return;
  }
  const refus = refusDeSpec('talent', r.id, r.spec);
  if (refus === null || refus === 'sentinelle' || refus === 'nonSpecialisable') return;
  ctx.addIssue({ code: 'custom', path: ['spec'], message: messageDeRefusDeSpec('talent', r.id, r.spec, refus, false) });
}), { id: { label: "identifiant" }, spec: { label: "spécialisation" }, times: { label: "multiplicateur" } });

/** Référence par id portant une MAGNITUDE, et rien d'autre — forme CANONIQUE de la « référence
 *  indicée » du dépôt (`scripts/guards/lib/structuresStock.mjs`, signature `id,value` : Traits de
 *  créature, Atouts de `trappings.json`, Améliorations de navire). UNE graphie pour ce concept : les
 *  schémas qui l'expriment la RÉFÉRENCENT, ils ne la re-tapent pas (volet `redeclaration` de
 *  `src/data/grammaire-guard.test.ts`). Elle ne porte PAS de `spec` : ce qu'une magnitude qualifie
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
 *  ou joker (`wildcard`). Dupliqué dans `careerLevels`/`classes`/`creatures`. Sa `spec` est la PRÉCISION
 *  d'un objet, nommée comme telle : `trappings.json` ne déclare aucun catalogue de Spécialisations. */
type CountSpecInfer = z.infer<typeof countSpecSchema>;
type QualityRefInfer = z.infer<typeof qualityRefSchema>;
/** Dotation d'un objet du catalogue : sa `spec` est la précision de la dotation, pas une Spécialisation. */
export const dotationDeCatalogueSchema = nommerChamps(z.strictObject({
  id: z.string(),
  spec: z.string().optional(),
  count: countSpecSchema.optional(),
  qualities: z.array(qualityRefSchema).optional(),
  qualityChoice: z.literal(true).optional(),
}), { id: { label: 'identifiant' }, spec: { label: 'précision' }, count: { label: 'nombre' }, qualities: { label: 'qualités' }, qualityChoice: { label: 'qualité au choix' } });

export const trappingRefSchema: z.ZodType<
  | { id: string; spec?: string; count?: CountSpecInfer; qualities?: QualityRefInfer[]; qualityChoice?: true }
  | { text: string; count?: CountSpecInfer }
  | { vehicleId: string; count?: CountSpecInfer; label?: string }
  | { creatureId: string; count?: CountSpecInfer; label?: string }
  | { choice: unknown[] }
  | { wildcard: string }
> = z.union([
  dotationDeCatalogueSchema,
  nommerChamps(z.strictObject({ text: z.string(), count: countSpecSchema.optional() }), { text: { label: "texte" }, count: { label: "nombre" } }),
  nommerChamps(z.strictObject({ vehicleId: z.string(), count: countSpecSchema.optional(), label: z.string().optional() }), { vehicleId: { label: "véhicule" }, count: { label: "nombre" }, label: { label: "libellé" } }),
  nommerChamps(z.strictObject({ creatureId: z.string(), count: countSpecSchema.optional(), label: z.string().optional() }), { creatureId: { label: "créature" }, count: { label: "nombre" }, label: { label: "libellé" } }),
  nommerChamps(z.strictObject({ choice: z.array(z.lazy(() => trappingRefSchema)) }), { choice: { label: "choix" } }),
  nommerChamps(z.strictObject({ wildcard: z.string() }), { wildcard: { label: "choix libre" } }),
]);


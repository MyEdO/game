import { libelleDeValeur, metaDesChamps, nommerChamps, nommerNoeud } from './meta';
/**
 * RÉFÉRENCES de la grammaire de document (#1466 L1a) — les formes ACTUELLES de désignation d'une
 * entité par son id (réf simple, réf de Qualité, dotation, emplacement d'avancement, Trait posé).
 * Les fabriques FERMÉES qui les remplaceront vivent dans `ref.ts` ; leur adoption par les defs et
 * la migration de la donnée se font aux lots L2/L3 (#1463).
 */
import { z } from 'zod';
import {
  caracteristiqueChiffreeSchema,
  countSpecSchema,
  monnaieSchema,
  natureDeMentionSchema,
  difficultySchema,
  enumNomme,
  formuleSansTirageSchema,
  maisonSchema,
  matiereDArmureSchema,
  parLocalisationSchema,
  plageSchema,
  secondarySourceRefSchema,
  sizeCategorySchema,
  sourceRefSchema,
  varianteDeCibleSchema,
} from './valeurs';
import { marquerProduit } from './interne/produits';
import {
  idDe,
  marqueurDeLaForme,
  messageDeFormes,
  messageDeRefusDeSpec,
  parmi,
  porteLeMarqueur,
  recordDIds,
  ref,
  refOuSpec,
  refs,
  refTypee,
  refusDeSpec,
  type Parmi,
} from './ref';
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
 *  Indice (`indice`), l'Indice par Localisation et la matière de l'armure ont la leur (`parLocalisation`), un
 *  Trait d'attaque confère des Traits à ses touches (`attaque`), la Difficulté de l'État qu'un Trait inflige a
 *  la sienne (`difficulte`). */
const CAPACITES_DE_TRAIT = { plage: 'indice', parLocalisation: 'parLocalisation', matiere: 'parLocalisation', confere: 'attaque', difficulte: 'difficulte' } as const;
const declareLaCapacite = {
  plage: porteLeMarqueur('trait', CAPACITES_DE_TRAIT.plage),
  parLocalisation: porteLeMarqueur('trait', CAPACITES_DE_TRAIT.parLocalisation),
  matiere: porteLeMarqueur('trait', CAPACITES_DE_TRAIT.matiere),
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
 * Prédicat UNIQUE, lu par le schéma d'instance ci-dessous ; un registre ouvert admet tout autre texte
 * libre. Une instance porte une seule spécialisation.
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
const CHAMPS_DU_TRAIT_POSE = { id: { label: "identifiant" }, value: { label: "valeur" }, arg: { label: "argument" }, count: { label: "nombre" }, range: { label: "portée" }, plage: { label: "fourchette" }, parLocalisation: { label: "par Localisation" }, matiere: { label: "matière" }, difficulte: { label: "Difficulté" }, confere: { label: "Traits conférés" }, natural: { label: "naturel" }, hidden: { label: "caché" }, source: { label: "source" }, alsoIn: { label: "autres sources" }, maison: { label: "arbitrage maison" } } as const;

/** Les refus du Trait posé : une seule clé de valeur, la capacité de la def, l'`arg` (un individu, hors du
 *  registre, n'est admis que dans une scène, `regime`). EDOC 11 l.648 ; #3045 */
function refusDuTraitPose(t: { id: string; value?: unknown; arg?: string; plage?: { min: number; max: number }; parLocalisation?: unknown; matiere?: unknown; confere?: unknown; difficulte?: unknown }, ctx: z.RefinementCtx, regime: RegimeDeCible): void {
  const valeurs = (['value', 'plage', 'parLocalisation'] as const).filter((k) => t[k] !== undefined);
  if (valeurs.length > 1) ctx.addIssue({ code: 'custom', path: [valeurs[1]], message: `Trait « ${t.id} » : « ${valeurs.join(' » et « ')} » disent tous deux sa valeur — une seule de ces clés.` });
  if (t.parLocalisation && t.arg !== undefined) ctx.addIssue({ code: 'custom', path: ['arg'], message: `Trait « ${t.id} » : un Indice par Localisation nomme ses zones, sans Aspect.` });
  if (t.plage && !(Number.isInteger(t.plage.min) && Number.isInteger(t.plage.max) && t.plage.min >= 0 && t.plage.min < t.plage.max)) ctx.addIssue({ code: 'custom', path: ['plage'], message: `Trait « ${t.id} » : une fourchette d'Indice va d'un entier positif ou nul à un entier plus grand.` });
  for (const champ of ['plage', 'parLocalisation', 'matiere', 'confere', 'difficulte'] as const) {
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
  /** Matière de l'armure, à toutes ses Localisations ; admise si la def déclare l'Indice par Localisation.
   *  LDB 62 l.270 ; LDB 63 l.97 ; LDB 85 l.39 ; #1463 */
  matiere: matiereDArmureSchema.optional(),
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
export const traitInstanceSchema = nommerNoeud(poseDeTrait('catalogue'), { label: 'Trait' });

/** Un octroi d'une note « swap » (`SwapGrant`, `engine/statEntry.ts`) : un bonus sur une Caractéristique, ou une
 *  Compétence à la valeur de Test imprimée. */
const swapGrantSchema = z.union([
  caracteristiqueChiffreeSchema,
  refOuSpec('skill', { value: nommerNoeud(z.number(), { nom: 'valeur' }) }),
]);

/** `OptionalSwap` (`engine/statEntry.ts`) — la note « swap » d'un statbloc (Grand Loup ZI 1 l.229, Griffon ZI) : son
 *  `label` source VERBATIM et ses champs d'application. Composée par les `optionals` du Bestiaire (`defs/creatures.ts`)
 *  et par ceux d'une entité de scène (`defs-scenes/scene.ts`). */
export const optionalSwapSchema = nommerNoeud(nommerChamps(z.strictObject({
  note: z.literal('swap'),
  label: z.string(),
  remove: z.array(idDe('trait', undefined, { nue: true })),
  /** Un ou plusieurs octrois (Vouivre ZI : 4 — 3 caractéristiques + 1 compétence). */
  grant: z.array(swapGrantSchema),
  size: sizeCategorySchema.optional(),
  wounds: z.number().optional(),
}), { note: { label: "note" }, label: { label: "libellé" }, remove: { label: "retirer" }, grant: { label: "ajouts" }, size: { label: "Taille" }, wounds: { label: "Blessures" } }), { label: 'remplacement de Traits' });

/** Le Trait posé du statbloc d'une SCÈNE : la Cible d'un Trait psy y est aussi un individu (`@id`, EDOC 11
 *  l.648), dont `validateScene` juge l'existence. #3045 */
export const traitPoseDeSceneSchema = poseDeTrait('scene');

/** `TalentRef` (`src/data/index.ts`) — référence au catalogue (`idDe`) + niveau facultatif (« Maîtrise du combat 2 »).
 *  Porte UNIQUE de la forme `{id, spec?, times?}` : `creatures`, le statbloc de scène et le profil de
 *  PNJ embarqué en dépendent. Sa spécialisation est jugée par `refusDeSpec` ; la sentinelle y passe
 *  (pas de régime `choix`, #1463 L3), et un Talent sans catalogue porte un texte d'instance (#1621).
 *  Les trois clés sont ÉCRITES, jamais épandues d'un autre schéma : le mesureur de redéclarations lit
 *  les littéraux par AST et ne résout pas un spread — la forme épandue lui présenterait la signature
 *  `times` seule, qu'il attribuerait à ce schéma sur tout littéral à clé `times` unique. */
export const talentRefSchema = nommerChamps(z.strictObject({ id: idDe('talent', undefined, { nue: true }), spec: z.string().optional(), times: z.number().optional() }).superRefine((r, ctx) => {
  if (r.spec === undefined) return;
  const refus = refusDeSpec('talent', r.id, r.spec);
  if (refus === null || refus === 'sentinelle' || refus === 'nonSpecialisable') return;
  ctx.addIssue({ code: 'custom', path: ['spec'], message: messageDeRefusDeSpec('talent', r.id, r.spec, refus, false) });
}), { id: { label: "identifiant" }, spec: { label: "spécialisation" }, times: { label: "multiplicateur" } });

/** Référence par id de `type` portant une MAGNITUDE, et rien d'autre — forme CANONIQUE de la « référence
 *  indicée » du dépôt (`scripts/guards/lib/structuresStock.mjs`, signature `id,value`). Elle ne porte PAS
 *  de `spec` : ce qu'une magnitude qualifie n'est pas une SPÉCIALISATION. */
const refIndicee = <T extends 'quality' | 'navalTrait'>(type: T) => ref(type, { value: nommerNoeud(z.number().optional(), { nom: 'valeur' }) });

/** `NavalTraitRef` (`src/data/index.ts`) — Trait ou Amélioration de navire (MDG 12), + Indice éventuel. Son
 *  foyer est `naval-traits.json`, jamais `traits.json` : `traitInstanceSchema` ouvrirait les Traits de
 *  créature aux navires. */
export const navalTraitRefSchema = refIndicee('navalTrait');

/** `QualityRef` — id + Indice éventuel (« Solide 3 », « Taillade (1A) » → `value`). Vue COMMUNE du joker de
 *  qualité d'une dotation (`TrappingRef.qualities`, #657 Lot 1) ET du catalogue `trappings.json` lui-même, qui
 *  l'importe (#1463 L-gram-2). C'est la référence INDICÉE ci-dessus : ce que le livre imprime entre parenthèses
 *  (`AA 08 l.87` « Taillade (XA) ») est une MAGNITUDE, portée par `value` et déclarée par la qualité
 *  (`QualityData.indice`) ; aucune `spec`. */
export const qualityRefSchema = refIndicee('quality');
export type QualityRef = z.infer<typeof qualityRefSchema>;

/** `ManiementAlternatif` (`src/data/index.ts`), keyé par les Groupes de Corps à corps qui manient aussi
 *  l'arme : `TrappingData.manieAussi`, `GroupeDArme.manieAussi`. AA 08 l.188 ; AA 08 l.194 ; AA 08 l.343 */
export const manieAussiSchema = recordDIds('weaponGroup', nommerChamps(z.strictObject({
  qualites: z.array(qualityRefSchema).optional(),
  retire: refs('quality').optional(),
  aPied: z.literal(true).optional(),
  mains: z.literal(1).optional(),
}), {
  qualites: { label: 'Atouts et Défauts', hint: 'Remplacent ceux de même id de l’arme' },
  retire: { label: 'Atouts et Défauts ôtés', hint: 'Ôtés de l’arme et de son Groupe' },
  aPied: { label: 'À pied seulement', hint: 'Ouvert seulement quand le porteur n’est pas monté' },
  mains: { label: 'Tenue à une main', hint: 'L’arme y est tenue à une main' },
}), 'melee');


/** `TrappingRef` (`src/data/index.ts`) — par id de catalogue (+ quantité, + Atouts ATTACHÉS `qualities`
 *  ou joker « Atout au choix » `qualityChoice` — « X de qualité » LDB 60 Fabrication, #657 Lot 1),
 *  texte narratif hors catalogue (+ quantité), dotation de POSSESSION (`dotationDePossessionSchema`,
 *  véhicule ou bête — SOCLE POSSESSIONS #615/#617 §9), somme d'argent (`sommeSchema`), mention par nature
 *  (`dotationDeMentionSchema`), « 1 parmi » (`pick`, `{ pick: 1, of }`, RÉCURSIF, EN MIROIR d'`advancementRefSchema`,
 *  dont une option peut aussi être un lot `{ lot }`), ou joker d'arme (`wildcard`, + `groupe`, + `qualityChoice`). Composé
 *  par `careerLevels`/`creatures` ; `classes` compose `dotationSansTexteSchema`, sans texte, mention, joker ni lot. Sa `spec` est la PRÉCISION d'un objet, nommée comme telle : `trappings.json` ne
 *  déclare aucun catalogue de Spécialisations. */
/** Une somme : `count` pièces de `monnaie` (`Somme`, tirée par `sommeTiree`, `engine/possessionGrants.ts`). Dotation
 *  d'argent, valeur d'un objet doté, Richesse de départ d'un prétiré. LDB 57 */
export const sommeSchema = nommerNoeud(nommerChamps(z.strictObject({ monnaie: monnaieSchema, count: countSpecSchema }), { monnaie: { label: 'monnaie' }, count: { label: 'nombre de pièces' } }), { label: 'somme d’argent' });
export type Somme = z.infer<typeof sommeSchema>;

/** Objet du catalogue doté tel quel, sans emplacement : sa `spec` est la précision de la dotation, pas une
 *  Spécialisation. Membre d'un lot (`lotDeDotationSchema`). */
export const objetDeCatalogueSchema = nommerNoeud(nommerChamps(z.strictObject({
  id: idDe('trapping'),
  spec: z.string().optional(),
  count: countSpecSchema.optional(),
  qualities: z.array(qualityRefSchema).optional(),
  valeur: sommeSchema.optional(),
}), { id: { label: 'identifiant' }, spec: { label: 'précision' }, count: { label: 'nombre' }, qualities: { label: 'qualités' }, valeur: { label: 'valeur' } }), { label: 'objet du catalogue' });

/** Dotation d'un objet du catalogue : l'objet, et son emplacement « Atout au choix » (`qualityChoice`). LDB 60 */
export const dotationDeCatalogueSchema = nommerNoeud(nommerChamps(z.strictObject({ ...objetDeCatalogueSchema.shape, qualityChoice: z.literal(true).optional() }), { ...metaDesChamps(objetDeCatalogueSchema, { exigees: true }), qualityChoice: { label: 'qualité au choix' } }), { label: 'objet du catalogue' });

/** Dotation d'une MENTION : un bien imprimé que la fiche porte sous sa nature, sans mécanique. #4053 */
export const dotationDeMentionSchema = nommerNoeud(nommerChamps(z.strictObject({
  label: z.string().min(1),
  nature: natureDeMentionSchema,
  count: countSpecSchema.optional(),
}), { label: { label: 'libellé' }, nature: { label: 'nature' }, count: { label: 'nombre' } }), { label: 'mention' });
export type DotationDeMention = z.infer<typeof dotationDeMentionSchema>;

/** Dotation d'une ligne hors catalogue : son texte imprimé et sa quantité. */
export const dotationDeTexteSchema = nommerNoeud(nommerChamps(z.strictObject({ text: z.string(), count: countSpecSchema.optional() }), { text: { label: "texte" }, count: { label: "nombre" } }), { label: 'ligne de texte' });

/** Ce qu'une dotation POSSÈDE hors du sac : une bête du bestiaire ou un véhicule (SOCLE POSSESSIONS #615). */
export const typeDePossessionSchema = enumNomme({ creature: 'Créature', vehicle: 'Véhicule' });
/** Dotation d'une POSSESSION : la référence typée, sa quantité et son libellé imprimé. */
export const dotationDePossessionSchema = nommerNoeud(refTypee(typeDePossessionSchema, {}, {
  count: nommerNoeud(countSpecSchema.optional(), { nom: 'nombre' }),
  label: nommerNoeud(z.string().optional(), { nom: 'libellé' }),
}), { label: 'possession' });
export type DotationDePossession = z.infer<typeof dotationDePossessionSchema>;
export type ObjetDeCatalogue = z.infer<typeof objetDeCatalogueSchema>;
type FormeSansTexte =
  | (ObjetDeCatalogue & { qualityChoice?: true })
  | DotationDePossession
  | Somme;
type LotDeDotation = { lot: (ObjetDeCatalogue | DotationDePossession)[] };
type DotationSansTexte = FormeSansTexte | Parmi<1, FormeSansTexte>;
type DotationDeTexte = z.infer<typeof dotationDeTexteSchema>;
type FormeDeDotation = FormeSansTexte | JokerDeDotation | DotationDeTexte | DotationDeMention;

/** Une arme au choix, de tout le catalogue ou du seul Groupe d'armes `groupe` ; `qualityChoice`, l'emplacement de son
 *  Atout au choix. LDB 62 ; LDB 60 */
const jokerDeDotationSchema = nommerNoeud(nommerChamps(z.strictObject({
  wildcard: z.literal('arme'),
  groupe: ref('weaponGroup', undefined, 'weapon').optional(),
  qualityChoice: z.literal(true).optional(),
}), { wildcard: { label: "choix libre" }, groupe: { label: "Groupe d’armes" }, qualityChoice: { label: 'qualité au choix' } }), { label: 'arme au choix' });
type JokerDeDotation = z.infer<typeof jokerDeDotationSchema>;

/** Plusieurs objets ou possessions dotés ENSEMBLE, option d'un « 1 parmi » : ni emplacement, ni somme, ni mention, ni texte. */
const lotDeDotationSchema = nommerNoeud(nommerChamps(z.strictObject({
  lot: z.array(z.union([objetDeCatalogueSchema, dotationDePossessionSchema], { error: messageDeFormes })).min(2),
}), { lot: { label: 'lot' } }), { label: 'lot' });

/** Les `formes` d'une dotation, et le « 1 parmi » de ces formes et des options `enPlusDansOf` (`parmi`). */
function formesDeDotation<F, O = never>(formes: readonly z.ZodType<F>[], enPlusDansOf: readonly z.ZodType<O>[] = []): z.ZodType<F | Parmi<1, F | O>> {
  return z.union([nommerNoeud(parmi<F | O, 1>([...formes, ...enPlusDansOf], z.literal(1)), { label: 'une parmi' }), ...formes], { error: messageDeFormes });
}

/** Dotation sans texte, mention, joker ni lot : `classes.json`. LDB 05 l.552 ; #4053 */
export const dotationSansTexteSchema: z.ZodType<DotationSansTexte> = formesDeDotation<FormeSansTexte>([dotationDeCatalogueSchema, dotationDePossessionSchema, sommeSchema]);
/** Dotation de `careerLevels.json` et `creatures.json` (`trappingRefSchema`) : l'annotation de ce schéma récursif. */
export type TrappingRef = FormeDeDotation | Parmi<1, FormeDeDotation | LotDeDotation>;
/** Dotation de `careerLevels.json` et `creatures.json`. */
export const trappingRefSchema: z.ZodType<TrappingRef> = formesDeDotation<FormeDeDotation, LotDeDotation>(
  [dotationDeCatalogueSchema, dotationDeTexteSchema, dotationDeMentionSchema, dotationDePossessionSchema, sommeSchema, jokerDeDotationSchema],
  [lotDeDotationSchema],
);


import { nommerChamps, nommerNoeud } from '../grammaire/meta';
/**
 * Schéma zod du bloc NARRATIF embarqué d'un projet (#765) — la DÉFINITION : ses types (`NarratifBlock`
 * et frères, en fin de module) en dérivent par `z.infer`.
 *
 * Frontière RÉFÉRENCE vs NARRATIF : le narratif est EMBARQUÉ dans le document de campagne et
 * RÉFÉRENCE la règle globale (`src/data`) PAR ID — jamais copiée, jamais réinjectée. L'invariant
 * est gardé ICI : aucun id narratif ne collisionne avec un id de la règle globale
 * (créature/possession), et les registres (`REGISTRES_NARRATIFS`) n'ont aucun id en commun.
 *
 * #2427 ; fiche `user-doctrine-regle-5-campagne-repliques-et-narration-maison`.
 */
import { z } from 'zod';
import { maisonSchema, sourceRefSchema, entityAppearanceSchema } from '../grammaire/valeurs';
import { clotureSchema, identiteSchema, ouvertureSchema } from '../grammaire/campagne';
import { couvreSchema, entreeDeFicheSchema } from './communs';
import { listeCle } from '../grammaire/collection-cle';
import { ref } from '../grammaire/ref';
import { champAdapteDe, proseNommee, META_ADAPTE_DE } from '../grammaire/prose';
import { entreePartielle as creatureEntreePartielle } from '../defs/creatures';
import { entree as trappingEntree } from '../defs/trappings';
import { findCreatureById, findTrappingById, trappingDesObjetsPuisDuCatalogue } from '../../index';
import { messageDApparenceDObjet, type TrappingResolver } from '../../apparencesObjets';
import type { CreatureData, TrappingData } from '../../index';
import { REGISTRES_NARRATIFS } from './registres-narratifs';
import { exclusiviteAdapteDe, refuserSansProvenance } from '../grammaire/document';
import { fautesDeSites, sitesDuNarratif } from './refs-narratives';
import type { FormeDEtatKind } from './formes-d-etat';

/** Un stade RÉVÉLABLE d'un indice : la prose dévoilée à ce palier, le document qu'il croise
 *  (`narratif.documents`, #679), ou les deux — au moins l'un (`raffineNarratif`). */
export const indiceStadeSchema = proseNommee(nommerChamps(z.strictObject({
  /** id STABLE du stade, unique DANS l'indice. */
  id: z.string().min(1, 'id vide.'),
  documentId: z.string().min(1, 'id de document vide.').optional(),
}), { id: { label: "identifiant" , texte: { regime: "technique"} }, documentId: { label: "document" , texte: { regime: "technique"} } }), 'narratif.indices[].stades[].prose');

/** #679 ; #2427. */
export const documentNarratifSchema = proseNommee(nommerChamps(z.strictObject({
  /** id STABLE, unique dans le narratif ET non-colluant avec un id global. */
  id: z.string().min(1, 'id vide.'),
  titre: z.string().min(1, 'titre vide.'),
}), { id: { label: "identifiant" , texte: { regime: "technique"} }, titre: { label: "titre" , texte: { regime: "designation"} } }), 'narratif.documents[].prose');

/** Un indice ou une rumeur d'une affaire — révélé par stades. */
export const indiceSchema = nommerChamps(z.strictObject({
  /** id STABLE, unique dans le narratif ET non-colluant avec un id global. */
  id: z.string().min(1, 'id vide.'),
  affaireId: z.string(),
  kind: z.enum(['indice', 'rumeur']),
  titre: z.string(),
  /** Stades révélables (au moins un — vérifié par `raffineNarratif`). */
  stades: listeCle(indiceStadeSchema, 'id'),
  /** Autres indices (ids) que celui-ci recoupe/débloque. */
  refs: z.array(z.string()).optional(),
  couvre: couvreSchema.optional(),
}), { id: { label: "identifiant" , texte: { regime: "technique"} }, affaireId: { label: "affaire" , texte: { regime: "technique"} }, kind: { label: "type"  }, titre: { label: "titre" , texte: { regime: "designation"} }, stades: { label: "stades" }, refs: { label: "renvois" , texte: { regime: "technique"} }, couvre: { label: "entrées couvertes" , texte: { regime: "technique"} } });

/** Une affaire (fil d'enquête) de la campagne. */
export const affaireSchema = nommerChamps(z.strictObject({
  id: z.string().min(1, 'id vide.'),
  titre: z.string(),
  desc: z.string().optional(),
}), { id: { label: "identifiant" , texte: { regime: "technique"} }, titre: { label: "titre" , texte: { regime: "designation"} }, desc: { label: "texte" , texte: { regime: "atelier",usage: "description de l’affaire réservée à l’atelier"} } });


/** La créature globale que surcharge un preset : `ref('creature')`, sortie élargie (patron `couvertureSchema`,
 *  `./scene.ts`) : `PresetPnj` est lu par l'éditeur du narratif et par l'authoring TS des scénarios. */
const creatureDeBaseSchema: z.ZodType<{ id: string }, { id: string }> = ref('creature');

/** Un PNJ pré-composé : créature globale surchargée (`base`) ou profil ad hoc embarqué (`profil`,
 *  même forme qu'une entrée de `creatures.json`, partielle). Le nœud de l'entrée partielle est SCELLÉ
 *  (`z.infer` y vaut `unknown`) : sa vue TS est celle que le runtime consomme, `Partial<CreatureData>`
 *  (`noyau/monde/resolveursDuNarratif.ts`), même régime que `objets` ci-dessous. `source`|`adapteDe` : provenance du
 *  texte du profil et folio du PNJ ; arbitrages chiffrés : `profil.maison` (#2001, #2206). */
const presetPnjObjet = z.strictObject({
  id: z.string().min(1, 'id vide.'),
  base: creatureDeBaseSchema.optional(),
  profil: (creatureEntreePartielle as z.ZodType<Partial<CreatureData>>).optional(),
  apparence: entityAppearanceSchema.optional(),
  /** id d'illustration (registre d'art), affichage seul. */
  portrait: z.string().optional(),
  source: sourceRefSchema.optional(),
  couvre: couvreSchema.optional(),
  ...champAdapteDe(),
});
export const presetPnjSchema = nommerChamps(presetPnjObjet.superRefine(exclusiviteAdapteDe(presetPnjObjet)), { id: { label: "identifiant" , texte: { regime: "technique"} }, base: { label: "base" , texte: { regime: "technique"} }, profil: { label: "profil" }, apparence: { label: "apparence" }, portrait: { label: "portrait" , texte: { regime: "technique"} }, source: { label: "source" }, couvre: { label: "entrées couvertes" , texte: { regime: "technique"} }, ...META_ADAPTE_DE });

/** Une valeur d'un état ÉNUMÉRÉ : id STABLE (lu par la logique), libellé d'affichage. */
export const valeurDEtatSchema = nommerChamps(z.strictObject({
  id: z.string().min(1, 'id vide.'),
  label: z.string().min(1, 'libellé vide.'),
}), { id: { label: "identifiant" , texte: { regime: "technique"} }, label: { label: "libellé" , texte: { regime: "designation"} } });

/** Le schéma de chaque forme d'état (`./formes-d-etat.ts`) — table TOTALE : une forme sans schéma ne compile pas. */
const SCHEMA_DE_FORME = {
  heros: nommerChamps(z.strictObject({ kind: z.literal('heros'), identite: identiteSchema.optional() }), { kind: { label: "type"  }, identite: { label: "identité" } }),
  enum: nommerChamps(z.strictObject({
    kind: z.literal('enum'),
    valeurs: listeCle(valeurDEtatSchema, 'id', { min: { taille: 1, message: 'aucune valeur : un état énuméré en déclare au moins une.' } }),
  }), { kind: { label: "type"  }, valeurs: { label: "valeurs" } }),
} as const satisfies { readonly [K in FormeDEtatKind]: z.ZodType<{ kind: K }> };

type SchemaDeForme = (typeof SCHEMA_DE_FORME)[FormeDEtatKind];
export const formeDEtatSchema = z.discriminatedUnion('kind', Object.values(SCHEMA_DE_FORME) as [SchemaDeForme, ...SchemaDeForme[]]);

/** Un ÉTAT DE CAMPAGNE (#2539) : un choix ou une issue que le récit pose et qu'un chapitre ultérieur lit —
 *  provenance `source` OU `maison`, même forme que celle d'un billet (`routeBilletSchema`). */
export const etatNarratifSchema = nommerChamps(z.strictObject({
  id: z.string().min(1, 'id vide.'),
  label: z.string().min(1, 'libellé vide.'),
  source: sourceRefSchema.optional(),
  maison: maisonSchema.optional(),
  forme: formeDEtatSchema,
})
  .superRefine((etat, ctx) => refuserSansProvenance(etat, ctx, 'de l’état')), { id: { label: "identifiant" , texte: { regime: "technique"} }, label: { label: "libellé" , texte: { regime: "designation"} }, source: { label: "source" }, maison: { label: "maison" , texte: { regime: "technique"} }, forme: { label: "forme" } });

/** Une entrée de fiche de dossier de chapitre ÉCARTÉE par l'adaptation (#2290), avec son motif. */
export const ecartSchema = nommerChamps(z.strictObject({
  entree: entreeDeFicheSchema,
  motif: z.string().regex(/\S/, 'motif vide.'),
}), { entree: { label: "entrée" , texte: { regime: "technique"} }, motif: { label: "motif" , texte: { regime: "atelier",usage: "motif d’écart du dossier de chapitre"} } });

/** Un id narratif COLLISIONNE avec la règle globale s'il résout déjà comme créature OU possession. */
export const collisionneAvecLeGlobal = (id: string): boolean => !!findCreatureById(id) || !!findTrappingById(id);

/** #2948 */
export function validerReferencesDObjetsDansCampagne(objets: readonly TrappingData[], ctx: z.RefinementCtx): void {
  const parId = new Map(objets.map((objet) => [objet.id, objet]));
  const resolve: TrappingResolver = (id) => trappingDesObjetsPuisDuCatalogue(parId, id);
  for (let i = ctx.issues.length - 1; i >= 0; i--) {
    const issue = ctx.issues[i];
    if (issue.code !== 'custom') continue;
    const reference = issue.params?.referenceDObjet as { trappingId?: string; apparence?: string } | undefined;
    if (!reference) continue;
    const message = reference.apparence
      ? messageDApparenceDObjet(reference.trappingId, reference.apparence, resolve)
      : reference.trappingId && resolve(reference.trappingId) ? undefined : issue.message;
    if (message) ctx.issues[i] = { ...issue, message };
    else ctx.issues.splice(i, 1);
  }
}

/**
 * Sémantique du bloc narratif — unicité des ids INTER-registres (l'unicité DANS un registre est la
 * clé de sa liste, `listeCle`) et anti-collision avec la règle globale, pour chaque registre de
 * `REGISTRES_NARRATIFS` ; `indice.affaireId` croisé, stades non vides, stade à prose OU document
 * (`documentId` croisé) et preset à `base` OU `profil` complet ; les spécialisations du profil sont
 * jugées par les fabriques de `profil.skills` et `profil.talents` (`refusDeSpec`). Attachée à `narratifSchema`, elle porte donc le chemin complet (`narratif.indices.3.affaireId`) quand le projet la compose.
 */
function raffineNarratif(nb: z.infer<typeof formeNarratif>, ctx: z.RefinementCtx): void {
  validerReferencesDObjetsDansCampagne(nb.objets, ctx);
  const faute = (path: (string | number)[], message: string): void => ctx.addIssue({ code: 'custom', path, message });

  /** Registre qui a déclaré chaque id, dans l'ordre de la table. */
  const registreDe = new Map<string, (typeof REGISTRES_NARRATIFS)[number]>();
  for (const reg of REGISTRES_NARRATIFS) {
    (nb[reg.cle] as readonly { id: string }[]).forEach(({ id }, i) => {
      const autre = registreDe.get(id);
      if (autre && autre !== reg) faute([reg.cle, i, 'id'], `l'id ${reg.de} « ${id} » collisionne avec un id ${autre.de}.`);
      if (collisionneAvecLeGlobal(id)) faute([reg.cle, i, 'id'], `l'id ${reg.de} « ${id} » collisionne avec un id de la règle globale (créature/possession).`);
      if (!autre) registreDe.set(id, reg);
    });
  }

  /** `affaireId` d'indice, `documentId` de stade : visiteur unique des références (`./refs-narratives.ts`). */
  for (const f of fautesDeSites(sitesDuNarratif(nb), nb)) faute([...f.chemin], f.message);

  const indiceIds = new Set(nb.indices.map((ind) => ind.id));
  nb.indices.forEach((ind, i) => {
    if (!ind.stades.length) faute(['indices', i, 'stades'], 'aucun stade : un indice en porte au moins un.');
    ind.stades.forEach((st, j) => {
      if (st.prose === undefined && st.documentId === undefined) faute(['indices', i, 'stades', j], 'ni prose ni document : un stade en porte au moins un.');
    });
    (ind.refs ?? []).forEach((r, j) => {
      if (!indiceIds.has(r)) faute(['indices', i, 'refs', j], `indice inconnu « ${r} ».`);
    });
  });

  nb.presetsPnj.forEach((p, i) => {
    if (p.base === undefined && p.profil === undefined) faute(['presetsPnj', i], "ni base ni profil (au moins l'un des deux est requis).");
    if (p.base === undefined && p.profil !== undefined) {
      if (!p.profil.char || typeof p.profil.char !== 'object') faute(['presetsPnj', i, 'profil', 'char'], '« char » absent d’un profil sans base.');
      if (!Array.isArray(p.profil.traits)) faute(['presetsPnj', i, 'profil', 'traits'], '« traits » absent d’un profil sans base.');
    }
  });
}

/** FORME du bloc narratif. #4171 */
const formeNarratif = nommerChamps(z.strictObject({
  affaires: listeCle(affaireSchema, 'id'),
  indices: listeCle(indiceSchema, 'id'),
  presetsPnj: listeCle(presetPnjSchema, 'id'),
  objets: listeCle(trappingEntree, 'id'),
  documents: listeCle(documentNarratifSchema, 'id'),
  etats: listeCle(etatNarratifSchema, 'id'),
  ouverture: ouvertureSchema.optional(),
  cloture: clotureSchema.optional(),
  ecartes: listeCle(ecartSchema, 'entree').optional(),
}), { affaires: { label: "affaires" }, indices: { label: "indices" }, presetsPnj: { label: "PNJ précomposés" }, objets: { label: "objets" , texte: { regime: "atelier",usage: "objets embarqués, entrées entières du catalogue des possessions"} }, documents: { label: "documents" }, etats: { label: "états de campagne" }, ouverture: { label: "ouverture" }, cloture: { label: "clôture" }, ecartes: { label: "écarts" } });

/** `NarratifBlock` (fin de module) — forme + sémantique. */
export const narratifSchema = formeNarratif.superRefine(raffineNarratif);

nommerNoeud(indiceSchema, { element: 'indice' });
nommerNoeud(indiceStadeSchema, { element: 'stade' });
nommerNoeud(presetPnjSchema, { element: 'PNJ' });
nommerNoeud(documentNarratifSchema, { element: 'document' });
nommerNoeud(etatNarratifSchema, { element: 'état' });
nommerNoeud(valeurDEtatSchema, { element: 'valeur' });

export type IndiceStade = z.infer<typeof indiceStadeSchema>;
export type DocumentNarratif = z.infer<typeof documentNarratifSchema>;
export type Indice = z.infer<typeof indiceSchema>;
export type Affaire = z.infer<typeof affaireSchema>;
export type PresetPnj = z.infer<typeof presetPnjSchema>;
export type EtatNarratif = z.infer<typeof etatNarratifSchema>;
/** Entrée de fiche de dossier de chapitre écartée par l'adaptation, avec son motif (#2290). */
export type EcartDeFiche = z.infer<typeof ecartSchema>;
export type OuvertureBlock = z.infer<typeof ouvertureSchema>;
/** AMBIANCE d'un cadre de campagne (#717) — strate de matière lue par les tokens `--amb-*`
 *  (`styles/base.css`), portée en `data-ambiance` par la coquille d'écran. */
export type AmbianceCadre = NonNullable<OuvertureBlock['ambiance']>;
export type ClotureBlock = z.infer<typeof clotureSchema>;
export type NarratifBlock = z.infer<typeof narratifSchema>;

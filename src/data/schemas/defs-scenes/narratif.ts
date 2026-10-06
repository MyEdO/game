/**
 * Schéma zod du bloc NARRATIF embarqué d'un projet (#765) — la DÉFINITION : `src/state/campaignNarratif.ts`
 * en dérive ses types par `z.infer`.
 *
 * Frontière RÉFÉRENCE vs NARRATIF : le narratif est EMBARQUÉ dans le document de campagne et
 * RÉFÉRENCE la règle globale (`src/data`) PAR ID — jamais copiée, jamais réinjectée. L'invariant
 * est gardé ICI : aucun id narratif ne collisionne avec un id de la règle globale
 * (créature/possession), et les registres (`REGISTRES_NARRATIFS`) n'ont aucun id en commun.
 *
 * Stade d'indice, preset PNJ, ouverture : `source` (règle stricte 5) ⊕ `adapteDe` (`champAdapteDe`,
 * `grammaire/prose.ts` ; fiche `user-doctrine-regle-5-campagne-repliques-et-narration-maison`). Document :
 * `source` seul.
 */
import { z } from 'zod';
import { sourceRefSchema, entityAppearanceSchema } from '../grammaire/valeurs';
import { conditionCondCtxSchema } from './worldmap';
import { idDeCreature } from './effets';
import { listeCle } from '../grammaire/collection-cle';
import { champAdapteDe, proseDeScene, refineAdapteDe } from '../grammaire/prose';
import { entreePartielle as creatureEntreePartielle } from '../defs/creatures';
import { findCreatureById, findTrappingById, byId, findTalentById, specResolves, porteCatalogueDeSpecs } from '../../index';
import type { CreatureData, TrappingData } from '../../index';
import { REGISTRES_NARRATIFS } from './registres-narratifs';
import { fautesDeSites, sitesDuNarratif } from './refs-narratives';

/** Un stade RÉVÉLABLE d'un indice : la prose dévoilée à ce palier, le document qu'il croise
 *  (`narratif.documents`, #679), ou les deux — au moins l'un (`raffineNarratif`). */
export const indiceStadeSchema = z.strictObject({
  /** id STABLE du stade, unique DANS l'indice. */
  id: z.string().min(1, 'id vide.'),
  prose: proseDeScene('narratif.indices[].stades[].prose').optional(),
  documentId: z.string().min(1, 'id de document vide.').optional(),
  source: sourceRefSchema.optional(),
  ...champAdapteDe(),
}).superRefine(refineAdapteDe);

/** Un document remis au joueur (#679) — prose VERBATIM (règle 5, Markdown), servie par l'Effect
 *  `document { documentId }`. */
export const documentNarratifSchema = z.strictObject({
  /** id STABLE, unique dans le narratif ET non-colluant avec un id global. */
  id: z.string().min(1, 'id vide.'),
  titre: z.string().min(1, 'titre vide.'),
  prose: proseDeScene('narratif.documents[].prose').min(1, 'prose vide.'),
  source: sourceRefSchema.optional(),
});

/** Un indice ou une rumeur d'une affaire — révélé par stades. */
export const indiceSchema = z.strictObject({
  /** id STABLE, unique dans le narratif ET non-colluant avec un id global. */
  id: z.string().min(1, 'id vide.'),
  affaireId: z.string(),
  kind: z.enum(['indice', 'rumeur']),
  titre: z.string(),
  /** Stades révélables (au moins un — vérifié par `raffineNarratif`). */
  stades: listeCle(indiceStadeSchema, 'id'),
  /** Autres indices (ids) que celui-ci recoupe/débloque. */
  refs: z.array(z.string()).optional(),
});

/** Une affaire (fil d'enquête) de la campagne. */
export const affaireSchema = z.strictObject({
  id: z.string().min(1, 'id vide.'),
  titre: z.string(),
  desc: z.string().optional(),
});


/** Un PNJ pré-composé : créature globale surchargée (`base`) ou profil ad hoc embarqué (`profil`,
 *  même forme qu'une entrée de `creatures.json`, partielle). Le nœud de l'entrée partielle est SCELLÉ
 *  (`z.infer` y vaut `unknown`) : sa vue TS est celle que le runtime consomme, `Partial<CreatureData>`
 *  (`state/campaignData.ts`), même régime que `objets` ci-dessous. */
export const presetPnjSchema = z.strictObject({
  id: z.string().min(1, 'id vide.'),
  base: idDeCreature.optional(),
  profil: (creatureEntreePartielle as z.ZodType<Partial<CreatureData>>).optional(),
  apparence: entityAppearanceSchema.optional(),
  /** id d'illustration (registre d'art), affichage seul. */
  portrait: z.string().optional(),
  source: sourceRefSchema.optional(),
  ...champAdapteDe(),
})
  .superRefine(refineAdapteDe)
  .superRefine(refinePresetAdapte);

/** Un preset ADAPTÉ (`adapteDe`) ne porte pas de prose ADRESSÉE : la prose d'un preset est `profil.desc`,
 *  et `profil.descRef` en fait la copie du livre (#2001). */
function refinePresetAdapte(v: unknown, ctx: z.RefinementCtx): void {
  const p = (v ?? {}) as { adapteDe?: unknown; profil?: { descRef?: unknown } };
  if (p.adapteDe !== undefined && p.profil?.descRef !== undefined) {
    ctx.addIssue({ code: 'custom', path: ['adapteDe'], message: 'texte adapté, alors que la description du profil est la copie adressée du livre.' });
  }
}

/** Ouverture CÉRÉMONIELLE du chapitre (#717, `OuvertureBlock`). Rendu par `<Prose>` : titre et
 *  pitch non vides sont la seule exigence. */
export const ouvertureSchema = z.strictObject({
  surtitre: z.string().optional(),
  titre: z.string().min(1, 'titre vide.'),
  sousTitre: z.string().optional(),
  chapitre: z.string().optional(),
  pitch: proseDeScene('narratif.ouverture.pitch').min(1, 'pitch vide.'),
  source: sourceRefSchema.optional(),
  ...champAdapteDe(),
  ambiance: z.enum(['veillee', 'parchemin']).optional(),
}).superRefine(refineAdapteDe);

/** CLÔTURE du chapitre (#717, `ClotureBlock`) — `when` évalué au contexte HORS COMBAT (`condCtx`),
 *  d'où le MÊME schéma borné que le `when` d'un lieu de carte (un kind non évaluable serait FAUX
 *  en silence : le chapitre ne se fermerait jamais, sans qu'aucune donnée ne soit fautive). */
export const clotureSchema = z.strictObject({
  when: conditionCondCtxSchema,
  titre: z.string().min(1, 'titre vide.'),
  sousTitre: z.string().optional(),
});

/** Un id narratif COLLISIONNE avec la règle globale s'il résout déjà comme créature OU possession. */
export const collisionneAvecLeGlobal = (id: string): boolean => !!findCreatureById(id) || !!findTrappingById(id);

/**
 * Sémantique du bloc narratif — unicité des ids INTER-registres (l'unicité DANS un registre est la
 * clé de sa liste, `listeCle`) et anti-collision avec la règle globale, pour chaque registre de
 * `REGISTRES_NARRATIFS` ; `indice.affaireId` croisé, stades non vides, stade à prose OU document
 * (`documentId` croisé), preset à `base` OU `profil` complet, et spécialisations RÉSOLUES au catalogue
 * global (`specResolves`). Attachée à `narratifSchema`, elle porte donc le chemin complet (`narratif.indices.3.affaireId`) quand le projet la compose.
 */
function raffineNarratif(nb: z.infer<typeof formeNarratif>, ctx: z.RefinementCtx): void {
  const faute = (path: (string | number)[], message: string): void => ctx.addIssue({ code: 'custom', path, message });

  /** Registre qui a déclaré chaque id, dans l'ordre de la table. */
  const registreDe = new Map<string, (typeof REGISTRES_NARRATIFS)[number]>();
  for (const reg of REGISTRES_NARRATIFS) {
    (nb[reg.cle] as readonly unknown[]).forEach((e, i) => {
      const id = e && typeof e === 'object' ? (e as { id?: unknown }).id : undefined;
      if (typeof id !== 'string' || id === '') {
        if (!reg.idAuSchema) faute([reg.cle, i, 'id'], 'id absent.');
        return;
      }
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
    /** Référence PAR ID jusque dans la spécialisation (`specResolves`, #1342 L3). La sentinelle
     *  « au choix » reste admise : elle désigne un EMPLACEMENT, pas une spécialisation. Elle ne
     *  peut plus arriver côté COMPÉTENCE (`competenceChiffreeSchema` = `refOuSpec('skill', { value })`, dont
     *  `ref.ts#SENTINELLE_DE_SPEC` la refuse au parse) ; elle arrive ENCORE côté TALENT, où
     *  `talentRefSchema` (`grammaire/reference.ts`) n'a pas de régime `choix` — 12 sentinelles
     *  mesurées dans `creatures.json`, dont ces profils embarqués sont le patch partiel. Concept
     *  loté L3 (#1463) : ce volet tombe quand le talent gagne son régime `choix`.
     *  Talent sans catalogue (`porteCatalogueDeSpecs`) : texte d'instance, même régime que
     *  `creatures.json` (#1621, `src/data/refs-migrated.test.ts`). */
    const specValide = (
      champ: 'skills' | 'talents',
      kind: { indefini: string; defini: string; texteDInstance: boolean },
      find: (id: string) => Parameters<typeof specResolves>[0] | undefined,
      refs: { id: string; spec?: string }[],
    ): void => {
      refs.forEach((r, j) => {
        if (typeof r.spec !== 'string' || /au choix/i.test(r.spec)) return;
        const def = find(r.id);
        if (!def) {
          faute(['presetsPnj', i, 'profil', champ, j, 'id'], `${kind.indefini} inconnu(e) « ${r.id} ».`);
          return;
        }
        if (kind.texteDInstance && !porteCatalogueDeSpecs(def)) return;
        if (!specResolves(def, r.spec)) {
          faute(['presetsPnj', i, 'profil', champ, j, 'spec'], `spécialisation inconnue « ${r.spec} » pour ${kind.defini} « ${r.id} ».`);
        }
      });
    };
    specValide('skills', { indefini: 'une Compétence', defini: 'la Compétence', texteDInstance: false }, (id) => byId('skill', id), p.profil?.skills ?? []);
    specValide('talents', { indefini: 'un Talent', defini: 'le Talent', texteDInstance: true }, findTalentById, p.profil?.talents ?? []);
  });
}

/** FORME du bloc narratif. `objets` est typé `TrappingData` (`src/data/index.ts`) : le schéma du
 *  CATALOGUE (`defs/trappings.ts`) ne le décrit pas — il est mesuré sur `trappings.json`, dont le
 *  `type` est une énumération fermée (6 valeurs) et dont `availability`/`qualities`/`desc`/`price`/
 *  `source` sont requis, là où un objet EMBARQUÉ de campagne porte un type libre et se passe de
 *  l'enveloppe de catalogue. Échéance : `TROUS_DE_VALIDATION['narratif.ts:objets']`
 *  (`trous-de-validation.ts`), UNIQUE source du lot de mort de ce trou. */
const formeNarratif = z.strictObject({
  affaires: listeCle(affaireSchema, 'id'),
  indices: listeCle(indiceSchema, 'id'),
  presetsPnj: listeCle(presetPnjSchema, 'id'),
  objets: listeCle(z.custom<TrappingData>(), 'id'),
  documents: listeCle(documentNarratifSchema, 'id'),
  ouverture: ouvertureSchema.optional(),
  cloture: clotureSchema.optional(),
});

/** `NarratifBlock` (`state/campaignNarratif.ts`) — forme + sémantique. */
export const narratifSchema = formeNarratif.superRefine(raffineNarratif);

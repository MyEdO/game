/**
 * Schéma zod du bloc NARRATIF embarqué d'un projet (`src/state/campaignNarratif.ts`, #765).
 *
 * Frontière RÉFÉRENCE vs NARRATIF : le narratif est EMBARQUÉ dans le document de campagne et
 * RÉFÉRENCE la règle globale (`src/data`) PAR ID — jamais copiée, jamais réinjectée. L'invariant
 * est gardé ICI : aucun id narratif ne collisionne avec un id de la règle globale
 * (créature/possession), et les quatre registres n'ont aucun id en commun.
 */
import { z } from 'zod';
import { sourceRefSchema, entityAppearanceSchema } from '../grammaire/valeurs';
import { conditionCondCtxSchema } from './worldmap';
import { idDe } from '../grammaire/ref';
import { listeCle } from '../grammaire/collection-cle';
import { proseDeScene } from '../grammaire/prose';
import { entreePartielle as creatureEntreePartielle, type CreatureProfilPartiel } from '../defs/creatures';
import { findCreatureById, findTrappingById, byId, findTalentById, specResolves } from '../../index';
import type { TrappingData } from '../../index';

/** Un stade RÉVÉLABLE d'un indice : la prose (verbatim source, règle 5) dévoilée à ce palier. */
export const indiceStadeSchema = z.strictObject({
  /** id STABLE du stade, unique DANS l'indice. */
  id: z.string().min(1, 'id vide.'),
  prose: proseDeScene('narratif.indices[].stades[].prose'),
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
 *  même forme qu'une entrée de `creatures.json`, partielle). */
export const presetPnjSchema = z.strictObject({
  id: z.string().min(1, 'id vide.'),
  base: idDe('creature').optional(),
  profil: (creatureEntreePartielle as z.ZodType<CreatureProfilPartiel>).optional(),
  apparence: entityAppearanceSchema.optional(),
  /** id d'illustration (registre d'art), affichage seul. */
  portrait: z.string().optional(),
  source: sourceRefSchema.optional(),
});

/** Ouverture CÉRÉMONIELLE du chapitre (#717, `OuvertureBlock`) — le `pitch` est du VERBATIM de
 *  source (règle stricte 5), rendu par `<Prose>` : titre et pitch non vides sont la seule exigence. */
export const ouvertureSchema = z.strictObject({
  surtitre: z.string().optional(),
  titre: z.string().min(1, 'titre vide.'),
  sousTitre: z.string().optional(),
  chapitre: z.string().optional(),
  pitch: proseDeScene('narratif.ouverture.pitch').min(1, 'pitch vide.'),
  source: sourceRefSchema.optional(),
  ambiance: z.enum(['veillee', 'parchemin']).optional(),
});

/** CLÔTURE du chapitre (#717, `ClotureBlock`) — `when` évalué au contexte HORS COMBAT (`condCtx`),
 *  d'où le MÊME schéma borné que le `when` d'un lieu de carte (un kind non évaluable serait FAUX
 *  en silence : le chapitre ne se fermerait jamais, sans qu'aucune donnée ne soit fautive). */
export const clotureSchema = z.strictObject({
  when: conditionCondCtxSchema,
  titre: z.string().min(1, 'titre vide.'),
  sousTitre: z.string().optional(),
});

/** Un id narratif COLLISIONNE avec la règle globale s'il résout déjà comme créature OU possession. */
const collisionneAvecLeGlobal = (id: string): boolean => !!findCreatureById(id) || !!findTrappingById(id);

/**
 * Sémantique du bloc narratif — unicité des ids INTER-registres (l'unicité DANS un registre est la
 * clé de sa liste, `listeCle`), anti-collision avec la règle globale, `indice.affaireId` croisé,
 * stades non vides, preset à `base` OU `profil` complet, et spécialisations RÉSOLUES au catalogue
 * global (`specResolves`). Attachée à `narratifSchema`, elle porte donc le chemin complet (`narratif.indices.3.affaireId`) quand le projet la compose.
 */
function raffineNarratif(nb: z.infer<typeof formeNarratif>, ctx: z.RefinementCtx): void {
  const faute = (path: (string | number)[], message: string): void => ctx.addIssue({ code: 'custom', path, message });

  const affaireIds = new Set<string>();
  nb.affaires.forEach((a, i) => {
    if (collisionneAvecLeGlobal(a.id)) faute(['affaires', i, 'id'], `l'id d'affaire « ${a.id} » collisionne avec un id de la règle globale (créature/possession).`);
    affaireIds.add(a.id);
  });

  const indiceIds = new Set<string>();
  nb.indices.forEach((ind, i) => {
    if (affaireIds.has(ind.id)) faute(['indices', i, 'id'], `l'id d'indice « ${ind.id} » collisionne avec un id d'affaire.`);
    if (collisionneAvecLeGlobal(ind.id)) faute(['indices', i, 'id'], `l'id d'indice « ${ind.id} » collisionne avec un id de la règle globale (créature/possession).`);
    if (!affaireIds.has(ind.affaireId)) faute(['indices', i, 'affaireId'], `affaire inconnue « ${ind.affaireId} ».`);
    if (!ind.stades.length) faute(['indices', i, 'stades'], 'aucun stade : un indice en porte au moins un.');
    indiceIds.add(ind.id);
  });
  nb.indices.forEach((ind, i) => {
    (ind.refs ?? []).forEach((r, j) => {
      if (!indiceIds.has(r)) faute(['indices', i, 'refs', j], `indice inconnu « ${r} ».`);
    });
  });

  const presetIds = new Set<string>();
  nb.presetsPnj.forEach((p, i) => {
    if (affaireIds.has(p.id) || indiceIds.has(p.id)) faute(['presetsPnj', i, 'id'], `l'id de preset PNJ « ${p.id} » collisionne avec un autre id du narratif.`);
    if (collisionneAvecLeGlobal(p.id)) faute(['presetsPnj', i, 'id'], `l'id de preset PNJ « ${p.id} » collisionne avec un id de la règle globale (créature/possession).`);
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
     *  loté L3 (#1463) : ce volet tombe quand le talent gagne son régime `choix`. */
    const specValide = (
      champ: 'skills' | 'talents',
      kind: { indefini: string; defini: string },
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
        if (!specResolves(def, r.spec)) {
          faute(['presetsPnj', i, 'profil', champ, j, 'spec'], `spécialisation inconnue « ${r.spec} » pour ${kind.defini} « ${r.id} ».`);
        }
      });
    };
    specValide('skills', { indefini: 'une Compétence', defini: 'la Compétence' }, (id) => byId('skill', id), p.profil?.skills ?? []);
    specValide('talents', { indefini: 'un Talent', defini: 'le Talent' }, findTalentById, p.profil?.talents ?? []);
    presetIds.add(p.id);
  });

  nb.objets.forEach((o, i) => {
    if (!o?.id) {
      faute(['objets', i, 'id'], 'id absent.');
      return;
    }
    if (affaireIds.has(o.id) || indiceIds.has(o.id) || presetIds.has(o.id)) faute(['objets', i, 'id'], `l'id d'objet « ${o.id} » collisionne avec un autre id du narratif.`);
    if (collisionneAvecLeGlobal(o.id)) faute(['objets', i, 'id'], `l'id d'objet « ${o.id} » collisionne avec un id de la règle globale (créature/possession).`);
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
  ouverture: ouvertureSchema.optional(),
  cloture: clotureSchema.optional(),
});

/** `NarratifBlock` (`state/campaignNarratif.ts:58`) — forme + sémantique. */
export const narratifSchema = formeNarratif.superRefine(raffineNarratif);

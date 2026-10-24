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
import { alternationDe } from '../../../lib/regex';
import { sourceRefSchema, entityAppearanceSchema, validerReferencesDObjetsDansCampagne, raceKeySchema, sexeSchema } from '../grammaire/valeurs';
import { conditionCondCtxSchema } from './worldmap';
import { idDeCreature } from './effets';
import { couvreSchema, entreeDeFicheSchema } from './communs';
import { listeCle } from '../grammaire/collection-cle';
import { champAdapteDe, proseNommee, refineAdapteDe, META_ADAPTE_DE } from '../grammaire/prose';
import { entreePartielle as creatureEntreePartielle } from '../defs/creatures';
import { findCreatureById, findTrappingById, byId, findTalentById, specResolves, porteCatalogueDeSpecs } from '../../index';
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


/** Un PNJ pré-composé : créature globale surchargée (`base`) ou profil ad hoc embarqué (`profil`,
 *  même forme qu'une entrée de `creatures.json`, partielle). Le nœud de l'entrée partielle est SCELLÉ
 *  (`z.infer` y vaut `unknown`) : sa vue TS est celle que le runtime consomme, `Partial<CreatureData>`
 *  (`noyau/monde/resolveursDuNarratif.ts`), même régime que `objets` ci-dessous. `source`|`adapteDe` : provenance du
 *  texte du profil et folio du PNJ ; arbitrages chiffrés : `profil.maison` (#2001, #2206). */
const presetPnjObjet = z.strictObject({
  id: z.string().min(1, 'id vide.'),
  base: idDeCreature.optional(),
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

/** Métacaractères Markdown refusés dans un texte d'identité : il est substitué dans une prose AVANT son parse. */
const METACARACTERES_MARKDOWN = /[\\`*_[\]<>#|~]/;
const sansMarkdown = (sujet: string) => z.string().regex(/\S/, `${sujet} vide.`).refine((t) => !METACARACTERES_MARKDOWN.test(t), `${sujet} : métacaractère Markdown refusé (\\ \` * _ [ ] < > # | ~).`);

/** Les `fragments` comme mots entiers (bornes Unicode), le plus long d'abord (`alternationDe`) : `nommer`
 *  (`src/noyau/monde/identites.ts`) et le contrôle d'ancre la partagent. */
export function motifEnMot(fragments: readonly string[], drapeaux = 'u'): RegExp {
  return new RegExp(`(?<!\\p{L})(?:${alternationDe(fragments)})(?!\\p{L})`, drapeaux);
}

/** Un REPÈRE d'identité : un fragment VERBATIM du paquet, à l'id STABLE que désigne chaque valeur (`repere`). */
export const repereDIdentiteSchema = nommerChamps(z.strictObject({
  id: z.string().min(1, 'id vide.'),
  fragment: sansMarkdown('fragment du repère'),
}), { id: { label: "identifiant", texte: { regime: "technique" } }, fragment: { label: "fragment du repère", texte: { regime: "technique", usage: "fragment verbatim du paquet remplacé à l’affichage" } } });

/** La forme d'un repère (`repere`, id d'un repère de la même identité) pour une espèce et un sexe : copie
 *  (`source`) ou adaptation (`adapteDe`) d'un passage. */
export const valeurDIdentiteSchema = nommerChamps(z.strictObject({
  repere: z.string().min(1, 'repère vide.'),
  valeur: sansMarkdown('valeur'),
  source: sourceRefSchema.optional(),
  ...champAdapteDe(),
})
  .superRefine(refineAdapteDe)
  .superRefine((v, ctx) => {
    if (v.source === undefined && v.adapteDe === undefined) ctx.addIssue({ code: 'custom', path: ['source'], message: 'provenance manquante : la page copiée (source) ou le passage adapté (adapté de).' });
  }), { repere: { label: "repère", texte: { regime: "technique" } }, valeur: { label: "valeur", texte: { regime: "designation" } }, source: { label: "source" }, ...META_ADAPTE_DE });

/** Une ligne d'identité : la valeur de chaque repère pour une espèce (`RaceKey`) et un sexe. */
export const ligneDIdentiteSchema = nommerChamps(z.strictObject({
  espece: raceKeySchema,
  sexe: sexeSchema,
  valeurs: listeCle(valeurDIdentiteSchema, 'repere'),
}), { espece: { label: "espèce" }, sexe: { label: "sexe" }, valeurs: { label: "valeurs" } });

/** IDENTITÉ d'un état `heros` (EDO 02 l.112-127) : les repères du paquet et leur forme par espèce et sexe du héros désigné. */
export const identiteSchema = nommerChamps(z.strictObject({
  ancres: z.array(sansMarkdown('ancre')).min(1, 'aucune ancre : une identité en déclare au moins une.'),
  reperes: listeCle(repereDIdentiteSchema, 'id', { min: { taille: 1, message: 'aucun repère : une identité en déclare au moins un.' } }),
  lignes: listeCle(ligneDIdentiteSchema, { nom: 'espèce et sexe', de: (l) => (l.espece && l.sexe ? `${l.espece} ${l.sexe}` : undefined) }),
})
  .superRefine((id, ctx) => {
    const ancres = motifEnMot(id.ancres);
    id.reperes.forEach((r, i) => {
      if (!ancres.test(r.fragment)) ctx.addIssue({ code: 'custom', path: ['reperes', i, 'fragment'], message: `repère « ${r.fragment} » sans ancre : il contient au moins l’une de « ${id.ancres.join(' », « ')} ».` });
    });
    const reperes = new Set(id.reperes.map((r) => r.id));
    id.lignes.forEach((l, j) => {
      const couverts = new Set(l.valeurs.map((v) => v.repere));
      for (const r of reperes) if (!couverts.has(r)) ctx.addIssue({ code: 'custom', path: ['lignes', j, 'valeurs'], message: `repère « ${r} » sans valeur : une ligne couvre tous les repères.` });
      l.valeurs.forEach((v, k) => {
        if (!reperes.has(v.repere)) ctx.addIssue({ code: 'custom', path: ['lignes', j, 'valeurs', k, 'repere'], message: `repère inconnu « ${v.repere} ».` });
      });
    });
  }), { ancres: { label: "ancres", texte: { regime: "technique", usage: "noms du paquet que portent les repères" } }, reperes: { label: "repères" }, lignes: { label: "lignes" } });

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
  maison: z.string().min(1).optional(),
  forme: formeDEtatSchema,
})
  .superRefine((etat, ctx) => refuserSansProvenance(etat, ctx, 'de l’état')), { id: { label: "identifiant" , texte: { regime: "technique"} }, label: { label: "libellé" , texte: { regime: "designation"} }, source: { label: "source" }, maison: { label: "maison" , texte: { regime: "technique"} }, forme: { label: "forme" } });

/** Une entrée de fiche de dossier de chapitre ÉCARTÉE par l'adaptation (#2290), avec son motif. */
export const ecartSchema = nommerChamps(z.strictObject({
  entree: entreeDeFicheSchema,
  motif: z.string().regex(/\S/, 'motif vide.'),
}), { entree: { label: "entrée" , texte: { regime: "technique"} }, motif: { label: "motif" , texte: { regime: "atelier",usage: "motif d’écart du dossier de chapitre"} } });

/** Ouverture CÉRÉMONIELLE du chapitre (#717, `OuvertureBlock`). Rendu par `<Prose>` : titre et
 *  pitch non vides sont la seule exigence. */
export const sousTitreOuvertureSchema = proseNommee(nommerChamps(z.strictObject({}), {}), 'narratif.ouverture.sousTitre.texte');
export const sousTitreClotureSchema = proseNommee(nommerChamps(z.strictObject({}), {}), 'narratif.cloture.sousTitre.texte');
export const ouvertureSchema = proseNommee(nommerChamps(z.strictObject({
  surtitre: z.string().optional(),
  titre: z.string().min(1, 'titre vide.'),
  sousTitre: sousTitreOuvertureSchema.optional(),
  chapitre: z.string().optional(),
  ambiance: z.enum(['veillee', 'parchemin']).optional(),
}), { surtitre: { label: "surtitre" , texte: { regime: "designation"} }, titre: { label: "titre" , texte: { regime: "designation"} }, sousTitre: { label: "sous-titre" }, chapitre: { label: "chapitre" , texte: { regime: "designation"} }, ambiance: { label: "ambiance"  } }), 'narratif.ouverture.pitch');

/** CLÔTURE du chapitre (#717, `ClotureBlock`) — `when` évalué au contexte HORS COMBAT (`condCtx`),
 *  d'où le MÊME schéma borné que le `when` d'un lieu de carte (un kind non évaluable serait FAUX
 *  en silence : le chapitre ne se fermerait jamais, sans qu'aucune donnée ne soit fautive). */
export const clotureSchema = nommerChamps(z.strictObject({
  when: conditionCondCtxSchema,
  titre: z.string().min(1, 'titre vide.'),
  sousTitre: sousTitreClotureSchema.optional(),
}), { when: { label: "condition" }, titre: { label: "titre" , texte: { regime: "designation"} }, sousTitre: { label: "sous-titre" } });

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
  validerReferencesDObjetsDansCampagne(nb.objets, ctx);
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
     *  peut plus arriver côté COMPÉTENCE : la réf à spécialisation la refuse au parse, quel que soit le
     *  régime du porteur (`ref.ts#SENTINELLE_DE_SPEC`) ; elle arrive ENCORE côté TALENT, où
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
const formeNarratif = nommerChamps(z.strictObject({
  affaires: listeCle(affaireSchema, 'id'),
  indices: listeCle(indiceSchema, 'id'),
  presetsPnj: listeCle(presetPnjSchema, 'id'),
  objets: listeCle(z.custom<TrappingData>(), 'id'),
  documents: listeCle(documentNarratifSchema, 'id'),
  etats: listeCle(etatNarratifSchema, 'id'),
  ouverture: ouvertureSchema.optional(),
  cloture: clotureSchema.optional(),
  ecartes: listeCle(ecartSchema, 'entree').optional(),
}), { affaires: { label: "affaires" }, indices: { label: "indices" }, presetsPnj: { label: "PNJ précomposés" }, objets: { label: "objets" , texte: { regime: "atelier",usage: "objets embarqués typés au catalogue, onglet en lecture seule"} }, documents: { label: "documents" }, etats: { label: "états de campagne" }, ouverture: { label: "ouverture" }, cloture: { label: "clôture" }, ecartes: { label: "écarts" } });

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

import { nommerChamps } from '../grammaire/meta';
/**
 * Schéma de `donnees.manifest.json` — manifeste éditorial de l'atlas des données (#903), consommé
 * par `scripts/docs/build-donnees.mjs` pour générer `docs/donnees.md`. Vocabulaire app-interne
 * (tooling), pas une donnée RAW — cf. `EXEMPT_DATASETS` (citationCoverage.mjs).
 */
import { z } from 'zod';
import { document } from '../grammaire/document';

export const file = 'donnees.manifest.json';
export const famille = 'config';

const entreeSchema = nommerChamps(z.strictObject({
  files: z.array(z.string()),
  desc: z.string(),
}), { files: { label: 'fichiers' }, desc: { label: 'texte' } });

const rubriqueSchema = nommerChamps(z.strictObject({
  id: z.string().min(1),
  label: z.string().min(1),
  /** Note de rubrique imprimée sous son tableau (`build-donnees.mjs`) — CHAMP, jamais un cas
   *  particulier câblé dans le générateur : toute rubrique peut en porter une. */
  note: z.string().min(1).optional(),
  entrees: z.array(entreeSchema),
}), {
  id: { label: 'identifiant' },
  label: { label: 'libellé' },
  note: { label: 'note' },
  entrees: { label: 'entrées' },
});

const homonymeEntreeSchema = nommerChamps(z.strictObject({
  file: z.string(),
  desc: z.string(),
}), { file: { label: 'fichier' }, desc: { label: 'texte' } });

const homonymeCasSchema = nommerChamps(z.strictObject({
  mot: z.string(),
  entrees: z.array(homonymeEntreeSchema),
  lecon: z.string(),
}), {
  mot: { label: 'mot' },
  entrees: { label: 'entrées' },
  lecon: { label: 'leçon' },
});

const doc = document(
  'donnees.manifest',
  famille,
  {
    reglesOr: z.string(),
    rubriques: z.array(rubriqueSchema),
    homonymes: nommerChamps(z.strictObject({
      intro: z.string(),
      cas: z.array(homonymeCasSchema),
    }), { intro: { label: 'introduction' }, cas: { label: 'cas' } }),
  },
  {
    reglesOr: { label: 'Règles d’or', hint: 'Principes éditoriaux de l’atlas des données' },
    rubriques: { label: 'Rubriques', hint: 'Sections de l’atlas, chacune listant ses fichiers et leur usage' },
    homonymes: { label: 'Homonymes', hint: 'Cas de noms partagés entre fichiers, avec la leçon qui les distingue' },
  },
  {
    codex: {
      exempt: {
        kind: 'vocabulaire-app-interne',
        raison:
          "manifeste TOOLING (#903) éditorial de l'atlas des données (rangement par rubrique/description/homonymes) — vocabulaire app-interne.",
      },
    },
    edit: { none: 'aucune catégorie Codex ne l’expose, donc aucun formulaire d’atelier ne l’édite' },
  },
);

export const schema = doc.schema;
export const meta = doc.meta;

export const exposition = doc.exposition;

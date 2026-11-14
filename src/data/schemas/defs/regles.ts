/**
 * Schéma de `regles.json` — catalogue des PROCÉDURES / OPTIONS de jeu (Sombre Pacte, modes
 * d'attaque/défense, Empoignade, Focalisation étendue…) dont la prose est ADRESSÉE au passage du
 * `Source/` (`descRef`, #1887). Consommé par le Codex (`registry.ts`, catégorie `regles`) et routé en
 * tooltip `CodexRef`.
 *
 * Une règle EST son identité, sa prose et son folio — la prose (`desc` ou `descRef`, `exiges: ['desc']`)
 * et la `source` sont EXIGÉES (`options.exiges`). Une règle SCALAIRE porte en plus ses valeurs fixées par
 * le livre (`rangees`) et les Tests qu'elle nomme (`tests`), que le moteur LIT
 * (`src/engine/reglesChiffrees.ts`) : #1173, commentaire 2.
 */
import { z } from 'zod';
import { nommerChamps } from '../grammaire/meta';
import { document } from '../grammaire/document';
import { difficultySchema, enumNomme, palierSchema, sourceRefSchema } from '../grammaire/valeurs';
import { listeCle } from '../grammaire/collection-cle';
import { flowTestSchema, porteurDeTestFixe } from '../grammaire/mecanique';

export const file = 'regles.json';
export const famille = 'entite';

/** Une rangée chiffrée : le PALIER que le livre nomme (« Accessible (+20) ») ou la VALEUR nue qu'il
 *  donne (« bonus de +20 »), jamais les deux. `famille` est celle de la `ModLine` émise (`LDB 14 l.48`) ;
 *  `seuil` fait de la rangée un PALIER (`palierSchema`) de la grandeur qui la sélectionne (cibles,
 *  attaquants), `plafond` en est le plafond (facteur de Portée d'une bande de tir). */
const rangeeSchema = nommerChamps(z.strictObject({
  id: z.string(),
  label: z.string().min(1),
  palier: difficultySchema.optional(),
  valeur: z.number().optional(),
  famille: enumNomme(
    { circonstance: 'Circonstance', jet: 'Jet' },
    { circonstance: 'Comptée dans le plafond des Difficultés (`LDB 14 l.48`)', jet: 'Hors plafond (`LDB 14 l.48`)' },
  ),
  ...palierSchema.partial().shape,
  plafond: z.number().optional(),
}).superRefine((r, ctx) => {
  if ((r.palier === undefined) === (r.valeur === undefined))
    ctx.addIssue({ code: 'custom', path: ['palier'], message: `rangée « ${r.id} » : exactement un de \`palier\` ou \`valeur\`.` });
}), {
  id: { label: 'Identifiant', texte: { regime: 'technique' } },
  label: { label: 'Libellé', texte: { regime: 'designation' } },
  palier: { label: 'Palier de Difficulté', hint: 'Le palier nommé par le livre ; le modificateur en dérive' },
  valeur: { label: 'Modificateur', hint: 'Le nombre nu donné par le livre, quand il ne nomme aucun palier' },
  famille: { label: 'Famille' },
  seuil: { label: 'Seuil', hint: 'Plancher de la grandeur qui sélectionne la rangée' },
  plafond: { label: 'Plafond', hint: 'Plafond de la grandeur qui sélectionne la rangée' },
});

/** Un Test que la règle NOMME, document embarqué : son libellé d'affichage, la ligne du livre qui le
 *  nomme, et la forme unique d'un jet en donnée (`flowTestSchema`), sous la clé que lit le moteur
 *  (`testDeRegle`, `TESTS_DE_REGLE`). Sa compétence et sa Difficulté sont exigées : le livre les nomme ; son
 *  libellé est UN, celui de l'entrée — `test.label` est refusé. */
const testDeRegleSchema = nommerChamps(porteurDeTestFixe(z.strictObject({
  id: z.string(),
  label: z.string().min(1),
  source: sourceRefSchema,
  test: flowTestSchema,
}).superRefine((t, ctx) => {
  if (t.test.label !== undefined)
    ctx.addIssue({ code: 'custom', path: ['test', 'label'], message: `test « ${t.id} » : le libellé est celui de l'entrée (\`label\`), pas du Test.` });
}), 'skill', 'difficulty'), {
  id: { label: 'Identifiant', texte: { regime: 'technique' } },
  label: { label: 'Libellé', texte: { regime: 'designation' } },
  source: { label: 'Source' },
  test: { label: 'Test' },
});

const doc = document(
  'regles',
  famille,
  {
    rangees: listeCle(rangeeSchema, 'id').optional(),
    tests: listeCle(testDeRegleSchema, 'id').optional(),
  },
  {
    rangees: { label: 'Valeurs chiffrées', hint: 'Les rangées que le livre chiffre, lues par le moteur' },
    tests: { label: 'Tests nommés', hint: 'Les Tests que la règle nomme, lus par le moteur' },
  },
  {
    codex: { keys: ['regles'] },
    edit: { none: 'exposé au Codex en LECTURE seule — aucune clé de `CodexEdit.CATEGORY_DATASET` ne le route vers un formulaire d’atelier', dataset: 'regles' },
  },
  {
    exiges: ['desc', 'source'],
    /** Une règle qui n'est qu'une ligne ou une case de table adresse le TABLEAU ENTIER : fiche
     *  `user-doctrine-regle-ligne-de-tableau-adresse-le-tableau-entier`, utilisateur, 2026-09-28 :
     *  « Le tableau entier (Recommandé) ». */
    fragmentsAdmis: ['blocs'],
    /** Un registre de RENVOIS au livre, sans prose : #1887, utilisateur, 2026-09-22 : « régles a pour but de
     *  faire référence aux endroits dans le livre qui concerne le modification/enjeu via un lien et non un
     *  texte verbatine comme aujourd'hui ». */
    porteursDeProse: ['descRef'],
  },
);

export const schema = doc.schema;
export const meta = doc.meta;

export const exposition = doc.exposition;

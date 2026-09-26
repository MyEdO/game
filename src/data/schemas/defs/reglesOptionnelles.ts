/**
 * Schéma de `reglesOptionnelles.json` — registre des RÈGLES OPTIONNELLES (« règles maison »), couche
 * PRÉSENTATION + BORNES en donnée : `id` STABLE (clé de surcharge, de persistance et de
 * `variants[].when.rule`), libellé/aide/groupe d'affichage, forme du contrôle auto-rendu (`kind`),
 * valeur par défaut et bornes de saisie. Lu par `src/engine/policy.ts` (types + `rule()`/`ruleDef()`),
 * rendu par le panneau in-game (`src/state/houseRules.ts` + `src/ui/HouseRulesModal.tsx`).
 *
 * `ref` = citation de la règle (même champ que `obsessions.json.ref`) : l'abréviation DOIT être un
 * `abbr` de `books.json` (garde `src/engine/policy-donnee.test.ts`), le reste est la localisation la
 * plus précise dont on dispose : `<ABRÉV> <ch> l.<ligne>`, ou le CHAPITRE seul quand le passage ne
 * chiffre rien à pointer (`LDB 18`, `LDB 65`…). La `ref` porte la RÉFÉRENCE, jamais de justification en prose : celle
 * d'une valeur que le RAW ne chiffre pas va dans `maison` (CLAUDE.md règle 7, même sémantique que
 * `castingNumberMod.maison`, `grammaire/valeurs.ts`) — 27 entrées ; `maison` et `source` sont des clés
 * d'ENVELOPPE, posées par la fabrique.
 * `source` = ancre `{book, page}` de la couverture par ENTRÉE : le folio IMPRIMÉ, relevé au marqueur
 * `data-folio` qui gouverne la ligne de la `ref` (#1318 E8) — jamais dérivé d'un calcul sur la ligne.
 * `action` : action de jeu rendue sous la rangée quand la règle vaut `when` — `icon` (registre
 * `src/ui/icons/`) et `run` (action du store) restent des `string` ici, liés par
 * `src/ui/rule-action-wiring.test.ts`.
 */
import { z } from 'zod';
import { bornesSchema, ecartDeCoPresenceDesBornes, enumNomme, ruleValueSchema } from '../grammaire/valeurs';
import { document } from '../grammaire/document';

export const file = 'reglesOptionnelles.json';
export const famille = 'entite';

const doc = document(
  'reglesOptionnelles',
  famille,
  {
    ref: z.string().min(1),
    group: z.string().min(1),
    kind: enumNomme({ flag: 'Interrupteur', param: 'Nombre', mode: 'Choix' }),
    default: ruleValueSchema,
    options: z.array(z.string()).min(2).optional(),
    ...bornesSchema.shape,
    hint: z.string().optional(),
    action: z
      .strictObject({
        when: ruleValueSchema,
        label: z.string().min(1),
        icon: z.string().min(1),
        run: z.string().min(1),
      })
      .optional(),
  },
  {
    ref: { label: 'Référence RAW (citation)', hint: 'Localisation la plus précise dont on dispose dans le livre cité' },
    group: { label: 'Groupe d’affichage', hint: 'Regroupement à l’écran des Règles optionnelles' },
    kind: {
      label: 'Forme du contrôle',
      hint: 'Interrupteur / paramètre chiffré / mode à choix',
    },
    default: { label: 'Valeur par défaut' },
    options: { label: 'Libellés des choix', hint: 'Pour une règle de type mode' },
    min: { label: 'Minimum réglable', hint: 'Borne basse de saisie du paramètre chiffré' },
    max: { label: 'Maximum réglable', hint: 'Borne haute de saisie du paramètre chiffré' },
    step: { label: 'Incrément de saisie' },
    hint: { label: 'Aide affichée', hint: 'Aide courte affichée sous le contrôle' },
    action: { label: 'Action liée', hint: 'Proposée sous la rangée quand la condition de déclenchement est remplie' },
  },
  {
    codex: { keys: ['reglesOptionnelles'] },
    edit: { dataset: 'reglesOptionnelles' },
  },
  {
    // Le refine du nœud `bornesSchema` ne traverse pas le spread de sa shape : la co-présence des
    // deux bornes se re-branche ICI, sur la MÊME fonction partagée (`ecartDeCoPresenceDesBornes`,
    // `grammaire/valeurs.ts`) — la règle n'a qu'un porteur.
    affinerEntree: (entree) =>
      entree.superRefine((v, ctx) => {
        const ecart = ecartDeCoPresenceDesBornes(v as { min?: number; max?: number });
        if (!ecart) return;
        ctx.addIssue({
          code: 'custom',
          path: [ecart.borne],
          message: `reglesOptionnelles.json : ${ecart.message}`,
        });
      }),
  },
);

export const schema = doc.schema;
export const meta = doc.meta;

export const exposition = doc.exposition;

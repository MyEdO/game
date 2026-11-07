/**
 * CHEMINS ADRESSÉS — la liste fermée des couples `(type, chemin)` qu'un `Porteur` (`./porteur.ts`) peut
 * désigner, comparée aux porteurs émis par le registre du Codex (`./registry.ts`). #1392
 *
 * Les chemins de PROJET sont la projection du registre des proses nommées
 * (`champsProseDeScene`, `src/data/schemas/grammaire/champs-prose-de-scene.ts`), puis celle des clés
 * d'enveloppe de chaque entrée EMBARQUÉE (`adressesDesEntreesEmbarquees`). Leur présence ne dit pas
 * que le rendu porte une identité de liage : le terrain est rendu sans porteur. PUR.
 */
import { champsProseDeScene } from '../../data/schemas/grammaire/champs-prose-de-scene';
import { adressesDesEntreesEmbarquees } from '../../data/schemas/grammaire/document';
import { projetSchema } from '../../data/schemas/defs-scenes/projet';

const CHEMINS_D_ENVELOPPE = ['desc', 'maison'] as const;

export const CHEMINS_ADRESSES: readonly { type: string; chemin: string }[] = [
  // Enveloppe de document : les deux clés de prose de toute entrée (`champsProse` + `maison`).
  ...CHEMINS_D_ENVELOPPE.map((chemin) => ({ type: '*', chemin })),
  // Champs de prose EN RANGÉE (émis avec leur porteur par `registry.ts`).
  { type: 'spells', chemin: 'ritual.type' },
  { type: 'spells', chemin: 'ritual.components' },
  { type: 'spells', chemin: 'ritual.conditions' },
  { type: 'spells', chemin: 'ritual.sacrifices' },
  { type: 'spells', chemin: 'ritual.consequences' },
  { type: 'activities', chemin: 'outcomes[].note' },
  { type: 'details', chemin: 'texts.age.bySpecies.<espèce>' },
  { type: 'details', chemin: 'texts.taille.bySpecies.<espèce>' },
  { type: 'details', chemin: 'texts.taille.all' },
  { type: 'details', chemin: 'texts.nom.bySpecies.<espèce>' },
  { type: 'characteristics', chemin: 'options[].desc' },
  { type: 'creatures', chemin: 'harvest.uses' },
  // Prose des documents de PROJET (scènes) — déclarée par la grammaire, pas ici.
  ...champsProseDeScene().map((chemin) => ({ type: 'projet', chemin })),
  ...adressesDesEntreesEmbarquees([projetSchema]).flatMap((a) => CHEMINS_D_ENVELOPPE.map((c) => ({ type: 'projet', chemin: `${a}.${c}` }))),
];

/**
 * PORTEUR d'une prose de PROJET (#2206) : `{ type: 'projet', id, chemin }` quand la partie porte un
 * document de projet (`CampaignDoc.projet`), `undefined` sinon. Un scénario de test n'a pas de
 * document : sa prose reste nue (`liage.ts`, note des restes de T0).
 *
 * Le chemin est CONCRET (`narratif.indices[3].stades[0].prose`) ; sa forme générique est celle de
 * `CHEMINS_ADRESSES`. Les index du narratif se lisent PAR ID dans `campaignDoc.narratif`, jamais dans
 * la couche runtime.
 */
import type { GameState } from '../state/store';
import type { CleDeRegistreNarratif } from '../data/schemas/defs-scenes/registres-narratifs';
import type { Porteur } from './liage';

/** Ce que lisent les porteurs de projet : le document de la partie. */
export type EtatDuProjet = Pick<GameState, 'campaignDoc'>;

/** Le porteur du champ `chemin` du document de projet de la partie ; `undefined` hors projet. */
export function porteurDeProjet(etat: EtatDuProjet, chemin: string): Porteur | undefined {
  const projet = etat.campaignDoc?.projet;
  return projet ? { type: 'projet', id: projet.id, chemin } : undefined;
}

/**
 * Le porteur du champ `suite` de l'entrée `id` du registre `cle` : `narratif.<cle>[<rang>].<suite>`,
 * le rang lu dans `campaignDoc.narratif`. `undefined` hors projet, ou quand l'entrée n'y figure pas.
 */
export function porteurDuNarratif(etat: EtatDuProjet, cle: CleDeRegistreNarratif, id: string, suite: string): Porteur | undefined {
  const doc = etat.campaignDoc;
  if (!doc?.projet) return undefined;
  const entrees: readonly { id: string }[] = doc.narratif[cle];
  const rang = entrees.findIndex((e) => e.id === id);
  return rang < 0 ? undefined : porteurDeProjet(etat, `narratif.${cle}[${rang}].${suite}`);
}

/**
 * PORTEUR d'une prose de PROJET (#2206) : `{ type: 'projet', id, chemin }` quand la partie porte un
 * document de projet (`CampaignDoc.projet`), `undefined` sinon. Un scénario de test n'a pas de
 * document : sa prose reste nue (`src/ui/liage.ts`, `SITES_PROSE`).
 *
 * Le chemin est CONCRET (`narratif.indices[3].stades[0].prose`) ; sa forme générique est celle de
 * `CHEMINS_ADRESSES`. Les index se lisent PAR ID dans `campaignDoc`, jamais dans la couche runtime.
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

/** Le porteur du champ `suite` de l'entrée `id` de la liste `cle` : `<cle>[<rang>].<suite>`. */
function porteurDeRang(etat: EtatDuProjet, cle: string, entrees: readonly { id: string }[], id: string, suite: string): Porteur | undefined {
  const rang = entrees.findIndex((e) => e.id === id);
  return rang < 0 ? undefined : porteurDeProjet(etat, `${cle}[${rang}].${suite}`);
}

/**
 * Le porteur du champ `suite` de l'entrée `id` du registre `cle` : `narratif.<cle>[<rang>].<suite>`,
 * le rang lu dans `campaignDoc.narratif`. `undefined` hors projet, ou quand l'entrée n'y figure pas.
 */
export function porteurDuNarratif(etat: EtatDuProjet, cle: CleDeRegistreNarratif, id: string, suite: string): Porteur | undefined {
  const doc = etat.campaignDoc;
  return doc?.projet ? porteurDeRang(etat, `narratif.${cle}`, doc.narratif[cle], id, suite) : undefined;
}

/**
 * Le porteur du champ `suite` de la scène `sceneId` : `scenes[<rang>].<suite>`, le rang lu dans
 * `campaignDoc.scenes`. `undefined` hors projet, ou quand la scène n'y figure pas.
 */
export function porteurDeScene(etat: EtatDuProjet, sceneId: string, suite: string): Porteur | undefined {
  const doc = etat.campaignDoc;
  return doc?.projet ? porteurDeRang(etat, 'scenes', doc.scenes, sceneId, suite) : undefined;
}

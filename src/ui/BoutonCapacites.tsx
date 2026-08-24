/**
 * OUVREUR de l'écran des capacités au RAIL D'OUTILS (spec HUD zone 6) — bouton MUET (même taille que
 * ses voisins, sans badge ni couleur, patron Rogue Trader), sous LA MÊME PORTE que la touche et que
 * le renvoi de la fiche (`state/ecranCapacitesPorte`).
 *
 * REFUSÉ, il le DIT : l'infobulle partagée (`CodexRef refus`) porte la raison au survol ET au focus,
 * et sa copie hors écran reste liée par `aria-describedby` — jamais un `title` natif (proscrit sur le
 * HUD), jamais un bouton `disabled` (l'attribut retirerait la raison du clavier, du doigt et du pad).
 * Le clic est INERTE tant que la porte refuse.
 *
 * FORME : celle de `GatedAction` (conteneur `.gated-action` — contrôle + sa raison en colonne, la
 * matière de la primitive), sans la composer : la primitive pose un `title` natif dès qu'on lui donne
 * un nom accessible, et le rail n'en veut pas ; elle ne transmet pas non plus la peau « tôle vissée »
 * (`data-skin`) qui fait l'unité des ouvreurs du rail. Le jour où l'une des deux tombe, ce composant
 * devient un appel à `GatedAction`.
 *
 * Composant à part (et non du JSX inline dans `CampaignView`) : c'est CE contrat-là qui se mesure au
 * DOM (`BoutonCapacites.test.tsx`) — l'écran de jeu entier n'est pas montable en test.
 */
import { useGame } from '../state/store';
import { refusEcranCapacites } from '../state/ecranCapacitesPorte';
import { CodexRef } from './compendium/CodexRef';
import { Icon } from './Icon';

export function BoutonCapacites() {
  const refus = useGame(refusEcranCapacites);
  const setEcranCapacites = useGame((s) => s.setEcranCapacites);
  return (
    <div className="gated-action">
      <CodexRef label="Capacités" refus={refus} wrap>
        <button
          type="button"
          className="worldmap-btn"
          data-skin="tole"
          data-ecran="capacites"
          aria-label="Capacités (K)"
          aria-disabled={refus ? true : undefined}
          aria-describedby={refus ? 'rail-capacites-refus' : undefined}
          onClick={() => { if (!refus) setEcranCapacites(true); }}
        >
          <Icon id="nav/compendium" size="lg" />
        </button>
      </CodexRef>
      {refus ? <span className="hors-ecran" id="rail-capacites-refus">{refus}</span> : null}
    </div>
  );
}

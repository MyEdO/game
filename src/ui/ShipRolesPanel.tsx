import { useGame } from '../state/store';
import { crewRoles } from '../data';
import { crewRoleAsPoste, reposAsPoste } from '../state/poste';
import { PostesRoster } from './PostesRoster';
import type { Combatant } from '../engine/types';
import { estEnRencontre } from '../engine/conditions';

/** Les 9 rôles que MDG 14 NOMME, plus la ligne « Repos » (valeur réelle de `shipRole`, hors
 *  catalogue — cf. `reposAsPoste`). Ordre du catalogue, la ligne synthétique en dernier. */
export const postesEquipage = () => [...crewRoles.map(crewRoleAsPoste), reposAsPoste()];

/**
 * Postes d'équipage naval (MDG 14) — surface UNIQUE, montée à l'appareillage (carte du monde) ET au
 * dossier de navire (`PosteSheet`, onglet Manœuvre), qui lui passe l'équipage de la coque.
 *
 * Le roster n'affiche QUE l'ÉPINGLAGE (arbitrage user 2026-09-04) : ce qui n'est pas épinglé descend
 * au banc « À la discrétion du Test », car c'est LITTÉRALEMENT ce qui se passe — `shipDefaultRoles`
 * (`state/shipCrew`) affecte l'équipage AU MOMENT du Test, selon le TYPE de Test joué (10 types, 5
 * rôles chacun, rôle essentiel différent) ; la modale du Test montre alors l'affectation retenue,
 * sa valeur et son ★. Deviner ici aurait affiché un rôle que le Test n'aurait pas forcément retenu.
 */
export function ShipRolesPanel({ crew, onSet }: {
  /** Équipage montré — absent = le GROUPE (carte du monde) ; fourni = l'équipage de la coque (dossier). */
  crew?: Combatant[];
  onSet?: (heroId: string, role: string | null) => void;
} = {}) {
  const party = useGame((s) => s.party);
  const setShipRole = useGame((s) => s.setShipRole);
  const heroes = crew ?? party.filter((h) => estEnRencontre(h) && h.kind === 'hero');
  return (
    <PostesRoster
      title="Postes d’équipage"
      banc="À la discrétion du Test"
      heroes={heroes}
      postes={postesEquipage()}
      pinnedOf={(h) => h.shipRole}
      onSet={onSet ?? setShipRole}
      codexCategory="crewRoles"
    />
  );
}

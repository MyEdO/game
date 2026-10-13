import type { Combatant } from '../engine/types';
import { type Poste, postesOccupes } from '../state/poste';
import { AssignRow, type ParametreAffectation } from './AssignRow';
import { CodexRef } from './compendium/CodexRef';

/**
 * Décision d'épinglage au clic d'un poste (PUR, testable sans DOM) : re-cliquer le poste ÉPINGLÉ le
 * détache (→ `null`) ; cliquer un autre poste l'épingle. Source unique de la sémantique clic→`onSet`.
 */
export function nextPinned(pinned: string | undefined, clickedPosteId: string): string | null {
  return pinned === clickedPosteId ? null : clickedPosteId;
}

/**
 * ROSTER PAR POSTE — surface partagée UNIQUE de « qui tient quoi » : rôles de marche (EDOC 8), postes
 * d'équipage (MDG 14, carte du monde ET dossier de navire) et stations à bord (MDG 13). Une LIGNE par
 * poste, dans l'ORDRE DU CATALOGUE, toutes présentes même vides ; les personnes sont des portraits
 * DANS la case du poste (maquette A validée par l'utilisateur le 2026-09-04).
 *
 * LE ROSTER N'AFFICHE QUE L'ÉPINGLAGE (arbitrage user 2026-09-04, « Épinglé seul + "Repos" explicite ») :
 * aucune inférence n'est montrée, donc aucun marqueur « auto », et RIEN NE GLISSE — retirer un portrait
 * le DÉSÉPINGLE (`onSet(h, null)`) et il descend au BANC, sans sauter sur une ligne devinée. L'inférence
 * n'a pas disparu du jeu : elle reste la SEULE affaire des résolveurs (`shipDefaultRoles` pour les Tests
 * d'équipage, `stageAssignmentFromRoles` pour l'Étape de voyage), et le Test qui la joue montre son
 * affectation et son rôle essentiel dans SA modale. L'écran d'assignation ne devine plus à sa place.
 *
 * Le BANC naît de la MESURE (`postesOccupes`, PURE) : les personnes qu'aucune ligne ne porte. Il est
 * une ligne du roster comme les autres — présente même vide (rien ne glisse), sans un mot quand elle
 * l'est. Composition PURE de primitives : `AssignRow` (cases + `[ + ]` en panneau-paramètre borné),
 * `CodexRef` (le ⓘ qui remplace l'infobulle native), `GatedAction` via `AssignRow` (poste fermé).
 */
export function PostesRoster({
  title, banc, heroes, postes, pinnedOf, onSet, refusOf, refusCandidat, parametreDe, precisionDe, codexCategory,
}: {
  title: string;
  /** Libellé de la ligne de BANC (« À la discrétion du Test », « Sans station ») — il dit ce qui
   *  décide À LA PLACE du joueur pour ces personnes, et c'est propre à chaque roster. */
  banc: string;
  heroes: Combatant[];
  postes: Poste[];
  /** Poste ÉPINGLÉ par le joueur — la SEULE chose que le roster affiche. */
  pinnedOf: (h: Combatant) => string | undefined;
  /** Épingle (`posteId`) ou déséping le (`null`) le poste d'un héros ; `parametre` = clé de la valeur
   *  choisie quand le poste en demande une (`parametreDe`). */
  onSet: (heroId: string, posteId: string | null, parametre?: string) => void;
  /** RAISON pour laquelle ce poste n'est pas tenable ICI (une station que la coque n'a pas) — le poste
   *  reste OFFERT, éteint, et dit pourquoi au survol/focus/tap. Jamais un filtrage silencieux : un
   *  poste qui disparaît ne s'explique pas. */
  refusOf?: (poste: Poste) => string | undefined;
  /** RAISON pour laquelle CE héros ne peut pas tenir CE poste (un Test CHOISI qu'il ne peut pas tenter,
   *  LDB 09 l.30) : le candidat reste offert au panneau, éteint, et dit pourquoi. */
  refusCandidat?: (poste: Poste, h: Combatant) => string | undefined;
  /** PARAMÈTRE que CE héros doit fixer pour tenir CE poste (la Compétence de Pratiquer une Compétence,
   *  EDOC 8) : un second panneau-paramètre, chaque valeur fermée avec sa raison. */
  parametreDe?: (poste: Poste, h: Combatant) => { intitule: string; valeurs: ParametreAffectation[] } | undefined;
  /** PRÉCISION du poste épinglé d'un héros (sa Compétence pratiquée) : son libellé, ajouté à sa méta et à
   *  son nom de retrait, et son entrée Codex, AFFICHÉE dans la case à côté de son portrait. */
  precisionDe?: (h: Combatant) => { label: string; category: string; id: string } | undefined;
  /** Catégorie Codex des postes de ce roster (`crewRoles`, `shipStations`, `activities`) : le LIBELLÉ
   *  de chaque ligne ouvre SA fiche. Une ligne sans entrée (Repos, banc) reste du texte simple. */
  codexCategory: string;
}) {
  if (!heroes.length) return null;
  const { parPoste, sansPoste } = postesOccupes(heroes, postes, (h) => pinnedOf(h));
  const ligne = (cle: string, label: string, occupants: Combatant[], p?: Poste) => {
    const refus = p ? refusOf?.(p) : undefined;
    return (
      <div className="pr-ligne" key={cle} data-poste={cle}>
        <span className="pr-label">
          {/* Le LIBELLÉ est lui-même la porte du Codex (`CodexRef` sans `wrap` : le texte EST le
              déclencheur, popover au survol ET au focus) — jamais un ⓘ accolé, affordance parallèle
              proscrite par le cliquet #1078, et jamais un `title` natif. Sans entrée au catalogue
              (ligne synthétique Repos, banc) il retombe en texte simple, sans rien perdre. */}
          {p ? <CodexRef category={codexCategory} id={p.id} label={label} /> : label}
        </span>
        {/* Le BANC est un CONSTAT, pas une case d'affectation : ces personnes ne tiennent aucun poste,
            il n'y a donc ni ajout ni retrait (`canPick`/`retirable` faux sans `p`) — ses portraits sont
            décoratifs et la ligne ne promet aucun geste. */}
        <AssignRow
          assigned={occupants}
          candidates={p ? heroes.filter((h) => pinnedOf(h) !== p.id) : []}
          onAssign={(id, parametre) => onSet(id, p ? nextPinned(pinnedOf(heroes.find((h) => h.id === id)!), p.id) : null, parametre)}
          onRemove={(id) => onSet(id, null)}
          intitule={`${title} — ${label} : affecter`}
          nomRetirer={(c) => { const pr = precisionDe?.(c); return `Retirer ${c.label} de ${label}${pr ? ` (${pr.label})` : ''}`; }}
          canPick={p != null}
          retirable={p != null}
          metaDe={(c) => { const cur = pinnedOf(c); const cp = cur ? postes.find((x) => x.id === cur) : undefined; const pr = precisionDe?.(c); return cp ? `(${cp.label}${pr ? ` — ${pr.label}` : ''})` : undefined; }}
          precisionDe={(c) => { const pr = precisionDe?.(c); return pr ? <CodexRef category={pr.category} id={pr.id} label={pr.label} className="pr-precision" /> : undefined; }}
          {...(refus ? { refus } : {})}
          {...(p && refusCandidat ? { refusDe: (c: Combatant) => refusCandidat(p, c) } : {})}
          {...(p && parametreDe ? { parametreDe: (c: Combatant) => parametreDe(p, c) } : {})}
        />
      </div>
    );
  };
  return (
    <div className="pr-roster">
      <span className="mini-title">{title}</span>
      {postes.map((p) => ligne(p.id, p.label, parPoste.get(p.id) ?? [], p))}
      <div className="pr-banc">{ligne('__banc', banc, sansPoste)}</div>
    </div>
  );
}

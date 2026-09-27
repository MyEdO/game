/**
 * POSTE — modèle-VUE UNIQUE de l'assignation « affecter des personnes à un poste/rôle », projeté depuis
 * les catalogues de données existants (les `.json` restent séparés, on ne recopie rien). Sert la surface
 * poste-first (`PostesRoster`) : les Activités de voyage (EDOC 8), les rôles d'équipage (MDG 14) et les
 * stations à bord (MDG 13) partagent le MÊME type-vue.
 *
 * FRONTIÈRE : ceci ne décrit QUE l'assignation. La RÉSOLUTION (jets individuels du voyage vs Tests
 * d'équipage mutualisés) reste dans ses modules dédiés (`engine/activities`, `state/shipCrew`) — un Poste
 * ne fait qu'exposer l'identité assignable, jamais la mécanique de résolution. PUR.
 */
import type { RefDesignee } from '../data/schemas/grammaire/ref';
import type { ActivityDef } from '../engine/activities';
import type { Combatant } from '../engine/types';
import type { CrewRoleData, ShipStationData } from '../data';
import { BENCHED } from './shipCrew';

/** Identité assignable commune : ce qu'il faut pour NOMMER une ligne et l'ouvrir au Codex. L'`icon` est
 *  optionnelle (absente pour un rôle d'équipage). `skills` est la Compétence que le poste met en jeu,
 *  lue par les RÉSOLVEURS (`crewRoleValue`, `stageAssignmentFromRoles`) — jamais par le roster, qui
 *  n'affiche que l'ÉPINGLAGE du joueur. La PROSE n'est pas ici : le libellé de chaque ligne est un
 *  déclencheur `CodexRef` qui rend le verbatim depuis le catalogue, par id. */
export interface Poste {
  id: string;
  label: string;
  icon?: string;
  skills: RefDesignee[];
}

/** Activité de voyage (`activitiesFor('voyage')`) → Poste. */
export function activityAsPoste(def: ActivityDef): Poste {
  return { id: def.id, label: def.label, icon: def.icon, skills: def.skills ?? [] };
}

/** Station à bord (`shipStations` — `MDG 13 l.680/l.714/l.730/l.751`, `MSRC 07 l.78/l.82/l.94`) →
 *  Poste. Aucune Compétence ne la qualifie (le livre demande qui s'y TROUVE, pas qui sait y servir),
 *  donc `skills` reste vide. */
export function stationAsPoste(s: ShipStationData): Poste {
  return { id: s.id, label: s.label, skills: [] };
}

/** Rôle d'équipage (`crewRoles`, MDG 14) → Poste ; pas d'icône. */
export function crewRoleAsPoste(r: CrewRoleData): Poste {
  return { id: r.id, label: r.label, skills: r.skills };
}

/**
 * REPOS — poste SYNTHÉTIQUE, hors catalogue : `crew-roles.json` porte les 9 rôles que MDG 14 NOMME, et
 * « au repos » n'en est pas un (règle 1 — on n'ajoute pas une entrée au dataset d'un livre). C'est
 * pourtant une valeur RÉELLE du champ `Combatant.shipRole`, que `shipDefaultRoles` (`shipCrew.ts`)
 * respecte comme un épinglage : elle a donc sa LIGNE au roster, épinglable comme un poste. Son id
 * vient de `BENCHED` — source unique de la valeur. `skills` vide : aucun Test ne recrute au repos.
 */
export function reposAsPoste(): Poste {
  return { id: BENCHED, label: 'Repos', skills: [] };
}

/**
 * INVERSION héros→poste : de « quel poste tient ce héros » vers « qui tient ce poste ». PURE (aucun
 * DOM, aucun store) — c'est le calcul que rend le roster poste-first, et le BANC en naît par la
 * MESURE : un héros dont `posteOf` rend `null` n'est sur aucune ligne, donc il est au banc. Les
 * lignes suivent l'ORDRE DU CATALOGUE et sont TOUTES présentes, même vides (rien ne glisse). Un
 * `posteOf` qui désigne un poste hors `postes` laisse son porteur au banc plutôt que de le perdre.
 */
export function postesOccupes(
  heroes: Combatant[],
  postes: Poste[],
  posteOf: (h: Combatant) => string | null | undefined,
): { parPoste: Map<string, Combatant[]>; sansPoste: Combatant[] } {
  const parPoste = new Map<string, Combatant[]>(postes.map((p) => [p.id, []]));
  const sansPoste: Combatant[] = [];
  for (const h of heroes) {
    const id = posteOf(h) ?? null;
    const ligne = id != null ? parPoste.get(id) : undefined;
    if (ligne) ligne.push(h);
    else sansPoste.push(h);
  }
  return { parPoste, sansPoste };
}

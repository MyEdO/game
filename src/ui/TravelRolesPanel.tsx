import { useGame } from '../state/store';
import { activitiesFor, activityById, competencesAPratiquer, posteEpingle, refusCandidatActivite } from '../engine/activities';
import type { RefDesignee } from '../data/schemas/grammaire/ref';
import { refLabel } from '../data';
import { activityAsPoste } from '../state/poste';
import { PostesRoster } from './PostesRoster';
import { estEnRencontre } from '../engine/conditions';

/**
 * Wrapper store des Rôles de marche (Voyage par Étapes, EDOC 8) : projette les Activités de voyage
 * en Postes (`activityAsPoste`) et relie le store à la surface roster PARTAGÉE `PostesRoster` (fini le
 * `*View` dupliqué du pendant maritime). Rendu SOUS la règle « Voyage par Étapes » (gating au point
 * d'appel, `WorldMapView`).
 *
 * Comme les deux rosters navals, il n'affiche QUE l'ÉPINGLAGE : `defaultTravelRole` n'est pas mort —
 * il EST la résolution (`stageAssignmentFromRoles`, `engine/activities`, lu par `travelFlow`), et c'est
 * l'Étape qui montre l'Activité réellement tenue. Le banc dit donc qui la laisse décider.
 *
 * Le poste est un Test CHOISI (EDOC 8 l.131) : un héros qui n'en peut tenter aucune compétence y reste
 * candidat, FERMÉ avec sa raison (`refusCandidatActivite`, LDB 09 l.30 ; #2588). Une Activité à
 * compétence LIBRE (Pratiquer une Compétence) demande la Compétence par un second panneau-paramètre
 * (`competencesAPratiquer`), chacune fermée avec son refus s'il ne peut pas la tenter ; l'affectation ne
 * part qu'avec elle, et la case affiche la Compétence épinglée.
 */
/** Clé d'une Compétence au panneau-paramètre, et son retour en référence. */
const cleDe = (ref: RefDesignee): string => (ref.spec ? `${ref.id}:${ref.spec}` : ref.id);
const refDe = (cle: string): RefDesignee => {
  const i = cle.indexOf(':');
  return i < 0 ? { id: cle } : { id: cle.slice(0, i), spec: cle.slice(i + 1) };
};

export function TravelRolesPanel() {
  const party = useGame((s) => s.party);
  const setTravelRole = useGame((s) => s.setTravelRole);
  const heroes = party.filter((h) => estEnRencontre(h) && h.kind === 'hero');
  return (
    <PostesRoster
      title="Rôles de marche"
      banc="À la discrétion de l’Étape"
      heroes={heroes}
      postes={activitiesFor('voyage').map(activityAsPoste)}
      pinnedOf={(h) => posteEpingle(h)?.activityId}
      onSet={(heroId, posteId, parametre) => setTravelRole(heroId, posteId ? { activityId: posteId, ...(parametre ? { freeSkill: refDe(parametre) } : {}) } : null)}
      refusCandidat={(p, h) => { const def = activityById(p.id); return def ? refusCandidatActivite(h, def) : undefined; }}
      parametreDe={(p, h) => { const def = activityById(p.id); return def?.freeSkill
        ? { intitule: `${p.label} — ${h.label} : quelle Compétence ?`, valeurs: competencesAPratiquer(h, def).map((v) => ({ key: cleDe(v.ref), label: refLabel('skills', v.ref), ...(v.refus ? { refus: v.refus } : {}) })) }
        : undefined; }}
      precisionDe={(h) => { const libre = posteEpingle(h)?.freeSkill; return libre ? { label: refLabel('skills', libre), category: 'skills', id: libre.id } : undefined; }}
      codexCategory="activities"
    />
  );
}

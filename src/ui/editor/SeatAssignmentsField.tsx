/**
 * Champ d'AUTHORING des places assises d'un décor (`Scene.seatAssignments`) — une rangée par place
 * déclarée par le type de meuble, dans l'ordre du catalogue.
 *
 * ID-ONLY : chaque place se remplit par un `<select>` dont les valeurs sont des ids d'entités de la
 * scène (le libellé n'est que de l'affichage) ; aucune saisie libre, aucun nom tapé à la main.
 *
 * Côté groupe, la liste est FIXE — « Héros 1 » … « Héros N » (N = `PARTY_MAX`) : on authore un
 * EMPLACEMENT, jamais un personnage. Un document ne peut pas nommer un héros que le joueur créera
 * plus tard ; au chargement, un emplacement que le groupe n'atteint pas s'élague simplement.
 *
 * ATOMIQUE : le geste passe par `seatOccupant`/`releaseSeat`, qui posent la `pos` du corps sur l'abord
 * résolu de sa place ; un refus se dit en toutes lettres et n'écrit rien.
 */
import { useState } from 'react';
import type { Scene } from '../../state/scene';
import { PARTY_MAX } from '../../state/combatants';
import { labelEmplacement, releaseSeat, seatSlotsOf, type SeatAssignmentResult, type SeatOccupant } from '../../state/seating';
import { normaliseAssises, seatOccupant } from '../../state/sceneEdit';
import { ChipDeRefus } from '../ChipDeRefus';

/** Motif de refus d'`assignSeat`, dit à l'auteur. Chaque libellé énonce le fait MESURÉ par la raison
 *  qu'il traduit — `occupant-absent` ne peut désigner qu'un corps que la scène ne porte pas (les héros
 *  proposés sont les emplacements FIXES du groupe). */
const REFUS: Record<Exclude<SeatAssignmentResult, { ok: true }>['reason'], string> = {
  'prop-absent': 'ce décor n’est plus dans la scène',
  'slot-absent': 'ce type de décor n’offre pas cette place',
  'occupant-absent': 'ce corps n’est ni un personnage de la scène ni un emplacement du groupe',
  'occupant-assis': 'ce corps tient déjà une autre place',
  'slot-occupe': 'cette place est déjà tenue',
  'approche-invalide': 'aucun abord praticable ne dessert cette place',
};

/** Valeur de `<select>` d'un occupant : préfixée par sa NATURE, pour qu'un rang de groupe et un id
 *  d'entité ne se confondent jamais. */
const valueOf = (occupant: SeatOccupant): string =>
  occupant.kind === 'party' ? `party:${occupant.rang}` : `entity:${occupant.entityId}`;

const occupantOf = (value: string): SeatOccupant =>
  value.startsWith('party:') ? { kind: 'party', rang: Number(value.slice(6)) } : { kind: 'entity', entityId: value.slice(7) };

/** Les emplacements du groupe, dans l'ordre — liste FIXE, indépendante du document et de la partie. */
const EMPLACEMENTS = Array.from({ length: PARTY_MAX }, (_, i) => i + 1);

export function SeatAssignmentsField({
  scene,
  propId,
  onChange,
}: {
  scene: Scene;
  propId: string;
  onChange: (scene: Scene) => void;
}) {
  const [refus, setRefus] = useState<string | null>(null);
  const places = seatSlotsOf(scene, propId);
  if (!places.length) return null;

  const parMeuble = scene.seatAssignments?.[propId] ?? {};
  const pnjs = scene.entities.filter((e) => e.kind === 'personnage');

  const choisir = (slotId: string, value: string) => {
    setRefus(null);
    const tenant = parMeuble[slotId];
    if (!value) {
      // « — personne — » sur une place DÉJÀ vide ne publie rien : un cran d'undo à vide se paie au
      // clavier de l'auteur, qui doit défaire deux fois pour revenir sur son geste précédent.
      if (tenant) onChange(normaliseAssises(releaseSeat(scene, tenant), PARTY_MAX));
      return;
    }
    const occupant = occupantOf(value);
    // Un corps, une place : libérer le tenant de la place VISÉE et l'ancienne place du corps CHOISI
    // fait partie du MÊME geste — la scène n'est publiée qu'une fois, et seulement si elle est prise.
    let base = tenant ? releaseSeat(scene, tenant) : scene;
    base = releaseSeat(base, occupant);
    const res = seatOccupant(base, propId, slotId, occupant, PARTY_MAX);
    if (!res.ok) { setRefus(REFUS[res.reason]); return; }
    onChange(res.scene);
  };

  return (
    <div className="ed-field">
      <span className="mini-title">
        Places assises — {places.length} place{places.length > 1 ? 's' : ''}
      </span>
      {places.map((place) => (
        <label className="ed-field" key={place.slotId}>
          {place.slotId}
          <select value={parMeuble[place.slotId] ? valueOf(parMeuble[place.slotId]) : ''} onChange={(e) => choisir(place.slotId, e.target.value)}>
            <option value="">— personne —</option>
            {pnjs.map((pnj) => (
              <option key={pnj.id} value={`entity:${pnj.id}`}>
                {pnj.label ? `${pnj.label} (${pnj.id})` : pnj.id}
              </option>
            ))}
            {EMPLACEMENTS.map((rang) => (
              <option key={rang} value={`party:${rang}`}>
                {labelEmplacement(rang)}
              </option>
            ))}
          </select>
        </label>
      ))}
      <p className="hint">
        Le corps assis se tient sur l’abord de sa place : sa position suit le meuble, elle ne se pose pas à la main.
        Un « Héros N » désigne l’EMPLACEMENT N du groupe, jamais un personnage : si la partie n’a pas
        tant de héros, la place se libère au chargement.
      </p>
      {refus && <ChipDeRefus refus={{ message: `Place refusée : ${refus}.` }} />}
    </div>
  );
}

import { useGame } from '../state/store';
import { shipStations, findShipStation, findNavalTrait } from '../data';
import { stationAsPoste } from '../state/poste';
import { shipStationOuverte } from '../engine/shipCritical';
import type { NavalTraitRef } from '../engine/types';
import { PostesRoster } from './console/PostesRoster';

/**
 * Wrapper store des STATIONS à bord (`MDG 13 l.680/l.714/l.730/l.751`, `MSRC 07 l.78/l.82/l.94`) :
 * projette le catalogue `ship-stations.json` en Postes (`stationAsPoste`) et relie le store à la
 * surface roster PARTAGÉE `PostesRoster` — jumeau exact de `ShipRolesPanel`, empilé sous lui à
 * l'appareillage (maquette validée 2026-09-04,
 * `.claude/memory/user-arbitrage-stations-a-bord-deux-rosters-empiles.md`). Rendu partout où un
 * bateau porte l'équipage (mer ET fleuve), gating au point d'appel (`WorldMapView`).
 *
 * AUCUNE inférence : la station est ce que le joueur a ÉPINGLÉ (`Combatant.shipStation`), sans
 * défaut — un héros non posté n'est visé par aucune présence, et le journal le dit. Le roster entier
 * suit désormais cette règle (arbitrage user 2026-09-04) : les stations n'y sont plus l'exception.
 *
 * Une station que la coque n'a pas (`requiresTrait`) reste OFFERTE et éteinte, sa raison au
 * survol/focus/tap : le gate est celui du moteur (`shipStationOuverte`), jamais une copie d'écran.
 */
export function ShipStationsPanel({ traits }: {
  /** Réfs navales de la coque qui porte l'équipage — `vesselNavalTraits` (navire de campagne en mer)
   *  ou `navalTraitsDe` (bateau du trajet fluvial). L'écran sait QUELLE coque ; le panneau ne le devine pas. */
  traits: NavalTraitRef[];
}) {
  const party = useGame((s) => s.party);
  const setShipStation = useGame((s) => s.setShipStation);
  const heroes = party.filter((h) => !h.dead && !h.outOfRencontre && h.kind === 'hero');
  return (
    <PostesRoster
      title="Stations à bord"
      banc="Sans station"
      heroes={heroes}
      postes={shipStations.map(stationAsPoste)}
      pinnedOf={(h) => h.shipStation}
      onSet={setShipStation}
      codexCategory="shipStations"
      refusOf={(p) => {
        if (shipStationOuverte(traits, p.id)) return undefined;
        const requis = findShipStation(p.id)?.requiresTrait?.id;
        return `Ce bateau ne porte pas « ${(requis && findNavalTrait(requis)?.label) ?? requis} ».`;
      }}
    />
  );
}

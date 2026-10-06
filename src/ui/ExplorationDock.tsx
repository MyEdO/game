import type { ReactNode } from 'react';
import { Icon } from './Icon';
import { t } from '../i18n';
import type { IconIdInput } from './icons';

/**
 * PONT D'EXPLORATION — le pendant ALLÉGÉ de `CombatConsole` hors combat (spec
 * `docs/plans/2026-08-16-spec-hud-combat.md` § « Zone 11 »). UNE bande de bord à bord, même matière
 * et même liseré que le pont de combat (tokens `--cc-*`), à hauteur d'une rangée d'icônes : la
 * transition combat↔exploration change le CONTENU du pont, jamais son existence.
 *
 * Extrémité DROITE = la rangée d'icônes-écrans, tiroir-journal compris (§1c-ter : une plaque unique,
 * jamais des éléments épars — hors combat le rail d'outils ne se rend pas). Les ÉTATS d'ouverture
 * (dossier, carnet, hub…) restent chez `CampaignView` : ici, une entrée est OFFERTE quand son rappel
 * est fourni — la condition d'apparition vit au call site, jamais dupliquée.
 *
 * Extrémité GAUCHE = les GESTES du groupe (« Fouiller la pièce »), un groupe NOMMÉ distinct des écrans :
 * le pont est la barre d'ACTION hors combat (spec § « LE PONT UNIFIÉ », 2026-08-17 — les ouvreurs
 * d'écrans restent l'extrémité droite), et un geste qui joue le monde n'ouvre aucun écran.
 *
 * Les entrées portent la peau PARTAGÉE « tôle vissée » (`skin-tole` + `data-ton="laiton"`,
 * components.css) : le pont est une plaque, pas une barre de panneaux — et aucune propriété de
 * bouton n'est réécrite depuis la feuille de cet écran.
 */
export type ExplorationDockProps = {
  /** Possessions du groupe (#762) — gestion des bêtes/véhicules/navires/serviteurs. */
  onPossessions: () => void;
  /** Carnet d'enquête (#670) — `nouveau` : un indice a changé depuis le dernier affichage (#2415). */
  carnet?: { onOpen: () => void; nouveau: boolean };
  /** Dossier du navire (#227). */
  onShipDossier?: () => void;
  /** Écran-hub de voyage RÉDUIT (#333) : le rouvrir. */
  onVoyage?: () => void;
  /** Carte du monde (#T2) — `interrupted` : un voyage attend sa reprise. */
  worldMap?: { onOpen: () => void; interrupted: boolean };
  /** Hub de ville (#343) : le lieu courant porte son libellé et son icône. */
  hub?: { label: string; icon: IconIdInput; onOpen: () => void };
  /** Dormir/camper hors lieu — le `title` porte la nuance (auberge / chez soi / belle étoile). */
  rest?: { title: string; onOpen: () => void };
  /** Fouiller la pièce où se tient le groupe (`fouillerLaPiece`) — offert DANS une pièce. */
  onFouiller?: () => void;
  /** Tiroir-journal (`LogDrawer`) : DERNIÈRE entrée de la rangée hors combat. */
  journal?: ReactNode;
};

export function ExplorationDock({ onPossessions, carnet, onShipDossier, onVoyage, worldMap, hub, rest, onFouiller, journal }: ExplorationDockProps) {
  return (
    <div className="exploration-dock skin-pont" data-deck="exploration">
      {onFouiller && (
        <div className="xd-openers" data-bord="gauche" role="group" aria-label={t('pont.gestes')}>
          <button type="button" className="worldmap-btn skin-tole" data-ton="laiton" onClick={onFouiller} title={t('fouille.geste')}>
            <Icon id="ui/search" size="lg" />
          </button>
        </div>
      )}
      <div className="xd-openers" aria-label={t('pont.ecrans')}>
        <button type="button" className="worldmap-btn skin-tole" data-ton="laiton" onClick={onPossessions} title={t('pont.possessions')}>
          <Icon id="travel/mount" size="lg" />
        </button>
        {carnet && (
          <button
            type="button"
            className={`worldmap-btn skin-tole ${carnet.nouveau ? 'attention' : ''}`}
            data-ton="laiton"
            onClick={carnet.onOpen}
            title={t(carnet.nouveau ? 'pont.carnetNouveau' : 'pont.carnet')}
          >
            <Icon id="nav/carnet" size="lg" />
          </button>
        )}
        {onShipDossier && (
          <button type="button" className="worldmap-btn skin-tole" data-ton="laiton" onClick={onShipDossier} title={t('pont.dossierNavire')}>
            <Icon id="travel/sail-ship" size="lg" />
          </button>
        )}
        {onVoyage && (
          <button type="button" className="worldmap-btn skin-tole" data-ton="laiton" onClick={onVoyage} title={t('pont.voyage')}>
            <Icon id="travel/sail-ship" size="lg" />
          </button>
        )}
        {worldMap && (
          <button
            type="button"
            className={`worldmap-btn skin-tole ${worldMap.interrupted ? 'attention' : ''}`}
            data-ton="laiton"
            onClick={worldMap.onOpen}
            title={t(worldMap.interrupted ? 'pont.carteInterrompue' : 'pont.carte')}
          >
            <Icon id="nav/campaign" size="lg" />
          </button>
        )}
        {hub && (
          <button type="button" className="worldmap-btn skin-tole" data-ton="laiton" onClick={hub.onOpen} title={t('pont.hub', { lieu: hub.label })}>
            <Icon id={hub.icon} size="lg" />
          </button>
        )}
        {rest && (
          <button type="button" className="worldmap-btn skin-tole" data-ton="laiton" onClick={rest.onOpen} title={rest.title}>
            {/* Une seule icône Repos (auberge/chez soi/camp) — le `title` porte la nuance. */}
            <Icon id="nav/rest" size="lg" />
          </button>
        )}
        {journal}
      </div>
    </div>
  );
}

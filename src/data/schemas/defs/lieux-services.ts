/**
 * Schéma de `lieux-services.json` — vocabulaire des SERVICES de lieu (#343) EXTENSIBLES par catalogue
 * (patron `naval-ports.json`), au-delà du port et du marché qui portent leur propre schéma riche
 * (`MapPlace.port`/`MapPlace.market`). Consommé par référence (`MapPlace.services[].kind`) et résolu
 * par `placeServices` (`src/noyau/worldMap.ts`) : id STABLE → libellé/icône d'affichage. Vocabulaire
 * app-interne de routage d'écran (id/label/icône), aucune mécanique RAW à sourcer par entrée
 * (cf. `EXEMPT_DATASETS`, `scripts/guards/lib/citationCoverage.mjs`).
 */
import { z } from 'zod';
import { document } from '../grammaire/document';

export const file = 'lieux-services.json';
export const famille = 'entite';

const doc = document(
  'lieux-services',
  famille,
  {
    /** Réplique de boniment (donnée d'auteur, saveur maison — pas de RAW à sourcer) affichée par le
     *  bandeau d'interlocuteur statique (`SpeakerBanner` variant `boniment`) du service. */
    hostLine: z.string().optional(),
    /** Bande d'ambiance par défaut du service (id du registre `src/ui/backdrops`). */
    backdrop: z.string().optional(),
    /** Archétype marchand ouvert par ce service (`src/data/merchants.json`, ex. `armurier` pour
     *  le forgeron) — routage vers le système marchand EXISTANT via `openPlaceMerchant`, aucune donnée
     *  de commerce dupliquée ici (#369). */
    merchantArchetype: z.string().optional(),
    /** Écran plein-champ EXISTANT vers lequel ce service PORTE (routage app-interne, #369) : `port` =
     *  l'écran de port, dont l'onglet Chantier est le défaut. Le service exige alors un navire de
     *  campagne, comme « Entrer au port ». Absent = service sans écran dédié. */
    opensScreen: z.enum(['port']).optional(),
    /** Libellé du bouton d'entrée du service qui porte un `opensScreen` (texte d'auteur, saveur maison). */
    enterLabel: z.string().optional(),
    /** Note d'infobulle sur la case à cocher du service dans l'éditeur (`WorldMapPlacePanel`) —
     *  ce qui dérive déjà ce service ailleurs, jamais un branchement d'id (#834). */
    editorNote: z.string().optional(),
  },
  {
    hostLine: { label: 'Réplique d’accueil', hint: 'Phrase dite par l’interlocuteur statique du service' },
    backdrop: { label: 'Bande d’ambiance', hint: 'Illustration d’arrière-plan par défaut du service' },
    merchantArchetype: { label: 'Archétype marchand ouvert', hint: 'Marchand ouvert par ce service (catalogue des marchands)' },
    opensScreen: { label: 'Écran ouvert', hint: 'Écran plein-champ existant vers lequel ce service mène' },
    enterLabel: { label: 'Libellé du bouton d’entrée', hint: 'Texte du bouton qui ouvre l’écran du service' },
    editorNote: {
      label: 'Note d’éditeur',
      hint: 'Note d’infobulle sur la case du service dans l’éditeur : ce qui dérive déjà ce service ailleurs',
    },
  },
  {
    codex: {
      exempt: {
        kind: 'vocabulaire-app-interne',
        raison: "vocabulaire de routage d'écran (icône/service de lieu — auberge/temple/forgeron…), pas une fiche de contenu.",
      },
    },
    edit: { none: 'aucune catégorie Codex ne l’expose, donc aucun formulaire d’atelier ne l’édite' },
  },
);

export const schema = doc.schema;
export const meta = doc.meta;

export const exposition = doc.exposition;

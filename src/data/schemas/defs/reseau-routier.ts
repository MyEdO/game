/**
 * Schéma de `reseau-routier.json` — le réseau routier impérial d'EDOC 3 (`EDOC 06`) et 6
 * (`EDOC 10`) : classes de route du décret de 2453, auberges relais, compagnies de diligences,
 * postes de péage et effectifs de patrouille. Donnée de CALIBRATION d'une `MapRoute` (`inns`,
 * `billets`, `speed`, distance des étapes) : rien ici n'ajoute de vocabulaire à `MapRoute` — les
 * valeurs se posent à l'authoring de carte (#684).
 *
 * Le tarif de péage se lit en `brass` (sous de cuivre), l'unité déjà employée par `vehicles.json`
 * (`travel.classes[].brassPerKm`). Chaque entrée porte SA `source` : la racine est une liste nue.
 */
import { z } from 'zod';
import { document } from '../grammaire/document';

export const file = 'reseau-routier.json';
export const famille = 'entite';

const doc = document(
  'reseau-routier',
  famille,
  {
    /** Ce dont l'entrée parle. Discriminant FERMÉ, jamais une référence. */
    kind: z.enum(['classe', 'relais', 'compagnie', 'peage', 'patrouille']),
    /** Largeur de chaussée en mètres, bornes du décret (`classe`). */
    largeurMinM: z.number().optional(),
    largeurMaxM: z.number().optional(),
    /** Espacement des relais le long de la route, en kilomètres (`relais`). */
    espacementKm: z.number().optional(),
    /** Durée d'une étape entre deux relais, en jours, par mode de déplacement (`relais`). */
    etapeDiligenceJours: z.number().optional(),
    etapeChevalJours: z.number().optional(),
    etapePiedJours: z.number().optional(),
    /** Espacement des postes le long d'une route principale, en kilomètres (`peage`). */
    espacementKmMin: z.number().optional(),
    espacementKmMax: z.number().optional(),
    /** Droit de passage en sous de cuivre par jambe qui traverse (`peage`). */
    tarifBrassMin: z.number().optional(),
    tarifBrassMax: z.number().optional(),
    /** Surcote de la compagnie sur le prix du trajet, en pourcent (`compagnie`). */
    prixSurcotePct: z.number().optional(),
    /** Effectif d'une patrouille sur une route commerciale usuelle (`patrouille`). */
    effectifMin: z.number().optional(),
    effectifMax: z.number().optional(),
    /** Effectif d'une route à l'écart des voies commerciales (`patrouille`). */
    effectifRouteReculeeMin: z.number().optional(),
    effectifRouteReculeeMax: z.number().optional(),
    /** Multiplicateur d'effectif en zone dangereuse (`patrouille`). */
    facteurZoneDangereuse: z.number().optional(),
    /** Multiplicateur d'effectif en période de grands troubles (`patrouille`). */
    facteurGrandsTroublesMin: z.number().optional(),
    facteurGrandsTroublesMax: z.number().optional(),
  },
  {
    kind: { label: 'Nature', hint: 'Classe de route, relais, compagnie de diligences, poste de péage ou patrouille' },
    largeurMinM: { label: 'Largeur minimale (m)', hint: 'Largeur de chaussée exigée, borne basse' },
    largeurMaxM: { label: 'Largeur maximale (m)', hint: 'Largeur de chaussée exigée, borne haute' },
    espacementKm: { label: 'Espacement (km)', hint: 'Distance entre deux relais successifs' },
    etapeDiligenceJours: { label: 'Étape en diligence (jours)', hint: 'Durée d’une étape entre deux relais en diligence' },
    etapeChevalJours: { label: 'Étape à cheval (jours)', hint: 'Durée d’une étape entre deux relais à cheval' },
    etapePiedJours: { label: 'Étape à pied (jours)', hint: 'Durée d’une étape entre deux relais à pied' },
    espacementKmMin: { label: 'Espacement minimal (km)', hint: 'Distance entre deux postes, borne basse' },
    espacementKmMax: { label: 'Espacement maximal (km)', hint: 'Distance entre deux postes, borne haute' },
    tarifBrassMin: { label: 'Tarif minimal (sous de cuivre)', hint: 'Droit de passage par jambe qui traverse, borne basse' },
    tarifBrassMax: { label: 'Tarif maximal (sous de cuivre)', hint: 'Droit de passage par jambe qui traverse, borne haute' },
    prixSurcotePct: { label: 'Surcote de prix (%)', hint: 'Écart de prix pratiqué par la compagnie sur le trajet' },
    effectifMin: { label: 'Effectif minimal', hint: 'Patrouilleurs d’une patrouille de route commerciale, borne basse' },
    effectifMax: { label: 'Effectif maximal', hint: 'Patrouilleurs d’une patrouille de route commerciale, borne haute' },
    effectifRouteReculeeMin: { label: 'Effectif minimal (route reculée)', hint: 'Patrouilleurs sur une route à l’écart des voies commerciales, borne basse' },
    effectifRouteReculeeMax: { label: 'Effectif maximal (route reculée)', hint: 'Patrouilleurs sur une route à l’écart des voies commerciales, borne haute' },
    facteurZoneDangereuse: { label: 'Facteur en zone dangereuse', hint: 'Multiplicateur d’effectif appliqué en zone dangereuse' },
    facteurGrandsTroublesMin: { label: 'Facteur minimal en grands troubles', hint: 'Multiplicateur d’effectif en période de grands troubles, borne basse' },
    facteurGrandsTroublesMax: { label: 'Facteur maximal en grands troubles', hint: 'Multiplicateur d’effectif en période de grands troubles, borne haute' },
  },
  {
    codex: {
      exempt: {
        kind: 'dette',
        raison:
          'exposition Codex DUE, non faite — la carte du monde du Tome 1 est le premier consommateur de ce document et n’est pas encore authorée',
        ticket: '#684',
      },
    },
    edit: { none: 'aucune catégorie du Codex ne l’expose, donc aucun formulaire d’atelier ne l’édite' },
  },
  { exiges: ['source'] },
);

export const schema = doc.schema;
export const meta = doc.meta;

export const exposition = doc.exposition;

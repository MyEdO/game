/**
 * Les sauvegardes (#4411) : les feuillets du carnet de route posés sur la table, l'automatique d'abord ; un feuillet dit
 * ce que la sauvegarde porte (`src/noyau/persistance/save.ts:26-34`) (`../../accueil-et-systeme.md`, section
 * `sauvegardes`). États : `sauvegardes` ; `combat`, « Sauvegarder » fermé en plein combat, la raison au survol
 * (`MESSAGE_DU_REFUS`, `src/hote/sauvegardes.ts`).
 */
import type { Ecran, Emplacement } from './maquette.ts';
import { MAINTENANT } from './systeme.ts';

/** Les emplacements ; `survol`, le curseur sur le « Sauvegarder » du premier emplacement manuel. */
const emplacements = (survol = false): Emplacement[] => [
  { nom: 'Emplacement automatique', auto: true, vise: true, partie: { instant: { ...MAINTENANT, heure: '18:05' }, le: { date: '16/11/2026', heure: '21:48' } } },
  { nom: 'Emplacement 1', ...(survol ? { survol: true } : {}), partie: { instant: { lieu: 'La route de Weissbruck', jour: 12, mois: 'Pflugzeit', annee: 2512, heure: '15:40' }, le: { date: '15/11/2026', heure: '23:12' } } },
  { nom: 'Emplacement 2', partie: { instant: { lieu: 'Auberge La Diligence', jour: 33, mois: 'Jahrdrung', annee: 2512, heure: '21:30' }, le: { date: '13/11/2026', heure: '20:05' } } },
  { nom: 'Emplacement 3' },
];
const SAUVEGARDES = { gabarit: 'gestion', decor: 'table', titre: { nom: 'Sauvegardes', instant: MAINTENANT }, avis: 'Emplacement 3 : sauvegarde d’un autre format, retirée.' } as const;

export default {
  etats: [
    { ...SAUVEGARDES, nom: 'sauvegardes', emplacements: emplacements() },
    { ...SAUVEGARDES, nom: 'combat', emplacements: emplacements(true), refus: 'Impossible de sauvegarder en plein combat.' },
  ],
} satisfies Ecran;

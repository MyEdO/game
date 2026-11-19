/**
 * La carte du monde (#4411) : le Reikland et les seuls lieux que le groupe connaît, la destination choisie, ses étapes,
 * ses moyens et ce qu'ils coûtent ; de nuit, le départ à pied pressé ouvre la porte du départ de nuit, règle maison
 * `voyage-heure-de-depart` (#340) (`../../exploration-et-recit.md`, sections `carte-du-monde`,
 * `carte-du-monde-depart-de-nuit`).
 */
import { BOURSES, groupe, type Id } from './compagnie.ts';
import type { CarteDuMonde, Ecran } from './maquette.ts';

/** La carte, `de nuit` ou non. */
const carte = (nom: string, deNuit: boolean): CarteDuMonde => ({
  nom, gabarit: 'lieu-et-voyage', decor: 'reikland',
  titre: { nom: 'Le Reikland', sous: `Carte du monde · ${deNuit ? 'la nuit' : 'lieux connus du groupe'}` },
  lieux: [
    { id: 'diligence', nom: 'Auberge La Diligence', nature: 'Auberge-relais', ici: true },
    { id: 'rayons', nom: 'Auberge des Sept Rayons', nature: 'Auberge-relais', distance: 75 },
    { id: 'altdorf', nom: 'Altdorf', nature: 'Capitale de l’Empire', distance: 190, choisi: true },
  ],
  destination: {
    nom: 'Altdorf', par: 'la grand-route', texte: 'Les murs blancs d’Altdorf, capitale de l’Empire, la plus grande et la plus riche de ses cités.',
    etapes: [{ nom: 'La Diligence' }, { nom: 'Les Sept Rayons', km: 75 }, { nom: 'Altdorf', km: 115 }],
    moyens: [
      { id: 'diligence', jours: 2, nuits: { nombre: 1, a: 'auberge' }, place: { dehors: 48, dedans: 96 }, ...(deNuit ? {} : { pris: true as const }) },
      { id: 'pied', jours: 6, nuits: { nombre: 5, a: 'route' }, ...(deNuit ? { pris: true as const } : {}) },
    ],
    geste: { libelle: 'Prendre la route', principal: true },
  },
  retour: 'Revenir à l’auberge',
  groupe: groupe().map((h) => ({ ...h, bourse: BOURSES[h.id as Id] })),
  ...(deNuit ? { fenetre: {
    titre: 'Départ de nuit',
    centre: { role: 'consigne', consigne: 'La nuit est tombée — un voyage à pied ne s’ébranle qu’au grand jour. Prochain départ possible à l’aube (6 h).' },
    gestes: [{ libelle: 'Attendre l’aube', principal: true }, { libelle: 'Rester' }], reserves: [],
  } } : {}),
});

export default { etats: [carte('carte-du-monde', false), carte('carte-du-monde-depart-de-nuit', true)] } satisfies Ecran;

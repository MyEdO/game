/**
 * Le dossier d'une possession (#4411), au gabarit de la fiche : le navire et sa cale, la bête qu'on renomme et qu'on
 * embarque, le véhicule remisé qu'on abandonne (`../../voyage.md`, sections `dossier-*`). Registre et gestes :
 * `src/noyau/possessionsFlow.ts:49-205` ; charge et place à bord : `src/engine/possession.ts:115-133`, `:208-244`, MDG 12
 * l.25-33 ; transfert de vrac : `src/noyau/carriers.ts:171-196`. Cogue : `src/data/vehicles.json`,
 * `src/data/naval-traits.json` (MDG 12), Moral MDG 14 l.133-143 ; mule : `src/data/creatures.json` (EDOC 07), traits LDB
 * 23 ; charrette : `src/data/vehicles.json` (LDB 70).
 */
import { combattants, groupe } from './compagnie.ts';
import type { BlocDuDossier, Dossier, Ecran } from './maquette.ts';

/** La Sterne, sa section `ouverte` et ses blocs. */
const sterne = (nom: string, ouverte: string, blocs: BlocDuDossier[]): Dossier => ({
  nom, gabarit: 'fiche',
  possession: { genre: 'navire', nom: 'La Sterne', modele: 'Cogue', nature: 'Navire à voile', longueur: 25, prix: 72000 },
  mesures: [{ nom: 'Coque', valeur: 50, sur: 50, teinte: 'cire' }, { nom: 'Moral', valeur: 75, teinte: 'or' }],
  compteurs: [{ nom: 'Équipage', valeur: 15 }, { nom: 'Aux voiles', valeur: 8 }, { nom: 'Héros à un poste', valeur: 4 }],
  profil: { titre: 'Profil du navire', caracs: [{ nom: 'M', valeur: 5 }, { nom: 'E', valeur: 45 }, { nom: 'B', valeur: 50 }, { nom: 'Man', valeur: -1, signe: true }, { nom: 'Équipage', valeur: 15 }, { nom: 'Capacité', valeur: 300 }] },
  sections: ['État', 'Équipage', 'Cargaison', 'Améliorations'], ouverte, blocs, combattants: combattants(), groupe: groupe(),
});

export default {
  etats: [
    sterne('dossier-du-navire', 'État', [
      { bloc: 'traits', traits: [
        { id: 'peu-maniable', nom: 'Peu maniable', texte: 'Chaque niveau impose une pénalité de –1 DR sur tous les Tests de Ramer et de Voile.' },
        { id: 'robuste', nom: 'Robuste', texte: 'Un navire Robuste reçoit +2 DR sur ses Tests d’équipage d’Affaler les voiles.' }] },
      { bloc: 'reserves', eau: 2900, vivres: 735, salissures: 0, avaries: 0 }]),
    sterne('dossier-du-navire-cargaison', 'Cargaison', [
      { bloc: 'cale', porte: 130, capacite: 300 },
      { bloc: 'lots', lots: [{ nom: 'Laine', enc: 60 }, { nom: 'Sel', enc: 40, choisi: true }, { nom: 'Métaux', enc: 30 }] },
      { bloc: 'deplacer', lot: 'le sel', vers: [{ genre: 'charrette', nom: 'Charrette', de: 'bjorn', porte: 0, charge: 25, choisi: true }], quantite: { valeur: 25, sur: 40, place: 25 } },
      { bloc: 'aBord', porte: 15, capacite: 300, possessions: [{ genre: 'mule', nom: 'Marguerite', modele: 'Mule', de: 'bjorn', enc: 15 }] }]),
    {
      nom: 'dossier-de-la-bete', gabarit: 'fiche',
      possession: { genre: 'mule', nom: 'Marguerite', saisie: true, modele: 'Mule', nature: 'Bête', de: 'bjorn', prix: 1200 },
      mesures: [{ nom: 'Blessures', valeur: 12, sur: 12, teinte: 'cire' }, { nom: 'Charge', valeur: 9, sur: 14, teinte: 'or' }],
      compteurs: [{ nom: 'Enc de charge', valeur: 14 }, { nom: 'Enc de place à bord', valeur: 6 }, { nom: 'Mouvement', valeur: 4 }],
      profil: { titre: 'Profil de la bête', caracs: [
        { nom: 'M', valeur: 4 }, { nom: 'CC', valeur: 25 }, { nom: 'CT', valeur: null }, { nom: 'F', valeur: 30 }, { nom: 'E', valeur: 45 }, { nom: 'I', valeur: 20 },
        { nom: 'Ag', valeur: 30 }, { nom: 'Dex', valeur: null }, { nom: 'Int', valeur: 10 }, { nom: 'FM', valeur: 10 }, { nom: 'Soc', valeur: 10 }, { nom: 'B', valeur: 12 }] },
      sections: ['État', 'Charge'], ouverte: 'État', combattants: combattants(), groupe: groupe(),
      blocs: [
        { bloc: 'traits', traits: [
          { id: 'dresse', nom: 'Dressé (Trait)', texte: 'L’animal est entraîné à tirer un carrosse, un chariot, une charrue, une carriole ou similaire.' },
          { id: 'nerveux', nom: 'Nerveux', texte: 'La créature est facilement effrayée par la magie ou les bruits forts. Si cela se produit, elle gagne +3 État Brisé.' }] },
        { bloc: 'lieu', ou: 'Avec le groupe · Salzenmund', gestes: [{ libelle: 'Laisser ici' }, { libelle: 'Embarquer', principal: true }, { libelle: 'Abandonner' }] },
        { bloc: 'embarquer', navires: [{ nom: 'La Sterne', modele: 'Cogue', porte: 0, capacite: 300, choisi: true }], charge: 15 }],
    },
    {
      nom: 'dossier-du-vehicule', gabarit: 'fiche',
      possession: { genre: 'charrette', nom: 'Charrette', modele: 'Charrette', nature: 'Véhicule', de: 'bjorn', prix: 4800 },
      mesures: [{ nom: 'Chargement', valeur: 0, sur: 25, teinte: 'or' }],
      compteurs: [{ nom: 'Enc de chargement', valeur: 25 }, { nom: 'Enc du véhicule', valeur: 10 }, { nom: 'Bête de trait', valeur: 1 }],
      profil: { titre: 'Profil du véhicule', caracs: [{ nom: 'Enc', valeur: 10 }, { nom: 'Chargement', valeur: 25 }, { nom: 'Attelage', valeur: 1, unite: 'bête' }] },
      sections: ['État', 'Chargement'], ouverte: 'État', combattants: combattants(), groupe: groupe(),
      blocs: [
        { bloc: 'livre', texte: 'Les charrettes sont de petits véhicules à deux roues de toutes sortes, y compris les charrettes à âne, les chars et les cabriolets. Les charrettes de passagers comprennent une banquette pouvant accueillir jusqu’à deux personnes, tandis que celles qui transportent des marchandises ont un siège plus petit avec un côté ouvert pour le chargement. Les charrettes sont tirées par un seul animal. Des bras dépassent de chaque côté du châssis, auxquels est attaché un harnais, ou un collier.' },
        { bloc: 'lieu', ou: 'À l’écurie · Salzenmund', gestes: [{ libelle: 'Reprendre' }, { libelle: 'Embarquer', refus: 'Cette possession doit être avec le groupe pour embarquer.', survol: true }, { libelle: 'Abandonner', principal: true }] },
        { bloc: 'abandon', nom: 'la charrette' }],
    },
  ],
} satisfies Ecran;

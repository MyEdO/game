/**
 * La halle (#4411) : la page des services de Kemperbad ouverte sur son marché de cargaison. Les offres sont les
 * négociants de la halle, les porteurs du groupe attendent au premier plan ; la page de droite compose l'achat ou
 * traite le lot choisi (MSRC 13 l.26-180) (`../../commerce.md`, sections `halle-achat`, `halle-vente`). État
 * `la-main` : la halle vue du siège d'un invité, l'achat composé par l'hôte, ses gestes fermés ; chaque héros dit qui le
 * joue (`../../outils.md`, section `coop-la-main`).
 */
import { BOURSES, groupe } from './compagnie.ts';
import type { Ecran, Joueur, LigneDeCompte, OffreDeNegoce, PageDeService, Part, Rail, Sous, TitreDuLieu } from './maquette.ts';

export const TITRE: TitreDuLieu = { nom: 'La halle', sous: 'Marché de Kemperbad · printemps' };
export const RAIL: Rail = {
  titre: 'Services de Kemperbad', ouvert: 'marche', pied: 'On passe de l’un à l’autre sans ressortir',
  services: [{ id: 'auberge', nom: 'Auberge' }, { id: 'marche', nom: 'Marché' }, { id: 'forgeron', nom: 'Forgeron' }, { id: 'temple', nom: 'Temple' }, { id: 'port', nom: 'Port' }],
};
const RUMEUR = { titre: 'Rumeur au marché', texte: 'Vivres, Bois se vendraient le double à Eilhart.' };
/** L'offre de laine du négociant ; `o` la déplie, la choisit, lui donne ses gestes. */
export const laine = (o: Partial<OffreDeNegoce> = {}): OffreDeNegoce => ({ role: 'offre', denree: 'laine', nom: 'Laine', negociant: 'Un négociant en laine', disponible: 350, prixDeBase: 24, ...o });
const VIN: OffreDeNegoce = { role: 'offre', denree: 'vin', nom: 'Vin', negociant: 'Un vigneron · qualité incertaine', disponible: 280, prixDeBase: 72 };

/** Les parts du groupe sur le lot de laine, la part d'Aldric `aldric`. */
const parts = (aldric: Sous): Part[] => [
  { heros: 'bjorn', part: 120, avoir: BOURSES.bjorn }, { heros: 'mira', part: 60, avoir: BOURSES.mira },
  { heros: 'aldric', part: aldric, avoir: BOURSES.aldric }, { heros: 'greta', part: 120, avoir: BOURSES.greta }];
/** La page du chargement de 25 Enc de laine sur la charrette ; `marchande`, la ligne du Marchandage gagné et le prix
 *  marchandé ; sans `conclure`, le Marchandage se joue. */
export const chargement = ({ marchande, conclure = true }: { marchande?: LigneDeCompte; conclure?: boolean } = {}): PageDeService => ({
  titre: 'Le chargement', nom: 'Laine', sous: 'Achat en composition',
  blocs: [
    { bloc: 'texte', texte: 'Le négociant cède son lot entier, ou une part d’au moins 10 Enc.' },
    { bloc: 'porteurs', porteurs: [{ id: 'charrette', nom: 'Charrette', porte: 0, charge: 25, ajout: 25, pris: true }, { id: 'mule', nom: 'Mule', porte: 0, charge: 14 }] },
    { bloc: 'quantite', libelle: 'Enc à acheter', valeur: 25, min: 10, max: 25 },
    { bloc: 'compte', lignes: [
      { libelle: 'Prix de base', detail: { enc: 25, a: 24 }, valeur: { prix: 600 } },
      { libelle: 'Lot partagé', detail: { pourcent: 10 }, valeur: { prix: 60 } },
      ...(marchande ? [marchande] : [])], total: marchande ? { libelle: 'Prix marchandé', prix: 594 } : { libelle: 'Estimation', prix: 660 } },
    { bloc: 'parts', parts: parts(marchande ? 294 : 360) }],
  gestes: conclure ? [{ libelle: 'Conclure l’achat', principal: true }] : [],
  ...(conclure ? { note: 'Le Marchandage se joue à la conclusion, contre le négociant.' } : {}),
});
/** La halle, sans sa rumeur : en coop, qui tient la main en prend la place. */
const SANS_RUMEUR = { gabarit: 'lieu-et-voyage', decor: 'halle', titre: TITRE, rail: RAIL, retour: 'Quitter la halle' } as const;
const HALLE = { ...SANS_RUMEUR, rumeur: RUMEUR };
const MARCHANDE = groupe({ aldric: { id: 'marchandage', texte: 'mènera le Marchandage' } });
const KARL: Joueur = { nom: 'Karl', hote: true }, LENA: Joueur = { nom: 'Lena', vous: true }, OTTO: Joueur = { nom: 'Otto', absent: true };

export default {
  etats: [{
    ...HALLE, nom: 'halle-achat',
    scene: [
      laine({ estimation: 660, gestes: [{ libelle: 'Acheter', principal: true }], depliee: true, choisie: true }),
      { ...VIN, estimation: 1980, gestes: [{ libelle: 'Évaluer le vin' }, { libelle: 'Acheter' }], depliee: true }],
    page: chargement(),
    groupe: MARCHANDE,
  }, {
    ...HALLE, nom: 'halle-vente',
    scene: [
      laine(), VIN,
      { role: 'porteur', id: 'charrette', nom: 'Charrette', sous: 'Porteur du groupe', porte: 25, charge: 25, lot: { denree: 'laine', nom: 'Laine', enc: 25, pris: true }, choisi: true },
      { role: 'porteur', id: 'mule', nom: 'Mule', sous: 'Porteur du groupe', porte: 0, charge: 14 }],
    page: {
      titre: 'Le lot', nom: 'Laine', sous: '25 Enc sur la charrette',
      blocs: [
        { bloc: 'faits', lignes: [
          { libelle: 'Prix de base', detail: { enc: 25, a: 24 }, valeur: { prix: 600 } },
          { libelle: 'Mise à prix à Kemperbad', detail: { pourcent: 5 }, valeur: { prix: 630 } }] },
        { bloc: 'voies', voies: [
          { id: 'balance', nom: 'Vendre', test: 'Recherche d’acheteur, puis Marchandage', texte: 'Un acheteur se trouve sur 60 ou moins au d100 ; sinon la moitié du lot se propose.', prix: 630, prise: true },
          { id: 'moitie', nom: 'Brader', test: 'Sans Test', texte: 'Une place de commerce reprend tout lot à la moitié de son prix de base.', prix: 300 },
          { id: 'deplacer', nom: 'Déplacer', test: 'Vers la mule · 14 Enc libres', texte: 'Le lot change de porteur, en tout ou en partie.' }] }],
      gestes: [{ libelle: 'Vendre', principal: true }],
      note: 'Refuser la mise à prix garde le lot sur la charrette.',
    },
    groupe: MARCHANDE,
  }, {
    ...SANS_RUMEUR, nom: 'la-main',
    scene: [
      laine({ estimation: 660, gestes: [{ libelle: 'Acheter', principal: true }], depliee: true, choisie: true }),
      { ...VIN, estimation: 1980, gestes: [{ libelle: 'Évaluer le vin' }, { libelle: 'Acheter' }], depliee: true }],
    page: { ...chargement(), sous: 'Composé par l’hôte' },
    groupe: groupe({}, 'aldric').map((h) => ({ ...h, bourse: BOURSES[h.id as keyof typeof BOURSES] })),
    main: {
      tient: KARL, fait: 'compose l’achat', partie: 'K7M2QX', refus: 'L’hôte seul engage la bourse et la cale du groupe.',
      joueurs: { bjorn: KARL, mira: LENA, aldric: KARL, greta: OTTO },
    },
  }],
} satisfies Ecran;

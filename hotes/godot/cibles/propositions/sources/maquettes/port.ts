/**
 * Le port (#4411) : Salzenmund en lieu (les services sur leurs bâtiments, le navire du groupe, la carte et les départs),
 * puis la page des services du port ouverte sur l'un d'eux, la cale du navire pour seul porteur (MDG 13 l.150-159,
 * l.643 ; MDG 12 l.195-364 ; MDG 14 l.236-302 ; MDG 15 l.255, l.321-436) (`../../commerce.md`, sections `port*`).
 */
import { groupe } from './compagnie.ts';
import type { Commerce, Ecran, NavireAQuai, OffreDeNegoce, Part, PageDeService, Porteur, Sous } from './maquette.ts';

/** Les services du port, celui de `ouvert` ouvert. */
const SERVICES = { negoce: 'Négoce de cargaison', chantier: 'Chantier naval', recrutement: 'Recrutement', avitaillement: 'Avitaillement' };
const services = (ouvert: keyof typeof SERVICES, nom: string, scene: Commerce['scene'], page: PageDeService, marchande = false): Commerce => ({
  nom, gabarit: 'lieu-et-voyage', decor: 'quai',
  titre: { nom: 'Le port', sous: 'Salzenmund · printemps' },
  rail: { titre: 'Services du port', ouvert, pied: 'Le navire reste à quai', services: Object.entries(SERVICES).map(([id, n]) => ({ id, nom: n })) },
  scene, page,
  retour: 'Quitter le port',
  groupe: groupe(marchande ? { aldric: { id: 'marchandage', texte: 'mènera le Marchandage' } } : {}),
});

const BOIS: OffreDeNegoce = { role: 'offre', denree: 'bois', nom: 'Bois', negociant: 'Un négociant du quai', disponible: 320, prixDeBase: 360 };
const LUXE: OffreDeNegoce = { role: 'offre', denree: 'luxe', nom: 'Produits de luxe', negociant: 'Un négociant du quai', disponible: 360, prixDeBase: 6000, surplus: true };
/** La cale de la cogue, 60 Enc portés ; `o` y ajoute la part prévue, le lot, les vivres. */
const cale = (o: Partial<Porteur> = {}): Porteur => ({ role: 'porteur', id: 'cale', nom: 'La cale', sous: 'Cogue du groupe', porte: 60, charge: 300, ...o });
const CEREALES = { denree: 'cereales', nom: 'Céréales', enc: 60 };
const COGUE: NavireAQuai = { role: 'navire', nom: 'Votre cogue', sous: 'Navire du groupe' };
/** Les avoirs d'un groupe qui vient de vendre ses céréales, et la part `part` de chacun. */
const AVOIRS: [string, Sous][] = [['bjorn', 7440], ['mira', 7308], ['aldric', 7752], ['greta', 7476]];
const parts = (part: Sous): Part[] => AVOIRS.map(([heros, avoir]) => ({ heros, part, avoir }));

export default {
  etats: [{
    nom: 'port', gabarit: 'lieu-et-voyage', decor: 'quai',
    titre: { nom: 'Salzenmund', sous: 'Port · Nordland', meteo: { temps: 'beau', ciel: 'Beau temps' } },
    recit: 'Capitale du Nordland, Grand Temple d’Ulric et temple de Manann Resplendissant. Votre cogue est amarrée au quai des marchands.',
    scene: [
      { role: 'service', id: 'entrepot', nom: 'L’entrepôt', sous: 'Négoce de cargaison', accueil: { dit: 'Bienvenue à quai ! Amarrage, fret et passage — ici on négocie tout ce qui flotte, et le reste aussi.', gestes: [{ id: 'entrer', libelle: 'Entrer' }] } },
      { ...COGUE, sous: 'Navire du groupe', coque: { blessures: 52, max: 60 }, cale: { porte: 60, charge: 300 } },
      { role: 'service', id: 'chantier', nom: 'Chantier naval', sous: 'Réparer · caréner' },
      { role: 'service', id: 'marins', nom: 'La taverne', sous: 'Recruter l’équipage' },
      { role: 'service', id: 'avitailleur', nom: 'L’avitailleur', sous: 'Vivres et eau douce' }],
    carte: { ouvrir: 'Ouvrir la carte', departs: [{ vers: 'Norden', par: 'la mer des Griffes', distance: 90, unite: 'milles', moyens: [{ id: 'navire', jours: 3 }] }, { vers: 'Hargendorf', par: 'la mer des Griffes', distance: 60, unite: 'milles', moyens: [{ id: 'navire', jours: 2 }] }] },
    retour: 'Explorer',
    groupe: groupe({ bjorn: { texte: 'a le pied marin, enfin' }, greta: { texte: 'se remet du mal de mer', mal: true } }),
  },
  services('negoce', 'port-negoce', [BOIS, LUXE, cale({ lot: { ...CEREALES, pris: true }, choisi: true })], {
    titre: 'Le lot', nom: 'Céréales', sous: '60 Enc dans la cale',
    blocs: [
      { bloc: 'faits', lignes: [
        { libelle: 'Prix de base', detail: { enc: 60, a: 480 }, valeur: { prix: 28800 } },
        { libelle: 'Salzenmund', valeur: { texte: 'demande des céréales', plus: 1 } },
        { libelle: 'Prix d’offre', valeur: { texte: 'le prix de base' } },
        { libelle: 'Marchandage du vendeur', valeur: { dr: 2 } }] },
      { bloc: 'voies', voies: [
        { id: 'balance', nom: 'Vendre', test: 'Recherche d’acheteur, puis Marchandage', texte: 'Un acheteur se trouve sur 80 ou moins au d100 ; sinon la moitié du lot se propose.', prix: 28800, prise: true },
        { id: 'moitie', nom: 'Brader', test: 'Sans Test', texte: 'Un port de commerce, ou qui demande la denrée, la reprend au quart de son prix de base.', prix: 7200 }] }],
    gestes: [{ libelle: 'Vendre', principal: true }],
    note: 'Au port, seule la cale du navire se négocie.',
  }, true),
  services('negoce', 'port-achat', [LUXE, { ...BOIS, estimation: 21600, gestes: [{ libelle: 'Acheter', principal: true }], depliee: true, choisie: true }, cale({ ajout: 60, lot: CEREALES })], {
    titre: 'Le chargement', nom: 'Bois', sous: 'Achat en composition',
    blocs: [
      { bloc: 'porteurs', porteurs: [{ id: 'cale', nom: 'La cale', porte: 60, charge: 300, ajout: 60, pris: true }] },
      { bloc: 'quantite', libelle: 'Enc à acheter', valeur: 60, min: 1, max: 240 },
      { bloc: 'compte', lignes: [
        { libelle: 'Prix de base', detail: { enc: 60, a: 360 }, valeur: { prix: 21600 } },
        { libelle: 'Lot partagé', valeur: { dr: 1, qui: 'vendeur' } }], total: { libelle: 'Estimation', prix: 21600 } },
      { bloc: 'parts', parts: parts(5400) }],
    gestes: [{ libelle: 'Conclure l’achat', principal: true }],
    note: 'Le Marchandage se joue à la conclusion, contre le négociant.',
  }, true),
  services('chantier', 'port-chantier', [
    { role: 'constructeur', nom: 'Le constructeur naval', sous: 'Améliorations à poser', ameliorations: [
      { nom: 'Ancre', enc: 50, prix: 2400 }, { nom: 'Bélier', enc: 60, prix: 7200 }, { nom: 'Figure de proue', enc: 10, prix: 480 },
      { nom: 'Nid-de-pie', enc: 5, prix: 1200, prise: true }, { nom: 'Sabord', enc: 0, prix: 3600 }, { nom: 'Blindage (bronze)', enc: 875, prix: 300000, fermee: true }] },
    { ...COGUE, sous: 'Navire du groupe · 25 m · à quai', coque: { blessures: 52, max: 60 }, salissures: 1 }], {
    titre: 'Le chantier', nom: 'Votre cogue', sous: 'Un travail à la fois',
    blocs: [
      { bloc: 'voies', voies: [
        { id: 'marteau', nom: 'Réparer la coque', test: '8 Blessures · Métier (Constructeur de navires)', texte: '1 CO par Blessure restaurée ; chaque Test réussi prend 1d10 heures et restaure 1d10 Blessures.', prix: 1920, prise: true },
        { id: 'goutte', nom: 'Caréner', test: 'Cale sèche · Salissures de niveau 1', texte: '5 % du coût de base du navire ; la coque repart propre.', prix: 3600 },
        { id: 'plus', nom: 'Poser : Nid-de-pie', test: 'Amélioration · 5 Enc', texte: 'La pose prend 1d10 jours (valeur maison).', prix: 1200 }] },
      { bloc: 'parts', parts: parts(480) }],
    gestes: [{ libelle: 'Réparer la coque', principal: true }],
    note: 'Le temps du travail passe à quai.',
  }),
  services('recrutement', 'port-recrutement', [
    { role: 'service', id: 'marins', nom: 'Taverne des marins', sous: 'Recruter l’équipage' },
    { ...COGUE, equipage: { abord: 13, sur: 15, ajout: 2 } }], {
    titre: 'L’équipage', nom: 'Les salariés du bord', sous: 'Solde par semaine · à bord',
    blocs: [
      { bloc: 'lignes', lignes: [
        { nom: 'Capitaine', prix: 1200, nombre: 0 }, { nom: 'Timonier', prix: 864, nombre: 1 }, { nom: 'Vigie', prix: 864, nombre: 1 },
        { nom: 'Mousse', prix: 288, nombre: 6, prise: true }, { nom: 'Navigateur', prix: 1200, nombre: 0 }, { nom: 'Artilleur', prix: 864, nombre: 0 },
        { nom: 'Cuisinier', prix: 288, nombre: 1 }, { nom: 'Chirurgien', prix: 1200, nombre: 0 }, { nom: 'Chansonnier', prix: 864, nombre: 0 }] },
      { bloc: 'nombre', libelle: 'Mousses à embaucher', valeur: 2 },
      { bloc: 'compte', lignes: [{ libelle: 'Solde ajoutée', detail: { nombre: 2, a: 288 }, valeur: { prix: 576 } }], total: { libelle: 'Solde de l’équipage', prix: 4320 } }],
    gestes: [{ libelle: 'Embaucher', principal: true }, { libelle: 'Débarquer' }],
    note: 'Rien n’est débité à l’embauche : la solde se règle chaque semaine.',
  }),
  services('avitaillement', 'port-avitaillement', [
    { role: 'service', id: 'avitailleur', nom: 'L’avitailleur', sous: 'Vivres et eau douce' },
    cale({ ajout: 72, vivres: { rations: 40, eau: 290 } })], {
    titre: 'L’avitaillement', nom: 'Vivres et eau douce', sous: 'Achat en composition',
    blocs: [
      { bloc: 'lignes', reglable: true, lignes: [
        { nom: 'Biscuits de mer', sous: 'ration pour un jour', prix: 12, nombre: 120 },
        { nom: 'Nourriture préservée', sous: 'ration pour un jour', prix: 24, nombre: 60 },
        { nom: 'Tonneau d’eau douce', sous: '9 Enc', prix: 102, nombre: 8 }] },
      { bloc: 'texte', texte: 'Un tonneau contient 145 litres d’eau. Un membre d’équipage boit 2 à 3 litres d’eau par jour.' },
      { bloc: 'compte', lignes: [
        { libelle: 'Biscuits de mer', detail: { nombre: 120, a: 12 }, valeur: { prix: 1440 } },
        { libelle: 'Nourriture préservée', detail: { nombre: 60, a: 24 }, valeur: { prix: 1440 } },
        { libelle: 'Eau douce', detail: { nombre: 8, a: 102 }, valeur: { prix: 816 } }], total: { libelle: 'Devis', prix: 3696 } },
      { bloc: 'parts', parts: parts(924) }],
    gestes: [{ libelle: 'Avitailler la cale', principal: true }],
  }),
  ],
} satisfies Ecran;

/**
 * LE SALON d'un hôte (#3009) : ce qu'un écran de salon montre et offre, en zones, pur de l'état de la partie, de
 * l'ouverture que l'hôte tient et de la présence d'un réseau. Le noyau offre chaque attribution de siège
 * (`siegesOfferts`) ; ce module n'en nomme aucun verbe.
 */
import { siegesDeLaTable, siegesOfferts, type Jeu as Partie } from '../noyau/index';
import { t } from '../i18n';
import { estObjet } from '../lib/objet.mjs';
import { ligne, type Appel, type Bouton, type Choix, type Formulaire, type Jeu, type Ligne, type Saisie } from './elements';
import { ErreurDeGeste } from './partie';

/** L'ouverture d'un salon que l'hôte tient : aucune, en cours (héberger ou rejoindre), ou échouée et son texte. */
export type OuvertureDuSalon = null | { enCours: 'heberger' | 'rejoindre' } | { echec: string };

/**
 * @contrat Vue
 * Les zones du salon, que la méthode `salon` rend avec ou sans partie ouverte. Le formulaire « Héberger » (son verbe
 * et une chaîne par champ), le `jeu` de « Quitter le salon » et celui d'une valeur de `salon.sieges` sont les gestes
 * que la méthode `salon` reçoit, lus dans les zones d'avant le geste.
 */
export interface ZonesDuSalon {
  /** en session, le code de la room, chaque siège de la table (son nom, « (vous) », « reconnexion »), et chez un invité
   *  l'état de son lien ; hors session, l'ouverture en cours ou le texte de son échec. */
  'salon.etat': Ligne[];
  /** hors session et sans ouverture en cours, « Héberger » (`verbe` `heberger`, champ `nom`) et « Rejoindre »
   *  (`verbe` `rejoindre`, champs `code`, `nom`), chacun refusé avec sa raison ; sinon « Quitter le salon », dont le
   *  `jeu` est `{ salon: 'quitter' }`. */
  'salon.gestes': (Formulaire | Bouton)[];
  /** une rangée par attribution de siège offerte (`siegesOfferts`, surface du noyau), une valeur par siège, pressée
   *  quand il la tient déjà, dont le `jeu` est l'intention du noyau qui l'attribue. */
  'salon.sieges': Choix[];
}

/** Une saisie de texte du formulaire `verbe`. */
const champ = (verbe: string, nom: string, libelle: string): Saisie => ({ type: 'saisieTexte', id: `${verbe}/${nom}`, ton: 'neutre', nom, optionnel: false, libelle, valeur: '' });

/** Un formulaire du salon. */
const formulaire = (verbe: string, libelle: string, refus: string | null, champs: Saisie[]): Formulaire => ({ type: 'formulaire', id: verbe, libelle, verbe, focus: false, refus, champs });

/** L'état du lien d'un invité. */
function lienDeLInvite(net: Partie['net']): Ligne {
  if (net.hoteAbsent) return ligne('lien', t('coop.invite.attente.hoteAbsent'), 'alerte');
  if (net.connection === 'reconnexion') return ligne('lien', t('coop.invite.attente.reconnexion'), 'alerte');
  return ligne('lien', t('coop.invite.attente.defaut'));
}

/** Les zones du salon de la partie `etat` (`null` : aucune partie ouverte), pendant l'ouverture `ouverture`, l'hôte
 *  ayant un réseau ou non (`reseau`). */
export function zonesDuSalon(etat: Pick<Partie, 'net' | 'party'> | null, ouverture: OuvertureDuSalon, reseau: boolean): ZonesDuSalon {
  const net = etat?.net ?? null;
  const enSession = net !== null && net.mode !== 'local';
  const enCours = ouverture !== null && 'enCours' in ouverture;
  const etatDuSalon: Ligne[] = enSession
    ? [
      ligne('code', t('ecran.salon.code', { code: net.roomCode ?? '' })),
      ...siegesDeLaTable(net).map(({ seat, nom, moi, absent }) => ligne(`siege/${seat}`, `${nom}${moi ? t('party.slot.you') : ''}${absent ? t('ecran.salon.absent') : ''}`, absent ? 'alerte' : 'neutre')),
      ...(net.mode === 'invite' ? [lienDeLInvite(net)] : []),
    ]
    : ouverture === null ? []
    : 'enCours' in ouverture ? [ligne('ouverture', t(ouverture.enCours === 'heberger' ? 'ecran.salon.enCours.heberger' : 'ecran.salon.enCours.rejoindre'))]
    : [ligne('ouverture', ouverture.echec, 'echec')];
  const sansReseau = reseau ? null : t('ecran.salon.refus.sansReseau');
  const gestes: (Formulaire | Bouton)[] = enSession || enCours
    ? [{ type: 'bouton', id: 'quitter', libelle: t('ecran.salon.quitter'), jeu: { salon: 'quitter' }, presse: false, focus: false, refus: null }]
    : [
      formulaire('heberger', t('coop.hote.bouton'), sansReseau ?? (etat === null ? t('ecran.salon.refus.sansPartie') : null), [champ('heberger', 'nom', t('coop.name.label'))]),
      formulaire('rejoindre', t('coop.join.btn'), sansReseau ?? (etat === null ? null : t('ecran.salon.refus.partieOuverte')), [
        champ('rejoindre', 'code', t('ecran.salon.champ.code')),
        champ('rejoindre', 'nom', t('coop.name.label')),
      ]),
    ];
  return {
    'salon.etat': etatDuSalon,
    'salon.gestes': gestes,
    'salon.sieges': etat === null ? [] : siegesOfferts(etat).map((o): Choix => ({
      type: 'choix', id: o.id, ton: 'neutre', libelle: o.nom, focus: false, refus: null,
      valeurs: o.choix.map((c): Bouton => ({ type: 'bouton', id: `${o.id}/${c.siege ?? 'ia'}`, libelle: c.nom, jeu: c.intention, presse: c.tenu, focus: false, refus: null })),
    })),
  };
}

/** Un geste de salon lu : héberger sous le nom `nom`, rejoindre la room `code` sous le nom `nom`, quitter le salon, ou
 *  l'intention de siège d'une valeur de `salon.sieges`, telle que la valeur la porte. */
export type GesteDuSalon = { sorte: 'heberger'; nom: string } | { sorte: 'rejoindre'; code: string; nom: string } | { sorte: 'quitter' } | { sorte: 'siege'; intention: Appel };

/** `a` et `b` sont-elles la même valeur JSON ? */
const memeValeur = (a: unknown, b: unknown): boolean => {
  if (Array.isArray(a)) return Array.isArray(b) && a.length === b.length && a.every((x, i) => memeValeur(x, b[i]));
  if (!estObjet(a) || !estObjet(b)) return a === b;
  const cles = Object.keys(a);
  return cles.length === Object.keys(b).length && cles.every((k) => Object.prototype.hasOwnProperty.call(b, k) && memeValeur(a[k], b[k]));
};

/** Lit l'entrée `entree` comme un geste que les zones `zones` (celles d'avant le geste) offrent : le formulaire dont le
 *  `verbe` est son `type`, ses `args` une chaîne par champ, ou le bouton ou la valeur de choix dont le `jeu` est
 *  `entree`. Lève l'erreur de validation d'un geste que les zones n'offrent pas ou que la lecture ne connaît pas,
 *  ou d'arguments mal formés, et l'erreur de règle du refus d'un formulaire offert. */
export function lireUnGesteDuSalon(zones: ZonesDuSalon, entree: unknown): GesteDuSalon {
  const refuser = (categorie: 'validation' | 'regle', raison: string): never => {
    throw new ErreurDeGeste(categorie, `salon : ${raison}`);
  };
  if (!estObjet(entree)) return refuser('validation', 'un geste est un objet JSON');
  const formulaire = zones['salon.gestes'].find((g): g is Formulaire => g.type === 'formulaire' && g.verbe === entree.type);
  if (formulaire) {
    const { args } = entree;
    if (!Array.isArray(args) || args.length !== formulaire.champs.length || !args.every((a): a is string => typeof a === 'string')) return refuser('validation', `args, une chaîne par champ de ${formulaire.verbe}`);
    if (formulaire.refus !== null) return refuser('regle', formulaire.refus);
    return formulaire.verbe === 'rejoindre' ? { sorte: 'rejoindre', code: args[0], nom: args[1] } : { sorte: 'heberger', nom: args[0] };
  }
  const boutons = [...zones['salon.gestes'], ...zones['salon.sieges'].flatMap((c) => c.valeurs)].filter((g): g is Bouton => g.type === 'bouton');
  const jeu: Jeu | undefined = boutons.find((b) => memeValeur(b.jeu, entree))?.jeu;
  if (jeu === undefined) return refuser('validation', `geste non offert : ${JSON.stringify(entree)}`);
  if ('salon' in jeu) return { sorte: 'quitter' };
  if ('type' in jeu) return { sorte: 'siege', intention: jeu };
  return refuser('validation', `geste non lu : ${JSON.stringify(entree)}`);
}

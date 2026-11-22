/**
 * Les services du hameau, au gabarit des lieux des maquettes (`commerce/port-recrutement`, `commerce/halle-achat`) :
 * le cartouche du lieu, la colonne des services de Grisefosse (on passe de l'un à l'autre sans ressortir), l'hôte posé
 * sur le décor (le bâtiment, son palier, ce qu'il deviendra), la page du service, le socle de la compagnie et le
 * retour. Le socle dit ce qu'un clic fait : servir ce héros (forge, chapelle, salle d'armes), l'emmener (départ), ou
 * ouvrir sa fiche (ailleurs).
 */
import * as J from '../jeu';
import { carac, nomDeCreature } from '../combat';
import { medaillon, plaque, portrait, rond } from '../kit';
import { CADRES, ecran } from './ecran';
import { exigencesDuNiveau } from './fiche';
import {
  apercuDePiece, apercuDeProvision, busteDuHeros, cadreA, caseObjet, casesDuSac, encombrementDe, entree, esc, etiquettesDeSequelles, glose,
  iconeDArme, offre, place, soinsDuHeros,
} from './pieces';

/** Ce que les services lisent de l'interface : l'état, le héros servi, et au départ la route et ceux qu'on emmène. */
export interface Contexte { e: J.Etat; client: string | null; dest: string | null; choix: ReadonlySet<string> }
export type Service = J.IdBatiment | 'depart' | 'chronique';


export const PICTO_DU_BATIMENT: Record<J.IdBatiment, string> = { relais: 'chope', temple: 'soin', salle: 'epee', forge: 'enclume', cartographe: 'carte', peage: 'pieces', memorial: 'croix' };
const SERVENT_UN_HEROS: ReadonlySet<Service> = new Set(['forge', 'temple', 'salle']);
const niveaux = (n: number, max: number) => `<span class="niveaux" aria-label="palier ${n + 1} sur ${max}">${Array.from({ length: max }, (_, i) => `<i class="${i <= n ? 'plein' : ''}"></i>`).join('')}</span>`;

/** Le cartouche du lieu : son pictogramme, son nom, ce qu'il est. */
export const cartouche = (icone: string, nom: string, sous: string) => `<div class="cartouche">${medaillon(icone, 'grand')}<div><div class="titre gothique">${esc(nom)}</div><div class="sous-titre">${esc(sous)}</div></div></div>`;

/** La colonne des services : une plaque par bâtiment, l'actif armé ; la chronique au pied. */
function colonneDesServices(e: J.Etat, actif: Service) {
  const plaques = J.BATIMENTS.map((b) => plaque(J.enRuine(e.batiments, b.id) ? `${b.nom} · en ruine` : b.nom, `data-a="batiment" data-id="${b.id}"`, { icone: PICTO_DU_BATIMENT[b.id], armee: actif === b.id, taille: 'petite' })).join('');
  return `<div class="services">${plaques}${plaque('Chronique', 'data-a="chronique"', { icone: 'livre', armee: actif === 'chronique', taille: 'petite' })}</div>`;
}

/** L'hôte : le bâtiment à son palier, et ce que l'agrandir lui apporterait. */
function hoteDuBatiment(e: J.Etat, b: J.Batiment) {
  const n = e.batiments[b.id];
  const suivant = b.paliers[n + 1];
  const peut = !!suivant && e.or >= suivant.cout && e.trophees >= suivant.trophees;
  const ruine = J.enRuine(e.batiments, b.id);
  return `<div class="tete-hote">${medaillon(PICTO_DU_BATIMENT[b.id], 'moyen', ruine)}<div><div class="nom-propre petit gothique">${esc(b.role)}</div>${niveaux(n, b.paliers.length)}</div></div>
    <p class="effet">${esc(b.paliers[n].effet)}</p>
    ${suivant ? `<div class="rub">${ruine ? 'Relever' : 'Agrandir'}</div><p class="effet suivant">${esc(suivant.effet)}</p>
      ${plaque(ruine ? 'Relever' : 'Bâtir', `data-a="ameliorer" data-id="${b.id}"`, { icone: 'enclume', prix: `${suivant.cout} CO${suivant.trophees ? ` · ${suivant.trophees} tr.` : ''}`, armee: peut, fermee: !peut, taille: 'petite' })}` : glose('Bâtiment achevé.')}`;
}

// ─── Les pages des services ─────────────────────────────────────────────────────────────────────────────────

/** Une page de service : son corps, qui défile, et son pied, fixe au bas du cadre (l'action principale, une note). */
interface Page { corps: string; pied?: string }
/** Ce qu'une page lit : l'état, le héros servi, et au départ ceux qu'on emmène. */
interface Lecture { e: J.Etat; servi: J.Heros | undefined; choix: ReadonlySet<string> }

function pageDuRelais({ e }: Lecture): Page {
  const candidats = e.candidats.map((c, i) => {
    const gratuit = e.roster.length === 0 && e.or < c.prix;
    return entree({
      icone: 'chope', portrait: busteDuHeros(c), nom: c.c.label, etat: `${J.nomDeCarriere(c.carriere)} · ${J.nomDEspece(c.espece)} · ${c.c.wounds.max} Blessures · CC ${carac(c.c, 'capacite-de-combat')}`,
      apercu: { nom: c.c.label, nature: `${J.nomDeCarriere(c.carriere)} · ${J.nomDEspece(c.espece)}`, texte: J.deviseDe(c.carriere) },
      action: plaque('Engager', `data-a="recruter" data-i="${i}"`, { prix: gratuit ? 'sans solde' : `${c.prix} CO`, taille: 'petite', armee: gratuit || e.or >= c.prix, fermee: !gratuit && e.or < c.prix }),
    });
  }).join('');
  return {
    corps: `<div class="rub">Voyageurs à engager</div>${candidats || glose('Personne au relais : d’autres voyageurs arriveront avec la prochaine diligence.')}`,
    pied: glose('Les provisions du relais s’achètent au départ d’une expédition.'),
  };
}

/** La forge pour le héros servi : ses trois emplacements, et pour chacun ce que la forge propose. */
function pageDeLaForge({ e, servi: h }: Lecture): Page {
  if (!h) return { corps: glose('Personne à équiper.') };
  const p = J.panoplie(h);
  const armes = J.armesEnVente(e);
  const emplacement = (titre: string, porte: J.PieceDecrite | undefined, icone: string, offres: string) => `<section class="emplacement">
    ${caseObjet({ icone: porte ? icone : undefined, nom: porte?.label ?? 'Vide', apercu: porte ? apercuDePiece(titre, porte) : { nom: titre, texte: 'Vide.' } })}
    <div><div class="rub">${titre}</div><div class="offres">${offres}</div></div></section>`;
  const offreDArme = (a: J.Article) => offre({
    nom: a.label, essentiel: [a.degats, a.mains === 2 ? '2 mains' : ''].filter(Boolean).join(' · '), prix: a.prix, or: e.or, portee: a.label === p.main?.label || a.label === p.secondaire?.label,
    apercu: { nom: a.label, nature: `Arme · ${a.prix} CO · Enc. ${a.enc}`, texte: [a.degats && `Dégâts ${a.degats}`, a.mains === 2 && 'deux mains', a.allonge && `allonge ${a.allonge.toLowerCase()}`, a.portee && `portée ${a.portee} m`, a.qualites.join(' · ')].filter(Boolean).join('\n') },
    attrs: `data-a="arme" data-id="${h.c.id}" data-k="${a.id}"`,
  });
  const armures = J.armuresEnVente(e).map((a) => offre({
    nom: a.poids === 'legere' ? 'Légère' : a.poids === 'moyenne' ? 'Moyenne' : 'Lourde', essentiel: `${a.pa} PA · Enc. ${a.enc}`, prix: a.prix, or: e.or, portee: a.label === p.armure?.label,
    apercu: { nom: a.label, nature: `Armure · ${a.prix} CO · Enc. ${a.enc}`, texte: [`${a.pa} PA à chaque emplacement`, a.qualites.join(' · ')].join('\n') }, attrs: `data-a="armure" data-id="${h.c.id}" data-k="${a.poids}"`,
  })).join('');
  return {
    corps: `${emplacement('Main principale', p.main, iconeDArme(p.main?.label ?? ''), armes.filter((a) => a.tenue === 'main').map(offreDArme).join(''))}
      ${emplacement('Main secondaire', p.secondaire, iconeDArme(p.secondaire?.label ?? ''), armes.filter((a) => a.tenue === 'secondaire').map(offreDArme).join(''))}
      ${emplacement('Armure', p.armure, 'armure', armures)}`,
    pied: `${encombrementDe(h.c)}${glose('L’objet remplacé reste au forgeron.')}`,
  };
}

function pageDeLaChapelle({ e, servi: h }: Lecture): Page {
  if (J.prixDuSoin(e) == null) return { corps: glose('La chapelle est en ruine : il faut la relever pour que les sœurs soignent les blessés. En attendant, seuls les héros restés au hameau se reposent.') };
  if (!h) return { corps: glose('Personne à soigner.') };
  return {
    corps: `<div class="rub">Séquelles</div>${etiquettesDeSequelles(h.c) || glose('Aucune séquelle.')}
      <div class="rub">Ce que la chapelle offre</div><div class="offres">${soinsDuHeros(e, h)}</div>`,
    pied: glose('Une séquelle « repos » guérit avec le temps au hameau ; « chirurgie » demande le chirurgien ; « permanente » reste.'),
  };
}

function pageDeLaSalle({ e, servi: h }: Lecture): Page {
  if (!J.niveauMaximal(e)) return { corps: glose('La salle d’armes est en ruine : il faut la relever pour dépenser les PX.') };
  if (!h) return { corps: glose('Personne à entraîner.') };
  const o = J.offresDeCarriere(h);
  return {
    corps: `<div class="bourse-px"><div class="px laiton"><div class="chiffres">${h.c.xp ?? 0}</div></div><div><b>PX à dépenser</b>${glose(`${esc(J.nomDeCarriere(h.carriere))} · niveau ${o.niveau} : ${esc(o.titre)}`)}</div></div>${exigencesDuNiveau(e, h, o)}`,
    pied: `${plaque('Ouvrir la fiche', `data-a="heros" data-id="${h.c.id}" data-k="talents"`, { icone: 'livre', armee: true })}${glose(`La salle d’armes enseigne jusqu’au niveau ${J.niveauMaximal(e)} de carrière.`)}`,
  };
}

function pageDuCartographe({ e }: Lecture): Page {
  const fermees = J.DESTINATIONS.filter((d) => d.palier > e.batiments.cartographe);
  return {
    corps: `<div class="rub">Routes connues</div>${J.destinationsOuvertes(e).map((d) => entree({
      icone: 'route', nom: d.nom, etat: `${d.salles} salles · maître : ${d.boss.map(nomDeCreature).join(' et ')}${e.bossVaincus.includes(d.id) ? ' · purgée' : ''}`,
      apercu: { nom: d.nom, nature: `${d.salles} salles`, texte: d.recit }, action: plaque('Préparer', `data-a="preparer" data-id="${d.id}"`, { icone: 'route', taille: 'petite', armee: true }),
    })).join('')}`,
    ...(fermees.length ? { pied: glose(`Le Cartographe ouvrira ensuite ${esc(fermees[0].nom)}.`) } : {}),
  };
}

const pageDuPeage = ({ e }: Lecture): Page => ({ corps: glose(e.batiments.peage ? 'Les péagers prélèvent leur dû sur les voyageurs du pont, et versent la part de la compagnie à chaque expédition qui franchit au moins une salle.' : 'Le pont est sans barrière : aucun voyageur ne paie.') });

const pageDuJardin = ({ e }: Lecture): Page => ({
  corps: e.cimetiere.length
    ? `<div class="rub">${e.cimetiere.length} tombe${e.cimetiere.length > 1 ? 's' : ''}</div>${e.cimetiere.map((t) => entree({ icone: 'croix', nom: t.nom, etat: `${J.nomDeCarriere(t.carriere)} · ${t.ou} · jour ${t.jour}`, apercu: { nom: t.nom, nature: J.nomDeCarriere(t.carriere), texte: `Tombé·e à ${t.ou}, le jour ${t.jour}, après ${t.expeditions} expédition${t.expeditions > 1 ? 's' : ''}.` } })).join('')}`
    : glose('Aucune tombe encore. Puisse-t-il en rester ainsi.'),
});

const pageDeLaChronique = ({ e }: Lecture): Page => ({ corps: `<ol class="chronique">${e.journal.map((l) => `<li>${esc(l)}</li>`).join('')}</ol>` });

/** Le départ : ceux qu'on emmène (choisis au socle), une rangée chacun (son sac, ses provisions à acheter). */
function pageDuDepart({ e, choix }: Lecture): Page {
  const vente = J.provisionsEnVente(e);
  const groupe = e.roster.filter((h) => choix.has(h.c.id)).map((h) => `<section class="emporte">${portrait(busteDuHeros(h), 'heros', 'petit')}
    <div class="cases-sac">${casesDuSac(h, false) || glose('sac vide')}</div>
    <div class="offres">${vente.map((a) => offre({ nom: `+ ${a.label}`, essentiel: '', prix: a.prix, apercu: apercuDeProvision(a.id), attrs: `data-a="provision" data-id="${h.c.id}" data-k="${a.id}"`, or: e.or })).join('')}</div></section>`).join('');
  return {
    corps: `<div class="rub">Le groupe ${glose('choisissez jusqu’à quatre héros au socle')}</div>${groupe || glose('Personne pour l’instant.')}`,
    pied: `${plaque(`Partir avec ${choix.size} héros`, 'data-a="partir"', { icone: 'route', armee: choix.size > 0, fermee: !choix.size })}${glose('Pendant l’expédition, seuls ceux qui restent au hameau se reposent.')}`,
  };
}

/** Chaque service, sa page. */
const PAGES: Record<Service, (l: Lecture) => Page> = {
  relais: pageDuRelais, forge: pageDeLaForge, temple: pageDeLaChapelle, salle: pageDeLaSalle, cartographe: pageDuCartographe,
  peage: pageDuPeage, memorial: pageDuJardin, chronique: pageDeLaChronique, depart: pageDuDepart,
};

// ─── L'écran ────────────────────────────────────────────────────────────────────────────────────────────────

export function ecranDeService(ctx: Contexte, service: Service): string {
  const { e } = ctx;
  const servi = e.roster.find((h) => h.c.id === ctx.client) ?? e.roster[0];
  const b = J.BATIMENTS.find((x) => x.id === service);
  const destination = service === 'depart' ? J.DESTINATIONS.find((x) => x.id === ctx.dest) : undefined;
  const titre = b ? b.nom : destination ? destination.nom : 'Chronique';
  const sous = b ? `${b.role} · jour ${e.jour}` : destination ? `Départ · ${destination.salles} salles` : `Grisefosse · jour ${e.jour}`;
  const icone = b ? PICTO_DU_BATIMENT[b.id] : destination ? 'route' : 'livre';
  const pourQui = SERVENT_UN_HEROS.has(service) ? servi : undefined;
  const page = PAGES[service]({ e, servi, choix: ctx.choix });
  const ruban = pourQui ? pourQui.c.label : b ? b.role : destination ? 'Le départ' : 'Chronique';
  const socle = service === 'depart'
    ? { heros: e.roster, geste: 'choisir', choisi: (h: J.Heros) => ctx.choix.has(h.c.id), ferme: (h: J.Heros) => !J.disponible(h) }
    : pourQui ? { heros: e.roster, geste: 'client', choisi: (h: J.Heros) => h.c.id === pourQui.c.id } : { heros: e.roster, geste: 'heros', choisi: () => false };
  const hote = b ? hoteDuBatiment(e, b)
    : destination ? `<p class="effet">${esc(destination.recit)}</p><p class="effet">Maître : ${esc(destination.boss.map(nomDeCreature).join(' et '))}</p>${plaque('Autre route', 'data-a="batiment" data-id="cartographe"', { taille: 'petite' })}` : '';
  return ecran({
    nom: titre, classe: 'service',
    cadres: `${cadreA(CADRES.cartouche, cartouche(icone, titre, sous), { fond: '', classe: 'cartouche-lieu-fixe' })}
      ${cadreA(CADRES['colonne-gauche'], colonneDesServices(e, service), { ruban: 'Services de Grisefosse', classe: 'colonne-services' })}
      ${cadreA(CADRES.note, `<div class="ressources"><span class="etiquette compte or">${e.or} CO</span><span class="etiquette compte or">${e.trophees} trophée${e.trophees > 1 ? 's' : ''}</span></div>${glose(pourQui ? 'Choisissez au socle le héros à servir.' : 'On passe d’un service à l’autre sans ressortir.')}`, { classe: 'note-lieu' })}
      ${hote ? cadreA(CADRES.hote, hote, { fond: '', classe: 'hote' }) : ''}
      ${cadreA(CADRES.page, `<div class="corps-service">${page.corps}</div>${page.pied ? `<div class="pied-service">${page.pied}</div>` : ''}`, { ruban: esc(ruban), classe: 'page-service' })}
      <div class="retour" ${place(CADRES.retour)}>${rond('route', 'Retour au hameau', 'data-a="fermer-panneau"')}</div>`,
    socle,
  });
}

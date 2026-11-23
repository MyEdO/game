/**
 * Les deux lieux où l'on se tient, au gabarit commun (`./ecran`, classe `lieu`) posé sur leur décor : le hameau (son
 * panorama et ses enseignes) et l'expédition (la cour du terrain, le groupe debout). Le cartouche, la route, la salle,
 * les sacs et le socle de la compagnie sont aux rectangles des maquettes, les mêmes que ceux des services et de la
 * fiche : rien ne saute d'un écran à l'autre. Un écran ouvert (service, fiche) remplace la scène du lieu ; un carton
 * (récit d'une salle, Recommencer) n'y laisse que le cartouche et le socle.
 */
import * as J from '../jeu';
import { ficheDuSort, nomDeCreature } from '../noyau';
import { dessinerLaCour } from '../cour';
import { figurine } from '../figures';
import { ANCRES, HAUTEUR, LARGEUR, sceneDuHameau } from '../hameau';
import { medaillon, plaque, rondMuet } from '../kit';
import { CADRES, carton, ecran, TAILLES, tailleChoisie, type Taille } from './ecran';
import { cadreA, caseObjet, casesDuSac, esc, gabaritDe, glose, herosEnLigne, place } from './pieces';
import { cartouche, PICTO_DU_BATIMENT } from './services';

/** Un tableau de la cour du `terrain` où se tiennent les figurines des `heros` ; mis à l'échelle par `ajusterLesTableaux`. */
export function tableau(terrain: string, heros: J.Heros[], classe: string): string {
  const c = dessinerLaCour(7, 4, terrain);
  const figs = heros.map((h, i) => {
    const [px, py] = c.centre(2 + (i % 2) * 2, i, 1);
    return `<div class="fig camp-heros${J.valide(h) ? '' : ' hors'}" style="left:${px - 50}px;top:${py - 130}px;z-index:${Math.round(py)}">${figurine(gabaritDe(h), 'heros')}</div>`;
  }).join('');
  const { x, y, largeur, hauteur } = c.cadrage;
  return `<div class="tableau ${classe}" data-cadrage="${x} ${y} ${largeur} ${hauteur}" aria-hidden="true"><div class="cour" style="width:${c.largeur}px;height:${c.hauteur}px">${c.svg}<div class="figures">${figs}</div></div></div>`;
}

/** Cadre chaque tableau : il couvre son fond (`fond-expe`) ou tient dans sa vignette. */
export function ajusterLesTableaux(): void {
  document.querySelectorAll<HTMLElement>('.tableau').forEach((t) => {
    const [x, y, l, h] = (t.dataset.cadrage ?? '').split(' ').map(Number);
    const couvre = t.classList.contains('fond-expe');
    const k = (couvre ? Math.max : Math.min)(t.clientWidth / l, t.clientHeight / h);
    t.querySelector<HTMLElement>('.cour')!.style.transform = `translate(${(t.clientWidth - l * k) / 2}px, ${(t.clientHeight - h * k) / 2}px) scale(${k}) translate(${-x}px, ${-y}px)`;
  });
}

const ressources = (...e: string[]) => `<div class="ressources">${e.map((x) => `<span class="etiquette compte or">${x}</span>`).join('')}</div>`;

function enseigne(e: J.Etat, b: J.Batiment) {
  const [x, y] = ANCRES[b.id];
  const suivant = b.paliers[e.batiments[b.id] + 1];
  const peutBatir = !!suivant && e.or >= suivant.cout && e.trophees >= suivant.trophees;
  const ruine = J.enRuine(e.batiments, b.id);
  return `<button type="button" class="enseigne${ruine ? ' ruine' : ''}" style="left:${(100 * x) / LARGEUR}%;top:${(100 * y) / HAUTEUR}%" data-a="batiment" data-id="${b.id}">
    ${medaillon(PICTO_DU_BATIMENT[b.id], 'petit', ruine)}<span><span class="nom gothique">${esc(b.nom)}</span><span class="sous">${ruine ? 'en ruine' : b.role}</span></span>${peutBatir ? '<i class="pastille-batir" data-bulle="Vous pouvez bâtir"></i>' : ''}</button>`;
}

/** Le panneau d'activité du hameau : les routes ouvertes et leur choix ; quand personne n'est en état de partir,
 *  l'attente d'une semaine à sa place. */
function partir(e: J.Etat): string {
  const ouvertes = J.destinationsOuvertes(e).length;
  const pluriel = (n: number, mot: string) => `${n} ${mot}${n > 1 ? 's' : ''}`;
  if (J.compagnieEpuisee(e)) {
    return `<div class="partir"><div><div class="nom-propre petit gothique">Personne n’est en état de partir</div><div class="sous-titre">la compagnie panse ses plaies</div></div>${plaque('Attendre une semaine', 'data-a="attendre"', { icone: 'lune', armee: true })}</div>`;
  }
  const maitres = J.DESTINATIONS.map((d) => `<i class="${e.bossVaincus.includes(d.id) ? 'plein' : ''}" data-bulle="${esc(d.nom)}"></i>`).join('');
  return `<div class="partir"><div><div class="nom-propre petit gothique">Abattre l’Autel du Chaos</div><div class="but"><span class="niveaux" aria-label="${pluriel(e.bossVaincus.length, 'maître')} vaincu${e.bossVaincus.length > 1 ? 's' : ''} sur ${J.DESTINATIONS.length}">${maitres}</span><span class="sous-titre">${pluriel(ouvertes, 'route')} ouverte${ouvertes > 1 ? 's' : ''}</span></div></div>${plaque('Choisir une route', 'data-a="ouvrir-depart"', { icone: 'route', armee: true })}</div>`;
}

/** Le hameau : son panorama et ses enseignes, et par-dessus sa scène (cartouche, dernier récit, départ, coins, socle). */
export function ecranDuHameau(e: J.Etat, ouvert: string, carte: string): string {
  const titre = cadreA(CADRES.cartouche, cartouche('ville', 'Grisefosse', `Hameau du Reikland · jour ${e.jour}`), { fond: '', classe: 'cartouche-lieu-fixe' });
  const scene = (!carte && ouvert) || ecran({
    nom: 'Grisefosse', classe: 'lieu',
    cadres: carte ? titre + carte : `${titre}
      <div class="recit-lieu" ${place(CADRES.recit)}>${ressources(`${e.or} CO`, `${e.trophees} trophée${e.trophees > 1 ? 's' : ''}`)}<p class="ombre">${esc(e.journal[0]?.replace(/^Jour \d+ — /, '') ?? '')}</p></div>
      ${cadreA(CADRES.vignette, partir(e), { ruban: 'Partir', classe: 'carte-partir' })}
      <div class="coins" ${place(CADRES.coins)}>${rondMuet('livre', 'Chronique', 'data-a="chronique"')}${rondMuet('systeme', 'Réglages', 'data-a="reglages"')}</div>`,
    socle: { heros: e.roster, geste: 'heros', choisi: () => false, progresse: (h) => J.peutProgresser(e, h) },
    vide: 'La compagnie est vide. Engagez des voyageurs au relais de diligence : quand la bourse est vide, l’un d’eux sert sans solde.',
  });
  return `<div class="ecran hameau">
    <div class="panorama"><div class="toile">${sceneDuHameau(e.batiments)}${ouvert || carte ? '' : J.BATIMENTS.map((b) => enseigne(e, b)).join('')}</div></div>
    ${J.victoireFinale(e) ? '<div class="bandeau-victoire gothique">L’Autel du Chaos est tombé</div>' : ''}
    ${scene}
  </div>`;
}

export const NOM_DE_SALLE: Record<J.TypeDeSalle, string> = { combat: 'Embuscade', elite: 'Élite', camp: 'Camp', tresor: 'Cache', boss: 'Maître' };
export const PICTO_DE_SALLE: Record<J.TypeDeSalle, string> = { combat: 'epee', elite: 'bouclier', camp: 'tente', tresor: 'bourse', boss: 'couronne' };

/** Les sacs du groupe : une rangée par héros ; un clic sur une case utilise l'objet ; la Bénédiction de Guérison d'un
 *  Béni est une case de plus, une fois par expédition, sur le plus blessé. */
function sacsDuGroupe(e: J.Etat, groupe: J.Heros[]) {
  const plusBlesse = groupe.filter((x) => !x.c.dead).sort((a, b) => a.c.wounds.current / a.c.wounds.max - b.c.wounds.current / b.c.wounds.max)[0];
  const f = ficheDuSort('benediction-de-guerison');
  return `<div class="sacs">${groupe.map((h) => {
    const priere = (h.c.spells ?? []).includes('benediction-de-guerison') ? caseObjet({
      icone: 'soin', nom: f.label, apercu: { nom: f.label, nature: f.nature, texte: f.texte },
      ...(plusBlesse ? { attrs: `data-a="prier" data-id="${h.c.id}" data-k="${plusBlesse.c.id}"` } : {}),
      refus: !J.peutPrier(e, h) ? 'Déjà priée pendant cette expédition, ou le Béni est hors de combat.' : !plusBlesse || plusBlesse.c.wounds.current >= plusBlesse.c.wounds.max ? 'Personne n’est blessé.' : null,
    }) : '';
    return `<div class="sac-heros">${herosEnLigne(h)}<div class="cases-sac">${casesDuSac(h, true) + priere || glose('sac vide')}</div></div>`;
  }).join('')}</div>`;
}

/** L'expédition : la cour du terrain, et par-dessus sa scène (cartouche, sacs, salle, route, socle du groupe). */
export function ecranDeLExpedition(e: J.Etat, ouvert: string, carte: string): string {
  const x = e.expedition!;
  const d = J.destinationCourante(e)!;
  const salle = x.salles[x.index];
  const groupe = J.herosDuGroupe(e);
  const valides = groupe.filter(J.valide).length;
  const annonce = salle.type === 'camp' ? 'Un abri se devine entre les arbres. Le groupe pourra y passer la nuit.'
    : salle.type === 'tresor' ? 'Des pierres semblent avoir été déplacées.'
    : `Devant : ${salle.ennemis.map(nomDeCreature).join(', ')}.`;
  const appel = salle.type === 'boss' ? 'Affronter le maître' : salle.type === 'camp' ? 'Camper' : salle.type === 'tresor' ? 'Fouiller' : 'Engager le combat';
  const titre = cadreA(CADRES.cartouche, cartouche('route', d.nom, `Salle ${x.index + 1} sur ${x.salles.length} · jour ${e.jour + x.index}`), { fond: '', classe: 'cartouche-lieu-fixe' });
  const scene = (!carte && ouvert) || ecran({
    nom: d.nom, classe: 'lieu',
    cadres: carte ? titre + carte : `${titre}
      ${cadreA(CADRES['colonne-gauche'], sacsDuGroupe(e, groupe), { ruban: 'Sacs', classe: 'colonne-sacs' })}
      ${cadreA(CADRES['colonne-droite'], `${ressources(`${x.or} CO`, `${x.trophees} trophée${x.trophees > 1 ? 's' : ''}`, `${x.px} PX chacun`)}<div class="nom-propre grand gothique">${NOM_DE_SALLE[salle.type]}</div><p class="glose consigne">${esc(annonce)}</p>
        ${valides < groupe.length ? glose(`${groupe.length - valides} héros hors de combat ne se battront pas tant qu’ils n’auront pas récupéré.`, 'avertissement') : ''}
        <div class="gestes colonne pied-salle">${plaque(appel, 'data-a="avancer"', { icone: PICTO_DE_SALLE[salle.type], armee: !!valides, fermee: !valides, taille: 'appel' })}${plaque('Rentrer au hameau', 'data-a="rentrer"', { icone: 'route' })}</div>`, { classe: 'carte-salle' })}
      <ol class="frise-route" ${place(CADRES.frise)}>${x.salles.map((s, i) => `<li class="${s.faite ? 'faite' : ''}${i === x.index ? ' ici' : ''}" data-bulle="${NOM_DE_SALLE[s.type]}">${medaillon(PICTO_DE_SALLE[s.type], 'petit', s.faite)}</li>`).join('')}</ol>`,
    socle: { heros: groupe, geste: 'heros', choisi: () => false },
    vide: 'Personne.',
  });
  return `<div class="ecran expedition">${tableau(d.id, groupe, 'fond-expe')}${scene}</div>`;
}

/** Le récit d'une salle franchie, ou du retour, en carton ; la défaite colore sa première ligne. */
export function recitEnCarton(r: J.RecitDeSalle, o: { ruban: string; picto: string; surTitre: string }): string {
  return carton({
    ruban: o.ruban, picto: o.picto, titre: r.titre, surTitre: o.surTitre,
    texte: `<div class="recit ${r.fin ?? ''}">${r.lignes.map((l) => `<p>${esc(l)}</p>`).join('')}</div>`,
    gestes: `${r.combat ? plaque('Revoir le combat', 'data-a="revoir"', { icone: 'oeil' }) : ''}${plaque('Continuer', 'data-a="fermer"', { armee: true })}`,
  });
}

/** Les réglages : la taille de l'interface, et Recommencer. */
export function reglagesEnCarton(): string {
  const noms: Record<Taille, string> = { petite: 'Petite', moyenne: 'Moyenne', grande: 'Grande' };
  const actuelle = tailleChoisie();
  return carton({
    ruban: 'Réglages', picto: 'systeme', titre: 'Réglages', surTitre: 'Grisefosse',
    texte: `<div class="rub">Taille de l’interface</div><div class="gestes">${(Object.keys(TAILLES) as Taille[]).map((t) => plaque(noms[t], `data-a="taille" data-k="${t}"`, { armee: t === actuelle, taille: 'petite' })).join('')}</div>
      <div class="rub">La partie</div><div class="gestes">${plaque('Recommencer…', 'data-a="reset"', { icone: 'sablier', taille: 'petite' })}</div>`,
    gestes: plaque('Fermer', 'data-a="fermer"', { armee: true }),
  });
}

/** Recommencer : la partie effacée, ou gardée. */
export function recommencerEnCarton(): string {
  return carton({
    ruban: 'Recommencer', titre: 'Recommencer ?', surTitre: 'Grisefosse',
    picto: 'sablier',
    texte: '<div class="recit"><p>Le hameau, la compagnie et le Jardin de Morr seront effacés.</p></div>',
    gestes: `${plaque('Garder ma partie', 'data-a="fermer"', { armee: true })}${plaque('Tout effacer', 'data-a="reset-ok"')}`,
  });
}

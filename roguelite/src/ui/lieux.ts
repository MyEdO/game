/**
 * Les deux lieux où l'on se tient, au gabarit commun (`./ecran`, classe `lieu`) posé sur leur décor : le hameau (son
 * panorama et ses enseignes) et l'expédition (la cour du terrain, le groupe debout). Le cartouche, la route, la salle,
 * les sacs et le socle de la compagnie sont aux rectangles des maquettes, les mêmes que ceux des services et de la
 * fiche : rien ne saute d'un écran à l'autre. Un écran ouvert (service, fiche) remplace la scène du lieu.
 */
import * as J from '../jeu';
import { ficheDuSort, nomDeCreature } from '../combat';
import { dessinerLaCour } from '../cour';
import { figurine } from '../figures';
import { ANCRES, HAUTEUR, LARGEUR, sceneDuHameau } from '../hameau';
import { medaillon, plaque, portrait, rond } from '../kit';
import { CADRES, ecran } from './ecran';
import { busteDuHeros, cadreA, caseObjet, casesDuSac, esc, gabaritDe, glose } from './pieces';
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

/** Le hameau : son panorama et ses enseignes, et par-dessus sa scène (cartouche, dernier récit, départ, coins, socle). */
export function ecranDuHameau(e: J.Etat, ouvert: string): string {
  const ouvertes = J.destinationsOuvertes(e).length;
  const scene = ouvert || ecran({
    nom: 'Grisefosse', classe: 'lieu',
    cadres: `${cadreA(CADRES.cartouche, cartouche('ville', 'Grisefosse', `Hameau du Reikland · jour ${e.jour}`), { fond: '', classe: 'cartouche-lieu-fixe' })}
      <div class="recit-lieu" style="left:${CADRES.recit[0]}px;top:${CADRES.recit[1]}px;width:${CADRES.recit[2]}px">${ressources(`${e.or} CO`, `${e.trophees} trophée${e.trophees > 1 ? 's' : ''}`)}<p class="ombre">${esc(e.journal[0]?.replace(/^Jour \d+ — /, '') ?? '')}</p></div>
      ${cadreA([CADRES['colonne-droite'][0], 20, 360, 132], `<div class="partir"><div><div class="nom-propre petit gothique">${ouvertes} route${ouvertes > 1 ? 's' : ''} ouverte${ouvertes > 1 ? 's' : ''}</div><div class="sous-titre">${e.bossVaincus.length} maître${e.bossVaincus.length > 1 ? 's' : ''} vaincu${e.bossVaincus.length > 1 ? 's' : ''}</div></div>${plaque('Choisir une route', 'data-a="ouvrir-depart"', { icone: 'route', armee: true })}</div>`, { ruban: 'Partir', classe: 'carte-partir' })}
      <div class="coins" style="left:${CADRES.coins[0]}px;top:${CADRES.coins[1]}px">${J.compagnieEpuisee(e) ? rond('lune', 'Attendre une semaine', 'data-a="attendre"', 'moyen') : ''}${rond('livre', 'Chronique', 'data-a="chronique"', 'moyen')}${rond('sablier', 'Recommencer', 'data-a="reset"', 'moyen')}</div>`,
    socle: { heros: e.roster, geste: 'heros', choisi: () => false },
    vide: 'La compagnie est vide. Engagez des voyageurs au relais de diligence : quand la bourse est vide, l’un d’eux sert sans solde.',
  });
  return `<div class="ecran hameau">
    <div class="panorama"><div class="toile">${sceneDuHameau(e.batiments)}${ouvert ? '' : J.BATIMENTS.map((b) => enseigne(e, b)).join('')}</div></div>
    ${J.victoireFinale(e) ? '<div class="bandeau-victoire gothique">L’Autel du Chaos est tombé</div>' : ''}
    ${scene}
  </div>`;
}

const NOM_DE_SALLE: Record<J.TypeDeSalle, string> = { combat: 'Embuscade', elite: 'Élite', camp: 'Camp', tresor: 'Cache', boss: 'Maître' };
const PICTO_DE_SALLE: Record<J.TypeDeSalle, string> = { combat: 'epee', elite: 'bouclier', camp: 'tente', tresor: 'bourse', boss: 'couronne' };

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
    return `<div class="sac-heros">${portrait(busteDuHeros(h), 'heros', 'petit', J.valide(h) ? '' : 'hors')}<div class="cases-sac">${casesDuSac(h, true) + priere || glose('sac vide')}</div></div>`;
  }).join('')}</div>`;
}

/** L'expédition : la cour du terrain, et par-dessus sa scène (cartouche, sacs, salle, route, socle du groupe). */
export function ecranDeLExpedition(e: J.Etat, ouvert: string): string {
  const x = e.expedition!;
  const d = J.destinationCourante(e)!;
  const salle = x.salles[x.index];
  const groupe = J.herosDuGroupe(e);
  const valides = groupe.filter(J.valide).length;
  const annonce = salle.type === 'camp' ? 'Un abri se devine entre les arbres. Le groupe pourra y passer la nuit.'
    : salle.type === 'tresor' ? 'Des pierres semblent avoir été déplacées.'
    : `Devant : ${salle.ennemis.map(nomDeCreature).join(', ')}.`;
  const appel = salle.type === 'boss' ? 'Affronter le maître' : salle.type === 'camp' ? 'Camper' : salle.type === 'tresor' ? 'Fouiller' : 'Engager le combat';
  const scene = ouvert || ecran({
    nom: d.nom, classe: 'lieu',
    cadres: `${cadreA(CADRES.cartouche, cartouche('route', d.nom, `Salle ${x.index + 1} sur ${x.salles.length} · jour ${e.jour + x.index}`), { fond: '', classe: 'cartouche-lieu-fixe' })}
      ${cadreA(CADRES['colonne-gauche'], sacsDuGroupe(e, groupe), { ruban: 'Sacs', classe: 'colonne-sacs' })}
      ${cadreA([CADRES['colonne-droite'][0], 20, 360, 300], `${ressources(`${x.or} CO`, `${x.trophees} trophée${x.trophees > 1 ? 's' : ''}`, `${x.px} PX chacun`)}<div class="nom-propre grand gothique">${NOM_DE_SALLE[salle.type]}</div><p class="glose consigne">${esc(annonce)}</p>
        <div class="gestes colonne">${plaque(appel, 'data-a="avancer"', { icone: PICTO_DE_SALLE[salle.type], armee: !!valides, fermee: !valides, taille: 'appel' })}${plaque('Rentrer au hameau', 'data-a="rentrer"', { icone: 'route' })}</div>
        ${valides < groupe.length ? glose(`${groupe.length - valides} héros hors de combat ne se battront pas tant qu’ils n’auront pas récupéré.`, 'avertissement') : ''}`, { classe: 'carte-salle' })}
      ${cadreA(CADRES.frise, `<ol class="piste">${x.salles.map((s, i) => `<li class="${s.faite ? 'faite' : ''}${i === x.index ? ' ici' : ''}" data-bulle="${NOM_DE_SALLE[s.type]}">${medaillon(PICTO_DE_SALLE[s.type], i === x.index ? 'moyen' : 'petit', s.faite)}</li>`).join('')}</ol>`, { fond: '', classe: 'frise-route' })}`,
    socle: { heros: groupe, geste: 'heros', choisi: () => false },
    vide: 'Personne.',
  });
  return `<div class="ecran expedition">${tableau(d.id, groupe, 'fond-expe')}${scene}</div>`;
}

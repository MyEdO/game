/**
 * Les pièces communes de l'interface, montées sur le kit (`../kit`) : le texte échappé, la note, la vie, les États,
 * les séquelles, le portrait d'un héros, sa carte, et les trois façons de montrer une chose qu'on possède ou qu'on
 * achète — l'entrée (Talent, sort, provision), la case d'objet (arme, armure, provision), l'offre de boutique. Chacune
 * porte son aperçu au survol (`data-apercu`, posé par `./bulles`) : son nom, sa nature, le texte du livre.
 */
import * as J from '../jeu';
import { articleDuCatalogue, encombrement, libelleDEtat, sequelles, type Combatant } from '../combat';
import { armeDuLibelle, buste, gabaritDuHeros } from '../figures';
import { cadre, jauge, medaillon, picto, plaque, portrait } from '../kit';

export const esc = (s: unknown) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
/** La note du kit : une précision, une aide (`courante`), ou un coût, un refus (`avertissement`). */
export const glose = (texte: string, variante: 'courante' | 'avertissement' = 'courante') => `<span class="glose ${variante}">${texte}</span>`;

/** Ce qu'un aperçu montre : le nom, ce qu'il est, le texte (du livre, ou des chiffres), et au pied un refus. */
export interface Apercu { nom: string; nature?: string; texte?: string; pied?: string }
export const apercuDe = (a: Apercu) => ` data-apercu="${esc(JSON.stringify(a))}"`;

// ─── Le héros ───────────────────────────────────────────────────────────────────────────────────────────────

export const gabaritDe = (h: Pick<J.Heros, 'carriere' | 'espece' | 'c'>) => gabaritDuHeros(h.carriere, h.espece, h.c.weapons.map((w) => w.label));
/** Le portrait d'un héros : le buste de sa figurine. */
export const busteDuHeros = (h: Pick<J.Heros, 'carriere' | 'espece' | 'c'>) => buste(gabaritDe(h), 'heros');
export const ligneDeVie = (c: Combatant) => `<span class="vie"><span>Blessures</span><span class="chiffres">${Math.max(0, c.wounds.current)} / ${c.wounds.max}</span></span>${jauge(Math.max(0, c.wounds.current) / Math.max(1, c.wounds.max), { taille: 'forte' })}`;
export const etats = (c: Combatant) => (c.conditions.length ? `<div class="etats">${c.conditions.map((e) => `<span class="etiquette rectangle cire">${esc(libelleDEtat(e.id, e.value))}</span>`).join('')}</div>` : '');

/** La carte d'un héros : portrait, nom, carrière, vie, état. `geste` : ce qu'un clic fait (ouvrir sa fiche, le
 *  servir, l'emmener) ; `ferme` : il n'est pas disponible pour ce geste. */
export function carteDeHeros(h: J.Heros, choisi: boolean, geste = 'heros', ferme = false) {
  const c = h.c;
  return `<button type="button" class="carte-heros${J.valide(h) ? '' : ' hors'}${choisi ? ' choisi' : ''}" data-a="${geste}" data-id="${c.id}"${ferme ? ' disabled' : ''}>
    ${portrait(busteDuHeros(h), 'heros', 'grand', choisi ? 'choisi' : '')}
    <span class="qui"><span class="nom-propre petit gothique">${esc(c.label)}</span><span class="sous-titre">${esc(J.nomDeCarriere(h.carriere))}</span>
    ${ligneDeVie(c)}<span class="ligne-etat">${c.conditions.length ? esc(c.conditions.map((e) => libelleDEtat(e.id, e.value)).join(', ')) : h.retrait ? `à l’hospice · ${h.retrait} j` : J.valide(h) ? `${c.xp ?? 0} PX · Destin ${c.fate ?? 0}` : 'hors de combat'}</span></span>
  </button>`;
}

/** L'encombrement porté et sa jauge ; au-delà de la capacité, ses pénalités. LDB 61 l.35-40 */
export function encombrementDe(c: Combatant) {
  const e = encombrement(c);
  const trop = e.porte > e.capacite;
  return `<div class="rub">Encombrement ${glose(`${e.porte} / ${e.capacite}${trop ? (e.immobile ? ' · immobilisé' : ` · Mouvement −${e.mouvement}, Agilité −${Math.abs(e.agilite)}`) : ''}`, trop ? 'avertissement' : 'courante')}</div>
    ${jauge(Math.min(1, e.porte / Math.max(1, e.capacite)), { teinte: trop ? 'cire' : 'or', taille: 'forte' })}`;
}

/** Les séquelles en étiquettes : une par nature (×N si plusieurs) et son issue ; le texte du livre au survol. */
export function etiquettesDeSequelles(c: Combatant) {
  const groupes = new Map<string, { n: number; jours?: number; chirurgie: boolean; desc?: string }>();
  for (const q of sequelles(c)) {
    const g = groupes.get(q.label);
    if (g) { g.n++; if (q.jours != null) g.jours = Math.max(g.jours ?? 0, q.jours); } else groupes.set(q.label, { n: 1, jours: q.jours, chirurgie: q.chirurgie, desc: q.desc });
  }
  const issue = (g: { jours?: number; chirurgie: boolean }) => (g.jours != null ? `repos ${g.jours} j` : g.chirurgie ? 'chirurgie' : 'permanente');
  return groupes.size ? `<div class="etiquettes-sequelles" aria-label="Séquelles">${[...groupes].map(([label, g]) =>
    `<span class="etiquette sequelle${g.jours == null && !g.chirurgie ? ' permanente' : ''}"${apercuDe({ nom: label, nature: `Séquelle · ${issue(g)}`, texte: g.desc })}>${esc(label)}${g.n > 1 ? ` ×${g.n}` : ''} · ${issue(g)}</span>`).join('')}</div>` : '';
}

// ─── Ce qu'on possède ou qu'on achète ───────────────────────────────────────────────────────────────────────

/** Une entrée : médaillon, nom, état ; une action à droite (une plaque) ; l'aperçu au survol. Talents, sorts,
 *  provisions et prières s'y montrent de la même façon. */
export function entree(o: { icone: string; nom: string; etat: string; acquis?: boolean; ferme?: boolean; action?: string; apercu: Apercu }) {
  return `<div class="talent${o.acquis ? ' acquis' : ''}${o.ferme ? ' clos' : ''}"${apercuDe(o.apercu)}>${medaillon(o.icone, 'moyen', !!o.ferme)}<div class="t"><div class="nom-propre petit gothique">${esc(o.nom)}</div><i>${esc(o.etat)}</i></div>${o.action ?? ''}</div>`;
}

const PICTO_D_ARME: Record<string, string> = { 'grande-epee': 'epee', massue: 'marteau', fronde: 'arc' };
export const iconeDArme = (label: string) => (/bouclier/i.test(label) ? 'bouclier' : PICTO_D_ARME[armeDuLibelle(label) ?? 'epee'] ?? armeDuLibelle(label) ?? 'epee');
export const iconeDeProvision = (id: string) => (id.startsWith('potion') ? 'fiole' : 'pot');

/** Une case d'objet : son pictogramme, son compte, son nom dessous, son aperçu ; `attrs` en fait un bouton, `refus`
 *  le ferme et se dit au pied de l'aperçu. Sans icône, la case est vide. */
export function caseObjet(o: { icone?: string; nom: string; apercu: Apercu; compte?: number; attrs?: string; refus?: string | null; taille?: 'grande' | 'petite' }) {
  const vide = !o.icone;
  const corps = `${vide ? '' : picto(o.icone!, o.taille === 'grande' ? 30 : 22, 1.6)}${o.compte && o.compte > 1 ? `<em class="chiffres">${o.compte}</em>` : ''}`;
  const apercu = apercuDe(o.refus ? { ...o.apercu, pied: o.refus } : o.apercu);
  const boite = o.attrs
    ? `<button type="button" class="boite-objet" ${o.attrs}${apercu}${o.refus ? ' disabled' : ''}>${corps}</button>`
    : `<span class="boite-objet"${apercu}>${corps}</span>`;
  return `<div class="case-objet ${o.taille ?? 'petite'}${vide ? ' vide' : ''}">${boite}<span class="nom-objet">${esc(o.nom)}</span></div>`;
}

/** L'essentiel d'une pièce portée, en une ligne de chiffres. */
export const essentielDe = (x: J.PieceDecrite) => [x.degats && `Dégâts ${x.degats}`, x.mains === 2 && 'deux mains', x.allonge && `allonge ${x.allonge.toLowerCase()}`, x.portee && `portée ${x.portee} m`, x.pa != null && `${x.pa} PA à chaque emplacement`].filter(Boolean).join(' · ');
/** L'aperçu d'une pièce portée : son nom, ce qu'elle est, ses chiffres et ses qualités. */
export const apercuDePiece = (titre: string, x: J.PieceDecrite): Apercu => ({ nom: x.label, nature: titre, texte: [essentielDe(x), x.qualites.join(' · ')].filter(Boolean).join('\n') });
/** L'aperçu d'une provision : son nom et le texte du catalogue. */
export const apercuDeProvision = (id: string): Apercu => { const a = articleDuCatalogue(id); return { nom: a.label, nature: 'Provision', texte: a.desc }; };

/** Le sac d'un héros en cases ; `utilisable` : un clic utilise l'objet (en expédition). */
export const casesDuSac = (h: J.Heros, utilisable: boolean) => J.provisionsPortees(h).map((q) => caseObjet({
  icone: iconeDeProvision(q.id), nom: q.label, apercu: apercuDeProvision(q.id), compte: q.nombre,
  ...(utilisable ? { attrs: `data-a="utiliser" data-id="${h.c.id}" data-k="${q.uid}"`, refus: q.refus } : {}),
})).join('');

/** Une offre de boutique en pastille : le nom, l'essentiel, le prix ; l'aperçu au survol. Fermée faute d'or, ou si
 *  c'est ce que le héros porte déjà. */
export const offre = (o: { nom: string; essentiel: string; prix: number; apercu: Apercu; attrs: string; or: number; portee?: boolean }) =>
  `<button type="button" class="offre${o.portee ? ' actuelle' : ''}" ${o.attrs}${apercuDe(o.apercu)}${o.portee || o.or < o.prix ? ' disabled' : ''}><b>${esc(o.nom)}</b><span>${esc(o.essentiel)}</span><i class="prix">${o.portee ? 'porté' : o.prix}</i></button>`;

/** Ce que la chapelle offre au héros : soins complets, plaies pansées, opération, Larmes de Shallya. */
export function soinsDuHeros(e: J.Etat, h: J.Heros) {
  if (h.retrait) return glose(`à l’hospice encore ${h.retrait} jour${h.retrait > 1 ? 's' : ''}`);
  const soin = J.prixDuSoin(e);
  const larmes = J.prixDeSequelle(e);
  const acte = (nom: string, essentiel: string, prix: number, texte: string, attrs: string) => offre({ nom, essentiel, prix, apercu: { nom, nature: `Chapelle de Shallya · ${essentiel}`, texte }, attrs, or: e.or });
  const tout = [
    J.blesse(h) && soin != null ? acte('Soigner', 'PB et États', soin, 'Tous les Points de Blessure, et les États de la rencontre.', `data-a="soigner" data-id="${h.c.id}"`) : '',
    ...J.actesPossibles(h).map((a) => {
      const prix = J.prixDeLHospice(e, a);
      return prix == null ? '' : a === 'panser'
        ? acte('Panser', 'dans la journée', prix, 'Les sœurs pansent les plaies : une déchirure mineure guérit plus vite, une fracture est réduite. LDB 18 l.204, l.222', `data-a="hospice" data-id="${h.c.id}" data-k="panser"`)
        : acte('Opérer', 'une semaine à l’hospice', prix, 'Le chirurgien opère les blessures qui l’exigent : plaie d’amputation, fracture majeure, artère. LDB 18 l.208, l.239', `data-a="hospice" data-id="${h.c.id}" data-k="operer"`);
    }),
    larmes != null && J.sequellesGuerissables(h) ? acte('Larmes de Shallya', 'une séquelle', larmes, 'Le miracle guérit une Blessure critique de convalescence, jamais une amputation. LDB 42', `data-a="sequelle" data-id="${h.c.id}"`) : '',
  ].join('');
  return tout || glose('rien à soigner');
}

/** Un cadre du kit posé à son rectangle d'une scène fixe (`CADRES` des maquettes). */
export const cadreA = (rect: [number, number, number, number], contenu: string, o: { ruban?: string; fond?: string; classe?: string; tete?: string } = {}) =>
  `<div class="place-cadre" style="left:${rect[0]}px;top:${rect[1]}px;width:${rect[2]}px;height:${rect[3]}px">${cadre(contenu, { fond: o.fond ?? 'parchemin', ruban: o.ruban ?? '', classe: `pan ${o.classe ?? ''}`, balise: 'div', tete: o.tete ?? '' })}</div>`;
/** Les onglets du kit sur le bord haut d'un cadre : l'actif est le ruban, les autres des plaques. */
export const onglets = (noms: [string, string][], actif: string) => `<div class="onglets">${noms.map(([id, nomme]) => (id === actif ? `<div class="ruban gothique">${nomme}</div>` : plaque(nomme, `data-a="onglet" data-k="${id}"`, { taille: 'petite' }))).join('')}</div>`;

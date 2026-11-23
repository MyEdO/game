/**
 * Les pièces communes de l'interface, montées sur le kit (`../kit`) : le texte échappé, la note, la vie, les États,
 * les séquelles, le portrait d'un héros, sa carte, les deux façons de montrer une chose qu'on possède — l'entrée
 * (Talent, sort, provision), la case d'objet (arme, armure, provision) — et le geste d'achat, seule forme d'un prix :
 * une plaque « verbe · prix », fermée avec sa raison au survol. Chaque chose porte son aperçu au survol
 * (`data-apercu`, posé par `./bulles`) : son nom, sa nature, le texte du livre.
 */
import * as J from '../jeu';
import { articleDuCatalogue, encombrement, libelleDEtat, sequelles, type Combatant, type Qualite } from '../noyau';
import { armeDuLibelle, buste, gabaritDuHeros } from '../figures';
import { cadre, jauge, medaillon, picto, plaque, portrait } from '../kit';

export const esc = (s: unknown) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
/** La note du kit : une précision, une aide (`courante`), ou un coût, un refus (`avertissement`). */
export const glose = (texte: string, variante: 'courante' | 'avertissement' = 'courante') => `<span class="glose ${variante}">${texte}</span>`;

/** Ce qu'un aperçu montre : le nom, ce qu'il est, le texte (du livre, ou des chiffres), et au pied un refus. */
export interface Apercu { nom: string; nature?: string; texte?: string; pied?: string }
export const apercuDe = (a: Apercu) => ` data-apercu="${esc(JSON.stringify(a))}"`;

// ─── Le héros ───────────────────────────────────────────────────────────────────────────────────────────────

export const gabaritDe = (h: Pick<J.Heros, 'carriere' | 'espece' | 'c'>) => gabaritDuHeros(h.carriere, h.espece, J.allure(h));
/** Le portrait d'un héros : le buste de sa figurine. */
export const busteDuHeros = (h: Pick<J.Heros, 'carriere' | 'espece' | 'c'>) => buste(gabaritDe(h), 'heros');
export const ligneDeVie = (c: Combatant) => `<span class="vie"><span>Blessures</span><span class="chiffres">${Math.max(0, c.wounds.current)} / ${c.wounds.max}</span></span>${jauge(Math.max(0, c.wounds.current) / Math.max(1, c.wounds.max), { taille: 'forte' })}`;
export const etats = (c: Combatant) => (c.conditions.length ? `<div class="etats">${c.conditions.map((e) => `<span class="etiquette rectangle cire">${esc(libelleDEtat(e.id, e.value))}</span>`).join('')}</div>` : '');

/** La carte d'un héros : portrait, nom, rôle et carrière, vie, état ; son identité au survol. `geste` : ce qu'un
 *  clic fait (ouvrir sa fiche, le servir, l'emmener) ; `refus` : pourquoi il n'est pas disponible pour ce geste ;
 *  `progresse` : il peut acheter un avancement. */
export function carteDeHeros(h: J.Heros, choisi: boolean, geste = 'heros', o: { refus?: string | null; progresse?: boolean } = {}) {
  const c = h.c;
  const role = J.roleDe(h.carriere);
  const r = role && J.ROLES[role];
  const identite: Apercu = { nom: c.label, nature: [J.nomDeCarriere(h.carriere), r?.nom, J.nomDEspece(h.espece)].filter(Boolean).join(' · '), texte: J.deviseDe(h.carriere), ...(o.refus ? { pied: o.refus } : {}) };
  return `<button type="button" class="carte-heros${J.valide(h) ? '' : ' hors'}${h.retrait ? ' retrait' : ''}${choisi ? ' choisi' : ''}" data-a="${geste}" data-id="${c.id}"${o.refus ? ' disabled' : ''}${apercuDe(identite)}>
    ${portrait(busteDuHeros(h), 'heros', 'grand', choisi ? 'choisi' : '')}${o.progresse ? '<i class="pastille-progres" aria-label="Peut progresser"></i>' : ''}
    <span class="qui"><span class="nom-propre petit gothique">${esc(c.label)}</span><span class="sous-titre">${r ? picto(r.picto, 12, 1.8) : ''}${esc(J.nomDeCarriere(h.carriere))}</span>
    ${ligneDeVie(c)}<span class="ligne-etat">${c.conditions.length ? esc(c.conditions.map((e) => libelleDEtat(e.id, e.value)).join(', ')) : h.retrait ? `<span class="au-repos">${picto('soin', 12, 1.8)} hospice · ${h.retrait} j</span>` : !J.valide(h) ? 'hors de combat' : sequelles(c).length ? `<span class="marque">${sequelles(c).length > 1 ? `${sequelles(c).length} séquelles` : esc(sequelles(c)[0].label)}</span>` : `${c.xp ?? 0} PX · Destin ${c.fate ?? 0}`}</span></span>
  </button>`;
}

/** Le héros qu'un bâtiment sert, en tête de sa page : portrait, nom, rôle et carrière, et sa `mesure` (sa vie, à
 *  défaut d'une autre). */
export function herosEnTete(h: J.Heros, taille: 'grand' | 'affiche' = 'grand', mesure = ligneDeVie(h.c)): string {
  const role = J.roleDe(h.carriere);
  const r = role && J.ROLES[role];
  return `<div class="heros-en-tete${J.valide(h) ? '' : ' hors'}">${portrait(busteDuHeros(h), 'heros', taille)}<div class="qui"><span class="nom-propre moyen gothique">${esc(h.c.label)}</span>
    <span class="sous-titre">${r ? `${picto(r.picto, 13, 1.8)}${esc(r.nom)} · ` : ''}${esc(J.nomDeCarriere(h.carriere))}</span>${mesure}</div></div>`;
}

/** La carte d'un héros en ligne, là où il est déjà choisi (ses sacs) : la même grammaire que la carte,
 *  portrait, nom, vie et état hors de combat, sans geste. */
export function herosEnLigne(h: J.Heros): string {
  const c = h.c;
  return `<div class="heros-en-ligne${J.valide(h) ? '' : ' hors'}">${portrait(busteDuHeros(h), 'heros', 'petit')}<span class="qui"><span class="nom-propre petit gothique">${esc(c.label)}</span>${jauge(Math.max(0, c.wounds.current) / Math.max(1, c.wounds.max))}</span></div>`;
}

/** Ceux qui sont à l'hospice : chacun, ses jours restants et la jauge de son séjour ; un clic ouvre sa fiche. */
export function hospice(e: J.Etat): string {
  return e.roster.filter((h) => h.retrait).map((h) => {
    const total = Math.max(h.retrait!, h.retraitTotal ?? h.retrait!);
    return `<button type="button" class="sejour" data-a="heros" data-id="${h.c.id}">${portrait(busteDuHeros(h), 'heros', 'petit')}<span class="qui"><span class="nom-propre petit gothique">${esc(h.c.label)}</span><span class="vie"><span>Hospice</span><span class="chiffres">encore ${h.retrait} j</span></span>${jauge(1 - h.retrait! / total, { teinte: 'or' })}</span></button>`;
  }).join('');
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

/** Une entrée : médaillon (ou portrait d'une personne), nom, état ; une action à droite (une plaque) ; l'aperçu au
 *  survol. Talents, sorts, provisions, prières, voyageurs, routes et tombes s'y montrent de la même façon. */
export function entree(o: { icone: string; portrait?: string; nom: string; etat: string; acquis?: boolean; ferme?: boolean; action?: string; apercu: Apercu }) {
  return `<div class="talent${o.acquis ? ' acquis' : ''}${o.ferme ? ' clos' : ''}"${apercuDe(o.apercu)}>${o.portrait ? portrait(o.portrait, 'heros', 'petit') : medaillon(o.icone, 'moyen', !!o.ferme)}<div class="t"><div class="nom-propre petit gothique">${esc(o.nom)}</div><i>${esc(o.etat)}</i></div>${o.action ?? ''}</div>`;
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
export const essentielDe = (x: J.PieceDecrite) => [x.degats && `Dégâts ${x.degats}`, x.mains === 2 && 'deux mains', x.allonge && `allonge ${x.allonge.toLowerCase()}`, x.portee && `portée ${x.portee} m`].filter(Boolean).join(' · ');
/** L'aperçu d'une pièce portée : son nom, ce qu'elle est, ses chiffres et ses qualités. */
export const apercuDePiece = (titre: string, x: J.PieceDecrite): Apercu => ({ nom: x.label, nature: titre, texte: [essentielDe(x), x.qualites.map((q) => q.nom).join(' · ')].filter(Boolean).join('\n') });
/** Les qualités d'un objet en étiquettes, à leur nom du livre ; son texte au survol. */
export const etiquettesDeQualites = (qs: readonly Qualite[]) => qs.map((q) => `<span class="etiquette rectangle qualite${q.defaut ? ' defaut' : ''}"${apercuDe({ nom: q.nom, nature: q.defaut ? 'Défaut' : 'Atout', texte: q.texte })}>${esc(q.nom)}</span>`).join('');
/** L'aperçu d'une provision : son nom et le texte du catalogue. */
export const apercuDeProvision = (id: string): Apercu => { const a = articleDuCatalogue(id); return { nom: a.label, nature: 'Provision', texte: a.desc }; };

/** Le sac d'un héros en cases ; `utilisable` : un clic utilise l'objet (en expédition). */
export const casesDuSac = (h: J.Heros, utilisable: boolean) => J.provisionsPortees(h).map((q) => caseObjet({
  icone: iconeDeProvision(q.id), nom: q.label, apercu: apercuDeProvision(q.id), compte: q.nombre,
  ...(utilisable ? { attrs: `data-a="utiliser" data-id="${h.c.id}" data-k="${q.uid}"`, refus: q.refus } : {}),
})).join('');

/** Le geste d'achat, seule forme d'un prix : une plaque « verbe · prix ». Faute de quoi payer, ou sur un `refus`,
 *  elle est fermée et dit pourquoi au survol. `offert` : ce qu'elle dit d'un prix nul ; `suite` : ce qui s'ajoute au
 *  prix (des trophées). */
export function achat(o: { verbe: string; prix: number; avoir: number; attrs: string; monnaie?: 'CO' | 'PX'; refus?: string | null; offert?: string; suite?: string; icone?: string; taille?: 'petite' | 'moyenne' | 'appel' }) {
  const monnaie = o.monnaie ?? 'CO';
  const refus = o.refus ?? (o.avoir < o.prix ? `Il manque ${o.prix - o.avoir} ${monnaie}.` : null);
  const prix = [o.prix ? `${o.prix} ${monnaie}` : o.offert ?? 'gratuit', o.suite].filter(Boolean).join(' · ');
  return plaque(`${esc(o.verbe)} · ${esc(prix)}`, o.attrs, { armee: !refus, fermee: !!refus, taille: o.taille ?? 'moyenne', icone: o.icone ?? '', titre: refus ? esc(refus) : '' });
}

/** Ce qui se pose à un rectangle de la scène fixe : `data-rect`, que `ajusterLaScene` ancre au bord le plus proche. */
export const place = (rect: readonly number[]) => `data-rect="${rect.join(' ')}" style="left:${rect[0]}px;top:${rect[1]}px${rect[2] ? `;width:${rect[2]}px;height:${rect[3]}px` : ''}"`;
/** Un cadre du kit posé à son rectangle d'une scène fixe (`CADRES` des maquettes) ; `etire` : il prend la place que
 *  l'écran laisse au-delà de la vue de référence (`ajusterLaScene`). */
export const cadreA = (rect: [number, number, number, number], contenu: string, o: { ruban?: string; fond?: string; classe?: string; tete?: string; etire?: boolean } = {}) =>
  `<div class="place-cadre" ${place(rect)}${o.etire ? ' data-etire' : ''}>${cadre(contenu, { fond: o.fond ?? 'parchemin', ruban: o.ruban ?? '', classe: `pan ${o.classe ?? ''}`, balise: 'div', tete: o.tete ?? '' })}</div>`;
/** Les onglets du kit sur le bord haut d'un cadre : l'actif est le ruban, les autres des plaques. */
export const onglets = (noms: [string, string][], actif: string) => `<div class="onglets">${noms.map(([id, nomme]) => (id === actif ? `<div class="ruban gothique">${nomme}</div>` : plaque(nomme, `data-a="onglet" data-k="${id}"`, { taille: 'petite' }))).join('')}</div>`;

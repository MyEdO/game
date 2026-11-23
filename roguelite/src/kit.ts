/**
 * Pièces graphiques reprises du kit des maquettes (branche `chantier/4585-catalogue`, révision cfff50879,
 * `hotes/godot/cibles/propositions/sources/gestes.js`) : cadres, textures de matière ; les pictogrammes sont dessinés ici.
 */
const NS = 'http://www.w3.org/2000/svg';

/** Pictogrammes au trait, `viewBox` 0 0 24 24. */
export const PICTOS: Record<string, string> = {
  hache: '<path d="M5 21L15.2 4.6"/><path d="M15.2 4.6l5.3.9c1 3 0 6-2.5 8L12.6 9z"/>',
  lance: '<path d="M3.5 20.5L14.5 9.5M11.5 9.5l3 3"/><path d="M14.5 9.5C15 6 17.5 3.5 21 3c-.5 3.5-3 6-6.5 6.5z"/>',
  arc: '<path d="M7 2.5c8.5 2.5 8.5 16.5 0 19"/><path d="M7 2.5v19M3.5 12H19M16 9l3 3-3 3"/>',
  arbalete: '<path d="M12 3v18M10 3h4M9.5 18h5"/><path d="M3.5 10c3.5-4.5 13.5-4.5 17 0"/><path d="M3.5 10l8.5 4.5 8.5-4.5"/>',
  dague: '<path d="M20 4L9.5 11.5l3 3z"/><path d="M7 10l7 7M9.5 14.5L5.5 18.5"/><circle cx="4.7" cy="19.3" r="1.1" fill="currentColor"/>',
  baton: '<path d="M5.5 21L15 7.5c-2-3 1.5-6 4.5-4"/><circle cx="17.8" cy="6.5" r="1.3" fill="currentColor"/><path d="M20.5 10v2.5M19.2 11.2h2.6"/>',
  marteau: '<path d="M4.5 20.5L13 11.5"/><path d="M11 6l3.5-3.5 7 7L18 13z"/>',
  fleau: '<path d="M4 20.5l6.5-7"/><path d="M10.5 13.5c.5-2.5 2-4 4-5" stroke-dasharray="1.5 1.8"/><circle cx="17.5" cy="6.5" r="2.8"/><path d="M17.5 1.8v1.5M22.2 6.5h-1.5M20.8 3.2l-1 1M20.8 9.8l-1-1M14.2 3.2l1 1M17.5 9.5v1.5"/>',
  armure: '<path d="M8 3.5L4.5 6 6 11v8.5c2.5 1.5 9.5 1.5 12 0V11l1.5-5L16 3.5c-1.2 2.2-6.8 2.2-8 0z"/><path d="M12 9v10.5M6 14.5c2 1 10 1 12 0"/>',
  fiole: '<path d="M9.5 3h5M10.5 3v5.2a6.5 6.5 0 1 0 3 0V3"/><path d="M6 13.5c2 1.5 3.7-1 6 0s4 1 6 0"/><circle cx="13.5" cy="17" r=".8" fill="currentColor"/>',
  pot: '<path d="M8 8h8l1.5 3v6.5a3 3 0 0 1-3 3h-5a3 3 0 0 1-3-3V11z"/><path d="M7 8h10M9.5 5h5v3h-5zM6.5 13.5h11"/>',
  coche: '<path d="M5 12.5l4.5 4.5L19 7"/>',
  route: '<circle cx="12" cy="12" r="9"/><path d="M15.8 8.2l-2.3 5.3-5.3 2.3 2.3-5.3z"/><circle cx="12" cy="12" r=".9" fill="currentColor"/>',
  chope: '<path d="M5.5 8.5H16V19a2 2 0 0 1-2 2H7.5a2 2 0 0 1-2-2z"/><path d="M16 11h1.5a2.5 2.5 0 0 1 2.5 2.5v1a2.5 2.5 0 0 1-2.5 2.5H16M5.5 8.5c-1.2-2 .5-4.2 2.5-3.5 1-2.2 4-2.2 5 0 1.7-1 3.5.7 3 3.5M9 12v5.5M12.5 12v5.5"/>',
  soin: '<path d="M12 20.5C7 17 3.5 13.5 3.5 9.5A4.3 4.3 0 0 1 12 8a4.3 4.3 0 0 1 8.5 1.5c0 4-3.5 7.5-8.5 11z"/><path d="M12 9.5v5.5M9.2 12.2h5.6"/>',
  croix: '<path d="M12 3v12M8 7h8"/><path d="M3.5 20.5c1.5-3.5 4.5-5.5 8.5-5.5s7 2 8.5 5.5z"/>',
  epee: '<path d="M20.5 3.5l-1 4L9 18l-3-3L16.5 4.5z"/><path d="M4.5 12.5l7 7M7.5 16.5L4 20"/>',
  carte: '<path d="M3.5 6.5l5.5-2 6 2 5.5-2v13l-5.5 2-6-2-5.5 2zM9 4.5v13M15 6.5v13"/>',
  pieces: '<ellipse cx="12" cy="7" rx="7" ry="3"/><path d="M5 7v5c0 1.7 3.1 3 7 3s7-1.3 7-3V7M5 12v5c0 1.7 3.1 3 7 3s7-1.3 7-3v-5"/>',
  bourse: '<path d="M8.5 8.5C5.5 11 4 14 4 16.5 4 19.5 7 21 12 21s8-1.5 8-4.5c0-2.5-1.5-5.5-4.5-8z"/><path d="M8 8.5h8M9 8.5L7.5 4.5 10 6l2-2 2 2 2.5-1.5L15 8.5M10 15.5h4"/>',
  tente: '<path d="M12 4L2.5 20h19zM12 4V2M12 10.5L9 20M12 10.5L15 20"/>',
  lit: '<path d="M3 18V7M3 15h18v3M21 15v-3a2 2 0 0 0-2-2h-8v5"/><circle cx="6.8" cy="12" r="1.8"/>',
  couronne: '<path d="M4 19h16M4.5 19L3 8.5l5 4L12 5.5l4 7 5-4L19.5 19"/><circle cx="12" cy="4.5" r="1" fill="currentColor"/><circle cx="3" cy="7.5" r="1" fill="currentColor"/><circle cx="21" cy="7.5" r="1" fill="currentColor"/>',
  bouclier: '<path d="M12 3l8 2.5v6c0 4.5-3.5 7.8-8 9.5-4.5-1.7-8-5-8-9.5v-6z"/><path d="M12 3v18M4.2 10.5h15.6"/>',
  sablier: '<path d="M7 3h10M7 21h10M8.5 3c0 5 3.5 6 3.5 9s-3.5 4-3.5 9M15.5 3c0 5-3.5 6-3.5 9s3.5 4 3.5 9M10 18.5h4"/>',
  lune: '<path d="M19 14.5A8 8 0 0 1 9.5 5a8 8 0 1 0 9.5 9.5z"/><path d="M18 3.5v3.5M16.2 5.2h3.6" stroke-width="1.2"/>',
  feu: '<path d="M12 21c-4 0-6.5-2.5-6.5-6 0-3 2-4.5 3-7 1.5 1 2 2.5 2 4 1.5-2 2.5-5 1.5-8.5 4 2 6.5 6 6.5 11 0 4-2.5 6.5-6.5 6.5z"/><path d="M12 21c-1.7 0-2.8-1.2-2.8-2.8 0-1.5 1-2.4 1.8-3.7 1.5 1 3.8 2.2 3.8 4.2 0 1.4-1.1 2.3-2.8 2.3z"/>',
  ville: '<path d="M2 20h20M3.5 20v-7.5l3.5-3 3.5 3V20M10.5 20V8l3-4 3 4v12M16.5 13l2-1.5 2.5 2V20M13.5 4V2M7 20v-3M13 10.5h1M13 14.5h1"/>',
  oeil: '<path d="M2.5 12C5 7.5 8.3 5.5 12 5.5s7 2 9.5 6.5c-2.5 4.5-5.8 6.5-9.5 6.5S5 16.5 2.5 12z"/><circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r="1" fill="currentColor"/>',
  balance: '<path d="M12 4v16M8 20h8M5 7h14M5 7l-3 6.5a3 3 0 0 0 6 0zM19 7l-3 6.5a3 3 0 0 0 6 0z"/>',
  des: '<rect x="4" y="4" width="16" height="16" rx="2.5"/><g fill="currentColor"><circle cx="8.5" cy="8.5" r=".9"/><circle cx="15.5" cy="15.5" r=".9"/><circle cx="12" cy="12" r=".9"/><circle cx="15.5" cy="8.5" r=".9"/><circle cx="8.5" cy="15.5" r=".9"/></g>',
  enclume: '<path d="M3 7.5h13.5c0 2.5-2 4.2-4.5 4.2v3.3h3v4.5H6V15h3v-3.3c-3 0-6-1.7-6-4.2zM16.5 7.5H21"/>',
  livre: '<path d="M12 6.5C10 5 7 4.5 3.5 5v13.5c3.5-.5 6.5 0 8.5 1.5 2-1.5 5-2 8.5-1.5V5C17 4.5 14 5 12 6.5zM12 6.5V20"/><path d="M6.5 9.5h2.5M6.5 13h2.5M15 9.5h2.5M15 13h2.5" stroke-width="1.2"/>',
  systeme: '<path d="M10.4 4.9L10.7 2.5L13.3 2.5L13.6 4.9L15.9 5.8L17.8 4.3L19.7 6.2L18.2 8.1L19.1 10.4L21.5 10.7L21.5 13.3L19.1 13.6L18.2 15.9L19.7 17.8L17.8 19.7L15.9 18.2L13.6 19.1L13.3 21.5L10.7 21.5L10.4 19.1L8.1 18.2L6.2 19.7L4.3 17.8L5.8 15.9L4.9 13.6L2.5 13.3L2.5 10.7L4.9 10.4L5.8 8.1L4.3 6.2L6.2 4.3L8.1 5.8z"/><circle cx="12" cy="12" r="3"/>',
  etoile: '<path d="M12 2.5L14.4 8.7L21 9.1L15.9 13.3L17.6 19.7L12 16.1L6.4 19.7L8.1 13.3L3 9.1L9.6 8.7z"/>',
  duel: '<path d="M4 3.5L15 14.5M12.5 17l5-5M16.5 16l3 3M20 3.5L9 14.5M6.5 12l5 5M7.5 16l-3 3"/>',
  coffre: '<path d="M4 10h16v9.5H4zM4 10c0-3 2-5 4-5h8c2 0 4 2 4 5M10.5 10v3.5h3V10M4 14.5h6.5M13.5 14.5H20"/>',
  crane: '<path d="M12 3.5c-4.5 0-7.5 3-7.5 7 0 2.5 1 4 2.5 5v3.5h10v-3.5c1.5-1 2.5-2.5 2.5-5 0-4-3-7-7.5-7zM10 19v-2M14 19v-2M12 13.5v1.5"/><circle cx="8.8" cy="11" r="1.6"/><circle cx="15.2" cy="11" r="1.6"/>',
  coeur: '<path d="M12 20.5C7 17 3.5 13.5 3.5 9.5A4.3 4.3 0 0 1 12 8a4.3 4.3 0 0 1 8.5 1.5c0 4-3.5 7.5-8.5 11z"/>',
};

export const picto = (nom: string, taille = 22, trait = 1.6): string =>
  `<svg width="${taille}" height="${taille}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${trait}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${PICTOS[nom] ?? ''}</svg>`;

/** Le cadre de portrait du kit autour d'un buste (un `<svg>` complet). */
export const portrait = (buste: string, camp: 'heros' | 'ennemi', taille: 'petit' | 'moyen' | 'grand' | 'affiche' = 'moyen', classe = ''): string =>
  `<div class="portrait ${camp === 'heros' ? 'laiton' : 'fer'} ${camp} ${taille} ${classe}"><div>${buste}</div></div>`;

/** Les textures de bois et de parchemin, posées en variables CSS (`--tex-bois`, `--tex-parchemin`). */
export function poserLesTextures(): void {
  const url = (svg: string) => `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
  document.documentElement.style.setProperty('--tex-bois', url(`<svg xmlns='${NS}' width='600' height='300'><filter id='f' x='0' y='0' width='100%' height='100%'><feTurbulence type='fractalNoise' baseFrequency='0.006 0.22' numOctaves='4' seed='7' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0.55  0 0 0 0 0.42  0 0 0 0 0.30  0.9 0.9 0.9 0 -0.75'/></filter><rect width='100%' height='100%' fill='#c9a57a'/><rect width='100%' height='100%' filter='url(#f)'/></svg>`));
  document.documentElement.style.setProperty('--tex-parchemin', url(`<svg xmlns='${NS}' width='500' height='400'><filter id='a' x='0' y='0' width='100%' height='100%'><feTurbulence type='fractalNoise' baseFrequency='0.012' numOctaves='4' seed='3' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0.45  0 0 0 0 0.32  0 0 0 0 0.16  0.9 0.9 0.9 0 -0.95'/></filter><filter id='b' x='0' y='0' width='100%' height='100%'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' seed='5' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0.35  0 0 0 0 0.25  0 0 0 0 0.12  0 0 0 0.22 0'/></filter><rect width='100%' height='100%' fill='#fff'/><rect width='100%' height='100%' filter='url(#a)'/><rect width='100%' height='100%' filter='url(#b)'/></svg>`));
}

const FERRURES = '<i class="ferrure hg"></i><i class="ferrure hd"></i><i class="ferrure bg"></i><i class="ferrure bd"></i>';

/** Le cadre de chêne ferré du kit, son fond (`bois` sombre ou `parchemin`), sa tête (des onglets, posés sur le cadre) et
 *  son ruban de titre. */
export const cadre = (contenu: string, { ruban = '', fond = '', classe = '', balise = 'section', tete = '' } = {}): string =>
  `<${balise} class="cadre bois ${classe}"><div class="fond ${fond}">${contenu}</div>${tete}${FERRURES}${ruban ? `<div class="ruban gothique">${ruban}</div>` : ''}</${balise}>`;

/** La plaque du kit en bouton : repos laiton, `armee` (l'appel principal), `fermee` (désactivée). */
export const plaque = (libelle: string, attrs: string, { armee = false, fermee = false, icone = '', prix = '', taille = 'moyenne', titre = '' } = {}): string =>
  `<button type="button" class="plaque ${fermee ? 'fer fermee' : 'laiton'} ${taille}${armee ? ' armee' : ''}" ${attrs}${fermee ? ' disabled' : ''}${titre ? ` data-bulle="${titre}"` : ''}><div>${icone ? picto(icone, 19, 1.7) : ''}<span>${libelle}</span>${prix ? `<span class="prix chiffres">${prix}</span>` : ''}</div></button>`;

/** Le médaillon du kit : un rond à pictogramme. */
export const medaillon = (nom: string, taille: 'grand' | 'moyen' | 'petit' = 'moyen', ferme = false): string =>
  `<div class="medaillon ${ferme ? 'fer ferme' : 'laiton'} ${taille}"><div>${picto(nom, { grand: 27, moyen: 20, petit: 15 }[taille])}</div></div>`;

/** La jauge du kit (`cire` : la vie). */
export const jauge = (part: number, { teinte = 'cire', taille = 'fine' } = {}): string =>
  `<div class="jauge ${teinte} ${taille}"><i style="width:${Math.max(0, Math.min(1, part)) * 100}%"></i></div>`;

/** Le bouton rond du kit, sans libellé : son nom en bulle (les coins). */
export const rondMuet = (nom: string, libelle: string, attrs: string, taille: 'petit' | 'moyen' | 'grand' = 'grand'): string =>
  `<button type="button" class="bouton-rond laiton ${taille}" ${attrs} aria-label="${libelle}" data-bulle="${libelle}"><div>${picto(nom, { petit: 15, moyen: 20, grand: 24 }[taille])}</div></button>`;

/** Le bouton rond du kit, à pictogramme, et son libellé dessous (l'« outil » du kit). */
export const rond = (nom: string, libelle: string, attrs: string, taille: 'moyen' | 'grand' = 'grand'): string =>
  `<button type="button" class="outil" ${attrs}><span class="bouton-rond laiton ${taille}"><span>${picto(nom, taille === 'grand' ? 24 : 20)}</span></span><span class="libelle">${libelle}</span></button>`;

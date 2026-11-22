/**
 * Pièces graphiques reprises du kit des maquettes (branche `chantier/4585-catalogue`, commit cfff50879,
 * `hotes/godot/cibles/propositions/sources/gestes.js`) : cadres, pictogrammes, textures de matière.
 */
const NS = 'http://www.w3.org/2000/svg';

/** Pictogrammes au trait, `viewBox` 0 0 24 24. */
export const PICTOS: Record<string, string> = {
  "hache": "<path d=\"M6 21L15 8\"/><path d=\"M13 5c3-2 6-1 7 1l-4 6c-2-1-3-4-3-7z\"/>",
  "lance": "<path d=\"M4 20L18 6\"/><path d=\"M15 4l5-1-1 5-3-1z\"/>",
  "arc": "<path d=\"M7 3c8 3 8 15 0 18\"/><path d=\"M7 3v18\"/><path d=\"M4 12h12M13 9l3 3-3 3\"/>",
  "dague": "<path d=\"M14 4l3 3-8 8-2-1-1-2z\"/><path d=\"M6 14l4 4M5 19l2-2\"/>",
  "baton": "<path d=\"M7 21L17 4\"/><circle cx=\"18\" cy=\"3.500\" r=\"1.500\"/>",
  "marteau": "<path d=\"M8 20l7-9\"/><path d=\"M12 6l4-3 5 5-3 4z\"/>",
  "fleau": "<path d=\"M5 20l6-7\"/><path d=\"M11 13c1-3 3-4 5-4\"/><circle cx=\"18\" cy=\"8\" r=\"2.500\"/>",
  "armure": "<path d=\"M8 4l4 2 4-2 4 3-2 4v9H6v-9L4 7z\"/><path d=\"M12 6v14\"/>",
  "fiole": "<path d=\"M10 3h4M10.500 3v5L6 17a3 3 0 0 0 3 4h6a3 3 0 0 0 3-4l-4.500-9V3\"/><path d=\"M7.500 15h9\"/>",
  "pot": "<path d=\"M7 8h10l-1 11a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2z\"/><path d=\"M6 8h12M9 5h6v3H9z\"/>",
  "coche": "<path d=\"M5 12.500l4.500 4.500L19 7\"/>",
  "route": "<circle cx=\"12\" cy=\"12\" r=\"8.500\"/><path d=\"M15.500 8.500l-2 5-5 2 2-5z\"/>",
  "chope": "<path d=\"M6 7h10v11a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2zM16 10h2a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2h-2M6 7c0-2 2-3 3.500-2C10.500 3.500 13 3.500 13.500 5c1.500-.5 2.500.5 2.500 2\"/>",
  "soin": "<path d=\"M9.500 4h5v5.500H20v5h-5.500V20h-5v-5.500H4v-5h5.500z\"/>",
  "croix": "<path d=\"M6 6l12 12M18 6L6 18\"/>",
  "epee": "<path d=\"M6 18L17 7l2-3-3 2L5 17zM8 13l3 3M4 20l2-2\"/>",
  "carte": "<path d=\"M3.500 6l5.500-2 6 2 5.500-2v14l-5.500 2-6-2-5.500 2zM9 4v14M15 6v14\"/>",
  "pieces": "<ellipse cx=\"12\" cy=\"7\" rx=\"7\" ry=\"3\"/><path d=\"M5 7v5c0 1.700 3.100 3 7 3s7-1.300 7-3V7M5 12v5c0 1.700 3.100 3 7 3s7-1.300 7-3v-5\"/>",
  "bourse": "<path d=\"M9 7h6l-1-3h-4zM9 7c-3 2.500-4.500 5.500-4.500 8.500 0 3 3 4.500 7.500 4.500s7.500-1.500 7.500-4.500c0-3-1.500-6-4.500-8.500\"/>",
  "tente": "<path d=\"M12 4L3 20h18zM12 4v-1.500M12 11l-3.500 9M12 11l3.500 9\"/>",
  "lit": "<path d=\"M3 18V7M3 15h18v3M21 15v-3a2 2 0 0 0-2-2h-8v5M5 12.500a1.800 1.800 0 1 0 3.600 0a1.800 1.800 0 1 0-3.600 0\"/>",
  "couronne": "<path d=\"M4 18h16M4 18L3 8l5 4 4-7 4 7 5-4-1 10\"/>",
  "bouclier": "<path d=\"M12 3l7.500 2.500v5.500c0 4.800-3.200 8-7.500 9.500-4.300-1.500-7.500-4.700-7.500-9.500V5.500z\"/>",
  "sablier": "<path d=\"M7 3h10M7 21h10M8.500 3c0 5 7 6.500 7 9s-7 4-7 9M15.500 3c0 5-7 6.500-7 9s7 4 7 9\"/>",
  "lune": "<path d=\"M19 14.500A8 8 0 0 1 9.500 5a8 8 0 1 0 9.500 9.500z\"/>",
  "feu": "<path d=\"M12 21c-4 0-6.500-2.500-6.500-6 0-3 2-4.500 3-7 1.500 1 2 2.500 2 4 1.500-2 2.500-5 1.500-8.500 4 2 6.500 6 6.500 11 0 4-2.500 6.500-6.500 6.500z\"/>",
  "ville": "<path d=\"M4 20V9l2-2 2 2v3h3V6l3-2.500L17 6v6h3v8zM4 20h16M13 9.500h2M7 14h.01M13 14h2\"/>",
  "oeil": "<path d=\"M2.500 12C5 7.500 8.300 5.500 12 5.500s7 2 9.500 6.500c-2.500 4.500-5.800 6.500-9.500 6.500S5 16.500 2.500 12z\"/><circle cx=\"12\" cy=\"12\" r=\"3\"/>",
  "balance": "<path d=\"M12 4v16M7 20h10M4 8h16M4 8l-2 6a3.200 3.200 0 0 0 6 0L6 8M20 8l-2 6a3.200 3.200 0 0 0 6 0l-2-6\" transform=\"translate(-.5 0) scale(.96)\"/>",
  "des": "<rect x=\"4\" y=\"4\" width=\"16\" height=\"16\" rx=\"2.500\"/><circle cx=\"8.500\" cy=\"8.500\" r=\".8\"/><circle cx=\"15.500\" cy=\"15.500\" r=\".8\"/><circle cx=\"12\" cy=\"12\" r=\".8\"/><circle cx=\"15.500\" cy=\"8.500\" r=\".8\"/><circle cx=\"8.500\" cy=\"15.500\" r=\".8\"/>",
  "enclume": "<path d=\"M4 8h13c0 2-1.500 3.500-4 3.500v3.500h3v4H7v-4h3v-3.500C7 11.500 4 10.500 4 8zM17 8h3.500\"/>",
  "livre": "<path d=\"M5 4h12a2 2 0 0 1 2 2v14H7a2 2 0 0 1-2-2zM5 18a2 2 0 0 1 2-2h12M9 8h6\"/>",
  "etoile": "<path d=\"M12 3l2.300 6.200 6.700.3-5.200 4.100 1.800 6.400L12 16.300 6.400 20l1.800-6.400L3 9.500l6.700-.3z\"/>"
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
  `<button type="button" class="plaque ${fermee ? 'fer fermee' : 'laiton'} ${taille}${armee ? ' armee' : ''}" ${attrs}${fermee ? ' disabled' : ''}${titre ? ` title="${titre}"` : ''}><div>${icone ? picto(icone, 19, 1.7) : ''}<span>${libelle}</span>${prix ? `<span class="prix chiffres">${prix}</span>` : ''}</div></button>`;

/** Le médaillon du kit : un rond à pictogramme. */
export const medaillon = (nom: string, taille: 'grand' | 'moyen' | 'petit' = 'moyen', ferme = false): string =>
  `<div class="medaillon ${ferme ? 'fer ferme' : 'laiton'} ${taille}"><div>${picto(nom, { grand: 27, moyen: 20, petit: 15 }[taille])}</div></div>`;

/** La jauge du kit (`cire` : la vie). */
export const jauge = (part: number, { teinte = 'cire', taille = 'fine' } = {}): string =>
  `<div class="jauge ${teinte} ${taille}"><i style="width:${Math.max(0, Math.min(1, part)) * 100}%"></i></div>`;

/** Le bouton rond du kit, à pictogramme, et son libellé dessous (l'« outil » du kit). */
export const rond = (nom: string, libelle: string, attrs: string, taille: 'moyen' | 'grand' = 'grand'): string =>
  `<button type="button" class="outil" ${attrs}><span class="bouton-rond laiton ${taille}"><span>${picto(nom, taille === 'grand' ? 24 : 20)}</span></span><span class="libelle">${libelle}</span></button>`;

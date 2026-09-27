import type { CreatureDef } from '../types';

// Rat géant — fidélité à l'artwork officiel (art-ref/ldb/page318_img7416.png, figure principale) :
// bête BASSE et RAMASSÉE (pattes courtes, corps massif arqué), tête tendue LOIN EN AVANT au ras du
// sol (encolure très couchée, l'os tete contre-pivote pour garder le museau à l'horizontale),
// museau BAVEUX/MALADE (deco tete : dents jaunies débordant des babines, coulures de bave
// verdâtre, truffe terne — par-dessus la tête 'rat' partagée, précédent : collier du Pégase),
// pelage hirsute brun-olive terne moucheté (taches + crinière hirsute), pattes et queue nue
// rosâtres (cuir).
export const creature: CreatureDef = {
  label: 'Rat géant',
  id: "rat-geant",
  plan: 'quadruped',
  quad: {
    // neckAngle -96 = encolure PLONGEANTE (tête tendue en avant SOUS la ligne du dos, ref : crâne
    // au ras du sol devant les épaules) ; headPitch -22 relève le museau (l'art 'rat' porte
    // rotate 16 PLUS ~26° de pente interne du tracé) → museau tendu, léger piqué vers le sol ;
    // legLen 0.17 + girth 1.32 = ventre au ras du sol, masse ramassée de l'artwork.
    sl: 0.62, build: 'rodent', girth: 1.32, bodyLen: 1.02, neckLen: 0.34, neckAngle: -100, headPitch: -22,
    legLen: 0.17, head: 'rat', headScale: 1.14, tail: 'nue', tailLen: 1.3,
    ears: 'rondes', foot: 'patte', mane: 'hirsute', markings: 'taches',
    deco: {
      // museau malade, authoré dans le repère de l'ART de tête (quadAnchor) ; rotate(16) comme
      // headProfile 'rat' (gueule x 8..21, truffe (20,10))
      tete: `<g transform="rotate(16)" data-deco="museau-malade">` +
        // dents proéminentes JAUNIES débordant des babines (rangée sup + incisive inf)
        `<path d="M12 9.8 l1 4.8 l1.7 -4.2 Z M15.4 10.2 l0.9 4.4 l1.6 -3.8 Z M18.6 10 l0.8 3.8 l1.4 -3.3 Z" fill="#ddc476" stroke="#8a7430" stroke-width="0.35"/>` +
        // recolore JAUNI la dent blanche de l'art partagé (même tracé, par-dessus)
        `<path d="M14 13 q-2 4 -4 2" fill="none" stroke="#d3b968" stroke-width="1.2" stroke-linecap="round"/>` +
        // bave VERDÂTRE au BOUT du museau : écume aux babines, coulures qui pendent de la
        // commissure AVANT et sous la truffe (ref : mufle luisant vert-jaune), gouttes au ras
        `<path d="M12 11.4 Q16 13.6 20.4 11.6" stroke="#a8c25e" stroke-width="1.4" fill="none" opacity="0.6" stroke-linecap="round"/>` +
        `<path d="M16.2 12.8 q-0.6 4.2 0.5 6.9 q1 -3.3 0.6 -6.5 Z" fill="#96b24c" opacity="0.9"/>` +
        `<path d="M19 12 q-0.2 3.4 0.9 5.3 q0.7 -2.7 0.3 -5.1 Z" fill="#89a83f" opacity="0.85"/>` +
        `<circle cx="16.9" cy="20.6" r="0.75" fill="#9cba52" opacity="0.9"/><circle cx="20.1" cy="18.2" r="0.6" fill="#9cba52" opacity="0.85"/>` +
        // truffe TERNE (recouvre le rose propre) + croûte verdâtre LUISANTE sur le mufle (ref)
        `<ellipse cx="20" cy="10" rx="1.7" ry="1.4" fill="#8f8468"/>` +
        `<path d="M18.4 10.8 q1.5 1.3 3 0.6" stroke="#a8c25e" stroke-width="0.9" fill="none" opacity="0.75" stroke-linecap="round"/>` +
        `<circle cx="19.3" cy="9.2" r="0.5" fill="#c9d96a" opacity="0.85"/><circle cx="20.9" cy="10.6" r="0.4" fill="#b6c95c" opacity="0.8"/>` +
        `<path d="M13 8.4 q1.6 1.2 3 1" stroke="#7a8f3a" stroke-width="0.8" fill="none" opacity="0.5"/>` +
        `</g>`,
    },
    palette: {
      corps: '#5c543e', corpsO: '#322c1d', corpsH: '#7e7657', // pelage brun-olive terne, malsain
      cheveux: '#37311f', cheveuxO: '#1e1a10', // touffes hirsutes sombres (échine/encolure)
      cuir: '#bb8878', // pattes/queue de chair rosâtre
    },
  },
};

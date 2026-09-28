import type { CreatureDef } from '../types';

// LUTIN éthéré (MCLB 2 — « Grain d'achillée ») : « créature MINUSCULE d'à peine une
// trentaine de centimètres, recouverte de TOILES D'ARAIGNÉE LUMINESCENTES qui sourdent de tout son
// corps ; bien que CHÉTIF… » ; il « voletait » (ailé). Pas d'art-ref officiel (livre Middenheim) →
// dessiné d'après le TEXTE seul :
//   - peau blafarde + cheveux argentés (lutin éthéré),
//   - oreilles FÉERIQUES pointues (chair @peau, par-vue, ancrées DANS le crâne, derrière le visage),
//   - petites ailes GOSSAMER translucides ancrées au dos (couleurs littérales pâles, par-vue),
//   - voile de FILS luminescents qui « sourdent » du corps (par-dessus la chair, littéral pâle).
// Corps NU (career 'Nu') ; carrure décharnée = « chétif, membres grêles » ; échelle plafonnée à 0.5
// (la Taille « Très petite » est gérée côté combat/footprint, l'art s'arrête à 0.5).

// --- Oreilles féeriques pointues (chair @peau, derrière le visage/les cheveux) ---
const OREILLE_FRONT =
  `<path d="M-6.5 7 Q-12 3 -15.5 -6 Q-11.5 -1 -7.5 1 Z" fill="@peau" stroke="@peauO" stroke-width="0.5"/>`
  + `<path d="M-9 1 Q-11.5 -2 -13.6 -5" stroke="@peauO" stroke-width="0.4" fill="none" opacity="0.6"/>`
  + `<path d="M6.5 7 Q12 3 15.5 -6 Q11.5 -1 7.5 1 Z" fill="@peau" stroke="@peauO" stroke-width="0.5"/>`
  + `<path d="M9 1 Q11.5 -2 13.6 -5" stroke="@peauO" stroke-width="0.4" fill="none" opacity="0.6"/>`;
const OREILLE_BACK =
  `<path d="M-6.5 7 Q-12 3 -15.5 -6 Q-11.5 -1 -7.5 1 Z" fill="@peau" stroke="@peauO" stroke-width="0.5"/>`
  + `<path d="M6.5 7 Q12 3 15.5 -6 Q11.5 -1 7.5 1 Z" fill="@peau" stroke="@peauO" stroke-width="0.5"/>`;
// profil : UNE oreille du côté arrière (-x), balayée vers le haut-arrière (le visage regarde +x)
const OREILLE_PROFILE =
  `<path d="M-2 6 Q-7 2 -11 -6 Q-6 -1 -2.5 2 Z" fill="@peau" stroke="@peauO" stroke-width="0.5"/>`
  + `<path d="M-4 2 Q-6.5 -1 -9 -4.5" stroke="@peauO" stroke-width="0.4" fill="none" opacity="0.6"/>`;

// --- Ailes gossamer translucides (couleurs LITTÉRALES pâles — jamais un jeton vif qui repeindrait
// une silhouette). Ancrées au haut du dos (repère torse). Par-vue : face = paire DERRIÈRE le corps ;
// dos = paire PAR-DESSUS le dos ; profil = une aile balayée en arrière. ---
const AILE_FRONT =
  `<g opacity="0.55">`
  + `<path d="M-4 -20 Q-20 -33 -28 -25 Q-23 -15 -9 -15 Q-6 -18 -4 -20 Z" fill="#d9efe9" stroke="#a6d2c9" stroke-width="0.5"/>`
  + `<path d="M-5 -19 Q-15 -22 -25 -24 M-7 -17 Q-15 -17 -22 -18" stroke="#bfe0d8" stroke-width="0.35" fill="none" opacity="0.85"/>`
  + `<path d="M4 -20 Q20 -33 28 -25 Q23 -15 9 -15 Q6 -18 4 -20 Z" fill="#d9efe9" stroke="#a6d2c9" stroke-width="0.5"/>`
  + `<path d="M5 -19 Q15 -22 25 -24 M7 -17 Q15 -17 22 -18" stroke="#bfe0d8" stroke-width="0.35" fill="none" opacity="0.85"/>`
  + `</g>`;
const AILE_BACK = AILE_FRONT;
const AILE_PROFILE =
  `<g opacity="0.55">`
  + `<path d="M-3 -19 Q-18 -30 -26 -23 Q-20 -14 -8 -15 Q-5 -17 -3 -19 Z" fill="#d9efe9" stroke="#a6d2c9" stroke-width="0.5"/>`
  + `<path d="M-4 -18 Q-14 -20 -23 -22 M-6 -16 Q-14 -15 -20 -16" stroke="#bfe0d8" stroke-width="0.35" fill="none" opacity="0.85"/>`
  + `</g>`;

// --- Toiles luminescentes « qui sourdent de tout son corps » (par-dessus la chair, littéral pâle) :
// arcs + fils verticaux dans la silhouette du torse, brins qui dépassent, nœuds lumineux, halo diffus. ---
const TOILE =
  `<g fill="none" opacity="0.78">`
  + `<path d="M-9 -20 Q0 -24 9 -20 M-10 -6 Q0 -2 10 -8 M-9 8 Q0 12 9 6 M-7 22 Q0 26 7 20" stroke="#e8fff7" stroke-width="1.4" opacity="0.18"/>`
  + `<path d="M-9 -20 Q0 -24 9 -20 M-10 -6 Q0 -2 10 -8 M-9 8 Q0 12 9 6 M-7 22 Q0 26 7 20" stroke="#d6f3ea" stroke-width="0.4"/>`
  + `<path d="M-3 -24 Q-2 0 -3 24 M4 -22 Q3 2 5 22 M0 -23 Q1 0 0 25" stroke="#d6f3ea" stroke-width="0.35" opacity="0.85"/>`
  + `<path d="M9 -20 q4 -1 6 -3 M10 -8 q4 1 6 -1 M-9 8 q-4 1 -6 3 M7 20 q4 1 6 3" stroke="#cdeee6" stroke-width="0.3" opacity="0.7"/>`
  + `<circle cx="-3" cy="-13" r="0.6" fill="#eafff8"/><circle cx="4" cy="-1" r="0.6" fill="#eafff8"/><circle cx="-2" cy="13" r="0.6" fill="#eafff8"/>`
  + `</g>`;

export const creature: CreatureDef = {
  label: 'Lutin',
  id: "lutin",
  plan: 'biped',
  perso: {
    tenue: 'nu',
    gabarit: 'decharne',          // chétif, membres grêles
    scale: 0.5,                   // minuscule (« Très petite » géré au combat/footprint ; l'art plafonne à 0.5)
    colors: { peau: '#e7e3da', cheveux: '#cdc8be' }, // peau blafarde, cheveux argentés (éthéré)
    features: [
      // oreilles pointues — DERRIÈRE le visage/les cheveux (base rentrée sous le crâne)
      { bone: 'tete', svg: OREILLE_FRONT, layer: -2, view: 'front' },
      { bone: 'tete', svg: OREILLE_BACK, layer: -2, view: 'back' },
      { bone: 'tete', svg: OREILLE_PROFILE, layer: -2, view: 'profile' },
      // ailes gossamer — face : DERRIÈRE le corps ; dos/profil : PAR-DESSUS le dos (sinon racine occultée)
      { bone: 'torse', svg: AILE_FRONT, layer: -2, view: 'front' },
      { bone: 'torse', svg: AILE_BACK, layer: 70, view: 'back' },
      { bone: 'torse', svg: AILE_PROFILE, layer: 70, view: 'profile' },
      // voile de toiles luminescentes par-dessus la chair (toutes vues)
      { bone: 'torse', svg: TOILE, layer: 60 },
    ],
  },
};

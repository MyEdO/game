import type { TenueDef } from '../types';
import { BOTTE_CUIR } from '../botte-gabarit';

// Prêtre de Stromfels (MDG 11 l.85-115 ; illustration folio 90) — prêtre du Dieu Requin, aspect
// noir de Manann : brute prédatrice au torse NU et bedonnant, pauldrons de cuir, harnais et large
// ceinture à boucle carrée. Symboles sacrés portés : pendentif de DENTS DE REQUIN sur cordelette,
// gemme verte sertie de griffes de métal, sceau rouge à tête de mort, bande de prière déchirée, et
// une MÂCHOIRE dentée pendue à la hanche. Sarouel de toile rapiécé, brassard de fourrure algueuse.
// (Le trident dégoulinant est l'ARME EN MAIN — hors tenue.) Distinct du Prêtre marin de Manann.
export const tenue: TenueDef = {
  label: 'Prêtre de Stromfels',
  id: "pretre-de-stromfels",
  palette: {
    cuir: '#6b4a2a', cuirO: '#3a2513', cuirH: '#8f6636',
    toile: '#918a6f', toileO: '#565037', toileH: '#b3ac8d',
    vet1: '#5d8074', vet1O: '#375149', vet1H: '#8fb2a3',
    vet2: '#6d764a', vet2O: '#454d2b', vet2H: '#8b9463',
    os: '#e8e0ca', osO: '#b0a380', osH: '#f6f1e2',
    gemme: '#3f9061', gemmeH: '#7fcd97',
    metal: '#7c7566', metalO: '#403a30', metalH: '#b6ac94',
    sceau: '#9c3c2b', sceauO: '#5c1e15', sceauH: '#c05a44',
    fourrure: '#7e8b5b', fourrureO: '#4d5735', fourrureH: '#a6b280',
    parchemin: '#d9cfb4', parcheminO: '#a89d7d', corde: '#b09a68',
  },
  set: {
    pied: BOTTE_CUIR,
    torse: {
      // FACE — ventre nu bedonnant + harnais + emblèmes sacrés
      front: `<g stroke-linejoin="round">`
        // ventre nu (silhouette bombée) + modelé de graisse
        + `<path d="M-13 -28 Q0 -32 13 -28 Q16 -8 15 8 Q16 22 11 31 Q0 36 -11 31 Q-16 22 -15 8 Q-16 -8 -13 -28 Z" fill="@peau" stroke="@peauO" stroke-width="0.8"/>`
        // ombres de flanc + dessous du ventre (galbe)
        + `<path d="M-15 6 Q-16 22 -11 31 Q0 36 11 31 Q16 22 15 6 Q9 27 0 29 Q-9 27 -15 6 Z" fill="@cuirO" opacity="0.22" stroke="none"/>`
        + `<path d="M-15 -6 Q-16 4 -14.5 12 Q-11 8 -11 -2 Z M15 -6 Q16 4 14.5 12 Q11 8 11 -2 Z" fill="@cuirO" opacity="0.18" stroke="none"/>`
        // pli de graisse sous les pectoraux + pectoraux affaissés
        + `<path d="M-10 -2 Q0 5 10 -2 Q7 1 0 1.6 Q-7 1 -10 -2 Z" fill="@cuirO" opacity="0.26" stroke="none"/>`
        + `<path d="M-11 -18 Q-8 -10 -5 -6 Q-2 -3 0 -3 Q2 -3 5 -6 Q8 -10 11 -18" fill="none" stroke="@peauO" stroke-width="0.8" opacity="0.45"/>`
        + `<path d="M-11 -23 Q-6 -19 0 -20 Q6 -19 11 -23" fill="none" stroke="@peauO" stroke-width="0.7" opacity="0.5"/>`
        // reflet doux sur la bedaine
        + `<path d="M-5 5 Q0 3 5 5 Q4.5 16 0 19 Q-4.5 16 -5 5 Z" fill="#ffffff" opacity="0.07" stroke="none"/>`
        + `<ellipse cx="0.5" cy="21" rx="1.3" ry="2" fill="@cuirO" opacity="0.4" stroke="none"/>`
        + `<path d="M12 -18 Q15.4 -4 13.6 13" fill="none" stroke="@cuirO" stroke-width="1.2" opacity="0.3"/>`
        // collier de harnais (sangle au cou)
        + `<path d="M-10 -25.5 Q0 -22.5 10 -25.5 L9.6 -23.5 Q0 -20.6 -9.6 -23.5 Z" fill="@cuir" stroke="@cuirO" stroke-width="0.6"/>`
        // ourlet de tunique bleu-vert déchiré (bas), sous la ceinture
        + `<path d="M-14 17 Q0 21 14 17 L13 24 L11 22 L9 27 L7 22.5 L5 28 L2.5 23 L0 28.5 L-2.5 23 L-5 28 L-7 22.5 L-9 27 L-11 22 L-13 24 Z" fill="@vet1" stroke="@vet1O" stroke-width="0.7"/>`
        + `<path d="M-13.4 18.4 Q0 22 13.4 18.4" fill="none" stroke="@vet1H" stroke-width="0.7" opacity="0.6"/>`
        + `<path d="M-6 20 L-6.6 26 M0 20.5 L0 27.5 M6 20 L6.6 26" stroke="@vet1H" stroke-width="0.6" stroke-linecap="round" opacity="0.55"/>`
        // écharpe verte mousseuse (taille), derrière la ceinture
        + `<path d="M-14.6 4 Q0 8 14.6 4 L14 13 Q0 17 -14 13 Z" fill="@vet2" stroke="@vet2O" stroke-width="0.7"/>`
        + `<path d="M-12 6 Q-9 9 -6 6.6 M-3 7 Q0 10 3 7 M6 6.6 Q9 9 12 6" fill="none" stroke="@vet2O" stroke-width="0.7" opacity="0.6"/>`
        + `<path d="M-11 10.5 Q0 13 11 10.5" fill="none" stroke="@vet2H" stroke-width="0.6" opacity="0.5"/>`
        // large ceinture de cuir + boucle carrée
        + `<path d="M-14.4 8.5 Q0 12 14.4 8.5 L14 15 Q0 18.5 -14 15 Z" fill="@cuir" stroke="@cuirO" stroke-width="0.8"/>`
        + `<path d="M-14 9.6 Q0 13 14 9.6" fill="none" stroke="@cuirH" stroke-width="0.6" opacity="0.7"/>`
        + `<circle cx="-9" cy="12.2" r="0.9" fill="@cuirO"/><circle cx="8.6" cy="11.8" r="0.9" fill="@cuirO"/>`
        + `<rect x="-3.2" y="9.4" width="6.4" height="5.6" rx="0.8" fill="@metal" stroke="@metalO" stroke-width="0.7"/>`
        + `<rect x="-2.1" y="10.4" width="4.2" height="3.6" rx="0.5" fill="none" stroke="@metalH" stroke-width="0.7"/>`
        + `<path d="M0 9.6 L0 15" stroke="@metalO" stroke-width="1" opacity="0.8"/>`
        // harnais : deux sangles d'épaule vers la ceinture
        + `<path d="M-10.5 -25 L-2.5 9.5 L1 9.5 L-7 -25 Z" fill="@cuir" stroke="@cuirO" stroke-width="0.6"/>`
        + `<path d="M10.5 -25 L2.6 9 L-0.6 9 L7.4 -25 Z" fill="@cuir" stroke="@cuirO" stroke-width="0.6"/>`
        + `<path d="M-9.4 -22 L-2.4 8.4 M8.4 -22 L1.4 8.4" fill="none" stroke="@cuirH" stroke-width="0.5" opacity="0.6"/>`
        // rouleaux (parchemins/flotteurs) glissés dans la ceinture, hanche droite
        + `<g stroke="@parcheminO" stroke-width="0.5"><ellipse cx="9.5" cy="7" rx="2.4" ry="1.5" fill="@parchemin" transform="rotate(-18 9.5 7)"/><ellipse cx="9.5" cy="7" rx="0.9" ry="1.2" fill="@parcheminO" transform="rotate(-18 9.5 7)"/><ellipse cx="11.4" cy="10.4" rx="2.2" ry="1.4" fill="@parchemin" transform="rotate(-14 11.4 10.4)"/><ellipse cx="11.4" cy="10.4" rx="0.8" ry="1.1" fill="@parcheminO" transform="rotate(-14 11.4 10.4)"/></g>`
        // EMBLÈMES pectoraux (haut du torse) —
        // bande de prière déchirée (parchemin) pendante
        + `<path d="M-8.4 -12 L-4.6 -12 L-4 -1 L-5.4 3 L-7 0.4 L-8.2 3.2 L-9 -0.6 Z" fill="@parchemin" stroke="@parcheminO" stroke-width="0.5"/>`
        + `<path d="M-7.8 -9 L-5.2 -9 M-7.8 -6.5 L-5 -6.5 M-7.6 -4 L-5 -4" stroke="@parcheminO" stroke-width="0.5" opacity="0.7"/>`
        // sceau rouge à tête de mort (médaillon)
        + `<circle cx="-6.4" cy="-14.4" r="2.9" fill="@sceau" stroke="@sceauO" stroke-width="0.8"/>`
        + `<circle cx="-6.4" cy="-14.4" r="2.9" fill="none" stroke="@sceauH" stroke-width="0.5" opacity="0.6"/>`
        + `<circle cx="-7.3" cy="-15" r="0.7" fill="@sceauO"/><circle cx="-5.5" cy="-15" r="0.7" fill="@sceauO"/><path d="M-7.4 -13.2 L-5.4 -13.2" stroke="@sceauO" stroke-width="0.7"/>`
        // gemme verte sertie de griffes de métal
        + `<path d="M-3 -12 Q3.6 -13.4 4.6 -9 Q3.4 -4.4 -2.6 -5.2 Q-4.4 -8.4 -3 -12 Z" fill="@gemme" stroke="@metalO" stroke-width="0.9"/>`
        + `<path d="M-2 -11 Q2 -12 3 -8.6 Q2 -6.2 -1.6 -6.6 Z" fill="@gemmeH" opacity="0.45" stroke="none"/>`
        + `<path d="M-3.4 -12.4 L-4.6 -13.8 M4.7 -9.2 L6.2 -9.4 M-2.6 -4.6 L-3.4 -3.2 M3.4 -4.6 L4.2 -3.4" stroke="@metal" stroke-width="1.1" stroke-linecap="round"/>`
        // pendentif de DENTS DE REQUIN (deux crochets d'os sur cordelette)
        + `<path d="M-1 -22 Q3 -20 4.6 -18" fill="none" stroke="@corde" stroke-width="0.9"/>`
        + `<path d="M2.4 -18 Q1.2 -12 3.4 -8 Q6.2 -11 5.4 -16 Q4.6 -18.4 2.4 -18 Z" fill="@os" stroke="@osO" stroke-width="0.7"/>`
        + `<path d="M5 -17.5 Q6.6 -12.6 9.2 -9.6 Q9.8 -13.4 7.6 -16.6 Q6.4 -18 5 -17.5 Z" fill="@os" stroke="@osO" stroke-width="0.7"/>`
        + `<path d="M2.9 -17 Q2.2 -13 3.4 -10 M6 -16 Q7.2 -13 8.4 -11" stroke="@osH" stroke-width="0.5" opacity="0.6"/>`
        // mâchoire dentée pendue à la hanche gauche (dents de requin)
        + `<path d="M-13.6 18.5 Q-11.6 25 -6.4 27.5" fill="none" stroke="@cuir" stroke-width="1.4"/>`
        + `<path d="M-13.4 19 Q-11.8 24 -7.2 26.6 L-7.6 28.2 Q-12.4 25.4 -14.2 20 Z" fill="@osO" stroke="@osO" stroke-width="0.5"/>`
        + `<path d="M-13.2 20.5 l-1 2 M-12.2 22.6 l-0.9 2 M-10.8 24 l-0.6 2.1 M-9.2 25.2 l-0.4 2 M-7.6 26 l-0.2 2" stroke="@os" stroke-width="0.9" stroke-linecap="round"/>`
        + `</g>`,
      // DOS — dos nu musclé + harnais croisé + ceinture/ourlet
      back: `<g stroke-linejoin="round">`
        + `<path d="M-13 -28 Q0 -32 13 -28 Q16 -8 15 8 Q16 22 11 31 Q0 36 -11 31 Q-16 22 -15 8 Q-16 -8 -13 -28 Z" fill="@peau" stroke="@peauO" stroke-width="0.8"/>`
        + `<path d="M-15 6 Q-16 22 -11 31 Q0 36 11 31 Q16 22 15 6 Q9 26 0 28 Q-9 26 -15 6 Z" fill="@cuirO" opacity="0.2" stroke="none"/>`
        + `<path d="M0 -26 Q1 0 0 30" fill="none" stroke="@cuirO" stroke-width="1.1" opacity="0.4"/>`
        + `<path d="M-8 -20 Q-10 -6 -8 6 M8 -20 Q10 -6 8 6" fill="none" stroke="@cuirO" stroke-width="0.9" opacity="0.3"/>`
        // omoplates + reins
        + `<path d="M-9 -18 Q-6 -14 -4 -18 M9 -18 Q6 -14 4 -18" fill="none" stroke="@peauO" stroke-width="0.7" opacity="0.4"/>`
        + `<path d="M-12 -24 Q-6 -21 0 -22 Q6 -21 12 -24" fill="none" stroke="@peauO" stroke-width="0.7" opacity="0.5"/>`
        // ourlet de tunique (bas)
        + `<path d="M-14 17 Q0 21 14 17 L13 24 L10.5 22 L8 27 L5 22.5 L2.5 27.5 L0 22.5 L-2.5 27.5 L-5 22.5 L-8 27 L-10.5 22 L-13 24 Z" fill="@vet1" stroke="@vet1O" stroke-width="0.7"/>`
        + `<path d="M-13.4 18.4 Q0 22 13.4 18.4" fill="none" stroke="@vet1O" stroke-width="0.6" opacity="0.6"/>`
        // écharpe + ceinture
        + `<path d="M-14.6 4 Q0 8 14.6 4 L14 13 Q0 17 -14 13 Z" fill="@vet2" stroke="@vet2O" stroke-width="0.7"/>`
        + `<path d="M-14.4 8.5 Q0 12 14.4 8.5 L14 15 Q0 18.5 -14 15 Z" fill="@cuir" stroke="@cuirO" stroke-width="0.8"/>`
        + `<path d="M-14 9.6 Q0 13 14 9.6" fill="none" stroke="@cuirH" stroke-width="0.6" opacity="0.6"/>`
        + `<rect x="-2.8" y="9.6" width="5.6" height="5.2" rx="0.7" fill="@metal" stroke="@metalO" stroke-width="0.6"/>`
        // harnais croisé (X) dans le dos
        + `<path d="M-10.5 -25 L9 15 L11 13.5 L-7 -25 Z" fill="@cuir" stroke="@cuirO" stroke-width="0.6"/>`
        + `<path d="M10.5 -25 L-9 15 L-11 13.5 L7 -25 Z" fill="@cuir" stroke="@cuirO" stroke-width="0.6"/>`
        + `<circle cx="0" cy="-5" r="1.4" fill="@metal" stroke="@metalO" stroke-width="0.5"/>`
        // mâchoire dentée à la hanche
        + `<path d="M-13.4 19 Q-11.8 24 -7.2 26.6 L-7.6 28.2 Q-12.4 25.4 -14.2 20 Z" fill="@osO" stroke="@osO" stroke-width="0.5"/>`
        + `<path d="M-13.2 20.5 l-1 2 M-12 22.6 l-0.9 2 M-10.6 24 l-0.6 2.1 M-9 25.2 l-0.4 2" stroke="@os" stroke-width="0.9" stroke-linecap="round"/>`
        + `</g>`,
      // PROFIL — ventre bombé de côté + ceinture + un pendentif
      profile: `<g stroke-linejoin="round">`
        + `<path d="M-8 -28 Q2 -32 8 -27 Q11 -8 11 8 Q12 22 8 31 Q0 35 -7 31 Q-8 20 -8 8 Q-9 -10 -8 -28 Z" fill="@peau" stroke="@peauO" stroke-width="0.8"/>`
        + `<path d="M-8 6 Q-9 20 -7 31 Q0 35 8 31 Q11 24 10 8 Q6 26 0 28 Q-5 25 -8 6 Z" fill="@cuirO" opacity="0.2" stroke="none"/>`
        // pli de graisse + pectoral affaissé
        + `<path d="M-6 -3 Q3 3 10 -1 Q5 1.6 0 1.6 Q-4 1 -6 -3 Z" fill="@cuirO" opacity="0.24" stroke="none"/>`
        + `<path d="M2 -18 Q7 -12 9 -6" fill="none" stroke="@peauO" stroke-width="0.7" opacity="0.4"/>`
        + `<path d="M6 -18 Q10 -4 9 14" fill="none" stroke="@cuirO" stroke-width="1.1" opacity="0.3"/>`
        + `<path d="M-2 6 Q3 4 8 6 Q6.5 16 2 19 Q-2 16 -2 6 Z" fill="#ffffff" opacity="0.06" stroke="none"/>`
        + `<ellipse cx="7.5" cy="20" rx="1.2" ry="1.8" fill="@cuirO" opacity="0.35" stroke="none"/>`
        // ourlet
        + `<path d="M-8 17 Q0 20.5 10.5 17 L10 24 L8 22 L6 27 L3.5 22.5 L1 28 L-1.5 23 L-4 27 L-6 22.5 L-8 24 Z" fill="@vet1" stroke="@vet1O" stroke-width="0.7"/>`
        // écharpe + ceinture
        + `<path d="M-8 4 Q0 8 11 4 L10.6 13 Q0 17 -8 13 Z" fill="@vet2" stroke="@vet2O" stroke-width="0.7"/>`
        + `<path d="M-8 8.5 Q0 12 11 8.5 L10.6 15 Q0 18.5 -8 15 Z" fill="@cuir" stroke="@cuirO" stroke-width="0.8"/>`
        + `<rect x="5.4" y="9.4" width="5.2" height="5.4" rx="0.7" fill="@metal" stroke="@metalO" stroke-width="0.6"/>`
        // sangle d'épaule
        + `<path d="M-1 -25 L6.5 9.5 L9 9.5 L2 -25 Z" fill="@cuir" stroke="@cuirO" stroke-width="0.6"/>`
        // pendentif de dents (crochet d'os)
        + `<path d="M2.4 -18 Q1.4 -12 3.6 -8 Q6.4 -11 5.6 -16 Q4.8 -18.4 2.4 -18 Z" fill="@os" stroke="@osO" stroke-width="0.7"/>`
        + `</g>`,
    },
    // JAMBES — sarouel de toile rapiécé, bande de mollet, botte usée (une jambe, dupliquée)
    jambes: {
      front: `<g stroke-linejoin="round">`
        + `<path d="M-6 0 Q-8 12 -6.6 26 Q-6.4 34 -5.2 42 L-4.6 50 Q0 52 4.6 50 L5.2 42 Q6.4 34 6.6 26 Q8 12 6 0 Q0 3 -6 0 Z" fill="@toile" stroke="@toileO" stroke-width="0.8"/>`
        + `<path d="M-4.6 2 Q-6 14 -4.8 30 M0 2 Q-0.4 16 0 34 M4.6 2 Q6 14 4.8 30" fill="none" stroke="@toileO" stroke-width="0.6" opacity="0.5"/>`
        + `<path d="M-5.6 8 Q-3 6 -1 8 M2 22 Q4 20 5.6 23" fill="none" stroke="@toileH" stroke-width="0.6" opacity="0.5"/>`
        // pièce rapiécée
        + `<path d="M1.6 30 L5 30 L5 36 L1.6 36 Z" fill="@toileO" stroke="@toileO" stroke-width="0.5" opacity="0.6"/>`
        + `<path d="M1.6 32 L5 32 M1.6 34 L5 34 M3 30 L3 36" stroke="@toile" stroke-width="0.4" opacity="0.7"/>`
        // ourlet effiloché
        + `<path d="M-5.2 40 L-5 42.5 M-2.6 40.5 L-2.4 43 M0 41 L0 43.4 M2.6 40.5 L2.8 43 M5 40 L5.2 42.5" stroke="@toileO" stroke-width="0.7" stroke-linecap="round"/>`
        // bande de cuir au mollet
        + `<path d="M-5 40 Q0 42 5 40 L5.2 44 Q0 46 -5.2 44 Z" fill="@cuir" stroke="@cuirO" stroke-width="0.6"/>`
        // botte usée
        + `<path d="M-4.8 44 Q0 46 4.8 44 L5 50 Q0 52.4 -5 50 Z" fill="@cuir" stroke="@cuirO" stroke-width="0.7"/>`
        + `<path d="M-4.8 46.4 Q0 48.4 4.8 46.4" fill="none" stroke="@cuirO" stroke-width="0.6" opacity="0.7"/>`
        + `</g>`,
      back: `<g stroke-linejoin="round">`
        + `<path d="M-6 0 Q-8 12 -6.6 26 Q-6.4 34 -5.2 42 L-4.6 50 Q0 52 4.6 50 L5.2 42 Q6.4 34 6.6 26 Q8 12 6 0 Q0 3 -6 0 Z" fill="@toile" stroke="@toileO" stroke-width="0.8"/>`
        + `<path d="M-6 4 Q-8 14 -6.4 28 Q-6.2 36 -5 44 L-4.4 50 Q0 51 -0.2 50 L0 3 Q-3 2.4 -6 4 Z" fill="@toileO" opacity="0.25" stroke="none"/>`
        + `<path d="M-3 3 Q-4 16 -3 32 M3 3 Q4 16 3 32" fill="none" stroke="@toileO" stroke-width="0.6" opacity="0.5"/>`
        + `<path d="M-5.2 40 L-5 42.5 M-2 40.5 L-1.8 43 M2 40.5 L2.2 43 M5 40 L5.2 42.5" stroke="@toileO" stroke-width="0.7" stroke-linecap="round"/>`
        + `<path d="M-5 40 Q0 42 5 40 L5.2 44 Q0 46 -5.2 44 Z" fill="@cuirO" stroke="@cuirO" stroke-width="0.6"/>`
        + `<path d="M-4.8 44 Q0 46 4.8 44 L5 50 Q0 52.4 -5 50 Z" fill="@cuirO" stroke="@cuirO" stroke-width="0.7"/>`
        + `</g>`,
      profile: `<g stroke-linejoin="round">`
        + `<path d="M-4.6 0 Q-6 12 -4.8 26 Q-4.6 34 -3.6 42 L-3.2 50 Q0 51.6 3.4 50 L4 42 Q5 34 5 26 Q6 12 4.4 0 Q0 3 -4.6 0 Z" fill="@toile" stroke="@toileO" stroke-width="0.8"/>`
        + `<path d="M-0.4 2 Q-1.4 16 -0.4 34 M3.2 3 Q4.2 16 3.4 30" fill="none" stroke="@toileO" stroke-width="0.6" opacity="0.5"/>`
        + `<path d="M0.4 30 L3.6 30 L3.6 36 L0.4 36 Z" fill="@toileO" stroke="@toileO" stroke-width="0.5" opacity="0.5"/>`
        + `<path d="M-3.6 40.4 L-3.4 43 M0 41 L0.2 43.4 M3.6 40.4 L3.8 43" stroke="@toileO" stroke-width="0.7" stroke-linecap="round"/>`
        + `<path d="M-3.4 40 Q0 42 4.6 40 L4.8 44 Q0 46 -3.6 44 Z" fill="@cuir" stroke="@cuirO" stroke-width="0.6"/>`
        + `<path d="M-3.2 44 Q0 46 4.6 44 L6.6 50 Q0 52.2 -3.6 50 Z" fill="@cuir" stroke="@cuirO" stroke-width="0.7"/>`
        + `<path d="M-3 46.4 Q1 48.4 6 46.4" fill="none" stroke="@cuirO" stroke-width="0.6" opacity="0.7"/>`
        + `</g>`,
    },
    // BRAS — pauldron de cuir, bras nu tatoué, brassard de fourrure algueuse, main (dupliqué L/D)
    bras: {
      // PROFIL — +x = AVANT : biceps qui avance, coude marqué à l'arrière, un seul trait de
      // tatouage sur la face visible ; la fourrure suit la courbure du poignet.
      profile: `<g stroke-linejoin="round">`
        + `<path d="M-5 -4 Q0.8 -8 6.2 -3.6 Q7 1 5.5 5.2 Q0.4 7.4 -4.8 4.8 Q-6 0.8 -5 -4 Z" fill="@cuir" stroke="@cuirO" stroke-width="0.8"/>`
        + `<path d="M1.6 -6.6 Q4.8 -5.2 5.8 -2.2" fill="none" stroke="@cuirH" stroke-width="0.6" opacity="0.75"/>`
        + `<path d="M-5.4 0.2 Q0.4 2.4 6 0.2" fill="none" stroke="@cuirO" stroke-width="0.9"/>`
        + `<path d="M-4.9 2 Q0.4 4.2 5.6 2" fill="none" stroke="@cuirH" stroke-width="0.5" opacity="0.6"/>`
        + `<path d="M-4.4 4.4 Q0.4 6.6 5.1 4.4 Q5.6 8 5 11.4 Q4.4 15 3.9 18.2 Q0 20.4 -3.8 18 Q-4.6 11 -4.4 4.4 Z" fill="@peau" stroke="@peauO" stroke-width="0.6"/>`
        + `<path d="M-4.4 5.4 Q-4.9 11.4 -3.9 17.6 Q-2.6 17.9 -1.6 17.6 Q-2.8 11 -2.4 5.6 Q-3.4 5.6 -4.4 5.4 Z" fill="@peauO" opacity="0.4" stroke="none"/>`
        + `<path d="M3.6 6 Q4.6 9 4.2 12.4" fill="none" stroke="@peauH" stroke-width="0.6" opacity="0.7"/>`
        + `<path d="M-3.4 12.6 Q-2.2 13.6 -1 13.2" fill="none" stroke="@peauO" stroke-width="0.6" opacity="0.6"/>`
        + `<path d="M1.8 8 Q0.9 10.6 1.7 13.4" fill="none" stroke="@sceau" stroke-width="0.7" stroke-linecap="round" opacity="0.55"/>`
        + `<path d="M-3.8 16.4 Q0.2 18.8 4.4 16.4 Q5.8 20.2 4.9 24.2 Q0.4 26.6 -4.4 24.2 Q-5.2 20.2 -3.8 16.4 Z" fill="@fourrure" stroke="@fourrureO" stroke-width="0.7"/>`
        + `<path d="M-3.9 17.9 l-1.3 1.7 M-1.8 17.4 l-0.9 2.3 M0.8 18.3 l-0.3 2.6 M3.2 17.3 l1.1 2.1" stroke="@fourrureO" stroke-width="0.9" stroke-linecap="round"/>`
        + `<path d="M-2.8 20.4 l-0.8 2 M-0.2 21.3 l-0.2 2.4 M2.4 20.8 l0.8 2.1" stroke="@fourrureH" stroke-width="0.6" stroke-linecap="round" opacity="0.7"/>`
        + `<path d="M-3 23.7 Q0.5 25.3 4 23.6 L3.8 30.1 Q0.5 31.5 -2.7 30.1 Z" fill="@peau" stroke="@peauO" stroke-width="0.5"/>`
        + `<path d="M-3 24.2 Q-2 24.8 -1.2 25 L-1.3 30.6 Q-2.1 30.5 -2.7 30.1 Z" fill="@peauO" opacity="0.4" stroke="none"/>`
        + `</g>`,
      // DOS — pauldron assombri SANS rivets, triceps ombré côté corps (+x), pas de tatouage
      // (marqueur frontal), fourrure éteinte, main ombrée.
      back: `<g stroke-linejoin="round">`
        + `<path d="M-6 -4.2 Q0 -8.2 6 -4.2 Q7.1 1 5.7 5.1 Q0 7.5 -5.7 5.1 Q-7.1 1 -6 -4.2 Z" fill="@cuir" stroke="@cuirO" stroke-width="0.8"/>`
        + `<path d="M1.4 -7 Q4.4 -5.4 5.6 -1.6 Q6.2 2.6 5.7 5.1 Q0 7.5 -5.7 5.1 Q-1.6 6.4 1.8 5.4 Q3.2 -0.6 1.4 -7 Z" fill="@cuirO" opacity="0.35" stroke="none"/>`
        + `<path d="M-6.1 0.3 Q0 2.5 6.1 0.3" fill="none" stroke="@cuirO" stroke-width="0.9"/>`
        + `<path d="M-5.5 2.2 Q0 4.4 5.5 2.2" fill="none" stroke="@cuirO" stroke-width="0.6" opacity="0.7"/>`
        + `<path d="M-4.7 4.2 Q0 6.4 4.7 4.2 Q5.2 11.2 4.3 18.1 Q0 20.7 -4.3 18.1 Q-5.2 11.2 -4.7 4.2 Z" fill="@peau" stroke="@peauO" stroke-width="0.6"/>`
        + `<path d="M0.8 5.6 Q3.6 6.2 4.6 5 Q5 11.2 4.3 17.9 Q2.4 19.2 0.6 19.5 Q1.8 12 0.8 5.6 Z" fill="@peauO" opacity="0.38" stroke="none"/>`
        + `<path d="M-0.4 6.8 Q-0.8 11 -0.3 15.4" fill="none" stroke="@peauO" stroke-width="0.6" opacity="0.55"/>`
        + `<path d="M-4.4 15.9 Q0 18.5 4.5 15.9 Q5.9 19.9 5 24 Q0 26.6 -4.9 24 Q-5.8 19.9 -4.4 15.9 Z" fill="@fourrure" stroke="@fourrureO" stroke-width="0.7"/>`
        + `<path d="M-4.4 17.5 l-1.3 1.7 M-2.2 17 l-0.9 2.2 M0.3 17.9 l-0.3 2.6 M2.7 17 l0.9 2.2 M4.5 17.6 l1.3 1.6" stroke="@fourrureO" stroke-width="0.9" stroke-linecap="round"/>`
        + `<path d="M0.8 16.6 Q3.4 17.4 4.6 16.4 Q5.6 20.2 4.9 23.8 Q2.8 25.2 0.8 25.6 Q1.9 21 0.8 16.6 Z" fill="@fourrureO" opacity="0.4" stroke="none"/>`
        + `<path d="M-3.5 23.6 Q0 25.2 3.5 23.6 L3.3 30 Q0 31.4 -3.1 30 Z" fill="@peau" stroke="@peauO" stroke-width="0.5"/>`
        + `<path d="M0.4 24.6 Q2.2 24.4 3.5 23.8 L3.3 29.9 Q1.9 30.7 0.4 30.9 Z" fill="@peauO" opacity="0.4" stroke="none"/>`
        + `</g>`,
      front: `<g stroke-linejoin="round">`
      // pauldron de cuir segmenté (2 lames)
      + `<path d="M-6 -4 Q0 -8 6 -4 Q7 1 5.6 5 Q0 7.4 -5.6 5 Q-7 1 -6 -4 Z" fill="@cuir" stroke="@cuirO" stroke-width="0.8"/>`
      + `<path d="M-5.6 -2 Q0 -6 5.6 -2" fill="none" stroke="@cuirH" stroke-width="0.6" opacity="0.7"/>`
      + `<path d="M-6 0.4 Q0 2.4 6 0.4" fill="none" stroke="@cuirO" stroke-width="0.9"/>`
      + `<path d="M-5.4 2 Q0 4.2 5.4 2" fill="none" stroke="@cuirH" stroke-width="0.5" opacity="0.6"/>`
      + `<circle cx="-4.6" cy="-1.4" r="0.7" fill="@cuirO"/><circle cx="4.6" cy="-1.4" r="0.7" fill="@cuirO"/>`
      // bras nu
      + `<path d="M-4.6 4 Q0 6.4 4.6 4 Q5 11 4.2 18 Q0 20.6 -4.2 18 Q-5 11 -4.6 4 Z" fill="@peau" stroke="@peauO" stroke-width="0.6"/>`
      // tatouages rouges (traits)
      + `<path d="M-2.6 7 Q-1.4 10 -2.4 13 M2.4 8 Q1.2 11 2.2 14 M0 9 Q0.6 12 -0.2 15" fill="none" stroke="@sceau" stroke-width="0.7" stroke-linecap="round" opacity="0.6"/>`
      // brassard de fourrure algueuse au poignet
      + `<path d="M-4.6 16 Q0 18.4 4.6 16 Q6 20 5 24 Q0 26.4 -5 24 Q-6 20 -4.6 16 Z" fill="@fourrure" stroke="@fourrureO" stroke-width="0.7"/>`
      + `<path d="M-4.6 17.5 l-1.4 1.6 M-2.6 17 l-1 2.2 M0 18 l-0.4 2.6 M2.6 17 l1 2.2 M4.6 17.5 l1.4 1.6" stroke="@fourrureO" stroke-width="0.9" stroke-linecap="round"/>`
      + `<path d="M-3.6 20 l-0.9 2 M-1 21 l-0.3 2.4 M1.4 20.6 l0.6 2.2 M3.6 20 l1.1 1.9" stroke="@fourrureH" stroke-width="0.6" stroke-linecap="round" opacity="0.7"/>`
      // main
      + `<path d="M-3.6 23.4 Q0 25 3.6 23.4 L3.2 30 Q0 31.4 -3.2 30 Z" fill="@peau" stroke="@peauO" stroke-width="0.5"/>`
      + `</g>`,
    },
  },
};

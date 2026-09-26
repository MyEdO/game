import type { PropViz } from '../../types';
import { P } from '../../decorPalette';

// Tabouret : petit siège sans dossier, assise ronde + trois pieds écartés. Meuble d'appoint des loges
// d'artistes, du passage et des ateliers du théâtre. Cf. plan officiel NADJ 08 folio 38 (image).
export const prop: PropViz = {
  id: 'tabouret',
  label: 'Tabouret',
  searchable: true,
  render: () =>
    `<g><ellipse cx="60" cy="147" rx="24" ry="6" fill="${P.ombre}" opacity="0.2"/>` +
    // trois pieds écartés
    `<path d="M48 118 L40 145" stroke="${P.boisSombre4}" stroke-width="6" stroke-linecap="round"/>` +
    `<path d="M72 118 L80 145" stroke="${P.boisSombre4}" stroke-width="6" stroke-linecap="round"/>` +
    `<path d="M60 120 L60 146" stroke="${P.boisSombre7}" stroke-width="6" stroke-linecap="round"/>` +
    // entretoise basse
    `<path d="M44 132 L76 132" stroke="${P.boisSombre7}" stroke-width="3.5"/>` +
    // assise ronde (tranche + dessus)
    `<ellipse cx="60" cy="116" rx="24" ry="9" fill="${P.boisFonce7}"/>` +
    `<ellipse cx="60" cy="112" rx="24" ry="8" fill="${P.boisFonce8}"/>` +
    `<ellipse cx="60" cy="112" rx="16" ry="5" fill="${P.boisMoyen2}" opacity="0.6"/></g>`,
};

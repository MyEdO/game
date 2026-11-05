import type { PropViz } from '../../types';
import { P } from '../../decorPalette';

// Buisson touffu (sous-bois, haie) — couvert bas naturel.
export const prop: PropViz = { id: "buisson", render: ()=>`<g><ellipse cx="60" cy="147" rx="34" ry="9" fill="${P.ombre}" opacity="0.2"/><ellipse cx="44" cy="130" rx="24" ry="18" fill="${P.feuillageSombre6}"/><ellipse cx="74" cy="132" rx="24" ry="17" fill="${P.feuillageSombre7}"/><ellipse cx="58" cy="118" rx="26" ry="18" fill="${P.feuillageFonce18}"/><ellipse cx="52" cy="112" rx="16" ry="11" fill="${P.feuillageFonce15}"/><path d="M36 124 q6 -8 14 -10 M62 108 q8 0 14 6 M70 128 q8 -2 14 -8" stroke="${P.feuillageSombre8}" stroke-width="2" fill="none" opacity="0.7"/><circle cx="46" cy="122" r="2" fill="${P.sangFonce20}"/><circle cx="66" cy="116" r="2" fill="${P.sangFonce20}"/><circle cx="58" cy="130" r="2" fill="${P.sangFonce20}"/></g>` };

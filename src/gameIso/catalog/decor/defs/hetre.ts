import type { PropViz } from '../../types';
import { P } from '../../decorPalette';

export const prop: PropViz = { id: "hetre", render: ()=>`<g><ellipse cx="60" cy="148" rx="28" ry="11" fill="${P.ombre}" opacity="0.3"/><rect x="54" y="104" width="12" height="46" rx="3" fill="${P.pierreSombre}"/><ellipse cx="60" cy="80" rx="40" ry="34" fill="${P.feuillageMoyen}"/><ellipse cx="72" cy="72" rx="22" ry="18" fill="${P.feuillageClair}" opacity="0.6"/></g>` };

import type { PropViz } from '../../types';
import { P } from '../../decorPalette';

export const prop: PropViz = { id: "mare-sang", render: ()=>`<g><ellipse cx="60" cy="142" rx="38" ry="14" fill="url(#g_blood)" opacity="0.92"/><ellipse cx="38" cy="134" rx="14" ry="5.5" fill="url(#g_blood)" opacity="0.8"/><ellipse cx="86" cy="147" rx="11" ry="4.5" fill="url(#g_blood)" opacity="0.72"/><ellipse cx="60" cy="140" rx="24" ry="8" fill="${P.sangTresSombre3}" opacity="0.55"/><ellipse cx="92" cy="135" rx="4" ry="2" fill="${P.sangFonce9}" opacity="0.85"/><ellipse cx="28" cy="145" rx="3.5" ry="1.8" fill="${P.sangFonce9}" opacity="0.8"/><ellipse cx="74" cy="128" rx="3" ry="1.6" fill="${P.sangFonce9}" opacity="0.75"/></g>` };

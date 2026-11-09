/**
 * Calque de rendu des FX de combat (cf. `useCombatFx`) : flottants typés, projectiles,
 * flashes de zone d'effet, halos d'incantation — dans cet ordre de superposition (z-order SVG).
 * Monté par la surcouche de plateau : ces FX se peignent SUR le monde, jamais dedans.
 */
import type { Dims } from '../../geometry/iso';
import { tileCenter, diamondPath } from '../../geometry/iso';
import { IconG } from '../../ui/Icon';
import { TEINTE_DU_CRITIQUE, TEINTE_DU_FLOTTANT } from '../../noyau/effetsDeLAppel';
import type { Float, Proj, Aura, AoeFlash } from './useCombatFx';

export function FxLayer({ dims, floats, projs, auras, aoes }: { dims: Dims; floats: Float[]; projs: Proj[]; auras: Aura[]; aoes: AoeFlash[] }) {
  return (
    <>
      {floats.map((f) => {
        const { cx, cy } = tileCenter(f.x, f.y, dims);
        const color = f.crit ? TEINTE_DU_CRITIQUE : TEINTE_DU_FLOTTANT[f.kind];
        if (!f.icon) {
          return (
            <text
              key={f.key}
              className="dmg-float"
              x={cx}
              y={cy - 28}
              textAnchor="middle"
              fill={color}
              stroke="#1a0606"
              strokeWidth={0.6}
            >
              {f.text}
              {f.crit ? ' ✸' : ''}
            </text>
          );
        }
        // Flottant AVEC icône (État gagné) : icône + texte centrés ensemble. La classe animée
        // (`dmg-float` : transform CSS) vit sur un <g> SANS transform de position — la position
        // est portée par le <g> parent (le transform CSS écraserait l'attribut).
        const startX = -(18 + f.text.length * 8.2) / 2; // 16px d'icône + 2px d'espace + ~8.2px/caractère (font 18px)
        return (
          <g key={f.key} transform={`translate(${cx},${cy - 28})`} pointerEvents="none">
            <g className="dmg-float" style={{ color }}>
              <IconG id={f.icon} x={startX} y={-13} size={16} />
              <text x={startX + 18} y={0} textAnchor="start" fill={color} stroke="#1a0606" strokeWidth={0.6}>
                {f.text}
              </text>
            </g>
          </g>
        );
      })}
      {projs.map((p) => {
        const a = tileCenter(p.from.x, p.from.y, dims);
        const b = tileCenter(p.to.x, p.to.y, dims);
        const ang = (Math.atan2(b.cy - a.cy, b.cx - a.cx) * 180) / Math.PI;
        return (
          <g
            key={`p${p.key}`}
            className="proj"
            style={{ ['--ax' as never]: `${a.cx}px`, ['--ay' as never]: `${a.cy - 18}px`, ['--bx' as never]: `${b.cx}px`, ['--by' as never]: `${b.cy - 18}px` }}
          >
            {p.kind === 'spell' ? (
              <circle r={5} fill={`url(#${p.gradient ?? 'g_glow'})`} />
            ) : (
              <g transform={`rotate(${ang})`}>
                <rect x={-8} y={-1} width={16} height={2} rx={1} fill="#caa882" />
                <path d="M8 0 l-4 -2 v4 z" fill="#caa882" />
              </g>
            )}
          </g>
        );
      })}
      {/* Flash de zone d'effet (R7) : cases touchées qui s'estompent (souffle/cri/sort de zone). */}
      {aoes.flatMap((ao) =>
        ao.tiles.map((t, i) => (
          <path key={`aoe${ao.key}-${i}`} d={diamondPath(t.x, t.y, dims)} fill={ao.color} opacity={0.5} stroke={ao.color} strokeWidth={1} pointerEvents="none">
            <animate attributeName="opacity" from="0.6" to="0" dur="1.1s" fill="freeze" />
          </path>
        )),
      )}
      {auras.map((au) => {
        const { cx, cy } = tileCenter(au.x, au.y, dims);
        // Canalisation (lanceur) : pulsation serrée et brève. Bénédiction (cible) : expansion soutenue.
        const r0 = au.channel ? 4 : 6, r1 = au.channel ? 18 : 30, dur = au.channel ? '0.45s' : '0.6s';
        return (
          <g key={`au${au.key}`} transform={`translate(${cx},${cy - 18})`} pointerEvents="none">
            <circle r={r0} fill={`url(#${au.gradient})`} opacity={0.85}>
              <animate attributeName="r" from={r0} to={r1} dur={dur} fill="freeze" />
              <animate attributeName="opacity" from="0.85" to="0" dur={dur} fill="freeze" />
            </circle>
            <circle r={3} fill={au.core} opacity={0.9}>
              <animate attributeName="opacity" from="0.9" to="0" dur={dur} fill="freeze" />
            </circle>
          </g>
        );
      })}
    </>
  );
}

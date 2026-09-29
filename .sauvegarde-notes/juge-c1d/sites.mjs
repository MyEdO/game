import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { sitesEspacementHorsEchelle } from '/home/user/game/.wt-1919-H2/scripts/guards/lib/cssCouches.mjs'
const R='/home/user/game/.wt-1919-H2/'
const files=['combat-console.css','initiative-strip.css','party-dock.css','hud.css','log-drawer.css','nom.css','spectator-chip.css','combat-banner.css']
for (const f of files) {
  const rel='src/ui/styles/'+f
  let head=''; try { head=execSync('git -C '+R+' show HEAD:'+rel,{encoding:'utf8',stdio:['pipe','pipe','ignore']}) } catch {}
  const tree=readFileSync(R+rel,'utf8')
  const h=sitesEspacementHorsEchelle([{rel,text:head}]).map(s=>s.ref)
  const t=sitesEspacementHorsEchelle([{rel,text:tree}]).map(s=>s.ref)
  const nouveaux=t.filter(x=>!h.includes(x)), partis=h.filter(x=>!t.includes(x))
  console.log(`${f}: HEAD(garde neuve)=${h.length} arbre=${t.length} ; neufs=${nouveaux.length} partis=${partis.length}`)
  for (const n of nouveaux) console.log('  + '+n)
  for (const n of partis) console.log('  - '+n)
}

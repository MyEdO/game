const path=require('path');
const D=path.join(__dirname,'../../src/data/'),E=f=>require(path.join(__dirname,'entrees',f));
const R=f=>require(D+f+'.json');
const CH=["capacite-de-combat","capacite-de-tir","force","endurance","initiative","agilite","dexterite","intelligence","force-mentale","sociabilite"];
const ci=id=>CH.indexOf(id);
const specMap=a=>{const m={};(a||[]).forEach(s=>{if(s&&s.id)m[s.id]=s.label});return m};
const out={};
const lm=(f,flt=()=>true,lab=x=>x.label)=>{const m={};R(f).filter(flt).forEach(x=>m[x.id]=lab(x));return m};
const POOL={weaponGroupsMelee:lm('weaponGroups',x=>x.combat==='melee'),weaponGroupsRanged:lm('weaponGroups',x=>x.combat==='ranged'),
 winds:lm('domains',x=>x.wind,x=>x.wind),arcaneDomains:lm('domains'),
 ciblesPsy:lm('groups'),groupesDAppartenance:lm('groups'),diseases:lm('maladies'),mutations:lm('mutations'),
 sizes:{minuscule:'Minuscule',tresPetite:'Très petite',petite:'Petite',moyenne:'Moyenne',grande:'Grande',enorme:'Énorme',monstrueuse:'Monstrueuse'}};
const GODS=lm('gods');POOL.cultBlessings=POOL.cultMiracles=POOL.cultChaos=GODS;
const SRC=x=>x.source?[x.source.book,x.source.page]:null;
const PM=x=>{const p=(x.passive||[]).filter(o=>o.op==='charMod'&&ci(o.char)>=0).map(o=>o.min!=null?[ci(o.char),o.mod,o.min]:[ci(o.char),o.mod]);const mv=(x.passive||[]).filter(o=>o.op==='moveMod').reduce((a,o)=>a+o.mod,0);return {pm:p.length?p:undefined,mv:mv||undefined}};
const sm=x=>x.specsSource?(POOL[x.specsSource]||{}):specMap(x.specs);
out.skills={};R('skills').forEach(s=>out.skills[s.id]={l:s.label,c:ci(s.characteristic),s:sm(s),d:s.desc||'',o:SRC(s),h:((s.specs&&s.specs.length)||s.specsSource)?1:0});
out.talents={};R('talents').filter(t=>t.id!=='talent-aleatoire').forEach(t=>out.talents[t.id]={l:t.label,...PM(t),s:sm(t),d:t.desc||'',o:SRC(t),m:t.max==null?null:(typeof t.max==='number'?t.max:{c:ci(t.max.bonusOf)})});
out.traits={};R('traits').forEach(t=>out.traits[t.id]={l:t.label,...PM(t),iv:t.indice?1:undefined,ar:(t.specsSource||t.specs||t.specsOpen)?1:undefined,a:t.attaque?1:0,std:t.standard?1:0,s:sm(t),d:t.desc||'',o:SRC(t)});
out.q={};R('qualities').forEach(q=>out.q[q.id]={l:q.label,d:q.desc||'',o:SRC(q),p:q.polarite});
out.items={};R('trappings').forEach(t=>{const o={l:t.label,k:t.categorie};
 if(t.damage)o.d=[t.damage.plusBF?1:0,t.damage.flat];
 if(t.range)o.r=t.range; if(t.reach)o.re=t.reach; if(t.pa!=null)o.pa=t.pa; if(t.loc)o.lo=t.loc;
 if(t.qualities&&t.qualities.length)o.q=t.qualities.map(q=>[q.id,q.value??null]);
 if(t.subType)o.st=t.subType; if(t.desc)o.ds=t.desc; if(t.enc!=null)o.e=t.enc; if(t.container)o.cap=t.container.capacity; if(t.availability)o.av=t.availability; if(t.price)o.pr=[t.price.gold||0,t.price.silver||0,t.price.brass||0]; out.items[t.id]=o;});
const cr=R('creatures');
out.crl={};cr.forEach(c=>out.crl[c.id]=c.label);
const veh=lm('vehicles');
const it=x=>x.wildcard?{t:(x.wildcard.charAt(0).toUpperCase()+x.wildcard.slice(1).replace(/-/g,' '))+' au choix'}:x.choice?it(x.choice[0]):x.text?{t:x.text}:x.label?{t:x.label}:x.type==='creature'?{c:x.id}:x.type==='vehicle'?{t:veh[x.id]||x.id}:{i:x.id};
const cl=R('careerLevels');
out.careers=R('careers').map(c=>({id:c.id,l:c.label,cls:c.class,rr:Object.keys(c.rand).filter(k=>c.rand[k]!=null),d:c.desc||undefined,o:SRC(c),
 lv:cl.filter(x=>x.career===c.id).sort((a,b)=>a.level-b.level).map(x=>({l:x.label,st:x.status,ch:(x.characteristics||[]).map(ci),
  sk:(x.skills||[]).map(s=>[s.id,s.spec||null]),ta:(x.talents||[]).map(s=>[s.id,s.spec||null]),tr:(x.trappings||[]).map(it)}))}));
out.wg=lm('weaponGroups');out.gods={};R('gods').forEach(g=>{if((g.blessings||[]).length||(g.miracles||[]).length)out.gods[g.id]={l:g.label,b:g.blessings||[]}});out.cls={};out.clt={};out.cld={};R('classes').forEach(c=>{out.cls[c.id]=c.label;out.cld[c.id]={d:c.desc||'',o:SRC(c)};out.clt[c.id]=(c.trappings||[]).map(it)});
out.cr=cr.map(c=>({id:c.id,l:c.label,t:c.title||'',f:c.folder,n:c.named?1:0,dd:c.desc?c.desc.split(/\n\s*\n/)[0]:undefined,
 ch:[c.char.M,...CH.map(k=>c.char[k]??null),c.char.B??null],
 tr:(c.traits||[]).map(t=>[t.id,t.value??null,t.arg??null,t.range??null,t.count??null]),
 op:(c.optionals||[]).map(t=>[t.id,t.value??null,t.arg??null,t.range??null,t.count??null]),
 sk:(c.skills||[]).map(s=>[s.id,s.spec||null,s.value]),ta:(c.talents||[]).map(s=>[s.id,s.spec||null,s.times||null]),
 it:(c.trappings||[]).map(it),sp:(c.spells||[]).length?c.spells:undefined,src:SRC(c)}));
const sp=R('spells');out.spells={};sp.forEach(s=>out.spells[s.id]={l:s.label,d:s.desc||'',o:SRC(s),n:s.cn,e:s.ecole,f:s.family,t:s.subType||undefined,r:s.range||undefined,g:s.target||undefined,u:s.duration||undefined});
{const d=R('details');out.det={age:d.age,taille:d.taille};const T=f=>R(f).map(x=>({r:x.rand,rb:x.randByRace,c:x.color}));out.eyes=T('eyes');out.hairs=T('hairs')}
out.mut={};R('mutations').forEach(m=>out.mut[m.id]={l:m.label,...PM(m),d:m.desc||'',k:m.kind,o:SRC(m)});
out.species=R('species').map(x=>({id:x.id,l:x.label,rc:x.refChar,rr:x.refCareer,mv:x.movement,bc:CH.map(c=>x.baseChar[c]),sk:(x.skills||[]).map(k=>[k.id,k.spec||null]),ta:x.talents||[],o:SRC(x)}));
out.rt=R('talents').filter(t=>t.rand!=null).map(t=>[t.id,t.rand]).sort((a,b)=>a[1]-b[1]);
out.names={};R('names').forEach(n=>out.names[n.id]={m:n.maleFirstNames,f:n.femaleFirstNames,s:n.lastNames,x:n.lastNameSuffixes});
out.books={};R('books').forEach(b=>out.books[b.id]=b.abbr||b.short||b.label);
/* PNJ du guide fan v4.5, convertis aux ids du dépôt : entrees/pnj-guide.json, entrees/ajouts-guide.json */
out.books['guide-fan']='Guide fan v4.5 (maison)';
out.cr.push(...E('pnj-guide.json'));
{const A=E('ajouts-guide.json');
 Object.entries(A.traits).forEach(([id,x])=>out.traits[id]={l:x.l,a:0,std:0,s:{},d:x.d,o:x.o});
 Object.entries(A.spells).forEach(([id,x])=>out.spells[id]={l:x.l,d:x.d,o:x.o,n:x.n,f:x.f,vo:x.livre,t:x.t||undefined,r:x.r,g:x.g,u:x.u});}
/* Créatures du Bestiaire non officiel absentes du jeu et du guide : entrees/pnj-bno.json, entrees/ajouts-bno.json */
out.books['bno']='Bestiaire non officiel (maison)';
out.cr.push(...E('pnj-bno.json'));
Object.entries(E('ajouts-bno.json').traits).forEach(([id,x])=>out.traits[id]={l:x.l,a:0,std:0,s:{},d:x.d,o:x.o});
out.cr.forEach(c=>c.tr.concat(c.op).forEach(t=>{if(t[4]!=null)out.traits[t[0]].nb=1}));
/* #3628 */
const FFFD=[['imm��diatement','immédiatement'],['suppl��mentaire','supplémentaire'],['derni��re','dernière'],['d��cisions','décisions'],['limit��e','limitée'],['pass��e','passée'],['ét��','été'],['terres. ��','terres. »']];
let d=JSON.stringify(out);FFFD.forEach(([x,y])=>{d=d.split(x).join(y)});
if(d.includes('\ufffd'))throw new Error('U+FFFD restant dans les données de l\'atelier');
const fs=require('fs'),t=fs.readFileSync(path.join(__dirname,'template.html'),'utf8');
if(t.split('__DATA__').length!==2)throw new Error('template.html doit contenir __DATA__ une seule fois');
fs.writeFileSync(path.join(__dirname,'atelier-des-pnj.html'),t.replace('__DATA__',()=>d.replace(/<\//g,'<\\/')));

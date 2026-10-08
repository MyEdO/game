import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { gitDe } from '../test/gitDeBanc.mjs'
import { lancerSansEcriture } from './testsSansEcriture.mjs'
import { photoArbre } from '../guards/lib/photoArbre.mjs'

const GARDE = {
  question: 'Un test de scripts/ ou son enfant écrit-il dans la racine de travail pendant une suite ?',
  primitive: 'lancerSansEcriture, photoArbre et intercepterEcritures ; OPERATIONS_FS, canoniser, syncBuiltinESMExports.',
  perimetre: 'Toutes les gates de testsParGate câblées par package.json ; fs, fs.promises et descripteurs ouverts pendant le lancement Node, ignorés compris.',
  exemption: 'Les dépôts de banc et journaux sous os.tmpdir() sont hors de la racine réelle. Le namespace Windows des tuyaux nommés est un canal IPC, sans fichier dans le dépôt.',
  angleMort: ['La photo mesure état et contenu des chemins sales/ignorés, sauf node_modules (dépendances installées volumineuses, couvertes par interception Node). Les enfants non Node nettoyant leurs écritures échappent à cette photo.', 'Un enfant qui supprime explicitement NODE_OPTIONS ou un module natif ne passe pas par les enveloppes fs.'],
  ticket: '#2489',
}

test('la canonisation de la garde ne devient pas une source mesurée du générateur', () => avecDepot((racine) => {
  const collecteur = new URL('../docs/lib/enregistreur-lectures.mjs', import.meta.url).href
  const r = joue(racine, `
    import fs from 'node:fs'; import path from 'node:path'; import os from 'node:os'; import assert from 'node:assert/strict';
    import { installer } from ${JSON.stringify(collecteur)};
    const d = fs.mkdtempSync(path.join(os.tmpdir(), 'mesure-garde-')); fs.mkdirSync(path.join(d, 'src'));
    const collecte = installer({ racine: d, ignores: new Set() });
    try {
      fs.writeFileSync(path.join(d, 'src', 'sortie.ts'), 'export const x = 1');
      assert.deepEqual(collecte.rendu().sondes, []);
      fs.statSync(path.join(d, 'src'));
      assert.deepEqual(collecte.rendu().sondes, [{ chemin: 'src', type: 'stat', existe: true, nature: 'directory' }]);
    } finally { collecte.restaurer(); fs.rmSync(d, { recursive: true, force: true }); }
  `)
  assert.equal(r.code, 0, r.brut)
}))

test('les façades fs, native, path et cwd sont conservées après succès et erreur stricte', () => avecDepot((racine) => {
  const r = joue(racine, `
    import fs from 'node:fs'; import path from 'node:path'; import os from 'node:os'; import assert from 'node:assert/strict';
    const d = fs.mkdtempSync(path.join(os.tmpdir(), 'facade-garde-'));
    const avant = { stat: fs.statSync, exists: fs.existsSync, real: fs.realpathSync, native: fs.realpathSync.native, resolve: path.resolve, basename: path.basename, cwd: process.cwd };
    let lectures = 0;
    const stat = (...a) => { lectures++; return avant.stat(...a) };
    const exists = (...a) => { lectures++; return avant.exists(...a) };
    const real = (...a) => { lectures++; return avant.real(...a) };
    const native = (...a) => { lectures++; return avant.native(...a) };
    real.native = native;
    const resolve = () => { throw Error('resolve simulé ne doit pas entrer dans la garde') };
    const basename = () => { throw Error('basename simulé ne doit pas entrer dans la garde') };
    const cwd = () => 'Z:' + String.fromCharCode(92) + 'simulation';
    fs.statSync = stat; fs.existsSync = exists; fs.realpathSync = real; path.resolve = resolve; path.basename = basename; process.cwd = cwd;
    const identites = () => {
      assert.equal(fs.statSync, stat); assert.equal(fs.existsSync, exists); assert.equal(fs.realpathSync, real);
      assert.equal(fs.realpathSync.native, native); assert.equal(path.resolve, resolve); assert.equal(path.basename, basename); assert.equal(process.cwd, cwd);
      assert.equal(lectures, 0);
    };
    try {
      fs.writeFileSync(path.join(d, 'permis'), 'x'); identites();
      assert.throws(() => fs.writeFileSync(path.join(d, 'invalide' + String.fromCharCode(0)), 'x')); identites();
      fs.rmSync(path.join(d, 'permis')); identites();
    } finally {
      fs.statSync = avant.stat; fs.existsSync = avant.exists; fs.realpathSync = avant.real; path.resolve = avant.resolve; path.basename = avant.basename; process.cwd = avant.cwd;
      fs.rmSync(d, { recursive: true, force: true });
    }
  `)
  assert.equal(r.code, 0, r.brut)
}))

test('le préchargeur laisse tsProgram se charger après le crochet de plateforme', () => avecDepot((racine) => {
  const programme = new URL('../guards/lib/tsProgram.mjs', import.meta.url).href
  const remplacement = `data:text/javascript,${encodeURIComponent("import path from 'node:path'; export default { ...path, resolve: () => '/plateforme-apres-garde' }")}`
  const r = joue(racine, `
    import assert from 'node:assert/strict'; import { registerHooks } from 'node:module';
    let atteint = false;
    const crochet = registerHooks({ resolve(spec, contexte, suivant) {
      if (spec === 'node:path' && contexte.parentURL === ${JSON.stringify(programme)}) {
        atteint = true; return { url: ${JSON.stringify(remplacement)}, shortCircuit: true };
      }
      return suivant(spec, contexte);
    } });
    try {
      const { VIRTUAL_ROOT } = await import(${JSON.stringify(programme)});
      assert.equal(atteint, true); assert.equal(VIRTUAL_ROOT, '/plateforme-apres-garde');
    } finally { crochet.deregister(); }
  `)
  assert.equal(r.code, 0, r.brut)
}))

test('le préchargeur réserve son instance hôte et laisse le helper normal suivre les hooks de plateforme', () => avecDepot((racine) => {
  const helper = new URL('../docs/lib/chemin-mesure.mjs', import.meta.url).href
  const remplacement = `data:text/javascript,${encodeURIComponent("import path from 'node:path'; export default { ...path, resolve: () => '/plateforme-apres-garde' }")}`
  const r = joue(racine, `
    import assert from 'node:assert/strict'; import { registerHooks } from 'node:module';
    let atteint = false;
    const crochet = registerHooks({ resolve(spec, contexte, suivant) {
      if (spec === 'node:path' && contexte.parentURL === ${JSON.stringify(helper)}) {
        atteint = true; return { url: ${JSON.stringify(remplacement)}, shortCircuit: true };
      }
      return suivant(spec, contexte);
    } });
    try {
      const { canoniser } = await import(${JSON.stringify(helper)});
      assert.equal(atteint, true); assert.match(canoniser('absent'), /plateforme-apres-garde$/);
    } finally { crochet.deregister(); }
  `)
  assert.equal(r.code, 0, r.brut)
}))

function avecDepot(fn) {
  const racine = mkdtempSync(join(tmpdir(), 'tests-sans-ecriture-banc-'))
  try {
    const git = gitDe(racine)
    git('init', '-q')
    git('config', 'user.name', 'banc')
    git('config', 'user.email', 'banc@local')
    writeFileSync(join(racine, '.gitignore'), 'ignore.log\n')
    writeFileSync(join(racine, 'suivi'), 'initial\n')
    git('add', '.')
    git('commit', '-q', '-m', 'banc')
    return fn(racine, (fichier) => readFileSync(join(racine, fichier), 'utf8'))
  } finally {
    rmSync(racine, { recursive: true, force: true })
  }
}

function joue(racine, texte, { intercepter = true, env = process.env } = {}) {
  const messages = []
  let brut = ''
  const code = lancerSansEcriture({ racine, env, args: ['--input-type=module', '--eval', texte], journal: (m) => messages.push(m),
    spawn: (commande, args, options) => {
      const resultat = spawnSync(commande, args, { ...options, stdio: 'pipe', encoding: 'utf8',
        env: intercepter ? options.env : { ...options.env, NODE_OPTIONS: '', WFRP_TESTS_RACINE: '', WFRP_TESTS_REFUS: '' },
      })
      brut = `${resultat.stdout ?? ''}${resultat.stderr ?? ''}`
      return resultat
    },
  })
  return { code, messages, brut }
}

test('le préchargeur fonctionne avant une porte Node sans retrait de types', () => avecDepot((racine) => {
  const r = joue(racine, `
    import { spawnSync } from 'node:child_process'; import assert from 'node:assert/strict';
    const enfant = spawnSync(process.execPath, ['--no-experimental-strip-types', '--eval', "process.stdout.write('préchargeur JS')"], { encoding: 'utf8' });
    assert.equal(enfant.status, 0, enfant.stderr); assert.equal(enfant.stdout, 'préchargeur JS');
  `)
  assert.equal(r.code, 0, r.brut)
}))

test('un enfant Python hérite du refus de bytecode même si l’appelant autorise le cache', () => avecDepot((racine) => {
  writeFileSync(join(racine, 'banc_python.py'), 'VALEUR = "module lu"\n')
  const r = joue(racine, `
    import { spawnSync } from 'node:child_process'; import assert from 'node:assert/strict'; import fs from 'node:fs';
    const enfant = spawnSync('python', ['-c', 'import os,sys,banc_python; print(banc_python.VALEUR); print(os.environ["PYTHONDONTWRITEBYTECODE"]); print(sys.dont_write_bytecode)'], { encoding: 'utf8' });
    assert.equal(enfant.status, 0, enfant.stderr); assert.deepEqual(enfant.stdout.trim().split(/\\r?\\n/), ['module lu', '1', 'True']);
    assert.equal(fs.existsSync('__pycache__'), false);
  `, { env: { ...process.env, PYTHONDONTWRITEBYTECODE: '0' } })
  assert.equal(r.code, 0, r.brut)
}))

test('les écritures et nettoyages NodeURL restent refusés lorsque URL globale est remplacée', () => avecDepot((racine, lire) => {
  const r = joue(racine, `
    import fs from 'node:fs'; import { pathToFileURL } from 'node:url'; import assert from 'node:assert/strict';
    const cible = pathToFileURL(process.cwd() + '/suivi');
    const avant = globalThis.URL;
    try {
      globalThis.URL = class { constructor() { throw Error('URL navigateur') } };
      assert.throws(() => fs.writeFileSync(cible, 'pollution'), /REFUS.*writeFileSync suivi/);
      assert.throws(() => fs.rmSync(cible, { force: true }), /REFUS.*rmSync suivi/);
    } finally { globalThis.URL = avant }
  `)
  assert.equal(r.code, 1, r.brut)
  assert.match(r.messages.join('\n'), /writeFileSync suivi/)
  assert.match(r.messages.join('\n'), /rmSync suivi/)
  assert.equal(lire('suivi'), 'initial\n')
}))

test('un arbre initialement sale mais inchangé est accepté ; le code enfant est conservé', () => avecDepot((racine) => {
  writeFileSync(join(racine, 'suivi'), 'sale\n')
  writeFileSync(join(racine, 'ignore.log'), 'déjà présent\n')
  const avant = photoArbre(racine)
  assert.equal(joue(racine, "import { readFile } from 'node:fs/promises'; await readFile('suivi');").code, 0)
  assert.deepEqual(photoArbre(racine), avant)
  assert.equal(joue(racine, 'process.exit(7)').code, 7)
}))

test('la photographie refuse un enfant persistant hors interception Node', () => avecDepot((racine) => {
  const resultat = joue(racine, "require('node:fs').writeFileSync('nouveau', 'pollution')".replace("require('node:fs')", "(await import('node:fs'))"), { intercepter: false })
  assert.equal(resultat.code, 1, GARDE.question)
  assert.match(resultat.messages.join('\n'), /arbre modifié/)
}))

test('append sur un ignoré préexistant est refusé même si le test attrape le refus', () => avecDepot((racine, lire) => {
  writeFileSync(join(racine, 'ignore.log'), 'initial\n')
  const avant = photoArbre(racine)
  const resultat = joue(racine, "import { appendFile } from 'node:fs/promises'; try { await appendFile('ignore.log', 'pollution') } catch {}")
  assert.equal(resultat.code, 1)
  assert.match(resultat.messages.join('\n'), /appendFile ignore.log/)
  assert.equal(lire('ignore.log'), 'initial\n')
  assert.deepEqual(photoArbre(racine), avant)
}))

test('le contenu persistant modifié sans interception reste refusé avec le même état Git', () => avecDepot((racine) => {
  for (const fichier of ['ignore.log', 'suivi']) {
    writeFileSync(join(racine, fichier), 'déjà sale\n')
    const resultat = joue(racine, `import { appendFileSync } from 'node:fs'; appendFileSync(${JSON.stringify(fichier)}, 'pollution')`, { intercepter: false })
    assert.equal(resultat.code, 1)
    assert.match(resultat.messages.join('\n'), /arbre modifié/)
  }
}))

test('écrire puis nettoyer reste rouge, y compris dans un enfant Node', () => avecDepot((racine) => {
  const enfant = "const fs = require('node:fs'); try { fs.writeFileSync('ephemere', 'x'); fs.unlinkSync('ephemere') } catch {}"
  const resultat = joue(racine, `import { spawnSync } from 'node:child_process'; spawnSync(process.execPath, ['--eval', ${JSON.stringify(enfant)}]);`)
  assert.equal(resultat.code, 1)
  assert.match(resultat.messages.join('\n'), /writeFileSync ephemere/)
}))

test('un vrai fichier node --test pollueur est refusé par la porte de suite', () => avecDepot((racine) => {
  writeFileSync(join(racine, 'pollueur.test.mjs'), "import test from 'node:test'; import { writeFileSync } from 'node:fs'; test('pollution', () => writeFileSync('interdit', 'x'))\n")
  const messages = []
  const avant = photoArbre(racine)
  const code = lancerSansEcriture({ racine, args: ['--test', 'pollueur.test.mjs'], journal: (m) => messages.push(m),
    spawn: (commande, args, options) => {
      const env = { ...options.env }
      delete env.NODE_TEST_CONTEXT
      return spawnSync(commande, args, { ...options, env, stdio: 'pipe', encoding: 'utf8' })
    },
  })
  assert.equal(code, 1)
  assert.match(messages.join('\n'), /writeFileSync interdit/)
  assert.deepEqual(photoArbre(racine), avant)
}))

test('open en écriture, mutation de descripteur et FileHandle readonly sont refusés', () => avecDepot((racine, lire) => {
  for (const texte of [
    "import { openSync } from 'node:fs'; try { openSync('suivi', 'r+') } catch {}",
    "import { open, close, ftruncate } from 'node:fs'; open('suivi', 'r', (e, fd) => { try { ftruncate(fd, 0, () => {}) } catch {} finally { close(fd, () => {}) } })",
    "import { open } from 'node:fs/promises'; const h = await open('suivi', 'r'); try { await h.chmod(0o600) } catch {} finally { await h.close() }",
    "import { openSync, createWriteStream, closeSync } from 'node:fs'; const fd = openSync('suivi', 'r'); try { createWriteStream(null, { fd }) } catch {} finally { closeSync(fd) }",
  ]) {
    const resultat = joue(racine, texte)
    assert.equal(resultat.code, 1, texte)
    assert.match(resultat.messages.join('\n'), /REFUS écriture/)
  }
  assert.equal(lire('suivi'), 'initial\n')
}))

test('une photo Git impossible refuse le lancement', () => {
  const racine = mkdtempSync(join(tmpdir(), 'tests-sans-git-'))
  try {
    assert.equal(lancerSansEcriture({ racine, args: ['--eval', ''], spawn: () => assert.fail('ne doit pas lancer'), journal: () => {} }), 1)
  } finally { rmSync(racine, { recursive: true, force: true }) }
})

test('les écritures dans un dossier temporaire externe restent permises', () => avecDepot((racine) => {
  const texte = "import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'; import { tmpdir } from 'node:os'; import { join } from 'node:path'; const d = mkdtempSync(join(tmpdir(), 'permis-')); try { writeFileSync(join(d, 'f'), 'x') } finally { rmSync(d, { recursive: true }) }"
  assert.equal(joue(racine, texte).code, 0)
}))

test('Windows : les deux namespaces IPC nommés échangent des octets sous la garde', { skip: process.platform !== 'win32' }, () => avecDepot((racine) => {
  const serveur = "import net from 'node:net'; net.createServer(socket => socket.on('data', data => socket.write(data))).listen(process.argv[1], () => process.stdout.write('prêt'))"
  const texte = `
    import { spawn } from 'node:child_process';
    import { openSync, writeSync, readSync, closeSync } from 'node:fs';
    import { once } from 'node:events';
    import assert from 'node:assert/strict';
    const separateur = String.fromCharCode(92);
    const pipe = [separateur + separateur + MARQUE, 'pipe', 'wfrp-garde-' + process.pid + '-' + Date.now()].join(separateur);
    const enfant = spawn(process.execPath, ['--input-type=module', '--eval', ${JSON.stringify(serveur)}, pipe], { stdio: ['ignore', 'pipe', 'pipe'] });
    let fd;
    let limite;
    try {
      await Promise.race([once(enfant.stdout, 'data'), new Promise((_, reject) => { limite = setTimeout(() => reject(new Error('serveur IPC absent')), 5000) })]);
      clearTimeout(limite);
      fd = openSync(pipe, 'r+');
      writeSync(fd, Buffer.from('preuve'));
      const retour = Buffer.alloc(6);
      const taille = readSync(fd, retour);
      assert.equal(retour.subarray(0, taille).toString(), 'preuve');
    } finally {
      clearTimeout(limite);
      if (fd !== undefined) closeSync(fd);
      const fin = once(enfant, 'close');
      enfant.kill();
      await fin;
    }
  `
  for (const marque of ['.', '?']) {
    const resultat = joue(racine, texte.replace('MARQUE', JSON.stringify(marque)))
    assert.equal(resultat.code, 0, resultat.brut)
  }
}))

test('un descripteur readonly garde sa cible après retrait du lien temporaire', () => avecDepot((racine) => {
  const preparation = `const d=fs.mkdtempSync(path.join(os.tmpdir(),'fd-lien-'));const lien=path.join(d,'lien');fs.symlinkSync(process.cwd(),lien,'junction');`
  const imports = `import fs from 'node:fs';import path from 'node:path';import os from 'node:os';`
  for (const appel of ['fs.fchmodSync(fd,0o600)', 'fs.fchownSync(fd,0,0)', 'fs.futimesSync(fd,new Date(),new Date())']) {
    const r = joue(racine, `${imports}${preparation}const fd=fs.openSync(path.join(lien,'suivi'),'r');try{fs.rmSync(lien,{recursive:true});try{${appel}}catch{}}finally{fs.closeSync(fd);fs.rmSync(d,{recursive:true,force:true})}`)
    assert.equal(r.code, 1, r.brut)
    assert.match(r.messages.join('\n'), /REFUS.*suivi/)
  }
  for (const appel of ['fs.fchmod(fd,0o600,()=>{})', 'fs.fchown(fd,0,0,()=>{})', 'fs.futimes(fd,new Date(),new Date(),()=>{})']) {
    const r = joue(racine, `${imports}${preparation}fs.open(path.join(lien,'suivi'),'r',(e,fd)=>{if(e)throw e;try{fs.rmSync(lien,{recursive:true});try{${appel}}catch{}}finally{fs.closeSync(fd);fs.rmSync(d,{recursive:true,force:true})}})`)
    assert.equal(r.code, 1, r.brut)
    assert.match(r.messages.join('\n'), /REFUS.*suivi/)
  }
  for (const appel of ['h.chmod(0o600)', 'h.chown(0,0)', 'h.utimes(new Date(),new Date())']) {
    const r = joue(racine, `${imports}${preparation}const h=await fs.promises.open(path.join(lien,'suivi'),'r');try{fs.rmSync(lien,{recursive:true});try{await ${appel}}catch{}}finally{await h.close();fs.rmSync(d,{recursive:true,force:true})}`)
    assert.equal(r.code, 1, r.brut)
    assert.match(r.messages.join('\n'), /REFUS.*suivi/)
  }
}))

test('un lien temporaire vers le dépôt peut être retiré ; écrire à travers le lien reste refusé', () => avecDepot((racine) => {
  const preparer = "import { mkdtempSync, symlinkSync, unlinkSync, rmSync, writeFileSync } from 'node:fs'; import { tmpdir } from 'node:os'; import { join } from 'node:path'; const d = mkdtempSync(join(tmpdir(), 'alias-garde-')); const alias = join(d, 'alias'); symlinkSync(process.cwd(), alias, 'junction');"
  const retirer = "unlinkSync(alias); symlinkSync(process.cwd(), alias, 'junction'); unlinkSync(alias); rmSync(d, { recursive: true });"
  const permis = joue(racine, `${preparer} ${retirer}`)
  assert.equal(permis.code, 0, permis.brut)
  const refuse = joue(racine, `${preparer} try { writeFileSync(join(alias, 'suivi'), 'pollution') } catch {} finally { ${retirer} }`)
  assert.equal(refuse.code, 1, refuse.brut)
  assert.match(refuse.messages.join('\n'), /writeFileSync suivi/)
}))

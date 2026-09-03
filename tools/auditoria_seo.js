/* -----------------------------------------------------------------------------
   AUDITORIA SEO — Numbers Oracle
   Cubre la otra mitad de la superficie de entrada que auditoria_pantallas.js
   no mira: las 28 paginas estaticas por las que llega el trafico de Google
   (suenos/, numero-de-vida/, mundial.html, privacy.html, terms.html,
   delete-account.html). Son paginas planas: sin goTo, sin showTab, sin
   pantallas — el ambito de cada check es document.body entero.

   Reutiliza tal cual de auditoria_pantallas.js: el stub de red/analytics, el
   bloqueo de todo lo que no sea file://, el clasificador de idioma, el
   rectPintado (recorte contra ancestros con overflow no visible) y los 9
   checks geometricos. NO se tocan los umbrales (15% de solape, 80px de
   hueco, 2px de scroll). tapado y fuera-de-contenedor dependen de
   .bottom-nav y #app; ninguna de las 28 paginas tiene esos elementos (se
   verifico con grep antes de escribir esto), asi que quedan estructuralmente
   vacios — no se borran los checks, se documenta por que dan 0 siempre.

   Suma lo especifico de paginas SEO, medido UNA VEZ por pagina (no por
   tamano, no tiene sentido repetirlo 5 veces): title, meta description,
   canonical, cuenta de h1, cuenta y destino de <a href> salientes, y el
   inventario de enlaces internos SIN www (bug conocido: pasan por un 308
   antes de llegar a www.numbersoracle.com).

   COMO SE CORRE: cd /tmp/audit && node auditoria_seo.js
   Salida: resultado_seo.json + resumen por consola.
   ----------------------------------------------------------------------------- */
const {chromium}=require('/tmp/node_modules/playwright-core');
const fs=require('fs');
const path=require('path');

// mismo stub que auditoria_pantallas.js: nada de estas paginas llama a estos
// objetos de verdad (se verifico: solo privacy.html MENCIONA "Supabase" en un
// parrafo de texto, no lo invoca), pero se deja por si acaso y por paridad.
const stub=()=>{const mk=()=>new Proxy(function(){},{get:()=>mk(),apply:()=>mk(),construct:()=>mk()});window.supabase=mk();window.OneSignal=mk();window.posthog=mk();};

/* -----------------------------------------------------------------------------
   Lista de las 28 paginas. Se arma leyendo los directorios (no a mano) para
   no equivocarse de nombre, y se ordena para que la salida sea reproducible.
   "ruta" es la ruta de sitio que se espera ver en el canonical (no se usa
   para navegar, file:// no la necesita; es solo para el reporte).
   ----------------------------------------------------------------------------- */
const suenosFiles=fs.readdirSync('/tmp/audit/suenos').filter(f=>f.endsWith('.html')).sort();
const numeroFiles=fs.readdirSync('/tmp/audit/numero-de-vida').filter(f=>f.endsWith('.html')).sort();

const PAGINAS=[
  ...suenosFiles.map(f=>({file:'suenos/'+f, ruta: f==='index.html'?'/suenos':'/suenos/'+f.replace(/\.html$/,'')})),
  ...numeroFiles.map(f=>({file:'numero-de-vida/'+f, ruta: f==='index.html'?'/numero-de-vida':'/numero-de-vida/'+f.replace(/\.html$/,'')})),
  {file:'mundial.html', ruta:'/mundial.html'},
  {file:'privacy.html', ruta:'/privacy.html'},
  {file:'terms.html', ruta:'/terms.html'},
  {file:'delete-account.html', ruta:'/delete-account.html'},
];
if(PAGINAS.length!==28) throw new Error('Se esperaban 28 paginas, se encontraron '+PAGINAS.length+' — revisar los directorios');

const TAMANOS=[[390,844,'iPhone'],[412,915,'Android'],[360,740,'movil-chico'],[570,640,'PC-chica'],[1280,900,'PC-grande']];

/* -----------------------------------------------------------------------------
   probe() — calcado de auditoria_pantallas.js, sin tocar umbrales ni logica.
   Unica diferencia real: aqui SIEMPRE se llama con un unico ambito, el body
   entero ({root:document.body, etiqueta:'(pagina)'}), porque estas paginas no
   tienen pestanas. tapado y fuera-de-contenedor se dejan en el codigo tal
   cual (nav=null, appRect=null en estas paginas) para que quede constancia de
   que se evaluaron y dieron vacio por construccion, no porque se saltearan a
   mano.
   ----------------------------------------------------------------------------- */
// FIX Opus 3sep: el probe NO se copia. Se extrae en tiempo de ejecucion del
// script de la app (auditoria_pantallas.js), que es donde vive la version
// calibrada. Si se copiara, cada calibracion habria que hacerla dos veces —
// exactamente el problema nº 1 del proyecto (zh.html es una copia a mano de
// index.html). Si el marcador desaparece, esto revienta ruidosamente.
const __src=require('fs').readFileSync(__dirname+'/auditoria_pantallas.js','utf8');
const __ini=__src.indexOf('const probe=(ambitos,lang,ctx)=>{');
const __fin=__src.indexOf('\nconst montarContexto=');
if(__ini<0||__fin<0||__fin<__ini) throw new Error('no encuentro probe() en auditoria_pantallas.js: se ha renombrado?');
let __probeSrc=__src.slice(__ini,__fin);
// recortar en el ultimo "};" (lo que sigue es el comentario de montarContexto)
__probeSrc=__probeSrc.slice(0,__probeSrc.lastIndexOf('\n}')+2);
const probe=new Function('return ('+__probeSrc.replace('const probe=','')+')')();

/* -----------------------------------------------------------------------------
   metaProbe() — lo especifico de SEO. Corre UNA vez por pagina (no por
   tamano), en un viewport cualquiera (se usa el primero de TAMANOS), porque
   title/description/canonical/h1/enlaces no cambian con el tamano de
   pantalla.
   ----------------------------------------------------------------------------- */
const metaProbe=()=>{
  const title=document.title||'';
  const metaDesc=document.querySelector('meta[name="description"]');
  const description=metaDesc?metaDesc.getAttribute('content')||'':null;
  const canonicalEl=document.querySelector('link[rel="canonical"]');
  const canonical=canonicalEl?canonicalEl.getAttribute('href')||'':null;
  const h1s=Array.from(document.querySelectorAll('h1')).map(h=>(h.innerText||'').replace(/\s+/g,' ').trim().slice(0,80));
  const enlaces=Array.from(document.querySelectorAll('a[href]')).map(a=>a.getAttribute('href'));
  const htmlLang=document.documentElement.getAttribute('lang')||null;
  return {title, description, canonical, h1count:h1s.length, h1s, enlaces, htmlLang};
};

/* -----------------------------------------------------------------------------
   Clasificador de enlaces, en Node (no necesita el DOM): a partir del href
   crudo tal cual esta en el atributo, dice si es interno con www, interno sin
   www (el bug de los 308), interno relativo, mailto, o externo.
   ----------------------------------------------------------------------------- */
const clasificarLink=href=>{
  if(!href) return 'vacio';
  if(/^https:\/\/numbersoracle\.com(?!\.)/i.test(href)) return 'interno-SIN-www';
  if(/^https:\/\/www\.numbersoracle\.com/i.test(href)) return 'interno-con-www';
  if(/^\//.test(href)) return 'interno-relativo';
  if(/^mailto:/i.test(href)) return 'mailto';
  if(/^#/.test(href)) return 'ancla';
  if(/^https?:\/\//i.test(href)) return 'externo';
  return 'otro:'+href.slice(0,30);
};

(async()=>{
// FIX: sin estas flags, Chromium hace sondeos de red de fondo (captive-portal
// check, safebrowsing, component-update) por CADA pagina/contexto nuevo que
// se abre, fuera del alcance de page.route (son a nivel navegador, no de
// pagina). El proxy los rechaza uno a uno pero cada rechazo tarda ~0.7s, y
// con 168 aperturas de pagina eso solo ya sumaba los 2 minutos de timeout.
// Se verifico con un script minimo: sin las flags, colgaba; con ellas, la
// misma pagina carga en ~500ms.
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium', args:[
  '--disable-background-networking','--disable-default-apps','--disable-extensions',
  '--disable-sync','--disable-translate','--metrics-recording-only','--no-first-run',
  '--safebrowsing-disable-auto-update','--disable-client-side-phishing-detection',
  '--disable-component-update','--disable-domain-reliability'
]});
const todo={};          // resultados geometricos por pagina x tamano
const meta={};          // resultados de title/description/canonical/h1/links por pagina (una vez)
const fallos=[];
const TOTAL={hidden:0,idioma:0,tapado:0,errJS:0,solape:0,fuera:0,hueco:0,scrollH:0,inalcanzable:0};
const enlacesSinWWW=[]; // inventario global: archivo -> enlace(s) sin www
const titulos={};       // texto de title -> lista de archivos que lo usan (para duplicados)

/* -------------------- pasada 1: metaProbe, una vez por pagina -------------------- */
console.log('===== PASADA 1: title / description / canonical / h1 / enlaces (1 vez por pagina) =====\n');
for(const pg of PAGINAS){
  let p;
  try{
    p=await b.newPage({viewport:{width:TAMANOS[0][0],height:TAMANOS[0][1]}});
    const errores=[];
    p.on('pageerror',e=>errores.push(String(e).split('\n')[0].slice(0,110)));
    await p.addInitScript(stub);
    await p.route('**',r=>{const u=r.request().url();if(u.startsWith('file://'))r.continue();else r.abort();});
    await p.goto('file:///tmp/audit/'+pg.file,{waitUntil:'domcontentloaded'});
    await p.waitForTimeout(400);

    const M=await p.evaluate(metaProbe);
    M.errJScarga=[...new Set(errores)];
    meta[pg.file]=M;

    // inventario de enlaces sin www
    for(const href of M.enlaces){
      if(clasificarLink(href)==='interno-SIN-www')
        enlacesSinWWW.push({archivo:pg.file, enlace:href});
    }
    // duplicados de title
    (titulos[M.title]=titulos[M.title]||[]).push(pg.file);

    const descLen=M.description?M.description.length:0;
    console.log(pg.file.padEnd(42)+
      ' title:'+String(M.title.length).padStart(3)+'c'+
      ' desc:'+(M.description===null?'FALTA':descLen+'c')+
      ' canonical:'+(M.canonical||'FALTA')+
      ' h1:'+M.h1count+
      ' links:'+M.enlaces.length+
      ' htmlLang:'+M.htmlLang+
      (M.errJScarga.length?' *** errJS:'+M.errJScarga.length:''));
  }catch(err){
    fallos.push(pg.file+' | fallo en metaProbe: '+String(err).split('\n')[0].slice(0,160));
    console.log('*** '+pg.file+' FALLO metaProbe: '+String(err).split('\n')[0].slice(0,160));
  }finally{
    if(p) try{await p.close()}catch(e){}
  }
}

/* -------------------- pasada 2: geometria, 28 paginas x 5 tamanos = 140 -------------------- */
console.log('\n===== PASADA 2: geometria (140 casos = 28 paginas x 5 tamanos) =====\n');
for(const pg of PAGINAS){
 for(const [w,h,tn] of TAMANOS){
   const clave=pg.file+' · '+tn;
   let p;
   try{
    p=await b.newPage({viewport:{width:w,height:h}});
    const errores=[];
    p.on('pageerror',e=>errores.push(String(e).split('\n')[0].slice(0,110)));
    await p.addInitScript(stub);
    await p.route('**',r=>{const u=r.request().url();if(u.startsWith('file://'))r.continue();else r.abort();});
    await p.goto('file:///tmp/audit/'+pg.file,{waitUntil:'domcontentloaded'});
    await p.waitForTimeout(600);

    await p.addScriptTag({content:"window.__probe="+probe.toString()});

    let R;
    try{
      R=await p.evaluate(()=>{
        const ambitos=[{root:document.body, etiqueta:'(pagina)'}];
        return window.__probe(ambitos,'es','(pagina-seo)');
      });
    }catch(evalErr){
      fallos.push(clave+' | fallo evaluate(): '+String(evalErr).split('\n')[0].slice(0,160));
      R={hidden:[],idioma:[],tapado:[],solape:[],fuera:[],hueco:[],scrollH:[],inalcanzable:[]};
    }
    R.errores=[...new Set(errores)];
    todo[clave]=R;

    for(const k of ['hidden','idioma','tapado','solape','fuera','hueco','scrollH','inalcanzable'])
      TOTAL[k]+=R[k].length;
    TOTAL.errJS+=R.errores.length;

    console.log('### '+clave+
      '  hidden:'+R.hidden.length+
      ' idioma:'+R.idioma.length+
      ' tapado:'+R.tapado.length+
      ' errJS:'+R.errores.length+
      ' solape:'+R.solape.length+
      ' fuera:'+R.fuera.length+
      ' hueco:'+R.hueco.length+
      ' scrollH:'+R.scrollH.length+
      ' inalcanzable:'+R.inalcanzable.length);
   }catch(casoErr){
    fallos.push(clave+' | fallo caso completo: '+String(casoErr).split('\n')[0].slice(0,160));
    console.log('### '+clave+'  *** FALLO EL CASO: '+String(casoErr).split('\n')[0].slice(0,160));
   }finally{
    if(p) try{await p.close()}catch(e){}
   }
 }
}

/* -------------------- resumen por pagina (suma de sus 5 tamanos) -------------------- */
console.log('\n===== RESUMEN POR PAGINA (suma de sus 5 tamanos) =====\n');
const porPagina={};
for(const pg of PAGINAS){
  const acc={hidden:0,idioma:0,tapado:0,errJS:0,solape:0,fuera:0,hueco:0,scrollH:0,inalcanzable:0};
  for(const [,,tn] of TAMANOS){
    const R=todo[pg.file+' · '+tn];
    if(!R)continue;
    for(const k of ['hidden','idioma','tapado','solape','fuera','hueco','scrollH','inalcanzable']) acc[k]+=R[k].length;
    acc.errJS+=R.errores.length;
  }
  porPagina[pg.file]=acc;
  console.log(pg.file.padEnd(42)+' hidden:'+acc.hidden+' idioma:'+acc.idioma+' tapado:'+acc.tapado+' errJS:'+acc.errJS+' solape:'+acc.solape+' fuera:'+acc.fuera+' hueco:'+acc.hueco+' scrollH:'+acc.scrollH+' inalcanzable:'+acc.inalcanzable);
}

/* -------------------- titulos duplicados -------------------- */
const titulosDuplicados=Object.entries(titulos).filter(([t,fs])=>fs.length>1);

/* -------------------- paginas con problemas de description/canonical/h1 -------------------- */
const problemasSEO=[];
for(const pg of PAGINAS){
  const M=meta[pg.file];
  if(!M)continue;
  const probs=[];
  if(M.description===null) probs.push('SIN meta description');
  else if(M.description.length<50) probs.push('description muy corta ('+M.description.length+'c)');
  else if(M.description.length>160) probs.push('description larga ('+M.description.length+'c, Google la trunca ~155-160)');
  if(!M.canonical) probs.push('SIN canonical');
  else if(!/^https:\/\/www\.numbersoracle\.com/i.test(M.canonical)) probs.push('canonical no apunta a www: '+M.canonical);
  if(M.h1count===0) probs.push('SIN h1');
  else if(M.h1count>1) probs.push(M.h1count+' h1 (deberia haber exactamente 1)');
  if(M.title.length===0) probs.push('SIN title');
  else if(M.title.length>60) probs.push('title largo ('+M.title.length+'c, Google trunca ~60)');
  if(M.errJScarga.length) probs.push('errores JS al cargar: '+M.errJScarga.join(' // '));
  if(probs.length) problemasSEO.push({archivo:pg.file, problemas:probs});
}

/* -------------------- consola: totales globales -------------------- */
console.log('\n===== TOTALES GEOMETRICOS (140 casos = 28 paginas x 5 tamanos) =====');
for(const k in TOTAL) console.log(k+': '+TOTAL[k]);
console.log('(tapado y fuera-de-contenedor dan 0 SIEMPRE por construccion: ninguna de las 28 paginas tiene .bottom-nav ni #app — se verifico con grep antes de correr esto. Se dejan en el codigo y en la tabla para que quede constancia de que se evaluaron, no que se saltearon a ciegas.)');

console.log('\n===== ENLACES INTERNOS SIN WWW ('+enlacesSinWWW.length+' apariciones) — pasan por 308 =====');
if(enlacesSinWWW.length){
  enlacesSinWWW.forEach(e=>console.log('  '+e.archivo+' -> '+e.enlace));
} else {
  console.log('  ninguno');
}

console.log('\n===== TITLES DUPLICADOS ('+titulosDuplicados.length+' titulos repetidos) =====');
if(titulosDuplicados.length){
  titulosDuplicados.forEach(([t,fs])=>console.log('  "'+t+'"  ->  '+fs.join(', ')));
} else {
  console.log('  ninguno: los 28 title son unicos');
}

console.log('\n===== PAGINAS CON PROBLEMAS DE title/description/canonical/h1/errJS ('+problemasSEO.length+' de 28) =====');
if(problemasSEO.length){
  problemasSEO.forEach(p=>console.log('  '+p.archivo+': '+p.problemas.join(' | ')));
} else {
  console.log('  ninguna');
}

if(fallos.length){
  console.log('\n===== CASOS QUE FALLARON POR EXCEPCION DEL SCRIPT ('+fallos.length+') =====');
  fallos.forEach(f=>console.log('- '+f));
} else {
  console.log('\nNingun caso fallo por excepcion del propio script.');
}

require('fs').writeFileSync('/tmp/audit/resultado_seo.json',JSON.stringify({
  paginas:PAGINAS,
  todo, meta, porPagina, TOTAL,
  enlacesSinWWW, titulosDuplicados, problemasSEO,
  fallos
},null,1));
console.log('\nEscrito /tmp/audit/resultado_seo.json');

await b.close();
})();

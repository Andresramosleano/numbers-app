/* -----------------------------------------------------------------------------
   AUTOPRUEBA de auditoria_pantallas.js — Numbers Oracle
   Objetivo: NO auditar produccion (para eso esta auditoria_pantallas.js), sino
   demostrar que cada uno de los 9 checks SI se enciende cuando el defecto que
   ese check dice cazar existe de verdad. Un 0 en la auditoria real no prueba
   nada si el detector esta ciego: aqui inyectamos el defecto a mano, en
   memoria, sobre la pagina ya cargada, y corremos la MISMA logica de
   deteccion (probe/montarContexto, extraidos tal cual de auditoria_pantallas.js,
   sin tocar ese archivo) para ver si lo caza.

   NO se modifica ningun .html en disco. Todas las inyecciones son
   page.addStyleTag / page.addScriptTag / page.evaluate sobre la pagina en
   memoria, en un browser/pagina nueva por caso.

   COMO SE CORRE: cd /tmp/audit && node autoprueba.js
   Salida: tabla por consola + /tmp/audit/autoprueba_resultado.json
   ----------------------------------------------------------------------------- */
const {chromium}=require('/tmp/node_modules/playwright-core');
const fs=require('fs');

// ---- reutilizamos stub/probe/montarContexto/listas TAL CUAL las tiene
// auditoria_pantallas.js. No las retipeamos a mano (riesgo de transcribir
// mal) ni tocamos el archivo original: lo leemos como texto y extraemos el
// bloque de codigo compartido (todo lo que esta ANTES de la IIFE final que
// arranca "(async()=>{"), y lo evaluamos dentro de una funcion propia que
// devuelve esas piezas.
const SRC_ORIGINAL=fs.readFileSync('/tmp/audit/auditoria_pantallas.js','utf8');
const MARCA_INICIO='\nconst stub=';
const MARCA_IIFE='\n(async()=>{';
const idxInicio=SRC_ORIGINAL.indexOf(MARCA_INICIO);
const idxIIFE=SRC_ORIGINAL.indexOf(MARCA_IIFE);
if(idxInicio<0||idxIIFE<0) throw new Error('No encontre los marcadores de inicio/fin del bloque compartido en auditoria_pantallas.js; el archivo cambio de forma inesperada.');
// arrancamos DESPUES del require('playwright-core') del original (esa linea
// usa `require`, que no existe dentro del scope de `new Function`; ya
// tenemos nuestro propio chromium requerido arriba) y terminamos justo antes
// de que arranque su IIFE final.
const BLOQUE_COMPARTIDO=SRC_ORIGINAL.slice(idxInicio,idxIIFE);
const extraer=new Function(BLOQUE_COMPARTIDO+'\nreturn {stub,probe,montarContexto,activarAmbito,CASOS,TAMANOS,TABS,CONTEXTOS};');
const {stub,probe,montarContexto,activarAmbito,CASOS,TAMANOS,TABS,CONTEXTOS}=extraer();
// sanity check: si el archivo original cambio y estas piezas ya no existen,
// mejor fallar ruidosamente aqui que dar un resultado silenciosamente vacio.
for(const [nombre,val] of Object.entries({stub,probe,montarContexto,activarAmbito,CASOS,TAMANOS,TABS,CONTEXTOS})){
  if(val===undefined) throw new Error('No pude extraer "'+nombre+'" de auditoria_pantallas.js. Revisa que el archivo no cambio de forma.');
}
console.log('[setup] stub/probe/montarContexto/listas extraidos de auditoria_pantallas.js sin modificarlo. probe() son '+probe.toString().length+' caracteres.');

const EXEC='/opt/pw-browsers/chromium';

// 3sep2026 (Opus, 2a pasada): index_regresion.html se creaba A MANO en /tmp y
// moria con el contenedor -> el check de solape (el bug real del 2 sep, el mas
// importante de los 9) no se podia volver a correr en frio. Ahora la autoprueba
// lo fabrica ella misma a partir de index.html deshaciendo exactamente los dos
// arreglos del 2 sep. Si alguno de los dos anclajes deja de existir, falla
// ruidosamente aqui en vez de dar un 0 silencioso.
(function generarRegresion(){
  // 3sep2026, tanda 1b: la regla de altura de #app se mudo a shared.css (ahora
  // la comparten los dos idiomas), mientras que .seo-footer sigue inline en
  // index.html (zh.html no tiene footer SEO). Asi que la copia con la regresion
  // necesita tocar LOS DOS archivos, y el HTML de regresion apunta a su propia
  // copia del CSS para no ensuciar el shared.css que se esta auditando.
  const src=fs.readFileSync('/tmp/audit/index.html','utf8');
  const css=fs.readFileSync('/tmp/audit/shared.css','utf8');
  const R1='#app:has(#screen-landing.active),#app:has(#screen-auth.active){height:auto;min-height:100dvh}';
  if(css.split(R1).length-1!==1) throw new Error('generarRegresion: la regla de altura de #app no esta (o esta repetida) en shared.css. El CSS cambio de forma.');
  if(src.indexOf('.seo-footer{')<0||src.split('.seo-footer{')[1].split('}')[0].indexOf('margin-top:20px')<0) throw new Error('generarRegresion: .seo-footer ya no lleva margin-top:20px en index.html. El archivo cambio de forma.');
  fs.writeFileSync('/tmp/audit/shared_regresion.css', css.replace(R1,''));
  let out=src.replace('href="shared.css"','href="shared_regresion.css"');
  if(out===src) throw new Error('generarRegresion: index.html ya no enlaza shared.css.');
  const i=out.indexOf('.seo-footer{'), j=out.indexOf('}',i);
  out=out.slice(0,i)+out.slice(i,j).replace('margin-top:20px','margin-top:0')+out.slice(j);
  fs.writeFileSync('/tmp/audit/index_regresion.html',out);
  console.log('[setup] index_regresion.html + shared_regresion.css generados (arreglos del 2 sep deshechos).');
})();

// helper: abre una pagina nueva de index.html (o el archivo que se pida),
// con el mismo stubbing/bloqueo de red que usa auditoria_pantallas.js, monta
// la pagina y deja lista la inyeccion del script montarContexto+probe.
async function nuevaPagina(browser,{file='index.html',lang='es',w=390,h=844,neutralizarScrollFantasma=false}={}){
  const p=await browser.newPage({viewport:{width:w,height:h}});
  const erroresJS=[];
  p.on('pageerror',e=>erroresJS.push(String(e).split('\n')[0].slice(0,160)));
  await p.addInitScript(stub);
  await p.addInitScript(l=>{try{localStorage.setItem('no_lang',l)}catch(e){}},lang);
  await p.route('**',r=>{const u=r.request().url();if(u.startsWith('file://'))r.continue();else r.abort();});
  await p.goto('file:///tmp/audit/'+file,{waitUntil:'domcontentloaded'});
  await p.waitForTimeout(1400);
  if(neutralizarScrollFantasma){
    // HALLAZGO colateral, no es el defecto que este caso quiere probar:
    // @keyframes fadeUp termina en transform:translateY(0), y con
    // animation-fill-mode:both ese transform (no-none) se queda pegado para
    // siempre en .screen.active. Un transform != none convierte a .screen en
    // "containing block" de sus descendientes position:fixed -- incluida
    // .bottom-nav -- asi que bottom-nav deja de posicionarse contra el
    // viewport y quedan ~12px de overflow real en documentElement.scrollHeight
    // en TODA pantalla de app, en TODO tamano. Eso hace que scrollPagina()
    // (el fallback de puedeScroll) de true casi siempre, aunque nadie pueda
    // rodar de verdad esos 12px. Para que el caso de prueba mida SOLO el
    // defecto que inyectamos (y no este ruido de fondo, que no es el defecto
    // bajo prueba), lo neutralizamos aqui. auditoria_pantallas.js no se toca.
    await p.addStyleTag({content:'.screen{animation:none!important}'});
  }
  await p.addScriptTag({content:"window.__montarContexto="+montarContexto.toString()+";window.__activarAmbito="+activarAmbito.toString()+";window.__probe="+probe.toString()});
  return {p,erroresJS};
}

// corre montarContexto+probe ya con el defecto inyectado (el defecto se
// inyecta ANTES de llamar a esto, dentro de cada test). Devuelve R tal cual
// la devuelve probe() en auditoria_pantallas.js.
async function correrProbe(p,ctx,tabs,lang){
  // 3sep2026 (Opus, 2a pasada): esto llamaba a __probe(ambitos,...) de una vez,
  // pero probe() mide sobre window.__root, que SOLO lo pone activarAmbito().
  // Sin eso, __root era undefined y 8 de los 9 checks morian con
  // "Cannot read properties of undefined (reading 'querySelectorAll')",
  // dando 0/9 sin que el sanity check lo notara. Ahora replica el bucle real
  // de auditoria_pantallas.js: activar ambito -> esperar -> medir ese ambito.
  const R={hidden:[],idioma:[],tapado:[],solape:[],fuera:[],hueco:[],scrollH:[],inalcanzable:[]};
  const ambitos=await p.evaluate(([ctx,tabs])=>window.__montarContexto(ctx,tabs),[ctx,tabs]);
  await p.waitForTimeout(250);
  for(const nombre of ambitos){
    const est=await p.evaluate(n=>window.__activarAmbito(n),nombre);
    if(!est||!est.ok) continue;
    await p.waitForTimeout(180);
    const parcial=await p.evaluate(([n,lang,ctx])=>window.__probe([{root:window.__root,etiqueta:n}],lang,ctx),[nombre,lang,ctx]);
    for(const k of Object.keys(R)) R[k].push(...(parcial[k]||[]));
  }
  {const vistos=new Set(),lim=[];
   for(const l of R.solape){const par=l.slice(l.indexOf(' | ')+3);if(vistos.has(par))continue;vistos.add(par);lim.push(l);}
   R.solape=lim;}
  return R;
}

const RESULTADOS=[]; // {check, defecto, esperado, obtenido, veredicto, detalle}

function registrar(check,defecto,esperado,obtenido,detalle){
  const veredicto=obtenido>=esperado?'PASA':'FALLA';
  RESULTADOS.push({check,defecto,esperado,obtenido,veredicto,detalle:detalle||''});
  return veredicto;
}

(async()=>{
const b=await chromium.launch({executablePath:EXEC});

/* ============================================================
   1) hidden-no-oculta
   Un elemento con [hidden] que existe de verdad en la pantalla activa
   (.game-card[hidden] en la pestana "hoy", app-invitado) recibe
   display:block!important via CSS inyectado, EXACTAMENTE como
   describe el check 1: "hidden que no oculta".
   ============================================================ */
try{
  const {p}=await nuevaPagina(b,{file:'index.html',lang:'es',w:390,h:844});
  // confirmamos que el elemento objetivo existe y esta realmente oculto ANTES
  // de inyectar el defecto (si no existe, la prueba no prueba nada).
  // OJO: en #tab-form el .game-card[hidden] (data-game=chance) vive DENTRO
  // de un acordeon cerrado (.acc-body{display:none}); ese "display:none" del
  // acordeon tapa cualquier display que le pongamos al [hidden] interno, asi
  // que ese sitio no sirve para aislar el defecto (confundiria dos
  // mecanismos de ocultar distintos). En #tab-oraculos las .game-card[hidden]
  // (chance/destiny/sports) estan sueltas dentro de .orac-grid, sin ningun
  // ancestro oculto de por medio -- ese es el sitio limpio para esta prueba.
  const antes=await p.evaluate(()=>{
    try{goTo('screen-main')}catch(e){}
    try{showTab('oraculos')}catch(e){}
    const el=document.querySelector('#tab-oraculos .game-card[hidden]');
    if(!el)return null;
    const cs=getComputedStyle(el);
    return {existe:true,display:cs.display,alturaVisible:el.getBoundingClientRect().height};
  });
  if(!antes||!antes.existe) throw new Error('no encontre .game-card[hidden] en #tab-oraculos: no puedo montar el defecto');
  if(antes.display!=='none') throw new Error('el elemento objetivo YA estaba visible antes de inyectar nada (display:'+antes.display+'); la pagina base ya tiene el bug, no sirve como caso de prueba limpio');
  // inyectamos el defecto: una regla mas especifica que [hidden]{display:none!important}
  await p.addStyleTag({content:'.game-card[hidden]{display:block!important}'});
  const R=await correrProbe(p,'app-invitado',['oraculos'],'es');
  registrar('hidden-no-oculta','.game-card[hidden] (#tab-oraculos, data-game=chance/destiny/sports) con display:block!important (CSS mas especifico que anula [hidden]{display:none!important})',1,R.hidden.length,R.hidden[0]);
  await p.close();
}catch(e){
  registrar('hidden-no-oculta','.game-card[hidden] con display:block!important',1,0,'EXCEPCION construyendo el caso: '+String(e).split('\n')[0]);
}

/* ============================================================
   2) idioma
   Parrafo en ingles (>=12 caracteres, con palabras de la lista EN) inyectado
   dentro de #screen-landing mientras la pagina esta en es (no_lang=es).
   ============================================================ */
try{
  const {p}=await nuevaPagina(b,{file:'index.html',lang:'es',w:390,h:844});
  const textoEN='This is your daily message for today, read it now';
  await p.evaluate(t=>{
    try{goTo('screen-landing')}catch(e){}
    const root=document.getElementById('screen-landing');
    const d=document.createElement('p');
    d.id='defecto-idioma';
    d.textContent=t;
    root.appendChild(d);
  },textoEN);
  const R=await correrProbe(p,'landing-invitado',TABS,'es');
  registrar('idioma','parrafo en pagina ES: "'+textoEN+'"',1,R.idioma.length,R.idioma[0]);
  await p.close();
}catch(e){
  registrar('idioma','parrafo EN inyectado en landing ES',1,0,'EXCEPCION: '+String(e).split('\n')[0]);
}

/* ============================================================
   3) tapado
   Bloque de texto position:static colocado justo bajo .bottom-nav, dentro
   de un ambito SIN scroll posible (ni interno ni de pagina). Contexto
   app-invitado, pestana "hoy".

   Nota tecnica importante (documentada porque no es obvia): #tab-hoy trae
   overflow-y:auto DE FABRICA y con su contenido normal YA excede su propio
   clientHeight (o sea, cualquier elemento dentro de #tab-hoy ya es
   "alcanzable rodando" el propio tab, antes de que nosotros metamos nada).
   Y por separado, TODA la pagina lleva pegados al final del body dos
   <footer class="seo-footer"> (contenido SEO de Suenos y Numeros) que
   existen siempre, fuera de #app, y que por si solos hacen que
   document.documentElement.scrollHeight > clientHeight en CUALQUIER
   pantalla — o sea que el fallback scrollPagina() de puedeScroll() da true
   casi siempre en produccion. Ninguna de las dos cosas es el defecto que
   este check busca cazar (tapado por el menu fijo); son scroll real que de
   hecho hace alcanzable el contenido. Para que el caso de prueba sea limpio
   -inyectar SOLO el defecto de tapado, sin scroll de ningun tipo que lo
   contradiga- neutralizamos ambas fuentes de scroll para este caso:
     - #tab-hoy pasa a overflow:hidden (dejamos de listarla como "scrollable"
       segun el propio criterio del check, que solo cuenta auto/scroll)
     - ocultamos los .seo-footer (quitamos el scroll de documento)
   y vaciamos el contenido normal de #tab-hoy para poder posicionar el
   bloque de prueba exactamente bajo el nav sin adivinar alturas.
   ============================================================ */
try{
  const {p}=await nuevaPagina(b,{file:'index.html',lang:'es',w:390,h:844,neutralizarScrollFantasma:true});
  const info=await p.evaluate(()=>{
    try{goTo('screen-main')}catch(e){}
    try{showTab('hoy')}catch(e){}
    document.querySelectorAll('.seo-footer').forEach(f=>f.style.setProperty('display','none','important'));
    const tabHoy=document.getElementById('tab-hoy');
    tabHoy.style.setProperty('overflow','hidden','important');
    tabHoy.innerHTML=''; // limpiamos SOLO en memoria, el archivo en disco no se toca
    const nav=document.querySelector('.bottom-nav');
    const navRect=nav.getBoundingClientRect();
    const tabRect=tabHoy.getBoundingClientRect();
    const d=document.createElement('div');
    d.id='defecto-tapado';
    d.style.position='static';
    d.style.marginTop=Math.max(0,navRect.top-tabRect.top)+'px';
    d.textContent='Texto de prueba que deberia quedar tapado por el menu inferior fijo, sin poder alcanzarlo';
    tabHoy.appendChild(d);
    const dRect=d.getBoundingClientRect();
    return {
      navRect:{top:navRect.top,bottom:navRect.bottom},
      dRect:{top:dRect.top,bottom:dRect.bottom},
      docScrollH:document.documentElement.scrollHeight,
      docClientH:document.documentElement.clientHeight,
      tabHoyOverflowY:getComputedStyle(tabHoy).overflowY,
    };
  });
  const R=await correrProbe(p,'app-invitado',['hoy'],'es');
  const detalle=R.tapado[0]||('geometria: '+JSON.stringify(info));
  registrar('tapado','div position:static bajo .bottom-nav dentro de #tab-hoy (overflow forzado a hidden, seo-footer oculto para que no haya scroll real que lo haga alcanzable)',1,R.tapado.length,detalle);
  await p.close();
}catch(e){
  registrar('tapado','div position:static bajo .bottom-nav',1,0,'EXCEPCION: '+String(e).split('\n')[0]);
}

/* ============================================================
   4) errJS
   Un <script> que lanza una excepcion no capturada al cargar.
   ============================================================ */
try{
  const {p,erroresJS}=await nuevaPagina(b,{file:'index.html',lang:'es',w:390,h:844});
  await p.addScriptTag({content:"throw new Error('defecto inyectado por autoprueba.js: errJS')"});
  await p.waitForTimeout(100);
  const R=await correrProbe(p,'landing-invitado',TABS,'es');
  R.errores=[...new Set(erroresJS)];
  registrar('errJS','<script>throw new Error(...)</script> inyectado con addScriptTag',1,R.errores.length,R.errores[0]);
  await p.close();
}catch(e){
  registrar('errJS','script que lanza excepcion',1,0,'EXCEPCION: '+String(e).split('\n')[0]);
}

/* ============================================================
   5) solape — EL CASO MAS IMPORTANTE: es el bug real que se publico el 2 sep.
   Se usa index_regresion.html TAL CUAL (con la regla de altura de #app y el
   margin-top:0 del footer quitadas), sin inyectar nada mas: la regresion ya
   esta ahi. Contexto landing-invitado, 360x740 y 570x640 (los mismos tamanos
   donde ya se habia verificado el problema). Se compara contra index.html
   (produccion, sin la regresion) en los mismos tamanos para confirmar 0.
   ============================================================ */
try{
  const tamsSolape=[[360,740,'movil-chico'],[570,640,'PC-chica']];
  let totalRegresion=0, detalleRegresion=[];
  for(const [w,h,tn] of tamsSolape){
    const {p}=await nuevaPagina(b,{file:'index_regresion.html',lang:'es',w,h});
    const R=await correrProbe(p,'landing-invitado',TABS,'es');
    totalRegresion+=R.solape.length;
    if(R.solape.length) detalleRegresion.push(tn+': '+R.solape.length+' -> '+R.solape[0]);
    await p.close();
  }
  registrar('solape','index_regresion.html (regla de altura de #app y margin-top del footer quitadas), landing-invitado, 360x740 + 570x640',1,totalRegresion,detalleRegresion.join(' | ')||'(sin avisos)');

  let totalProd=0;
  for(const [w,h,tn] of tamsSolape){
    const {p}=await nuevaPagina(b,{file:'index.html',lang:'es',w,h});
    const R=await correrProbe(p,'landing-invitado',TABS,'es');
    totalProd+=R.solape.length;
    await p.close();
  }
  // aqui "esperado" es 0 avisos (control negativo): PASA si obtenido<=esperado
  const veredictoControl=totalProd<=0?'PASA':'FALLA';
  RESULTADOS.push({check:'solape (control, index.html)',defecto:'index.html real, sin la regresion, mismos tamanos',esperado:0,obtenido:totalProd,veredicto:veredictoControl,detalle:'confirma que el check no dispara en produccion sana'});
}catch(e){
  registrar('solape','index_regresion.html landing-invitado 360x740+570x640',1,0,'EXCEPCION: '+String(e).split('\n')[0]);
}

/* ============================================================
   6) fuera-de-contenedor
   Bloque alto (position:static, sin scroll) dentro de #app (pestana "hoy" de
   app-invitado activa) que sobresale por debajo del rect de #app. Misma
   neutralizacion de fuentes de scroll que en el check 3 (overflow:hidden en
   #tab-hoy + seo-footer oculto), para que el UNICO camino de "alcanzarlo" sea
   el que el check 6 esta hecho para detectar: que no lo hay.
   ============================================================ */
try{
  const {p}=await nuevaPagina(b,{file:'index.html',lang:'es',w:390,h:844,neutralizarScrollFantasma:true});
  const info=await p.evaluate(()=>{
    try{goTo('screen-main')}catch(e){}
    try{showTab('hoy')}catch(e){}
    document.querySelectorAll('.seo-footer').forEach(f=>f.style.setProperty('display','none','important'));
    const app=document.getElementById('app');
    const tabHoy=document.getElementById('tab-hoy');
    tabHoy.style.setProperty('overflow','hidden','important');
    tabHoy.innerHTML='';
    const d=document.createElement('div');
    d.id='defecto-fuera';
    d.style.position='static';
    d.style.height='2000px';
    d.textContent='Bloque de prueba que deberia sobresalir por debajo de #app sin forma de alcanzarlo rodando';
    tabHoy.appendChild(d);
    const appRect=app.getBoundingClientRect();
    const dRect=d.getBoundingClientRect();
    return {
      appBottom:appRect.bottom,dBottom:dRect.bottom,
      docScrollH:document.documentElement.scrollHeight,docClientH:document.documentElement.clientHeight,
    };
  });
  const R=await correrProbe(p,'app-invitado',['hoy'],'es');
  const detalle=R.fuera[0]||('geometria: '+JSON.stringify(info));
  registrar('fuera-de-contenedor','div de 2000px de alto dentro de #tab-hoy (dentro de #app), overflow forzado a hidden y seo-footer oculto para que no haya scroll real',1,R.fuera.length,detalle);
  await p.close();
}catch(e){
  registrar('fuera-de-contenedor','div alto dentro de #app sin scroll',1,0,'EXCEPCION: '+String(e).split('\n')[0]);
}

/* ============================================================
   7) hueco
   margin-top:200px (> umbral de 80px) en un hermano visible dentro de la
   pantalla activa (landing).
   ============================================================ */
try{
  const {p}=await nuevaPagina(b,{file:'index.html',lang:'es',w:390,h:844});
  await p.evaluate(()=>{
    try{goTo('screen-landing')}catch(e){}
    const root=document.getElementById('screen-landing');
    const a=document.createElement('div');
    a.id='defecto-hueco-a';
    a.textContent='Hermano A (encima del hueco)';
    const bE=document.createElement('div');
    bE.id='defecto-hueco-b';
    bE.textContent='Hermano B (debajo del hueco, con margin-top:200px)';
    bE.style.marginTop='200px';
    root.appendChild(a);
    root.appendChild(bE);
  });
  const R=await correrProbe(p,'landing-invitado',TABS,'es');
  registrar('hueco','dos divs hermanos en #screen-landing, el segundo con margin-top:200px (umbral 80px)',1,R.hueco.length,R.hueco.find(l=>l.includes('defecto-hueco'))||R.hueco[0]);
  await p.close();
}catch(e){
  registrar('hueco','margin-top:200px en hermano de la pantalla activa',1,0,'EXCEPCION: '+String(e).split('\n')[0]);
}

/* ============================================================
   8) scroll-horizontal
   Elemento de width:3000px inyectado en la pantalla activa (landing).
   ============================================================ */
try{
  const {p}=await nuevaPagina(b,{file:'index.html',lang:'es',w:390,h:844});
  await p.evaluate(()=>{
    try{goTo('screen-landing')}catch(e){}
    const root=document.getElementById('screen-landing');
    const d=document.createElement('div');
    d.id='defecto-scrollh';
    d.style.width='3000px';
    d.style.height='10px';
    d.textContent='Bloque de prueba de 3000px de ancho';
    root.appendChild(d);
  });
  const R=await correrProbe(p,'landing-invitado',TABS,'es');
  registrar('scroll-horizontal','div de width:3000px inyectado en #screen-landing',1,R.scrollH.length,R.scrollH[0]);
  await p.close();
}catch(e){
  registrar('scroll-horizontal','div width:3000px en la pantalla activa',1,0,'EXCEPCION: '+String(e).split('\n')[0]);
}

/* ============================================================
   9) inalcanzable
   <button> con texto dentro de un contenedor con overflow:hidden y altura
   fija, colocado fuera del viewport, en una pagina que NO puede rodar (ni
   por el ambito ni por el documento entero: mismo cuidado que en el check 3
   con #tab-hoy y los .seo-footer).
   ============================================================ */
try{
  const {p}=await nuevaPagina(b,{file:'index.html',lang:'es',w:390,h:844,neutralizarScrollFantasma:true});
  const info=await p.evaluate(()=>{
    try{goTo('screen-main')}catch(e){}
    try{showTab('hoy')}catch(e){}
    document.querySelectorAll('.seo-footer').forEach(f=>f.style.setProperty('display','none','important'));
    const tabHoy=document.getElementById('tab-hoy');
    tabHoy.innerHTML='';
    tabHoy.style.setProperty('overflow','hidden','important');
    tabHoy.style.setProperty('height','768px','important');
    tabHoy.style.position='relative';
    const btn=document.createElement('button');
    btn.id='defecto-inalcanzable';
    btn.textContent='Boton fuera de alcance';
    btn.style.position='absolute';
    btn.style.top=(innerHeight+500)+'px'; // muy por debajo del viewport
    btn.style.left='10px';
    tabHoy.appendChild(btn);
    const r=btn.getBoundingClientRect();
    return {
      btnRect:{top:r.top,bottom:r.bottom,left:r.left,right:r.right},
      innerHeight,innerWidth,
      docScrollH:document.documentElement.scrollHeight,docClientH:document.documentElement.clientHeight,
      tabHoyOverflowY:getComputedStyle(tabHoy).overflowY,
    };
  });
  const R=await correrProbe(p,'app-invitado',['hoy'],'es');
  const detalle=R.inalcanzable[0]||('geometria: '+JSON.stringify(info));
  registrar('inalcanzable','<button> position:absolute muy por debajo del viewport, dentro de #tab-hoy con overflow:hidden + altura fija (768px), seo-footer oculto para que el documento tampoco pueda rodar',1,R.inalcanzable.length,detalle);
  await p.close();
}catch(e){
  registrar('inalcanzable','button fuera del viewport sin scroll posible',1,0,'EXCEPCION: '+String(e).split('\n')[0]);
}

await b.close();

/* ============================================================
   salida
   ============================================================ */
console.log('\n===== AUTOPRUEBA: resultado por check =====\n');
const col=(s,n)=>String(s).padEnd(n);
console.log(col('check',24)+col('esperado',9)+col('obtenido',9)+'veredicto');
console.log('-'.repeat(60));
for(const r of RESULTADOS){
  console.log(col(r.check,24)+col('>= '+r.esperado,9)+col(String(r.obtenido),9)+r.veredicto);
}
console.log('\n===== detalle =====\n');
for(const r of RESULTADOS){
  console.log('['+r.veredicto+'] '+r.check);
  console.log('  defecto inyectado: '+r.defecto);
  console.log('  esperado>='+r.esperado+'  obtenido='+r.obtenido);
  if(r.detalle) console.log('  evidencia: '+String(r.detalle).slice(0,300));
  console.log('');
}

const vivos=RESULTADOS.filter(r=>r.veredicto==='PASA').length;
console.log('AUTOPRUEBA: '+vivos+'/'+RESULTADOS.length+' checks vivos');

fs.writeFileSync('/tmp/audit/autoprueba_resultado.json',JSON.stringify({RESULTADOS,vivos,total:RESULTADOS.length},null,1));
})().catch(e=>{
  console.error('FALLO GENERAL DE autoprueba.js (excepcion propia, no de un caso individual):');
  console.error(e);
  process.exit(1);
});

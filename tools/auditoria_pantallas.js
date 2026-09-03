/* -----------------------------------------------------------------------------
   AUDITORIA DE PANTALLAS v2 — Numbers Oracle
   Ampliacion del script del 2 sep. La v1 solo miraba tab-por-tab dentro de
   screen-main (15 casos: 3 idiomas x 5 tamanos). Esta v2 amplia la matriz a
   landing, login y app (invitado y con sesion) x 3 idiomas x 5 tamanos, y
   suma 5 checks nuevos que la v1 no cubria: solape de texto (la regresion del
   2 sep, texto de landing cayendo dentro del footer SEO), texto que se sale
   por debajo de #app, huecos verticales sospechosos entre hermanos, scroll
   horizontal indebido, y elementos clicables que quedan fuera del viewport y
   sin scroll para alcanzarlos (el bug de la 7a pregunta del 1 sep).

   NO calibra umbrales ni decide que es un bug real: solo mide y reporta
   numeros crudos para que otro humano (o Andres) juzgue. Los umbrales dados
   (15%, 80px, 2px, 8 caracteres) son fijos, no se tocan aqui.

   COMO SE CORRE: cd /tmp/audit && node auditoria_pantallas.js
   Salida: resultado_v2.json + resumen por consola, un total final por check.
   ----------------------------------------------------------------------------- */
const {chromium}=require('/tmp/node_modules/playwright-core');

// mismo truco de v1: stub de todo lo que hace red/push/analytics para que la
// pagina cargue sin salir a internet (aqui no hay internet de todas formas).
const stub=()=>{const mk=()=>new Proxy(function(){},{get:()=>mk(),apply:()=>mk(),construct:()=>mk()});window.supabase=mk();window.OneSignal=mk();window.posthog=mk();};

const CASOS=[
 {file:'index.html',lang:'es'},
 {file:'index.html',lang:'en'},
 {file:'zh.html',lang:'zh'},
];
const TAMANOS=[[390,844,'iPhone'],[412,915,'Android'],[360,740,'movil-chico'],[570,640,'PC-chica'],[1280,900,'PC-grande']];
// mismos nombres cortos que usa v1 (sin el prefijo tab-, showTab lo añade solo)
const TABS=['hoy','numa','oraculos','profile','form','result','ciclos','fuerzas','upgrade'];
const CONTEXTOS=['landing-invitado','landing-sesion','login','app-invitado','app-sesion'];

/* -----------------------------------------------------------------------------
   probe() se inyecta entera en la pagina via addScriptTag+evaluate (igual que
   v1). Recibe el contexto ya montado (pantalla activa, perfil puesto o no) y
   barre, para cada "ambito" (una pestaña en app-*, o la pantalla entera en
   landing/login), los 9 checks. Todo el codigo de deteccion vive aqui adentro
   porque tiene que correr en el contexto del DOM de la pagina, no en node.
   ----------------------------------------------------------------------------- */
const probe=(ambitos,lang,ctx)=>{
  const R={hidden:[],idioma:[],tapado:[],solape:[],fuera:[],hueco:[],scrollH:[],inalcanzable:[]};

  // clasificador de idioma de v1, tal cual, incluida la lista de marcas exentas
  const ES=/[¿¡ñáéíóú]|\b(que|para|con|tus|los|las|una|por|del|más|cómo|qué|día|números|energía|tu)\b/i;
  const EN=/\b(the|your|you|and|with|for|this|that|today|question|numbers|day|energy|what|how|my|is|are)\b/i;
  const CJK=/[一-鿿]/;
  const marca=/^(NUMA|Numbers Oracle|KAI|MEI|Drago|数字神谕)/i;
  const clasificar=s=>{ if(CJK.test(s))return 'zh'; const es=ES.test(s), en=EN.test(s);
    if(es&&!en)return 'es'; if(en&&!es)return 'en'; return null; };

  const nav=document.querySelector('.bottom-nav');
  // FIX Opus 3sep: v1 paraba en document.body y NO contaba el scroll de la
  // pagina entera (documentElement con overflow visible pero scrollHeight >
  // clientHeight). Eso daba 3 falsos positivos de "inalcanzable" en la landing:
  // el boton "Ya tengo cuenta" esta bajo el pliegue, pero se llega rodando.
  const scrollPagina=()=>document.documentElement.scrollHeight>document.documentElement.clientHeight+2;
  const puedeScroll=el=>{let p=el;while(p&&p!==document.body){const o=getComputedStyle(p).overflowY;if((o==='auto'||o==='scroll')&&p.scrollHeight>p.clientHeight+2)return true;p=p.parentElement}return scrollPagina()};
  // idem pero mirando tambien overflowX, para el check 9 (inalcanzable puede
  // estar fuera por el lado horizontal, no solo vertical)
  const puedeScrollX=el=>{let p=el;while(p&&p!==document.body){const o=getComputedStyle(p).overflowX;if((o==='auto'||o==='scroll')&&p.scrollWidth>p.clientWidth+2)return true;p=p.parentElement}return false};
  const app=document.getElementById('app');
  const appRect=app?app.getBoundingClientRect():null;

  const short=s=>String(s).replace(/\s+/g,' ').trim().slice(0,60);

  // ---- checks que dependen del "ambito" activo (una pestaña, o la pantalla
  // entera en landing/login) ----
  const revisarAmbito=(root,etiqueta)=>{
    // 1 hidden que no oculta (v1, igual)
    root.querySelectorAll('[hidden]').forEach(el=>{
      const cs=getComputedStyle(el);
      if(cs.display!=='none'&&el.getBoundingClientRect().height>0)
        R.hidden.push(etiqueta+' | '+el.tagName+'#'+(el.id||'')+' .'+String(el.className).slice(0,30)+' | display:'+cs.display+' | "'+short(el.innerText)+'"');
    });

    const nr=nav&&getComputedStyle(nav).display!=='none'?nav.getBoundingClientRect():null;

    // recolectamos elementos hoja con texto una sola vez, se reusan para
    // idioma, tapado, solape y fuera-de-contenedor
    const hojas=[];
    root.querySelectorAll('*').forEach(el=>{
      if(el.children.length)return; // solo hojas: sin hijos elemento
      const txt=(el.innerText||'').replace(/\s+/g,' ').trim();
      if(!txt)return;
      const r=el.getBoundingClientRect();
      if(r.height<=0||r.width<=0)return;
      if(getComputedStyle(el).visibility==='hidden')return;
      hojas.push({el,txt,r});

      // 2 idioma (v1, igual)
      if(txt.length>=12&&!marca.test(txt)){
        const L=clasificar(txt);
        if(L&&L!==lang) R.idioma.push(etiqueta+' | '+L.toUpperCase()+' en pagina '+lang.toUpperCase()+' | '+el.tagName+'#'+(el.id||'')+' | "'+txt.slice(0,80)+'"');
      }
      // 3 tapado (v1, igual)
      if(nr&&txt.length>2&&r.top<nr.bottom&&r.bottom>nr.top&&!nav.contains(el)&&!puedeScroll(el))
        R.tapado.push(etiqueta+' | '+el.tagName+'#'+(el.id||'')+' | "'+txt.slice(0,50)+'" | px bajo el menu: '+Math.round(r.bottom-nr.top));

      // 6 fuera-de-contenedor: texto que se sale por debajo de #app
      // FIX Opus 3sep: la version cruda daba 1.191 avisos, y casi todos eran
      // pestanas con scroll interno propio (upgrade, oraculos, ciclos): el
      // contenido "se sale" de #app pero el usuario llega rodando, no es un
      // bug. Solo cuenta si NO hay forma de alcanzarlo.
      if(appRect&&app.contains(el)&&r.bottom>appRect.bottom+2&&!puedeScroll(el))
        R.fuera.push(etiqueta+' | '+el.tagName+'#'+(el.id||'')+' | "'+short(txt)+'" | se sale '+Math.round(r.bottom-appRect.bottom)+'px por debajo de #app y no hay scroll para llegar');

      // 8b scroll-horizontal por elemento: texto que se sale del viewport
      // CALIBRACION Opus 3sep: la barra de territorios de NUMA (.numa-terrs)
      // tiene overflow-x:auto y SE DESLIZA con el dedo — que "Bienestar" y
      // "Hoy" queden fuera del ancho no es un bug (14 avisos falsos). Solo
      // cuenta si NO hay ningun ancestro que ruede en horizontal.
      // Y las etiquetas de accesibilidad (position:absolute; left:-9999px)
      // estan fuera de pantalla A PROPOSITO, para el lector de pantalla.
      const posEl=getComputedStyle(el).position;
      if(r.right>innerWidth+2&&!puedeScrollX(el))
        R.scrollH.push(etiqueta+' | '+el.tagName+'#'+(el.id||'')+' | "'+short(txt)+'" | rect.right='+Math.round(r.right)+' se sale '+Math.round(r.right-innerWidth)+'px por la derecha (viewport='+innerWidth+')');
      if(r.left<-2&&!puedeScrollX(el)&&!(posEl==='absolute'&&r.right<0))
        R.scrollH.push(etiqueta+' | '+el.tagName+'#'+(el.id||'')+' | "'+short(txt)+'" | rect.left='+Math.round(r.left)+' se sale '+Math.round(-r.left)+'px por la izquierda');
    });

    // 5 solape: dos hojas con texto >=8 chars cuyos rects se cruzan, sin
    // relacion de contencion en el DOM, sin position absolute/fixed (esos se
    // solapan a proposito: chips, badges, etc), y el solape tiene que superar
    // el 15% del area del elemento MAS PEQUEÑO. Nacio de la regresion del
    // 2 sep: el texto de la landing cayendo encima del footer SEO.
    // FIX Opus 3sep — EL DEFECTO GRAVE DE LA v2 CRUDA. El ambito era la
    // pantalla activa, pero la regresion del 2 sep fue texto de la LANDING
    // cayendo dentro del footer SEO, que vive FUERA de #screen-landing: el
    // check nacido para ese bug no lo cazaba. Verificado: con ambito de
    // pantalla, 0 avisos sobre el archivo con la regresion reintroducida;
    // con ambito body, 4 avisos en 570x640 y 1 en 360x740, entre ellos el
    // literal que reporto Andres ("Significado de los Suenos y sus Numeros"
    // encima de "Entretenimiento - Inspiracion personal").
    // 2a correccion Opus: hay que comparar el rectangulo REALMENTE PINTADO,
    // no el rectangulo teorico. Sin esto salian 222 falsos solapes: las
    // pestanas de la app tienen scroll propio (position:absolute;inset:0 +
    // overflow auto), asi que un texto que esta 2.000 px mas abajo DENTRO de
    // la pestana tiene unas coordenadas que coinciden con las de los enlaces
    // del footer SEO — pero el navegador lo recorta y nadie ve un solape.
    // Recortamos cada rect contra el de cada ancestro que recorte (overflow
    // distinto de visible); si queda vacio, el elemento no se esta pintando.
    // OJO: #app tiene overflow VISIBLE, asi que lo que se le sale sigue
    // contando — que es justo la regresion del 2 sep.
    const rectPintado=el=>{
      let r=el.getBoundingClientRect();
      let t=r.top,b=r.bottom,l=r.left,rt=r.right;
      let p=el.parentElement;
      while(p&&p!==document.documentElement){
        const c=getComputedStyle(p);
        if(c.overflowY!=='visible'||c.overflowX!=='visible'){
          const pr=p.getBoundingClientRect();
          if(c.overflowY!=='visible'){t=Math.max(t,pr.top);b=Math.min(b,pr.bottom);}
          if(c.overflowX!=='visible'){l=Math.max(l,pr.left);rt=Math.min(rt,pr.right);}
          if(b-t<=1||rt-l<=1)return null;
        }
        p=p.parentElement;
      }
      return {top:t,bottom:b,left:l,right:rt,width:rt-l,height:b-t};
    };
    const hojasBody=[];
    document.body.querySelectorAll('*').forEach(el=>{
      if(el.children.length)return;
      const t=(el.innerText||'').replace(/\s+/g,' ').trim();
      if(t.length<8)return;
      const c=getComputedStyle(el);
      if(c.visibility==='hidden')return;
      // CALIBRACION Opus 3sep (3a vuelta) — EL ULTIMO FALSO POSITIVO.
      // getBoundingClientRect() de un elemento EN LINEA que parte en dos
      // renglones devuelve la UNION de los dos, no lo que se pinta. Medido en
      // la barra freemium: "Consulta gratuita del dia — Actualiza a Pro para
      // ilimitadas" es UNA frase en dos lineas, y el <span> del final devolvia
      // una caja que se cruzaba con el <strong> del principio. No hay ningun
      // solape: hay un texto que envuelve. Se usan los rectangulos POR LINEA
      // (getClientRects) y se comparan uno a uno.
      const lineas=[...el.getClientRects()];
      const cajas=lineas.length>1?lineas:[el.getBoundingClientRect()];
      const rr=rectPintado(el);
      if(!rr||rr.height<=1||rr.width<=1)return;
      // 3a correccion Opus: los 2 avisos que quedaban eran el titulo "Why Pro
      // is worth it" contra la etiqueta "READINGS" de la bottom-nav. La nav es
      // position:fixed y esta DISENADA para flotar sobre el contenido; el
      // filtro solo miraba la position de la hoja, no la de sus ancestros.
      // Que quede texto debajo del menu fijo ya lo vigila el check 3 (tapado),
      // que ademas sabe si se puede llegar rodando.
      // CALIBRACION Opus 3sep (2a vuelta): no basta con mirar quien esta arriba
      // en la zona de cruce. Un elemento puede estar ENTERO debajo de otro opaco
      // y seguir "cruzandose" en coordenadas. Medido en la pestaña NUMA:
      // .header-logo ("NUMBERS ORACLE") y #wc-ribbon estan en el layout pero
      // elementFromPoint devuelve .numa-avatar y .numa-chat en TODOS sus puntos:
      // el usuario no los ve. Si un elemento no gana en ninguno de 5 puntos de
      // su propio rectangulo, no se esta pintando y no puede solapar nada.
      const seVe=e=>{
        const q=e.getBoundingClientRect();
        const pts=[[.5,.5],[.25,.25],[.75,.25],[.25,.75],[.75,.75]];
        for(const [fx,fy] of pts){
          const x=Math.round(q.left+q.width*fx), y=Math.round(q.top+q.height*fy);
          if(x<0||y<0||x>innerWidth||y>innerHeight)return true; // fuera del viewport: no se puede sondear, se le da el beneficio de la duda
          const t=document.elementFromPoint(x,y);
          if(t&&(t===e||e.contains(t)))return true;
        }
        return false;
      };
      if(!seVe(el))return;
      let anc=el,fija=false;
      while(anc&&anc!==document.body){if(getComputedStyle(anc).position==='fixed'){fija=true;break}anc=anc.parentElement}
      if(fija)return;
      // una entrada por linea pintada, recortada por los ancestros que recortan
      for(const c of cajas){
        const top=Math.max(c.top,rr.top), bot=Math.min(c.bottom,rr.bottom);
        const lef=Math.max(c.left,rr.left), rig=Math.min(c.right,rr.right);
        if(bot-top<=1||rig-lef<=1)continue;
        hojasBody.push({el,txt:t,r:{top,bottom:bot,left:lef,right:rig,width:rig-lef,height:bot-top}});
      }
    });
    const candidatas=hojasBody;
    for(let i=0;i<candidatas.length;i++){
      const a=candidatas[i];
      const pa=getComputedStyle(a.el).position;
      if(pa==='absolute'||pa==='fixed')continue;
      for(let j=i+1;j<candidatas.length;j++){
        const b=candidatas[j];
        if(a.el===b.el)continue; // dos renglones del mismo elemento no se solapan
        if(a.el.contains(b.el)||b.el.contains(a.el))continue; // uno dentro del otro: no cuenta
        const pb=getComputedStyle(b.el).position;
        if(pb==='absolute'||pb==='fixed')continue;
        const ix=Math.min(a.r.right,b.r.right)-Math.max(a.r.left,b.r.left);
        const iy=Math.min(a.r.bottom,b.r.bottom)-Math.max(a.r.top,b.r.top);
        if(ix<=0||iy<=0)continue;
        const areaSolape=ix*iy;
        const areaA=a.r.width*a.r.height, areaB=b.r.width*b.r.height;
        const menor=Math.min(areaA,areaB);
        if(menor<=0)continue;
        const pct=areaSolape/menor*100;
        // CALIBRACION Opus 3sep: dos rectangulos que se cruzan no son un solape
        // VISIBLE si encima de ellos hay pintado un tercer elemento opaco. Medido:
        // en la pestaña NUMA, .header-logo ("NUMBERS ORACLE") y #wc-ribbon estan
        // en el layout y se cruzan con el chat, pero elementFromPoint devuelve
        // .numa-avatar y .numa-chat: estan TAPADOS, nadie los ve. En la regresion
        // real del 2 sep, en cambio, uno de los dos SI era el elemento de arriba,
        // que es justo por lo que Andres lo vio en su pantalla.
        let visible=false;
        if(pct>15){
          const cx=Math.round((Math.max(a.r.left,b.r.left)+Math.min(a.r.right,b.r.right))/2);
          const cy=Math.round((Math.max(a.r.top,b.r.top)+Math.min(a.r.bottom,b.r.bottom))/2);
          if(cx>=0&&cy>=0&&cx<=innerWidth&&cy<=innerHeight){
            const arriba=document.elementFromPoint(cx,cy);
            visible=!!arriba&&(arriba===a.el||arriba===b.el||a.el.contains(arriba)||b.el.contains(arriba));
          }else{
            visible=true; // fuera del viewport no se puede sondear: se reporta y que lo juzgue quien lea
          }
        }
        if(pct>15&&visible){
          R.solape.push(etiqueta+' | '+a.el.tagName+'#'+(a.el.id||'')+'.'+String(a.el.className).slice(0,20)+' "'+short(a.txt)+'" SOLAPA '+b.el.tagName+'#'+(b.el.id||'')+'.'+String(b.el.className).slice(0,20)+' "'+short(b.txt)+'" | area solape:'+Math.round(areaSolape)+'px2 = '+pct.toFixed(1)+'% del menor ('+Math.round(menor)+'px2)');
        }
      }
    }

    // 7 hueco: entre hermanos consecutivos visibles con contenido, hueco
    // vertical > 80px. Se recorre TODO el arbol del ambito, no solo un nivel.
    const recorrerHuecos=cont=>{
      const hijosVisibles=[];
      for(const el of cont.children){
        const cs=getComputedStyle(el);
        if(cs.display==='none'||cs.visibility==='hidden')continue;
        const r=el.getBoundingClientRect();
        const tieneContenido=(el.innerText||'').trim().length>0 || el.children.length>0;
        if(r.height<=0||!tieneContenido)continue;
        hijosVisibles.push({el,r});
      }
      for(let i=1;i<hijosVisibles.length;i++){
        const prev=hijosVisibles[i-1], cur=hijosVisibles[i];
        const gap=cur.r.top-prev.r.bottom;
        if(gap>80)
          R.hueco.push(etiqueta+' | entre '+prev.el.tagName+'#'+(prev.el.id||'')+'.'+String(prev.el.className).slice(0,20)+' y '+cur.el.tagName+'#'+(cur.el.id||'')+'.'+String(cur.el.className).slice(0,20)+' | hueco:'+Math.round(gap)+'px');
      }
      for(const el of cont.children) recorrerHuecos(el);
    };
    try{recorrerHuecos(root);}catch(e){}

    // 9 inalcanzable: interactivos visibles en el DOM pero con el rect
    // ENTERO fuera del viewport y sin ancestro con scroll (X o Y) que llegue.
    // Este es el bug de la 7a pregunta del 1 sep: existia en el DOM, se podia
    // hacer click "a ciegas" por id, pero un humano jamas lo veia ni llegaba.
    root.querySelectorAll('button,a,.numa-chip,.nav-btn,input,select').forEach(el=>{
      const cs=getComputedStyle(el);
      if(cs.display==='none'||cs.visibility==='hidden')return;
      const r=el.getBoundingClientRect();
      if(r.width<=0&&r.height<=0)return; // ni siquiera tiene caja, no es "visible en el DOM" en sentido util
      const fueraV=r.bottom<=0||r.top>=innerHeight;
      const fueraH=r.right<=0||r.left>=innerWidth;
      if(!(fueraV||fueraH))return;
      if(puedeScroll(el)||puedeScrollX(el))return;
      R.inalcanzable.push(etiqueta+' | '+el.tagName+'#'+(el.id||'')+' .'+String(el.className).slice(0,30)+' | "'+short(el.innerText||el.value||'')+'" | rect top:'+Math.round(r.top)+' left:'+Math.round(r.left)+' bottom:'+Math.round(r.bottom)+' right:'+Math.round(r.right)+' (viewport '+innerWidth+'x'+innerHeight+')');
    });
  };

  for(const {root,etiqueta} of ambitos) revisarAmbito(root,etiqueta);

  // El solape se mide sobre body, asi que en la pantalla de la app (9 pestanas)
  // el mismo par de elementos del marco fijo saldria 9 veces. Deduplicamos por
  // el par, quedandonos con la primera pestana donde aparecio.
  {const vistos=new Set(),lim=[];
   for(const l of R.solape){const par=l.slice(l.indexOf(' | ')+3);if(vistos.has(par))continue;vistos.add(par);lim.push(l);}
   R.solape=lim;}

  // 8a scroll-horizontal a nivel documento (una sola vez por caso, no por
  // ambito, porque scrollWidth es global a la pagina)
  if(document.documentElement.scrollWidth>innerWidth+2)
    R.scrollH.unshift('DOCUMENTO | scrollWidth:'+document.documentElement.scrollWidth+' > innerWidth:'+innerWidth+' | se sale '+(document.documentElement.scrollWidth-innerWidth)+'px');

  return R;
};

/* -----------------------------------------------------------------------------
   montarContexto(page, ctx) deja la pagina en el estado pedido (pantalla +
   perfil) y devuelve la lista de "ambitos" a barrer con probe(): en landing y
   login es un unico ambito (la pantalla activa entera, no hay pestañas); en
   app-invitado/app-sesion es una lista de ambitos, uno por pestaña, y cada
   uno se etiqueta con el nombre de la pestaña para que los hallazgos digan de
   donde salieron.
   ----------------------------------------------------------------------------- */
const montarContexto=(ctx,tabs)=>{
  const conSesion=ctx==='landing-sesion'||ctx==='app-sesion';
  try{ STATE.profile = conSesion ? {full_name:'Andres Ramos',birth_date:'1975-03-20',birth_city:'Bogota',city:'Bogota'} : null; }catch(e){}
  if(conSesion){
    try{updateUI()}catch(e){}
    try{updateFreemiumBar()}catch(e){}
    try{accLockProfile()}catch(e){}
  }
  if(ctx==='landing-invitado'||ctx==='landing-sesion'){
    try{goTo('screen-landing')}catch(e){}
    if(ctx==='landing-sesion'){ try{showLandingLoggedIn()}catch(e){} }
    return ['(landing)'];
  }
  if(ctx==='login'){ try{goTo('screen-auth')}catch(e){} return ['(login)']; }
  try{goTo('screen-main')}catch(e){}
  return tabs.slice();
};

/* -----------------------------------------------------------------------------
   CORRECCION DE FONDO (Opus, 3 sep) — POR QUE LA v2 DABA 0 EN TODO.
   La v2 llamaba a showTab() para las 9 pestañas DE UNA VEZ, guardaba los 9
   elementos raiz, y solo despues media. Pero showTab oculta las demas con la
   clase .hidden: a la hora de medir, la unica pestaña visible era la ULTIMA
   (upgrade). Las otras ocho tenian todos sus elementos con alto 0 y el barrido
   las descartaba entera. Ocho de las nueve pestañas NUNCA se auditaron, en
   ninguno de los 75 casos: el "0 avisos" no significaba que no hubiera nada,
   significaba que no se estaba mirando.
   Encima se media a mitad de la animacion de entrada (.screen lleva
   "animation:fadeUp .4s both", y hay elementos con "fadeUp .6s .4s both"):
   medido, la pantalla estaba con opacity:0 y desplazada 12px cuando se leian
   los rectangulos.
   Arreglo: se activa UNA pestaña, se dan por terminadas todas las animaciones
   con document.getAnimations().finish(), y solo entonces se mide esa pestaña.
   ----------------------------------------------------------------------------- */
const activarAmbito=(nombre)=>{
  if(nombre==='(landing)'||nombre==='(login)'){
    // ya montada por montarContexto
  }else{
    try{showTab(nombre)}catch(e){}
    try{if(nombre==='numa'&&typeof numaOpen==='function')numaOpen()}catch(e){}
  }
  // dar por terminadas las animaciones de entrada (las infinitas no se pueden
  // terminar: se ignoran)
  try{document.getAnimations().forEach(a=>{try{a.finish()}catch(e){}})}catch(e){}
  const id = nombre==='(landing)'?'screen-landing' : nombre==='(login)'?'screen-auth' : 'tab-'+nombre;
  const el=document.getElementById(id);
  if(!el) return {ok:false,motivo:'no existe #'+id};
  if(el.classList.contains('hidden')) return {ok:false,motivo:'#'+id+' sigue con clase .hidden tras activarlo'};
  if(getComputedStyle(el).display==='none') return {ok:false,motivo:'#'+id+' tiene display:none'};
  window.__root=el;
  return {ok:true};
};

(async()=>{
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
const todo={};
const fallos=[]; // contextos/pestañas que no se pudieron montar, para el informe final
const TOTAL={hidden:0,idioma:0,tapado:0,errJS:0,solape:0,fuera:0,hueco:0,scrollH:0,inalcanzable:0};

for(const c of CASOS){
 for(const [w,h,tn] of TAMANOS){
  for(const ctx of CONTEXTOS){
   const clave=c.file+' · '+c.lang+' · '+tn+' · '+ctx;
   let p;
   try{
    p=await b.newPage({viewport:{width:w,height:h}});
    const errores=[];
    p.on('pageerror',e=>errores.push(String(e).split('\n')[0].slice(0,110)));
    await p.addInitScript(stub);
    await p.addInitScript(l=>{try{localStorage.setItem('no_lang',l)}catch(e){}},c.lang);
    await p.route('**',r=>{const u=r.request().url();if(u.startsWith('file://'))r.continue();else r.abort();});
    await p.goto('file:///tmp/audit/'+c.file,{waitUntil:'domcontentloaded'});
    await p.waitForTimeout(1400);

    await p.addScriptTag({content:"window.__montarContexto="+montarContexto.toString()+";window.__activarAmbito="+activarAmbito.toString()+";window.__probe="+probe.toString()});

    const R={hidden:[],idioma:[],tapado:[],solape:[],fuera:[],hueco:[],scrollH:[],inalcanzable:[]};
    try{
      const ambitos=await p.evaluate(([ctx,tabs])=>window.__montarContexto(ctx,tabs),[ctx,TABS]);
      await p.waitForTimeout(250);
      for(const nombre of ambitos){
        const est=await p.evaluate(n=>window.__activarAmbito(n),nombre);
        if(!est.ok){ fallos.push(clave+' | ambito "'+nombre+'" no se pudo activar: '+est.motivo); continue; }
        await p.waitForTimeout(180); // que asiente el layout tras finish() de las animaciones
        const parcial=await p.evaluate(([n,lang,ctx])=>window.__probe([{root:window.__root,etiqueta:n}],lang,ctx),[nombre,c.lang,ctx]);
        for(const k of ['hidden','idioma','tapado','solape','fuera','hueco','scrollH','inalcanzable'])
          R[k].push(...(parcial[k]||[]));
      }
      // dedup del solape (se mide sobre body en cada ambito: el marco fijo se repetiria)
      {const vistos=new Set(),lim=[];
       for(const l of R.solape){const par=l.slice(l.indexOf(' | ')+3);if(vistos.has(par))continue;vistos.add(par);lim.push(l);}
       R.solape=lim;}
    }catch(evalErr){
      fallos.push(clave+' | fallo evaluate(): '+String(evalErr).split('\n')[0].slice(0,160));
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
}

require('fs').writeFileSync('/tmp/audit/resultado_v2.json',JSON.stringify({todo,fallos,TOTAL},null,1));

console.log('\n===== TOTALES (75 casos) =====');
for(const k in TOTAL) console.log(k+': '+TOTAL[k]);
if(fallos.length){
  console.log('\n===== CASOS/CONTEXTOS QUE FALLARON ('+fallos.length+') =====');
  fallos.forEach(f=>console.log('- '+f));
} else {
  console.log('\nNingun caso fallo por excepcion del propio script.');
}

await b.close();
})();

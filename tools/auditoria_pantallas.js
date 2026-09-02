/* ─────────────────────────────────────────────────────────────────────────────
   AUDITORIA DE PANTALLAS — Numbers Oracle
   Creado el 2 sep 2026 tras el caso de la septima pregunta invisible y la
   mezcla de idiomas. OBJETIVO: que los bugs de pantalla los encuentre un
   script ANTES de publicar, y no Andres despues de pagar el trabajo.

   Que revisa, en index.html (ES y EN) y zh.html (ZH), x 5 tamanos de pantalla:
     1. Elementos con el atributo [hidden] que SIGUEN VISIBLES porque una regla
        CSS de autor les da display propio  (la trampa del 1 y del 2 de sep).
     2. Texto en un idioma distinto al de la pagina.
     3. Contenido tapado por la bottom-nav fija y SIN scroll para alcanzarlo.
     4. Errores de JavaScript en carga.
   Salida: resultado.json + un resumen por caso.

   COMO SE CORRE: lo ejecuta Claude en su entorno (necesita playwright-core y
   Chromium). No hace falta instalarlo en el PC de Andres.
   REGLA: no se publica nada si este script no sale en cero.
   ───────────────────────────────────────────────────────────────────────────── */
const {chromium}=require('/tmp/node_modules/playwright-core');
const stub=()=>{const mk=()=>new Proxy(function(){},{get:()=>mk(),apply:()=>mk(),construct:()=>mk()});window.supabase=mk();window.OneSignal=mk();window.posthog=mk();};

const CASOS=[
 {file:'index.html',lang:'es'},
 {file:'index.html',lang:'en'},
 {file:'zh.html',lang:'zh'},
];
const TAMANOS=[[390,844,'iPhone'],[412,915,'Android'],[360,740,'movil-chico'],[570,640,'PC-chica'],[1280,900,'PC-grande']];
const TABS=['hoy','form','result','fuerzas','profile','upgrade','numa','oraculos','ciclos'];

const probe=(tabs,lang)=>{
  const R={hidden:[],idioma:[],tapado:[],vacio:[]};
  const ES=/[¿¡ñáéíóú]|\b(que|para|con|tus|los|las|una|por|del|más|cómo|qué|día|números|energía|tu)\b/i;
  const EN=/\b(the|your|you|and|with|for|this|that|today|question|numbers|day|energy|what|how|my|is|are)\b/i;
  const CJK=/[一-鿿]/;
  const marca=/^(NUMA|Numbers Oracle|KAI|MEI|Drago|数字神谕)/i;
  const clasificar=s=>{ if(CJK.test(s))return 'zh'; const es=ES.test(s), en=EN.test(s);
    if(es&&!en)return 'es'; if(en&&!es)return 'en'; return null; };
  try{document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
      const m=document.getElementById('screen-main'); if(m)m.classList.add('active');}catch(e){}
  const nav=document.querySelector('.bottom-nav');
  for(const t of tabs){
    const tab=document.getElementById('tab-'+t); if(!tab)continue;
    try{showTab(t)}catch(e){}
    try{if(t==='numa'&&typeof numaOpen==='function')numaOpen()}catch(e){}
    if(getComputedStyle(tab).display==='none')continue;
    // 1 hidden que no oculta
    tab.querySelectorAll('[hidden]').forEach(el=>{
      const cs=getComputedStyle(el);
      if(cs.display!=='none'&&el.getBoundingClientRect().height>0)
        R.hidden.push(t+' | '+el.tagName+'#'+(el.id||'')+' .'+String(el.className).slice(0,30)+' | display:'+cs.display+' | "'+(el.innerText||'').replace(/\s+/g,' ').slice(0,60)+'"');
    });
    // 2 idioma + 3 tapado
    const nr=nav&&getComputedStyle(nav).display!=='none'?nav.getBoundingClientRect():null;
    const puedeScroll=el=>{let p=el;while(p&&p!==document.body){const o=getComputedStyle(p).overflowY;if((o==='auto'||o==='scroll')&&p.scrollHeight>p.clientHeight+2)return true;p=p.parentElement}return false};
    tab.querySelectorAll('*').forEach(el=>{
      if(el.children.length)return;
      const txt=(el.innerText||'').replace(/\s+/g,' ').trim();
      const r=el.getBoundingClientRect();
      if(r.height<=0||r.width<=0)return;
      if(getComputedStyle(el).visibility==='hidden')return;
      if(txt.length>=12&&!marca.test(txt)){
        const L=clasificar(txt);
        if(L&&L!==lang) R.idioma.push(t+' | '+L.toUpperCase()+' en pagina '+lang.toUpperCase()+' | '+el.tagName+'#'+(el.id||'')+' | "'+txt.slice(0,80)+'"');
      }
      if(nr&&txt.length>2&&r.top<nr.bottom&&r.bottom>nr.top&&!nav.contains(el)&&!puedeScroll(el))
        R.tapado.push(t+' | '+el.tagName+'#'+(el.id||'')+' | "'+txt.slice(0,50)+'" | px bajo el menu: '+Math.round(r.bottom-nr.top));
    });
  }
  return R;
};

(async()=>{
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
const todo={};
for(const c of CASOS){
 for(const [w,h,tn] of TAMANOS){
  const p=await b.newPage({viewport:{width:w,height:h}});
  const errores=[];
  p.on('pageerror',e=>errores.push(String(e).split('\n')[0].slice(0,110)));
  await p.addInitScript(stub);
  await p.addInitScript(l=>{try{localStorage.setItem('no_lang',l)}catch(e){}},c.lang);
  await p.route('**',r=>{const u=r.request().url();if(u.startsWith('file://'))r.continue();else r.abort();});
  await p.goto('file:///tmp/audit/'+c.file,{waitUntil:'domcontentloaded'});
  await p.waitForTimeout(1400);
  await p.addScriptTag({content:"window.__probe="+probe.toString()});let R;
  R=await p.evaluate(([tabs,lang])=>window.__probe(tabs,lang),[TABS,c.lang]);
  R.errores=[...new Set(errores)];
  todo[c.file+' · '+c.lang+' · '+tn]=R;
  await p.close();
 }
}
require('fs').writeFileSync('/tmp/audit/resultado.json',JSON.stringify(todo,null,1));
for(const k in todo){const r=todo[k];
 console.log('### '+k+'  hidden:'+r.hidden.length+'  idioma:'+r.idioma.length+'  tapado:'+r.tapado.length+'  errJS:'+r.errores.length);}
await b.close();})();

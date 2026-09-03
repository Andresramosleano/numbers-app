/* -----------------------------------------------------------------------------
   COMPARAR ESTILOS CALCULADOS — Numbers Oracle
   Existe por la tanda 1b: sacar 614 reglas de CSS a un archivo compartido cambia
   el ORDEN de la cascada (una regla compartida que antes iba DESPUES de una
   exclusiva, ahora va antes). Con la misma especificidad, gana la ultima: el
   cambio puede alterar la pantalla sin que nadie lo vea y sin un solo error.

   Este script no opina: lee getComputedStyle de TODOS los elementos, en todos
   los contextos y tamanos, y lo vuelca a JSON. Se corre ANTES y DESPUES del
   cambio y se comparan los dos volcados. Cero diferencias = la cascada no se
   movio.

   COMO SE CORRE:  cd /tmp/audit && node comparar_estilos.js <salida.json>
   ----------------------------------------------------------------------------- */
const {chromium}=require('/tmp/node_modules/playwright-core');
const fs=require('fs');

const SALIDA=process.argv[2]||'estilos.json';
const stub=()=>{const mk=()=>new Proxy(function(){},{get:()=>mk(),apply:()=>mk(),construct:()=>mk()});window.supabase=mk();window.OneSignal=mk();window.posthog=mk();};

const CASOS=[{file:'index.html',lang:'es'},{file:'index.html',lang:'en'},{file:'zh.html',lang:'zh'}];
const TAMANOS=[[390,844,'iPhone'],[360,740,'movil-chico'],[570,640,'PC-chica'],[1280,900,'PC-grande']];
const TABS=['hoy','numa','oraculos','profile','form','result','ciclos','fuerzas','upgrade'];
const CONTEXTOS=['landing-invitado','login','app-invitado','app-sesion'];

// 34 propiedades: las que mueven la pantalla. No se leen las 340 de golpe
// porque el volcado se vuelve inmanejable y la mayoria no cambia nunca.
const PROPS=['display','position','top','right','bottom','left','width','height','min-height','max-height',
 'min-width','max-width','margin-top','margin-right','margin-bottom','margin-left','padding-top','padding-right',
 'padding-bottom','padding-left','flex-direction','flex-grow','flex-shrink','flex-basis','align-items',
 'justify-content','gap','overflow-x','overflow-y','z-index','font-size','font-weight','font-family','line-height',
 'color','background-color','text-align','opacity','transform','visibility','border-top-width','border-bottom-width'];

const volcar=(props)=>{
  // clave estable por elemento: cadena de nth-child desde <html>. El DOM no
  // cambia en esta tanda (solo se mueve CSS), asi que la clave es comparable.
  const clave=(el)=>{const p=[];let n=el;
    while(n&&n.parentElement){p.unshift([...n.parentElement.children].indexOf(n));n=n.parentElement;}
    return p.join('.')+'|'+el.tagName+(el.id?'#'+el.id:'');};
  const out={};
  for(const el of document.querySelectorAll('*')){
    if(el.tagName==='SCRIPT'||el.tagName==='STYLE'||el.tagName==='LINK'||el.tagName==='META')continue;
    const cs=getComputedStyle(el); const v=[];
    for(const p of props) v.push(cs.getPropertyValue(p));
    out[clave(el)]=v.join('~');
  }
  return out;
};

(async()=>{
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
const todo={}; let n=0;
for(const c of CASOS){
 for(const [w,h,tn] of TAMANOS){
  for(const ctx of CONTEXTOS){
   const clave=c.file+'|'+c.lang+'|'+tn+'|'+ctx;
   const p=await b.newPage({viewport:{width:w,height:h}});
   await p.addInitScript(stub);
   await p.addInitScript(()=>{ // Math.random determinista (LCG). Sin esto, NUMA
     let s=123456789;          // elige textos distintos y las burbujas miden distinto.
     Math.random=()=>{s=(1103515245*s+12345)%2147483648;return s/2147483648;};
   });
   await p.addInitScript(l=>{try{localStorage.setItem('no_lang',l)}catch(e){}},c.lang);
   await p.route('**',r=>{const u=r.request().url();if(u.startsWith('file://'))r.continue();else r.abort();});
   await p.goto('file:///tmp/audit/'+c.file,{waitUntil:'domcontentloaded'});
   await p.waitForTimeout(1200);
   // apagar animaciones y transiciones: las infinitas no se pueden "terminar" y
   // dejaban opacity/transform en un punto al azar en cada corrida.
   await p.addStyleTag({content:'*,*::before,*::after{animation:none!important;transition:none!important}'});
   try{
     await p.evaluate(([ctx,tabs])=>{
       const conSesion=ctx==='app-sesion';
       try{STATE.profile=conSesion?{full_name:'Andres Ramos',birth_date:'1975-03-20',birth_city:'Bogota',city:'Bogota'}:null}catch(e){}
       if(conSesion){try{updateUI()}catch(e){}try{updateFreemiumBar()}catch(e){}try{accLockProfile()}catch(e){}}
       if(ctx==='landing-invitado'){try{goTo('screen-landing')}catch(e){}return;}
       if(ctx==='login'){try{goTo('screen-auth')}catch(e){}return;}
       try{goTo('screen-main')}catch(e){}
     },[ctx,TABS]);
     // en la app se recorre pestana a pestana: una sola visible cada vez
     const ambitos = (ctx==='app-invitado'||ctx==='app-sesion') ? TABS : ['(pantalla)'];
     for(const t of ambitos){
       if(t!=='(pantalla)'){ await p.evaluate(n=>{try{showTab(n)}catch(e){}
         try{if(n==='numa'&&typeof numaOpen==='function')numaOpen()}catch(e){}},t); }
       await p.evaluate(()=>{try{document.getAnimations().forEach(a=>{try{a.finish()}catch(e){}})}catch(e){}});
       await p.waitForTimeout(120);
       todo[clave+'|'+t]=await p.evaluate(volcar,PROPS).catch(()=>({}));
     }
   }catch(e){ todo[clave]={__error:String(e).slice(0,160)}; }
   await p.close(); n++;
  }
 }
}
await b.close();
fs.writeFileSync(SALIDA,JSON.stringify(todo));
const elems=Object.values(todo).reduce((a,o)=>a+Object.keys(o).length,0);
console.log('volcados '+Object.keys(todo).length+' ambitos ('+n+' casos), '+elems+' elementos medidos -> '+SALIDA);
})();

/* -----------------------------------------------------------------------------
   INVENTARIO DE FUNCIONES VIVAS — Numbers Oracle
   Existe por la tanda 1c: sacar funciones del <script> inline a un archivo
   compartido puede dejar una funcion sin definir, o definirla DESPUES de que
   alguien la llame. El sintoma no es un pixel movido: es que la app no arranca,
   o que un boton deja de hacer nada.

   Vuelca, para cada idioma: que funciones existen en window, cuales son
   callable, los errores de JS de la carga, y el resultado de un recorrido
   funcional (montar perfil, pasar por las 9 pestanas, abrir NUMA y pulsar sus
   chips). Se corre ANTES y DESPUES y se comparan los dos volcados.

   COMO SE CORRE: cd /tmp/audit && node inventario_funciones.js <salida.json>
   ----------------------------------------------------------------------------- */
const {chromium}=require('/tmp/node_modules/playwright-core');
const fs=require('fs');
const SALIDA=process.argv[2]||'funciones.json';
const stub=()=>{const mk=()=>new Proxy(function(){},{get:()=>mk(),apply:()=>mk(),construct:()=>mk()});window.supabase=mk();window.OneSignal=mk();window.posthog=mk();};
const CASOS=[{file:'index.html',lang:'es'},{file:'index.html',lang:'en'},{file:'zh.html',lang:'zh'}];
const TABS=['hoy','numa','oraculos','profile','form','result','ciclos','fuerzas','upgrade'];

(async()=>{
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
const todo={};
for(const c of CASOS){
  const errores=[];
  const p=await b.newPage({viewport:{width:390,height:844}});
  p.on('pageerror',e=>errores.push(String(e).split('\n')[0].slice(0,160)));
  await p.addInitScript(stub);
  await p.addInitScript(l=>{try{localStorage.setItem('no_lang',l)}catch(e){}},c.lang);
  await p.route('**',r=>{const u=r.request().url();if(u.startsWith('file://'))r.continue();else r.abort();});
  await p.goto('file:///tmp/audit/'+c.file,{waitUntil:'domcontentloaded'});
  await p.waitForTimeout(1500);

  // 1) que hay en window: nombre -> 'fn' | 'otro'. Solo lo declarado por la
  //    pagina, no lo del navegador (se compara contra un about:blank limpio).
  const propias=await p.evaluate(async()=>{
    const base=new Set(Object.getOwnPropertyNames(window));
    return null; // placeholder, se rellena abajo
  }).catch(()=>null);

  const inventario=await p.evaluate(()=>{
    const out={};
    for(const k of Object.getOwnPropertyNames(window)){
      let v; try{v=window[k]}catch(e){continue}
      if(typeof v==='function' && !/\{\s*\[native code\]\s*\}/.test(Function.prototype.toString.call(v)))
        out[k]='fn:'+(v.length); // nombre -> aridad, para notar si cambia la firma
    }
    return out;
  });

  // 2) recorrido funcional: si algo se rompio al mover codigo, aqui explota
  const recorrido=await p.evaluate(async(TABS)=>{
    const r={pasos:[],fallos:[]};
    const paso=(n,f)=>{try{f();r.pasos.push(n+':ok')}catch(e){r.pasos.push(n+':FALLO');r.fallos.push(n+' -> '+String(e).slice(0,120))}};
    paso('perfil',()=>{STATE.profile={full_name:'Andres Ramos',birth_date:'1975-03-20',birth_city:'Bogota',city:'Bogota'}});
    paso('updateUI',()=>updateUI());
    paso('updateFreemiumBar',()=>updateFreemiumBar());
    paso('goTo(screen-main)',()=>goTo('screen-main'));
    for(const t of TABS) paso('showTab('+t+')',()=>showTab(t));
    paso('numaOpen',()=>{showTab('numa');numaOpen()});
    // pulsar las chips de NUMA y comprobar que salen burbujas
    try{
      const chips=[...document.querySelectorAll('#tab-numa .numa-chip, #tab-numa [data-q], .numa-chip')].slice(0,7);
      r.chips=chips.length;
      let antes=document.querySelectorAll('#tab-numa .numa-bubble, #tab-numa .bubble').length;
      for(const ch of chips){ try{ch.click()}catch(e){} }
      await new Promise(s=>setTimeout(s,400));
      r.burbujas=document.querySelectorAll('#tab-numa .numa-bubble, #tab-numa .bubble').length;
      r.burbujasAntes=antes;
    }catch(e){ r.fallos.push('chips -> '+String(e).slice(0,120)); }
    paso('goTo(screen-landing)',()=>goTo('screen-landing'));
    paso('goTo(screen-auth)',()=>goTo('screen-auth'));
    return r;
  },TABS);

  todo[c.file+'|'+c.lang]={funciones:inventario, nFunciones:Object.keys(inventario).length,
                            erroresJS:[...new Set(errores)], recorrido};
  await p.close();
}
await b.close();
fs.writeFileSync(SALIDA,JSON.stringify(todo,null,1));
for(const [k,v] of Object.entries(todo))
  console.log(k+'  funciones:'+v.nFunciones+'  erroresJS:'+v.erroresJS.length+
              '  pasosFallidos:'+v.recorrido.pasos.filter(x=>x.endsWith('FALLO')).length+
              '  chips:'+v.recorrido.chips+'  burbujas:'+v.recorrido.burbujas);
})();

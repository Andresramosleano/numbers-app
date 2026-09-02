const {chromium}=require('/tmp/node_modules/playwright-core');
const stub=()=>{const mk=()=>new Proxy(function(){},{get:()=>mk(),apply:()=>mk(),construct:()=>mk()});window.supabase=mk();window.OneSignal=mk();window.posthog=mk();};
(async()=>{const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
const p=await b.newPage({viewport:{width:570,height:800}});
await p.addInitScript(stub);
await p.addInitScript(()=>{try{localStorage.setItem('no_lang','es')}catch(e){}});
await p.route('**',r=>{const u=r.request().url();if(u.startsWith('file://'))r.continue();else r.abort();});
await p.goto('file:///tmp/audit/index.html',{waitUntil:'domcontentloaded'});
await p.waitForTimeout(1400);
const r=await p.evaluate(()=>{
 const out={};
 document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
 document.getElementById('screen-main').classList.add('active');
 // perfil minimo para que numaAsk responda
 try{STATE.profile={full_name:'Andres Ramos',birth_date:'1975-03-20',birth_city:'Bogota',city:'Bogota'};}catch(e){out.perfil=String(e).slice(0,60)}
 showTab('numa'); numaOpen();
 try{numaAsk('vida-1')}catch(e){out.ask=String(e).slice(0,80)}
 out.chat_es=(document.getElementById('numa-chat').innerText||'').replace(/\s+/g,' ').slice(0,200);
 // ahora cambio a ingles como haria el usuario
 try{setLang('en')}catch(e){out.setLang=String(e).slice(0,80)}
 out.chat_tras_cambio=(document.getElementById('numa-chat').innerText||'').replace(/\s+/g,' ').slice(0,260);
 const terrs=document.querySelector('.numa-terrs');
 out.terrs_visible_en_EN = terrs? getComputedStyle(terrs).display!=='none' : null;
 out.terrs_texto = terrs? terrs.innerText.replace(/\n/g,' | ') : '';
 out.chips = document.querySelector('.numa-chips').innerText.replace(/\n/g,' | ').slice(0,150);
 out.titulo = (document.querySelector('.numa-screen-sub')||{}).innerText||'';
 return out;});
console.log(JSON.stringify(r,null,1));
await p.screenshot({path:'/tmp/audit/mezcla_idiomas.png'});
await b.close();})();

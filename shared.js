/* shared.js — funciones IDENTICAS entre index.html y zh.html.
   Generado por tools/extraer_js_compartido.py (tanda 1c-1 del paso 1).
   NO editar a mano: se edita aqui y se regenera.
   Se carga ANTES del script inline de cada pagina; aqui solo hay
   declaraciones de funcion, no se ejecuta nada al cargar. */
function withTimeout(promise,ms,fallback){
  return Promise.race([
    Promise.resolve(promise).catch(e=>{console.warn('Supabase call failed:',e);return fallback}),
    new Promise(resolve=>setTimeout(()=>{console.warn('Supabase call timed out after',ms,'ms');resolve(fallback)},ms))
  ]);
}
function numReduce(n){if(n===11||n===22||n===33)return n;while(n>9){n=String(n).split('').reduce((a,b)=>a+parseInt(b),0);if(n===11||n===22||n===33)return n}return n}
function nameNum(name){const m={a:1,b:2,c:3,d:4,e:5,f:6,g:7,h:8,i:9,j:1,k:2,l:3,m:4,n:5,o:6,p:7,q:8,r:9,s:1,t:2,u:3,v:4,w:5,x:6,y:7,z:8};return numReduce(name.normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/[^a-z]/g,'').split('').reduce((a,c)=>a+(m[c]||0),0))}
function birthNum(d){return numReduce(d.replace(/-/g,'').split('').reduce((a,b)=>a+parseInt(b),0))}
function lifePath(n,b){return numReduce(birthNum(b))}
function getZodiac(d){const p=d.split('-'),m=+p[1],day=+p[2];for(const z of ZODIAC){if((m===z.dates[0][0]&&day>=z.dates[0][1])||(m===z.dates[1][0]&&day<=z.dates[1][1]))return z}return ZODIAC[0]}
function getChinese(y){return CHINESE[(y-1900)%12]}
function getChineseFromDate(dateStr){const p=String(dateStr).split('-'),y=+p[0],m=+p[1],day=+p[2],cny=CNY_DATES[y];let effY=y;if(cny){const cp=cny.split('-'),cm=+cp[0],cd=+cp[1];if(m<cm||(m===cm&&day<cd))effY=y-1}return CHINESE[((effY-1900)%12+12)%12]}
function getMoon(d){const k=new Date('2000-01-06'),dt=new Date(d),p=(((dt-k)/(1000*60*60*24))%29.5306+29.5306)%29.5306,day=Math.round(p);let name,mult;if(p<1.85){name='Nueva';mult=.8}else if(p<7.38){name='Creciente';mult=1.0}else if(p<11.08){name='Cuarto creciente';mult=1.2}else if(p<14.77){name='Gibosa creciente';mult=1.3}else if(p<18.46){name='Llena';mult=1.5}else if(p<22.15){name='Gibosa menguante';mult=1.3}else if(p<25.85){name='Cuarto menguante';mult=1.1}else{name='Menguante';mult=.9}return{name,day,mult}}
function cityEnergy(c){let h=0;for(let i=0;i<c.length;i++)h=((h<<5)-h+c.charCodeAt(i))|0;return numReduce(Math.abs(h%90)+1)}
function geoFromCoords(lat,lon){const h=Math.round(Math.abs(lat*1000))+Math.round(Math.abs(lon*1000));return numReduce(h%90+1)}
function loadCityData(){if(CITY_DATA)return Promise.resolve(CITY_DATA);if(CITY_DATA_LOADING)return CITY_DATA_LOADING;CITY_DATA_LOADING=fetch('cities.json').then(r=>r.json()).then(d=>{CITY_DATA=d;return d}).catch(()=>null);return CITY_DATA_LOADING}
function normCity(s){return(s||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().trim()}
function cityGeoVal(field,text){const g=CITY_GEO[field];if(g)return geoFromCoords(g.lat,g.lon);return cityEnergy(text||'')}
function citySuggestHide(field){const box=document.getElementById('citysug-'+field);if(box)box.classList.remove('show')}
function seededRand(s){let x=s>>>0;return()=>{x^=x<<13;x^=x>>17;x^=x<<5;return(x>>>0)/0xFFFFFFFF}}
function sportsSeasonStr(sport,d){
  const y=d.getFullYear();
  if(sport==='football'){const m=d.getMonth()+1;return m>=7?(y+'-'+(y+1)):((y-1)+'-'+y);}
  if(sport==='americanfootball')return String(d.getMonth()+1<=2?y-1:y);
  return String(y); // basketball (NBA) y baseball (MLB): temporada = año en curso
}
function wcLang(){try{if(typeof uiLang==='function')return uiLang()}catch(e){}return(typeof STATE!=='undefined'&&STATE.lang==='zh')?'zh':'es'}
function wcLi(){const l=wcLang();return l==='en'?1:l==='zh'?2:0}
function wcFmtDate(d){const l=wcLang();const p=d.split('-');const m=+p[1],day=+p[2];if(l==='zh')return m+'月'+day+'日';const mes=l==='en'?['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']:['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];return l==='en'?(mes[m-1]+' '+day):(day+' '+mes[m-1])}
function wcRed9(n){n=numReduce(n);if(n>9)n=(n%9)||9;return n}
function getDayRuler(d){return DAY_RULERS[new Date(d+'T12:00:00').getDay()]}
function openMotorPanel(key){
  const lr=STATE.lastResult;if(!lr)return;
  const r=lr.result||lr.duel;if(!r||!r.engines)return;
  const panel=document.getElementById('motor-panel');if(!panel)return;
  if(panel.dataset.key===key&&!panel.classList.contains('hidden')){panel.classList.add('hidden');panel.dataset.key='';return;}
  const L=wcLang();const M=MOTOR_I18N[L];
  const free=key==='num'||key==='moon';
  if(!free&&!isPro()){
    panel.innerHTML='<div class="mp-title">'+M[key].t+'</div><div class="mp-locked">'+M.lock+'</div><button class="btn-pct" style="margin-top:.85rem" onclick="showTab(\'upgrade\')">'+M.lockBtn+'</button>';
    panel.dataset.key=key;panel.classList.remove('hidden');panel.scrollIntoView({behavior:'smooth',block:'center'});return;
  }
  const today=new Date().toISOString().split('T')[0];
  const tn=numReduce(today.replace(/-/g,'').split('').reduce((a,b)=>a+parseInt(b),0));
  const ev=key==='moon'?r.moon.day:r.engines[key];
  let dn=numReduce((key==='moon'?numReduce(r.moon.day):ev)+tn);
  if(dn>9)dn=(dn%9)||9;
  if(L==='zh'&&dn===4)dn=5;
  const ruler=getDayRuler(today);
  const rulerName=L==='en'?ruler.en:L==='zh'?ruler.zh:ruler.p;
  const moonName=(L==='zh'&&typeof tMoon==='function')?tMoon(r.moon.name):L==='en'?(MOON_EN[r.moon.name]||r.moon.name):r.moon.name;
  const sign=(L==='zh'&&typeof tZodiac==='function')?tZodiac(r.zodiac.sign):L==='en'?(SIGN_EN[r.zodiac.sign]||r.zodiac.sign):r.zodiac.sign;
  const yAni=getChineseFromDate(today);
  const yan=(L==='zh'&&typeof tAnimal==='function')?tAnimal(yAni.animal):L==='en'?(ANIMAL_EN[yAni.animal]||yAni.animal):yAni.animal;
  const ani=(L==='zh'&&typeof tAnimal==='function')?tAnimal(r.chinese.animal):L==='en'?(ANIMAL_EN[r.chinese.animal]||r.chinese.animal):r.chinese.animal;
  const planetName=L==='en'?(PLANET_EN[r.zodiac.planet]||r.zodiac.planet):r.zodiac.planet;
  const txt=M[key].x.replace('{ev}',ev).replace(/\{dn\}/g,dn).replace('{sign}',sign).replace('{planet}',planetName).replace('{ruler}',rulerName).replace('{moonName}',moonName).replace('{animal}',ani).replace('{yearAnimal}',yan);
  panel.innerHTML='<div class="mp-title">'+M[key].t+'</div><div class="mp-orb">'+dn+'</div><div class="mp-text">'+txt+'</div>';
  panel.dataset.key=key;panel.classList.remove('hidden');panel.scrollIntoView({behavior:'smooth',block:'center'});
}
function computeDuel(teamA,teamB,name,birth,cityB,cityN,today,match){
  // Campo energético en %: numerología + astro + luna + chino + geo de los dos rivales. Sin sesgo de ranking externo.
  const effDate=(match&&match.d)?match.d:today;
  const lp=lifePath(name,birth),moon=getMoon(effDate),geoB=cityGeoVal('cityb',cityB),geoN=cityGeoVal('cityn',cityN);
  const venueGeo=(match&&match.venueText)?cityEnergy(match.venueText):0;
  const geo=numReduce(geoB+geoN+venueGeo);
  const todayN=numReduce(effDate.replace(/-/g,'').split('').reduce((a,b)=>a+parseInt(b),0));
  const zodiac=getZodiac(birth),chinese=getChineseFromDate(birth);
  const astV=numReduce(zodiac.num+getDayRuler(effDate).n),chiV=numReduce(chinese.num+getChineseFromDate(effDate).num);
  function cosmicScore(teamName){
    const tn=nameNum(teamName);
    const seed=Math.abs((tn*137+lp*53+todayN*97+moon.day*31+geo*71+venueGeo*43)&0x7fffffff);
    const rand=seededRand(seed);
    let raw=tn+todayN+Math.round(moon.mult*2)+Math.floor(rand()*3);
    return Math.max(1,wcRed9(raw));
  }
  const sA=cosmicScore(teamA),sB=cosmicScore(teamB);
  let pctA=Math.round(100*sA*sA/(sA*sA+sB*sB));
  if(wcLang()==='zh'){if(pctA===44)pctA=45;else if(pctA===56)pctA=57;else if(pctA===4)pctA=5;else if(pctA===96)pctA=97;}
  if(pctA<3)pctA=3;if(pctA>97)pctA=97;
  const pctB=100-pctA;
  const diff=Math.abs(pctA-pctB);
  const sportNoDraw=(typeof STATE!=='undefined'&&STATE.game==='sports'&&['tennis','basketball','americanfootball','volleyball','baseball'].indexOf(STATE.sport)>=0);
  const isDraw=!sportNoDraw&&diff<=8;
  let winner,loser;
  if(pctA>pctB){winner=teamA;loser=teamB;}
  else if(pctB>pctA){winner=teamB;loser=teamA;}
  else{winner=nameNum(teamA)>=nameNum(teamB)?teamA:teamB;loser=winner===teamA?teamB:teamA;}
  const TC=WC_I18N[wcLang()];
  let confidence;
  if(isDraw)confidence=TC.confDraw;
  else if(diff<=8)confidence=TC.confKO;
  else if(diff<=16)confidence=TC.confLeve;
  else if(diff<=30)confidence=TC.confMod;
  else confidence=TC.confClara;
  return{teamA,teamB,pctA,pctB,scoreA:pctA,scoreB:pctB,isDraw,winner,loser,confidence,match:match||null,engines:{num:lp,ast:astV,moon:moon.day,chi:chiV,geo},moon,lp,zodiac,chinese,geo};
}
function getCulturalRules(lang){if(lang==='zh')return{blocked:[4,14,24,44],boost:[8,6,9,2],reduce:[]};if(lang==='en')return{blocked:[13],boost:[7,3,11],reduce:[]};return{blocked:[],boost:[7,3,11,22],reduce:[13]}}
function computeNumbers(name,birth,cityB,cityN,game,lang,today){
  const lp=lifePath(name,birth),zodiac=getZodiac(birth),chinese=getChineseFromDate(birth),moon=getMoon(today),eB=cityGeoVal('cityb',cityB),eN=cityGeoVal('cityn',cityN),geo=numReduce(eB+eN),tn=numReduce(today.replace(/-/g,'').split('').reduce((a,b)=>a+parseInt(b),0));
  const astV=numReduce(zodiac.num+getDayRuler(today).n),chiV=numReduce(chinese.num+getChineseFromDate(today).num);
  const seed=Math.abs(lp*137+astV*29+chiV*53+Math.round(moon.mult*100)*17+geo*41+tn*73+nameNum(name)*61+eB*19+eN*31);
  const rules=getCulturalRules(lang),cfg=GAME_CFG[game],rand=seededRand(seed),pool=[];
  const userPicks=!!cfg.pick;
  // El usuario puede elegir cuántos números quiere (1-3); por defecto 3
  const wantCount=userPicks?Math.min(3,Math.max(1,(STATE.chanceCount||3))):cfg.count;
  for(let i=(cfg.max===9?0:1);i<=cfg.max;i++){if(rules.blocked.includes(i))continue;const w=rules.boost.includes(i)?3:rules.reduce.includes(i)?0:1;for(let j=0;j<w;j++)pool.push(i)}
  for(let i=pool.length-1;i>0;i--){const j=Math.floor(rand()*(i+1));[pool[i],pool[j]]=[pool[j],pool[i]]}
  const seen=new Set(),nums=[];for(const n of pool){if(!seen.has(n)){seen.add(n);nums.push(n)}if(nums.length>=wantCount)break}
  nums.sort((a,b)=>a-b);
  // NÚMERO DE ORO: fusión de los 5 motores + día, reducido a dígito maestro
  const goldenRaw=lp+astV+chiV+moon.day+geo+tn+nameNum(name); // 1sep2026: se suma el nombre aqui porque el Numero de Vida (lp) ya no lo incluye -- sin esto, dos personas nacidas el mismo dia con las mismas ciudades tendrian el mismo Numero de Oro toda su vida.
  const golden=numReduce(goldenRaw);
  // ¿El número de oro entra en el rango de la lectura?
  const goldenFits=golden>=(cfg.max===9?0:1)&&golden<=cfg.max&&!rules.blocked.includes(golden);
  // El número de oro se muestra arriba en su propio círculo — NO se incluye en la secuencia
  let goldenInPlay=goldenFits;
  return{nums,lp,zodiac,chinese,moon,geo,golden,goldenInPlay,engines:{num:lp,ast:astV,moon:moon.day,chi:chiV,geo}};
}
function goTo(id){document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));document.getElementById(id).classList.add('active')}
function cicloReduce(n){while(n>9&&n!==11&&n!==22&&n!==33){n=String(n).split('').map(Number).reduce((a,b)=>a+b,0);}return n;}
function getPersonalYear(birth,year){if(!birth)return null;const p=birth.split('-');const d=parseInt(p[2]),m=parseInt(p[1]);const yDigits=String(year).split('').map(Number).reduce((a,b)=>a+b,0);return cicloReduce(d+m+yDigits);}
function getPersonalMonth(birth,month,year){const py=getPersonalYear(birth,year);if(py===null)return null;return cicloReduce(py+month);}
function getPersonalDay(birth,day,month,year){const pm=getPersonalMonth(birth,month,year);if(pm===null)return null;return cicloReduce(pm+day);}
function switchCiclo(tipo,btn){STATE.cicloActivo=tipo;document.querySelectorAll('.ciclo-tab-btn').forEach(b=>b.classList.remove('on'));if(btn)btn.classList.add('on');renderCiclos(tipo);}
function maybeAskPush(){try{if(localStorage.getItem('push_asked'))return;localStorage.setItem('push_asked','1');if(window.OneSignalDeferred){OneSignalDeferred.push(function(OS){OS.Slidedown.promptPush();});}}catch(e){}}
function openHoy(){
  const nameEl=document.getElementById('inp-name'),birthEl=document.getElementById('inp-birth');
  const name=nameEl?nameEl.value.trim():'',birth=birthEl?birthEl.value:'';
  if(!name||!birth){showTab('form');return;}
  try{
    const cityB=(document.getElementById('inp-cityb')||{value:''}).value.trim();
    const cityN=(document.getElementById('inp-cityn')||{value:''}).value.trim();
    const today=new Date().toISOString().split('T')[0];
    STATE.game='daily';
    const r=computeNumbers(name,birth,cityB,cityN,'daily',STATE.lang,today);
    STATE.lastResult={result:r,name:name,game:'daily'};
    renderHoyView(r,name);
    showTab('hoy');
  }catch(e){console.warn('openHoy fallback:',e);showTab('form');}
}
function hoyMotorVals(r){return {num:r.engines.num,ast:r.engines.ast,moon:r.moon.day+'d',chi:r.engines.chi,geo:r.engines.geo};}
function streakTouch(){
  try{
    const today=new Date().toISOString().split('T')[0];
    let s={n:0,last:''};
    try{s=JSON.parse(localStorage.getItem('no_streak'))||s}catch(e){}
    if(s.last===today)return{n:s.n,fresh:false};
    const y=new Date(Date.now()-864e5).toISOString().split('T')[0];
    s.n=(s.last===y)?(s.n+1):1;s.last=today;
    localStorage.setItem('no_streak',JSON.stringify(s));
    return{n:s.n,fresh:true};
  }catch(e){return{n:0,fresh:false};}
}
function goldRemember(g){
  try{
    const today=new Date().toISOString().split('T')[0];
    let m={};try{m=JSON.parse(localStorage.getItem('no_gold'))||{}}catch(e){}
    if(m.date!==today){m.prevDate=m.date;m.prevNum=m.num;}
    m.date=today;m.num=g;
    localStorage.setItem('no_gold',JSON.stringify(m));
  }catch(e){}
}
function goldYesterday(){
  try{
    const m=JSON.parse(localStorage.getItem('no_gold'))||{};
    const y=new Date(Date.now()-864e5).toISOString().split('T')[0];
    return(m.prevDate===y&&m.prevNum!=null)?m.prevNum:null;
  }catch(e){return null;}
}
function placeHoyMotors(r){
  const o=document.getElementById('hoy-orbit');if(!o)return;
  o.querySelectorAll('.hoy-mini').forEach(m=>m.remove());
  const vals=hoyMotorVals(r), R=112, c=142;
  HOY_MOTORS.forEach((m,i)=>{
    const a=(i/HOY_MOTORS.length)*2*Math.PI - Math.PI/2;
    const x=c+R*Math.cos(a), y=c+R*Math.sin(a);
    const d=document.createElement('div');d.className='hoy-mini';
    d.style.left=x+'px';d.style.top=y+'px';d.style.color=m[2];d.style.borderColor=m[2]+'66';d.style.boxShadow='0 0 10px '+m[2]+'44';
    d.innerHTML=m[1]+'<b style="color:'+m[2]+'">'+vals[m[0]]+'</b>';
    d.onclick=()=>openHoySheet(i);
    o.appendChild(d);
  });
}
function closeHoySheet(){const bg=document.getElementById('hoy-sheet-bg');if(bg)bg.classList.remove('show');}
function numaGetDayNum(){const t=new Date(),s=`${t.getFullYear()}${t.getMonth()+1}${t.getDate()}`;return numReduce([...s].reduce((a,c)=>a+parseInt(c),0));}
function numaHarmony(lp,dn){const s=numReduce(lp+dn);const m={1:82,2:58,3:36,4:42,5:88,6:65,7:72,8:92,9:60,11:91,22:96,33:88};const b=m[s]||65,v=((new Date().getDate()+new Date().getMonth())%7)*2-6;return Math.min(98,Math.max(18,b+v));}
function numaFill(tpl,vars){return tpl.replace(/\{(\w+)\}/g,(_,k)=>vars[k]??'?')}
function numaRand(arr){return arr[Math.floor(Math.random()*arr.length)]}
function numaClose(){showTab(STATE.prevTab||'form');}
function showForgotPw(){goTo('screen-forgot');}
function toggleAuth(){goAuth(STATE.authMode==='register'?'login':'register')}
function sportLeagueCacheKey(leagueId){return 'no_sports_league_'+leagueId+'_'+new Date().toISOString().split('T')[0]}
function renderLeagueEmptyState(msg){
  const es=document.getElementById('league-empty-state');if(!es)return;
  es.textContent=msg||'';es.classList.toggle('hidden',!msg);
}
function selLeague(el,events){
  document.querySelectorAll('#league-selector .sport-chip').forEach(c=>c.classList.remove('sel'));
  if(el)el.classList.add('sel');
  SPORT_EVENTS=events||[];
  const mwrap=document.getElementById('sport-match-wrap'),sel=document.getElementById('sport-match-select');
  const T=sptI18n();
  if(!mwrap||!sel)return;
  if(SPORT_EVENTS.length===0){mwrap.classList.add('hidden');renderLeagueEmptyState(T.empty);STATE.sportMatch=null;updateTeamPreview();return;}
  renderLeagueEmptyState('');
  mwrap.classList.remove('hidden');
  document.getElementById('sport-match-label').textContent=T.matchLabel;
  document.getElementById('sport-match-hint').textContent=T.hint;
  sel.innerHTML='';
  SPORT_EVENTS.forEach(function(e,i){
    const o=document.createElement('option');o.value='m'+i;
    const time=e.strTimeLocal?e.strTimeLocal.slice(0,5):(e.strTime?e.strTime.slice(0,5):'');
    o.textContent=wcFmtDate(e.dateEvent)+' · '+e.strHomeTeam+' vs '+e.strAwayTeam+(time?(' · '+time):'');
    sel.appendChild(o);
  });
  selSportMatch();
}
function selSportMatch(){
  const sel=document.getElementById('sport-match-select');if(!sel)return;
  const v=sel.value;
  if(v&&v.charAt(0)==='m'&&SPORT_EVENTS[parseInt(v.slice(1))]){
    const e=SPORT_EVENTS[parseInt(v.slice(1))];
    const venueText=[e.strVenue,e.strCity,e.strCountry].filter(Boolean).join(', ');
    STATE.sportMatch={d:e.dateEvent,venueText:venueText,teamA:e.strHomeTeam,teamB:e.strAwayTeam};
  }else{
    STATE.sportMatch=null;
  }
  updateTeamPreview();
}
function updateTeamPreview(){
  const prev=document.getElementById('duel-team-preview'),a=document.getElementById('inp-team-a'),b=document.getElementById('inp-team-b');
  if(!prev||!a||!b)return;
  if(STATE.sportMatch&&STATE.sportMatch.teamA&&STATE.sportMatch.teamB){
    a.value=STATE.sportMatch.teamA;b.value=STATE.sportMatch.teamB;prev.classList.remove('hidden');
  }else{
    a.value='';b.value='';prev.classList.add('hidden');
  }
}
function selectChance(n){STATE.chanceCount=n;document.querySelectorAll('#chance-seg span').forEach(s=>s.classList.toggle('on',+s.dataset.n===n));}
function selGame(el){
  document.querySelectorAll('.game-card').forEach(c=>c.classList.remove('sel'));
  el.classList.add('sel');STATE.game=el.dataset.game;
  const isSports=STATE.game==='sports';
  const isCompat=STATE.game==='compat';
  document.getElementById('duel-fields').classList.toggle('hidden',!isSports);
  document.getElementById('compat-fields').classList.toggle('hidden',!isCompat);
  document.getElementById('chance-fields').classList.toggle('hidden',STATE.game!=='chance');
  document.getElementById('signals-fields').classList.toggle('hidden',STATE.game!=='signals');
  if(isSports){populateLeagues(STATE.sport);}else{STATE.sportMatch=null;}
  // Hide hint when a card is selected
  document.getElementById('card-hint').classList.remove('show');
  try{updateFreemiumBar()}catch(e){}
  try{accUpdate()}catch(e){}
  try{renderConsultaSel()}catch(e){}
}
function isPro(){return STATE.profile?.plan==='pro'}
function dreamQuotaKey(){return 'no_dream_'+new Date().toISOString().split('T')[0]}
function dreamQuotaToday(){try{return parseInt(localStorage.getItem(dreamQuotaKey())||'0',10)}catch(e){return 0}}
function incrementDreamQuota(){try{localStorage.setItem(dreamQuotaKey(),String(dreamQuotaToday()+1))}catch(e){}}
function proLaunch(el){
  if(isPro()){quickLaunch(el);return;}
  showTab('upgrade');
  setTimeout(()=>{const u=document.querySelector('.upgrade-notify');if(u)u.scrollIntoView({behavior:'smooth',block:'center'})},300);
}
function compatLaunch(el){
  if(isPro()){selGame(el);setTimeout(()=>{const f=document.getElementById('inp-compat-name');if(f)f.focus()},200);return;}
  showTab('upgrade');
  setTimeout(()=>{const u=document.querySelector('.upgrade-notify');if(u)u.scrollIntoView({behavior:'smooth',block:'center'})},300);
}
function calculateLP(dateStr){
  if(!dateStr)return{lp:1,base:1};
  const digits=dateStr.replace(/-/g,'').split('').map(Number);
  let s=digits.reduce((a,b)=>a+b,0);
  while(s>9&&s!==11&&s!==22&&s!==33){s=String(s).split('').map(Number).reduce((a,b)=>a+b,0);}
  const base=s===11?2:s===22?4:s===33?6:s;
  return{lp:s,base};
}
function accVal(n){const f=ACC_FIELDS[n];if(!f)return'';const el=document.getElementById(f);return el?el.value.trim():''}
function accFmtDate(v){if(!v)return'';const p=v.split('-');return p.length===3?p[2]+' · '+p[1]+' · '+p[0]:v}
function accFirstEmpty(){for(let i=1;i<=4;i++){if(!accVal(i))return i}return 5}
function accOpenStep(n,focus){ACC_OPEN=n;accUpdate();const st=document.getElementById('acc-'+n);if(st&&focus)setTimeout(()=>{st.scrollIntoView({behavior:'smooth',block:'center'});const f=ACC_FIELDS[n];if(f){const el=document.getElementById(f);if(el)el.focus()}},150)}
function accToggle(n){const st=document.getElementById('acc-'+n);if(st&&st.classList.contains('profile-locked'))return;if(ACC_OPEN!==n)accOpenStep(n,true)}
function accNext(n){
  if(n<5&&!accVal(n)){const f=document.getElementById(ACC_FIELDS[n]);if(f){f.closest('.field')?.classList.add('field-missing');setTimeout(()=>f.closest('.field')?.classList.remove('field-missing'),2500);f.focus()}return}
  accOpenStep(n>=5?5:Math.min(accFirstEmpty(),n+1),true)
}
function accUpdate(){
  for(let i=1;i<=5;i++){
    const st=document.getElementById('acc-'+i);if(!st)continue;
    const done=i<5&&!!accVal(i);
    st.classList.toggle('open',ACC_OPEN===i);
    st.classList.toggle('done',done&&ACC_OPEN!==i);
    st.classList.toggle('locked',ACC_OPEN!==i&&!done);
    const sum=document.getElementById('acc-sum-'+i);
    if(sum){
      if(ACC_OPEN===i){sum.textContent=''}
      else if(i===5){let g='';try{g=I18N_NEW[uiLang()].games[STATE.game]||''}catch(e){}sum.textContent=g}
      else{sum.textContent=i===2?accFmtDate(document.getElementById('inp-birth').value):accVal(i)}
    }
  }
}
function accInit(){try{accLockProfile()}catch(e){}accOpenStep(accFirstEmpty(),false)}
function editProfileData(){for(let i=1;i<=4;i++){const el=document.getElementById('acc-'+i);if(el)el.classList.remove('profile-locked');}showTab('form');accOpenStep(1,true);}
function wcRibbonGo(){
  showTab('form');accOpenStep(5,false);
  setTimeout(function(){const el=document.querySelector('.game-grid .game-card[data-game="sports"]');if(el&&!el.hidden)quickLaunch(el)},200); // 1sep2026: no autolanzar Sports mientras la tarjeta esta oculta (Cambio E)
}
function quickLaunch(el){
  selGame(el);
  if(document.getElementById('tab-form')?.classList.contains('hidden'))showTab('form');
  // Siempre: solo seleccionar la tarjeta y hacer pulsar el botón Revelar.
  // El usuario elige libremente y presiona Revelar cuando quiera.
  const isDuel=GAME_CFG[STATE.game]?.duel;
  const name=document.getElementById('inp-name').value.trim();
  const birth=document.getElementById('inp-birth').value;
  const cityB=document.getElementById('inp-cityb').value.trim();
  const cityN=document.getElementById('inp-cityn').value.trim();
  const btnGen=document.getElementById('btn-gen');
  btnGen.classList.remove('btn-pulse');
  btnGen.classList.add('btn-ready');
  startSparkles();
  btnGen.scrollIntoView({behavior:'smooth',block:'center'});
  // Si faltan datos personales, abrir el primer paso vacío y resaltar
  if(!name||!birth||!cityB||!cityN){
    try{accOpenStep(accFirstEmpty(),true)}catch(e){}
    const fields=[
      {id:'inp-name',val:name},{id:'inp-birth',val:birth},
      {id:'inp-cityb',val:cityB},{id:'inp-cityn',val:cityN}
    ];
    fields.forEach(f=>{
      if(!f.val){
        const el=document.getElementById(f.id);
        el.closest('.field')?.classList.add('field-missing');
        setTimeout(()=>el.closest('.field')?.classList.remove('field-missing'),3200);
      }
    });
  }else{try{accOpenStep(5,false)}catch(e){}}
}
function showError(id,msg){const el=document.getElementById(id);el.textContent=msg;el.classList.add('show');setTimeout(()=>el.classList.remove('show'),5000)}
function showSuccess(id,msg){const el=document.getElementById(id);el.textContent=msg;el.classList.add('show');setTimeout(()=>el.classList.remove('show'),5000)}
function showLandingLoggedIn(){document.getElementById('landing-btns-guest').style.display='none';document.getElementById('landing-btns-user').style.display='block';}
function updateEngines(e,m){document.getElementById('ev-num').textContent=e.num;document.getElementById('ev-ast').textContent=e.ast;document.getElementById('ev-moon').textContent=m.day+'d';document.getElementById('ev-chi').textContent=e.chi;document.getElementById('ev-geo').textContent=e.geo;document.querySelectorAll('.eng-item').forEach(x=>x.classList.add('lit'));document.getElementById('mv-num').textContent=e.num;document.getElementById('mv-ast').textContent=e.ast;document.getElementById('mv-moon').textContent=m.day+'d';document.getElementById('mv-chi').textContent=e.chi;document.getElementById('mv-geo').textContent=e.geo}
function hideConvergence(){const ov=document.getElementById('conv-overlay');if(!ov)return;ov.classList.add('fade');setTimeout(()=>{ov.style.display='none';ov.classList.remove('fade');},650);}
function resetCompatView(){
  const show=['golden-section','combo-title-wrap-top','numbers-display','power-seal','motors-row'];
  show.forEach(id=>{const el=document.getElementById(id);if(el){el.style.display='';el.classList.remove('hidden');}});
  const cs=document.getElementById('compat-result-section');if(cs)cs.classList.add('hidden');
}
function buildOrbit(r){
  const tr=document.getElementById('tab-result');if(tr)tr.classList.add('orbit-mode');
  const host=document.getElementById('golden-satellites');if(!host||!r||!r.engines)return;
  const sats=[
    ['num','☿','#7bd0ff',r.engines.num],
    ['ast','♈','#ff9ec7',r.engines.ast],
    ['moon','🌙','#cdd6ff',(r.moon?r.moon.day:'')+'d'],
    ['chi','🐉','#ffcaa6',r.engines.chi],
    ['geo','🌎','#7bf0b0',r.engines.geo]
  ];
  const R=90,c=105;
  host.innerHTML='';
  host.style.animation='none';void host.offsetWidth;host.style.animation='';
  sats.forEach((s,i)=>{
    const a=(i/sats.length)*2*Math.PI - Math.PI/2;
    const x=c+R*Math.cos(a), y=c+R*Math.sin(a);
    const d=document.createElement('div');d.className='gsat';
    d.style.left=x+'px';d.style.top=y+'px';d.style.color=s[2];
    d.style.borderColor=s[2]+'66';d.style.boxShadow='0 0 10px '+s[2]+'44';
    d.innerHTML=s[1]+'<b style="color:'+s[2]+'">'+s[3]+'</b>';
    d.setAttribute('onclick',"openMotorPanel('"+s[0]+"')");
    host.appendChild(d);
  });
}
function newConsult(){goBackToForm()}
function toggleAccordion(id){const body=document.getElementById(id);const btn=body.previousElementSibling;const arrow=btn.querySelector('.acc-arrow');const isOpen=body.classList.contains('open');body.classList.toggle('open');arrow.style.transform=isOpen?'rotate(0deg)':'rotate(180deg)'}
function startSparkles(){
  stopSparkles();
  const wrap=document.getElementById('btn-gen-wrap');
  // Partículas
  const pts=[
    {bottom:'calc(100% + 6px)',left:'8%',dur:'1.4s',delay:'0s'},
    {bottom:'calc(100% + 6px)',left:'25%',dur:'1.8s',delay:'0.25s'},
    {bottom:'calc(100% + 6px)',left:'48%',dur:'1.5s',delay:'0.5s'},
    {bottom:'calc(100% + 6px)',left:'68%',dur:'1.7s',delay:'0.75s'},
    {bottom:'calc(100% + 6px)',left:'85%',dur:'1.6s',delay:'1s'},
    {bottom:'calc(100% + 6px)',left:'35%',dur:'1.9s',delay:'1.3s'},
  ];
  pts.forEach(p=>{
    const s=document.createElement('span');
    s.className='btn-sparkle';s.textContent='✦';
    s.style.cssText=`bottom:${p.bottom};left:${p.left};--dur:${p.dur};--delay:${p.delay}`;
    wrap.appendChild(s);
  });
}
function stopSparkles(){
  const wrap=document.getElementById('btn-gen-wrap');
  wrap.querySelectorAll('.btn-sparkle,.btn-ring').forEach(el=>el.remove());
}
function goBackToForm(){showTab('form');history.pushState({tab:'form'},'','');}
function isStandalone(){return window.matchMedia('(display-mode: standalone)').matches||navigator.standalone===true}
function isTWA(){
  try{
    if(document.referrer && document.referrer.indexOf('android-app://')===0){
      localStorage.setItem('no_twa','1');
      return true;
    }
    return localStorage.getItem('no_twa')==='1';
  }catch(e){ return false; }
}
function maybeShowInstallPrompt(){
  try{
    if(isStandalone()||window.__pwaShown)return;
    if(Date.now()-(+localStorage.getItem('pwaPromptLast')||0)<7*24*3600*1000)return;
    const ios=/iphone|ipad|ipod/i.test(navigator.userAgent);
    if(!ios&&!deferredInstall)return;
    const T=I18N_NEW[uiLang()];
    document.querySelector('#pwa-banner .pwa-title').textContent=T.pwaTitle;
    document.getElementById('pwa-sub').innerHTML=ios?T.pwaIos:T.pwaSub;
    document.getElementById('pwa-install-btn').textContent=T.pwaBtn;
    if(ios){document.getElementById('pwa-install-btn').style.display='none';}
    document.getElementById('pwa-banner').classList.remove('hidden');
    window.__pwaShown=true;
  }catch(e){console.warn('PWA prompt:',e);}
}
function dismissPwaBanner(){document.getElementById('pwa-banner').classList.add('hidden');try{localStorage.setItem('pwaPromptLast',String(Date.now()))}catch(e){}}
function installPwa(){
  if(!deferredInstall){dismissPwaBanner();return;}
  deferredInstall.prompt();
  deferredInstall.userChoice.finally(()=>{deferredInstall=null;dismissPwaBanner();});
}
function uiLang(){return STATE.lang==='en'?'en':STATE.lang==='zh'?'zh':'es'}
function L(es,en){return uiLang()==='en'?en:es}
function tEN(map,v){return uiLang()==='en'?(map[v]||v):v}
function applyChipLang(l){const T=l==='en'?CHIP_EN:CHIP_ES;document.querySelectorAll('#sport-selector .sport-chip').forEach(ch=>{const t=T[ch.dataset.sport];if(!t)return;ch.textContent=t;});}
function captureStaticES(){__uiES={};UI_EN.forEach(e=>{const sel=e[0],kind=e[2];try{document.querySelectorAll(sel).forEach((el,i)=>{__uiES[sel+'|'+i]=kind==='ph'?el.placeholder:(kind==='html'?el.innerHTML:el.textContent)})}catch(err){}});}
function applyStaticLang(l){
  if(l==='zh')return;
  if(!__uiES)captureStaticES();
  UI_EN.forEach(e=>{const sel=e[0],en=e[1],kind=e[2];try{document.querySelectorAll(sel).forEach((el,i)=>{const v=l==='en'?en:__uiES[sel+'|'+i];if(v==null)return;if(kind==='ph')el.placeholder=v;else if(kind==='html')el.innerHTML=v;else el.textContent=v})}catch(err){}});
  try{document.documentElement.classList.toggle('lang-en',l==='en')}catch(e){}
  applyChipLang(l);
  try{applyShareI18n()}catch(e){}
  try{if(typeof populateLeagues==='function'&&STATE.game==='sports')populateLeagues(STATE.sport)}catch(e){}
}
function applyShareI18n(){const t=I18N_NEW[uiLang()];const b=document.getElementById('btn-share-main');if(b)b.textContent=t.shareBtn;const h=document.getElementById('share-hint');if(h)h.textContent=t.shareHint;updateRenewCountdown();}
function updateRenewCountdown(){
  const el=document.getElementById('renew-countdown');if(!el)return;
  if(typeof STATE!=='undefined'&&STATE.game==='destiny'){el.style.display='none';return;}
  el.style.display='';
  const now=new Date();const mid=new Date(now);mid.setHours(24,0,0,0);
  const diff=mid-now;const h=Math.floor(diff/3600000);const m=Math.floor(diff%3600000/60000);
  el.textContent=I18N_NEW[uiLang()].renew.replace('{h}',h).replace('{m}',m);
}
function applyInterpLock(){
  const ip=document.getElementById('interp-text');if(!ip)return;
  const box=ip.closest('.interpretation');if(!box)return;
  box.classList.toggle('interp-locked',!isPro());
  const T=I18N_NEW[uiLang()];
  const t=document.getElementById('interp-unlock-t');if(t)t.textContent=T.unlockT;
  const bb=document.getElementById('interp-unlock-btn');if(bb)bb.textContent=T.unlockBtn;
}
function shareWA(){
  if(!STATE.lastResult) return;
  const{result,name,game}=STATE.lastResult;
  const T=I18N_NEW[uiLang()];
  const games=T.games;
  const gameName=games[game]||game;

  try{
    const canvas=document.getElementById('wa-canvas');
    const ctx=canvas.getContext('2d');
    const W=800,H=420;
    canvas.width=W;canvas.height=H;

    // Background gradient — dark mystic
    const bg=ctx.createLinearGradient(0,0,W,H);
    bg.addColorStop(0,'#080510');bg.addColorStop(.5,'#0f0a1e');bg.addColorStop(1,'#080510');
    ctx.fillStyle=bg;ctx.fillRect(0,0,W,H);

    // Star particles
    ctx.fillStyle='rgba(245,228,176,0.6)';
    [[60,40],[180,25],[340,18],[520,30],[700,20],[90,85],[260,90],[450,80],[650,88],[780,55],[30,200],[150,220],[420,210],[700,205],[780,230],[50,340],[200,360],[500,350],[720,345],[380,400]].forEach(([x,y])=>{
      ctx.beginPath();ctx.arc(x,y,1.2,0,Math.PI*2);ctx.fill();
    });

    // Decorative top border line
    const line=ctx.createLinearGradient(0,0,W,0);
    line.addColorStop(0,'transparent');line.addColorStop(.5,'#c9a84c');line.addColorStop(1,'transparent');
    ctx.strokeStyle=line;ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(0,1);ctx.lineTo(W,1);ctx.stroke();

    // NUMBERS logo top left
    ctx.font='bold 13px Arial';ctx.fillStyle='#e8c97a';ctx.letterSpacing='3px';
    ctx.fillText(T.cvHdr,40,38);

    // Divider
    ctx.strokeStyle='rgba(201,168,76,0.2)';ctx.lineWidth=.5;
    ctx.beginPath();ctx.moveTo(40,50);ctx.lineTo(W-40,50);ctx.stroke();

    // Golden number (big hero)
    const goldenX=130,goldenY=220;
    const goldenGrad=ctx.createRadialGradient(goldenX,goldenY,10,goldenX,goldenY,70);
    goldenGrad.addColorStop(0,'rgba(245,228,176,0.25)');
    goldenGrad.addColorStop(.6,'rgba(201,168,76,0.12)');
    goldenGrad.addColorStop(1,'rgba(201,168,76,0)');
    ctx.fillStyle=goldenGrad;ctx.beginPath();ctx.arc(goldenX,goldenY,70,0,Math.PI*2);ctx.fill();
    ctx.strokeStyle='rgba(201,168,76,0.6)';ctx.lineWidth=1.5;
    ctx.beginPath();ctx.arc(goldenX,goldenY,62,0,Math.PI*2);ctx.stroke();
    ctx.strokeStyle='rgba(201,168,76,0.25)';ctx.lineWidth=.5;
    ctx.beginPath();ctx.arc(goldenX,goldenY,74,0,Math.PI*2);ctx.stroke();
    ctx.font='bold 48px Georgia';ctx.fillStyle='#fff7e0';ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.fillText(String(result.golden),goldenX,goldenY);
    ctx.font='10px Arial';ctx.fillStyle='#c9a84c';ctx.letterSpacing='2px';
    ctx.fillText(T.cvGold,goldenX,goldenY+82);
    ctx.textAlign='left';ctx.textBaseline='alphabetic';

    // User name + game
    ctx.font='italic 15px Georgia';ctx.fillStyle='#b8a888';
    ctx.fillText(name.split(' ')[0]+' — '+gameName,240,90);

    // Numbers display
    const numStartX=240,numY=185;const ballR=34;const gap=82;
    result.nums.forEach((n,i)=>{
      const cx=numStartX+(i*gap);const cy=numY;
      const isGolden=(n===result.golden&&result.goldenInPlay);
      if(isGolden){
        const g=ctx.createRadialGradient(cx,cy,5,cx,cy,ballR);
        g.addColorStop(0,'rgba(245,228,176,0.35)');g.addColorStop(1,'rgba(201,168,76,0.1)');
        ctx.fillStyle=g;ctx.beginPath();ctx.arc(cx,cy,ballR,0,Math.PI*2);ctx.fill();
        ctx.strokeStyle='#e8c97a';ctx.lineWidth=2;
      }else{
        ctx.strokeStyle='rgba(201,168,76,0.6)';ctx.lineWidth=1;
      }
      ctx.beginPath();ctx.arc(cx,cy,ballR,0,Math.PI*2);ctx.stroke();
      ctx.font=`bold ${n<10?22:20}px Georgia`;
      ctx.fillStyle=isGolden?'#fff7e0':'#e8c97a';
      ctx.textAlign='center';ctx.textBaseline='middle';
      const label=n<10&&result.nums.some(x=>x>=10)?'0'+n:String(n);
      ctx.fillText(label,cx,cy);
    });
    ctx.textAlign='left';ctx.textBaseline='alphabetic';

    // Motors row
    const engines=[
      {icon:'☿',val:result.engines.num,name:'Num.'},
      {icon:'♈',val:result.engines.ast,name:'Astro.'},
      {icon:'🌙',val:result.moon?result.moon.day+'d':result.engines.moon+'d',name:'Luna'},
      {icon:'🐉',val:result.engines.chi,name:'Chino'},
      {icon:'🌎',val:result.engines.geo,name:'Geo.'},
    ];
    engines.forEach((e,i)=>{
      const ex=240+(i*100),ey=270;
      ctx.font='12px Arial';ctx.fillStyle='rgba(201,168,76,0.5)';
      ctx.strokeStyle='rgba(201,168,76,0.2)';ctx.lineWidth=.5;
      ctx.strokeRect(ex,ey,88,44);
      ctx.font='18px serif';ctx.textAlign='center';
      ctx.fillText(e.icon,ex+20,ey+24);
      ctx.font='bold 12px Arial';ctx.fillStyle='#c9a84c';
      ctx.fillText(String(e.val),ex+52,ey+18);
      ctx.font='9px Arial';ctx.fillStyle='#7a6a54';
      ctx.fillText(e.name,ex+52,ey+32);
    });
    ctx.textAlign='left';

    // Interpretation snippet
    ctx.font='italic 12px Georgia';ctx.fillStyle='#8a7a60';
    const snippet=`Vida ${result.lp} · ${result.zodiac.sign} · Luna ${result.moon?result.moon.name:'llena'} · ${result.chinese.animal}`;
    ctx.fillText(snippet,240,335);

    // Bottom tagline
    ctx.strokeStyle='rgba(201,168,76,0.2)';ctx.lineWidth=.5;
    ctx.beginPath();ctx.moveTo(40,370);ctx.lineTo(W-40,370);ctx.stroke();
    ctx.font='11px Arial';ctx.fillStyle='rgba(201,168,76,0.6)';ctx.textAlign='center';
    ctx.fillText(T.cvTag,W/2,392);
    ctx.font='9px Arial';ctx.fillStyle='rgba(138,122,96,0.6)';
    ctx.fillText(T.cvFoot,W/2,410);
    ctx.textAlign='left';

    // Share
    canvas.toBlob(blob=>{
      if(!blob){shareWAFallback(name,gameName,result);return;}
      const file=new File([blob],'numbers-combinacion.png',{type:'image/png'});
      if(navigator.canShare&&navigator.canShare({files:[file]})){
        navigator.share({
          title:T.shTitle,
          text:`✦ ${T.shGold}: ${result.golden}

${T.shCombo} ${gameName}: ${result.nums.join(' · ')}

${T.shCta} → ${SHARE_URL}`,
          files:[file]
        }).catch(()=>shareWAFallback(name,gameName,result));
      }else{
        const url=URL.createObjectURL(blob);
        const a=document.createElement('a');a.href=url;a.download='numbers-combinacion.png';a.click();
        setTimeout(()=>URL.revokeObjectURL(url),3000);
        shareWAFallback(name,gameName,result);
      }
    },'image/png');
  }catch(e){
    console.warn('Canvas share error:',e);
    shareWAFallback(name,gameName||game,result);
  }
}
function shareWAFallback(name,gameName,result){
  const T=I18N_NEW[uiLang()];
  const text=`✦ ${T.shGold}: ${result.golden} 🌟

${T.shCombo} ${gameName}: ${result.nums.join(' · ')}

${T.waLine}

✦ ${T.shCta} → ${SHARE_URL_WA}`;
  window.open('https://wa.me/?text='+encodeURIComponent(text),'_blank');
}
function closeModal(){
  document.getElementById('notify-modal').classList.add('hidden');
}
function updateUI(){if(!STATE.profile)return;const initials=STATE.profile.full_name?STATE.profile.full_name.split(' ').map(w=>w[0]?.toUpperCase()).join('').slice(0,2):STATE.profile.email[0].toUpperCase();document.getElementById('user-avatar').textContent=initials;document.getElementById('profile-avatar').textContent=initials;applyProBadges();applyConsumptionOnly()}
function applyProBadges(){
  const pro=isPro();
  document.querySelectorAll('.free-badge').forEach(function(b){b.style.display=pro?'none':'';});
  document.querySelectorAll('.game-card.pro-locked').forEach(function(c){c.classList.toggle('pro-hide-seal',pro);});
}
function getSignalInterp(n,lang){
  const db=SIGNALS_DB[lang]||SIGNALS_DB.es;
  const str=String(n);
  // Repeating sequence: 3+ digits all the same (111, 222, 333, 444, 555, 666, 777, 888, 999, 1111...)
  if(str.length>=3&&str.split('').every(function(d){return d===str[0];})){
    const digit=parseInt(str[0],10);
    const seqDb=SIGNALS_SEQ[lang]||SIGNALS_SEQ.es;
    if(seqDb[digit]){
      const base=db[digit]||db[1];
      return{isSeq:true,seqText:seqDb[digit].text,name:base.name,energy:base.energy,area:base.area};
    }
  }
  // Master numbers: return as-is
  if(n===11||n===22||n===33){return Object.assign({},db[n]||db[1]);}
  // Any other number: reduce to single digit
  const reduced=numReduce(n);
  const base=db[reduced]||db[1];
  return Object.assign({},base,{originalN:(n!==reduced?n:null),reducedTo:reduced});
}
function smOpen(){
  const m=document.getElementById('sm');
  m.classList.remove('hidden');
  document.body.style.overflow='hidden';
  setTimeout(function(){const i=document.getElementById('inp-sm');if(i){i.value='';i.focus();}},150);
}
function smClose(){
  document.getElementById('sm').classList.add('hidden');
  document.body.style.overflow='';
}
function smReveal(){
  const raw=(document.getElementById('inp-sm').value||'').trim();
  if(!raw){document.getElementById('inp-sm').focus();return;}
  document.getElementById('inp-signals').value=raw;
  smClose();
  const name=document.getElementById('inp-name').value.trim();
  const birth=document.getElementById('inp-birth').value;
  generateSignals(name,birth);
}
function dreamRoot(n){return n===11?2:n===22?4:n===33?6:n}
function dreamNormalize(s){return (s||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase()}
function dreamLetterReduce(s){const clean=(s||'').trim();if(!clean)return 1;let sum=0;for(let i=0;i<clean.length;i++){const code=clean.charCodeAt(i);if(code>32)sum+=(code%9)+1}return numReduce(sum||1)}
function dreamMatch(text){
  const t=' '+dreamNormalize(text)+' ';
  const found=[];
  DREAM_BANK.forEach(entry=>{
    const hit=entry.kw.some(k=>t.indexOf(dreamNormalize(k))!==-1);
    if(hit)found.push(entry);
  });
  return found.slice(0,3);
}
function dreamOpen(){
  const m=document.getElementById('dream-overlay');
  m.classList.remove('hidden');
  m.scrollTop=0;
  document.body.style.overflow='hidden';
  document.getElementById('dream-screen-1').classList.remove('hidden');
  document.getElementById('dream-screen-loading').classList.add('hidden');
  document.getElementById('dream-screen-result').classList.add('hidden');
  const lm=document.getElementById('dream-limit-msg');
  if(lm){lm.classList.add('hidden');lm.textContent='';}
  dreamRenderQuick();
  setTimeout(function(){const i=document.getElementById('dream-input');if(i){i.value='';i.focus();}},150);
  // Empuja un estado al historial para que el back del dispositivo cierre el overlay
  // en vez de sacar de la app (ver popstate). Si ya había uno empujado, no duplicar.
  if(!__dreamHistoryPushed){
    try{__dreamPrevState=history.state;history.pushState({overlay:'dream'},'','');__dreamHistoryPushed=true;}catch(e){}
  }
}
function dreamClose(){
  document.getElementById('dream-overlay').classList.add('hidden');
  document.body.style.overflow='';
  // Cierre manual (botón X / fuera del modal): no navegamos, solo "deshacemos" el estado
  // que habíamos empujado con replaceState (no dispara popstate, cero riesgo de bucle).
  if(__dreamHistoryPushed){
    __dreamHistoryPushed=false;
    try{history.replaceState(__dreamPrevState,'','');}catch(e){}
  }
}
function dreamRenderQuick(){
  const wrap=document.getElementById('dream-quick');
  if(!wrap)return;
  wrap.innerHTML='';
  DREAM_QUICK_LABELS.forEach(function(lbl,i){
    const entry=DREAM_BANK.find(function(x){return x.lbl===lbl});
    if(!entry)return;
    const label=uiLang()==='en'?DREAM_QUICK_LABELS_EN[i]:lbl;
    const chip=document.createElement('div');
    chip.className='dream-chip';
    chip.textContent=entry.e+' '+label;
    chip.onclick=function(){dreamSymbolTap(label);};
    wrap.appendChild(chip);
  });
}
function dreamSymbolTap(label){
  const inp=document.getElementById('dream-input');
  if(!inp)return;
  const word=(label||'').toLowerCase();
  inp.value=(inp.value.trim()?inp.value.trim()+' ':'')+word;
  inp.focus();
}
function dreamAgain(){
  document.getElementById('dream-screen-result').classList.add('hidden');
  document.getElementById('dream-screen-1').classList.remove('hidden');
  const inp=document.getElementById('dream-input');
  if(inp){inp.value='';inp.focus();}
}
function dreamUpsell(){
  dreamClose();
  try{showTab('hoy');}catch(e){}
  const el=document.querySelector('.game-grid .game-card[data-game="daily"]'); // 1sep2026: antes buscaba destiny, que ahora esta oculto (querySelector lo encontraria igual y se clicaria algo invisible)
  if(el){try{quickLaunch(el);}catch(e){}}
}
function dreamFirstSentence(text){if(!text)return'';const m=text.match(/^.*?[.!?。]/);return m?m[0]:text;}
function dreamWrapCanvasText(ctx,text,x,y,maxWidth,lineHeight){
  const words=text.split(' ');let line='';let yy=y;
  for(let i=0;i<words.length;i++){
    const test=line+words[i]+' ';
    if(ctx.measureText(test).width>maxWidth&&line){ctx.fillText(line,x,yy);line=words[i]+' ';yy+=lineHeight;}else{line=test;}
  }
  ctx.fillText(line,x,yy);
}
function dreamDrawCard(){
  const canvas=document.getElementById('dream-canvas');
  const w=1080,h=1350;
  canvas.width=w;canvas.height=h;
  const ctx=canvas.getContext('2d');
  const res=STATE.lastDream;
  ctx.fillStyle='#0b0b10';ctx.fillRect(0,0,w,h);
  const grad=ctx.createRadialGradient(w/2,h*0.36,10,w/2,h*0.36,w*0.65);
  grad.addColorStop(0,'rgba(212,175,55,.22)');grad.addColorStop(1,'rgba(212,175,55,0)');
  ctx.fillStyle=grad;ctx.fillRect(0,0,w,h);
  if(!res)return canvas;
  ctx.textAlign='center';
  ctx.font=Math.round(w*0.11)+'px sans-serif';
  ctx.fillStyle='#fff';
  ctx.fillText((res.emoji||'🌙').split(' ')[0],w/2,h*0.28);
  ctx.fillStyle='#f5e4b0';
  ctx.font='700 '+Math.round(w*0.30)+'px Georgia, serif';
  ctx.shadowColor='rgba(212,175,55,.7)';ctx.shadowBlur=40;
  ctx.fillText(String(res.num),w/2,h*0.46);
  ctx.shadowBlur=0;
  ctx.fillStyle='#a99fc4';ctx.font=Math.round(w*0.028)+'px sans-serif';
  ctx.fillText(uiLang()==='en'?'NUMBER FROM YOUR DREAM':uiLang()==='zh'?'梦里的数字':'NÚMERO DE TU SUEÑO',w/2,h*0.51);
  const line=dreamFirstSentence(L(res.esRaw||res.zhRaw,res.en));
  ctx.fillStyle='#e8dfc8';ctx.font=Math.round(w*0.032)+'px Georgia, serif';
  dreamWrapCanvasText(ctx,line,w/2,h*0.62,w*0.78,Math.round(w*0.042));
  ctx.fillStyle='#d4af37';ctx.font='700 '+Math.round(w*0.042)+'px Georgia, serif';
  ctx.fillText('NUMBERS ORACLE',w/2,h*0.90);
  ctx.fillStyle='#a99fc4';ctx.font=Math.round(w*0.028)+'px sans-serif';
  ctx.fillText('numbersoracle.com',w/2,h*0.925);
  return canvas;
}

/* --- anadidas el 3 sep 2026: async function que la primera extraccion
   se salto porque su regex no aceptaba el prefijo `async`. --- */
async function fetchLeagueMatches(leagueId,sport){
  const ck=sportLeagueCacheKey(leagueId);
  try{const c=localStorage.getItem(ck);if(c){const p=JSON.parse(c);return p.err?null:p.events;}}catch(e){}
  try{
    const season=sportsSeasonStr(sport,new Date());
    const r=await fetch('https://www.thesportsdb.com/api/v1/json/123/eventsseason.php?id='+leagueId+'&s='+encodeURIComponent(season));
    const j=await r.json();
    const today=new Date().toISOString().split('T')[0];
    const events=(j.events||[]).filter(e=>e.dateEvent>=today&&e.strStatus==='NS'&&e.strHomeTeam&&e.strAwayTeam).sort((a,b)=>(a.dateEvent+(a.strTime||'')).localeCompare(b.dateEvent+(b.strTime||''))).slice(0,15);
    try{localStorage.setItem(ck,JSON.stringify({events:events}));}catch(e){}
    return events;
  }catch(e){
    console.warn('[fetchLeagueMatches]',e);
    try{localStorage.setItem(ck,JSON.stringify({err:true}));}catch(e2){}
    return null;
  }
}
async function enterApp(){if(!STATE.user)return;await afterLogin(STATE.user);}
async function logout(){await sb.auth.signOut();STATE.user=null;STATE.profile=null;STATE.history=[];document.getElementById('landing-btns-guest').style.display='';document.getElementById('landing-btns-user').style.display='none';goTo('screen-landing');applyProBadges();applyConsumptionOnly()}
async function loadHistory(){if(!STATE.user)return;const res=await withTimeout(sb.from('consultations').select('*').eq('user_id',STATE.user.id).order('created_at',{ascending:false}).limit(30),5000,{data:[]});STATE.history=res?.data||[]}
async function loadQuota(){if(!STATE.user)return;const today=new Date().toISOString().split('T')[0];const res=await withTimeout(sb.from('daily_quota').select('count').eq('user_id',STATE.user.id).eq('quota_date',today).single(),5000,{data:null});STATE.consultsToday=res?.data?.count||0;updateFreemiumBar()}
async function incrementQuota(){const today=new Date().toISOString().split('T')[0];await withTimeout(sb.from('daily_quota').upsert({user_id:STATE.user.id,quota_date:today,count:STATE.consultsToday+1}),5000,null);STATE.consultsToday++}
async function saveConsultation(result,name){await withTimeout(sb.from('consultations').insert({user_id:STATE.user.id,game_type:STATE.game,numbers:result.nums,life_path:result.lp,zodiac_sign:result.zodiac.sign,moon_phase:result.moon.name,chinese_animal:result.chinese.animal,geo_resonance:result.geo,market:STATE.lang}),5000,null);await withTimeout(sb.from('profiles').update({full_name:name,birth_date:document.getElementById('inp-birth').value,birth_city:document.getElementById('inp-cityb').value,current_city:document.getElementById('inp-cityn').value,language:STATE.lang}).eq('id',STATE.user.id),5000,null)}

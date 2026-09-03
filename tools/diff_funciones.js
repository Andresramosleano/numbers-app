// Compara dos inventarios de inventario_funciones.js. Imprime SOLO lo que cambio.
const fs=require('fs');
const A=JSON.parse(fs.readFileSync(process.argv[2])), B=JSON.parse(fs.readFileSync(process.argv[3]));
let problemas=0;
for(const k of new Set([...Object.keys(A),...Object.keys(B)])){
  const a=A[k], b=B[k];
  if(!a||!b){ console.log('!! '+k+' solo aparece en uno de los dos volcados'); problemas++; continue; }
  const fa=a.funciones||{}, fb=b.funciones||{};
  const perdidas=Object.keys(fa).filter(n=>!(n in fb));
  const nuevas  =Object.keys(fb).filter(n=>!(n in fa));
  const firma   =Object.keys(fa).filter(n=>n in fb && fa[n]!==fb[n]);
  if(perdidas.length){console.log('!! '+k+' FUNCIONES PERDIDAS ('+perdidas.length+'): '+perdidas.join(', '));problemas++;}
  if(firma.length)   {console.log('!! '+k+' cambio la aridad: '+firma.map(n=>n+' '+fa[n]+'->'+fb[n]).join(', '));problemas++;}
  if(nuevas.length)  console.log('   '+k+' funciones nuevas ('+nuevas.length+'): '+nuevas.slice(0,20).join(', '));
  const ea=a.erroresJS.length, eb=b.erroresJS.length;
  if(eb>ea){console.log('!! '+k+' errores de JS: '+ea+' -> '+eb+'  '+JSON.stringify(b.erroresJS.slice(0,3)));problemas++;}
  const pa=a.recorrido.pasos.filter(x=>x.endsWith('FALLO')), pb=b.recorrido.pasos.filter(x=>x.endsWith('FALLO'));
  if(pb.length>pa.length){console.log('!! '+k+' pasos fallidos: '+pa.length+' -> '+pb.length+'  '+JSON.stringify(b.recorrido.fallos.slice(0,3)));problemas++;}
  if(a.recorrido.burbujas!==b.recorrido.burbujas||a.recorrido.chips!==b.recorrido.chips)
    {console.log('!! '+k+' NUMA cambio: chips '+a.recorrido.chips+'->'+b.recorrido.chips+', burbujas '+a.recorrido.burbujas+'->'+b.recorrido.burbujas);problemas++;}
}
console.log(problemas===0?'IDENTICOS: ninguna funcion perdida, ningun error nuevo, mismo recorrido.':'PROBLEMAS: '+problemas);

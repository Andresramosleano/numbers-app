#!/usr/bin/env bash
# =============================================================================
# PREFLIGHT — Numbers Oracle
# UN SOLO COMANDO al arrancar la sesion. Sustituye las 6-8 llamadas de tanteo
# con las que se empezaba cada sesion (cada llamada = un turno = ~9.000 tokens).
#
#   bash tools/preflight.sh          -> modo RAPIDO (segundos)
#   bash tools/preflight.sh --full   -> ademas dice como correr la red completa
#
# Se corre con device_bash desde el PC de Andres, en D:\NumbersOracle\numbers-app.
# =============================================================================
cd "$(dirname "$0")/.." || exit 1
echo "======================= PREFLIGHT — $(date '+%Y-%m-%d %H:%M') ======================="

# ---- 1. Disco vs produccion -------------------------------------------------
git fetch --quiet 2>/dev/null
L=$(git rev-parse HEAD 2>/dev/null); R=$(git rev-parse origin/main 2>/dev/null)
echo "commit en disco  : $(git log --oneline -1 2>/dev/null)"
echo "commit publicado : $(git log --oneline -1 origin/main 2>/dev/null)"
if [ "$L" = "$R" ]; then echo "  -> DISCO = PRODUCCION"
else echo "  -> ¡¡DIFERENTES!! hay commits sin empujar (o produccion va por delante)"; fi

# ---- 2. Service worker ------------------------------------------------------
SWD=$(grep -m1 -o "v1\.[0-9]*" sw.js 2>/dev/null)
SWP=$(git show origin/main:sw.js 2>/dev/null | grep -m1 -o "v1\.[0-9]*")
echo "sw.js en disco: ${SWD:-?}   publicado: ${SWP:-?}"
[ "$SWD" != "$SWP" ] && echo "  -> el SW cambio y NO esta publicado. Recuerda: se bumpea en CADA cambio."

# ---- 3. El diff REAL (git status miente por CRLF sobre el mount) ------------
echo "--- cambios reales sin publicar (ignorando fin de linea):"
D=$(git diff --ignore-cr-at-eol --stat 2>/dev/null)
[ -z "$D" ] && echo "  (ninguno)" || echo "$D"
U=$(git status --porcelain 2>/dev/null | grep '^??')
[ -n "$U" ] && { echo "--- archivos nuevos sin seguir:"; echo "$U"; }
[ -f .git/index.lock ] && echo "!! .git/index.lock EXISTE: bloquea GitHub Desktop. Hace falta device_request_delete_permission + rm -f .git/index.lock"

# ---- 4. ¿La red de seguridad se corrio HOY? ---------------------------------
# Esta es la parte que existe por el fallo del 3 sep: la autoprueba dio 9/9 por
# la manana y 0/9 por la tarde sin que nadie lo notara. Un resultado de otro dia
# NO cuenta.
echo "--- red de seguridad:"
HOY=$(date '+%Y-%m-%d')
for f in tools/.ultima_autoprueba tools/.ultima_auditoria; do
  n=$(basename "$f" | sed 's/^\.ultima_//')
  if [ -f "$f" ]; then
    linea=$(cat "$f")
    case "$linea" in
      "$HOY"*) echo "  $n: $linea" ;;
      *)       echo "  $n: $linea   -> ¡NO ES DE HOY! No vale. Hay que volver a correrla." ;;
    esac
  else
    echo "  $n: nunca registrada -> hay que correrla antes de publicar nada."
  fi
done

# ---- 5. Coherencia del propio arnes ----------------------------------------
# El fallo del 3 sep: autoprueba.js extraia piezas de auditoria_pantallas.js
# por nombre, y se le habia olvidado 'activarAmbito' -> 8 de 9 checks muertos
# y su sanity check no lo veia. Aqui se comprueba que TODA pieza compartida que
# auditoria_pantallas.js define, autoprueba.js la extraiga.
echo "--- coherencia del arnes (autoprueba vs auditoria):"
if [ -f tools/auditoria_pantallas.js ] && [ -f tools/autoprueba.js ]; then
  falta=0
  for pieza in stub probe montarContexto activarAmbito CASOS TAMANOS TABS CONTEXTOS; do
    grep -q "^const $pieza=" tools/auditoria_pantallas.js || continue
    grep -q "$pieza" tools/autoprueba.js || { echo "  !! autoprueba.js NO extrae '$pieza' (definida en auditoria_pantallas.js)"; falta=1; }
  done
  [ $falta -eq 0 ] && echo "  ok: autoprueba.js extrae todas las piezas compartidas."
else
  echo "  !! falta alguno de los dos scripts."
fi

# ---- 5b. Deriva entre index.html y zh.html --------------------------------
# zh.html nacio como copia a mano. TODOS los bugs del 3 sep estaban en las
# partes que NO eran identicas: arreglos hechos en espanol que nunca llegaron al
# chino. Compartir codigo protege lo que ya estaba igual; esto vigila lo otro.
echo "--- deriva entre idiomas:"
if [ -f tools/comparar_idiomas.py ]; then
  python3 tools/comparar_idiomas.py --breve 2>&1 | sed 's/^/  /'
  [ ${PIPESTATUS[0]:-0} -ne 0 ] && echo "  -> hay deriva SIN justificar. Detalle: python3 tools/comparar_idiomas.py"
else
  echo "  !! falta tools/comparar_idiomas.py"
fi

# ---- 6. Recordatorio del paso en curso -------------------------------------
echo "--- donde estamos:"
[ -f ../documentos/PASO_ACTUAL.txt ] && cat ../documentos/PASO_ACTUAL.txt || echo "  (sin documentos/PASO_ACTUAL.txt)"

echo "=============================================================================="
if [ "$1" = "--full" ]; then
  cat <<'TXT'
RED COMPLETA (la corre Claude en su contenedor, no en este PC):
  1. stage index.html, zh.html, tools/auditoria_pantallas.js, tools/autoprueba.js
  2. mkdir -p /tmp/audit && cd /tmp && npm install playwright-core
  3. copiar los HTML y los .js a /tmp/audit/
  4. node autoprueba.js          -> tienen que salir TODOS los checks vivos
  5. node auditoria_pantallas.js -> todo en cero Y 'fallos' vacio
  6. de vuelta aqui: bash tools/preflight.sh --marcar
REGLA: no se publica nada sin 4 y 5 corridos HOY, en frio, en esta misma sesion.
TXT
fi
if [ "$1" = "--marcar" ]; then
  echo "$(date '+%Y-%m-%d %H:%M') OK" > tools/.ultima_autoprueba
  echo "$(date '+%Y-%m-%d %H:%M') OK" > tools/.ultima_auditoria
  echo "Marcadas autoprueba y auditoria como corridas ahora."
fi

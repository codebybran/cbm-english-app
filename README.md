# Chunk-Based Mastery (CBM)

Plataforma web para aprender inglés por bloques de lenguaje (chunks), pensada para hispanohablantes.

## Subnivel 1A
- Estudio: 30 bloques con fonética unida y regla de conexión.
- Escucha: ejercicios de elegir y de ordenar palabras.
- Conversación: 3 diálogos con solo los bloques de 1A.

## Cómo ejecutarlo
Desde Git Bash, dentro del proyecto:

    python -m http.server 8000 --bind 127.0.0.1

Luego abre http://127.0.0.1:8000 en Chrome o Edge.

## Estructura
- index.html: página principal
- css/styles.css: estilos
- js/app.js: lógica y audio (Web Speech API, en-US)
- data/level1a.json: datos del Subnivel 1A

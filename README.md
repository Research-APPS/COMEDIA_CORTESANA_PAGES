# Comedia cortesana · wiki ontológica (GitHub Pages)

Capa **estática** de consulta del catálogo. Los datos no viven en PostgreSQL aquí: se exportan desde el **editor** (app Django) como grafo **JSON-LD / RDF** y se versionan en este repo.

## Idea

| Capa | Rol |
|------|-----|
| Editor (`comedia_cortesana`) | Edición, curación, PostgreSQL |
| Esta wiki | Lectura, demo, backup ontológico, Pages a coste 0 |

## Consulta (estilo CATCOM)

La interfaz imita el modelo de [CATCOM · búsqueda de registros](https://catcom.uv.es/consulta/findrecords.php):

- Formulario: título, dramaturgo, tipo/género, fuente, lugar, espacio, compañía, intervalo de años, estado, música
- Índice alfabético de títulos (A–Z)
- Ficha lateral con representaciones y enlaces del grafo JSON-LD

No replica el editor Django (demasiado acoplado a PostgreSQL); sí acerca la experiencia de consulta académica estática.

## Actualizar datos (desde el editor)

```bash
cd /Users/ivansimo/Documents/2025/ITEM/COMEDIA26/comedia_cortesana
python manage.py exportar_ontologia_pages
```

Escribe en `data/`:

- `ontology.jsonld` — clases, propiedades tipadas, fuentes
- `graph.jsonld` — grafo de obras, autores, lugares, representaciones
- `index.json` — índice ligero para el buscador
- `meta.json` — totales y fecha de export

Y deja una copia fechada en `backups/YYYYMMDD_HHMMSS/` (ignorada por git).

Opciones útiles:

```bash
python manage.py exportar_ontologia_pages --destino /ruta/COMEDIA_CORTESANA_PAGES
python manage.py exportar_ontologia_pages --incluir-segundo-plano
python manage.py exportar_ontologia_pages --compacto
python manage.py exportar_ontologia_pages --sin-backup
```

Variable de entorno: `COMEDIA_PAGES_DIR`.

## Puerta de acceso (fachada)

1. Copia `config.example.js` → `config.local.js`
2. Cambia `password`
3. `config.local.js` no se sube a git

No es autenticación real (Pages es estático). Sirve para la demo.

## Publicar en GitHub Pages

1. Crear repo (recomendable **privado**) e inicializar git en esta carpeta
2. Settings → Pages → deploy from `main` / root
3. Tras cada export: `git add data && git commit && git push`

## Ver en local

Cualquier servidor estático en la raíz de este directorio, p. ej.:

```bash
cd /Users/ivansimo/Documents/CURSO_26_27/COMEDIA_CORTESANA_PAGES
python3 -m http.server 8080
```

Abrir http://127.0.0.1:8080 (contraseña por defecto en `config.local.js`: `comedia26`).

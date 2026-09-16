cat > README.md << 'EOF'
# Multi-stage Build y Variables de Entorno

Servidor Node.js (módulo `http` nativo, sin dependencias externas) empaquetado con un Dockerfile multi-stage para obtener una imagen de producción optimizada.

## Estructura

```
ejercicio-multistage/
├── server.js            # Servidor HTTP con rutas / y /health
├── package.json
├── package-lock.json
├── Dockerfile           # Etapas: builder y production
├── .dockerignore
└── docker-compose.yml
```

## Cómo ejecutar

```bash
docker compose up -d --build
docker compose ps          # STATUS debe mostrar (healthy)
curl localhost:3000
curl localhost:3000/health
docker compose down
```

## Rutas

| Ruta | Respuesta |
|---|---|
| `/` | JSON con `service`, `version` (desde `APP_VERSION`), `hostname` y `uptime` |
| `/health` | `{"status":"ok"}` |
| Otra | 404 con mensaje de error |

## Dockerfile

- **Etapa 1 (builder):** `node:20-alpine`, instala dependencias con `npm ci` y luego elimina las de desarrollo con `npm prune --omit=dev`.
- **Etapa 2 (production):** `node:20-alpine` limpia. Solo copia `node_modules`, `package.json` y `server.js` desde builder. Define variables con `ENV`, elimina npm/yarn para reducir la superficie de ataque, corre con el usuario no-root `node` e incluye un `HEALTHCHECK`.

## Resultados

### 1. Comparación de tamaños

```bash
docker build -t multistage-app:prod .
docker build --target builder -t multistage-app:builder .
docker images multistage-app
```

| Imagen | Tamaño en disco | Tamaño del contenido |
|---|---|---|
| `multistage-app:builder` | 256 MB | 68.5 MB |
| `multistage-app:prod` | 193 MB | 48.4 MB |

Para que la diferencia fuera visible se agregó TypeScript como devDependency (`npm install -D typescript`). Con `docker history multistage-app:builder` se observa que la capa de `npm ci` pesa 42.2 MB y que `npm prune` no la reduce.

Sin devDependencies ambas imágenes pesaban lo mismo (193 MB).

### 2. Variables de entorno

```bash
docker run -d --name app-v1 -p 3000:3000 multistage-app:prod
docker run -d --name app-v2 -p 3001:3000 -e APP_VERSION=2.0 multistage-app:prod
```

| Contenedor | Comando | `version` |
|---|---|---|
| `app-v1` | Sin `-e` | `1.0.0` (valor del `ENV`) |
| `app-v2` | `-e APP_VERSION=2.0` | `2.0` |

### 3. Inspección con docker exec

```bash
docker exec app-v1 printenv APP_VERSION   # 1.0.0
docker exec app-v2 printenv APP_VERSION   # 2.0
docker exec app-v2 whoami                 # node
docker exec app-v2 env
```

`whoami` devuelve `node`, lo que confirma que la aplicación no corre como root.

### 4. Monitoreo con docker stats

```bash
docker stats --no-stream
```

| Contenedor | CPU | Memoria |
|---|---|---|
| `app-v1` | 0.00% | 8.16 MiB (0.10%) |
| `app-v2` | 0.00% | 8.09 MiB (0.10%) |

## Preguntas de análisis

### 1. ¿Cuánto pesa la imagen builder vs la de producción? ¿Qué hay en builder que no está en producción?

La etapa builder ocupa 256 MB en disco (68.5 MB comprimida) y la de producción 193 MB (48.4 MB comprimida): unos 63 MB menos (~25%).

Builder contiene las devDependencies (TypeScript, en la capa de 42.2 MB de `npm ci`), la caché de npm, `package-lock.json`, los archivos copiados con `COPY . .` y las herramientas npm, npx y yarn. Aunque `npm prune` elimina TypeScript, la capa anterior sigue existiendo, porque cada capa de una imagen es inmutable. La etapa de producción parte de una base limpia y solo recibe lo necesario para ejecutar la aplicación.

### 2. ¿Cuándo es útil el flag --target?

Permite construir solo hasta una etapa específica del Dockerfile. Es útil para:

- Depurar una etapa intermedia, como verificar que las dependencias se instalaron bien.
- Ejecutar pruebas en CI con una etapa `test` sin generar la imagen final.
- Mantener imágenes de desarrollo y producción en un solo Dockerfile.
- Comparar tamaños entre etapas, como en este ejercicio.

### 3. ¿Qué diferencia hay entre ENV y -e? ¿Cuál tiene prioridad?

`ENV` define variables dentro de la imagen al construirla y funcionan como valores por defecto para todos sus contenedores. `-e` define o sobrescribe variables al ejecutar un contenedor específico, sin modificar la imagen.

**Tiene prioridad `-e`.** Con la misma imagen, `app-v1` respondió `1.0.0` y `app-v2`, ejecutado con `-e APP_VERSION=2.0`, respondió `2.0`.

Los datos sensibles no deben ir en `ENV`, porque quedan guardados en la imagen y pueden verse con `docker history` o `docker inspect`.

### 4. ¿Por qué usar npm ci en lugar de npm install en CI/CD y producción?

- Instala exactamente las versiones de `package-lock.json`, mientras que `npm install` puede actualizarlas y modificar el lock.
- Falla si `package.json` y el lock no coinciden, en vez de corregirlo en silencio.
- Borra `node_modules` antes de instalar, garantizando una instalación limpia.
- Es más rápido, porque no resuelve versiones.
- Garantiza builds reproducibles: el mismo resultado en desarrollo, en el pipeline y en producción.
EOF
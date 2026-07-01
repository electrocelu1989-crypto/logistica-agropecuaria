# Prompt de Correcciones — AgroFlet

Eres un agente de implementación. Aplica todas las correcciones listadas abajo en el orden indicado. Cada bloque es autocontenido. Verifica cada cambio ejecutando `npm run lint` y `npm test` después de completar los bloques 1-9. Los bloques 10-14 son frontend/calidad (no afectan tests).

---

## BLOQUE 1 — Firebase Storage para archivos (REEMPLAZAR base64)

**Archivos a modificar:** `server.ts`

**Qué hacer:**
1. Agregar `multer` como dependencia para manejo de multipart uploads: `npm install multer && npm install -D @types/multer`
2. Crear endpoint `POST /api/upload` que:
   - Use middleware `multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } })`
   - Reciba archivo binario en `req.file` junto a `tripId` y `tipo` ("publicacion" | "comision_camionero" | "documento_vehiculo")
   - Valide MIME type contra `["image/jpeg", "image/png", "application/pdf"]`
   - Inicialice Firebase Storage con `getStorage(app)` de `firebase-admin/storage`
   - Suba el archivo a `gs://{bucket}/comprobantes/{tripId}/{tipo}_{timestamp}_{fileName}`
   - Guarde en Firestore la URL pública (`https://storage.googleapis.com/{bucket}/comprobantes/{tripId}/...`), no el base64
   - Elimine la metadata `dataUrl` de `ComprobantePublicacion` y reemplácela con `storagePath: string`
3. Eliminar la función `validateFileUpload` y reemplazar la lógica de los endpoints:
   - `POST /api/viajes/:id/comprobante` → ahora recibe multipart (file + tripId)
   - `POST /api/viajes/:id/comprobante-camionero` → ídem
   - Mantener la transacción Firestore para idempotencia
4. Si Firebase Storage no está disponible (fallback), almacenar en `./uploads/` local con nombre único y servir con `express.static`

---

## BLOQUE 2 — Endpoints mock protegidos / modo desarrollo

**Archivos a modificar:** `server.ts`

**Qué hacer:**
1. Envolver los endpoints `GET /api/mock-afip/:cuit` y `GET /api/mock-linti/:dni` con:
   ```ts
   if (process.env.NODE_ENV !== "production") { ... }
   ```
   En producción, devolver `503 Servicio no disponible — use integración real AFIP/ANSV`.
2. No loguear el valor de CUIT ni DNI en consola (pueden contener datos sensibles). Si se loguea error, solo el ID interno.

---

## BLOQUE 3 — Seguridad HTTP: helmet, CSP, HTTPS

**Archivos a modificar:** `server.ts`

**Qué hacer:**
1. Agregar `npm install helmet`
2. Agregar al inicio de `startServer()`, antes de cualquier ruta:
   ```ts
   import helmet from "helmet";
   app.use(helmet());
   ```
3. Agregar redirección HTTPS condicional:
   ```ts
   if (process.env.NODE_ENV === "production") {
     app.use((req, res, next) => {
       if (!req.secure && req.headers["x-forwarded-proto"] !== "https") {
         return res.redirect(301, `https://${req.headers.host}${req.url}`);
       }
       next();
     });
   }
   ```
4. Configurar CSP en helmet para permitir `https://storage.googleapis.com` y `https://*.basemaps.cartocdn.com` (Leaflet).

---

## BLOQUE 4 — Configuración faltante y limpieza

**Archivos a modificar:** `.env.example`, `package.json`, `index.html`, `server.ts`

**Qué hacer:**
1. Agregar a `.env.example`:
   ```env
   JWT_SECRET="change-me-in-production"
   JWT_EXPIRES_IN="7d"
   BCRYPT_SALT_ROUNDS="12"
   PORT="3000"
   FIREBASE_SERVICE_ACCOUNT_KEY=""
   ```
2. Eliminar `@google/genai` de `package.json` (`npm uninstall @google/genai`)
3. Cambiar en `index.html`: `<title>AgroFlet — Plataforma Logística Agropecuaria</title>`
4. Agregar validación de `JWT_EXPIRES_IN` en `server.ts` (catch parse error de jwt.sign)

---

## BLOQUE 5 — Arreglar bug frontend/backend "action" vs "accion"

**Archivos a modificar:** `src/App.tsx`

**Qué hacer:**
En `handleApproveUser`, cambiar línea:
```ts
body: JSON.stringify({ action })
```
a:
```ts
body: JSON.stringify({ accion: action })
```
(mantener el parámetro `action` de la función, pero enviar `accion` al backend)

---

## BLOQUE 6 — Módulo de Penalidades

**Archivos a crear:** `src/services/penalidades.ts`  
**Archivos a modificar:** `server.ts`, `firebase-blueprint.json` (ya tiene el schema)

**Qué hacer:**
1. Crear interfaz `Penalidad`:
   ```ts
   interface Penalidad {
     id: string;
     viaje_id: string;
     solicitante_cancelacion_id: string;
     usuario_deudor_id: string;
     usuario_beneficiario_id: string;
     monto_penalidad: number;
     motivo: string;
     detalle_justificacion?: string;
     estado_pago: "PENDIENTE" | "COMPENSADO" | "INCOBRABLE";
     fecha_cancelacion: string;
     fecha_creacion: string;
   }
   ```
2. En el endpoint `POST /api/viajes/:id/cancel`, después de actualizar el viaje A CANCELLED:
   - Determinar quién es el deudor según el motivo de cancelación:
     - Si cancela el productor y ya había camionero asignado → deudor = productor, beneficiario = camionero
     - Si cancela el camionero → deudor = camionero, beneficiario = productor
     - Si cancela ADMIN → no genera penalidad
   - Calcular penalidad = 10% del monto total acordado (`viaje.acuerdo_monto * 0.10`)
   - Crear documento en colección `penalidades_cuenta_corriente`
3. Agregar endpoint `GET /api/penalidades` (auth required, ADMIN ve todas, usuarios ven las propias)
4. Agregar al frontend en BackofficeView una tabla de penalidades pendientes

---

## BLOQUE 7 — TypeScript strict mode

**Archivos a modificar:** `tsconfig.json`

**Qué hacer:**
1. Agregar: `"strict": true` en `compilerOptions`
2. Agregar: `"noUncheckedIndexedAccess": true`
3. Agregar: `"exactOptionalPropertyTypes": false` (para no romper código existente)
4. Ejecutar `npm run lint` y corregir todos los errores de tipado que surjan (tipos `any` → interfaces, optional chaining, null checks)

---

## BLOQUE 8 — CI/CD con GitHub Actions

**Archivos a crear:** `.github/workflows/ci.yml`

**Qué hacer:**
Crear workflow:
```yaml
name: CI
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npm run lint
      - run: npm test
        env:
          JWT_SECRET: ci-test-secret
```

---

## BLOQUE 9 — Tests de cobertura para comisiones camionero

**Archivos a modificar:** `tests/server.test.ts`

**Qué hacer:**
Agregar describe block "Camionero Commission (#30)" que pruebe:
1. Upload de comprobante de comisión camionero (`POST /api/viajes/:id/comprobante-camionero`)
2. Rechazo de MIME type inválido
3. Rechazo de archivo muy grande (>5MB)
4. Rechazo de upload duplicado
5. Confirmación admin de comisión (`POST /api/viajes/:id/confirm-comision-camionero`)
6. Rechazo de confirmación por usuario no-admin

---

## BLOQUE 10 — Error Boundaries en React

**Archivos a crear:** `src/components/ErrorBoundary.tsx`  
**Archivos a modificar:** `src/main.tsx`

**Qué hacer:**
1. Crear componente `ErrorBoundary` (class component con `componentDidCatch`):
   ```tsx
   interface ErrorBoundaryState { hasError: boolean; error: Error | null }
   ```
   Renderizar mensaje amigable "Error inesperado. Recargue la página." con botón de recarga.
2. Envolver `<App />` en `main.tsx` con `<ErrorBoundary>` y `<React.StrictMode>`.

---

## BLOQUE 11 — Seed data para desarrollo

**Archivos a crear:** `scripts/seed.ts`

**Qué hacer:**
1. Crear script que genere datos demo:
   - 1 ADMIN (admin@agroflet.com / admin123)
   - 2 PRODUCTORES aprobados con direcciones
   - 2 CAMIONEROS aprobados con vehículos y documentos
   - 3 Viajes: 1 DISPONIBLE, 1 ASIGNADO, 1 ENTREGADO
2. Usar `fetch` contra `localhost:3000/api/auth/register` y `/api/usuarios`
3. Agregar script en `package.json`: `"seed": "tsx scripts/seed.ts"`

---

## BLOQUE 12 — PWA manifest y service worker

**Archivos a crear:** `public/manifest.json`, `public/sw.js`  
**Archivos a modificar:** `index.html`

**Qué hacer:**
1. Crear `public/manifest.json` con nombre "AgroFlet", íconos SVG, theme_color #059669, display standalone
2. Crear `public/sw.js` básico que cachee assets estáticos (para funcionalidad offline parcial)
3. Agregar `<link rel="manifest" href="/manifest.json">` en `<head>` de `index.html`
4. Registrar service worker desde `src/main.tsx` con `if ("serviceWorker" in navigator)`

---

## BLOQUE 13 — Reemplazar Unsplash URLs placeholder

**Archivos a modificar:** `server.ts`

**Qué hacer:**
1. Reemplazar todas las URLs de Unsplash en `server.ts` (líneas donde se define `url_cedula_verde`, `url_poliza`, `url_vtv`, `url_cedula_titulo`, `url_vtv_acoplado`) con strings vacío `""`
2. Agregar comentario: "// Reemplazar con URL de Firebase Storage tras upload real"

---

## BLOQUE 14 — Arreglar `handleResetDb` en frontend

**Archivos a modificar:** `src/App.tsx`

**Qué hacer:**
En `handleResetDb`, cambiar:
```ts
await authFetch("/api/reset", { method: "POST" });
```
a:
```ts
await authFetch("/api/reset", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ confirm: "RESET" })
});
```

---

## Verificación final

Después de aplicar todos los bloques:
1. `npm run lint` — debe pasar sin errores
2. `npm test` — todos los tests existentes + nuevos deben pasar
3. `npm run dev` — debe iniciar sin warnings críticos
4. Revisar que no haya quedado ningún `any` sin tipar (si strict mode lo permite)

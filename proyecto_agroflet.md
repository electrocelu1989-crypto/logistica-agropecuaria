# Proyecto Agroflet - Documentación Principal

## Descripción General
Agroflet es una plataforma integral de logística agropecuaria que conecta a productores, transportistas (camioneros) y administradores (backoffice). Su objetivo es optimizar y trazar en tiempo real el transporte de carga, asegurando la validación documental, control de estado de viajes y el registro de montos de operación.

**Modelo financiero:** La plataforma no gestiona cuentas corrientes ni retiene fondos de fletes. Los pagos del transporte se acuerdan directamente entre productor y transportista. AgroFlet solo registra los montos de las operaciones y las comisiones del 3% que cada parte debe depositar en la cuenta bancaria de la plataforma.

## Arquitectura y Tecnologías
- **Frontend**: React 19, Vite, Tailwind CSS 4, Leaflet (Mapas en tiempo real), Lucide React (Iconos), Motion (Framer Motion para animaciones).
- **Backend**: Node.js con Express (archivo `server.ts` unificado).
- **Base de Datos**: Firebase (Firestore) para persistencia de datos y administración con `firebase-admin`.
- **Autenticación**: JWT (`jsonwebtoken`) junto con `bcryptjs` para la gestión segura de sesiones, roles y contraseñas.
- **Inteligencia Artificial / Servicios Cognitivos**: `@google/genai` incorporado para posibles validaciones automatizadas y escaneo de documentos.

## Comisiones de plataforma (depósito bancario)

| Rol | Momento | Porcentaje | Plazo |
|-----|---------|------------|-------|
| **Productor** | Al publicar una carga | 3% del valor total | 30 días corridos |
| **Transportista** | Al tomar/asignar un viaje | 3% del valor total | 40 días corridos |

Flujo:
1. La app registra el monto de la operación y calcula la comisión.
2. El usuario deposita en la cuenta de AgroFlet (alias/CBU) y sube el comprobante.
3. El administrador valida el depósito y marca la comisión como abonada.

## Módulos y Roles de Usuario

### 1. Productor (`ProductorView`)
- **Gestión de Viajes**: Creación y solicitud de nuevos viajes, definiendo origen, destino, tipo de carga y tarifa.
- **Seguimiento**: Monitoreo en tiempo real del estado de los viajes y ubicación de la carga.
- **Comisiones**: Historial de cargas publicadas, monto total y comisión del 3% con plazo de 30 días.

### 2. Camionero (`CamioneroView`)
- **Oferta de Viajes**: Búsqueda y postulación a viajes disponibles.
- **Seguimiento de Estado**: Actualización interactiva del progreso del viaje y visualización del mapa para trazabilidad.
- **Validación Documental**: Escaneo y validación de documentos (`DocumentScanner`) utilizando integraciones simuladas (Mock) de AFIP y LINTI.
- **Comisiones**: Registro de viajes tomados y comisión del 3% con plazo de 40 días corridos.

### 3. Backoffice / Administrador (`BackofficeView`)
- **Aprobación de Usuarios**: Revisión y aprobación (Onboarding) de los registros de nuevos camioneros y productores.
- **Auditoría de Comisiones**: Validación de comprobantes de depósito de productores y transportistas.
- **Auditoría**: Monitoreo general de viajes, usuarios y explorador de base de datos Firestore.

## Funcionalidades Core (Endpoints Principales)

- **Autenticación (`/api/auth`)**:
  - `POST /register`: Registro de nuevos usuarios.
  - `POST /login`: Inicio de sesión y emisión de JWT.
  - `GET /me`: Obtención de datos del perfil del usuario logueado.
  - `POST /logout`: Cierre de sesión.

- **Gestión de Usuarios (`/api/usuarios`)**:
  - `POST /`: Registro/actualización de perfil (onboarding KYC).
  - `POST /:id/approve`: Aprobación manual de cuentas en onboarding.

- **Flujo de Viajes (`/api/viajes`)**:
  - `GET /`: Listado de viajes.
  - `POST /`: Creación de un nuevo viaje (Productor) — registra comisión 3% productor.
  - `POST /:id/take`: El camionero acepta un viaje — registra comisión 3% transportista.
  - `POST /:id/step`: Transición de estado secuencial del viaje.
  - `POST /:id/cancel`: Cancelación del viaje (sin movimiento de fondos).
  - `POST /:id/comprobante`: Subida de comprobante de comisión productor.
  - `POST /:id/confirm-publicacion`: Admin confirma comisión productor.
  - `POST /:id/comprobante-camionero`: Subida de comprobante de comisión transportista.
  - `POST /:id/confirm-comision-camionero`: Admin confirma comisión transportista.

- **Validaciones de Terceros (Mocks)**: 
  - `GET /api/mock-afip/:cuit`: Consulta simulada al padrón AFIP.
  - `GET /api/mock-linti/:dni`: Consulta simulada de licencia LINTI.

## Estructura de Componentes Clave (UI)
- `TopNavbar.tsx`: Barra de navegación principal e indicadores del sistema.
- `RealTimeMap.tsx`: Componente de mapa interactivo implementado con Leaflet.
- `DocumentScanner.tsx`: Interfaz para la carga, previsualización y análisis de la documentación requerida.
- `StatusStepper.tsx`: Indicador visual paso a paso de la evolución del viaje.
- `MovimientosTable.tsx`: Registro de operaciones y comisiones por depósito.
- `UserProfileOnboarding.tsx` & `MiPerfilModal.tsx`: Componentes para la recolección inicial de datos del perfil y posterior gestión.

## Flujo de Trabajo (SDLC Multi-Agente)
El desarrollo continuo de este proyecto se rige por un marco de trabajo multi-agente establecido en `AGENTS.md`.

---
*Documento generado y mantenido por el Agente Revisor.*

import express from "express";
import rateLimit from "express-rate-limit";
import path from "path";
import { randomUUID } from "crypto";
import { createServer as createViteServer } from "vite";
import bcrypt from "bcryptjs";
import jwt, { SignOptions } from "jsonwebtoken";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";
import helmet from "helmet";
import multer from "multer";
import fs from "fs";
import { dbCompat } from "./src/db/compat";
import { storeFile as minioStoreFile } from "./src/services/storage";
import { pool } from "./src/db/connection";

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.error("FATAL: JWT_SECRET no está definido. Configure la variable de entorno JWT_SECRET antes de iniciar el servidor.");
  process.exit(1);
}
const JWT_EXPIRES_IN_VAL = process.env.JWT_EXPIRES_IN || "7d";
try {
  jwt.sign({ test: true }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN_VAL as SignOptions["expiresIn"] });
} catch {
  console.error(`FATAL: JWT_EXPIRES_IN="${JWT_EXPIRES_IN_VAL}" inválido. Use formato como "7d" o "1h".`);
  process.exit(1);
}
const JWT_EXPIRES_IN = JWT_EXPIRES_IN_VAL as SignOptions["expiresIn"];

const VALID_GRANOS = ["SOJA", "MAIZ", "TRIGO", "GIRASOL", "SORGO"] as const;
const VALID_CARROCERIAS = ["TOLVA", "BARANDA_VOLCABLE", "BATEA", "TODO_PUERTAS"] as const;

function isValidCUIT(cuit: string): boolean {
  const cleaned = cuit.replace(/[^0-9]/g, "");
  if (cleaned.length !== 11) return false;
  const weights = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
  let sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(cleaned[i] ?? "0") * (weights[i] ?? 0);
  }
  let check = 11 - (sum % 11);
  if (check === 11) check = 0;
  if (check === 10) check = 9;
  return check === parseInt(cleaned[10] ?? "0");
}

const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "application/pdf"];
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE_BYTES },
  fileFilter: (_req: any, file: any, cb: any) => {
    if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Tipo de archivo no permitido. Permitidos: ${ALLOWED_MIME_TYPES.join(", ")}. Recibido: ${file.mimetype}`));
    }
  }
});

const authLimiter: any = process.env.VITEST
  ? (req: any, res: any, next: any) => next()
  : rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 10,
      standardHeaders: true,
      legacyHeaders: false,
      message: { error: "Demasiados intentos de autenticación. Intente nuevamente en 15 minutos." }
    });

function isValidCoordinate(lat: number, lng: number): boolean {
  return Number.isFinite(lat) && Number.isFinite(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}

const BCRYPT_SALT_ROUNDS = parseInt(process.env.BCRYPT_SALT_ROUNDS || "12", 10);

const apiLimiter: any = process.env.VITEST
  ? (req: any, res: any, next: any) => next()
  : rateLimit({
      windowMs: 60 * 1000,
      max: 100,
      standardHeaders: true,
      legacyHeaders: false,
      message: { error: "Demasiadas solicitudes. Intente nuevamente en 1 minuto." }
    });

interface AuthTokenPayload {
  id: string;
  role: "PRODUCTOR" | "CAMIONERO" | "ADMIN";
  email: string;
}

function hashPassword(password: string) {
  return bcrypt.hashSync(password, BCRYPT_SALT_ROUNDS);
}

function createEntityId(prefix: string) {
  return `${prefix}-${randomUUID()}`;
}

function comparePassword(password: string, hash: string) {
  return bcrypt.compareSync(password, hash);
}

function createAuthToken(payload: AuthTokenPayload) {
  return (jwt as any).sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

function verifyAuthToken(token: string): AuthTokenPayload | null {
  try {
    return (jwt as any).verify(token, JWT_SECRET) as AuthTokenPayload;
  } catch (err) {
    return null;
  }
}

function sanitizeUser(user: any) {
  const { passwordHash, ...payload } = user || {};
  return payload;
}

function getAuthToken(req: express.Request): string | null {
  if (req.cookies && req.cookies.auth_token) {
    return req.cookies.auth_token;
  }
  const authHeader = req.headers.authorization || req.headers.Authorization;
  if (!authHeader || typeof authHeader !== "string") return null;
  const parts = authHeader.split(" ");
  return parts[0] === "Bearer" && parts[1] ? parts[1] : null;
}

function authMiddleware(req: express.Request, res: express.Response, next: express.NextFunction) {
  const token = getAuthToken(req);
  if (!token) {
    return res.status(401).json({ error: "No se proporcionó token de autenticación" });
  }
  const payload = verifyAuthToken(token);
  if (!payload) {
    return res.status(401).json({ error: "Token inválido o expirado" });
  }
  (req as any).user = payload;
  next();
}

function requireAdmin(req: express.Request, res: express.Response) {
  const user = (req as any).user as AuthTokenPayload | undefined;
  if (!user || user.role !== "ADMIN") {
    res.status(403).json({ error: "Acceso restringido: solo ADMIN puede ejecutar esta acción" });
    return false;
  }
  return true;
}

async function findUserByEmail(email: string): Promise<Usuario | null> {
  const snapshot = await db.collection("usuarios").where("email", "==", email).get();
  if (snapshot.empty) return null;
  return snapshot.docs[0].data() as Usuario;
}

async function findUserById(id: string): Promise<Usuario | null> {
  const snap = await db.collection("usuarios").doc(id).get();
  return snap.exists ? (snap.data() as Usuario) : null;
}

async function isEmailTaken(email: string): Promise<boolean> {
  return (await findUserByEmail(email)) !== null;
}

export interface Direccion {
  id: string;
  alias: string;
  direccion: string;
  lat: number;
  lng: number;
  geohash?: string;
}

interface Usuario {
  id: string;
  telefono: string;
  email: string;
  passwordHash?: string;
  rol: "PRODUCTOR" | "CAMIONERO" | "ADMIN";
  cuit: string;
  razon_social: string;
  condicion_iva: string;
  domicilio_fiscal: string;
  estado_cuenta: "PENDIENTE" | "APROBADO" | "RECHAZADO";
  onboarding_completado?: boolean;
  token_whatsapp_validado: boolean;
  direcciones?: Direccion[];
  fecha_creacion: string;
  perfil_chofer?: {
    dni: string;
    numero_linti: string;
    linti_vencimiento: string;
    validado_por_ansv: boolean;
    fotos: {
      dni_frente: string;
      dni_dorso: string;
      linti: string;
    };
  };
}

interface Vehiculo {
  id: string;
  chofer_id: string;
  chasis: {
    patente: string;
    marca: string;
    modelo: string;
    vtv_vencimiento: string;
    seguro_vencimiento: string;
    estado_verificacion: "PENDIENTE" | "APROBADO" | "RECHAZADO";
    url_cedula_verde: string;
    url_poliza: string;
    url_vtv: string;
  };
  acoplado?: {
    patente: string;
    tipo_carroceria: "TOLVA" | "BARANDA_VOLCABLE" | "BATEA" | "TODO_PUERTAS";
    vtv_vencimiento: string;
    estado_verificacion: "PENDIENTE" | "APROBADO" | "RECHAZADO";
    url_cedula_titulo: string;
    url_vtv_acoplado: string;
  };
}

interface TransaccionAlerta {
  monto: number;
  fecha_vencimiento: string;
  plazo_dias: number;
  tipo: "PRODUCTOR" | "CAMIONERO";
  mensaje: string;
  estado: "PENDIENTE" | "VENCIDO" | "COMPLETADO";
}

interface ComprobantePublicacion {
  fileName: string;
  mimeType: string;
  storagePath: string;
  uploadedAt: string;
  uploadedBy: string;
}

interface Viaje {
  id: string;
  productor_id: string;
  chofer_id: string | null;
  tipo_grano: "SOJA" | "MAIZ" | "TRIGO" | "GIRASOL" | "SORGO";
  toneladas: number;
  tipo_carroceria_requerida: "TOLVA" | "BARANDA_VOLCABLE" | "BATEA" | "TODO_PUERTAS";
  origen: {
    direccion: string;
    geohash: string;
    lat: number;
    lng: number;
  };
  destino: {
    direccion: string;
    lat: number;
    lng: number;
  };
  tarifa_por_tonelada: number;
  acuerdo_monto?: number;
  numero_transaccion?: string;
  pago_publicacion_estado?: "PENDIENTE" | "ABONADA";
  comprobante_publicacion?: ComprobantePublicacion;
  pago_comision_camionero_estado?: "PENDIENTE" | "ABONADA";
  comprobante_comision_camionero?: ComprobantePublicacion;
  notificaciones_transaccion?: {
    productor: TransaccionAlerta;
    camionero?: TransaccionAlerta;
  };
  fecha_carga_pactada: string;
  estado: "DISPONIBLE" | "ASIGNADO" | "EN_CARGA" | "EN_TRANSITO" | "ENTREGADO" | "CANCELADO";
  fecha_creacion: string;
  fecha_actualizacion: string;
}

// Initialize database: PostgreSQL via Drizzle ORM, fallback in-memory
let realDb: any = null;
let useFallbackDb = false;

const hasDatabaseUrl = Boolean(process.env.DATABASE_URL);

if (hasDatabaseUrl) {
  try {
    realDb = dbCompat;
  } catch (err: any) {
    console.warn("⚠️ [Drizzle] Could not initialize PostgreSQL:", err.message || err);
    console.warn("⚠️ Using in-memory database fallback for local development.");
    useFallbackDb = true;
  }
} else {
  console.warn("⚠️ [Drizzle] No DATABASE_URL found. Using in-memory database fallback for local development.");
  useFallbackDb = true;
}

// Fallback in-memory store
const fallbackStore: {
  usuarios: Map<string, Usuario>;
  vehiculos: Map<string, Vehiculo>;
  viajes: Map<string, Viaje>;
} = {
  usuarios: new Map(),
  vehiculos: new Map(),
  viajes: new Map(),
};

// Custom robust database proxy that delegates to Drizzle/PostgreSQL or falls back to in-memory on error
const db = {
  collection(colName: string) {
    if (useFallbackDb || !realDb) {
      const map = (fallbackStore as any)[colName] || new Map();
      return {
        async get() {
          const docs = Array.from(map.values()).map(data => ({
            id: (data as any).id,
            ref: {
              id: (data as any).id,
              colName,
              delete: async () => { map.delete((data as any).id); }
            },
            data() { return data; },
            exists: true
          }));
          return { docs, empty: docs.length === 0 };
        },
        doc(id: string) {
          return {
            id,
            colName,
            ref: {
              id,
              colName,
              async update(updateData: any) {
                const existing = map.get(id) || {};
                map.set(id, { ...existing, ...updateData });
              },
              async delete() {
                map.delete(id);
              }
            },
            async get() {
              const data = map.get(id);
              return {
                exists: !!data,
                data() { return data; }
              };
            },
            async set(data: any) {
              map.set(id, { ...data, id });
            },
            async update(data: any) {
              const existing = map.get(id) || {};
              map.set(id, { ...existing, ...data });
            }
          };
        },
        where(field: string, op: string, value: any) {
          return {
            async get() {
              const allDocs = Array.from(map.values());
              const filtered = allDocs.filter((doc: any) => {
                if (op === "==") return doc[field] === value;
                return false;
              });
              const docs = filtered.map(data => ({
                id: (data as any).id,
                ref: {
                  id: (data as any).id,
                  colName,
                  async update(updateData: any) {
                    const existing = map.get((data as any).id) || {};
                    map.set((data as any).id, { ...existing, ...updateData });
                  },
                  delete: async () => { map.delete((data as any).id); }
                },
                data() { return data; },
                exists: true
              }));
              return { docs, empty: docs.length === 0 };
            }
          };
        },
        limit(n: number) {
          return {
            async get() {
              const docs = Array.from(map.values()).slice(0, n).map(data => ({
                id: (data as any).id,
                ref: {
                  id: (data as any).id,
                  colName,
                  delete: async () => { map.delete((data as any).id); }
                },
                data() { return data; },
                exists: true
              }));
              return { docs, empty: docs.length === 0 };
            }
          };
        }
      };
    } else {
      return realDb.collection(colName);
    }
  },

  async runTransaction(updateFunction: (transaction: any) => Promise<any>) {
    if (useFallbackDb) {
      const transactionProxy = {
        async get(docRef: any) {
          const map = (fallbackStore as any)[docRef.colName] || new Map();
          const data = map.get(docRef.id);
          return {
            exists: !!data,
            data() { return data; }
          };
        },
        set(docRef: any, data: any) {
          const map = (fallbackStore as any)[docRef.colName] || new Map();
          map.set(docRef.id, { ...data, id: docRef.id });
        },
        update(docRef: any, data: any) {
          const map = (fallbackStore as any)[docRef.colName] || new Map();
          const existing = map.get(docRef.id) || {};
          map.set(docRef.id, { ...existing, ...data });
        }
      };
      return await updateFunction(transactionProxy);
    } else {
      return await realDb.runTransaction(updateFunction);
    }
  },

  batch() {
    if (useFallbackDb) {
      const deletes: Array<{ colName: string, id: string }> = [];
      return {
        delete(docRef: any) {
          deletes.push({ colName: docRef.colName || docRef.ref?.colName, id: docRef.id || docRef.ref?.id });
        },
        async commit() {
          for (const item of deletes) {
            const map = (fallbackStore as any)[item.colName] || new Map();
            map.delete(item.id);
          }
        }
      };
    } else {
      return realDb.batch();
    }
  }
};

// PostgreSQL collections fetch helpers
async function getUsuarios(): Promise<Usuario[]> {
  const snapshot = await db.collection("usuarios").get();
  return snapshot.docs.map((doc: any) => doc.data() as Usuario);
}

async function getVehiculos(): Promise<Vehiculo[]> {
  const snapshot = await db.collection("vehiculos").get();
  return snapshot.docs.map((doc: any) => doc.data() as Vehiculo);
}

async function getViajes(): Promise<Viaje[]> {
  const snapshot = await db.collection("viajes").get();
  return snapshot.docs.map((doc: any) => doc.data() as Viaje);
}

// Clear existing collections in PostgreSQL or fallback in-memory DB.
// This helper does not seed any default test data on startup.
async function resetDatabase() {
  if (process.env.DATABASE_URL) {
    console.log("[Drizzle] Truncating tables in PostgreSQL...");
    await pool.query("TRUNCATE penalties, trips, vehicles, users CASCADE");
    console.log("[Drizzle] Database cleared successfully.");
  } else {
    console.log("[Fallback] Clearing in-memory collections...");
    const collections = ["usuarios", "vehiculos", "viajes"];
    for (const colName of collections) {
      const snapshot = await db.collection(colName).get();
      const batch = db.batch();
      snapshot.docs.forEach((doc: any) => batch.delete(doc.ref));
      await batch.commit();
    }
    console.log("[Fallback] Database cleared successfully.");
  }
}

export let app: express.Express;

async function startServer() {
  app = express();
  const PORT = Number(process.env.PORT || 3000);

  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        imgSrc: ["'self'", "http://localhost:9000", "https://*.basemaps.cartocdn.com", "data:"],
        connectSrc: ["'self'", "http://localhost:9000", "https://*.basemaps.cartocdn.com"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
      },
    },
  }));

  if (process.env.NODE_ENV === "production") {
    app.use((req, res, next) => {
      if (!req.secure && req.headers["x-forwarded-proto"] !== "https") {
        return res.redirect(301, `https://${req.headers.host}${req.url}`);
      }
      next();
    });
  }

  app.use(express.json({ limit: "20mb" }));
  app.use(cookieParser());

  // Rate limiting for all API endpoints
  app.use("/api/", apiLimiter);

  // Auth: Register User
  app.post("/api/auth/register", authLimiter, async (req, res) => {
    try {
      const { email, password, rol, cuit, telefono, razon_social, condicion_iva, domicilio_fiscal } = req.body;
      if (!email || !password || !rol || !cuit || !telefono) {
        return res.status(400).json({ error: "Faltan campos obligatorios para el registro" });
      }

      // Validate CUIT format and checksum
      if (!isValidCUIT(cuit)) {
        return res.status(400).json({ error: "El CUIT ingresado no es válido. Debe tener 11 dígitos con un formato válido." });
      }
      // Normalize CUIT (remove separators)
      const normalizedCuit = cuit.replace(/[^0-9]/g, "");

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({ error: "El formato del email no es válido." });
      }

      const exists = await isEmailTaken(email);
      if (exists) {
        return res.status(409).json({ error: "El email ya está en uso" });
      }

      const id = createEntityId("user");
      const passwordHash = hashPassword(password);
      
      const newUser: Usuario = {
        id,
        telefono,
        email,
        passwordHash,
        rol,
        cuit: normalizedCuit,
        razon_social: razon_social || "Empresa Agro",
        condicion_iva: condicion_iva || "RESPONSABLE_INSCRIPTO",
        domicilio_fiscal: domicilio_fiscal || "Dirección Fiscal S/N",
        estado_cuenta: rol === "ADMIN" ? "APROBADO" : "PENDIENTE",
        onboarding_completado: rol === "ADMIN",
        token_whatsapp_validado: true,
        fecha_creacion: new Date().toISOString()
      };

      await db.collection("usuarios").doc(id).set(newUser);
      
      const token = createAuthToken({ id: newUser.id, role: newUser.rol, email: newUser.email });
      res.cookie("auth_token", token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict", maxAge: 7 * 24 * 60 * 60 * 1000 });
      res.json({ success: true, user: sanitizeUser(newUser) });
    } catch (err) {
      console.error("Register error:", err);
      res.status(500).json({ error: "Error interno en el servidor" });
    }
  });

  // Auth: Login User
  app.post("/api/auth/login", authLimiter, async (req, res) => {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        return res.status(400).json({ error: "Faltan email o contraseña" });
      }
      
      const user = await findUserByEmail(email);
      if (!user || !user.passwordHash) {
        return res.status(401).json({ error: "Credenciales inválidas" });
      }
      
      if (!comparePassword(password, user.passwordHash)) {
        return res.status(401).json({ error: "Credenciales inválidas" });
      }
      
      const token = createAuthToken({ id: user.id, role: user.rol, email: user.email });
      res.cookie("auth_token", token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict", maxAge: 7 * 24 * 60 * 60 * 1000 });
      res.json({ success: true, user: sanitizeUser(user) });
    } catch (err) {
      console.error("Login error:", err);
      res.status(500).json({ error: "Error interno en el servidor" });
    }
  });

  // Auth: Get Current Session
  app.get("/api/auth/me", authMiddleware, async (req, res) => {
    try {
      const userPayload = (req as any).user;
      const user = await findUserById(userPayload.id);
      if (!user) {
        return res.status(404).json({ error: "Usuario no encontrado" });
      }
      res.json({ success: true, user: sanitizeUser(user) });
    } catch (err) {
      res.status(500).json({ error: "Error interno en el servidor" });
    }
  });

  // Auth: Logout
  app.post("/api/auth/logout", (req, res) => {
    res.clearCookie("auth_token");
    res.json({ success: true });
  });

  app.get("/api/db", authMiddleware, async (req, res) => {
    try {
      const [usuarios, vehiculos, viajes] = await Promise.all([
        getUsuarios(),
        getVehiculos(),
        getViajes()
      ]);
      res.json({ usuarios, vehiculos, viajes });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Error al consultar el estado de la base de datos" });
    }
  });

  app.post("/api/reset", authMiddleware, async (req, res) => {
    try {
      const authenticatedUser = (req as any).user as AuthTokenPayload;
      if (authenticatedUser.role !== "ADMIN") {
        return res.status(403).json({ error: "Solo un administrador puede reiniciar la base de datos." });
      }

      const { confirm } = req.body;
      if (confirm !== "RESET") {
        return res.status(400).json({ error: 'Debe enviar confirm: "RESET" para reiniciar la base de datos.' });
      }

      await resetDatabase();
      res.json({ success: true, message: "Base de datos reiniciada" });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Error al reiniciar la base de datos" });
    }
  });

  if (process.env.NODE_ENV !== "production") {
    app.get("/api/mock-afip/:cuit", (_req, res) => {
      res.json({
        success: true,
        razon_social: "Empresa Agro Demo",
        condicion_iva: "RESPONSABLE_INSCRIPTO",
        domicilio_fiscal: "Av. Siempre Viva 123, CABA"
      });
    });

    app.get("/api/mock-linti/:dni", (_req, res) => {
      res.json({
        success: true,
        numero_linti: "L-DEMO-001",
        vencimiento: "2030-12-31"
      });
    });
  } else {
    app.get("/api/mock-afip/:cuit", (_req, res) => {
      res.status(503).json({ error: "Servicio no disponible — use integración real AFIP/ANSV" });
    });
    app.get("/api/mock-linti/:dni", (_req, res) => {
      res.status(503).json({ error: "Servicio no disponible — use integración real AFIP/ANSV" });
    });
  }

  // Register or update Usuario (Módulo 1 Onboarding KYC)
  app.post("/api/usuarios", authMiddleware, async (req, res) => {
    try {
      const { id, telefono, email, rol, cuit, razon_social, condicion_iva, domicilio_fiscal, perfil_chofer, vehiculo_data } = req.body;

      if (!id || !rol || !telefono || !cuit) {
        return res.status(400).json({ error: "Faltan campos obligatorios" });
      }

      const authenticatedUser = (req as any).user as AuthTokenPayload;
      if (authenticatedUser.id !== id && authenticatedUser.role !== "ADMIN") {
        return res.status(403).json({ error: "No puede modificar otro perfil" });
      }
      const userDocRef = db.collection("usuarios").doc(id);
      const userSnap = await userDocRef.get();
      const isNew = !userSnap.exists;
      const existingUser = isNew ? null : (userSnap.data() as Usuario);

      const userObj: Usuario = {
        id,
        telefono,
        email: email || existingUser?.email || `${id}@agro.com`,
        passwordHash: isNew ? (req.body.passwordHash || undefined) : (existingUser?.passwordHash || undefined),
        rol,
        cuit,
        razon_social: razon_social || existingUser?.razon_social || "Empresa Agro",
        condicion_iva: condicion_iva || existingUser?.condicion_iva || "RESPONSABLE_INSCRIPTO",
        domicilio_fiscal: domicilio_fiscal || existingUser?.domicilio_fiscal || "Dirección Fiscal S/N",
        estado_cuenta: existingUser?.estado_cuenta || "PENDIENTE",
        onboarding_completado: req.body.onboarding_completado !== undefined ? req.body.onboarding_completado : (existingUser?.onboarding_completado || false),
        token_whatsapp_validado: existingUser?.token_whatsapp_validado ?? true,
        direcciones: req.body.direcciones || existingUser?.direcciones || [],
        fecha_creacion: isNew ? new Date().toISOString() : existingUser!.fecha_creacion,
        perfil_chofer: perfil_chofer || existingUser?.perfil_chofer
      };

      await userDocRef.set(userObj);

      // If there is vehicle data and rol == CAMIONERO, register/update vehicle
      if (rol === "CAMIONERO" && vehiculo_data) {
        const vehQuery = await db.collection("vehiculos").where("chofer_id", "==", id).get();
        const hasVeh = !vehQuery.empty;
        const vehId = hasVeh ? vehQuery.docs[0].id : createEntityId("veh");

        const vehObj: Vehiculo = {
          id: vehId,
          chofer_id: id,
          chasis: {
            patente: vehiculo_data.chasis_patente || "AA000AA",
            marca: vehiculo_data.chasis_marca || "Genérica",
            modelo: vehiculo_data.chasis_modelo || "Modelo",
            vtv_vencimiento: vehiculo_data.chasis_vtv || "2027-01-01",
            seguro_vencimiento: vehiculo_data.chasis_seguro || "2027-01-01",
            estado_verificacion: "PENDIENTE",
            url_cedula_verde: "", // Reemplazar con URL de MinIO tras upload real
            url_poliza: "", // Reemplazar con URL de MinIO tras upload real
            url_vtv: "" // Reemplazar con URL de MinIO tras upload real
          },
          acoplado: {
            patente: vehiculo_data.acoplado_patente || "AB000CD",
            tipo_carroceria: vehiculo_data.acoplado_tipo || "TOLVA",
            vtv_vencimiento: vehiculo_data.acoplado_vtv || "2027-01-01",
            estado_verificacion: "PENDIENTE",
            url_cedula_titulo: "", // Reemplazar con URL de MinIO tras upload real
            url_vtv_acoplado: "" // Reemplazar con URL de MinIO tras upload real
          }
        };

        await db.collection("vehiculos").doc(vehId).set(vehObj);
      }

      res.json({ success: true, user: userObj });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Fallo al registrar/actualizar usuario en PostgreSQL" });
    }
  });

  // Approve/Reject User from Backoffice (KYC process)
  app.post("/api/usuarios/:id/approve", authMiddleware, async (req, res) => {
    if (!requireAdmin(req, res)) return;
    try {
      const { accion } = req.body; // "APROBAR" or "RECHAZAR"
      const userId = req.params.id!;
      const userDocRef = db.collection("usuarios").doc(userId);
      const userSnap = await userDocRef.get();

      if (!userSnap.exists) {
        return res.status(404).json({ error: "Usuario no encontrado" });
      }

      const estado_cuenta = accion === "APROBAR" ? "APROBADO" : "RECHAZADO";
      await userDocRef.update({ estado_cuenta, onboarding_completado: true });

      // Also update associated vehicle state
      const vehQuery = await db.collection("vehiculos").where("chofer_id", "==", userId).get();
      if (!vehQuery.empty) {
        const vehDocRef = vehQuery.docs[0].ref;
        const vehData = vehQuery.docs[0].data() as Vehiculo;
        const updatedChasis = { ...vehData.chasis, estado_verificacion: estado_cuenta };
        const updatedAcoplado = vehData.acoplado ? { ...vehData.acoplado, estado_verificacion: estado_cuenta } : undefined;

        await vehDocRef.update({
          chasis: updatedChasis,
          ...(updatedAcoplado ? { acoplado: updatedAcoplado } : {})
        });
      }

      const updatedUserSnap = await userDocRef.get();
      res.json({ success: true, user: updatedUserSnap.data() });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Fallo al aprobar usuario" });
    }
  });

  // Get Trips
  app.get("/api/viajes", authMiddleware, async (req, res) => {
    try {
      const trips = await getViajes();
      res.json(trips);
    } catch (err) {
      res.status(500).json({ error: "Error al consultar viajes" });
    }
  });

  // Publish load
  app.post("/api/viajes", authMiddleware, async (req, res) => {
    try {
      const authenticatedUser = (req as any).user as AuthTokenPayload;
      const { productor_id, tipo_grano, toneladas, tipo_carroceria_requerida, origen, destino, tarifa_por_tonelada, fecha_carga_pactada } = req.body;

      if (!productor_id || !tipo_grano || !toneladas || !origen || !destino || !tarifa_por_tonelada) {
        return res.status(400).json({ error: "Faltan datos obligatorios del viaje" });
      }

      // Validate positive numeric values
      const toneladasNum = Number(toneladas);
      const tarifaNum = Number(tarifa_por_tonelada);

      if (!Number.isFinite(toneladasNum) || toneladasNum <= 0 || toneladasNum > 100) {
        return res.status(400).json({ error: "Las toneladas deben ser un número positivo entre 1 y 100." });
      }
      if (!Number.isFinite(tarifaNum) || tarifaNum <= 0) {
        return res.status(400).json({ error: "La tarifa por tonelada debe ser un número positivo." });
      }

      // Validate enum values
      if (!(VALID_GRANOS as readonly string[]).includes(tipo_grano)) {
        return res.status(400).json({ error: `El tipo de grano debe ser uno de: ${VALID_GRANOS.join(", ")}.` });
      }
      if (tipo_carroceria_requerida && !(VALID_CARROCERIAS as readonly string[]).includes(tipo_carroceria_requerida)) {
        return res.status(400).json({ error: `La carrocería requerida debe ser una de: ${VALID_CARROCERIAS.join(", ")}.` });
      }

      // Validate address fields are not empty
      if (!origen.direccion || !destino.direccion) {
        return res.status(400).json({ error: "La dirección de origen y destino son obligatorias." });
      }

      // Validate coordinates
      const origenLat = Number(origen?.lat);
      const origenLng = Number(origen?.lng);
      const destinoLat = Number(destino?.lat);
      const destinoLng = Number(destino?.lng);
      if (!isValidCoordinate(origenLat, origenLng)) {
        return res.status(400).json({ error: "Las coordenadas de origen no son válidas (lat: -90 a 90, lng: -180 a 180)." });
      }
      if (!isValidCoordinate(destinoLat, destinoLng)) {
        return res.status(400).json({ error: "Las coordenadas de destino no son válidas (lat: -90 a 90, lng: -180 a 180)." });
      }

      // Validate fecha_carga_pactada is not in the past
      if (fecha_carga_pactada) {
        const fechaCarga = new Date(fecha_carga_pactada);
        const now = new Date();
        if (isNaN(fechaCarga.getTime())) {
          return res.status(400).json({ error: "La fecha de carga pactada no es una fecha válida." });
        }
        if (fechaCarga < now) {
          return res.status(400).json({ error: "La fecha de carga pactada no puede ser anterior a la fecha actual." });
        }
      }

      if (authenticatedUser.role !== "ADMIN" && authenticatedUser.id !== productor_id) {
        return res.status(403).json({ error: "No puede publicar viajes para otro productor" });
      }

      const productorSnap = await db.collection("usuarios").doc(productor_id).get();
      if (!productorSnap.exists) {
        return res.status(404).json({ error: "Productor no registrado" });
      }

      const productor = productorSnap.data() as Usuario;

      if (productor.rol !== "PRODUCTOR") {
        return res.status(403).json({ error: "Solo los productores pueden publicar cargas" });
      }

      if (productor.estado_cuenta !== "APROBADO") {
        return res.status(403).json({
          error: "CUENTA_NO_APROBADA",
          message: "Su cuenta aún no fue aprobada por el backoffice. Complete el onboarding y espere la validación."
        });
      }

      if (!productor.onboarding_completado) {
        return res.status(403).json({
          error: "ONBOARDING_INCOMPLETO",
          message: "Complete el perfil y la documentación legal antes de publicar cargas."
        });
      }

      const MAX_ACTIVE_TRIPS = 10;

      // Check if productor has reached the limit of active trips
      const activeTripsSnapshot = await db.collection("viajes").where("productor_id", "==", productor_id).get();
      const activeTripCount = activeTripsSnapshot.docs.filter((doc: any) => {
        const trip = doc.data() as Viaje;
        return ["DISPONIBLE", "ASIGNADO", "EN_CARGA", "EN_TRANSITO"].includes(trip.estado);
      }).length;
      if (activeTripCount >= MAX_ACTIVE_TRIPS) {
        return res.status(409).json({
          error: "LIMITE_VIAJES_ACTIVOS",
          message: `Ha alcanzado el límite de ${MAX_ACTIVE_TRIPS} viajes activos. Finalice o cancele viajes existentes antes de publicar nuevos.`
        });
      }

      // Check if productor has overdue unpaid commissions
      const hasOverdueCommission = activeTripsSnapshot.docs.some((doc: any) => {
        const trip = doc.data() as Viaje;
        if (trip.pago_publicacion_estado === "ABONADA") return false;
        const dueDate = trip.notificaciones_transaccion?.productor?.fecha_vencimiento;
        return dueDate && new Date(dueDate) < new Date();
      });
      if (hasOverdueCommission) {
        return res.status(403).json({
          error: "COMISION_VENCIDA",
          message: "Tiene comisiones vencidas impagas. Regularice su situación antes de publicar nuevas cargas."
        });
      }

      const nuevaFechaCarga = fecha_carga_pactada || new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
      const tarifasTotales = toneladasNum * tarifaNum;
      const publicationFee = Number((tarifasTotales * 0.03).toFixed(2));
      const transactionId = `TX-${createEntityId("pub").split("-").pop()?.toUpperCase()}`;
      const now = new Date().toISOString();
      const productorNotificationDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

      const nuevoViaje: Viaje = {
        id: createEntityId("viaje"),
        productor_id,
        chofer_id: null,
        tipo_grano,
        toneladas: toneladasNum,
        tipo_carroceria_requerida,
        origen,
        destino,
        tarifa_por_tonelada: tarifaNum,
        acuerdo_monto: tarifasTotales,
        numero_transaccion: transactionId,
        pago_publicacion_estado: "PENDIENTE",
        notificaciones_transaccion: {
          productor: {
            monto: publicationFee,
            fecha_vencimiento: productorNotificationDate,
            plazo_dias: 30,
            tipo: "PRODUCTOR",
            mensaje: `Comisión del 3% por publicación de carga. Depositar ${publicationFee.toLocaleString("es-AR", { style: "currency", currency: "ARS" })} antes del ${new Date(productorNotificationDate).toLocaleDateString("es-AR")} (30 días corridos).`,
            estado: "PENDIENTE"
          }
        },
        fecha_carga_pactada: nuevaFechaCarga,
        estado: "DISPONIBLE",
        fecha_creacion: now,
        fecha_actualizacion: now
      };

      await db.collection("viajes").doc(nuevoViaje.id).set(nuevoViaje);
      res.json({ success: true, viaje: nuevoViaje });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Error al publicar viaje" });
    }
  });

  // ── File upload helper ──────────────────────────────
  async function storeFile(file: Express.Multer.File, tripId: string, tipo: string): Promise<string> {
    return minioStoreFile(file.buffer, file.originalname, tripId!, tipo);
  }

  // POST /api/upload — generic multipart file upload
  app.post("/api/upload", authMiddleware, handleUpload("file"), async (req, res) => {
    try {
      const file = req.file;
      const { tripId, tipo } = req.body;

      if (!file) {
        return res.status(400).json({ error: "No se recibió archivo" });
      }
      if (!tripId || !tipo) {
        return res.status(400).json({ error: "Faltan tripId y/o tipo" });
      }

      const publicUrl = await storeFile(file, tripId, tipo);
      res.json({ success: true, storagePath: `comprobantes/${tripId}/${tipo}_${Date.now()}_${file.originalname}`, publicUrl });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Error al subir archivo" });
    }
  });

  // Middleware wrapper to catch multer errors and respond with JSON
  function handleUpload(fieldName: string) {
    const m = upload.single(fieldName);
    return (req: any, res: any, next: any) => {
      m(req, res, (err: any) => {
        if (err) {
          if (err instanceof multer.MulterError) {
            if (err.code === "LIMIT_FILE_SIZE") {
              return res.status(400).json({ error: `El archivo excede el tamaño máximo de ${MAX_FILE_SIZE_BYTES / (1024 * 1024)}MB` });
            }
            return res.status(400).json({ error: err.message });
          }
          if (err.message?.includes("Tipo de archivo no permitido")) {
            return res.status(400).json({ error: err.message });
          }
          return res.status(500).json({ error: err.message || "Error al procesar archivo" });
        }
        next();
      });
    };
  }

  app.post("/api/viajes/:id/comprobante", authMiddleware, handleUpload("file"), async (req, res) => {
    try {
      const authenticatedUser = (req as any).user as AuthTokenPayload;
      const tripId = req.params.id!!;
      const file = req.file;

      if (!file) {
        return res.status(400).json({ error: "No se recibió archivo" });
      }

      const viajeRef = db.collection("viajes").doc(tripId);
      const viajeSnap = await viajeRef.get();
      if (!viajeSnap.exists) {
        return res.status(404).json({ error: "Viaje no encontrado" });
      }

      const viaje = viajeSnap.data() as Viaje;
      if (authenticatedUser.role !== "ADMIN" && authenticatedUser.id !== viaje.productor_id) {
        return res.status(403).json({ error: "No puede subir comprobantes para esta carga" });
      }

      // Use transaction to prevent duplicate uploads (idempotency)
      const result = await db.runTransaction(async (transaction) => {
        const txSnap = await transaction.get(viajeRef);
        if (!txSnap.exists) {
          throw { status: 404, error: "Viaje no encontrado" };
        }
        const txViaje = txSnap.data() as Viaje;

        if (txViaje.pago_publicacion_estado === "ABONADA") {
          throw { status: 409, error: "La carga ya fue marcada como abonada" };
        }

        if (txViaje.comprobante_publicacion) {
          throw {
            status: 409,
            error: "COMPROBANTE_DUPLICADO",
            message: "Ya existe un comprobante pendiente de revisión. Espere la confirmación del administrador antes de reenviar."
          };
        }

        const publicUrl = await storeFile(file, tripId!, "publicacion");

        const comprobante_publicacion: ComprobantePublicacion = {
          fileName: file.originalname,
          mimeType: file.mimetype,
          storagePath: publicUrl,
          uploadedAt: new Date().toISOString(),
          uploadedBy: authenticatedUser.id
        };

        transaction.update(viajeRef, {
          comprobante_publicacion,
          pago_publicacion_estado: "PENDIENTE",
          fecha_actualizacion: new Date().toISOString()
        });
      });

      const updatedSnap = await viajeRef.get();
      res.json({ success: true, viaje: updatedSnap.data() });
    } catch (err: any) {
      if (err.status) {
        return res.status(err.status).json({ error: err.error, message: err.message });
      }
      console.error(err);
      res.status(500).json({ error: "Error al subir comprobante" });
    }
  });

  app.post("/api/viajes/:id/confirm-publicacion", authMiddleware, async (req, res) => {
    if (!requireAdmin(req, res)) return;

    try {
      const tripId = req.params.id!;
      const viajeRef = db.collection("viajes").doc(tripId);
      const viajeSnap = await viajeRef.get();

      if (!viajeSnap.exists) {
        return res.status(404).json({ error: "Viaje no encontrado" });
      }

      const viaje = viajeSnap.data() as Viaje;
      const updatedNotifications = viaje.notificaciones_transaccion
        ? {
            ...viaje.notificaciones_transaccion,
            productor: {
              ...viaje.notificaciones_transaccion.productor,
              estado: "COMPLETADO" as const
            }
          }
        : undefined;

      await viajeRef.update({
        pago_publicacion_estado: "ABONADA",
        ...(updatedNotifications ? { notificaciones_transaccion: updatedNotifications } : {}),
        fecha_actualizacion: new Date().toISOString()
      });

      const updatedSnap = await viajeRef.get();
      res.json({ success: true, viaje: updatedSnap.data() });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Error al confirmar pago de publicacion" });
    }
  });

  app.post("/api/viajes/:id/take", authMiddleware, async (req, res) => {
    const { chofer_id, simulate_race } = req.body;
    const tripId = req.params.id!;

    if (!chofer_id) {
      return res.status(400).json({ error: "Falta chofer_id" });
    }

    try {
      // Prevent driver from taking a trip if they already have an active one
      const activeTripsSnapshot = await db.collection("viajes").where("chofer_id", "==", chofer_id).get();
      const hasActiveTrip = activeTripsSnapshot.docs.some((doc: any) => {
        const trip = doc.data() as Viaje;
        return ["ASIGNADO", "EN_CARGA", "EN_TRANSITO"].includes(trip.estado);
      });
      if (hasActiveTrip) {
        return res.status(409).json({ error: "VIAJE_ACTIVO_EXISTENTE", message: "Ya tiene un viaje activo. Finalícelo o cancélelo antes de tomar otro." });
      }

      const result = await db.runTransaction(async (transaction) => {
        const choferRef = db.collection("usuarios").doc(chofer_id);
        const choferSnap = await transaction.get(choferRef);
        if (!choferSnap.exists) {
          throw { status: 404, error: "Chofer no registrado" };
        }
        const chofer = choferSnap.data() as Usuario;
        if (chofer.estado_cuenta !== "APROBADO") {
          throw { status: 403, error: "NO_APROBADO", message: "Su cuenta se encuentra PENDIENTE de aprobación por parte de la administración." };
        }

        const viajeRef = db.collection("viajes").doc(tripId);
        const viajeSnap = await transaction.get(viajeRef);
        if (!viajeSnap.exists) {
          throw { status: 404, error: "Viaje no encontrado" };
        }
        const viaje = viajeSnap.data() as Viaje;

        // If race simulation is checked, trigger a 60% random chance of race collision failure!
        if (simulate_race === true) {
          const raceFailed = Math.random() < 0.6;
          if (raceFailed) {
            // Mock a bot driver that got there first
            const botName = ["Ricardo Perez", "Juan Benitez", "Oscar Altieri", "Esteban Lopez"][Math.floor(Math.random() * 4)];
            const delayMs = Math.floor(Math.random() * 200) + 12;
            throw {
              status: 409,
              error: "RACE_CONDITION",
              message: `Fallo transaccional (runTransaction): El viaje ya fue tomado por otro transportista (${botName}) hace ${delayMs}ms. Se revocaron los cambios.`
            };
          }
        }

        if (viaje.estado !== "DISPONIBLE") {
          throw {
            status: 409,
            error: "NO_DISPONIBLE",
            message: "Este viaje ya no se encuentra disponible. Fue tomado por otro transportista."
          };
        }

        const tarifasTotales = viaje.toneladas * viaje.tarifa_por_tonelada;
        const commissionFee = Number((tarifasTotales * 0.03).toFixed(2));
        const camioneroNotificationDate = new Date(Date.now() + 40 * 24 * 60 * 60 * 1000).toISOString();
        const assignNow = new Date().toISOString();

        const updatedViaje = {
          ...viaje,
          estado: "ASIGNADO" as const,
          chofer_id: chofer_id,
          pago_comision_camionero_estado: "PENDIENTE" as const,
          notificaciones_transaccion: {
            ...viaje.notificaciones_transaccion,
            productor: viaje.notificaciones_transaccion!.productor,
            camionero: {
              monto: commissionFee,
              fecha_vencimiento: camioneroNotificationDate,
              plazo_dias: 40,
              tipo: "CAMIONERO" as const,
              mensaje: `Comisión del 3% por uso de plataforma. Depositar ${commissionFee.toLocaleString("es-AR", { style: "currency", currency: "ARS" })} antes del ${new Date(camioneroNotificationDate).toLocaleDateString("es-AR")} (40 días corridos).`,
              estado: "PENDIENTE" as const
            }
          },
          fecha_actualizacion: assignNow
        };

        transaction.set(viajeRef, updatedViaje);
        return updatedViaje;
      });

      res.json({ success: true, viaje: result });
    } catch (err: any) {
      if (err.status) {
        res.status(err.status).json({ error: err.error, message: err.message });
      } else {
        console.error(err);
        res.status(500).json({ error: "Fallo de conexión o error de transacción" });
      }
    }
  });

  app.post("/api/viajes/:id/comprobante-camionero", authMiddleware, handleUpload("file"), async (req, res) => {
    try {
      const authenticatedUser = (req as any).user as AuthTokenPayload;
      const tripId = req.params.id!!;
      const file = req.file;

      if (!file) {
        return res.status(400).json({ error: "No se recibió archivo" });
      }

      const viajeRef = db.collection("viajes").doc(tripId);
      const viajeSnap = await viajeRef.get();
      if (!viajeSnap.exists) {
        return res.status(404).json({ error: "Viaje no encontrado" });
      }

      const viaje = viajeSnap.data() as Viaje;
      if (authenticatedUser.role !== "ADMIN" && authenticatedUser.id !== viaje.chofer_id) {
        return res.status(403).json({ error: "No puede subir comprobantes para este viaje" });
      }

      // Use transaction to prevent duplicate uploads (idempotency)
      await db.runTransaction(async (transaction) => {
        const txSnap = await transaction.get(viajeRef);
        if (!txSnap.exists) {
          throw { status: 404, error: "Viaje no encontrado" };
        }
        const txViaje = txSnap.data() as Viaje;

        if (txViaje.pago_comision_camionero_estado === "ABONADA") {
          throw { status: 409, error: "La comisión ya fue marcada como abonada" };
        }

        if (txViaje.comprobante_comision_camionero) {
          throw {
            status: 409,
            error: "COMPROBANTE_DUPLICADO",
            message: "Ya existe un comprobante pendiente de revisión. Espere la confirmación del administrador antes de reenviar."
          };
        }

        const publicUrl = await storeFile(file, tripId, "comision_camionero");

        const comprobante_comision_camionero: ComprobantePublicacion = {
          fileName: file.originalname,
          mimeType: file.mimetype,
          storagePath: publicUrl,
          uploadedAt: new Date().toISOString(),
          uploadedBy: authenticatedUser.id
        };

        transaction.update(viajeRef, {
          comprobante_comision_camionero,
          fecha_actualizacion: new Date().toISOString()
        });
      });

      const updatedSnap = await viajeRef.get();
      res.json({ success: true, viaje: updatedSnap.data() });
    } catch (err: any) {
      if (err.status) {
        return res.status(err.status).json({ error: err.error, message: err.message });
      }
      console.error(err);
      res.status(500).json({ error: "Error al subir comprobante de comisión" });
    }
  });

  app.post("/api/viajes/:id/confirm-comision-camionero", authMiddleware, async (req, res) => {
    if (!requireAdmin(req, res)) return;

    try {
      const tripId = req.params.id!;
      const viajeRef = db.collection("viajes").doc(tripId);
      const viajeSnap = await viajeRef.get();

      if (!viajeSnap.exists) {
        return res.status(404).json({ error: "Viaje no encontrado" });
      }

      const viaje = viajeSnap.data() as Viaje;
      const updatedNotifications = viaje.notificaciones_transaccion?.camionero
        ? {
            ...viaje.notificaciones_transaccion,
            camionero: {
              ...viaje.notificaciones_transaccion.camionero,
              estado: "COMPLETADO" as const
            }
          }
        : viaje.notificaciones_transaccion;

      await viajeRef.update({
        pago_comision_camionero_estado: "ABONADA",
        ...(updatedNotifications ? { notificaciones_transaccion: updatedNotifications } : {}),
        fecha_actualizacion: new Date().toISOString()
      });

      const updatedSnap = await viajeRef.get();
      res.json({ success: true, viaje: updatedSnap.data() });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Error al confirmar comisión del transportista" });
    }
  });

  // Valid state machine for trip lifecycle
  const VALID_TRANSITIONS: Record<string, string[]> = {
    "ASIGNADO": ["EN_CARGA"],
    "EN_CARGA": ["EN_TRANSITO"],
    "EN_TRANSITO": ["ENTREGADO"],
    "DISPONIBLE": [],
    "CANCELADO": [],
    "ENTREGADO": []
  };

  // Quién puede ejecutar cada transición: "PRODUCTOR" | "CAMIONERO" | "AMBOS"
  const TRANSITION_AUTHORS: Record<string, "PRODUCTOR" | "CAMIONERO" | "AMBOS"> = {
    "EN_CARGA": "AMBOS",
    "EN_TRANSITO": "AMBOS",
    "ENTREGADO": "PRODUCTOR"
  };

  // Step trip state through the cycle (EN_CARGA, EN_TRANSITO, ENTREGADO)
  app.post("/api/viajes/:id/step", authMiddleware, async (req, res) => {
    const { next_state } = req.body;
    const tripId = req.params.id!;
    const authenticatedUser = (req as any).user as AuthTokenPayload;

    try {
      const result = await db.runTransaction(async (transaction) => {
        const viajeRef = db.collection("viajes").doc(tripId);
        const viajeSnap = await transaction.get(viajeRef);
        if (!viajeSnap.exists) {
          throw { status: 404, error: "Viaje no encontrado" };
        }
        const currentViaje = viajeSnap.data() as Viaje;

        // Validate that the current state allows transitions
        const allowedNextStates = VALID_TRANSITIONS[currentViaje.estado];
        if (!allowedNextStates) {
          throw { status: 400, error: `El estado '${currentViaje.estado}' no es válido para transiciones.` };
        }
        if (allowedNextStates.length === 0) {
          throw { status: 400, error: `No se puede avanzar desde el estado '${currentViaje.estado}'. El viaje está finalizado.` };
        }
        if (!allowedNextStates.includes(next_state)) {
          throw {
            status: 400,
            error: `Transición inválida: de '${currentViaje.estado}' a '${next_state}'. Las transiciones permitidas son: ${allowedNextStates.join(", ")}`
          };
        }

        // Validate that the user is authorized for this transition
        const requiredRole = TRANSITION_AUTHORS[next_state];
        if (requiredRole) {
          const isProductor = authenticatedUser.id === currentViaje.productor_id;
          const isCamionero = authenticatedUser.id === currentViaje.chofer_id;
          const isAdmin = authenticatedUser.role === "ADMIN";

          if (requiredRole === "PRODUCTOR" && !isProductor && !isAdmin) {
            throw { status: 403, error: "Solo el productor del viaje puede registrar la descarga." };
          }

          if (requiredRole === "AMBOS" && !isProductor && !isCamionero && !isAdmin) {
            throw { status: 403, error: "Solo el productor o el transportista asignado pueden actualizar este viaje." };
          }
        }

        const updatedViaje = {
          ...currentViaje,
          estado: next_state,
          fecha_actualizacion: new Date().toISOString()
        };

        transaction.set(viajeRef, updatedViaje);
        return updatedViaje;
      });

      res.json({ success: true, viaje: result });
    } catch (err: any) {
      if (err.status) {
        res.status(err.status).json({ error: err.error, message: err.message });
      } else {
        console.error(err);
        res.status(500).json({ error: "Error de transacción al actualizar estado de viaje" });
      }
    }
  });

  // Cancel load
  app.post("/api/viajes/:id/cancel", authMiddleware, async (req, res) => {
    const { cancelador_id, motivo, detalle } = req.body;
    const tripId = req.params.id!;
    const authenticatedUser = (req as any).user as AuthTokenPayload;

    if (!cancelador_id) {
      return res.status(400).json({ error: "Falta el identificador del usuario que solicita la cancelación." });
    }

    try {
      const result = await db.runTransaction(async (transaction) => {
        const viajeRef = db.collection("viajes").doc(tripId);
        const viajeSnap = await transaction.get(viajeRef);
        if (!viajeSnap.exists) {
          throw { status: 404, error: "Viaje no encontrado" };
        }
        const viaje = viajeSnap.data() as Viaje;
        if (viaje.estado === "CANCELADO" || viaje.estado === "ENTREGADO") {
          throw { status: 400, error: "No se puede cancelar un viaje finalizado o ya cancelado." };
        }

        // Validate that only the productor or assigned camionero can cancel
        const isProductorOwner = viaje.productor_id === cancelador_id;
        const isCamioneroOwner = viaje.chofer_id !== null && viaje.chofer_id === cancelador_id;
        const isAdmin = authenticatedUser.role === "ADMIN";

        if (!isProductorOwner && !isCamioneroOwner && !isAdmin) {
          throw {
            status: 403,
            error: "No autorizado. Solo el productor que publicó la carga o el transportista asignado pueden cancelar este viaje."
          };
        }

        // Verify that the cancelador user exists
        const canceladorRef = db.collection("usuarios").doc(cancelador_id);
        const canceladorSnap = await transaction.get(canceladorRef);
        if (!canceladorSnap.exists) {
          throw { status: 404, error: "Usuario cancelador no encontrado" };
        }

        const updatedViaje = {
          ...viaje,
          estado: "CANCELADO" as const,
          fecha_actualizacion: new Date().toISOString()
        };
        transaction.set(viajeRef, updatedViaje);

        // Generar penalidad según quien cancela
        let penalidad: any = null;
        const shouldPenalize = (isProductorOwner && viaje.chofer_id) || isCamioneroOwner;
        if (shouldPenalize) {
          const monto_total = Number(viaje.acuerdo_monto || viaje.toneladas * viaje.tarifa_por_tonelada);
          const deudor_id = cancelador_id;
          const beneficiario_id = isProductorOwner ? viaje.chofer_id! : viaje.productor_id;
          penalidad = {
            id: randomUUID(),
            viaje_id: tripId,
            solicitante_cancelacion_id: cancelador_id,
            usuario_deudor_id: deudor_id,
            usuario_beneficiario_id: beneficiario_id,
            monto_penalidad: Number((monto_total * 0.10).toFixed(2)),
            motivo: motivo || "Cancelación de viaje",
            detalle_justificacion: detalle || undefined,
            estado_pago: "PENDIENTE" as const,
            fecha_cancelacion: new Date().toISOString(),
            fecha_creacion: new Date().toISOString()
          };
          const penalidadRef = db.collection("penalidades_cuenta_corriente").doc(penalidad.id);
          transaction.set(penalidadRef, penalidad);
        }

        return { viaje: updatedViaje, penalidad };
      });

      res.json({
        success: true,
        viaje: result.viaje,
        penalidad: result.penalidad,
        detalle: "Cancelación registrada. Los pagos del flete se acuerdan directamente entre las partes."
      });
    } catch (err: any) {
      if (err.status) {
        res.status(err.status).json({ error: err.error, message: err.message });
      } else {
        console.error(err);
        res.status(500).json({ error: "Error cancelando viaje" });
      }
    }
  });

  // Penalidades endpoint
  app.get("/api/penalidades", authMiddleware, async (req, res) => {
    try {
      const authenticatedUser = (req as any).user as AuthTokenPayload;
      let query: any = db.collection("penalidades_cuenta_corriente");
      if (authenticatedUser.role !== "ADMIN") {
        query = query.where("usuario_deudor_id", "==", authenticatedUser.id);
      }
      const snap = await query.get();
      const penalidades = snap.docs.map((d: any) => d.data());
      res.json({ success: true, penalidades });
    } catch (err) {
      console.error("Error obteniendo penalidades:", err);
      res.status(500).json({ error: "Error obteniendo penalidades" });
    }
  });

  // Serve local uploads for fallback storage
  app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

  // Vite integration
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  if (!process.env.VITEST) {
    app.listen(PORT, "0.0.0.0", () => {
      const dbType = process.env.DATABASE_URL ? "PostgreSQL" : "in-memory fallback";
      console.log(`[AgroFlet Server] Running on http://0.0.0.0:${PORT} (db: ${dbType})`);
    });
  }
}

if (!process.env.VITEST) {
  startServer().catch((err) => {
    console.error("Failed to start server:", err);
  });
}

export { startServer, resetDatabase };

import { pgTable, uuid, varchar, boolean, jsonb, timestamp, numeric, text } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  telefono: varchar("telefono", { length: 20 }).notNull(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  passwordHash: varchar("password_hash", { length: 255 }),
  rol: varchar("rol", { length: 20 }).notNull(),
  cuit: varchar("cuit", { length: 11 }).notNull(),
  razonSocial: varchar("razon_social", { length: 255 }).notNull().default("Empresa Agro"),
  condicionIva: varchar("condicion_iva", { length: 50 }).notNull().default("RESPONSABLE_INSCRIPTO"),
  domicilioFiscal: text("domicilio_fiscal").notNull().default("Dirección Fiscal S/N"),
  estadoCuenta: varchar("estado_cuenta", { length: 20 }).notNull().default("PENDIENTE"),
  onboardingCompletado: boolean("onboarding_completado").default(false),
  tokenWhatsappValidado: boolean("token_whatsapp_validado").default(true),
  direcciones: jsonb("direcciones").default([]),
  perfilChofer: jsonb("perfil_chofer"),
  fechaCreacion: timestamp("fecha_creacion").defaultNow(),
});

export const vehicles = pgTable("vehicles", {
  id: uuid("id").primaryKey().defaultRandom(),
  choferId: uuid("chofer_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  chasis: jsonb("chasis").notNull(),
  acoplado: jsonb("acoplado"),
  fechaCreacion: timestamp("fecha_creacion").defaultNow(),
});

export const trips = pgTable("trips", {
  id: uuid("id").primaryKey().defaultRandom(),
  productorId: uuid("productor_id").notNull().references(() => users.id),
  choferId: uuid("chofer_id").references(() => users.id),
  tipoGrano: varchar("tipo_grano", { length: 20 }).notNull(),
  toneladas: numeric("toneladas", { precision: 10, scale: 2 }).notNull(),
  tipoCarroceriaRequerida: varchar("tipo_carroceria_requerida", { length: 30 }),
  origen: jsonb("origen").notNull(),
  destino: jsonb("destino").notNull(),
  tarifaPorTonelada: numeric("tarifa_por_tonelada", { precision: 12, scale: 2 }).notNull(),
  acuerdoMonto: numeric("acuerdo_monto", { precision: 12, scale: 2 }),
  numeroTransaccion: varchar("numero_transaccion", { length: 50 }),
  pagoPublicacionEstado: varchar("pago_publicacion_estado", { length: 20 }).default("PENDIENTE"),
  comprobantePublicacion: jsonb("comprobante_publicacion"),
  pagoComisionCamioneroEstado: varchar("pago_comision_camionero_estado", { length: 20 }),
  comprobanteComisionCamionero: jsonb("comprobante_comision_camionero"),
  notificacionesTransaccion: jsonb("notificaciones_transaccion"),
  fechaCargaPactada: timestamp("fecha_carga_pactada"),
  estado: varchar("estado", { length: 20 }).notNull().default("DISPONIBLE"),
  fechaCreacion: timestamp("fecha_creacion").defaultNow(),
  fechaActualizacion: timestamp("fecha_actualizacion").defaultNow(),
});

export const penalties = pgTable("penalties", {
  id: uuid("id").primaryKey().defaultRandom(),
  viajeId: uuid("viaje_id").notNull().references(() => trips.id),
  solicitanteCancelacionId: uuid("solicitante_cancelacion_id").notNull().references(() => users.id),
  usuarioDeudorId: uuid("usuario_deudor_id").notNull().references(() => users.id),
  usuarioBeneficiarioId: uuid("usuario_beneficiario_id").notNull().references(() => users.id),
  montoPenalidad: numeric("monto_penalidad", { precision: 12, scale: 2 }).notNull(),
  motivo: text("motivo").notNull(),
  detalleJustificacion: text("detalle_justificacion"),
  estadoPago: varchar("estado_pago", { length: 20 }).notNull().default("PENDIENTE"),
  fechaCancelacion: timestamp("fecha_cancelacion").notNull(),
  fechaCreacion: timestamp("fecha_creacion").defaultNow(),
});

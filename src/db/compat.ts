import { eq, and } from "drizzle-orm";
import { db } from "./connection";
import * as schema from "./drizzle-schema";
import type { PgTable } from "drizzle-orm/pg-core";

// ── Helpers ──────────────────────────────────────────

type TableMap = {
  usuarios: typeof schema.users;
  vehiculos: typeof schema.vehicles;
  viajes: typeof schema.trips;
  penalidades_cuenta_corriente: typeof schema.penalties;
};

const tableMap: Record<string, PgTable> = {
  usuarios: schema.users,
  vehiculos: schema.vehicles,
  viajes: schema.trips,
  penalidades_cuenta_corriente: schema.penalties,
};

/** Convert snake_case Firestore field names to camelCase Drizzle column names */
function toColumnName(table: PgTable, field: string): string {
  const map: Record<string, string> = {
    "id": "id",
    "telefono": "telefono",
    "email": "email",
    "passwordHash": "passwordHash",
    "rol": "rol",
    "cuit": "cuit",
    "razon_social": "razonSocial",
    "condicion_iva": "condicionIva",
    "domicilio_fiscal": "domicilioFiscal",
    "estado_cuenta": "estadoCuenta",
    "onboarding_completado": "onboardingCompletado",
    "token_whatsapp_validado": "tokenWhatsappValidado",
    "direcciones": "direcciones",
    "perfil_chofer": "perfilChofer",
    "fecha_creacion": "fechaCreacion",
    "chofer_id": "choferId",
    "chasis": "chasis",
    "acoplado": "acoplado",
    "productor_id": "productorId",
    "tipo_grano": "tipoGrano",
    "toneladas": "toneladas",
    "tipo_carroceria_requerida": "tipoCarroceriaRequerida",
    "origen": "origen",
    "destino": "destino",
    "tarifa_por_tonelada": "tarifaPorTonelada",
    "acuerdo_monto": "acuerdoMonto",
    "numero_transaccion": "numeroTransaccion",
    "pago_publicacion_estado": "pagoPublicacionEstado",
    "comprobante_publicacion": "comprobantePublicacion",
    "pago_comision_camionero_estado": "pagoComisionCamioneroEstado",
    "comprobante_comision_camionero": "comprobanteComisionCamionero",
    "notificaciones_transaccion": "notificacionesTransaccion",
    "fecha_carga_pactada": "fechaCargaPactada",
    "estado": "estado",
    "fecha_actualizacion": "fechaActualizacion",
    "viaje_id": "viajeId",
    "solicitante_cancelacion_id": "solicitanteCancelacionId",
    "usuario_deudor_id": "usuarioDeudorId",
    "usuario_beneficiario_id": "usuarioBeneficiarioId",
    "monto_penalidad": "montoPenalidad",
    "motivo": "motivo",
    "detalle_justificacion": "detalleJustificacion",
    "estado_pago": "estadoPago",
    "fecha_cancelacion": "fechaCancelacion",
  };
  return map[field] || field;
}

// ── DocRef ───────────────────────────────────────────

interface DocRef {
  id: string;
  get(): Promise<{ exists: boolean; data(): any }>;
  set(data: any): Promise<void>;
  update(data: any): Promise<void>;
  delete(): Promise<void>;
}

// ── CollectionRef ────────────────────────────────────

interface CollectionRef {
  doc(id: string): DocRef;
  where(field: string, op: string, value: any): CollectionRef;
  get(): Promise<{ docs: DocRef[]; empty: boolean }>;
  limit(n: number): CollectionRef;
}

// ── Transaction proxy (for runTransaction) ──────────

interface TxRef {
  id: string;
  colName: string;
}

interface TxAdapter {
  get(ref: TxRef): Promise<{ exists: boolean; data(): any }>;
  set(ref: TxRef, data: any): void;
  update(ref: TxRef, data: any): void;
}

// ── Batch ────────────────────────────────────────────

interface BatchAdapter {
  delete(ref: any): void;
  commit(): Promise<void>;
}

// ── DB Adapter ───────────────────────────────────────

export const dbCompat = {
  collection(colName: string): CollectionRef {
    const table = tableMap[colName];
    if (!table) throw new Error(`Unknown collection: ${colName}`);

    let whereField: string | null = null;
    let whereOp: string | null = null;
    let whereValue: any = null;
    let limitValue: number | null = null;

    const runQuery = async () => {
      let query = db.select().from(table as any) as any;

      if (whereField && whereOp === "==") {
        const col = toColumnName(table, whereField);
        query = query.where(eq((table as any)[col], whereValue));
      }

      if (limitValue !== null) {
        query = query.limit(limitValue);
      }

      const rows = await query;
      return rows;
    };

    const toDocRef = (row: any): DocRef => ({
      id: row?.id,
      get: async () => ({
        exists: !!row,
        data: () => row || null,
      }),
      set: async () => {},
      update: async () => {},
      delete: async () => {},
    });

    return {
      doc(id: string): DocRef {
        return {
          id,
          async get() {
            const rows = await db.select().from(table as any).where(eq((table as any).id, id)).limit(1);
            const row = rows[0] || null;
            return { exists: !!row, data: () => row };
          },
          async set(data: any) {
            const exists = await this.get();
            if (exists.exists) {
              await db.update(table as any).set(data).where(eq((table as any).id, id));
            } else {
              await db.insert(table as any).values({ ...data, id });
            }
          },
          async update(data: any) {
            const mapped: any = {};
            for (const [key, val] of Object.entries(data)) {
              const col = toColumnName(table, key);
              (mapped as any)[col] = val;
            }
            await db.update(table as any).set(mapped).where(eq((table as any).id, id));
          },
          async delete() {
            await db.delete(table as any).where(eq((table as any).id, id));
          },
        };
      },

      where(field: string, op: string, value: any): CollectionRef {
        whereField = field;
        whereOp = op;
        whereValue = value;
        return this;
      },

      limit(n: number): CollectionRef {
        limitValue = n;
        return this;
      },

      async get() {
        const rows = await runQuery();
        const docs = rows.map((row: any) => ({
          id: row.id,
          ref: { id: row.id, colName } as TxRef,
          data: () => row,
          exists: true,
        }));
        return { docs, empty: docs.length === 0 };
      },
    };
  },

  async runTransaction<T>(updateFunction: (tx: TxAdapter) => Promise<T>): Promise<T> {
    return await db.transaction(async (txDrizzle) => {
      const txAdapter: TxAdapter = {
        async get(ref: TxRef) {
          const table = tableMap[ref.colName];
          if (!table) throw new Error(`Unknown collection: ${ref.colName}`);
          const rows = await txDrizzle.select().from(table as any).where(eq((table as any).id, ref.id)).limit(1);
          const row = rows[0] || null;
          return { exists: !!row, data: () => row };
        },
        set(ref: TxRef, data: any) {
          const table = tableMap[ref.colName];
          if (!table) throw new Error(`Unknown collection: ${ref.colName}`);
          txDrizzle.insert(table as any).values({ ...data, id: ref.id }).then(() => {});
        },
        update(ref: TxRef, data: any) {
          const table = tableMap[ref.colName];
          if (!table) throw new Error(`Unknown collection: ${ref.colName}`);
          const mapped: any = {};
          for (const [key, val] of Object.entries(data)) {
            const col = toColumnName(table, key);
            (mapped as any)[col] = val;
          }
          txDrizzle.update(table as any).set(mapped).where(eq((table as any).id, ref.id)).then(() => {});
        },
      };
      return await updateFunction(txAdapter);
    });
  },

  batch(): BatchAdapter {
    const deletes: Array<{ colName: string; id: string }> = [];
    return {
      delete(ref: any) {
        deletes.push({ colName: ref.colName || ref.ref?.colName, id: ref.id || ref.ref?.id });
      },
      async commit() {
        for (const item of deletes) {
          const table = tableMap[item.colName];
          if (table) {
            await db.delete(table as any).where(eq((table as any).id, item.id));
          }
        }
      },
    };
  },
};

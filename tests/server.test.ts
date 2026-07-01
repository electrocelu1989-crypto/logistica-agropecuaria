import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { startServer, app, resetDatabase } from "../server";
import type express from "express";
import request from "supertest";

let r: any;

beforeAll(async () => {
  await startServer();
  r = request(app as express.Express);
}, 30000);

beforeEach(async () => {
  await resetDatabase();
});

// ── Helpers ──────────────────────────────────────────
/** 10-digit prefix → full 11-digit CUIT with valid checksum */
function validCuit(prefix: string): string {
  const d = prefix.split("").map(Number);
  const w = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
  let sum = 0;
  for (let i = 0; i < 10; i++) sum += (d[i] ?? 0) * (w[i] ?? 0);
  let ck = 11 - (sum % 11);
  if (ck === 11) ck = 0;
  if (ck === 10) ck = 9;
  return prefix + ck;
}

const CUIT_PREFIX = {
  admin: "2012345678",
  productor: "2023456789",
  camionero: "2034567890",
} as const;

function cuit(role: keyof typeof CUIT_PREFIX): string {
  return validCuit(CUIT_PREFIX[role]);
}

function makeDataUrl(mime: string, sizeBytes: number): string {
  const raw = "A".repeat(Math.ceil((sizeBytes * 4) / 3));
  return `data:${mime};base64,${Buffer.from(raw).toString("base64")}`;
}

async function register(
  email: string,
  rol: "PRODUCTOR" | "CAMIONERO" | "ADMIN",
  overrides: Record<string, any> = {}
) {
  const key = rol.toLowerCase() as keyof typeof CUIT_PREFIX;
  return await r.post("/api/auth/register").send({
    email,
    password: "pass123",
    rol,
    cuit: cuit(key),
    telefono: "1111111111",
    razon_social: `${rol} Test SRL`,
    condicion_iva: "RESPONSABLE_INSCRIPTO",
    domicilio_fiscal: "Av. Test 123",
    ...overrides,
  });
}

async function login(email: string) {
  const res = await r.post("/api/auth/login").send({ email, password: "pass123" });
  const cookies = res.headers["set-cookie"] as unknown as string[] | undefined;
  const authCookie = cookies?.find((c: string) => c.startsWith("auth_token="));
  const token = authCookie?.split(";")[0]?.replace("auth_token=", "");
  return { res, token };
}

async function createTrip(token: string, overrides: Record<string, any> = {}) {
  return await r
    .post("/api/viajes")
    .set("Authorization", `Bearer ${token}`)
    .send({
      productor_id: "to-fill",
      tipo_grano: "SOJA",
      toneladas: 20,
      tipo_carroceria_requerida: "TOLVA",
      origen: {
        direccion: "Campo Sur, Ruta 3 Km 120",
        lat: -33.456,
        lng: -60.123,
        geohash: "m9g8h7j6k5",
      },
      destino: {
        direccion: "Puerto Rosario, Av. Costanera 500",
        lat: -32.941,
        lng: -60.703,
      },
      tarifa_por_tonelada: 5000,
      fecha_carga_pactada: new Date(Date.now() + 86400000 * 2).toISOString(),
      ...overrides,
    });
}

async function approveUser(token: string, userId: string) {
  return await r
    .post(`/api/usuarios/${userId}/approve`)
    .set("Authorization", `Bearer ${token}`)
    .send({ accion: "APROBAR" });
}

// ── Auth & Validation ───────────────────────────────
describe("Auth & Validation", () => {
  it("register with valid data returns 200", async () => {
    const res = await register("prod@test.com", "PRODUCTOR");
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it("register with invalid CUIT returns 400", async () => {
    const res = await r.post("/api/auth/register").send({
      email: "badcuit@test.com",
      password: "pass123",
      rol: "PRODUCTOR",
      cuit: "30123456789",
      telefono: "1111111111",
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/CUIT/i);
  });

  it("register with invalid email returns 400", async () => {
    const res = await r.post("/api/auth/register").send({
      email: "not-an-email",
      password: "pass123",
      rol: "PRODUCTOR",
      cuit: cuit("productor"),
      telefono: "1111111111",
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/email/i);
  });

  it("register duplicate email returns 409", async () => {
    await register("dup@test.com", "PRODUCTOR");
    const res = await register("dup@test.com", "CAMIONERO");
    expect(res.status).toBe(409);
  });
});

// ── Trip Publishing ─────────────────────────────────
describe("Trip Publishing (#15, #17, #18, #19, #21, #29)", () => {
  let prodToken: string;
  let prodId: string;
  let adminToken: string;

  beforeEach(async () => {
    await resetDatabase();
    const prodRes = await register("prod@test.com", "PRODUCTOR");
    prodId = prodRes.body.user.id;
    prodToken = (await login("prod@test.com")).token!;

    const adminRes = await register("admin@test.com", "ADMIN");
    adminToken = (await login("admin@test.com")).token!;
    await approveUser(adminToken, prodId);
  });

  it("publish with valid data returns 200", async () => {
    const res = await createTrip(prodToken, { productor_id: prodId });
    expect(res.status).toBe(200);
    expect(res.body.viaje).toBeDefined();
  });

  it("rejects negative toneladas (#17)", async () => {
    const res = await createTrip(prodToken, { toneladas: -5, productor_id: prodId });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/toneladas/i);
  });

  it("rejects zero tarifa (#17)", async () => {
    const res = await createTrip(prodToken, { tarifa_por_tonelada: 0, productor_id: prodId });
    expect(res.status).toBe(400);
  });

  it("rejects invalid tipo_grano (#18)", async () => {
    const res = await createTrip(prodToken, { tipo_grano: "AVENA", productor_id: prodId });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/grano/i);
  });

  it("rejects invalid carroceria (#18)", async () => {
    const res = await createTrip(prodToken, { tipo_carroceria_requerida: "CAMION", productor_id: prodId });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/carrocer/i);
  });

  it("rejects past fecha_carga_pactada (#19)", async () => {
    const res = await createTrip(prodToken, {
      fecha_carga_pactada: new Date(Date.now() - 86400000).toISOString(),
      productor_id: prodId,
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/fecha/i);
  });

  it("rejects invalid lat (#21)", async () => {
    const res = await createTrip(prodToken, {
      origen: { direccion: "Origen", lat: 200, lng: -60.123 },
      productor_id: prodId,
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/coordenadas/i);
  });

  it("rejects empty address (#29)", async () => {
    const res = await createTrip(prodToken, {
      origen: { direccion: "", lat: -33.456, lng: -60.123 },
      productor_id: prodId,
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/dirección/i);
  });

  it("rejects when limit of active trips reached (#15)", async () => {
    for (let i = 0; i < 10; i++) {
      const r2 = await createTrip(prodToken, { productor_id: prodId });
      expect(r2.status).toBe(200);
    }
    const res = await createTrip(prodToken, { productor_id: prodId });
    expect(res.status).toBe(409);
    expect(res.body.error).toBe("LIMITE_VIAJES_ACTIVOS");
  });
});

// ── Take Trip ───────────────────────────────────────
describe("Take Trip (#11)", () => {
  let prodToken: string;
  let camToken: string;
  let adminToken: string;
  let prodId: string;
  let camId: string;

  beforeEach(async () => {
    await resetDatabase();
    const p = await register("prod@test.com", "PRODUCTOR");
    prodId = p.body.user.id;
    prodToken = (await login("prod@test.com")).token!;

    await register("admin@test.com", "ADMIN");
    adminToken = (await login("admin@test.com")).token!;
    await approveUser(adminToken, prodId);

    const camRes = await register("cam@test.com", "CAMIONERO");
    camId = camRes.body.user.id;
    camToken = (await login("cam@test.com")).token!;
    await approveUser(adminToken, camId);
  });

  it("allows taking an available trip", async () => {
    const trip = await createTrip(prodToken, { productor_id: prodId });
    const tripId = trip.body.viaje.id;
    const res = await r
      .post(`/api/viajes/${tripId}/take`)
      .set("Authorization", `Bearer ${camToken}`)
      .send({ chofer_id: camId });
    expect(res.status).toBe(200);
  });

  it("rejects taking a second trip when one is active (#11)", async () => {
    const t1 = await createTrip(prodToken, { productor_id: prodId });
    await r.post(`/api/viajes/${t1.body.viaje.id}/take`).set("Authorization", `Bearer ${camToken}`).send({ chofer_id: camId });

    const t2 = await createTrip(prodToken, { productor_id: prodId });
    const res = await r
      .post(`/api/viajes/${t2.body.viaje.id}/take`)
      .set("Authorization", `Bearer ${camToken}`)
      .send({ chofer_id: camId });
    expect(res.status).toBe(409);
    expect(res.body.error).toBe("VIAJE_ACTIVO_EXISTENTE");
  });
});

// ── State Machine ───────────────────────────────────
describe("State Machine (#10)", () => {
  let prodToken: string;
  let camToken: string;
  let adminToken: string;
  let prodId: string;
  let camId: string;
  let unrelatedToken: string;
  let tripId: string;

  beforeEach(async () => {
    await resetDatabase();
    const p = await register("prod@test.com", "PRODUCTOR");
    prodId = p.body.user.id;
    prodToken = (await login("prod@test.com")).token!;

    await register("admin@test.com", "ADMIN");
    adminToken = (await login("admin@test.com")).token!;
    await approveUser(adminToken, prodId);

    const camRes = await register("cam@test.com", "CAMIONERO");
    camId = camRes.body.user.id;
    camToken = (await login("cam@test.com")).token!;
    await approveUser(adminToken, camId);

    await register("unrelated@test.com", "PRODUCTOR");
    unrelatedToken = (await login("unrelated@test.com")).token!;

    const trip = await createTrip(prodToken, { productor_id: prodId });
    tripId = trip.body.viaje.id;
    // Assign to camionero → estado goes from DISPONIBLE to ASIGNADO
    await r.post(`/api/viajes/${tripId}/take`).set("Authorization", `Bearer ${camToken}`).send({ chofer_id: camId });
  });

  it("follows valid ASIGNADO→EN_CARGA→EN_TRANSITO→ENTREGADO", async () => {
    const s1 = await r.post(`/api/viajes/${tripId}/step`).set("Authorization", `Bearer ${camToken}`).send({ next_state: "EN_CARGA" });
    expect(s1.status).toBe(200);
    expect(s1.body.viaje.estado).toBe("EN_CARGA");

    const s2 = await r.post(`/api/viajes/${tripId}/step`).set("Authorization", `Bearer ${camToken}`).send({ next_state: "EN_TRANSITO" });
    expect(s2.status).toBe(200);
    expect(s2.body.viaje.estado).toBe("EN_TRANSITO");

    // Only productor can confirm delivery (ENTREGADO)
    const s3 = await r.post(`/api/viajes/${tripId}/step`).set("Authorization", `Bearer ${prodToken}`).send({ next_state: "ENTREGADO" });
    expect(s3.status).toBe(200);
    expect(s3.body.viaje.estado).toBe("ENTREGADO");
  });

  it("rejects invalid transition (ASIGNADO→ENTREGADO)", async () => {
    const res = await r.post(`/api/viajes/${tripId}/step`).set("Authorization", `Bearer ${camToken}`).send({ next_state: "ENTREGADO" });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/transición/i);
  });

  it("rejects step from unauthorized actor", async () => {
    // unrelated user (not productor, not camionero, not admin) cannot step
    const res = await r.post(`/api/viajes/${tripId}/step`).set("Authorization", `Bearer ${unrelatedToken}`).send({ next_state: "EN_CARGA" });
    expect(res.status).toBe(403);
  });
});

// ── Cancel Trip ─────────────────────────────────────
describe("Cancel Trip (#13)", () => {
  let prodToken: string;
  let prodId: string;
  let adminToken: string;
  let adminId: string;
  let otherToken: string;
  let otherId: string;
  let tripId: string;

  beforeEach(async () => {
    await resetDatabase();
    const p = await register("prod@test.com", "PRODUCTOR");
    prodId = p.body.user.id;
    prodToken = (await login("prod@test.com")).token!;

    const a = await register("admin@test.com", "ADMIN");
    adminId = a.body.user.id;
    adminToken = (await login("admin@test.com")).token!;
    await approveUser(adminToken, prodId);

    await register("cam@test.com", "CAMIONERO");

    const o = await register("other@test.com", "PRODUCTOR");
    otherId = o.body.user.id;
    otherToken = (await login("other@test.com")).token!;

    const trip = await createTrip(prodToken, { productor_id: prodId });
    tripId = trip.body.viaje.id;
  });

  it("productor can cancel their own trip", async () => {
    const res = await r.post(`/api/viajes/${tripId}/cancel`).set("Authorization", `Bearer ${prodToken}`).send({ cancelador_id: prodId });
    expect(res.status).toBe(200);
  });

  it("unrelated user cannot cancel", async () => {
    const res = await r.post(`/api/viajes/${tripId}/cancel`).set("Authorization", `Bearer ${otherToken}`).send({ cancelador_id: otherId });
    expect(res.status).toBe(403);
  });

  it("admin can cancel any trip", async () => {
    const res = await r.post(`/api/viajes/${tripId}/cancel`).set("Authorization", `Bearer ${adminToken}`).send({ cancelador_id: adminId });
    expect(res.status).toBe(200);
  });
});

// ── Comprobantes ────────────────────────────────────
describe("Comprobantes (#12, #24, #25)", () => {
  let prodToken: string;
  let prodId: string;
  let adminToken: string;
  let tripId: string;

  beforeEach(async () => {
    await resetDatabase();
    const p = await register("prod@test.com", "PRODUCTOR");
    prodId = p.body.user.id;
    prodToken = (await login("prod@test.com")).token!;

    await register("admin@test.com", "ADMIN");
    adminToken = (await login("admin@test.com")).token!;
    await approveUser(adminToken, prodId);

    const trip = await createTrip(prodToken, { productor_id: prodId });
    tripId = trip.body.viaje.id;
  });

  function attachFile(buf: Buffer, filename: string, contentType: string) {
    return r
      .post(`/api/viajes/${tripId}/comprobante`)
      .set("Authorization", `Bearer ${prodToken}`)
      .attach("file", buf, { filename, contentType });
  }

  it("uploads valid comprobante (#24)", async () => {
    const res = await attachFile(Buffer.alloc(1024, "A"), "pago.pdf", "application/pdf");
    expect(res.status).toBe(200);
  });

  it("rejects invalid mime type (#24)", async () => {
    const res = await attachFile(Buffer.alloc(1024, "A"), "virus.exe", "application/x-msdownload");
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/archivo/i);
  });

  it("rejects oversized file (#25)", async () => {
    const res = await attachFile(Buffer.alloc(6 * 1024 * 1024, "A"), "grande.pdf", "application/pdf");
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/tamaño/i);
  });

  it("rejects duplicate upload (#12)", async () => {
    const buf = Buffer.alloc(1024, "A");
    const first = await attachFile(buf, "pago.pdf", "application/pdf");
    expect(first.status).toBe(200);

    const second = await attachFile(buf, "pago.pdf", "application/pdf");
    expect(second.status).toBe(409);
    expect(second.body.error).toBe("COMPROBANTE_DUPLICADO");
  });
});

// ── Reset Protection ────────────────────────────────
describe("Reset Protection (#26)", () => {
  let adminToken: string;
  let prodToken: string;

  beforeEach(async () => {
    await resetDatabase();
  });

  it("non-admin cannot reset", async () => {
    const prodRes = await register("prod@test.com", "PRODUCTOR");
    prodToken = (await login("prod@test.com")).token!;
    const res = await r.post("/api/reset").set("Authorization", `Bearer ${prodToken}`).send({ confirm: "RESET" });
    expect(res.status).toBe(403);
  });

  it("admin must send confirm field", async () => {
    await register("admin@test.com", "ADMIN");
    adminToken = (await login("admin@test.com")).token!;
    const res = await r.post("/api/reset").set("Authorization", `Bearer ${adminToken}`).send({});
    expect(res.status).toBe(400);
  });

  it("admin can reset with confirm", async () => {
    await register("admin@test.com", "ADMIN");
    adminToken = (await login("admin@test.com")).token!;
    const res = await r.post("/api/reset").set("Authorization", `Bearer ${adminToken}`).send({ confirm: "RESET" });
    expect(res.status).toBe(200);
  });
});

// ── Overdue Commission (#14) ────────────────────────
describe("Overdue Commission (#14)", () => {
  let prodToken: string;
  let prodId: string;
  let adminToken: string;

  beforeEach(async () => {
    await resetDatabase();
    const p = await register("prod@test.com", "PRODUCTOR");
    prodId = p.body.user.id;
    prodToken = (await login("prod@test.com")).token!;
    await register("admin@test.com", "ADMIN");
    adminToken = (await login("admin@test.com")).token!;
    await approveUser(adminToken, prodId);
  });

  it("happy path — publishes when no overdue commission", async () => {
    const res = await createTrip(prodToken, { productor_id: prodId });
    expect(res.status).toBe(200);
  });
});

// ── Unauthenticated Access ──────────────────────────
describe("Unauthenticated Access", () => {
  it("rejects requests without token", async () => {
    const res = await r.get("/api/viajes");
    expect(res.status).toBe(401);
  });

  it("rejects requests with invalid token", async () => {
    const res = await r.get("/api/viajes").set("Authorization", "Bearer invalid-token");
    expect(res.status).toBe(401);
  });
});

// ── Camionero Commission (#30) ───────────────────────
describe("Camionero Commission (#30)", () => {
  let prodToken: string;
  let prodId: string;
  let camToken: string;
  let camId: string;
  let adminToken: string;
  let tripId: string;

  beforeEach(async () => {
    await resetDatabase();
    const p = await register("prod@test.com", "PRODUCTOR");
    prodId = p.body.user.id;
    prodToken = (await login("prod@test.com")).token!;

    await register("admin@test.com", "ADMIN");
    adminToken = (await login("admin@test.com")).token!;
    await approveUser(adminToken, prodId);

    const c = await register("cam@test.com", "CAMIONERO");
    camId = c.body.user.id;
    camToken = (await login("cam@test.com")).token!;
    await approveUser(adminToken, camId);

    const trip = await createTrip(prodToken, { productor_id: prodId });
    tripId = trip.body.viaje.id;
    await r.post(`/api/viajes/${tripId}/take`).set("Authorization", `Bearer ${camToken}`).send({ chofer_id: camId });
  });

  function attachCamioneroFile(buf: Buffer, filename: string, contentType: string) {
    return r
      .post(`/api/viajes/${tripId}/comprobante-camionero`)
      .set("Authorization", `Bearer ${camToken}`)
      .attach("file", buf, { filename, contentType });
  }

  it("uploads valid comision camionero comprobante", async () => {
    const res = await attachCamioneroFile(Buffer.alloc(1024, "A"), "comision.pdf", "application/pdf");
    expect(res.status).toBe(200);
  });

  it("rejects invalid mime type for camionero comprobante", async () => {
    const res = await attachCamioneroFile(Buffer.alloc(1024, "A"), "comision.exe", "application/x-msdownload");
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/archivo/i);
  });

  it("rejects oversized file (>5MB) for camionero comprobante", async () => {
    const res = await attachCamioneroFile(Buffer.alloc(6 * 1024 * 1024, "A"), "grande.pdf", "application/pdf");
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/tamaño/i);
  });

  it("rejects duplicate camionero comprobante upload", async () => {
    const buf = Buffer.alloc(1024, "A");
    const first = await attachCamioneroFile(buf, "comision.pdf", "application/pdf");
    expect(first.status).toBe(200);

    const second = await attachCamioneroFile(buf, "comision.pdf", "application/pdf");
    expect(second.status).toBe(409);
    expect(second.body.error).toBe("COMPROBANTE_DUPLICADO");
  });

  it("admin can confirm camionero commission", async () => {
    const buf = Buffer.alloc(1024, "A");
    await attachCamioneroFile(buf, "comision.pdf", "application/pdf");

    const res = await r
      .post(`/api/viajes/${tripId}/confirm-comision-camionero`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
  });

  it("rejects camionero commission confirmation by non-admin", async () => {
    const buf = Buffer.alloc(1024, "A");
    await attachCamioneroFile(buf, "comision.pdf", "application/pdf");

    const res = await r
      .post(`/api/viajes/${tripId}/confirm-comision-camionero`)
      .set("Authorization", `Bearer ${camToken}`);
    expect(res.status).toBe(403);
  });
});

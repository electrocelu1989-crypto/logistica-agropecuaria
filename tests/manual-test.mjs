// Manual integration test against running server at localhost:3000
// Run: node tests/manual-test.mjs

const BASE = "http://localhost:3000";

let pass = 0;
let fail = 0;

async function test(name, fn) {
  try {
    await fn();
    console.log(`  ✅ ${name}`);
    pass++;
  } catch (e) {
    console.log(`  ❌ ${name} — ${e.message}`);
    fail++;
  }
}

function assert(condition, msg) {
  if (!condition) throw new Error(msg || "assertion failed");
}

async function json(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...options.headers },
  });
  const body = await res.json().catch(() => ({}));
  return { status: res.status, headers: res.headers, body };
}

/** 10-digit prefix → full 11-digit CUIT with valid checksum */
function validCuit(prefix) {
  const d = prefix.split("").map(Number);
  const w = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
  let sum = 0;
  for (let i = 0; i < 10; i++) sum += d[i] * w[i];
  let ck = 11 - (sum % 11);
  if (ck === 11) ck = 0;
  if (ck === 10) ck = 9;
  return prefix + ck;
}

const CUITS = {
  admin: validCuit("2012345678"),
  productor: validCuit("2023456789"),
  camionero: validCuit("2034567890"),
};

function makeDataUrl(mime, sizeBytes) {
  const raw = "A".repeat(Math.ceil((sizeBytes * 4) / 3));
  return `data:${mime};base64,${Buffer.from(raw).toString("base64")}`;
}

// State
let prodToken, prodId;
let camToken, camId;
let adminToken, adminId;
let unrelatedId, unrelatedToken;

console.log("\n🚀 Starting integration tests...\n");

// ── Auth ────────────────────────────────────
console.log("── Auth & Validation ──");

await test("Register productor", async () => {
  const r = await json("/api/auth/register", {
    method: "POST",
    body: JSON.stringify({ email: "prod@test.com", password: "pass123", rol: "PRODUCTOR", cuit: CUITS.productor, telefono: "1111111111", razon_social: "Prod SRL", condicion_iva: "RESPONSABLE_INSCRIPTO", domicilio_fiscal: "Av Test 123" }),
  });
  assert(r.status === 200, `Expected 200 got ${r.status}: ${JSON.stringify(r.body)}`);
  prodId = r.body.user.id;
});

await test("Register admin", async () => {
  const r = await json("/api/auth/register", {
    method: "POST",
    body: JSON.stringify({ email: "admin@test.com", password: "pass123", rol: "ADMIN", cuit: CUITS.admin, telefono: "1111111111" }),
  });
  assert(r.status === 200, `Expected 200 got ${r.status}: ${JSON.stringify(r.body)}`);
  adminId = r.body.user.id;
});

await test("Register camionero", async () => {
  const r = await json("/api/auth/register", {
    method: "POST",
    body: JSON.stringify({ email: "cam@test.com", password: "pass123", rol: "CAMIONERO", cuit: CUITS.camionero, telefono: "1111111111" }),
  });
  assert(r.status === 200, `Expected 200 got ${r.status}: ${JSON.stringify(r.body)}`);
  camId = r.body.user.id;
});

await test("Register unrelated user", async () => {
  const r = await json("/api/auth/register", {
    method: "POST",
    body: JSON.stringify({ email: "other@test.com", password: "pass123", rol: "PRODUCTOR", cuit: validCuit("2045678901"), telefono: "1111111111" }),
  });
  assert(r.status === 200);
  unrelatedId = r.body.user.id;
  const cookies = r.headers.getSetCookie?.() || [];
  const authCookie = cookies.find(c => c.startsWith("auth_token="));
  unrelatedToken = authCookie ? authCookie.split(";")[0].replace("auth_token=", "") : "";
});

await test("Register invalid CUIT → 400", async () => {
  const r = await json("/api/auth/register", {
    method: "POST",
    body: JSON.stringify({ email: "bad@test.com", password: "pass123", rol: "PRODUCTOR", cuit: "30123456789", telefono: "1111111111" }),
  });
  assert(r.status === 400, `Expected 400 got ${r.status}`);
  assert(r.body.error?.match(/CUIT/i), `Expected CUIT error: ${r.body.error}`);
});

await test("Register invalid email → 400", async () => {
  const r = await json("/api/auth/register", {
    method: "POST",
    body: JSON.stringify({ email: "not-email", password: "pass123", rol: "PRODUCTOR", cuit: CUITS.productor, telefono: "1111111111" }),
  });
  assert(r.status === 400, `Expected 400 got ${r.status}`);
  assert(r.body.error?.match(/email/i), `Expected email error: ${r.body.error}`);
});

await test("Register duplicate email → 409", async () => {
  const r = await json("/api/auth/register", {
    method: "POST",
    body: JSON.stringify({ email: "prod@test.com", password: "pass123", rol: "PRODUCTOR", cuit: CUITS.productor, telefono: "1111111111" }),
  });
  assert(r.status === 409, `Expected 409 got ${r.status}`);
});

// ── Login ────────────────────────────────────
console.log("\n── Login & Token Extraction ──");

await test("Login productor", async () => {
  const r = await json("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: "prod@test.com", password: "pass123" }),
  });
  assert(r.status === 200, `Expected 200 got ${r.status}`);
  const cookies = r.headers.getSetCookie?.() || [];
  const authCookie = cookies.find(c => c.startsWith("auth_token="));
  assert(authCookie, "No auth_token cookie found");
  prodToken = authCookie.split(";")[0].replace("auth_token=", "");
});

await test("Login admin", async () => {
  const r = await json("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: "admin@test.com", password: "pass123" }),
  });
  assert(r.status === 200, `Expected 200 got ${r.status}`);
  const cookies = r.headers.getSetCookie?.() || [];
  const authCookie = cookies.find(c => c.startsWith("auth_token="));
  adminToken = authCookie.split(";")[0].replace("auth_token=", "");
});

await test("Login camionero", async () => {
  const r = await json("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: "cam@test.com", password: "pass123" }),
  });
  assert(r.status === 200, `Expected 200 got ${r.status}`);
  const cookies = r.headers.getSetCookie?.() || [];
  const authCookie = cookies.find(c => c.startsWith("auth_token="));
  camToken = authCookie.split(";")[0].replace("auth_token=", "");
});

// ── Approve productor ────────────────────────
console.log("\n── Approve & Publishing (#15, #17, #18, #19, #21, #29) ──");

await test("Approve productor", async () => {
  const r = await json(`/api/usuarios/${prodId}/approve`, {
    method: "POST",
    headers: { Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({ accion: "APROBAR" }),
  });
  assert(r.status === 200, `Expected 200 got ${r.status}: ${JSON.stringify(r.body)}`);
});

await test("Approve camionero", async () => {
  const r = await json(`/api/usuarios/${camId}/approve`, {
    method: "POST",
    headers: { Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({ accion: "APROBAR" }),
  });
  assert(r.status === 200, `Expected 200 got ${r.status}: ${JSON.stringify(r.body)}`);
});

await test("Publish with valid data → 200", async () => {
  const r = await json("/api/viajes", {
    method: "POST",
    headers: { Authorization: `Bearer ${prodToken}` },
    body: JSON.stringify({
      productor_id: prodId, tipo_grano: "SOJA", toneladas: 20,
      tipo_carroceria_requerida: "TOLVA",
      origen: { direccion: "Campo Sur, Ruta 3", lat: -33.456, lng: -60.123 },
      destino: { direccion: "Puerto Rosario", lat: -32.941, lng: -60.703 },
      tarifa_por_tonelada: 5000,
      fecha_carga_pactada: new Date(Date.now() + 86400000 * 2).toISOString(),
    }),
  });
  assert(r.status === 200, `Expected 200 got ${r.status}: ${JSON.stringify(r.body)}`);
});

await test("Reject negative toneladas (#17) → 400", async () => {
  const r = await json("/api/viajes", {
    method: "POST",
    headers: { Authorization: `Bearer ${prodToken}` },
    body: JSON.stringify({
      productor_id: prodId, tipo_grano: "SOJA", toneladas: -5,
      tipo_carroceria_requerida: "TOLVA",
      origen: { direccion: "Origen", lat: -33.456, lng: -60.123 },
      destino: { direccion: "Destino", lat: -32.941, lng: -60.703 },
      tarifa_por_tonelada: 5000,
      fecha_carga_pactada: new Date(Date.now() + 86400000 * 2).toISOString(),
    }),
  });
  assert(r.status === 400, `Expected 400 got ${r.status}: ${JSON.stringify(r.body)}`);
  assert(r.body.error?.match(/toneladas/i), `Expected toneladas error`);
});

await test("Reject zero tarifa (#17) → 400", async () => {
  const r = await json("/api/viajes", {
    method: "POST",
    headers: { Authorization: `Bearer ${prodToken}` },
    body: JSON.stringify({
      productor_id: prodId, tipo_grano: "SOJA", toneladas: 20,
      tipo_carroceria_requerida: "TOLVA",
      origen: { direccion: "Origen", lat: -33.456, lng: -60.123 },
      destino: { direccion: "Destino", lat: -32.941, lng: -60.703 },
      tarifa_por_tonelada: 0,
      fecha_carga_pactada: new Date(Date.now() + 86400000 * 2).toISOString(),
    }),
  });
  assert(r.status === 400, `Expected 400 got ${r.status}`);
});

await test("Reject invalid tipo_grano (#18) → 400", async () => {
  const r = await json("/api/viajes", {
    method: "POST",
    headers: { Authorization: `Bearer ${prodToken}` },
    body: JSON.stringify({
      productor_id: prodId, tipo_grano: "AVENA", toneladas: 20,
      tipo_carroceria_requerida: "TOLVA",
      origen: { direccion: "Origen", lat: -33.456, lng: -60.123 },
      destino: { direccion: "Destino", lat: -32.941, lng: -60.703 },
      tarifa_por_tonelada: 5000,
      fecha_carga_pactada: new Date(Date.now() + 86400000 * 2).toISOString(),
    }),
  });
  assert(r.status === 400, `Expected 400 got ${r.status}`);
  assert(r.body.error?.match(/grano/i), `Expected grano error`);
});

await test("Reject invalid carroceria (#18) → 400", async () => {
  const r = await json("/api/viajes", {
    method: "POST",
    headers: { Authorization: `Bearer ${prodToken}` },
    body: JSON.stringify({
      productor_id: prodId, tipo_grano: "SOJA", toneladas: 20,
      tipo_carroceria_requerida: "CAMION",
      origen: { direccion: "Origen", lat: -33.456, lng: -60.123 },
      destino: { direccion: "Destino", lat: -32.941, lng: -60.703 },
      tarifa_por_tonelada: 5000,
      fecha_carga_pactada: new Date(Date.now() + 86400000 * 2).toISOString(),
    }),
  });
  assert(r.status === 400, `Expected 400 got ${r.status}`);
  assert(r.body.error?.match(/carrocer/i), `Expected carroceria error`);
});

await test("Reject past fecha_carga_pactada (#19) → 400", async () => {
  const r = await json("/api/viajes", {
    method: "POST",
    headers: { Authorization: `Bearer ${prodToken}` },
    body: JSON.stringify({
      productor_id: prodId, tipo_grano: "SOJA", toneladas: 20,
      tipo_carroceria_requerida: "TOLVA",
      origen: { direccion: "Origen", lat: -33.456, lng: -60.123 },
      destino: { direccion: "Destino", lat: -32.941, lng: -60.703 },
      tarifa_por_tonelada: 5000,
      fecha_carga_pactada: new Date(Date.now() - 86400000).toISOString(),
    }),
  });
  assert(r.status === 400, `Expected 400 got ${r.status}`);
  assert(r.body.error?.match(/fecha/i), `Expected fecha error`);
});

await test("Reject invalid lat (#21) → 400", async () => {
  const r = await json("/api/viajes", {
    method: "POST",
    headers: { Authorization: `Bearer ${prodToken}` },
    body: JSON.stringify({
      productor_id: prodId, tipo_grano: "SOJA", toneladas: 20,
      tipo_carroceria_requerida: "TOLVA",
      origen: { direccion: "Origen", lat: 200, lng: -60.123 },
      destino: { direccion: "Destino", lat: -32.941, lng: -60.703 },
      tarifa_por_tonelada: 5000,
      fecha_carga_pactada: new Date(Date.now() + 86400000 * 2).toISOString(),
    }),
  });
  assert(r.status === 400, `Expected 400 got ${r.status}`);
  assert(r.body.error?.match(/coordenadas/i), `Expected coordenadas error`);
});

await test("Reject empty address (#29) → 400", async () => {
  const r = await json("/api/viajes", {
    method: "POST",
    headers: { Authorization: `Bearer ${prodToken}` },
    body: JSON.stringify({
      productor_id: prodId, tipo_grano: "SOJA", toneladas: 20,
      tipo_carroceria_requerida: "TOLVA",
      origen: { direccion: "", lat: -33.456, lng: -60.123 },
      destino: { direccion: "Destino", lat: -32.941, lng: -60.703 },
      tarifa_por_tonelada: 5000,
      fecha_carga_pactada: new Date(Date.now() + 86400000 * 2).toISOString(),
    }),
  });
  assert(r.status === 400, `Expected 400 got ${r.status}`);
  assert(r.body.error?.match(/dirección/i), `Expected dirección error`);
});

// ── State Machine (#10) ─────────────────────
console.log("\n── State Machine (#10) ──");

let tripId;
await test("Get available trip ID", async () => {
  const r = await json("/api/viajes", { headers: { Authorization: `Bearer ${prodToken}` } });
  assert(r.status === 200);
  const trips = r.body;
  assert(trips.length > 0, "No trips found");
  tripId = trips[0].id;
});

await test("Take trip (DISPONIBLE → ASIGNADO)", async () => {
  const r = await json(`/api/viajes/${tripId}/take`, {
    method: "POST",
    headers: { Authorization: `Bearer ${camToken}` },
    body: JSON.stringify({ chofer_id: camId }),
  });
  assert(r.status === 200, `Expected 200 got ${r.status}: ${JSON.stringify(r.body)}`);
  assert(r.body.viaje.estado === "ASIGNADO", `Expected ASIGNADO got ${r.body.viaje?.estado}`);
});

await test("Step EN_CARGA (ASIGNADO → EN_CARGA)", async () => {
  const r = await json(`/api/viajes/${tripId}/step`, {
    method: "POST",
    headers: { Authorization: `Bearer ${camToken}` },
    body: JSON.stringify({ next_state: "EN_CARGA" }),
  });
  assert(r.status === 200, `Expected 200 got ${r.status}: ${JSON.stringify(r.body)}`);
  assert(r.body.viaje.estado === "EN_CARGA");
});

await test("Step EN_TRANSITO (EN_CARGA → EN_TRANSITO)", async () => {
  const r = await json(`/api/viajes/${tripId}/step`, {
    method: "POST",
    headers: { Authorization: `Bearer ${camToken}` },
    body: JSON.stringify({ next_state: "EN_TRANSITO" }),
  });
  assert(r.status === 200);
  assert(r.body.viaje.estado === "EN_TRANSITO");
});

await test("Step ENTREGADO (EN_TRANSITO → ENTREGADO)", async () => {
  // Only productor can confirm delivery
  const r = await json(`/api/viajes/${tripId}/step`, {
    method: "POST",
    headers: { Authorization: `Bearer ${prodToken}` },
    body: JSON.stringify({ next_state: "ENTREGADO" }),
  });
  assert(r.status === 200, `Expected 200 got ${r.status}: ${JSON.stringify(r.body)}`);
  assert(r.body.viaje.estado === "ENTREGADO", `Expected ENTREGADO got ${r.body.viaje?.estado}`);
});

await test("Reject invalid transition (ASIGNADO → ENTREGADO)", async () => {
  // Create a NEW trip for this test
  const r1 = await json("/api/viajes", {
    method: "POST",
    headers: { Authorization: `Bearer ${prodToken}` },
    body: JSON.stringify({
      productor_id: prodId, tipo_grano: "SOJA", toneladas: 20,
      tipo_carroceria_requerida: "TOLVA",
      origen: { direccion: "Skip Test", lat: -33.456, lng: -60.123 },
      destino: { direccion: "Skip Dest", lat: -32.941, lng: -60.703 },
      tarifa_por_tonelada: 5000,
      fecha_carga_pactada: new Date(Date.now() + 86400000 * 2).toISOString(),
    }),
  });
  assert(r1.status === 200, `Create trip: Expected 200 got ${r1.status}: ${JSON.stringify(r1.body)}`);
  const skipTripId = r1.body.viaje.id;

  const r2 = await json(`/api/viajes/${skipTripId}/take`, {
    method: "POST", headers: { Authorization: `Bearer ${camToken}` },
    body: JSON.stringify({ chofer_id: camId }),
  });
  assert(r2.status === 200); // now ASIGNADO

  const r3 = await json(`/api/viajes/${skipTripId}/step`, {
    method: "POST",
    headers: { Authorization: `Bearer ${camToken}` },
    body: JSON.stringify({ next_state: "ENTREGADO" }),
  });
  assert(r3.status === 400, `Expected 400 got ${r3.status}: ${JSON.stringify(r3.body)}`);
  assert(r3.body.error?.match(/transición/i), `Expected transición error: ${r3.body.error}`);

  // Save for next test
  globalThis.__skipTripId = skipTripId;
});

await test("Reject step from unauthorized actor → 403", async () => {
  const r = await json(`/api/viajes/${globalThis.__skipTripId}/step`, {
    method: "POST",
    headers: { Authorization: `Bearer ${unrelatedToken}` },
    body: JSON.stringify({ next_state: "EN_CARGA" }),
  });
  assert(r.status === 403, `Expected 403 got ${r.status}: ${JSON.stringify(r.body)}`);
});

// ── Reject second active trip (#11) ─────────
console.log("\n── Active Trip Limit for Camionero (#11) ──");

await test("Reject second active trip for camionero (#11)", async () => {
  const t1 = await json("/api/viajes", {
    method: "POST",
    headers: { Authorization: `Bearer ${prodToken}` },
    body: JSON.stringify({
      productor_id: prodId, tipo_grano: "SOJA", toneladas: 20,
      tipo_carroceria_requerida: "TOLVA",
      origen: { direccion: "Dual 1", lat: -33.456, lng: -60.123 },
      destino: { direccion: "Dest 1", lat: -32.941, lng: -60.703 },
      tarifa_por_tonelada: 5000,
      fecha_carga_pactada: new Date(Date.now() + 86400000 * 2).toISOString(),
    }),
  });
  assert(t1.status === 200);
  const id1 = t1.body.viaje.id;

  const take1 = await json(`/api/viajes/${id1}/take`, {
    method: "POST", headers: { Authorization: `Bearer ${camToken}` },
    body: JSON.stringify({ chofer_id: camId }),
  });
  assert(take1.status === 409, `Expected 409 got ${take1.status}: ${JSON.stringify(take1.body)}`);
  assert(take1.body.error === "VIAJE_ACTIVO_EXISTENTE");
});

// ── Cancel (#13) ────────────────────────────
console.log("\n── Cancel Trip (#13) ──");

let cancelTripId;
await test("Productor cancels own trip → 200", async () => {
  const tr = await json("/api/viajes", {
    method: "POST",
    headers: { Authorization: `Bearer ${prodToken}` },
    body: JSON.stringify({
      productor_id: prodId, tipo_grano: "SOJA", toneladas: 20,
      tipo_carroceria_requerida: "TOLVA",
      origen: { direccion: "Cancel Test", lat: -33.456, lng: -60.123 },
      destino: { direccion: "Dest Cancel", lat: -32.941, lng: -60.703 },
      tarifa_por_tonelada: 5000,
      fecha_carga_pactada: new Date(Date.now() + 86400000 * 2).toISOString(),
    }),
  });
  assert(tr.status === 200);
  cancelTripId = tr.body.viaje.id;

  const r = await json(`/api/viajes/${cancelTripId}/cancel`, {
    method: "POST",
    headers: { Authorization: `Bearer ${prodToken}` },
    body: JSON.stringify({ cancelador_id: prodId }),
  });
  assert(r.status === 200, `Expected 200 got ${r.status}: ${JSON.stringify(r.body)}`);
});

await test("Unrelated user cannot cancel → 403", async () => {
  const tr = await json("/api/viajes", {
    method: "POST",
    headers: { Authorization: `Bearer ${prodToken}` },
    body: JSON.stringify({
      productor_id: prodId, tipo_grano: "SOJA", toneladas: 20,
      tipo_carroceria_requerida: "TOLVA",
      origen: { direccion: "Unrelated", lat: -33.456, lng: -60.123 },
      destino: { direccion: "Dest Unrelated", lat: -32.941, lng: -60.703 },
      tarifa_por_tonelada: 5000,
      fecha_carga_pactada: new Date(Date.now() + 86400000 * 2).toISOString(),
    }),
  });
  assert(tr.status === 200);
  const uTripId = tr.body.viaje.id;

  const r = await json(`/api/viajes/${uTripId}/cancel`, {
    method: "POST",
    headers: { Authorization: `Bearer ${prodToken}` },
    body: JSON.stringify({ cancelador_id: unrelatedId }),
  });
  assert(r.status === 403, `Expected 403 got ${r.status}: ${JSON.stringify(r.body)}`);
});

await test("Admin can cancel → 200", async () => {
  // Need a fresh trip
  const tr = await json("/api/viajes", {
    method: "POST",
    headers: { Authorization: `Bearer ${prodToken}` },
    body: JSON.stringify({
      productor_id: prodId, tipo_grano: "SOJA", toneladas: 20,
      tipo_carroceria_requerida: "TOLVA",
      origen: { direccion: "Cancel Admin", lat: -33.456, lng: -60.123 },
      destino: { direccion: "Dest Admin", lat: -32.941, lng: -60.703 },
      tarifa_por_tonelada: 5000,
      fecha_carga_pactada: new Date(Date.now() + 86400000 * 2).toISOString(),
    }),
  });
  assert(tr.status === 200);
  const newId = tr.body.viaje.id;

  const r = await json(`/api/viajes/${newId}/cancel`, {
    method: "POST",
    headers: { Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({ cancelador_id: adminId }),
  });
  assert(r.status === 200, `Expected 200 got ${r.status}: ${JSON.stringify(r.body)}`);
});

// ── Comprobantes (#12, #24, #25) ────────────
console.log("\n── Comprobantes (#12, #24, #25) ──");

let compTripId;
await test("Create trip for comprobante tests", async () => {
  const r = await json("/api/viajes", {
    method: "POST",
    headers: { Authorization: `Bearer ${prodToken}` },
    body: JSON.stringify({
      productor_id: prodId, tipo_grano: "SOJA", toneladas: 20,
      tipo_carroceria_requerida: "TOLVA",
      origen: { direccion: "Comp Source", lat: -33.456, lng: -60.123 },
      destino: { direccion: "Comp Dest", lat: -32.941, lng: -60.703 },
      tarifa_por_tonelada: 5000,
      fecha_carga_pactada: new Date(Date.now() + 86400000 * 2).toISOString(),
    }),
  });
  assert(r.status === 200);
  compTripId = r.body.viaje.id;
});

await test("Upload valid comprobante → 200 (#24)", async () => {
  const r = await json(`/api/viajes/${compTripId}/comprobante`, {
    method: "POST",
    headers: { Authorization: `Bearer ${prodToken}` },
    body: JSON.stringify({ fileName: "pago.pdf", mimeType: "application/pdf", dataUrl: makeDataUrl("application/pdf", 1024) }),
  });
  assert(r.status === 200, `Expected 200 got ${r.status}: ${JSON.stringify(r.body)}`);
});

await test("Reject invalid mime type → 400 (#24)", async () => {
  const r = await json(`/api/viajes/${compTripId}/comprobante`, {
    method: "POST",
    headers: { Authorization: `Bearer ${prodToken}` },
    body: JSON.stringify({ fileName: "virus.exe", mimeType: "application/x-msdownload", dataUrl: makeDataUrl("application/x-msdownload", 1024) }),
  });
  assert(r.status === 400, `Expected 400 got ${r.status}: ${JSON.stringify(r.body)}`);
  assert(r.body.error?.match(/archivo/i), `Expected archivo error`);
});

await test("Reject oversized file → 400 (#25)", async () => {
  const r = await json(`/api/viajes/${compTripId}/comprobante`, {
    method: "POST",
    headers: { Authorization: `Bearer ${prodToken}` },
    body: JSON.stringify({ fileName: "big.pdf", mimeType: "application/pdf", dataUrl: makeDataUrl("application/pdf", 6 * 1024 * 1024) }),
  });
  assert(r.status === 400, `Expected 400 got ${r.status}: ${JSON.stringify(r.body)}`);
  assert(r.body.error?.match(/tamaño/i), `Expected tamaño error`);
});

await test("Reject duplicate comprobante → 409 (#12)", async () => {
  const r = await json(`/api/viajes/${compTripId}/comprobante`, {
    method: "POST",
    headers: { Authorization: `Bearer ${prodToken}` },
    body: JSON.stringify({ fileName: "dup.pdf", mimeType: "application/pdf", dataUrl: makeDataUrl("application/pdf", 1024) }),
  });
  assert(r.status === 409, `Expected 409 got ${r.status}: ${JSON.stringify(r.body)}`);
  assert(r.body.error === "COMPROBANTE_DUPLICADO", `Expected COMPROBANTE_DUPLICADO`);
});

// ── Active Trip Limit (#15) ─────────────────
console.log("\n── Active Trip Limit (#15) ──");

await test("Create 10 trips then 11th is rejected (#15)", async () => {
  // Query existing trips to know how many more we need
  const existingRes = await json("/api/viajes", { headers: { Authorization: `Bearer ${prodToken}` } });
  assert(existingRes.status === 200);
  const estadosActivos = ["DISPONIBLE", "ASIGNADO", "EN_CARGA", "EN_TRANSITO"];
  const activeCount = existingRes.body.filter((t) => estadosActivos.includes(t.estado)).length;
  const toCreate = 10 - activeCount;
  assert(toCreate >= 0 && toCreate <= 10, `Unexpected active count: ${activeCount}`);

  for (let i = 0; i < toCreate; i++) {
    const r = await json("/api/viajes", {
      method: "POST",
      headers: { Authorization: `Bearer ${prodToken}` },
      body: JSON.stringify({
        productor_id: prodId, tipo_grano: "SOJA", toneladas: 20,
        tipo_carroceria_requerida: "TOLVA",
        origen: { direccion: `Origen ${i}`, lat: -33.456, lng: -60.123 },
        destino: { direccion: `Destino ${i}`, lat: -32.941, lng: -60.703 },
        tarifa_por_tonelada: 5000,
        fecha_carga_pactada: new Date(Date.now() + 86400000 * 2).toISOString(),
      }),
    });
    assert(r.status === 200, `Trip ${i}: Expected 200 got ${r.status}: ${JSON.stringify(r.body)}`);
  }
  const r = await json("/api/viajes", {
    method: "POST",
    headers: { Authorization: `Bearer ${prodToken}` },
    body: JSON.stringify({
      productor_id: prodId, tipo_grano: "SOJA", toneladas: 20,
      tipo_carroceria_requerida: "TOLVA",
      origen: { direccion: "Extra", lat: -33.456, lng: -60.123 },
      destino: { direccion: "Extra Dest", lat: -32.941, lng: -60.703 },
      tarifa_por_tonelada: 5000,
      fecha_carga_pactada: new Date(Date.now() + 86400000 * 2).toISOString(),
    }),
  });
  assert(r.status === 409, `Expected 409 got ${r.status}: ${JSON.stringify(r.body)}`);
  assert(r.body.error === "LIMITE_VIAJES_ACTIVOS", `Expected LIMITE_VIAJES_ACTIVOS`);
});

// ── Unauthenticated Access ──────────────────
console.log("\n── Unauthenticated Access ──");

await test("Reject without token → 401", async () => {
  const r = await json("/api/viajes");
  assert(r.status === 401);
});

await test("Reject with invalid token → 401", async () => {
  const r = await json("/api/viajes", { headers: { Authorization: "Bearer invalid-token" } });
  assert(r.status === 401);
});

// ── Results ─────────────────────────────────
console.log(`\n${"=".repeat(40)}`);
console.log(`Results: ${pass} passed, ${fail} failed out of ${pass + fail} tests`);
if (fail > 0) process.exit(1);

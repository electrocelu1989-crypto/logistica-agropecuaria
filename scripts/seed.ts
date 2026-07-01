async function seed() {
  const BASE = "http://localhost:3000";

  // Helper to register and login
  async function register(email: string, password: string, rol: string, extra: any = {}) {
    const res = await fetch(`${BASE}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, rol, cuit: "20123456789", telefono: "1111111111", razon_social: `${rol} Demo`, condicion_iva: "RESPONSABLE_INSCRIPTO", domicilio_fiscal: "Av. Demo 123", ...extra }),
    });
    const data = await res.json();
    const loginRes = await fetch(`${BASE}/api/auth/login`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password }),
    });
    const loginData = await loginRes.json();
    return { user: data.user, token: loginData.token };
  }

  // Create admin
  const admin = await register("admin@agroflet.com", "admin123", "ADMIN");

  // Create 2 productores
  const prod1 = await register("prod1@test.com", "pass123", "PRODUCTOR");
  await fetch(`${BASE}/api/usuarios/${prod1.user.id}/approve`, {
    method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${admin.token}` }, body: JSON.stringify({ accion: "APROBAR" }),
  });
  await fetch(`${BASE}/api/usuarios`, {
    method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${prod1.token}` }, body: JSON.stringify({ id: prod1.user.id, email: "prod1@test.com", rol: "PRODUCTOR", telefono: "1111111111", cuit: "20123456789", direcciones: [{ id: "dir-1", alias: "Campo Norte", direccion: "Ruta 11 Km 50", lat: -33.5, lng: -60.5 }] }),
  });

  const prod2 = await register("prod2@test.com", "pass123", "PRODUCTOR");
  await fetch(`${BASE}/api/usuarios/${prod2.user.id}/approve`, {
    method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${admin.token}` }, body: JSON.stringify({ accion: "APROBAR" }),
  });

  // Create 2 camioneros
  const cam1 = await register("cam1@test.com", "pass123", "CAMIONERO");
  await fetch(`${BASE}/api/usuarios/${cam1.user.id}/approve`, {
    method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${admin.token}` }, body: JSON.stringify({ accion: "APROBAR" }),
  });
  await fetch(`${BASE}/api/usuarios`, {
    method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${cam1.token}` }, body: JSON.stringify({ id: cam1.user.id, email: "cam1@test.com", rol: "CAMIONERO", telefono: "1111111111", cuit: "20345678901", vehiculo_data: { chasis: { patente: "ABC123", marca: "Ford", modelo: "Cargo", vtv_vencimiento: "2026-12-31", seguro_vencimiento: "2026-12-31" } } }),
  });

  const cam2 = await register("cam2@test.com", "pass123", "CAMIONERO");
  await fetch(`${BASE}/api/usuarios/${cam2.user.id}/approve`, {
    method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${admin.token}` }, body: JSON.stringify({ accion: "APROBAR" }),
  });

  // Create 3 viajes
  await fetch(`${BASE}/api/viajes`, {
    method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${prod1.token}` }, body: JSON.stringify({ productor_id: prod1.user.id, tipo_grano: "SOJA", toneladas: 25, tipo_carroceria_requerida: "TOLVA", origen: { direccion: "Campo Norte", lat: -33.5, lng: -60.5 }, destino: { direccion: "Puerto Rosario", lat: -32.94, lng: -60.7 }, tarifa_por_tonelada: 5000, fecha_carga_pactada: new Date(Date.now() + 86400000 * 3).toISOString() }),
  });

  const trip2Res = await fetch(`${BASE}/api/viajes`, {
    method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${prod1.token}` }, body: JSON.stringify({ productor_id: prod1.user.id, tipo_grano: "MAIZ", toneladas: 20, tipo_carroceria_requerida: "BATEA", origen: { direccion: "Campo Sur", lat: -34.0, lng: -61.0 }, destino: { direccion: "Puerto Rosario", lat: -32.94, lng: -60.7 }, tarifa_por_tonelada: 4500, fecha_carga_pactada: new Date(Date.now() + 86400000 * 5).toISOString() }),
  });
  const trip2 = await trip2Res.json();

  // Assign cam1 to trip2
  await fetch(`${BASE}/api/viajes/${trip2.viaje.id}/take`, {
    method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${cam1.token}` }, body: JSON.stringify({ chofer_id: cam1.user.id }),
  });

  // Create trip3 and assign + deliver
  const trip3Res = await fetch(`${BASE}/api/viajes`, {
    method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${prod2.token}` }, body: JSON.stringify({ productor_id: prod2.user.id, tipo_grano: "TRIGO", toneladas: 30, tipo_carroceria_requerida: "TOLVA", origen: { direccion: "Campo Este", lat: -33.2, lng: -59.8 }, destino: { direccion: "Puerto Rosario", lat: -32.94, lng: -60.7 }, tarifa_por_tonelada: 5500, fecha_carga_pactada: new Date(Date.now() + 86400000 * 2).toISOString() }),
  });
  const trip3 = await trip3Res.json();
  await fetch(`${BASE}/api/viajes/${trip3.viaje.id}/take`, {
    method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${cam2.token}` }, body: JSON.stringify({ chofer_id: cam2.user.id }),
  });
  for (const state of ["EN_CARGA", "EN_TRANSITO", "ENTREGADO"]) {
    await fetch(`${BASE}/api/viajes/${trip3.viaje.id}/step`, {
      method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${cam2.token}` }, body: JSON.stringify({ next_state: state }),
    });
  }

  console.log("Seed data created successfully!");
  console.log("Admin: admin@agroflet.com / admin123");
  console.log("Productores: prod1@test.com, prod2@test.com / pass123");
  console.log("Camioneros: cam1@test.com, cam2@test.com / pass123");
}

seed().catch(console.error);

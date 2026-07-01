import React, { useState, useEffect } from "react";
import TopNavbar from "./components/TopNavbar";
import ProductorView from "./components/ProductorView";
import CamioneroView from "./components/CamioneroView";
import BackofficeView from "./components/BackofficeView";
import LoginView from "./components/LoginView";
import RegisterView from "./components/RegisterView";
import UserProfileOnboarding from "./components/UserProfileOnboarding";
import MiPerfilModal from "./components/MiPerfilModal";
import { Usuario, Vehiculo, Viaje } from "./types";
import { Penalidad } from "./services/penalidades";
import { RefreshCw } from "lucide-react";

const schemaInfo = `-- PostgreSQL schema (Drizzle ORM)
-- Tables: users, vehicles, trips, penalties

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  rol TEXT NOT NULL CHECK (rol IN ('ADMIN','PRODUCTOR','CAMIONERO')),
  cuit TEXT,
  dni TEXT,
  nombre_completo TEXT NOT NULL,
  telefono TEXT,
  estado_cuenta TEXT DEFAULT 'PENDIENTE',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE trips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  productor_id UUID REFERENCES users(id),
  tipo_grano TEXT NOT NULL,
  toneladas NUMERIC(10,2) NOT NULL,
  origen TEXT NOT NULL,
  destino TEXT NOT NULL,
  fecha_carga TEXT,
  estado TEXT DEFAULT 'DISPONIBLE',
  camionero_id UUID REFERENCES users(id),
  acuerdo_monto NUMERIC(10,2),
  created_at TIMESTAMPTZ DEFAULT NOW()
);`;

const goSchema = `// Go schema variant for reference
type User struct {
  ID    string  \`json:"id"\`
  Email string  \`json:"email"\`
  Rol   string  \`json:"rol"\`
  CUIT  string  \`json:"cuit"\`
}

type Trip struct {
  ID          string  \`json:"id"\`
  ProductorID string  \`json:"productor_id"\`
  TipoGrano   string  \`json:"tipo_grano"\`
  Toneladas   float64 \`json:"toneladas"\`
}`;

export default function App() {
  const [currentUser, setCurrentUser] = useState<Usuario | null>(null);
  const [view, setView] = useState<"LOGIN" | "REGISTER" | "APP">("LOGIN");

  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [vehiculos, setVehiculos] = useState<Vehiculo[]>([]);
  const [viajes, setViajes] = useState<Viaje[]>([]);
  const [penalidades, setPenalidades] = useState<Penalidad[]>([]);

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [showProfileModal, setShowProfileModal] = useState<boolean>(false);

  // Authenticated fetch wrapper
  const authFetch = async (url: string, options: RequestInit = {}) => {
    return fetch(url, { ...options, credentials: "include" });
  };

  const fetchDbState = async () => {
    try {
      const res = await authFetch("/api/db");
      if (res.ok) {
        const data = await res.json();
        setUsuarios(data.usuarios || []);
        setVehiculos(data.vehiculos || []);
        setViajes(data.viajes || []);
      }
    } catch (err) {
      console.error("Error reading database state:", err);
    }
    try {
      const res2 = await authFetch("/api/penalidades");
      if (res2.ok) {
        const data2 = await res2.json();
        setPenalidades(data2.penalidades || []);
      }
    } catch (err) {
      // penalidades collection may not exist yet
    }
  };

  useEffect(() => {
    const checkSession = async () => {
      try {
        const res = await fetch("/api/auth/me");
        if (res.ok) {
          const data = await res.json();
          setCurrentUser(data.user);
          setView("APP");
        }
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };
    checkSession();
  }, []);

  useEffect(() => {
    if (currentUser && view === "APP") {
      fetchDbState();
    }
  }, [currentUser, view]);

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    setCurrentUser(null);
    setView("LOGIN");
  };

  const handleResetDb = async () => {
    setIsLoading(true);
    try {
      await authFetch("/api/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: "RESET" })
      });
      await fetchDbState();
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegisterDriver = async (driverData: any) => {
    try {
      const res = await authFetch("/api/usuarios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(driverData)
      });
      const data = await res.json();
      await fetchDbState();
      return data;
    } catch (err) {
      console.error(err);
      return { success: false, error: "Fallo conexión servidor" };
    }
  };

  const handlePublishTrip = async (tripData: any) => {
    try {
      const res = await authFetch("/api/viajes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(tripData)
      });
      const data = await res.json();
      await fetchDbState();
      return data.success;
    } catch (err) {
      console.error(err);
      return false;
    }
  };

  const handleTakeTrip = async (tripId: string, payload: any) => {
    try {
      const res = await authFetch(`/api/viajes/${tripId}/take`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      await fetchDbState();
      return data;
    } catch (err) {
      console.error(err);
      return { success: false, error: "Fallo de conexión" };
    }
  };

  const handleCancelTrip = async (tripId: string, cancelData: any) => {
    try {
      const res = await authFetch(`/api/viajes/${tripId}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cancelData)
      });
      const data = await res.json();
      await fetchDbState();
      return data;
    } catch (err) {
      console.error(err);
      return { success: false, error: "Error cancelando viaje" };
    }
  };

  const handleStepTrip = async (tripId: string, nextState: string) => {
    try {
      await authFetch(`/api/viajes/${tripId}/step`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ next_state: nextState })
      });
      await fetchDbState();
    } catch (err) {
      console.error(err);
    }
  };

  const handleApproveUser = async (userId: string, action: "APROBAR" | "RECHAZAR") => {
    try {
      await authFetch(`/api/usuarios/${userId}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accion: action })
      });
      await fetchDbState();
    } catch (err) {
      console.error(err);
    }
  };

  const handleConfirmCamioneroCommission = async (tripId: string) => {
    try {
      await authFetch(`/api/viajes/${tripId}/confirm-comision-camionero`, {
        method: "POST",
        headers: { "Content-Type": "application/json" }
      });
      await fetchDbState();
    } catch (err) {
      console.error(err);
    }
  };

  const handleUploadCamioneroReceipt = async (tripId: string, payload: { fileName: string; mimeType: string; dataUrl: string }) => {
    try {
      const res = await authFetch(`/api/viajes/${tripId}/comprobante-camionero`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "No se pudo subir el comprobante");
      }
      await fetchDbState();
      return true;
    } catch (err) {
      console.error(err);
      return false;
    }
  };

  const handleUploadPublicationReceipt = async (tripId: string, payload: { fileName: string; mimeType: string; dataUrl: string }) => {
    try {
      const res = await authFetch(`/api/viajes/${tripId}/comprobante`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "No se pudo subir el comprobante");
      }
      await fetchDbState();
      return true;
    } catch (err) {
      console.error(err);
      return false;
    }
  };

  const handleConfirmPublicationPayment = async (tripId: string) => {
    try {
      await authFetch(`/api/viajes/${tripId}/confirm-publicacion`, {
        method: "POST",
        headers: { "Content-Type": "application/json" }
      });
      await fetchDbState();
    } catch (err) {
      console.error(err);
    }
  };

  const handleUpdateProfile = async (payload: any) => {
    const res = await authFetch("/api/usuarios", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || "Fallo al guardar el perfil");
    }
    await fetchDbState();
    // Refresh current user session
    const meRes = await fetch("/api/auth/me");
    if (meRes.ok) {
      const data = await meRes.json();
      if (data.user) setCurrentUser(data.user);
    }
  };

  if (view === "LOGIN") {
    return (
      <LoginView
        onLogin={(u) => { setCurrentUser(u); setView("APP"); }}
        onGoToRegister={() => setView("REGISTER")}
      />
    );
  }

  if (view === "REGISTER") {
    return (
      <RegisterView
        onRegisterSuccess={(u) => { setCurrentUser(u); setView("APP"); }}
        onGoToLogin={() => setView("LOGIN")}
      />
    );
  }

  if (!currentUser) return null;

  const currentRole = currentUser.rol;

  const systemStats = {
    totalTrips: viajes.length,
    pendingKyc: usuarios.filter((u) => u.estado_cuenta === "PENDIENTE").length,
    pendingCommissions: viajes.filter(
      (v) => v.pago_publicacion_estado !== "ABONADA" || (v.chofer_id && v.pago_comision_camionero_estado !== "ABONADA")
    ).length
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-800 flex flex-col font-sans">
      
      {/* Navigation and state bar */}
      <TopNavbar
        currentRole={currentRole}
        onChangeRole={(role) => {}} // Disabled switching roles in production
        onResetDb={handleResetDb}
        systemStats={systemStats}
        onLogout={handleLogout}
        currentUser={currentUser}
        onOpenProfile={() => setShowProfileModal(true)}
      />

      {showProfileModal && (
        <MiPerfilModal
          currentUser={currentUser}
          onClose={() => setShowProfileModal(false)}
          onSave={handleUpdateProfile}
        />
      )}

      {/* Main container */}
      <main className="flex-grow max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-32 space-y-4">
            <RefreshCw className="h-10 w-10 text-emerald-500 animate-spin" />
            <p className="text-slate-500 font-mono text-sm">Consultando base de datos activa...</p>
          </div>
        ) : (
          <div className="space-y-6">
            
            {/* Context bar summary */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4 text-xs">
              <div className="flex flex-wrap items-center gap-2">
                <span className="bg-emerald-55/80 text-emerald-700 font-extrabold px-2.5 py-1 rounded-md border border-emerald-200/50">
                  SESIÓN: {currentRole}
                </span>
                <span className="text-slate-300 hidden sm:inline">|</span>
                <span className="text-slate-600">
                  {currentRole === "PRODUCTOR" && "Publique cargas, registre montos de operación y abone la comisión del 3% por depósito (30 días)."}
                  {currentRole === "CAMIONERO" && "Onboarding KYC, cartelera de cargas y comisión del 3% por depósito (40 días)."}
                  {currentRole === "ADMIN" && "Panel Backoffice para auditoría documental de seguros/LiNTI y visor de base de datos NoSQL."}
                </span>
              </div>
              <div className="text-slate-400 font-mono self-end md:self-auto text-[11px]">
                Usuario autenticado: <span className="text-slate-600 font-semibold">{currentUser.email}</span>
              </div>
            </div>

            {/* Core views router */}
            {currentRole === "PRODUCTOR" && (
              <ProductorView
                usuarios={usuarios}
                vehiculos={vehiculos}
                viajes={viajes}
                activeUserId={currentUser.id}
                onPublishTrip={handlePublishTrip}
                onCancelTrip={handleCancelTrip}
                onStepTrip={handleStepTrip}
                onUploadPublicationReceipt={handleUploadPublicationReceipt}
                onboardingStatus={{ completado: currentUser.onboarding_completado, estado: currentUser.estado_cuenta }}
                onOnboardingComplete={() => {
                  fetchDbState();
                  fetch("/api/auth/me").then(r => r.json()).then(d => { if (d.user) setCurrentUser(d.user) });
                }}
              />
            )}

            {currentRole === "CAMIONERO" && (
              <CamioneroView
                usuarios={usuarios}
                vehiculos={vehiculos}
                viajes={viajes}
                activeUserId={currentUser.id}
                onRegisterDriver={handleRegisterDriver}
                onTakeTrip={handleTakeTrip}
                onCancelTrip={handleCancelTrip}
                onStepTrip={handleStepTrip}
                onUploadCamioneroReceipt={handleUploadCamioneroReceipt}
                onboardingStatus={{ completado: currentUser.onboarding_completado, estado: currentUser.estado_cuenta }}
                onOnboardingComplete={() => {
                  fetchDbState();
                  fetch("/api/auth/me").then(r => r.json()).then(d => { if (d.user) setCurrentUser(d.user) });
                }}
              />
            )}

            {currentRole === "ADMIN" && (
              <BackofficeView
                usuarios={usuarios}
                vehiculos={vehiculos}
                viajes={viajes}
                penalidades={penalidades}
                onApproveUser={handleApproveUser}
                onConfirmPublicationPayment={handleConfirmPublicationPayment}
                onConfirmCamioneroCommission={handleConfirmCamioneroCommission}
                onResetDb={handleResetDb}
                schemaInfo={schemaInfo}
                goSchema={goSchema}
              />
            )}

          </div>
        )}

      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-6 text-center text-xs text-slate-500 shrink-0">
        <div className="max-w-7xl mx-auto px-4">
          <p>© 2026 AgroFlet Argentina S.A. Todos los derechos reservados.</p>
          <p className="mt-1 font-mono text-[10px] text-slate-400">
            Registro de operaciones y comisiones por depósito. Los pagos de flete se acuerdan directamente entre productor y transportista.
          </p>
        </div>
      </footer>

    </div>
  );
}

import React, { useState, useEffect } from "react";
import { Usuario, Viaje, Vehiculo } from "../types";
import {
  Smartphone,
  ShieldCheck,
  Truck,
  MapPin,
  Lock,
  UserCheck,
  AlertCircle,
  HelpCircle,
  Clock,
  ArrowRight,
  Wifi,
  Battery,
  User,
  FileText,
  BadgeAlert,
  Compass,
  Check,
  AlertTriangle,
  RotateCcw
} from "lucide-react";
import { motion } from "motion/react";
import RealTimeMap from "./RealTimeMap";
import StatusStepper from "./StatusStepper";
import MovimientosTable from "./MovimientosTable";
import DocumentScanner from "./DocumentScanner";
import UserProfileOnboarding from "./UserProfileOnboarding";

interface CamioneroViewProps {
  usuarios: Usuario[];
  vehiculos: Vehiculo[];
  viajes: Viaje[];
  activeUserId: string;
  onRegisterDriver: (driverData: any) => Promise<any>;
  onTakeTrip: (tripId: string, payload: any) => Promise<any>;
  onCancelTrip: (tripId: string, cancelData: any) => Promise<any>;
  onStepTrip: (tripId: string, nextState: string) => Promise<any>;
  onUploadCamioneroReceipt?: (tripId: string, payload: { fileName: string; mimeType: string; dataUrl: string }) => Promise<boolean>;
  onboardingStatus?: { completado?: boolean; estado?: string };
  onOnboardingComplete?: () => void;
}

export default function CamioneroView({
  usuarios,
  vehiculos,
  viajes,
  activeUserId,
  onRegisterDriver,
  onTakeTrip,
  onCancelTrip,
  onStepTrip,
  onUploadCamioneroReceipt,
  onboardingStatus,
  onOnboardingComplete
}: CamioneroViewProps) {
  // Get drivers
  const choferes = usuarios.filter((u) => u.rol === "CAMIONERO");
  const activeChofer = usuarios.find((u) => u.id === activeUserId && u.rol === "CAMIONERO") || choferes[0];
  const activeVehiculo = vehiculos.find((v) => v.chofer_id === activeChofer?.id);

  // Registration Form State
  const [telefono, setTelefono] = useState<string>(activeChofer?.telefono || "+549");
  const [cuit, setCuit] = useState<string>(activeChofer?.cuit || "");
  const [razonSocial, setRazonSocial] = useState<string>(activeChofer?.razon_social || "");
  const [condicionIva, setCondicionIva] = useState<string>(activeChofer?.condicion_iva || "MONOTRIBUTISTA");
  const [domicilio, setDomicilio] = useState<string>(activeChofer?.domicilio_fiscal || "");
  
  // KYC Docs State
  const [dni, setDni] = useState<string>(activeChofer?.perfil_chofer?.dni || "");
  const [linti, setLinti] = useState<string>(activeChofer?.perfil_chofer?.numero_linti || "");
  const [lintiVencimiento, setLintiVencimiento] = useState<string>(activeChofer?.perfil_chofer?.linti_vencimiento || "2027-12-31");
  const [patenteChasis, setPatenteChasis] = useState<string>(activeVehiculo?.chasis.patente || "");
  const [marcaChasis, setMarcaChasis] = useState<string>(activeVehiculo?.chasis.marca || "Scania");
  const [modeloChasis, setModeloChasis] = useState<string>(activeVehiculo?.chasis.modelo || "R450");
  const [acopladoPatente, setAcopladoPatente] = useState<string>(activeVehiculo?.acoplado?.patente || "");
  const [acopladoTipo, setAcopladoTipo] = useState<"TOLVA" | "BARANDA_VOLCABLE" | "BATEA" | "TODO_PUERTAS">("TOLVA");

  // Mock API states
  const [isQueryingAfip, setIsQueryingAfip] = useState<boolean>(false);
  const [isQueryingLinti, setIsQueryingLinti] = useState<boolean>(false);
  const [isVerifyingSms, setIsVerifyingSms] = useState<boolean>(false);
  const [smsVerified, setSmsVerified] = useState<boolean>(activeChofer ? activeChofer.token_whatsapp_validado : false);
  const [smsToken, setSmsToken] = useState<string>("");

  // Action / Match simulation parameters
  const [simulateRace, setSimulateRace] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<"CARTELERA" | "VIAJE_ACTIVO" | "COMISIONES">("CARTELERA");
  const [radiusFilter, setRadiusFilter] = useState<number>(30); // Ola 1=30km, Ola 2=80km, Ola 3=999km

  // Error/Success state feedback
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [showOnboardingModal, setShowOnboardingModal] = useState<boolean>(false);

  useEffect(() => {
    if (activeChofer) {
      setTelefono(activeChofer.telefono);
      setCuit(activeChofer.cuit);
      setRazonSocial(activeChofer.razon_social);
      setDomicilio(activeChofer.domicilio_fiscal);
      setSmsVerified(activeChofer.token_whatsapp_validado);

      if (activeChofer.perfil_chofer) {
        setDni(activeChofer.perfil_chofer.dni);
        setLinti(activeChofer.perfil_chofer.numero_linti);
        setLintiVencimiento(activeChofer.perfil_chofer.linti_vencimiento);
      }
      if (activeVehiculo) {
        setPatenteChasis(activeVehiculo.chasis.patente);
        setMarcaChasis(activeVehiculo.chasis.marca);
        setModeloChasis(activeVehiculo.chasis.modelo);
        if (activeVehiculo.acoplado) {
          setAcopladoPatente(activeVehiculo.acoplado.patente);
          setAcopladoTipo(activeVehiculo.acoplado.tipo_carroceria);
        }
      }
    }
  }, [activeUserId, activeChofer, activeVehiculo]);

  // Consult AFIP REST API simulation
  const handleQueryAfip = async () => {
    if (!cuit) {
      alert("Por favor ingrese un CUIT.");
      return;
    }
    setIsQueryingAfip(true);
    try {
      const res = await fetch(`/api/mock-afip/${cuit}`);
      const data = await res.json();
      if (data.success) {
        setRazonSocial(data.razon_social);
        setCondicionIva(data.condicion_iva);
        setDomicilio(data.domicilio_fiscal);
        setActionSuccess("CUIT verificado en Padrón de AFIP.");
        setTimeout(() => setActionSuccess(null), 3500);
      } else {
        alert(data.error);
      }
    } catch (err) {
      alert("Error consultando padrón.");
    } finally {
      setIsQueryingAfip(false);
    }
  };

  // Consult ANSV LiNTI API simulation
  const handleQueryLinti = async () => {
    if (!dni) {
      alert("Por favor ingrese un DNI.");
      return;
    }
    setIsQueryingLinti(true);
    try {
      const res = await fetch(`/api/mock-linti/${dni}`);
      const data = await res.json();
      if (data.success) {
        setLinti(data.numero_linti || `L-${Math.floor(Math.random() * 900000) + 100000}`);
        setLintiVencimiento(data.vencimiento);
        setActionSuccess("Licencia habilitante LiNTI homologada por la ANSV.");
        setTimeout(() => setActionSuccess(null), 3500);
      } else {
        alert(data.error);
      }
    } catch (err) {
      alert("Error consultando ANSV.");
    } finally {
      setIsQueryingLinti(false);
    }
  };

  // Simulate Whatsapp OTP verification
  const handleSendOtp = async () => {
    setIsVerifyingSms(true);
    await new Promise((resolve) => setTimeout(resolve, 800));
    setSmsVerified(true);
    setIsVerifyingSms(false);
    setActionSuccess("WhatsApp verificado de forma segura.");
    setTimeout(() => setActionSuccess(null), 3000);
  };

  // Submit Driver Profile
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionError(null);

    const payload = {
      id: activeUserId || activeChofer?.id || `driver-${Date.now()}`,
      telefono,
      rol: "CAMIONERO" as const,
      cuit,
      razon_social: razonSocial,
      condicion_iva: condicionIva,
      domicilio_fiscal: domicilio,
      perfil_chofer: {
        dni,
        numero_linti: linti,
        linti_vencimiento: lintiVencimiento,
        validado_por_ansv: true,
        fotos: {
          dni_frente: "storage_url_dni_f",
          dni_dorso: "storage_url_dni_d",
          linti: "storage_url_linti"
        }
      },
      vehiculo_data: {
        chasis_patente: patenteChasis,
        chasis_marca: marcaChasis,
        chasis_modelo: modeloChasis,
        acoplado_patente: acopladoPatente,
        acoplado_tipo: acopladoTipo
      }
    };

    const res = await onRegisterDriver(payload);
    if (res.success) {
      setActionSuccess("Registro KYC cargado. Su documentación se encuentra bajo auditoría en Backoffice.");
      setTimeout(() => setActionSuccess(null), 5000);
    } else {
      setActionError(res.error);
    }
  };

  // Handle scanned document auto-fill
  const handleDocumentScanned = (type: "DNI_FRENTE" | "DNI_DORSO" | "LINTI", data: any) => {
    if (type === "DNI_FRENTE" && data.dni) {
      setDni(data.dni);
      if (data.nombre) {
        setRazonSocial(data.nombre);
      }
      setActionSuccess(`Lectura OCR exitosa: DNI ${data.dni} y titular extraído.`);
      setTimeout(() => setActionSuccess(null), 4000);
    } else if (type === "LINTI" && data.linti) {
      setLinti(data.linti);
      if (data.vencimiento) {
        setLintiVencimiento(data.vencimiento);
      }
      setActionSuccess(`Lectura OCR exitosa: Licencia LiNTI ${data.linti} extraída. Vence el ${data.vencimiento}.`);
      setTimeout(() => setActionSuccess(null), 4000);
    } else if (type === "DNI_DORSO") {
      setActionSuccess("Lectura de reverso de DNI completada: Código de barras PDF417 validado.");
      setTimeout(() => setActionSuccess(null), 3000);
    }
  };

  // Assign load (Race condition demo!)
  const handleTakeTripClick = async (trip: Viaje) => {
    if (!activeChofer) return;

    if (!onboardingStatus?.completado) {
      setShowOnboardingModal(true);
      return;
    }

    if (onboardingStatus?.estado === "PENDIENTE") {
      alert("Su cuenta se encuentra PENDIENTE de aprobación legal. No puede tomar viajes hasta ser aprobado por LiNTI/AFIP.");
      return;
    }

    if (onboardingStatus?.estado === "RECHAZADO") {
      alert("Su cuenta fue RECHAZADA. Verifique su información legal.");
      setShowOnboardingModal(true);
      return;
    }

    // Engine validation: cuenta aprobada
    const res = await onTakeTrip(trip.id, {
      chofer_id: activeChofer.id,
      simulate_race: simulateRace
    });

    if (res.success) {
      setActionSuccess("¡Carga asignada exitosamente en Firestore! Preparando hoja de ruta.");
      setActiveTab("VIAJE_ACTIVO");
      setTimeout(() => setActionSuccess(null), 4000);
    } else {
      setActionError(res.message || res.error);
    }
  };

  const handleCancelActiveTrip = async (tripId: string) => {
    const confirmCancel = window.confirm(
      "¿Confirma la cancelación de este viaje?\n\n" +
      "La cancelación quedará registrada. Los pagos del flete se acuerdan directamente con el productor."
    );

    if (confirmCancel) {
      const res = await onCancelTrip(tripId, {
        cancelador_id: activeChofer!.id,
        motivo: "CANCELACION_CAMIONERO",
        detalle: "El transportista canceló el viaje asignado."
      });
      setActionSuccess(res.detalle);
      setTimeout(() => setActionSuccess(null), 5000);
    }
  };

  // Active trips for this driver
  const myTrips = viajes.filter((v) => v.chofer_id === activeChofer?.id);
  const activeTrip = myTrips.find((v) => ["ASIGNADO", "EN_CARGA", "EN_TRANSITO"].includes(v.estado));
  const availableTrips = viajes.filter((v) => v.estado === "DISPONIBLE");

  // Ola Match geographic filtering simulator (OLA 1: 0-30km, OLA 2: 30-80km, OLA 3: Global)
  const getSimulatedDistance = (trip: Viaje) => {
    // Simple mock distance based on ID or details
    if (trip.id === "viaje-1") return 15; // km (OLA 1 matches)
    if (trip.id === "viaje-2") return 45; // km (OLA 2 matches)
    return 120; // km (OLA 3 matches)
  };

  const filteredTripsByRadius = availableTrips.filter((t) => {
    const d = getSimulatedDistance(t);
    return d <= radiusFilter;
  });

  return (
    <div className="space-y-6 relative">
      {showOnboardingModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto relative">
            <button 
              onClick={() => setShowOnboardingModal(false)}
              className="absolute top-4 right-4 z-10 bg-slate-100 text-slate-500 hover:bg-slate-200 rounded-full p-2"
            >
              Cerrar
            </button>
            <UserProfileOnboarding
              currentUser={activeChofer!}
              onComplete={() => {
                setShowOnboardingModal(false);
                if (onOnboardingComplete) onOnboardingComplete();
              }}
            />
          </div>
        </div>
      )}

      {/* Mapa de Monitoreo en Tiempo Real para Camioneros */}
      <RealTimeMap
        usuarios={usuarios}
        vehiculos={vehiculos}
        viajes={viajes}
        userRole="CAMIONERO"
        activeUserId={activeChofer?.id || activeUserId}
      />

      <div className="flex flex-col xl:flex-row gap-6 items-start justify-center">
      
      {/* 1. SECTOR DE CONTROL DE PERFIL (FUERA DE LA PANTALLA DEL TELÉFONO) (LEFT) */}
      <div className="w-full xl:w-96 space-y-6">
        <div className="bg-white rounded-xl p-6 border border-slate-200 card-shadow">
          <label className="block text-slate-500 text-xs font-bold uppercase tracking-wider mb-1.5">Chofer / Camionero Activo</label>
          <div className="text-slate-900 font-semibold mb-2">{activeChofer?.razon_social || "Camionero"}</div>
          <p className="text-slate-500 text-xs">
            CUIT: <span className="text-slate-700 font-mono text-[11px]">{activeChofer?.cuit || "-"}</span>
          </p>
          <p className="text-slate-500 text-xs mt-1.5">
            Domicilio: <span className="text-slate-700 font-mono text-[11px]">{activeChofer?.domicilio_fiscal || "-"}</span>
          </p>

          <div className="space-y-3 pt-3 border-t border-slate-100">
            <div className="flex justify-between text-xs">
              <span className="text-slate-500">Estado KYC:</span>
              <span className={`font-extrabold uppercase text-xs ${
                activeChofer?.estado_cuenta === "APROBADO" ? "text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded" : "text-amber-700 bg-amber-50 px-2 py-0.5 rounded"
              }`}>{activeChofer?.estado_cuenta}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-slate-500">Comisión pendiente (3%):</span>
              <span className="font-extrabold font-mono text-amber-700">
                ${viajes
                  .filter((v) => v.chofer_id === activeChofer?.id && v.pago_comision_camionero_estado !== "ABONADA")
                  .reduce((sum, v) => sum + v.tarifa_ofrecida * 0.03, 0)
                  .toLocaleString("es-AR", { minimumFractionDigits: 2 })} ARS
              </span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-slate-500">Whatsapp Validado:</span>
              <span className="text-emerald-700 font-extrabold bg-emerald-50 px-2 py-0.5 rounded">✓ SÍ</span>
            </div>
            {activeChofer?.perfil_chofer && (
              <div className="text-[11px] bg-slate-50 p-3 rounded-lg border border-slate-200 text-slate-700 font-mono space-y-1 shadow-xs">
                <p><span className="text-slate-400 font-bold">DNI:</span> {activeChofer.perfil_chofer.dni}</p>
                <p><span className="text-slate-400 font-bold">Licencia LiNTI:</span> {activeChofer.perfil_chofer.numero_linti}</p>
                <p><span className="text-slate-400 font-bold">Vence:</span> {activeChofer.perfil_chofer.linti_vencimiento}</p>
                {activeVehiculo && (
                  <p className="text-emerald-700 font-bold">Chasis: {activeVehiculo.chasis.marca} - {activeVehiculo.chasis.patente}</p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Demo feedback boxes */}
        {(actionError || actionSuccess) && (
          <div className="space-y-2">
            {actionError && (
              <div className="bg-rose-50 border border-rose-200 text-rose-800 p-4 rounded-xl text-xs flex gap-2 items-start shadow-xs">
                <BadgeAlert className="h-4.5 w-4.5 text-rose-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-extrabold">Error Operativo (Firestore Lock)</p>
                  <p className="mt-1 font-mono text-[11px] leading-tight text-rose-700">{actionError}</p>
                </div>
              </div>
            )}
            {actionSuccess && (
              <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-4 rounded-xl text-xs flex gap-2 items-start shadow-xs">
                <ShieldCheck className="h-4.5 w-4.5 text-[#10b981] shrink-0 mt-0.5" />
                <div>
                  <p className="font-extrabold">Operación Autorizada</p>
                  <p className="mt-1 text-slate-600 leading-normal">{actionSuccess}</p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 2. DISPOSITIVO SMARTPHONE SIMULADO (CENTER-RIGHT) */}
      <div className="relative mx-auto xl:mx-0 w-full max-w-[390px] bg-slate-950 rounded-[45px] p-3.5 border-[8px] border-slate-800 shadow-2xl overflow-hidden aspect-[9/19]">
        
        {/* Smartphone top details: speaker notch & camera */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 bg-slate-800 h-6 w-32 rounded-b-2xl z-50 flex items-center justify-center">
          <div className="h-1.5 w-10 bg-slate-900 rounded-full mb-1"></div>
          <div className="h-2 w-2 bg-slate-900 rounded-full absolute right-4 mb-1"></div>
        </div>

        {/* Phone screen canvas */}
        <div className="bg-slate-900 text-white w-full h-full rounded-[34px] overflow-hidden flex flex-col justify-between select-none relative">
          
          {/* Top StatusBar */}
          <div className="bg-slate-950 px-5 pt-7 pb-2 flex justify-between items-center text-[10px] font-mono text-slate-400 z-10 shrink-0">
            <span>22:14</span>
            <div className="flex items-center gap-1.5">
              <span className="text-emerald-500 font-bold">5G</span>
              <Wifi className="h-3 w-3 text-slate-300" />
              <Battery className="h-3 w-3 text-emerald-500" />
            </div>
          </div>

          {/* Core Mobile Application Content scrollable */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
            
            {/* BRANDING APP HEADER */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <div className="bg-emerald-600 p-1.5 rounded-md">
                  <Truck className="h-4.5 w-4.5 text-white" />
                </div>
                <div>
                  <h4 className="text-xs font-extrabold tracking-tight">AgroFlet Choferes</h4>
                  <p className="text-[9px] text-slate-400 leading-none">Ruta Segura Activa</p>
                </div>
              </div>
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping"></span>
            </div>

            {/* IF NOT APPROVED YET: FORCE ONBOARDING / AUDIT SCREEN */}
            {activeChofer?.estado_cuenta !== "APROBADO" ? (
              <div className="space-y-4">
                <div className="bg-amber-950/30 border border-amber-500/20 p-4 rounded-xl text-center space-y-2">
                  <Clock className="h-8 w-8 text-amber-500 mx-auto animate-pulse" />
                  <h5 className="text-xs font-bold text-amber-300 uppercase font-mono">KYC EN AUDITORÍA</h5>
                  <p className="text-[10px] text-slate-300 leading-normal">
                    Su perfil ({activeChofer?.razon_social}) y vehículo se encuentran en estado <b>PENDIENTE</b>.
                    ANSV y los administradores están verificando las patentes, la licencia LiNTI y la VTV.
                  </p>
                  <p className="text-[9px] text-slate-400 italic">
                    (Vaya a la pestaña "Backoffice" arriba para aprobar instantáneamente este chofer)
                  </p>
                </div>

                {/* Document Scanner Integrado */}
                <DocumentScanner
                  onScanComplete={handleDocumentScanned}
                  currentDni={dni}
                  currentLinti={linti}
                />

                {/* KYC Registration form inside phone if they want to edit/re-register */}
                <form onSubmit={handleRegister} className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
                  <h6 className="text-[10px] uppercase font-bold text-emerald-400 font-mono flex items-center gap-1">
                    <UserCheck className="h-3.5 w-3.5" /> Re-enviar Documentación
                  </h6>

                  <div className="space-y-2 text-xs">
                    <div>
                      <label className="block text-slate-400 text-[9px] mb-0.5">CUIT de Facturación</label>
                      <div className="flex gap-1.5">
                        <input
                          type="text"
                          value={cuit}
                          onChange={(e) => setCuit(e.target.value)}
                          className="bg-slate-900 text-[10px] border border-slate-800 rounded px-2 py-1 flex-1 text-white"
                          placeholder="CUIT 11 dígitos"
                        />
                        <button
                          type="button"
                          onClick={handleQueryAfip}
                          disabled={isQueryingAfip}
                          className="bg-slate-800 hover:bg-slate-700 text-slate-200 px-2 rounded text-[9px] font-mono border border-slate-700 shrink-0"
                        >
                          AFIP
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-slate-400 text-[9px] mb-0.5">DNI de Identidad</label>
                      <div className="flex gap-1.5">
                        <input
                          type="text"
                          value={dni}
                          onChange={(e) => setDni(e.target.value)}
                          className="bg-slate-900 text-[10px] border border-slate-800 rounded px-2 py-1 flex-1 text-white"
                          placeholder="DNI del chofer"
                        />
                        <button
                          type="button"
                          onClick={handleQueryLinti}
                          disabled={isQueryingLinti}
                          className="bg-slate-800 hover:bg-slate-700 text-slate-200 px-2 rounded text-[9px] font-mono border border-slate-700 shrink-0"
                        >
                          ANSV
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-slate-400 text-[9px] mb-0.5">Patente Camión</label>
                        <input
                          type="text"
                          value={patenteChasis}
                          onChange={(e) => setPatenteChasis(e.target.value)}
                          className="bg-slate-900 text-[10px] border border-slate-800 rounded px-2 py-1 w-full text-white"
                          placeholder="AA123AA"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-400 text-[9px] mb-0.5">Patente Acoplado</label>
                        <input
                          type="text"
                          value={acopladoPatente}
                          onChange={(e) => setAcopladoPatente(e.target.value)}
                          className="bg-slate-900 text-[10px] border border-slate-800 rounded px-2 py-1 w-full text-white"
                          placeholder="AB987CD"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-slate-400 text-[9px] mb-0.5">Licencia LiNTI Validada</label>
                      <input
                        type="text"
                        value={linti}
                        readOnly
                        className="bg-slate-900/60 text-[10px] border border-slate-800 text-slate-400 rounded px-2 py-1 w-full cursor-not-allowed font-mono"
                        placeholder="Pulse ANSV arriba"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[10px] py-2 rounded-lg transition-colors uppercase font-mono mt-2"
                  >
                    Enviar Auditoría KYC
                  </button>
                </form>
              </div>
            ) : (
              /* OPERATIONAL PORTAL */
              <div className="space-y-4">
                
                {/* INTERACTIVE NAVIGATION INSIDE THE APP */}
                <div className="grid grid-cols-3 gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800 text-[10px] font-bold">
                  <button
                    onClick={() => setActiveTab("CARTELERA")}
                    className={`py-1 rounded text-center ${
                      activeTab === "CARTELERA" ? "bg-emerald-600 text-white" : "text-slate-400"
                    }`}
                  >
                    Bolsa
                  </button>
                  <button
                    onClick={() => setActiveTab("VIAJE_ACTIVO")}
                    className={`py-1 rounded text-center relative ${
                      activeTab === "VIAJE_ACTIVO" ? "bg-emerald-600 text-white" : "text-slate-400"
                    }`}
                  >
                    Ruta
                    {activeTrip && <span className="absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full bg-amber-400"></span>}
                  </button>
                  <button
                    onClick={() => setActiveTab("COMISIONES")}
                    className={`py-1 rounded text-center ${
                      activeTab === "COMISIONES" ? "bg-emerald-600 text-white" : "text-slate-400"
                    }`}
                  >
                    Comisiones
                  </button>
                </div>

                {/* TAB 1: CARTELERA DE VIAJES DISPONIBLES */}
                {activeTab === "CARTELERA" && (
                  <div className="space-y-3.5">
                    
                    {/* Algoritmo de Match Geográfico Simulator Header */}
                    <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[9px] font-mono uppercase tracking-wider text-slate-400 flex items-center gap-1">
                          <Compass className="h-3 w-3 animate-spin text-emerald-400" /> Ola de Match de Radio
                        </span>
                        <span className="bg-slate-900 text-emerald-400 font-mono text-[9px] px-1.5 py-0.5 rounded border border-slate-800">
                          {radiusFilter === 30 ? "Ola 1: 0-30km" : radiusFilter === 80 ? "Ola 2: 30-80km" : "Ola 3: Nacional"}
                        </span>
                      </div>
                      
                      {/* Interactive Radio matches */}
                      <div className="grid grid-cols-3 gap-1.5">
                        <button
                          onClick={() => setRadiusFilter(30)}
                          className={`py-1 text-[9px] font-bold rounded-md border text-center ${
                            radiusFilter === 30 ? "bg-emerald-950/40 text-emerald-400 border-emerald-500/20" : "bg-slate-900 text-slate-500 border-transparent"
                          }`}
                        >
                          Ola 1 (30km)
                        </button>
                        <button
                          onClick={() => setRadiusFilter(80)}
                          className={`py-1 text-[9px] font-bold rounded-md border text-center ${
                            radiusFilter === 80 ? "bg-emerald-950/40 text-emerald-400 border-emerald-500/20" : "bg-slate-900 text-slate-500 border-transparent"
                          }`}
                        >
                          Ola 2 (80km)
                        </button>
                        <button
                          onClick={() => setRadiusFilter(999)}
                          className={`py-1 text-[9px] font-bold rounded-md border text-center ${
                            radiusFilter === 999 ? "bg-emerald-950/40 text-emerald-400 border-emerald-500/20" : "bg-slate-900 text-slate-500 border-transparent"
                          }`}
                        >
                          Ola 3 (País)
                        </button>
                      </div>

                      {/* Race simulation switch */}
                      <div className="pt-2 border-t border-slate-900 flex items-center justify-between text-[10px]">
                        <span className="text-slate-400 flex items-center gap-1">
                          <Lock className="h-3 w-3 text-slate-500" /> Transacción Anti-Duplicada:
                        </span>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={simulateRace}
                            onChange={(e) => setSimulateRace(e.target.checked)}
                            className="sr-only peer"
                          />
                          <div className="w-7 h-4 bg-slate-800 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-emerald-500"></div>
                          <span className="ml-1.5 text-[9px] font-mono text-slate-300">{simulateRace ? "Bot ON" : "Bot OFF"}</span>
                        </label>
                      </div>
                    </div>

                    {/* Job Cards */}
                    {filteredTripsByRadius.length === 0 ? (
                      <div className="text-center py-8 bg-slate-950/30 rounded-xl border border-slate-850">
                        <Clock className="h-6 w-6 text-slate-600 mx-auto mb-1 animate-pulse" />
                        <p className="text-slate-400 text-[10px] font-bold">No hay cargas disponibles en este radio</p>
                        <p className="text-slate-500 text-[9px] mt-0.5">Pruebe expandir el radio de coincidencia o publicar una carga desde el Productor.</p>
                      </div>
                    ) : (
                      <div className="space-y-3 max-h-[300px] overflow-y-auto">
                        {filteredTripsByRadius.map((t) => {
                          const dist = getSimulatedDistance(t);
                          return (
                            <div key={t.id} className="bg-slate-950 rounded-xl p-3 border border-slate-800 space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="bg-emerald-950 text-emerald-400 font-extrabold text-[9px] px-2 py-0.5 rounded border border-emerald-500/20">
                                  {t.categoria_carga}
                                </span>
                                <span className="text-slate-400 text-[9px] font-mono">
                                  {dist} km de distancia
                                </span>
                              </div>

                              <div className="space-y-1">
                                <div className="flex items-start gap-1">
                                  <MapPin className="h-3 w-3 text-emerald-500 shrink-0 mt-0.5" />
                                  <p className="text-[10px] text-slate-300 truncate leading-snug"><b>Carga:</b> {t.origen.direccion}</p>
                                </div>
                                <div className="flex items-start gap-1">
                                  <MapPin className="h-3 w-3 text-blue-400 shrink-0 mt-0.5" />
                                  <p className="text-[10px] text-slate-400 truncate leading-snug"><b>Descarga:</b> {t.destino.direccion}</p>
                                </div>
                              </div>

                              <div className="pt-2 border-t border-slate-900 flex items-center justify-between">
                                <div>
                                  <span className="text-slate-500 text-[8px] block uppercase font-mono">Pago Flete</span>
                                  <span className="text-emerald-400 font-bold font-mono text-[11px]">
                                    ${(t.tarifa_ofrecida).toLocaleString("es-AR")} ARS
                                  </span>
                                </div>

                                <button
                                  id={`take-trip-btn-${t.id}`}
                                  onClick={() => handleTakeTripClick(t)}
                                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-[9px] px-3 py-1.5 rounded-md flex items-center gap-1"
                                >
                                  Tomar Viaje
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* TAB 2: VIAJE ACTIVO / HOJA DE RUTA */}
                {activeTab === "VIAJE_ACTIVO" && (
                  <div className="space-y-4">
                    {!activeTrip ? (
                      <div className="text-center py-10 bg-slate-950/30 rounded-xl border border-slate-850">
                        <Truck className="h-8 w-8 text-slate-600 mx-auto mb-2 animate-bounce" />
                        <p className="text-slate-300 text-xs font-bold uppercase tracking-wider">Sin Ruta Asignada</p>
                        <p className="text-slate-400 text-[9px] mt-1 max-w-[240px] mx-auto leading-normal">
                          No posee viajes activos. Seleccione la solapa <b>Bolsa</b> para capturar un viaje disponible.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-3.5">
                        
                        {/* Map Simulator */}
                        <div className="h-28 bg-slate-950 rounded-xl border border-slate-800 relative overflow-hidden flex items-center justify-center">
                          {/* Map grids background animation */}
                          <div className="absolute inset-0 bg-slate-950 grid grid-cols-6 grid-rows-4 opacity-25">
                            {Array.from({ length: 24 }).map((_, i) => (
                              <div key={i} className="border-r border-b border-emerald-500/25"></div>
                            ))}
                          </div>
                          
                          {/* Route line */}
                          <svg className="absolute inset-0 h-full w-full stroke-emerald-500/40 stroke-[2] fill-none stroke-dasharray-[4]">
                            <path d="M 50,80 Q 150,20 300,50" />
                          </svg>

                          <div className="absolute top-4 left-6 flex items-center gap-1.5">
                            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-ping"></span>
                            <span className="text-[9px] font-mono text-emerald-400">Camión en geohash: {activeTrip.origen.geohash}</span>
                          </div>

                          <div className="text-center z-10 p-2 space-y-1">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-white">Estado de Ruta</p>
                            <span className="bg-emerald-600 text-white font-extrabold text-[9px] px-2 py-0.5 rounded-full uppercase">
                              {activeTrip.estado}
                            </span>
                          </div>
                        </div>

                        {/* Visual Progress Stepper */}
                        <StatusStepper estado={activeTrip.estado} theme="dark" />

                        {/* Trip Info details */}
                        <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-2.5 text-xs">
                          <div className="flex justify-between border-b border-slate-900 pb-1.5">
                            <span className="text-slate-400 text-[9px]">Grano de Carga:</span>
                            <span className="font-bold text-emerald-400">{activeTrip.categoria_carga} ({activeTrip.peso_kg} Tn)</span>
                          </div>
                          <div className="space-y-1.5">
                            <p className="text-[10px] text-slate-300 truncate">
                              <span className="text-slate-400 font-semibold">Carga:</span> {activeTrip.origen.direccion}
                            </p>
                            <p className="text-[10px] text-slate-300 truncate">
                              <span className="text-slate-400 font-semibold">Descarga:</span> {activeTrip.destino.direccion}
                            </p>
                          </div>
                          <div className="flex justify-between border-t border-slate-900 pt-1.5">
                            <span className="text-slate-400 text-[9px]">Tarifa Total:</span>
                            <span className="font-bold font-mono text-white">${(activeTrip.tarifa_ofrecida).toLocaleString("es-AR")} ARS</span>
                          </div>
                        </div>

                        {/* Timeline Status actions */}
                        <div className="space-y-2">
                          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider font-mono">Actualizar Estado de Viaje</p>
                          
                          {activeTrip.estado === "ASIGNADO" && (
                            <button
                              onClick={() => onStepTrip(activeTrip.id, "EN_CARGA")}
                              className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs py-2.5 rounded-lg flex items-center justify-center gap-1.5 transition-colors"
                            >
                              <Check className="h-4 w-4" /> Confirmar Carga en Silo
                            </button>
                          )}

                          {activeTrip.estado === "EN_CARGA" && (
                            <button
                              onClick={() => onStepTrip(activeTrip.id, "EN_TRANSITO")}
                              className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs py-2.5 rounded-lg flex items-center justify-center gap-1.5 transition-colors"
                            >
                              <Compass className="h-4 w-4 animate-spin" /> Iniciar Ruta (Camino al Puerto)
                            </button>
                          )}

                          {activeTrip.estado === "EN_TRANSITO" && (
                            <div className="bg-amber-950/20 border border-amber-500/20 p-3 rounded-lg text-center text-[10px] text-amber-300">
                              <span>El viaje está en tránsito. El productor registrará la descarga y el pago al recibir la carta de porte digital.</span>
                            </div>
                          )}

                          <button
                            onClick={() => handleCancelActiveTrip(activeTrip.id)}
                            className="w-full bg-slate-950 text-rose-400 hover:bg-rose-950/20 font-bold text-[10px] py-2 rounded-lg border border-slate-800 flex items-center justify-center gap-1 transition-colors"
                          >
                            <AlertTriangle className="h-3 w-3" /> Cancelar Viaje (Sujeto a multa)
                          </button>
                        </div>

                      </div>
                    )}
                  </div>
                )}

                {/* TAB 3: COMISIONES POR DEPÓSITO */}
                {activeTab === "COMISIONES" && (
                  <div className="space-y-4">
                    <div className="bg-gradient-to-br from-emerald-600 to-teal-800 p-4 rounded-xl text-white shadow-md relative overflow-hidden">
                      <div className="absolute right-0 bottom-0 opacity-10">
                        <Truck className="h-28 w-28" />
                      </div>
                      <span className="text-[8px] font-mono uppercase tracking-wider block text-emerald-100">Comisión de plataforma (3% · 40 días)</span>
                      <span className="text-xl font-bold block font-mono mt-1">
                        ${viajes
                          .filter((v) => v.chofer_id === activeChofer?.id && v.pago_comision_camionero_estado !== "ABONADA")
                          .reduce((sum, v) => sum + v.tarifa_ofrecida * 0.03, 0)
                          .toLocaleString("es-AR", { minimumFractionDigits: 2 })} ARS
                      </span>
                      <p className="text-[9px] text-emerald-100 mt-2 leading-relaxed">
                        Deposite en la cuenta de AgroFlet y suba el comprobante. El cobro del flete se acuerda directamente con el productor.
                      </p>
                    </div>

                    <div className="space-y-2">
                      <h6 className="text-[9px] font-bold text-slate-400 uppercase tracking-wider font-mono mb-2">Viajes y comisiones</h6>
                      <MovimientosTable
                        usuarios={usuarios}
                        viajes={viajes}
                        activeUserId={activeChofer?.id || activeUserId}
                        userRole="CAMIONERO"
                        variant="dense"
                        onUploadCamioneroReceipt={onUploadCamioneroReceipt}
                      />
                    </div>
                  </div>
                )}

              </div>
            )}

          </div>

          {/* Phone simulated navigation bar bottom button */}
          <div className="bg-slate-950 pt-2 pb-5 text-center shrink-0">
            <div className="h-1 w-28 bg-slate-800 rounded-full mx-auto"></div>
          </div>

        </div>
      </div>

    </div>
    </div>
  );
}

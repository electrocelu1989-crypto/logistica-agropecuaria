import React, { useState } from "react";
import { Usuario, Viaje, Vehiculo } from "../types";
import { AlertTriangle, MapPin, ArrowRight, Sparkles, CheckCircle, Clock, Ban, HelpCircle, FileText, Layers, Truck } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import RealTimeMap from "./RealTimeMap";
import StatusStepper from "./StatusStepper";
import MovimientosTable from "./MovimientosTable";
import UserProfileOnboarding from "./UserProfileOnboarding";

interface ProductorViewProps {
  usuarios: Usuario[];
  vehiculos: Vehiculo[];
  viajes: Viaje[];
  activeUserId: string;
  onPublishTrip: (tripData: any) => Promise<boolean>;
  onCancelTrip: (tripId: string, cancelData: any) => Promise<any>;
  onStepTrip: (tripId: string, nextState: string) => Promise<void>;
  onUploadPublicationReceipt: (tripId: string, payload: { fileName: string; mimeType: string; dataUrl: string }) => Promise<boolean>;
  onboardingStatus?: { completado?: boolean; estado?: string };
  onOnboardingComplete?: () => void;
}

// Direcciones dinámicas desde el perfil del usuario

export default function ProductorView({
  usuarios,
  vehiculos,
  viajes,
  activeUserId,
  onPublishTrip,
  onCancelTrip,
  onStepTrip,
  onUploadPublicationReceipt,
  onboardingStatus,
  onOnboardingComplete
}: ProductorViewProps) {
  // Filters for active producers
  const activeProductor = usuarios.find((u) => u.id === activeUserId && u.rol === "PRODUCTOR") || null;

  if (!activeProductor) {
    return (
      <div className="bg-white rounded-xl p-6 border border-slate-200 text-slate-700">
        No se encontró el productor activo. Inicie sesión con una cuenta de productor para continuar.
      </div>
    );
  }

  // Forms state
  const [categoriaCarga, setCategoriaCarga] = useState<"MUDANZA" | "GENERAL" | "PELIGROSA" | "GRANOS" | "REFRIGERADA">("MUDANZA");
  const [peso_kg, setPesoKg] = useState<number>(1000);
  const [volumen_m3, setVolumenM3] = useState<number>(0);
  const [carroceria, setCarroceria] = useState<"TOLVA" | "BARANDA_VOLCABLE" | "BATEA" | "TODO_PUERTAS" | "FURGON" | "PLAYO">("FURGON")
  const [origenIdx, setOrigenIdx] = useState<number>(0);
  const [destinoIdx, setDestinoIdx] = useState<number>(0);
  const [fechaCarga, setFechaCarga] = useState<string>("2026-07-01T10:00");
  const [customTariff, setCustomTariff] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const comisionPendiente = viajes
    .filter((v) => v.dador_carga_id === activeProductor.id && v.pago_publicacion_estado !== "ABONADA")
    .reduce((sum, viaje) => sum + viaje.tarifa_ofrecida * 0.03, 0);

  const [isPublishedSuccess, setIsPublishedSuccess] = useState<boolean>(false);
  const [showOnboardingModal, setShowOnboardingModal] = useState<boolean>(false);
  const formatCurrency = (amount: number) =>
    amount.toLocaleString("es-AR", { style: "currency", currency: "ARS", minimumFractionDigits: 2 });

  const formatDateTime = (value: string) =>
    new Date(value).toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" });

  // Computed tariff values (simulated Distance Matrix API behavior)
  const calculateDistance = () => {
    if (!activeProductor?.direcciones || activeProductor.direcciones.length === 0) return 0;
    const o = activeProductor.direcciones[origenIdx] || activeProductor.direcciones[0];
    const d = activeProductor.direcciones[destinoIdx] || activeProductor.direcciones[0];
    if (!o || !d) return 0;
    const distLat = Math.abs(o.lat - d.lat);
    const distLng = Math.abs(o.lng - d.lng);
    return Math.round((distLat + distLng) * 111); // very rough approx km
  };

  const distance = calculateDistance();
  const standardRatePerTon = 40;
  const simulatedTariff = Math.round(distance * standardRatePerTon);
  const finalTariffPerTon = customTariff ? Number(customTariff) : simulatedTariff;
  const totalTripValue = finalTariffPerTon;

  // Trips of this producer
  const activeProducerTrips = viajes.filter((v) => v.dador_carga_id === activeProductor?.id);

  const handleCreateTrip = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeProductor) return;

    if (!onboardingStatus?.completado) {
      setShowOnboardingModal(true);
      return;
    }

    if (onboardingStatus?.estado === "PENDIENTE") {
      alert("Su cuenta se encuentra PENDIENTE de aprobación legal. No puede publicar viajes hasta ser aprobado.");
      return;
    }

    if (onboardingStatus?.estado === "RECHAZADO") {
      alert("Su cuenta fue RECHAZADA. Verifique su información legal.");
      setShowOnboardingModal(true);
      return;
    }

    const direcciones = activeProductor.direcciones || [];
    if (direcciones.length < 2) {
      alert("Debe cargar al menos dos direcciones (un origen y un destino) en 'Mi Perfil' para poder publicar viajes.");
      return;
    }

    const confirmacion = window.confirm(
      "Al publicar esta carga usted acepta los términos de uso de AgroFlet.\n\n" +
      "La plataforma registra el monto de la operación. El pago del flete se acuerda directamente con el transportista.\n" +
      "Usted deberá depositar el 3% del valor total como comisión de uso de la plataforma dentro de 30 días corridos.\n\n" +
      "¿Desea continuar con la publicación?"
    );
    if (!confirmacion) return;

    const o = (direcciones[origenIdx] || direcciones[0])!;
    const d = (direcciones[destinoIdx] || direcciones[0])!;

    setIsLoading(true);
    const payload = {
      dador_carga_id: activeProductor.id,
      categoria_carga: categoriaCarga,
      volumen_m3: volumen_m3,
      peso_kg,
      tipo_carroceria_requerida: carroceria,
      tarifa_ofrecida: finalTariffPerTon,
      fecha_carga_pactada: new Date(fechaCarga).toISOString(),
      origen: {
        direccion: o.direccion,
        lat: o.lat,
        lng: o.lng,
        geohash: o.geohash || ""
      },
      destino: {
        direccion: d.direccion,
        lat: d.lat,
        lng: d.lng
      }
    };

    try {
      const success = await onPublishTrip(payload);
      if (success) {
        setIsPublishedSuccess(true);
        setTimeout(() => setIsPublishedSuccess(false), 3000);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancelTrip = async (tripId: string) => {
    const confirmCancel = window.confirm(
      "¿Confirma la cancelación de este viaje?\n\n" +
      "La cancelación quedará registrada. Los pagos del flete se acuerdan directamente entre usted y el transportista."
    );

    if (confirmCancel) {
      await onCancelTrip(tripId, {
        cancelador_id: activeProductor.id,
        motivo: "CANCELACION_PRODUCTOR",
        detalle: "El productor solicitó cancelación desde su panel de control."
      });
    }
  };

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
              currentUser={activeProductor}
              onComplete={() => {
                setShowOnboardingModal(false);
                if (onOnboardingComplete) onOnboardingComplete();
              }}
            />
          </div>
        </div>
      )}
      <div className="bg-white rounded-xl p-6 border border-slate-200 card-shadow flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <label className="block text-slate-500 text-xs font-bold uppercase tracking-wider mb-1.5">Productor Agropecuario Activo</label>
          <div className="text-slate-900 font-semibold">{activeProductor.razon_social}</div>
          <p className="text-slate-500 text-xs mt-1.5">
            CUIT: <span className="text-slate-700 font-mono text-[11px]">{activeProductor.cuit}</span>
          </p>
          <p className="text-slate-500 text-xs mt-1.5">
            Domicilio: <span className="text-slate-700 font-mono text-[11px]">{activeProductor.domicilio_fiscal}</span>
          </p>
        </div>

        {/* Estado KYC y comisiones pendientes */}
        <div className="flex flex-wrap gap-4">
          <div className="bg-slate-50 px-4 py-3 rounded-lg border border-slate-200 flex items-center gap-3">
            <div>
              <p className="text-slate-500 text-[10px] uppercase font-bold tracking-wider">Estado KYC</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className={`h-2.5 w-2.5 rounded-full ${
                  activeProductor?.estado_cuenta === "APROBADO" ? "bg-[#10b981]" : "bg-amber-500 animate-pulse"
                }`}></span>
                <span className="text-slate-800 text-xs font-extrabold uppercase">{activeProductor?.estado_cuenta}</span>
              </div>
            </div>
          </div>

          <div className={`px-4 py-3 rounded-lg border flex items-center gap-3 ${
            comisionPendiente === 0
              ? "bg-emerald-50 border-emerald-200"
              : "bg-amber-50 border-amber-200"
          }`}>
            <div>
              <p className="text-slate-500 text-[10px] uppercase font-bold tracking-wider">Comisión pendiente (3% · 30 días)</p>
              <span className={`text-sm font-extrabold block mt-0.5 ${
                comisionPendiente === 0 ? "text-emerald-700" : "text-amber-700"
              }`}>
                ${comisionPendiente.toLocaleString("es-AR", { minimumFractionDigits: 2 })} ARS
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Mapa de Monitoreo en Tiempo Real */}
      <RealTimeMap
        usuarios={usuarios}
        vehiculos={vehiculos}
        viajes={viajes}
        userRole="PRODUCTOR"
        activeUserId={activeProductor?.id || activeUserId}
      />

      {/* Grids de Publicación de Carga e Historial */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Formulario Nueva Carga (Col 5) */}
        <div className="lg:col-span-5 bg-white rounded-xl p-6 border border-slate-200 flex flex-col justify-between card-shadow">
          <div>
            <h3 className="text-slate-800 font-bold text-base flex items-center gap-2 mb-4">
              <FileText className="text-[#10b981] h-5 w-5" />
              Nueva Publicación de Carga
            </h3>

            <form onSubmit={handleCreateTrip} className="space-y-4">
              {/* Tipo de grano */}
              <div>
                <label className="block text-slate-500 text-xs font-bold mb-1.5">Categoría de Carga</label>
                <div className="grid grid-cols-5 gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200">
                  {(["MUDANZA", "GENERAL", "PELIGROSA", "GRANOS", "REFRIGERADA"] as const).map((g) => (
                    <button
                      key={g}
                      type="button"
                      onClick={() => setCategoriaCarga(g)}
                      className={`py-1 text-[10px] font-bold rounded transition-all ${
                        categoriaCarga === g ? "bg-[#10b981] text-white shadow-sm" : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      {g}
                    </button>
                  ))}
                </div>
              </div>

              {/* Toneladas y Tipo Carroceria */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-500 text-xs font-bold mb-1.5">Peso (Kg)</label>
                  <input
                    type="number"
                    value={peso_kg}
                    min={1}
                    max={50}
                    onChange={(e) => setPesoKg(Number(e.target.value))}
                    className="bg-white border border-slate-200 text-slate-850 text-xs rounded-lg px-3 py-2 w-full focus:outline-none focus:border-[#10b981] focus:ring-1 focus:ring-[#10b981] shadow-xs"
                  />
                </div>
                <div>
                  <label className="block text-slate-500 text-xs font-bold mb-1.5">Carrocería Requerida</label>
                  <select
                    value={carroceria}
                    onChange={(e: any) => setCarroceria(e.target.value)}
                    className="bg-white border border-slate-200 text-slate-850 text-xs rounded-lg px-3 py-2 w-full focus:outline-none focus:border-[#10b981] focus:ring-1 focus:ring-[#10b981] shadow-xs"
                  >
                    <option value="TOLVA" className="text-slate-800">Tolva (Granos)</option>
                    <option value="BARANDA_VOLCABLE" className="text-slate-800">Baranda Volcable</option>
                    <option value="BATEA" className="text-slate-800">Batea</option>
                    <option value="TODO_PUERTAS" className="text-slate-800">Todo Puertas</option>
                  </select>
                </div>
              </div>

              {/* Origen */}
              <div>
                <label className="block text-slate-500 text-xs font-bold mb-1.5 flex items-center gap-1">
                  <MapPin className="h-3 w-3 text-[#10b981]" /> Origen de la Carga (Establecimiento)
                </label>
                {(activeProductor?.direcciones?.length || 0) === 0 ? (
                  <p className="text-rose-500 text-xs py-2 bg-rose-50 rounded-lg px-3 border border-rose-100">
                    Por favor agregue direcciones en "Mi Perfil"
                  </p>
                ) : (
                  <select
                    value={origenIdx}
                    onChange={(e) => setOrigenIdx(Number(e.target.value))}
                    className="bg-white border border-slate-200 text-slate-850 text-xs rounded-lg px-3 py-2 w-full focus:outline-none focus:border-[#10b981] focus:ring-1 focus:ring-[#10b981] font-mono shadow-xs"
                  >
                    {activeProductor?.direcciones?.map((o, idx) => (
                      <option key={idx} value={idx} className="text-slate-800">
                        {o.alias} - {o.direccion}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Destino */}
              <div>
                <label className="block text-slate-500 text-xs font-bold mb-1.5 flex items-center gap-1">
                  <MapPin className="h-3 w-3 text-blue-500" /> Puerto de Destino / Acopio
                </label>
                {(activeProductor?.direcciones?.length || 0) === 0 ? (
                  <p className="text-rose-500 text-xs py-2 bg-rose-50 rounded-lg px-3 border border-rose-100">
                    Por favor agregue direcciones en "Mi Perfil"
                  </p>
                ) : (
                  <select
                    value={destinoIdx}
                    onChange={(e) => setDestinoIdx(Number(e.target.value))}
                    className="bg-white border border-slate-200 text-slate-850 text-xs rounded-lg px-3 py-2 w-full focus:outline-none focus:border-[#10b981] focus:ring-1 focus:ring-[#10b981] font-mono shadow-xs"
                  >
                    {activeProductor?.direcciones?.map((d, idx) => (
                      <option key={idx} value={idx} className="text-slate-800">
                        {d.alias} - {d.direccion}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Fecha y Tarifa Personalizada */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-500 text-xs font-bold mb-1.5">Fecha de Carga</label>
                  <input
                    type="datetime-local"
                    value={fechaCarga}
                    onChange={(e) => setFechaCarga(e.target.value)}
                    className="bg-white border border-slate-200 text-slate-850 text-[11px] rounded-lg px-2.5 py-2 w-full focus:outline-none focus:border-[#10b981] focus:ring-1 focus:ring-[#10b981] shadow-xs"
                  />
                </div>
                <div>
                  <label className="block text-slate-500 text-xs font-bold mb-1.5">Tarifa x Ton (Opcional)</label>
                  <input
                    type="number"
                    value={customTariff}
                    onChange={(e) => setCustomTariff(e.target.value)}
                    placeholder={`Surg. ($${standardRatePerTon})`}
                    className="bg-white border border-slate-200 text-slate-850 text-xs rounded-lg px-3 py-2 w-full focus:outline-none focus:border-[#10b981] focus:ring-1 focus:ring-[#10b981] placeholder-slate-400 shadow-xs"
                  />
                </div>
              </div>
            </form>
          </div>

          {/* Resumen de costos y Enviar */}
          <div className="pt-6 border-t border-slate-100 mt-6 space-y-4">
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/65 space-y-2">
              <div className="flex justify-between text-xs text-slate-500">
                <span>Distancia Estimada:</span>
                <span className="text-slate-800 font-bold">{distance} km</span>
              </div>
              <div className="flex justify-between text-xs text-slate-500">
                <span>Tarifa por Tonelada:</span>
                <span className="text-slate-800 font-mono">${finalTariffPerTon.toLocaleString("es-AR")} ARS</span>
              </div>
              <div className="flex justify-between text-xs border-t border-slate-200/80 pt-2 font-bold">
                <span className="text-slate-600">Valor Total de Flete:</span>
                <span className="text-emerald-600 font-extrabold font-mono text-sm">${totalTripValue.toLocaleString("es-AR")} ARS</span>
              </div>
            </div>

            <button
              id="submit-load-btn"
              onClick={handleCreateTrip}
              disabled={isLoading}
              className="w-full py-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 bg-[#10b981] hover:bg-emerald-600 text-white cursor-pointer shadow-md disabled:opacity-60"
            >
              <Sparkles className="h-4 w-4" />
              Publicar Carga en la Cartelera
            </button>
            <AnimatePresence>
              {isPublishedSuccess && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs py-2 rounded-lg text-center font-bold shadow-xs"
                >
                  ✓ Carga publicada con geohash indexado
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Listado de Viajes del Productor (Col 7) */}
        <div className="lg:col-span-7 bg-white rounded-xl p-6 border border-slate-200 shadow-sm card-shadow flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-slate-800 font-bold text-base flex items-center gap-2">
                <Layers className="text-[#10b981] h-5 w-5" />
                Mis Cargas y Viajes Publicados
              </h3>
              <span className="bg-slate-50 text-slate-500 px-2 py-1 rounded text-[11px] font-mono border border-slate-200">
                Viajes: {activeProducerTrips.length}
              </span>
            </div>

            {activeProducerTrips.length === 0 ? (
              <div className="text-center py-12 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50/50">
                <HelpCircle className="h-10 w-10 text-slate-400 mx-auto mb-2" />
                <p className="text-slate-600 text-xs font-bold">No se encontraron cargas publicadas</p>
                <p className="text-slate-400 text-[11px] mt-1">Utilice el panel de la izquierda para emitir su primer flete</p>
              </div>
            ) : (
              <div className="space-y-3.5 max-h-[460px] overflow-y-auto pr-1">
                {activeProducerTrips.map((v) => {
                  const assignedDriver = v.chofer_id ? usuarios.find((u) => u.id === v.chofer_id) : null;
                  const totalLoadValue = v.tarifa_ofrecida;
                  const publicationFee = Number((totalLoadValue * 0.03).toFixed(2));
                  const hasReceipt = Boolean(v.comprobante_publicacion?.fileName);
                  const isPublicationPaid = v.pago_publicacion_estado === "ABONADA";
                  return (
                    <div key={v.id} className={`border rounded-xl p-4 space-y-3 transition-all shadow-xs ${
                      isPublicationPaid
                        ? "bg-emerald-50/60 border-emerald-200"
                        : "bg-slate-50 border-slate-200 hover:border-slate-300"
                    }`}>
                      
                      {/* Header Fila */}
                      <div className="flex items-center justify-between gap-2 border-b border-slate-200/80 pb-2.5">
                        <div className="flex items-center gap-2">
                          <span className="bg-emerald-50 text-emerald-700 text-[10px] font-extrabold px-2.5 py-1 rounded-md border border-emerald-200">
                            {v.categoria_carga}
                          </span>
                          <span className="text-slate-800 text-xs font-extrabold">{v.peso_kg} Kg</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border ${
                            v.estado === "DISPONIBLE" ? "bg-blue-50 text-blue-700 border-blue-200" :
                            v.estado === "ASIGNADO" ? "bg-amber-50 text-amber-700 border-amber-200" :
                            v.estado === "CANCELADO" ? "bg-rose-50 text-rose-700 border-rose-200" :
                            "bg-emerald-50 text-emerald-700 border-emerald-200 animate-pulse"
                          }`}>
                            {v.estado}
                          </span>
                          {isPublicationPaid && (
                            <span className="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border bg-emerald-100 text-emerald-800 border-emerald-300">
                              CARGA ABONADA
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="bg-white rounded-lg border border-slate-200 p-3 grid grid-cols-1 md:grid-cols-2 gap-2 text-[11px] shadow-xs">
                        <p className="text-slate-500">
                          ID carga publicada: <b className="text-slate-800 font-mono">{v.id}</b>
                        </p>
                        <p className="text-slate-500">
                          Fecha y hora: <b className="text-slate-800">{formatDateTime(v.fecha_creacion)}</b>
                        </p>
                        <p className="text-slate-500 md:col-span-2">
                          Descripcion y detalle: <b className="text-slate-800">{v.categoria_carga} - {v.peso_kg} Kg - {(v.tipo_carroceria_requerida || "").replaceAll("_", " ")}</b>
                        </p>
                        <p className="text-slate-500">
                          Importe total: <b className="text-emerald-700 font-mono">{formatCurrency(totalLoadValue)}</b>
                        </p>
                        <p className="text-slate-500">
                          Importe 3%: <b className="text-amber-700 font-mono">{formatCurrency(publicationFee)}</b>
                        </p>
                      </div>

                      {/* Info de ruta */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                        <div className="flex items-start gap-1.5">
                          <MapPin className="h-3.5 w-3.5 text-emerald-500 shrink-0 mt-0.5" />
                          <span className="text-slate-500 text-[11px]">
                            De: <b className="text-slate-700 font-semibold">{v.origen.direccion}</b>
                          </span>
                        </div>
                        <div className="flex items-start gap-1.5">
                          <MapPin className="h-3.5 w-3.5 text-blue-500 shrink-0 mt-0.5" />
                          <span className="text-slate-500 text-[11px]">
                            A: <b className="text-slate-700 font-semibold">{v.destino.direccion}</b>
                          </span>
                        </div>
                      </div>

                      {/* Visual Progress Stepper */}
                      <StatusStepper estado={v.estado} theme="light" />

                      {/* Driver info if assigned */}
                      {assignedDriver ? (
                        <div className="bg-white p-2.5 rounded-lg border border-slate-200 flex flex-col md:flex-row items-start md:items-center justify-between gap-2 shadow-xs">
                          <div className="flex items-center gap-2">
                            <Truck className="h-4 w-4 text-emerald-600" />
                            <div>
                              <p className="text-slate-700 font-bold text-[11px] leading-tight">{assignedDriver.razon_social}</p>
                              <p className="text-slate-500 text-[10px] leading-none">Tel: {assignedDriver.telefono}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 bg-slate-50 px-2 py-1 rounded text-[10px] font-mono border border-slate-200">
                            <span className="text-slate-500 font-bold">PATENTE:</span>
                            <span className="text-slate-800 font-extrabold">AA123AA</span>
                          </div>
                        </div>
                      ) : (
                        v.estado === "DISPONIBLE" && (
                          <div className="text-[11px] text-slate-500 flex items-center gap-1.5 bg-white p-2 rounded border border-slate-200 font-mono shadow-xs">
                            <Clock className="h-3.5 w-3.5 animate-spin text-slate-400" />
                            <span>Esperando match con camioneros dentro de la Ola de Radio...</span>
                          </div>
                        )
                      )}

                      {/* Tarifa y botones de acción */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pt-2.5 border-t border-slate-200">
                        <div className="text-[11px] text-slate-500">
                          Tarifa acordada: <b className="text-emerald-700 font-extrabold font-mono">{formatCurrency(totalLoadValue)}</b>
                        </div>
                        <div className="text-[11px] text-slate-500 text-right md:text-left">
                          Depósito 3%: <b className="text-amber-700 font-extrabold">{formatCurrency(publicationFee)}</b>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 items-center pt-2">
                        <div className="text-[11px] text-slate-500">
                          Estado pago publicación: <span className={`font-bold ${v.pago_publicacion_estado === "ABONADA" ? "text-emerald-700" : "text-amber-700"}`}>
                            {v.pago_publicacion_estado === "ABONADA" ? "ABONADA" : "PENDIENTE"}
                          </span>
                        </div>
                        <div className="flex flex-wrap justify-end gap-2 md:justify-end">
                          {v.pago_publicacion_estado !== "ABONADA" && hasReceipt && (
                            <span className="text-[10px] text-slate-600 bg-slate-100 px-2 py-1 rounded-full border border-slate-200">
                              Comprobante cargado
                            </span>
                          )}
                          {v.pago_publicacion_estado === "ABONADA" && (
                            <span className="text-[10px] text-emerald-800 bg-emerald-100 px-2 py-1 rounded-full border border-emerald-300 font-extrabold">
                              Carga abonada
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-wrap justify-end gap-2 pt-2">
                          {/* Cancel button triggers Late Penalty system */}
                          {["DISPONIBLE", "ASIGNADO", "EN_CARGA", "EN_TRANSITO"].includes(v.estado) && (
                            <button
                              id={`cancel-trip-${v.id}`}
                              onClick={() => handleCancelTrip(v.id)}
                              className="text-[10px] text-rose-600 hover:text-white bg-white hover:bg-rose-600 px-3 py-1.5 rounded-md border border-rose-200 hover:border-rose-600 font-bold flex items-center gap-1 transition-all shadow-xs"
                            >
                              <Ban className="h-3 w-3" />
                              Cancelar Viaje
                            </button>
                          )}

                          {/* Sim step state buttons for test */}
                          {v.estado === "ASIGNADO" && (
                            <button
                              onClick={() => onStepTrip(v.id, "EN_CARGA")}
                              className="text-[10px] text-white bg-[#10b981] hover:bg-emerald-600 px-3 py-1.5 rounded-md font-bold transition-all shadow-sm"
                            >
                              Registrar Carga
                            </button>
                          )}
                          {v.estado === "EN_CARGA" && (
                            <button
                              onClick={() => onStepTrip(v.id, "EN_TRANSITO")}
                              className="text-[10px] text-white bg-blue-600 hover:bg-blue-500 px-3 py-1.5 rounded-md font-bold transition-all shadow-sm"
                            >
                              Iniciar Tránsito
                            </button>
                          )}
                          {v.estado === "EN_TRANSITO" && (
                            <button
                              onClick={() => onStepTrip(v.id, "ENTREGADO")}
                              className="text-[10px] text-slate-900 bg-amber-400 hover:bg-amber-300 px-3 py-1.5 rounded-md font-bold transition-all shadow-sm"
                            >
                              Registrar Descarga (Pago)
                            </button>
                          )}
                      </div>

                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* SLA Warning */}
          <div className="mt-6 bg-amber-50 border border-amber-200/80 p-4 rounded-xl flex items-start gap-2.5 text-amber-800">
            <AlertTriangle className="h-4.5 w-4.5 text-amber-600 shrink-0 mt-0.5" />
            <p className="text-[11px] text-slate-600 leading-relaxed">
              <b className="text-amber-800">Comisión de plataforma:</b> Al publicar una carga se registra el monto de la operación. Usted debe depositar el 3% en la cuenta de AgroFlet dentro de 30 días corridos. El pago del flete al transportista se acuerda directamente entre las partes.
            </p>
          </div>
        </div>

      </div>

      {/* Registro de comisiones por depósito */}
      <div className="mt-8">
        <MovimientosTable
          usuarios={usuarios}
          viajes={viajes}
          activeUserId={activeProductor?.id || activeUserId}
          userRole="PRODUCTOR"
          variant="full"
          onUploadPublicationReceipt={onUploadPublicationReceipt}
        />
      </div>
    </div>
  );
}

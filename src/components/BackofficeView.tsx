import React, { useState } from "react";
import { Usuario, Vehiculo, Viaje } from "../types";
import { Penalidad } from "../services/penalidades";
import {
  ShieldAlert,
  CheckCircle,
  XCircle,
  Database,
  FileCode,
  Users,
  Briefcase,
  Layers,
  Sparkles,
  Search,
  Eye,
  RefreshCw,
  BadgeAlert,
  Truck
} from "lucide-react";

interface BackofficeViewProps {
  usuarios: Usuario[];
  vehiculos: Vehiculo[];
  viajes: Viaje[];
  penalidades: Penalidad[];
  onApproveUser: (userId: string, action: "APROBAR" | "RECHAZAR") => Promise<void>;
  onConfirmPublicationPayment: (tripId: string) => Promise<void>;
  onConfirmCamioneroCommission: (tripId: string) => Promise<void>;
  onResetDb: () => void;
  schemaInfo: string;
  goSchema: string;
}

export default function BackofficeView({
  usuarios,
  vehiculos,
  viajes,
  penalidades,
  onApproveUser,
  onConfirmPublicationPayment,
  onConfirmCamioneroCommission,
  onResetDb,
  schemaInfo,
  goSchema
}: BackofficeViewProps) {
  const [activeTab, setActiveTab] = useState<"KYC" | "PAGOS" | "PENALIDADES" | "EXPLORER" | "RULES">("KYC");
  const [explorerCollection, setExplorerCollection] = useState<"usuarios" | "vehiculos" | "viajes">("usuarios");

  // Filter pending KYC approvals
  const pendingUsers = usuarios.filter((u) => u.estado_cuenta === "PENDIENTE" && (u.onboarding_completado || u.rol === "CAMIONERO" || u.rol === "PRODUCTOR"));

  type ValidationStatus = "idle" | "loading" | "valid";
  const [validations, setValidations] = useState<Record<string, { afip?: ValidationStatus, linti?: ValidationStatus }>>({});
  const [publicationFilter, setPublicationFilter] = useState<"ALL" | "PENDIENTE" | "ABONADA">("ALL");

  const publicationTrips = viajes.filter((v) =>
    publicationFilter === "ALL" ? true : (v.pago_publicacion_estado || "PENDIENTE") === publicationFilter
  );
  const pendingPublicationPayments = viajes.filter((v) => v.pago_publicacion_estado !== "ABONADA").length;
  const pendingCamioneroCommissions = viajes.filter(
    (v) => v.chofer_id && v.pago_comision_camionero_estado !== "ABONADA"
  ).length;
  const uploadedReceipts = viajes.filter((v) => Boolean(v.comprobante_publicacion?.fileName)).length;
  const camioneroCommissionTrips = viajes.filter((v) => v.chofer_id);
  const formatCurrency = (amount: number) =>
    amount.toLocaleString("es-AR", { style: "currency", currency: "ARS", minimumFractionDigits: 2 });
  const formatDateTime = (value: string) =>
    new Date(value).toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" });

  const handleVerifyAfip = (userId: string) => {
    setValidations((prev) => ({ ...prev, [userId]: { ...prev[userId], afip: "loading" } }));
    setTimeout(() => {
      setValidations((prev) => ({ ...prev, [userId]: { ...prev[userId], afip: "valid" } }));
    }, 1500);
  };

  const handleVerifyLinti = (userId: string) => {
    setValidations((prev) => ({ ...prev, [userId]: { ...prev[userId], linti: "loading" } }));
    setTimeout(() => {
      setValidations((prev) => ({ ...prev, [userId]: { ...prev[userId], linti: "valid" } }));
    }, 1500);
  };

  return (
    <div className="space-y-6">
      
      {/* Admin stats dashboard */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl border border-slate-200 card-shadow shadow-xs">
          <span className="text-slate-400 text-[10px] font-bold block uppercase font-mono tracking-wider">KYC Pendientes</span>
          <span className="text-2xl font-extrabold text-amber-600 mt-1 block">{pendingUsers.length}</span>
          <span className="text-[10px] text-slate-500 block mt-1">Esperando auditoría LINTI/VTV</span>
        </div>
        <div className="bg-white p-5 rounded-xl border border-slate-200 card-shadow shadow-xs">
          <span className="text-slate-400 text-[10px] font-bold block uppercase font-mono tracking-wider">Usuarios Registrados</span>
          <span className="text-2xl font-extrabold text-slate-800 mt-1 block">{usuarios.length}</span>
          <span className="text-[10px] text-slate-500 block mt-1">Productores, Choferes y Admins</span>
        </div>
        <div className="bg-white p-5 rounded-xl border border-slate-200 card-shadow shadow-xs">
          <span className="text-slate-400 text-[10px] font-bold block uppercase font-mono tracking-wider">Bolsa de Viajes</span>
          <span className="text-2xl font-extrabold text-emerald-600 mt-1 block">{viajes.length}</span>
          <span className="text-[10px] text-slate-500 block mt-1">Ofertas totales indexadas</span>
        </div>
        <div className="bg-white p-5 rounded-xl border border-slate-200 card-shadow shadow-xs">
          <span className="text-slate-400 text-[10px] font-bold block uppercase font-mono tracking-wider">Comisiones pendientes</span>
          <span className="text-2xl font-extrabold text-amber-600 mt-1 block">
            {pendingPublicationPayments + pendingCamioneroCommissions}
          </span>
          <span className="text-[10px] text-slate-500 block mt-1">Productor (30d) + Transportista (40d)</span>
        </div>
      </div>

      {/* Control Navigation tabs */}
      <div className="flex border-b border-slate-200 gap-4">
        <button
          onClick={() => setActiveTab("KYC")}
          className={`pb-3 text-xs font-bold uppercase tracking-wider relative flex items-center gap-1.5 transition-all ${
            activeTab === "KYC" ? "text-[#10b981] font-extrabold" : "text-slate-400 hover:text-slate-600"
          }`}
        >
          <ShieldAlert className="h-4 w-4" />
          Auditoría KYC ({pendingUsers.length})
          {activeTab === "KYC" && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#10b981]"></span>}
        </button>
        <button
          onClick={() => setActiveTab("PAGOS")}
          className={`pb-3 text-xs font-bold uppercase tracking-wider relative flex items-center gap-1.5 transition-all ${
            activeTab === "PAGOS" ? "text-[#10b981] font-extrabold" : "text-slate-400 hover:text-slate-600"
          }`}
        >
          <BadgeAlert className="h-4 w-4" />
          Pagos y comisiones ({pendingPublicationPayments + pendingCamioneroCommissions})
          {activeTab === "PAGOS" && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#10b981]"></span>}
        </button>
        <button
          onClick={() => setActiveTab("PENALIDADES")}
          className={`pb-3 text-xs font-bold uppercase tracking-wider relative flex items-center gap-1.5 transition-all ${
            activeTab === "PENALIDADES" ? "text-[#10b981] font-extrabold" : "text-slate-400 hover:text-slate-600"
          }`}
        >
          <ShieldAlert className="h-4 w-4" />
          Penalidades ({penalidades.length})
          {activeTab === "PENALIDADES" && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#10b981]"></span>}
        </button>
        <button
          onClick={() => setActiveTab("EXPLORER")}
          className={`pb-3 text-xs font-bold uppercase tracking-wider relative flex items-center gap-1.5 transition-all ${
            activeTab === "EXPLORER" ? "text-[#10b981] font-extrabold" : "text-slate-400 hover:text-slate-600"
          }`}
        >
          <Database className="h-4 w-4" />
          Simulador Firestore DB
          {activeTab === "EXPLORER" && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#10b981]"></span>}
        </button>
        <button
          onClick={() => setActiveTab("RULES")}
          className={`pb-3 text-xs font-bold uppercase tracking-wider relative flex items-center gap-1.5 transition-all ${
            activeTab === "RULES" ? "text-[#10b981] font-extrabold" : "text-slate-400 hover:text-slate-600"
          }`}
        >
          <FileCode className="h-4 w-4" />
          Seguridad Firebase
          {activeTab === "RULES" && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#10b981]"></span>}
        </button>
      </div>

      {activeTab === "PAGOS" && (
        <div className="space-y-4">
          <div className="bg-white border border-slate-200 rounded-xl p-5 card-shadow">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div>
                <h3 className="text-slate-850 font-bold text-sm mb-1.5 flex items-center gap-2">
                  <BadgeAlert className="text-amber-500 h-5 w-5" />
                  Auditoría de comisiones por depósito
                </h3>
                <p className="text-slate-500 text-xs leading-relaxed">
                  Revise comprobantes de depósito y confirme comisiones del 3%: productor (30 días corridos) y transportista (40 días corridos). La plataforma no retiene fondos de fletes.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {(["ALL", "PENDIENTE", "ABONADA"] as const).map((filter) => (
                  <button
                    key={filter}
                    type="button"
                    onClick={() => setPublicationFilter(filter)}
                    className={`px-3 py-1.5 rounded-lg border text-[11px] font-bold ${
                      publicationFilter === filter
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                        : "bg-white text-slate-500 border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    {filter === "ALL" ? "Todas" : filter}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white p-4 rounded-xl border border-slate-200 card-shadow">
              <span className="text-slate-400 text-[10px] font-bold uppercase font-mono">Pendientes</span>
              <span className="text-2xl font-extrabold text-amber-600 block">{pendingPublicationPayments}</span>
            </div>
            <div className="bg-white p-4 rounded-xl border border-slate-200 card-shadow">
              <span className="text-slate-400 text-[10px] font-bold uppercase font-mono">Comprobantes</span>
              <span className="text-2xl font-extrabold text-blue-600 block">{uploadedReceipts}</span>
            </div>
            <div className="bg-white p-4 rounded-xl border border-slate-200 card-shadow">
              <span className="text-slate-400 text-[10px] font-bold uppercase font-mono">Abonadas</span>
              <span className="text-2xl font-extrabold text-emerald-600 block">{viajes.length - pendingPublicationPayments}</span>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden card-shadow">
            <div className="overflow-x-auto">
              <table className="min-w-full text-xs">
                <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] font-bold">
                  <tr>
                    <th className="px-4 py-3 text-left">Carga</th>
                    <th className="px-4 py-3 text-left">Productor</th>
                    <th className="px-4 py-3 text-left">Descripcion</th>
                    <th className="px-4 py-3 text-right">Total</th>
                    <th className="px-4 py-3 text-right">3%</th>
                    <th className="px-4 py-3 text-left">Comprobante</th>
                    <th className="px-4 py-3 text-left">Estado</th>
                    <th className="px-4 py-3 text-right">Accion</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {publicationTrips.map((v) => {
                    const productor = usuarios.find((u) => u.id === v.productor_id);
                    const total = v.toneladas * v.tarifa_por_tonelada;
                    const fee = Number((total * 0.03).toFixed(2));
                    const isPaid = v.pago_publicacion_estado === "ABONADA";
                    return (
                      <tr key={v.id} className={isPaid ? "bg-emerald-50/50" : "bg-white"}>
                        <td className="px-4 py-3 align-top">
                          <p className="font-mono text-[10px] text-slate-700">{v.id}</p>
                          <p className="font-mono text-[10px] text-slate-500">{v.numero_transaccion || "Sin TX"}</p>
                          <p className="text-[10px] text-slate-400">{formatDateTime(v.fecha_creacion)}</p>
                        </td>
                        <td className="px-4 py-3 align-top text-slate-700 font-bold">{productor?.razon_social || v.productor_id}</td>
                        <td className="px-4 py-3 align-top text-slate-600">
                          <p>{v.tipo_grano} - {v.toneladas} Tn - {v.tipo_carroceria_requerida.replaceAll("_", " ")}</p>
                          <p className="text-[10px] text-slate-400">{v.origen.direccion} / {v.destino.direccion}</p>
                        </td>
                        <td className="px-4 py-3 align-top text-right font-mono text-slate-700">{formatCurrency(total)}</td>
                        <td className="px-4 py-3 align-top text-right font-mono text-amber-700 font-bold">{formatCurrency(fee)}</td>
                        <td className="px-4 py-3 align-top">
                          {v.comprobante_publicacion ? (
                            <a
                              href={v.comprobante_publicacion.storagePath}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1.5 text-blue-700 bg-blue-50 border border-blue-200 px-2 py-1 rounded-md font-bold hover:bg-blue-100"
                            >
                              <Eye className="h-3.5 w-3.5" />
                              Ver comprobante
                            </a>
                          ) : (
                            <span className="text-slate-400">Sin comprobante</span>
                          )}
                        </td>
                        <td className="px-4 py-3 align-top">
                          <span className={`px-2 py-1 rounded-full border text-[10px] font-extrabold ${
                            isPaid
                              ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                              : "bg-amber-50 text-amber-700 border-amber-200"
                          }`}>
                            {isPaid ? "ABONADA" : "PENDIENTE"}
                          </span>
                        </td>
                        <td className="px-4 py-3 align-top text-right">
                          {!isPaid && (
                            <button
                              type="button"
                              onClick={() => onConfirmPublicationPayment(v.id)}
                              disabled={!v.comprobante_publicacion}
                              className={`px-3 py-1.5 rounded-md text-[10px] font-bold ${
                                v.comprobante_publicacion
                                  ? "bg-emerald-600 text-white hover:bg-emerald-700"
                                  : "bg-slate-100 text-slate-400 cursor-not-allowed"
                              }`}
                            >
                              Carga abonada
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {publicationTrips.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-4 py-10 text-center text-slate-400">
                        No hay cargas para el filtro seleccionado.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-5 card-shadow">
            <h3 className="text-slate-850 font-bold text-sm mb-3 flex items-center gap-2">
              <Truck className="text-emerald-600 h-5 w-5" />
              Comisiones de transportistas (3% · 40 días corridos)
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 font-bold border-b border-slate-150 text-[10px] uppercase">
                    <th className="px-4 py-3">Viaje</th>
                    <th className="px-4 py-3">Transportista</th>
                    <th className="px-4 py-3 text-right">Monto operación</th>
                    <th className="px-4 py-3 text-right">Comisión 3%</th>
                    <th className="px-4 py-3">Vencimiento</th>
                    <th className="px-4 py-3">Comprobante</th>
                    <th className="px-4 py-3">Estado</th>
                    <th className="px-4 py-3 text-right">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {camioneroCommissionTrips.map((v) => {
                    const chofer = usuarios.find((u) => u.id === v.chofer_id);
                    const total = v.toneladas * v.tarifa_por_tonelada;
                    const fee = Number((total * 0.03).toFixed(2));
                    const isPaid = v.pago_comision_camionero_estado === "ABONADA";
                    return (
                      <tr key={`cam-${v.id}`} className={isPaid ? "bg-emerald-50/50" : "bg-white"}>
                        <td className="px-4 py-3 font-mono text-[10px]">{v.id}</td>
                        <td className="px-4 py-3 font-bold text-slate-700">{chofer?.razon_social || v.chofer_id}</td>
                        <td className="px-4 py-3 text-right font-mono">{formatCurrency(total)}</td>
                        <td className="px-4 py-3 text-right font-mono text-amber-700 font-bold">{formatCurrency(fee)}</td>
                        <td className="px-4 py-3">{v.notificaciones_transaccion?.camionero?.fecha_vencimiento ? formatDateTime(v.notificaciones_transaccion.camionero.fecha_vencimiento).split(" ")[0] : "—"}</td>
                        <td className="px-4 py-3">
                          {v.comprobante_comision_camionero ? (
                            <a href={v.comprobante_comision_camionero.storagePath} target="_blank" rel="noreferrer" className="text-blue-700 font-bold">Ver comprobante</a>
                          ) : (
                            <span className="text-slate-400">Sin comprobante</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 rounded-full border text-[10px] font-extrabold ${isPaid ? "bg-emerald-100 text-emerald-800 border-emerald-300" : "bg-amber-50 text-amber-700 border-amber-200"}`}>
                            {isPaid ? "ABONADA" : "PENDIENTE"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          {!isPaid && (
                            <button
                              type="button"
                              onClick={() => onConfirmCamioneroCommission(v.id)}
                              disabled={!v.comprobante_comision_camionero}
                              className={`px-3 py-1.5 rounded-md text-[10px] font-bold ${v.comprobante_comision_camionero ? "bg-emerald-600 text-white hover:bg-emerald-700" : "bg-slate-100 text-slate-400 cursor-not-allowed"}`}
                            >
                              Confirmar comisión
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {camioneroCommissionTrips.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-4 py-10 text-center text-slate-400">No hay viajes asignados a transportistas.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 1: KYC AUDIT PIPELINE */}
      {activeTab === "KYC" && (
        <div className="space-y-4">
          <div className="bg-white border border-slate-200 rounded-xl p-5 card-shadow">
            <h3 className="text-slate-850 font-bold text-sm mb-1.5 flex items-center gap-2">
              <ShieldAlert className="text-amber-500 h-5 w-5" />
              Validación de Identidad y Pólizas Camioneras (SLA AFIP/ANSV)
            </h3>
            <p className="text-slate-500 text-xs max-w-4xl leading-relaxed">
              Los transportistas que completan su onboarding ingresan en estado congelado <b>PENDIENTE</b>.
              Audite su LiNTI (Licencia Nacional Habilitante), patente de acoplados, póliza de seguros y certificado de VTV antes de habilitar su estado de cuenta de Firestore.
            </p>
          </div>

          {pendingUsers.length === 0 ? (
            <div className="bg-white text-center py-16 rounded-xl border-2 border-dashed border-slate-200">
              <CheckCircle className="h-12 w-12 text-[#10b981] mx-auto mb-3" />
              <p className="text-slate-800 font-extrabold text-sm">Ecosistema Totalmente Verificado</p>
              <p className="text-slate-500 text-xs mt-1">No hay conductores o productores esperando validaciones KYC.</p>
              <p className="text-slate-400 text-[11px] mt-1 italic">
                (Pruebe ingresando datos nuevos en la pestaña de Chofer para simular un nuevo registro)
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {pendingUsers.map((u) => {
                const veh = vehiculos.find((v) => v.chofer_id === u.id);
                const userVals = validations[u.id] || {};
                const isAfipValid = userVals.afip === "valid";
                const isLintiValid = userVals.linti === "valid";
                const canApprove = u.rol === "PRODUCTOR" ? isAfipValid : (isAfipValid && isLintiValid);

                return (
                  <div key={u.id} className="bg-white rounded-xl border border-slate-200 p-6 flex flex-col lg:flex-row justify-between gap-6 hover:border-slate-300 transition-all card-shadow shadow-xs">
                    
                    {/* Persona Data */}
                    <div className="space-y-4 flex-1">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 bg-emerald-50 text-[#10b981] flex items-center justify-center font-extrabold rounded-lg border border-emerald-200">
                          {u.rol === "CAMIONERO" ? "C" : "P"}
                        </div>
                        <div>
                          <h4 className="text-slate-800 font-bold text-sm">{u.razon_social}</h4>
                          <span className="text-[10px] font-mono text-slate-500">ID AUTH: {u.id} | Cel: {u.telefono}</span>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-lg border border-slate-200 text-xs font-mono">
                        <div className="space-y-1.5 text-slate-700">
                          <p><span className="text-slate-400 font-bold">CUIT:</span> {u.cuit}</p>
                          <p><span className="text-slate-400 font-bold">Condición IVA:</span> {u.condicion_iva}</p>
                          <p className="truncate"><span className="text-slate-400 font-bold">Fiscal:</span> {u.domicilio_fiscal}</p>
                        </div>
                        {u.perfil_chofer && (
                          <div className="space-y-1.5 text-slate-700 border-t md:border-t-0 md:border-l border-slate-200 md:pl-4">
                            <p className="text-amber-700 font-extrabold">LINTI ANSV: {u.perfil_chofer.numero_linti}</p>
                            <p><span className="text-slate-400 font-bold">DNI:</span> {u.perfil_chofer.dni}</p>
                            <p><span className="text-slate-400 font-bold">Vencimiento:</span> {u.perfil_chofer.linti_vencimiento}</p>
                          </div>
                        )}
                      </div>

                      {/* Attached Documents mock display */}
                      {u.perfil_chofer && (
                        <div className="space-y-1.5">
                          <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider font-mono">Documentos Adjuntos Digitales (Firebase Storage)</p>
                          <div className="grid grid-cols-3 gap-3">
                            <a href="#" onClick={(e) => e.preventDefault()} className="bg-slate-50 p-2 rounded border border-slate-200 flex items-center gap-1.5 text-slate-600 hover:text-emerald-700 text-xs transition-colors shadow-xs font-bold">
                              <Eye className="h-3.5 w-3.5 shrink-0 text-[#10b981]" /> DNI Frente
                            </a>
                            <a href="#" onClick={(e) => e.preventDefault()} className="bg-slate-50 p-2 rounded border border-slate-200 flex items-center gap-1.5 text-slate-600 hover:text-emerald-700 text-xs transition-colors shadow-xs font-bold">
                              <Eye className="h-3.5 w-3.5 shrink-0 text-[#10b981]" /> Credencial LiNTI
                            </a>
                            <a href="#" onClick={(e) => e.preventDefault()} className="bg-slate-50 p-2 rounded border border-slate-200 flex items-center gap-1.5 text-slate-600 hover:text-emerald-700 text-xs transition-colors shadow-xs font-bold">
                              <Eye className="h-3.5 w-3.5 shrink-0 text-[#10b981]" /> Cédula Verde / Título
                            </a>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Vehicle details & Actions */}
                    <div className="lg:w-80 flex flex-col justify-between border-t lg:border-t-0 lg:border-l border-slate-200 pt-4 lg:pt-0 lg:pl-6 space-y-4">
                      {veh && (
                        <div className="space-y-2 text-xs">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block font-mono">Detalles del Vehículo</span>
                          <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-1.5">
                            <p className="font-extrabold text-slate-800">{veh.chasis.marca} {veh.chasis.modelo}</p>
                            <p className="font-mono text-[11px] text-slate-500">Chasis: {veh.chasis.patente}</p>
                            {veh.acoplado && (
                              <p className="font-mono text-[11px] text-slate-500">Acoplado: {veh.acoplado.patente} ({veh.acoplado.tipo_carroceria})</p>
                            )}
                          </div>
                        </div>
                      )}

                      <div className="space-y-2 mt-4">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block font-mono">Verificaciones Gubernamentales</span>
                        
                        <button
                          onClick={() => handleVerifyAfip(u.id)}
                          disabled={userVals.afip === "loading" || userVals.afip === "valid"}
                          className={`w-full text-xs font-bold py-2 rounded-lg flex items-center justify-center gap-1.5 transition-all shadow-sm ${
                            userVals.afip === "valid" ? "bg-emerald-100 text-emerald-700 border border-emerald-200" 
                            : "bg-blue-50 text-blue-600 border border-blue-200 hover:bg-blue-100"
                          }`}
                        >
                          {userVals.afip === "loading" ? <RefreshCw className="h-4 w-4 animate-spin" /> 
                           : userVals.afip === "valid" ? <CheckCircle className="h-4 w-4" /> 
                           : <Search className="h-4 w-4" />}
                          {userVals.afip === "valid" ? "AFIP Validado" : "Consultar Padrón AFIP"}
                        </button>

                        {u.rol === "CAMIONERO" && (
                          <button
                            onClick={() => handleVerifyLinti(u.id)}
                            disabled={userVals.linti === "loading" || userVals.linti === "valid"}
                            className={`w-full text-xs font-bold py-2 rounded-lg flex items-center justify-center gap-1.5 transition-all shadow-sm mt-2 ${
                              userVals.linti === "valid" ? "bg-emerald-100 text-emerald-700 border border-emerald-200" 
                              : "bg-indigo-50 text-indigo-600 border border-indigo-200 hover:bg-indigo-100"
                            }`}
                          >
                            {userVals.linti === "loading" ? <RefreshCw className="h-4 w-4 animate-spin" /> 
                             : userVals.linti === "valid" ? <CheckCircle className="h-4 w-4" /> 
                             : <Search className="h-4 w-4" />}
                            {userVals.linti === "valid" ? "LiNTI/ANSV Validado" : "Consultar LiNTI / ANSV"}
                          </button>
                        )}
                      </div>

                      <div className="flex gap-2 mt-4">
                        <button
                          id={`approve-kyc-btn-${u.id}`}
                          onClick={() => onApproveUser(u.id, "APROBAR")}
                          disabled={!canApprove && u.rol !== "ADMIN"}
                          className={`flex-1 text-white font-bold text-xs py-2 rounded-lg flex items-center justify-center gap-1.5 transition-colors shadow-sm ${
                            (canApprove || u.rol !== "ADMIN") ? "bg-[#10b981] hover:bg-emerald-600 cursor-pointer" : "bg-slate-300 cursor-not-allowed"
                          }`}
                        >
                          <CheckCircle className="h-4 w-4" /> Aprobar
                        </button>
                        <button
                          id={`reject-kyc-btn-${u.id}`}
                          onClick={() => onApproveUser(u.id, "RECHAZAR")}
                          className="flex-1 bg-white border border-slate-200 text-slate-500 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 font-bold text-xs py-2 rounded-lg flex items-center justify-center gap-1.5 transition-all shadow-xs cursor-pointer"
                        >
                          <XCircle className="h-4 w-4" /> Rechazar
                        </button>
                      </div>
                    </div>

                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB: PENALIDADES */}
      {activeTab === "PENALIDADES" && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden card-shadow">
          <div className="p-5 border-b border-slate-200">
            <h3 className="text-slate-850 font-bold text-sm flex items-center gap-2">
              <ShieldAlert className="text-rose-500 h-5 w-5" />
              Penalidades por cancelación de viaje (10% del monto acordado)
            </h3>
            <p className="text-slate-500 text-xs mt-1">
              Penalidades generadas automáticamente cuando un productor o transportista cancela un viaje asignado.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] font-bold">
                <tr>
                  <th className="px-4 py-3 text-left">Viaje</th>
                  <th className="px-4 py-3 text-left">Deudor</th>
                  <th className="px-4 py-3 text-left">Beneficiario</th>
                  <th className="px-4 py-3 text-right">Monto</th>
                  <th className="px-4 py-3 text-left">Motivo</th>
                  <th className="px-4 py-3 text-left">Estado</th>
                  <th className="px-4 py-3 text-left">Fecha</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {penalidades.map((p) => {
                  const deudor = usuarios.find((u) => u.id === p.usuario_deudor_id);
                  const beneficiario = usuarios.find((u) => u.id === p.usuario_beneficiario_id);
                  return (
                    <tr key={p.id}>
                      <td className="px-4 py-3 font-mono text-[10px]">{p.viaje_id}</td>
                      <td className="px-4 py-3">{deudor?.razon_social || p.usuario_deudor_id}</td>
                      <td className="px-4 py-3">{beneficiario?.razon_social || p.usuario_beneficiario_id}</td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-rose-700">
                        {p.monto_penalidad.toLocaleString("es-AR", { style: "currency", currency: "ARS", minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-3 text-slate-600">{p.motivo}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded-full border text-[10px] font-extrabold ${
                          p.estado_pago === "COMPENSADO" ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                          : p.estado_pago === "INCOBRABLE" ? "bg-slate-100 text-slate-500 border-slate-200"
                          : "bg-amber-50 text-amber-700 border-amber-200"
                        }`}>
                          {p.estado_pago}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-500">{formatDateTime(p.fecha_creacion)}</td>
                    </tr>
                  );
                })}
                {penalidades.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-slate-400">
                      No hay penalidades registradas.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB: FIRESTORE LIVE DB EXPLORER */}
      {activeTab === "EXPLORER" && (
        <div className="space-y-4">
          <div className="bg-white border border-slate-200 rounded-xl p-5 card-shadow">
            <h3 className="text-slate-850 font-bold text-sm mb-1.5 flex items-center gap-2">
              <Database className="text-[#10b981] h-5 w-5" />
              Visor en Tiempo Real de Colecciones NoSQL de Firestore (Mocked State)
            </h3>
            <p className="text-slate-500 text-xs leading-relaxed">
              Explore los documentos estructurados en Firestore en tiempo real. Vea cómo las escrituras desde los clientes y los Cloud Functions se persisten en colecciones de alto rendimiento.
            </p>
          </div>

          <div className="grid grid-cols-12 gap-6">
            
            {/* Collection selectors (Col 4) */}
            <div className="col-span-12 lg:col-span-3 space-y-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block font-mono px-1">Colecciones</span>
              <button
                onClick={() => setExplorerCollection("usuarios")}
                className={`w-full py-2.5 px-4 text-xs font-bold rounded-lg border text-left flex items-center justify-between transition-colors shadow-xs ${
                  explorerCollection === "usuarios"
                    ? "bg-emerald-50 text-emerald-700 border-emerald-200 font-extrabold"
                    : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                }`}
              >
                <span>/usuarios</span>
                <span className="bg-slate-100 px-2 py-0.5 rounded text-[10px] text-slate-500 font-mono border border-slate-200">{usuarios.length} docs</span>
              </button>
              <button
                onClick={() => setExplorerCollection("vehiculos")}
                className={`w-full py-2.5 px-4 text-xs font-bold rounded-lg border text-left flex items-center justify-between transition-colors shadow-xs ${
                  explorerCollection === "vehiculos"
                    ? "bg-emerald-50 text-emerald-700 border-emerald-200 font-extrabold"
                    : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                }`}
              >
                <span>/vehiculos</span>
                <span className="bg-slate-100 px-2 py-0.5 rounded text-[10px] text-slate-500 font-mono border border-slate-200">{vehiculos.length} docs</span>
              </button>
              <button
                onClick={() => setExplorerCollection("viajes")}
                className={`w-full py-2.5 px-4 text-xs font-bold rounded-lg border text-left flex items-center justify-between transition-colors shadow-xs ${
                  explorerCollection === "viajes"
                    ? "bg-emerald-50 text-emerald-700 border-emerald-200 font-extrabold"
                    : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                }`}
              >
                <span>/viajes</span>
                <span className="bg-slate-100 px-2 py-0.5 rounded text-[10px] text-slate-500 font-mono border border-slate-200">{viajes.length} docs</span>
              </button>
            </div>

            {/* Document display node (Col 9) */}
            <div className="col-span-12 lg:col-span-9 bg-slate-50 rounded-xl border border-slate-200 p-5 overflow-hidden card-shadow">
              <div className="flex items-center justify-between border-b border-slate-200 pb-3 mb-4">
                <span className="text-slate-600 font-mono text-xs">
                  Colección: <b className="text-emerald-700">/{explorerCollection}</b>
                </span>
                <span className="text-[10px] font-mono text-slate-400">Modo: Lectura en Línea</span>
              </div>

              <div className="overflow-x-auto max-h-[400px] text-xs font-mono bg-white p-4 rounded-lg border border-slate-200 shadow-inner">
                <pre className="text-slate-850 leading-relaxed">
                  {JSON.stringify(
                    explorerCollection === "usuarios" ? usuarios :
                    explorerCollection === "vehiculos" ? vehiculos :
                    viajes,
                    null,
                    2
                  )}
                </pre>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* TAB 3: FIREBASE DEPLOYABLE SCHEMAS & RULES */}
      {activeTab === "RULES" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* Rules panel */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 flex flex-col justify-between card-shadow">
            <div>
              <div className="flex items-center justify-between border-b border-slate-200 pb-3 mb-4">
                <h4 className="text-slate-800 font-bold text-sm flex items-center gap-1.5 font-mono">
                  <FileCode className="h-4 w-4 text-amber-500" />
                  PostgreSQL Schema (DDL)
                </h4>
                <span className="bg-amber-50 text-amber-700 font-mono text-[9px] px-2 py-0.5 rounded border border-amber-200 font-extrabold">Drizzle ORM</span>
              </div>
              <p className="text-slate-500 text-xs mb-4 leading-relaxed">
                Esquema de base de datos PostgreSQL generado por Drizzle ORM. Define tablas, tipos, relaciones y restricciones de integridad.
              </p>
              
              <div className="bg-slate-50 rounded-lg p-4 border border-slate-200 font-mono text-[11px] text-slate-700 max-h-[350px] overflow-y-auto shadow-inner">
                <pre className="whitespace-pre-wrap">{schemaInfo}</pre>
              </div>
            </div>
          </div>

          {/* Go schema panel */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 flex flex-col justify-between card-shadow">
            <div>
              <div className="flex items-center justify-between border-b border-slate-200 pb-3 mb-4">
                <h4 className="text-slate-800 font-bold text-sm flex items-center gap-1.5 font-mono">
                  <Database className="h-4 w-4 text-emerald-500" />
                  Go Schema Reference
                </h4>
                <span className="bg-emerald-50 text-[#10b981] font-mono text-[9px] px-2 py-0.5 rounded border border-emerald-200 font-extrabold">Domain Model</span>
              </div>
              <p className="text-slate-500 text-xs mb-4 leading-relaxed">
                Representación en Go de las entidades del dominio para referencia en migraciones futuras.
              </p>

              <div className="bg-slate-50 rounded-lg p-4 border border-slate-200 font-mono text-[11px] text-slate-700 max-h-[350px] overflow-y-auto shadow-inner">
                <pre className="whitespace-pre-wrap">{goSchema}</pre>
              </div>
            </div>
          </div>

        </div>
      )}

    </div>
  );
}

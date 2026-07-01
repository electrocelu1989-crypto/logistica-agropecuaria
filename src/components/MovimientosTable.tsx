import React, { useRef, useState, useMemo } from "react";
import { Usuario, Viaje } from "../types";
import {
  Search,
  ChevronLeft,
  ChevronRight,
  Calendar,
  Coins,
  AlertCircle,
  Filter,
  CheckCircle,
  TrendingDown
} from "lucide-react";

interface MovimientosTableProps {
  usuarios: Usuario[];
  viajes: Viaje[];
  activeUserId: string;
  userRole: "PRODUCTOR" | "CAMIONERO";
  variant?: "dense" | "full";
  onUploadPublicationReceipt?: (tripId: string, payload: { fileName: string; mimeType: string; dataUrl: string }) => Promise<boolean>;
  onUploadCamioneroReceipt?: (tripId: string, payload: { fileName: string; mimeType: string; dataUrl: string }) => Promise<boolean>;
}

export default function MovimientosTable({
  usuarios,
  viajes,
  activeUserId,
  userRole,
  variant = "full",
  onUploadPublicationReceipt,
  onUploadCamioneroReceipt
}: MovimientosTableProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterSubtype, setFilterSubtype] = useState<string>("ALL");
  const [currentPage, setCurrentPage] = useState(1);
  const [activePaymentTripId, setActivePaymentTripId] = useState<string | null>(null);
  const [activeReceiptTripId, setActiveReceiptTripId] = useState<string | null>(null);
  const [isUploadingReceipt, setIsUploadingReceipt] = useState(false);
  const receiptInputRef = useRef<HTMLInputElement>(null);
  const [receiptUploadMode, setReceiptUploadMode] = useState<"PRODUCTOR" | "CAMIONERO">("PRODUCTOR");
  const itemsPerPage = variant === "dense" ? 4 : 8;

  const formatCurrency = (amount: number) =>
    amount.toLocaleString("es-AR", { style: "currency", currency: "ARS", minimumFractionDigits: 2 });
  const formatDateTime = (value: string) =>
    new Date(value).toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" });
  const formatDueDate = (value?: string) =>
    value ? new Date(value).toLocaleDateString("es-AR") : "—";

  const producerPublishedLoads = useMemo(() => {
    if (userRole !== "PRODUCTOR") return [];
    return viajes
      .filter((v) => v.productor_id === activeUserId)
      .filter((v) => {
        const term = searchTerm.toLowerCase();
        const total = v.toneladas * v.tarifa_por_tonelada;
        const description = `${v.id} ${v.numero_transaccion || ""} ${v.tipo_grano} ${v.toneladas} ${v.tipo_carroceria_requerida} ${v.origen.direccion} ${v.destino.direccion} ${total}`;
        const matchesSearch = description.toLowerCase().includes(term);
        const matchesStatus =
          filterSubtype === "ALL" ||
          (filterSubtype === "PENDIENTE" && v.pago_publicacion_estado !== "ABONADA") ||
          (filterSubtype === "ABONADA" && v.pago_publicacion_estado === "ABONADA");
        return matchesSearch && matchesStatus;
      })
      .sort((a, b) => new Date(b.fecha_creacion).getTime() - new Date(a.fecha_creacion).getTime());
  }, [viajes, activeUserId, userRole, searchTerm, filterSubtype]);

  const camioneroAssignedTrips = useMemo(() => {
    if (userRole !== "CAMIONERO") return [];
    return viajes
      .filter((v) => v.chofer_id === activeUserId)
      .filter((v) => {
        const term = searchTerm.toLowerCase();
        const total = v.toneladas * v.tarifa_por_tonelada;
        const productor = usuarios.find((u) => u.id === v.productor_id);
        const description = `${v.id} ${v.numero_transaccion || ""} ${v.tipo_grano} ${productor?.razon_social || ""} ${total}`;
        const matchesSearch = description.toLowerCase().includes(term);
        const matchesStatus =
          filterSubtype === "ALL" ||
          (filterSubtype === "PENDIENTE" && v.pago_comision_camionero_estado !== "ABONADA") ||
          (filterSubtype === "ABONADA" && v.pago_comision_camionero_estado === "ABONADA");
        return matchesSearch && matchesStatus;
      })
      .sort((a, b) => new Date(b.fecha_actualizacion).getTime() - new Date(a.fecha_actualizacion).getTime());
  }, [viajes, usuarios, activeUserId, userRole, searchTerm, filterSubtype]);

  const activeList = userRole === "PRODUCTOR" ? producerPublishedLoads : camioneroAssignedTrips;
  const totalPages = Math.ceil(activeList.length / itemsPerPage) || 1;
  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return activeList.slice(start, start + itemsPerPage);
  }, [activeList, currentPage, itemsPerPage]);

  const handlePageChange = (p: number) => {
    if (p >= 1 && p <= totalPages) setCurrentPage(p);
  };

  const handleReceiptUploadTrigger = (tripId: string, mode: "PRODUCTOR" | "CAMIONERO") => {
    setReceiptUploadMode(mode);
    setActiveReceiptTripId(tripId);
    receiptInputRef.current?.click();
  };

  const handleReceiptFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!activeReceiptTripId || !event.target.files?.[0]) return;
    const uploadFn =
      receiptUploadMode === "PRODUCTOR" ? onUploadPublicationReceipt : onUploadCamioneroReceipt;
    if (!uploadFn) return;

    const file = event.target.files[0];
    const reader = new FileReader();
    reader.onload = async () => {
      setIsUploadingReceipt(true);
      const success = await uploadFn(activeReceiptTripId, {
        fileName: file.name,
        mimeType: file.type || "application/octet-stream",
        dataUrl: reader.result as string
      });
      if (!success) {
        alert("No se pudo subir el comprobante. Intente nuevamente.");
      }
      setIsUploadingReceipt(false);
      setActiveReceiptTripId(null);
      if (receiptInputRef.current) receiptInputRef.current.value = "";
    };
    reader.readAsDataURL(file);
  };

  const renderPaymentInstructions = (
    tripId: string,
    fee: number,
    txRef: string,
    plazoDias: number,
    isVisible: boolean
  ) =>
    isVisible ? (
      <div className="mt-3 bg-amber-50 border border-amber-200 rounded-lg p-3 text-[11px] text-slate-700 grid grid-cols-1 md:grid-cols-2 gap-2">
        <p><b>Identificación de pago:</b> <span className="font-mono">{txRef}</span></p>
        <p><b>Monto a depositar (3%):</b> <span className="font-mono text-amber-800">{formatCurrency(fee)}</span></p>
        <p><b>Plazo:</b> {plazoDias} días corridos desde la operación</p>
        <p><b>Alias:</b> <span className="font-mono">agrologistica.pagos</span></p>
        <p><b>CBU:</b> <span className="font-mono">0000003100012345678901</span></p>
        <p className="md:col-span-2 text-slate-500">
          Deposite la comisión en la cuenta de la plataforma y suba el comprobante. La app no retiene fondos del flete; el pago del transporte se acuerda directamente entre usted y la contraparte.
        </p>
      </div>
    ) : null;

  if (variant === "dense") {
    return (
      <div className="space-y-3">
        <input ref={receiptInputRef} type="file" accept="image/*,.pdf,application/pdf" className="hidden" onChange={handleReceiptFileChange} />
        <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none text-[9px] font-bold">
          {(["ALL", "PENDIENTE", "ABONADA"] as const).map((f) => (
            <button
              key={f}
              onClick={() => { setFilterSubtype(f); setCurrentPage(1); }}
              className={`px-2 py-1 rounded-md border shrink-0 transition-all ${
                filterSubtype === f ? "bg-emerald-600 text-white border-emerald-500" : "bg-slate-900 text-slate-400 border-slate-800"
              }`}
            >
              {f === "ALL" ? "Todos" : f === "PENDIENTE" ? "Pendientes" : "Abonadas"}
            </button>
          ))}
        </div>
        <div className="space-y-1.5 max-h-[220px] overflow-y-auto">
          {paginatedItems.length === 0 ? (
            <div className="text-center py-6 text-[10px] text-slate-500 bg-slate-950 rounded-lg border border-slate-900">
              No hay comisiones registradas.
            </div>
          ) : (
            paginatedItems.map((v) => {
              const total = v.toneladas * v.tarifa_por_tonelada;
              const fee = Number((total * 0.03).toFixed(2));
              const isPaid =
                userRole === "PRODUCTOR"
                  ? v.pago_publicacion_estado === "ABONADA"
                  : v.pago_comision_camionero_estado === "ABONADA";
              const dueDate =
                userRole === "PRODUCTOR"
                  ? v.notificaciones_transaccion?.productor?.fecha_vencimiento
                  : v.notificaciones_transaccion?.camionero?.fecha_vencimiento;
              return (
                <div key={v.id} className="bg-slate-950 p-2.5 rounded-lg border border-slate-900 text-[10px] gap-2">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-slate-300 font-bold">{v.tipo_grano} · {v.toneladas} Tn</p>
                      <p className="text-slate-500 font-mono text-[9px]">{formatCurrency(total)} · Comisión {formatCurrency(fee)}</p>
                      <p className="text-slate-500 text-[8px]">Vence: {formatDueDate(dueDate)}</p>
                    </div>
                    <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded ${isPaid ? "bg-emerald-500/20 text-emerald-400" : "bg-amber-500/20 text-amber-400"}`}>
                      {isPaid ? "Abonada" : "Pendiente"}
                    </span>
                  </div>
                  {!isPaid && onUploadCamioneroReceipt && userRole === "CAMIONERO" && (
                    <button
                      type="button"
                      onClick={() => handleReceiptUploadTrigger(v.id, "CAMIONERO")}
                      disabled={isUploadingReceipt}
                      className="mt-2 w-full text-[9px] bg-blue-950 text-blue-300 border border-blue-800 rounded py-1 font-bold"
                    >
                      Subir comprobante
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>
        {totalPages > 1 && (
          <div className="flex items-center justify-between text-[10px] text-slate-400 border-t border-slate-900 pt-2">
            <span>Pág {currentPage} de {totalPages}</span>
            <div className="flex gap-1">
              <button disabled={currentPage === 1} onClick={() => handlePageChange(currentPage - 1)} className="bg-slate-900 border border-slate-800 rounded p-1 disabled:opacity-40"><ChevronLeft className="h-3 w-3" /></button>
              <button disabled={currentPage === totalPages} onClick={() => handlePageChange(currentPage + 1)} className="bg-slate-900 border border-slate-800 rounded p-1 disabled:opacity-40"><ChevronRight className="h-3 w-3" /></button>
            </div>
          </div>
        )}
      </div>
    );
  }

  const pendingCommission = activeList
    .filter((v) =>
      userRole === "PRODUCTOR"
        ? v.pago_publicacion_estado !== "ABONADA"
        : v.pago_comision_camionero_estado !== "ABONADA"
    )
    .reduce((sum, v) => sum + v.toneladas * v.tarifa_por_tonelada * 0.03, 0);
  const paidCount = activeList.filter((v) =>
    userRole === "PRODUCTOR"
      ? v.pago_publicacion_estado === "ABONADA"
      : v.pago_comision_camionero_estado === "ABONADA"
  ).length;
  const plazoLabel = userRole === "PRODUCTOR" ? "30 días corridos" : "40 días corridos";
  const title = userRole === "PRODUCTOR" ? "Comisiones por cargas publicadas" : "Comisiones por viajes asignados";
  const subtitle =
    userRole === "PRODUCTOR"
      ? "Registro de cargas publicadas y comisión del 3% a depositar en la cuenta de la plataforma dentro de 30 días corridos."
      : "Registro de viajes tomados y comisión del 3% a depositar en la cuenta de la plataforma dentro de 40 días corridos.";

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm space-y-4">
      <input ref={receiptInputRef} type="file" accept="image/*,.pdf,application/pdf" className="hidden" onChange={handleReceiptFileChange} />

      <div className="p-5 border-b border-slate-150 bg-slate-50/50 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h3 className="font-extrabold text-slate-800 text-base flex items-center gap-2">
            <Coins className="h-5 w-5 text-emerald-600" />
            {title}
          </h3>
          <p className="text-slate-500 text-xs mt-0.5">{subtitle}</p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <div className="bg-white border border-slate-150 px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 shadow-xs">
            <TrendingDown className="h-3.5 w-3.5 text-amber-500 shrink-0" />
            <span className="text-slate-500">Comisión pendiente:</span>
            <b className="text-amber-700 font-bold font-mono">{formatCurrency(pendingCommission)}</b>
          </div>
          <div className="bg-white border border-slate-150 px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 shadow-xs">
            <CheckCircle className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
            <span className="text-slate-500">Abonadas:</span>
            <b className="text-emerald-700 font-bold font-mono">{paidCount}</b>
          </div>
        </div>
      </div>

      <div className="px-5 flex flex-wrap items-center justify-between gap-3">
        <div className="relative w-full max-w-xs shrink-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por viaje, grano o referencia..."
            value={searchTerm}
            onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
            className="w-full bg-white border border-slate-200 text-slate-800 rounded-lg pl-9 pr-4 py-2 text-xs focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 font-medium"
          />
        </div>
        <div className="flex flex-wrap items-center gap-1.5 text-xs font-semibold">
          <span className="text-slate-500 text-xs font-bold mr-1 flex items-center gap-1"><Filter className="h-3.5 w-3.5" /> Filtrar:</span>
          {(["ALL", "PENDIENTE", "ABONADA"] as const).map((f) => (
            <button
              key={f}
              onClick={() => { setFilterSubtype(f); setCurrentPage(1); }}
              className={`px-3 py-1.5 rounded-md border transition-all ${
                filterSubtype === f ? "bg-emerald-600 text-white border-emerald-500 shadow-sm" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
              }`}
            >
              {f === "ALL" ? "Todas" : f === "PENDIENTE" ? "Pendientes" : "Abonadas"}
            </button>
          ))}
        </div>
      </div>

      <div className="px-5 pb-5">
        <div className="border border-slate-150 rounded-xl overflow-hidden bg-white">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse font-sans text-xs">
              <thead>
                <tr className="bg-slate-50 text-slate-500 font-bold border-b border-slate-150 text-[10px] uppercase tracking-wider">
                  <th className="py-3.5 px-4 font-mono">ID viaje</th>
                  <th className="py-3.5 px-4">Fecha</th>
                  <th className="py-3.5 px-4">Detalle</th>
                  <th className="py-3.5 px-4 text-right">Monto operación</th>
                  <th className="py-3.5 px-4 text-right">Comisión 3%</th>
                  <th className="py-3.5 px-4">Vencimiento ({plazoLabel})</th>
                  <th className="py-3.5 px-4 font-mono">Ref. pago</th>
                  <th className="py-3.5 px-4">Estado</th>
                  <th className="py-3.5 px-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedItems.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="text-center py-12 text-slate-400 font-medium">
                      <div className="flex flex-col items-center justify-center space-y-2">
                        <AlertCircle className="h-8 w-8 text-slate-300 stroke-1" />
                        <p>No se encontraron operaciones para los criterios seleccionados.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  paginatedItems.map((v) => {
                    const total = v.toneladas * v.tarifa_por_tonelada;
                    const fee = Number((total * 0.03).toFixed(2));
                    const isPaid =
                      userRole === "PRODUCTOR"
                        ? v.pago_publicacion_estado === "ABONADA"
                        : v.pago_comision_camionero_estado === "ABONADA";
                    const notif =
                      userRole === "PRODUCTOR"
                        ? v.notificaciones_transaccion?.productor
                        : v.notificaciones_transaccion?.camionero;
                    const hasReceipt =
                      userRole === "PRODUCTOR"
                        ? Boolean(v.comprobante_publicacion?.fileName)
                        : Boolean(v.comprobante_comision_camionero?.fileName);
                    const productor = usuarios.find((u) => u.id === v.productor_id);
                    const uploadMode = userRole === "PRODUCTOR" ? "PRODUCTOR" : "CAMIONERO";
                    const uploadFn =
                      userRole === "PRODUCTOR" ? onUploadPublicationReceipt : onUploadCamioneroReceipt;

                    return (
                      <tr key={v.id} className={`${isPaid ? "bg-emerald-50/50" : "hover:bg-slate-50/50"} transition`}>
                        <td className="py-4 px-4 font-mono text-[10px] text-slate-600 font-bold align-top">{v.id}</td>
                        <td className="py-4 px-4 text-slate-600 whitespace-nowrap align-top">
                          <span className="flex items-center gap-1.5">
                            <Calendar className="h-3.5 w-3.5 text-slate-400" />
                            {formatDateTime(userRole === "PRODUCTOR" ? v.fecha_creacion : v.fecha_actualizacion)}
                          </span>
                        </td>
                        <td className="py-4 px-4 text-slate-600 min-w-[220px] align-top">
                          <p className="font-semibold text-slate-800">{v.tipo_grano} - {v.toneladas} Tn</p>
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            {userRole === "PRODUCTOR"
                              ? `${v.origen.direccion} → ${v.destino.direccion}`
                              : `Productor: ${productor?.razon_social || v.productor_id}`}
                          </p>
                        </td>
                        <td className="py-4 px-4 text-right font-mono text-slate-800 font-bold whitespace-nowrap align-top">{formatCurrency(total)}</td>
                        <td className="py-4 px-4 text-right font-mono text-amber-700 font-extrabold whitespace-nowrap align-top">{formatCurrency(fee)}</td>
                        <td className="py-4 px-4 text-slate-600 whitespace-nowrap align-top">{formatDueDate(notif?.fecha_vencimiento)}</td>
                        <td className="py-4 px-4 font-mono text-[10px] text-slate-600 font-bold whitespace-nowrap align-top">{v.numero_transaccion || v.id}</td>
                        <td className="py-4 px-4 align-top">
                          <span className={`inline-flex w-fit items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full border ${
                            isPaid ? "text-emerald-700 bg-emerald-50 border-emerald-200" : "text-amber-700 bg-amber-50 border-amber-200"
                          }`}>
                            <CheckCircle className="h-3 w-3" />
                            {isPaid ? "Abonada" : "Pendiente"}
                          </span>
                          {hasReceipt && (
                            <span className="block text-[10px] text-slate-500 mt-1">Comprobante cargado</span>
                          )}
                        </td>
                        <td className="py-4 px-4 text-right align-top">
                          {!isPaid && (
                            <div className="flex flex-wrap justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => setActivePaymentTripId(activePaymentTripId === v.id ? null : v.id)}
                                className="text-[10px] text-white bg-emerald-600 hover:bg-emerald-700 px-3 py-1.5 rounded-md border border-emerald-700 font-bold transition-all shadow-sm"
                              >
                                Ver datos depósito
                              </button>
                              {uploadFn && (
                                <button
                                  type="button"
                                  onClick={() => handleReceiptUploadTrigger(v.id, uploadMode)}
                                  disabled={isUploadingReceipt}
                                  className="text-[10px] text-slate-900 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-md border border-blue-200 font-bold transition-all shadow-sm disabled:opacity-50"
                                >
                                  {isUploadingReceipt && activeReceiptTripId === v.id ? "Subiendo..." : "Subir comprobante"}
                                </button>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {paginatedItems.map((v) => {
          const total = v.toneladas * v.tarifa_por_tonelada;
          const fee = Number((total * 0.03).toFixed(2));
          const isPaid =
            userRole === "PRODUCTOR"
              ? v.pago_publicacion_estado === "ABONADA"
              : v.pago_comision_camionero_estado === "ABONADA";
          const plazo = userRole === "PRODUCTOR" ? 30 : 40;
          return renderPaymentInstructions(
            v.id,
            fee,
            v.numero_transaccion || v.id,
            plazo,
            activePaymentTripId === v.id && !isPaid
          );
        })}

        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-4 text-xs font-semibold text-slate-500">
            <span>Mostrando {paginatedItems.length} de <b className="text-slate-800">{activeList.length}</b> operaciones</span>
            <div className="flex gap-1.5">
              <button disabled={currentPage === 1} onClick={() => handlePageChange(currentPage - 1)} className="bg-white border border-slate-200 text-slate-600 rounded-lg px-3 py-1.5 hover:bg-slate-50 disabled:opacity-40 flex items-center gap-1"><ChevronLeft className="h-3.5 w-3.5" /> Anterior</button>
              <button disabled={currentPage === totalPages} onClick={() => handlePageChange(currentPage + 1)} className="bg-white border border-slate-200 text-slate-600 rounded-lg px-3 py-1.5 hover:bg-slate-50 disabled:opacity-40 flex items-center gap-1">Siguiente <ChevronRight className="h-3.5 w-3.5" /></button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

import React, { useState } from "react";
import { Usuario, Direccion } from "../types";
import { User, MapPin, Plus, Trash2, Save, X } from "lucide-react";

interface MiPerfilModalProps {
  currentUser: Usuario;
  onClose: () => void;
  onSave: (payload: any) => Promise<void>;
}

export default function MiPerfilModal({ currentUser, onClose, onSave }: MiPerfilModalProps) {
  const isProductor = currentUser.rol === "PRODUCTOR";
  const [activeTab, setActiveTab] = useState<"DATOS" | "DIRECCIONES">("DATOS");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Datos Fiscales / Personales
  const [razonSocial, setRazonSocial] = useState(currentUser.razon_social || "");
  const [cuit, setCuit] = useState(currentUser.cuit || "");
  const [condicionIva, setCondicionIva] = useState(currentUser.condicion_iva || "RESPONSABLE_INSCRIPTO");
  const [domicilioFiscal, setDomicilioFiscal] = useState(currentUser.domicilio_fiscal || "");

  // Chofer
  const [dni, setDni] = useState(currentUser.perfil_chofer?.dni || "");
  const [numeroLinti, setNumeroLinti] = useState(currentUser.perfil_chofer?.numero_linti || "");
  
  // Direcciones
  const [direcciones, setDirecciones] = useState<Direccion[]>(currentUser.direcciones || []);
  const [newAlias, setNewAlias] = useState("");
  const [newDireccion, setNewDireccion] = useState("");

  const handleAddDireccion = () => {
    if (!newAlias || !newDireccion) return;
    const newDir: Direccion = {
      id: "dir_" + Date.now().toString(),
      alias: newAlias,
      direccion: newDireccion,
      // Generate some dummy coordinates near central Argentina (-33, -60)
      lat: -33 + (Math.random() - 0.5) * 5,
      lng: -60 + (Math.random() - 0.5) * 5,
    };
    setDirecciones([...direcciones, newDir]);
    setNewAlias("");
    setNewDireccion("");
  };

  const handleRemoveDireccion = (id: string) => {
    setDirecciones(direcciones.filter((d) => d.id !== id));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");
    setSuccess("");

    try {
      const payload: any = {
        id: currentUser.id,
        email: currentUser.email,
        telefono: currentUser.telefono,
        rol: currentUser.rol,
        cuit: cuit,
        direcciones: direcciones,
      };

      if (isProductor) {
        payload.razon_social = razonSocial;
        payload.condicion_iva = condicionIva;
        payload.domicilio_fiscal = domicilioFiscal;
      } else {
        payload.razon_social = razonSocial; // Transportistas también tienen razón social
        payload.condicion_iva = condicionIva;
        payload.domicilio_fiscal = domicilioFiscal;
        
        payload.perfil_chofer = {
          ...currentUser.perfil_chofer,
          dni,
          numero_linti: numeroLinti,
        };
      }

      await onSave(payload);
      setSuccess("Perfil actualizado correctamente.");
      setTimeout(() => onClose(), 1500);
    } catch (err: any) {
      setError(err.message || "Fallo al guardar el perfil");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col relative overflow-hidden">
        {/* Header */}
        <div className="bg-slate-900 p-5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="bg-emerald-500/20 p-2 rounded-lg">
              <User className="h-5 w-5 text-emerald-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Mi Perfil</h2>
              <p className="text-slate-400 text-xs">Gestiona tus datos personales y direcciones</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-full p-2 transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-200 bg-slate-50 shrink-0 px-6">
          <button
            onClick={() => setActiveTab("DATOS")}
            className={`py-3 px-4 text-sm font-bold border-b-2 transition-colors ${
              activeTab === "DATOS" ? "border-emerald-500 text-emerald-600" : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            Datos Personales
          </button>
          {isProductor && (
            <button
              onClick={() => setActiveTab("DIRECCIONES")}
              className={`py-3 px-4 text-sm font-bold border-b-2 transition-colors ${
                activeTab === "DIRECCIONES" ? "border-emerald-500 text-emerald-600" : "border-transparent text-slate-500 hover:text-slate-700"
              }`}
            >
              Mis Direcciones
            </button>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-50">
          {error && <div className="mb-4 bg-rose-100 text-rose-700 p-3 rounded-lg text-sm">{error}</div>}
          {success && <div className="mb-4 bg-emerald-100 text-emerald-700 p-3 rounded-lg text-sm">{success}</div>}

          {activeTab === "DATOS" && (
            <form id="perfil-form" onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">CUIT</label>
                  <input type="text" value={cuit} onChange={(e) => setCuit(e.target.value)} className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none" placeholder="Sin guiones" required />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Razón Social</label>
                  <input type="text" value={razonSocial} onChange={(e) => setRazonSocial(e.target.value)} className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none" required />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Condición Frente al IVA</label>
                  <select value={condicionIva} onChange={(e) => setCondicionIva(e.target.value)} className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none">
                    <option value="RESPONSABLE_INSCRIPTO">Responsable Inscripto</option>
                    <option value="MONOTRIBUTISTA">Monotributista</option>
                    <option value="EXENTO">Exento</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Domicilio Fiscal</label>
                  <input type="text" value={domicilioFiscal} onChange={(e) => setDomicilioFiscal(e.target.value)} className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none" required />
                </div>
                
                {!isProductor && (
                  <>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">DNI (Chofer)</label>
                      <input type="text" value={dni} onChange={(e) => setDni(e.target.value)} className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none" required />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Número LiNTI</label>
                      <input type="text" value={numeroLinti} onChange={(e) => setNumeroLinti(e.target.value)} className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none" required />
                    </div>
                  </>
                )}
              </div>
            </form>
          )}

          {activeTab === "DIRECCIONES" && isProductor && (
            <div className="space-y-6">
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                <h3 className="text-sm font-bold text-slate-800 mb-3">Agregar Nueva Dirección</h3>
                <div className="flex flex-col md:flex-row gap-3 items-end">
                  <div className="flex-1">
                    <label className="block text-xs text-slate-500 mb-1">Alias (Ej: Establecimiento La Pampa)</label>
                    <input type="text" value={newAlias} onChange={(e) => setNewAlias(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-sm" placeholder="Alias descriptivo" />
                  </div>
                  <div className="flex-[2]">
                    <label className="block text-xs text-slate-500 mb-1">Dirección / Localidad</label>
                    <input type="text" value={newDireccion} onChange={(e) => setNewDireccion(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-sm" placeholder="Ej: Ruta 5 Km 100, Mercedes, BA" />
                  </div>
                  <button type="button" onClick={handleAddDireccion} className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm px-4 py-1.5 rounded-lg flex items-center gap-1 transition-colors">
                    <Plus className="h-4 w-4" /> Agregar
                  </button>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-1.5">
                  <MapPin className="h-4 w-4 text-emerald-500" />
                  Mis Direcciones Guardadas ({direcciones.length})
                </h3>
                
                {direcciones.length === 0 ? (
                  <div className="text-center py-6 bg-white rounded-xl border border-dashed border-slate-300">
                    <p className="text-slate-500 text-sm">No tienes direcciones cargadas.</p>
                    <p className="text-slate-400 text-xs mt-1">Carga al menos un origen (campo) y un destino (puerto) para publicar viajes.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {direcciones.map((d) => (
                      <div key={d.id} className="bg-white p-3 rounded-xl border border-slate-200 flex items-center justify-between shadow-sm hover:shadow-md transition-shadow">
                        <div>
                          <p className="text-sm font-bold text-slate-800">{d.alias}</p>
                          <p className="text-xs text-slate-500">{d.direccion}</p>
                        </div>
                        <button type="button" onClick={() => handleRemoveDireccion(d.id)} className="text-rose-400 hover:text-rose-600 p-2 bg-rose-50 hover:bg-rose-100 rounded-lg transition-colors">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-white border-t border-slate-200 flex justify-end gap-3 shrink-0 rounded-b-3xl">
          <button type="button" onClick={onClose} className="px-5 py-2 text-sm font-bold text-slate-500 hover:bg-slate-100 rounded-xl transition-colors">
            Cancelar
          </button>
          <button type="submit" form="perfil-form" onClick={(e) => {
            if (activeTab === "DIRECCIONES") {
              handleSubmit(e as any);
            }
          }} disabled={isLoading} className="bg-emerald-600 hover:bg-emerald-500 text-white px-5 py-2 rounded-xl text-sm font-bold flex items-center gap-2 shadow-lg shadow-emerald-500/30 transition-all">
            {isLoading ? "Guardando..." : <><Save className="h-4 w-4" /> Guardar Cambios</>}
          </button>
        </div>
      </div>
    </div>
  );
}

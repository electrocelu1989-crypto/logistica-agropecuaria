import React, { useState } from "react";
import { Usuario } from "../types";
import { UserCircle, Briefcase, FileText, MapPin, Truck, CheckCircle, ShieldAlert } from "lucide-react";

interface UserProfileOnboardingProps {
  currentUser: Usuario;
  onComplete: () => void;
}

export default function UserProfileOnboarding({ currentUser, onComplete }: UserProfileOnboardingProps) {
  const isProductor = currentUser.rol === "PRODUCTOR";

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  // Productor fields
  const [razonSocial, setRazonSocial] = useState(currentUser.razon_social || "");
  const [cuit, setCuit] = useState(currentUser.cuit || "");
  const [condicionIva, setCondicionIva] = useState(currentUser.condicion_iva || "RESPONSABLE_INSCRIPTO");
  const [domicilioFiscal, setDomicilioFiscal] = useState(currentUser.domicilio_fiscal || "");

  // Camionero fields (Perfil Chofer)
  const [dni, setDni] = useState(currentUser.perfil_chofer?.dni || "");
  const [numeroLinti, setNumeroLinti] = useState(currentUser.perfil_chofer?.numero_linti || "");
  const [lintiVencimiento, setLintiVencimiento] = useState(currentUser.perfil_chofer?.linti_vencimiento || "");

  // Camionero fields (Vehículo)
  const [chasisPatente, setChasisPatente] = useState("");
  const [chasisMarca, setChasisMarca] = useState("");
  const [chasisModelo, setChasisModelo] = useState("");
  const [acopladoPatente, setAcopladoPatente] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      const payload: any = {
        id: currentUser.id,
        email: currentUser.email,
        telefono: currentUser.telefono,
        rol: currentUser.rol,
        cuit: isProductor ? cuit : currentUser.cuit,
        razon_social: isProductor ? razonSocial : currentUser.razon_social || currentUser.email,
        condicion_iva: isProductor ? condicionIva : currentUser.condicion_iva || "RESPONSABLE_INSCRIPTO",
        domicilio_fiscal: isProductor ? domicilioFiscal : currentUser.domicilio_fiscal || "Dirección pendiente",
        onboarding_completado: true,
      };

      if (isProductor) {
        payload.razon_social = razonSocial;
        payload.condicion_iva = condicionIva;
        payload.domicilio_fiscal = domicilioFiscal;
      } else {
        payload.perfil_chofer = {
          dni,
          numero_linti: numeroLinti,
          linti_vencimiento: lintiVencimiento,
          validado_por_ansv: true,
          fotos: {
            dni_frente: "https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=600&q=80",
            dni_dorso: "https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=600&q=80",
            linti: "https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=600&q=80"
          }
        };
        payload.vehiculo_data = {
          chasis_patente: chasisPatente,
          chasis_marca: chasisMarca,
          chasis_modelo: chasisModelo,
          chasis_vtv: "2027-01-01",
          chasis_seguro: "2027-01-01",
          acoplado_patente: acopladoPatente,
          acoplado_tipo: "TOLVA",
          acoplado_vtv: "2027-01-01"
        };
      }

      const res = await fetch("/api/usuarios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Error al actualizar el perfil");
      }

      onComplete();
    } catch (err: any) {
      setError(err.message || "Fallo de conexión");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center p-4 font-sans text-slate-800">
      <div className="max-w-3xl w-full bg-white/70 backdrop-blur-xl rounded-3xl shadow-xl overflow-hidden border border-white/50">
        
        {/* Header */}
        <div className="bg-emerald-600 p-8 text-center relative overflow-hidden">
          <div className="relative z-10 flex flex-col items-center">
            <ShieldAlert className="text-emerald-100 mb-3" size={48} />
            <h1 className="text-3xl font-bold text-white mb-2">Completar Perfil Legal</h1>
            <p className="text-emerald-100 max-w-lg">
              Para garantizar la seguridad de la red AgroFlet, necesitamos validar tu identidad y documentación antes de que puedas operar.
            </p>
          </div>
        </div>

        {/* Form */}
        <div className="p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            
            {error && (
              <div className="bg-red-50 text-red-700 p-4 rounded-xl text-sm border border-red-200">
                {error}
              </div>
            )}

            {isProductor ? (
              // ---------------- PRODUCTOR FIELDS ----------------
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-semibold text-slate-600 mb-1">Razón Social</label>
                  <div className="relative">
                    <Briefcase className="absolute left-3 top-3 text-slate-400" size={18} />
                    <input
                      required
                      type="text"
                      className="w-full pl-10 pr-4 py-2 bg-white/50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                      value={razonSocial}
                      onChange={(e) => setRazonSocial(e.target.value)}
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-600 mb-1">CUIT</label>
                  <div className="relative">
                    <FileText className="absolute left-3 top-3 text-slate-400" size={18} />
                    <input
                      required
                      type="text"
                      className="w-full pl-10 pr-4 py-2 bg-white/50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                      value={cuit}
                      onChange={(e) => setCuit(e.target.value)}
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-600 mb-1">Condición frente al IVA</label>
                  <select
                    className="w-full px-4 py-2 bg-white/50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                    value={condicionIva}
                    onChange={(e) => setCondicionIva(e.target.value)}
                  >
                    <option value="RESPONSABLE_INSCRIPTO">Responsable Inscripto</option>
                    <option value="MONOTRIBUTO">Monotributo</option>
                    <option value="EXENTO">Exento</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-600 mb-1">Domicilio Fiscal</label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-3 text-slate-400" size={18} />
                    <input
                      required
                      type="text"
                      className="w-full pl-10 pr-4 py-2 bg-white/50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                      value={domicilioFiscal}
                      onChange={(e) => setDomicilioFiscal(e.target.value)}
                    />
                  </div>
                </div>
              </div>
            ) : (
              // ---------------- CAMIONERO FIELDS ----------------
              <>
                <h3 className="text-lg font-bold text-slate-700 border-b pb-2">1. Datos Personales y Licencia</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-semibold text-slate-600 mb-1">DNI (Chofer)</label>
                    <div className="relative">
                      <UserCircle className="absolute left-3 top-3 text-slate-400" size={18} />
                      <input
                        required
                        type="text"
                        className="w-full pl-10 pr-4 py-2 bg-white/50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                        value={dni}
                        onChange={(e) => setDni(e.target.value)}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-600 mb-1">Número LiNTI</label>
                    <div className="relative">
                      <FileText className="absolute left-3 top-3 text-slate-400" size={18} />
                      <input
                        required
                        type="text"
                        className="w-full pl-10 pr-4 py-2 bg-white/50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                        value={numeroLinti}
                        onChange={(e) => setNumeroLinti(e.target.value)}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-600 mb-1">Vencimiento LiNTI</label>
                    <input
                      required
                      type="date"
                      className="w-full px-4 py-2 bg-white/50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                      value={lintiVencimiento}
                      onChange={(e) => setLintiVencimiento(e.target.value)}
                    />
                  </div>
                </div>

                <h3 className="text-lg font-bold text-slate-700 border-b pb-2 pt-4">2. Datos del Vehículo</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-semibold text-slate-600 mb-1">Patente Chasis</label>
                    <div className="relative">
                      <Truck className="absolute left-3 top-3 text-slate-400" size={18} />
                      <input
                        required
                        type="text"
                        placeholder="Ej: AB123CD"
                        className="w-full pl-10 pr-4 py-2 bg-white/50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                        value={chasisPatente}
                        onChange={(e) => setChasisPatente(e.target.value)}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-600 mb-1">Patente Acoplado</label>
                    <div className="relative">
                      <Truck className="absolute left-3 top-3 text-slate-400" size={18} />
                      <input
                        required
                        type="text"
                        placeholder="Ej: AB999ZZ"
                        className="w-full pl-10 pr-4 py-2 bg-white/50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                        value={acopladoPatente}
                        onChange={(e) => setAcopladoPatente(e.target.value)}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-600 mb-1">Marca del Chasis</label>
                    <input
                      required
                      type="text"
                      placeholder="Ej: Scania, Mercedes-Benz"
                      className="w-full px-4 py-2 bg-white/50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                      value={chasisMarca}
                      onChange={(e) => setChasisMarca(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-600 mb-1">Modelo / Año</label>
                    <input
                      required
                      type="text"
                      placeholder="Ej: G410 - 2018"
                      className="w-full px-4 py-2 bg-white/50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                      value={chasisModelo}
                      onChange={(e) => setChasisModelo(e.target.value)}
                    />
                  </div>
                </div>
              </>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 px-4 rounded-xl shadow-lg hover:shadow-xl transition-all flex justify-center items-center mt-6 disabled:opacity-50"
            >
              {isLoading ? (
                "Guardando..."
              ) : (
                <>
                  <CheckCircle className="mr-2" size={20} />
                  Enviar a Revisión Legal
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

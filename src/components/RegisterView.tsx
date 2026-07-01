import React, { useState } from "react";
import { LogIn, Lock, Mail, ArrowLeft, UserPlus, Phone, CreditCard, Building } from "lucide-react";

interface RegisterViewProps {
  onRegisterSuccess: (user: any) => void;
  onGoToLogin: () => void;
}

export default function RegisterView({ onRegisterSuccess, onGoToLogin }: RegisterViewProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rol, setRol] = useState<"PRODUCTOR" | "CAMIONERO" | "ADMIN">("PRODUCTOR");
  const [cuit, setCuit] = useState("");
  const [telefono, setTelefono] = useState("");
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, rol, cuit, telefono }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Error en el registro");
      }

      onRegisterSuccess(data.user);
    } catch (err: any) {
      setError(err.message || "No se pudo conectar al servidor");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-teal-100 flex items-center justify-center p-4 font-sans">
      <div className="max-w-md w-full bg-white/80 backdrop-blur-xl rounded-3xl shadow-2xl overflow-hidden border border-white/50 my-8">
        <div className="bg-emerald-600/90 p-8 text-center relative overflow-hidden">
          <div className="absolute top-0 right-0 -mt-10 -mr-10 text-white/10">
            <UserPlus size={160} />
          </div>
          <h2 className="text-3xl font-extrabold text-white mb-2 relative z-10">Registro</h2>
          <p className="text-emerald-100 relative z-10 font-medium">Únete a AgroFlet</p>
        </div>
        
        <div className="p-8">
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="bg-red-50 text-red-600 p-3 rounded-xl text-sm border border-red-200">
                {error}
              </div>
            )}
            
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Perfil</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setRol("PRODUCTOR")}
                  className={`py-2 px-3 text-sm font-semibold rounded-xl border transition-all ${rol === "PRODUCTOR" ? "bg-emerald-100 border-emerald-500 text-emerald-800" : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50"}`}
                >
                  Productor
                </button>
                <button
                  type="button"
                  onClick={() => setRol("CAMIONERO")}
                  className={`py-2 px-3 text-sm font-semibold rounded-xl border transition-all ${rol === "CAMIONERO" ? "bg-emerald-100 border-emerald-500 text-emerald-800" : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50"}`}
                >
                  Transportista
                </button>
                <button
                  type="button"
                  onClick={() => setRol("ADMIN")}
                  className={`py-2 px-3 text-sm font-semibold rounded-xl border transition-all col-span-2 ${rol === "ADMIN" ? "bg-amber-100 border-amber-500 text-amber-800" : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50"}`}
                >
                  Administrador (Legal)
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Correo Electrónico</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-slate-400" />
                </div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="block w-full pl-10 pr-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-sm transition-all"
                  placeholder="usuario@ejemplo.com"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Contraseña</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-slate-400" />
                </div>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full pl-10 pr-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-sm transition-all"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">CUIT / DNI</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <CreditCard className="h-5 w-5 text-slate-400" />
                </div>
                <input
                  type="text"
                  required
                  value={cuit}
                  onChange={(e) => setCuit(e.target.value)}
                  className="block w-full pl-10 pr-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-sm transition-all"
                  placeholder="Sin guiones"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Teléfono Móvil</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Phone className="h-5 w-5 text-slate-400" />
                </div>
                <input
                  type="tel"
                  required
                  value={telefono}
                  onChange={(e) => setTelefono(e.target.value)}
                  className="block w-full pl-10 pr-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-sm transition-all"
                  placeholder="+54 9 11 1234-5678"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full mt-4 flex items-center justify-center py-3 px-4 border border-transparent rounded-xl shadow-md text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 transition-all disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {isLoading ? "Creando cuenta..." : "Crear Cuenta"}
            </button>
          </form>

          <div className="mt-6 text-center">
            <button
              onClick={onGoToLogin}
              className="inline-flex items-center text-sm font-bold text-slate-500 hover:text-emerald-700 transition-colors"
            >
              <ArrowLeft className="h-4 w-4 mr-1" /> Volver al Login
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

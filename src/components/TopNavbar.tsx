import React from "react";
import { ShieldCheck, Truck, UserCheck, RefreshCw, LogOut } from "lucide-react";
import { Usuario } from "../types";

interface TopNavbarProps {
  currentRole: "PRODUCTOR" | "CAMIONERO" | "ADMIN";
  onChangeRole: (role: "PRODUCTOR" | "CAMIONERO" | "ADMIN") => void;
  onResetDb: () => void;
  systemStats: {
    totalTrips: number;
    pendingKyc: number;
    pendingCommissions: number;
  };
  onLogout?: () => void;
  currentUser?: Usuario;
  onOpenProfile?: () => void;
}

export default function TopNavbar({ currentRole, onChangeRole, onResetDb, systemStats, onLogout, currentUser, onOpenProfile }: TopNavbarProps) {
  return (
    <header className="bg-gradient-to-r from-[#0f172a] to-[#1e293b] border-b border-slate-800 sticky top-0 z-50 shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo and Branding */}
          <div className="flex items-center space-x-3">
            <div className="bg-[#10b981] text-white p-2 rounded-lg flex items-center justify-center shadow-sm">
              <Truck className="h-5 w-5" id="logo-icon" />
            </div>
            <div>
              <span className="text-white font-bold text-lg tracking-tight flex items-center gap-1.5">
                AgroFlet <span className="text-[#10b981] font-semibold text-[10px] bg-white/10 px-2 py-0.5 rounded font-mono">v1.2.0</span>
              </span>
              <p className="text-slate-400 text-[11px] hidden sm:block">Plataforma Digital de Logística Agropecuaria</p>
            </div>
          </div>

          {/* User Status / Role View */}
          <div className="flex items-center bg-slate-950/80 p-1 rounded-xl border border-slate-800">
            {currentRole === "PRODUCTOR" && (
              <div className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-[#10b981] text-white shadow-md">
                <UserCheck className="h-3.5 w-3.5" />
                <span className="hidden md:inline">Productor</span>
              </div>
            )}
            {currentRole === "CAMIONERO" && (
              <div className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-[#10b981] text-white shadow-md">
                <Truck className="h-3.5 w-3.5" />
                <span className="hidden md:inline">Chofer</span>
              </div>
            )}
            {currentRole === "ADMIN" && (
              <div className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 text-amber-400 shadow-md border border-amber-500/20">
                <ShieldCheck className="h-3.5 w-3.5" />
                <span className="hidden md:inline">Backoffice</span>
              </div>
            )}
          </div>

          {/* Quick Controls & Stats */}
          <div className="flex items-center space-x-3 text-slate-300">
            <div className="hidden lg:flex items-center gap-4 text-[11px] font-mono bg-slate-950/60 border border-slate-800 px-3 py-1.5 rounded-lg">
              <div className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-[#10b981] animate-pulse"></span>
                <span>Viajes: <b className="text-white">{systemStats.totalTrips}</b></span>
              </div>
              <div className="flex items-center gap-1.5">
                <span>Pendientes: <b className="text-amber-400">{systemStats.pendingKyc}</b></span>
              </div>
              <div className="flex items-center gap-1.5">
                <span>Comisiones pend.: <b className="text-amber-400">{systemStats.pendingCommissions}</b></span>
              </div>
            </div>

            {currentUser && (
              <div className="text-xs text-slate-400 hidden sm:block mr-2">
                Hola, <span className="font-semibold text-white">{currentUser.razon_social || currentUser.email}</span>
              </div>
            )}

            {currentUser && onOpenProfile && (
              <button
                onClick={onOpenProfile}
                title="Mi Perfil"
                className="flex items-center gap-1.5 text-xs text-emerald-400 hover:text-emerald-300 bg-slate-800/80 hover:bg-slate-750 p-2 sm:px-3 sm:py-1.5 rounded-lg border border-slate-700/60 transition-colors"
              >
                <UserCheck className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Mi Perfil</span>
              </button>
            )}

            <button
              id="reset-db-btn"
              onClick={onResetDb}
              title="Restaurar base de datos simulada"
              className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-[#10b981] bg-slate-800/80 hover:bg-slate-750 p-2 sm:px-3 sm:py-1.5 rounded-lg border border-slate-700/60 transition-colors"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Reiniciar DB</span>
            </button>

            {onLogout && (
              <button
                onClick={onLogout}
                className="flex items-center gap-1.5 text-xs text-rose-400 hover:text-rose-300 bg-slate-800/80 hover:bg-slate-750 p-2 sm:px-3 sm:py-1.5 rounded-lg border border-slate-700/60 transition-colors"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Salir</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

import React from "react";
import { motion } from "motion/react";
import { UserCheck, Package, Truck, Check, HelpCircle } from "lucide-react";

interface StatusStepperProps {
  estado: "DISPONIBLE" | "ASIGNADO" | "EN_CARGA" | "EN_TRANSITO" | "ENTREGADO" | "CANCELADO";
  theme?: "light" | "dark";
}

const STEPS = [
  {
    key: "ASIGNADO",
    label: "Asignado",
    sub: "Chofer listo",
    icon: UserCheck
  },
  {
    key: "EN_CARGA",
    label: "En Carga",
    sub: "Silo / Cargando",
    icon: Package
  },
  {
    key: "EN_TRANSITO",
    label: "En Viaje",
    sub: "Camino a puerto",
    icon: Truck
  },
  {
    key: "ENTREGADO",
    label: "Entregado",
    sub: "Descargado",
    icon: Check
  }
];

export default function StatusStepper({ estado, theme = "light" }: StatusStepperProps) {
  // Map state to progress index
  const getStepIndex = (est: string) => {
    switch (est) {
      case "ASIGNADO": return 0;
      case "EN_CARGA": return 1;
      case "EN_TRANSITO": return 2;
      case "ENTREGADO": return 3;
      default: return -1; // DISPONIBLE or CANCELADO
    }
  };

  const currentIndex = getStepIndex(estado);

  if (estado === "CANCELADO") {
    return (
      <div className={`p-3 rounded-xl border flex items-center gap-2.5 ${
        theme === "dark" 
          ? "bg-rose-950/20 border-rose-900/30 text-rose-400" 
          : "bg-rose-50 border-rose-200 text-rose-700"
      }`}>
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-rose-500 text-white font-black text-xs">
          ✕
        </span>
        <div>
          <h5 className="text-xs font-bold uppercase tracking-wide">Viaje Cancelado</h5>
          <p className={`text-[10px] ${theme === "dark" ? "text-slate-400" : "text-slate-500"}`}>
            Este flete ha sido cancelado. Los pagos del transporte se acuerdan directamente entre las partes.
          </p>
        </div>
      </div>
    );
  }

  if (estado === "DISPONIBLE") {
    return (
      <div className={`p-3 rounded-xl border flex items-center justify-between gap-2.5 ${
        theme === "dark" 
          ? "bg-slate-900/45 border-slate-800 text-slate-300" 
          : "bg-slate-50 border-slate-200 text-slate-700"
      }`}>
        <div className="flex items-center gap-2">
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-500 text-white font-bold text-[10px] animate-pulse">
            ★
          </span>
          <div>
            <h5 className="text-xs font-bold uppercase tracking-wide">Buscando Transportista</h5>
            <p className={`text-[10px] ${theme === "dark" ? "text-slate-400" : "text-slate-500"}`}>
              Publicado en la bolsa de fletes. Coincidencia activa por radio de cercanía.
            </p>
          </div>
        </div>
        <div className="flex gap-1">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-ping"></span>
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
        </div>
      </div>
    );
  }

  // Calculate percentage for progress line
  // If currentIndex is -1, progress is 0. If 0 (ASIGNADO), progress is 0%.
  // Max is 3 (ENTREGADO), progress is 100%.
  const progressPercent = currentIndex <= 0 ? 0 : (currentIndex / (STEPS.length - 1)) * 100;

  return (
    <div className={`py-3 px-1 rounded-xl border ${
      theme === "dark" 
        ? "bg-slate-950/80 border-slate-800/80" 
        : "bg-slate-50/55 border-slate-150"
    }`}>
      <div className="relative flex justify-between items-start max-w-md mx-auto">
        
        {/* Connection Line Background */}
        <div className={`absolute top-4 left-6 right-6 h-[2px] -translate-y-1/2 -z-1 ${
          theme === "dark" ? "bg-slate-800" : "bg-slate-200"
        }`} />

        {/* Connection Line Progress */}
        <motion.div 
          className="absolute top-4 left-6 h-[2.5px] -translate-y-1/2 bg-emerald-500 -z-1 origin-left"
          initial={{ scaleX: 0 }}
          animate={{ scaleX: progressPercent / 100 }}
          transition={{ duration: 0.5, ease: "easeInOut" }}
          style={{ width: "calc(100% - 48px)" }}
        />

        {/* Steps Loop */}
        {STEPS.map((step, idx) => {
          const StepIcon = step.icon;
          const isCompleted = idx < currentIndex;
          const isActive = idx === currentIndex;
          const isUpcoming = idx > currentIndex;

          let circleClass = "";
          let textClass = "";
          let iconClass = "";

          if (isCompleted) {
            circleClass = "bg-emerald-500 border-emerald-500 text-white shadow-sm shadow-emerald-500/20";
            textClass = theme === "dark" ? "text-emerald-400 font-bold" : "text-emerald-700 font-bold";
            iconClass = "text-white h-3.5 w-3.5";
          } else if (isActive) {
            circleClass = `bg-white border-2 border-emerald-500 text-emerald-500 ring-4 ring-emerald-500/10 ${
              theme === "dark" ? "bg-slate-900 border-emerald-400" : "bg-white"
            }`;
            textClass = theme === "dark" ? "text-white font-extrabold" : "text-slate-900 font-extrabold";
            iconClass = theme === "dark" ? "text-emerald-400 h-3.5 w-3.5 animate-pulse" : "text-emerald-500 h-3.5 w-3.5";
          } else {
            // Upcoming
            circleClass = theme === "dark" 
              ? "bg-slate-900 border border-slate-800 text-slate-500" 
              : "bg-white border border-slate-200 text-slate-400 shadow-xs";
            textClass = theme === "dark" ? "text-slate-500" : "text-slate-400";
            iconClass = "h-3.5 w-3.5";
          }

          return (
            <div key={step.key} className="flex flex-col items-center flex-1 text-center relative z-10">
              
              {/* Step Circle */}
              <motion.div 
                className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${circleClass}`}
                whileHover={{ scale: 1.05 }}
              >
                {isCompleted ? (
                  <Check className="h-4 w-4 stroke-[3]" />
                ) : (
                  <StepIcon className={iconClass} />
                )}
              </motion.div>

              {/* Labels */}
              <div className="mt-2.5 px-0.5">
                <p className={`text-[10px] leading-tight transition-colors ${textClass}`}>
                  {step.label}
                </p>
                <p className={`text-[8px] mt-0.5 font-medium leading-none ${
                  isActive 
                    ? (theme === "dark" ? "text-emerald-400" : "text-emerald-600") 
                    : (theme === "dark" ? "text-slate-500" : "text-slate-400")
                }`}>
                  {step.sub}
                </p>
              </div>

            </div>
          );
        })}

      </div>
    </div>
  );
}

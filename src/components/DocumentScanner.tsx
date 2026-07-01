import React, { useState, useEffect, useRef } from "react";
import { 
  FileText, 
  Upload, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw, 
  Scan, 
  Eye, 
  Camera, 
  Sparkles, 
  Lock, 
  ChevronRight, 
  ShieldCheck,
  FileCheck2,
  X
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface ExtractedData {
  dni?: string;
  nombre?: string;
  linti?: string;
  vencimiento?: string;
}

interface DocumentScannerProps {
  onScanComplete: (documentType: "DNI_FRENTE" | "DNI_DORSO" | "LINTI", data: ExtractedData) => void;
  currentDni?: string;
  currentLinti?: string;
}

// Mock sample documents to let users easily test the automated OCR / KYC check!
const SAMPLE_DOCS = [
  {
    id: "sample-dni-ok",
    label: "DNI Frente (Válido)",
    type: "DNI_FRENTE" as const,
    name: "JUAN CARLOS PEREZ",
    value: "34892154",
    vencimiento: "2032-10-15",
    previewUrl: "https://images.unsplash.com/photo-1554774853-aae0a22c8aa4?w=500&auto=format&fit=crop&q=60", // Business card-like mockup
    isValid: true,
    reason: "Documento vigente, legible y con holograma coincidente en RENAPER."
  },
  {
    id: "sample-dni-expired",
    label: "DNI Frente (Expirado)",
    type: "DNI_FRENTE" as const,
    name: "ALBERTO GOMEZ",
    value: "22340912",
    vencimiento: "2024-03-12", // Expired
    previewUrl: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=500&auto=format&fit=crop&q=60",
    isValid: false,
    reason: "El documento de identidad se encuentra expirado (Venció 12/03/2024)."
  },
  {
    id: "sample-linti-ok",
    label: "Licencia LiNTI (Válida)",
    type: "LINTI" as const,
    name: "JUAN CARLOS PEREZ",
    value: "20348921549",
    vencimiento: "2027-08-20",
    previewUrl: "https://images.unsplash.com/photo-1544377193-33dcf4d68fb5?w=500&auto=format&fit=crop&q=60",
    isValid: true,
    reason: "Licencia LiNTI aprobada por la ANSV para cargas generales e interjurisdiccional."
  },
  {
    id: "sample-linti-invalid",
    label: "Documento Borroso",
    type: "LINTI" as const,
    name: "ILEGIBLE",
    value: "",
    vencimiento: "",
    previewUrl: "https://images.unsplash.com/photo-1586075010923-2dd4570fb338?w=500&auto=format&fit=crop&q=60",
    isValid: false,
    reason: "Error de lectura OCR: Contraste insuficiente o documento demasiado borroso para auditar."
  }
];

export default function DocumentScanner({ onScanComplete, currentDni, currentLinti }: DocumentScannerProps) {
  const [activeDocType, setActiveDocType] = useState<"DNI_FRENTE" | "DNI_DORSO" | "LINTI">("DNI_FRENTE");
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [scanStepMsg, setScanStepMsg] = useState("");
  const [scanResult, setScanResult] = useState<{
    success: boolean;
    name: string;
    value: string;
    vencimiento: string;
    details: string;
  } | null>(null);

  // Keep track of docs successfully scanned
  const [scannedStatus, setScannedStatus] = useState({
    DNI_FRENTE: currentDni ? "VERIFICADO" : "PENDIENTE",
    DNI_DORSO: currentDni ? "VERIFICADO" : "PENDIENTE",
    LINTI: currentLinti ? "VERIFICADO" : "PENDIENTE"
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Status step messages for simulation
  const scanSteps = [
    { threshold: 15, msg: "Detectando bordes del documento..." },
    { threshold: 40, msg: "Optimizando contraste y eliminando reflejos..." },
    { threshold: 65, msg: "Procesando extracción OCR neuronal..." },
    { threshold: 85, msg: "Cruzando datos con servidores oficiales (ANSV / RENAPER)..." },
    { threshold: 100, msg: "Validación de medidas de seguridad completa." }
  ];

  const handleDocTypeChange = (type: "DNI_FRENTE" | "DNI_DORSO" | "LINTI") => {
    setActiveDocType(type);
    setSelectedFile(null);
    setScanResult(null);
    setIsScanning(false);
    setScanProgress(0);
  };

  const startScanningProcess = (docInfo: typeof SAMPLE_DOCS[0] | { name: string, value: string, vencimiento: string, isValid: boolean, reason: string, previewUrl: string }) => {
    setIsScanning(true);
    setScanProgress(0);
    setScanResult(null);
    setSelectedFile(docInfo.previewUrl);

    let progress = 0;
    const interval = setInterval(() => {
      progress += 4;
      if (progress > 100) progress = 100;
      setScanProgress(progress);

      // Find appropriate message
      const step = scanSteps.find(s => progress <= s.threshold);
      if (step) {
        setScanStepMsg(step.msg);
      }

      if (progress === 100) {
        clearInterval(interval);
        setTimeout(() => {
          setIsScanning(false);
          
          const success = docInfo.isValid;
          setScanResult({
            success,
            name: docInfo.name,
            value: docInfo.value,
            vencimiento: docInfo.vencimiento,
            details: docInfo.reason
          });

          if (success) {
            // Update scanned state
            setScannedStatus(prev => ({
              ...prev,
              [activeDocType]: "VERIFICADO"
            }));

            // Callback to parent to auto-fill fields!
            if (activeDocType === "DNI_FRENTE") {
              onScanComplete("DNI_FRENTE", {
                dni: docInfo.value,
                nombre: docInfo.name
              });
            } else if (activeDocType === "LINTI") {
              onScanComplete("LINTI", {
                linti: docInfo.value,
                vencimiento: docInfo.vencimiento
              });
            } else {
              onScanComplete("DNI_DORSO", {});
            }
          } else {
            setScannedStatus(prev => ({
              ...prev,
              [activeDocType]: "RECHAZADO"
            }));
          }
        }, 600);
      }
    }, 80);
  };

  // Handle mock sample selection
  const handleSelectSample = (sample: typeof SAMPLE_DOCS[0]) => {
    startScanningProcess(sample);
  };

  // Handle custom upload simulation
  const handleCustomFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const customMock = {
        name: activeDocType === "LINTI" ? "LUIS MARIA GONZALEZ" : "MARIA FLORENCIA DIAZ",
        value: activeDocType === "LINTI" ? "23315894129" : "31589412",
        vencimiento: "2029-05-18",
        isValid: true,
        reason: "Documento legible de alta resolución. Coincidencia facial biométrica aprobada.",
        previewUrl: URL.createObjectURL(file)
      };
      startScanningProcess(customMock);
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-900 pb-2.5">
        <div className="flex items-center gap-1.5">
          <Scan className="h-4 w-4 text-emerald-400" />
          <h6 className="text-[11px] font-bold uppercase tracking-wider font-mono text-emerald-400">
            Escáner de Identidad KYC Inteligente
          </h6>
        </div>
        <span className="text-[8px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-1.5 py-0.5 rounded font-mono font-bold uppercase">
          Onboarding Seguro L2
        </span>
      </div>

      <p className="text-[10px] text-slate-400 leading-normal">
        Para acelerar su habilitación, suba imágenes legibles de su documentación. El motor OCR de AgroFlet extraerá los datos y validará el estado en tiempo real.
      </p>

      {/* Selector de tipo de documento */}
      <div className="grid grid-cols-3 gap-1.5 bg-slate-900 p-1 rounded-lg border border-slate-850">
        {[
          { key: "DNI_FRENTE", label: "DNI Frente" },
          { key: "DNI_DORSO", label: "DNI Dorso" },
          { key: "LINTI", label: "LiNTI" }
        ].map((doc) => {
          const status = scannedStatus[doc.key as keyof typeof scannedStatus];
          let statusBadge = "●";
          let statusColor = "text-slate-600";
          if (status === "VERIFICADO") {
            statusBadge = "✓";
            statusColor = "text-emerald-400";
          } else if (status === "RECHAZADO") {
            statusBadge = "✕";
            statusColor = "text-rose-400";
          }

          return (
            <button
              key={doc.key}
              type="button"
              onClick={() => handleDocTypeChange(doc.key as any)}
              className={`py-1.5 px-1 rounded text-[9px] font-bold font-mono transition-all relative ${
                activeDocType === doc.key 
                  ? "bg-slate-800 text-white shadow-xs" 
                  : "text-slate-400 hover:text-white hover:bg-slate-850"
              }`}
            >
              <span className={`mr-1 font-bold ${statusColor}`}>{statusBadge}</span>
              {doc.label}
            </button>
          );
        })}
      </div>

      {/* Main scanning zone */}
      <div className="relative bg-slate-900 border border-dashed border-slate-800 rounded-xl overflow-hidden aspect-video flex flex-col items-center justify-center p-4 group">
        <input 
          type="file" 
          ref={fileInputRef} 
          onChange={handleCustomFileChange} 
          accept="image/*" 
          className="hidden" 
        />

        {selectedFile ? (
          <div className="absolute inset-0 w-full h-full">
            <img 
              src={selectedFile} 
              alt="Scan target" 
              className="w-full h-full object-cover opacity-80" 
            />
            {/* Green bounding box overlays for tech flavor */}
            <div className="absolute inset-4 border-2 border-emerald-500/30 rounded">
              <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-emerald-400"></div>
              <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-emerald-400"></div>
              <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-emerald-400"></div>
              <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-emerald-400"></div>
            </div>

            {/* SCANNING LASER EFFECT */}
            {isScanning && (
              <motion.div 
                className="absolute left-0 right-0 h-[3px] bg-emerald-400 shadow-[0_0_12px_#34d399] z-20"
                animate={{ top: ["10%", "90%", "10%"] }}
                transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
              />
            )}
          </div>
        ) : (
          <div className="text-center space-y-2 z-10 p-2">
            <div className="mx-auto w-10 h-10 bg-slate-950 rounded-full flex items-center justify-center border border-slate-800 group-hover:border-emerald-500/40 group-hover:bg-emerald-500/5 transition-all">
              <Upload className="h-5 w-5 text-slate-400 group-hover:text-emerald-400 transition" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-300">
                Arrastre o suba una foto del documento
              </p>
              <p className="text-[8px] text-slate-500 mt-0.5">
                PNG, JPG o PDF de hasta 8MB
              </p>
            </div>
            <button
              type="button"
              onClick={triggerFileInput}
              className="px-2.5 py-1 bg-slate-950 border border-slate-800 text-slate-300 hover:text-white hover:border-emerald-500 rounded text-[9px] font-bold uppercase tracking-wider font-mono transition"
            >
              Seleccionar Archivo
            </button>
          </div>
        )}

        {/* Overlay progress block when scanning */}
        <AnimatePresence>
          {isScanning && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-950/85 flex flex-col items-center justify-center p-4 text-center z-30"
            >
              <div className="space-y-3 w-full max-w-[240px]">
                <div className="flex items-center justify-center gap-1">
                  <RefreshCw className="h-4.5 w-4.5 text-emerald-400 animate-spin" />
                  <span className="text-[11px] font-bold font-mono tracking-wide text-emerald-400 uppercase">
                    Escaneando {scanProgress}%
                  </span>
                </div>
                
                {/* Progress bar */}
                <div className="w-full bg-slate-900 h-1 rounded-full overflow-hidden border border-slate-800">
                  <motion.div 
                    className="h-full bg-emerald-500" 
                    style={{ width: `${scanProgress}%` }}
                  />
                </div>

                <p className="text-[9px] text-slate-300 font-mono animate-pulse min-h-[24px]">
                  {scanStepMsg}
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Quick Test Samples Selector */}
      {!isScanning && !scanResult && (
        <div className="bg-slate-900/60 p-2.5 rounded-lg border border-slate-850 space-y-1.5">
          <p className="text-[8px] uppercase tracking-wider font-bold text-slate-400 font-mono flex items-center gap-1">
            <Sparkles className="h-3 w-3 text-amber-400" />
            Entorno Demo: Imágenes de prueba rápida (OCR Integrado)
          </p>
          <div className="grid grid-cols-2 gap-1.5">
            {SAMPLE_DOCS.filter(s => s.type === activeDocType || (activeDocType === "DNI_DORSO" && s.type === "DNI_FRENTE")).map((sample) => (
              <button
                key={sample.id}
                type="button"
                onClick={() => handleSelectSample(sample)}
                className="bg-slate-950 hover:bg-slate-900 border border-slate-800 hover:border-emerald-500/40 p-1.5 rounded text-left text-[9px] font-medium flex items-center justify-between transition gap-2"
              >
                <span className="text-slate-300 truncate">{sample.label}</span>
                <ChevronRight className="h-3 w-3 text-slate-500 shrink-0" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Scanning result state banner */}
      <AnimatePresence>
        {scanResult && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className={`p-3 rounded-lg border ${
              scanResult.success 
                ? "bg-emerald-950/20 border-emerald-800/30 text-emerald-300" 
                : "bg-rose-950/20 border-rose-800/30 text-rose-300"
            } space-y-2`}
          >
            <div className="flex items-start gap-2">
              {scanResult.success ? (
                <CheckCircle2 className="h-4.5 w-4.5 text-emerald-400 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="h-4.5 w-4.5 text-rose-400 shrink-0 mt-0.5" />
              )}
              <div className="min-w-0 flex-1">
                <h6 className="text-[10px] font-bold uppercase font-mono tracking-wide">
                  {scanResult.success ? "Documentación Procesada con Éxito" : "Auditoría Automática Rechazada"}
                </h6>
                <p className="text-[9px] text-slate-300 mt-0.5 leading-relaxed">
                  {scanResult.details}
                </p>
              </div>
              <button 
                type="button"
                onClick={() => setScanResult(null)}
                className="text-slate-500 hover:text-slate-300"
              >
                <X className="h-3 w-3" />
              </button>
            </div>

            {scanResult.success && (
              <div className="bg-slate-950 p-2 rounded border border-slate-850 text-[9px] font-mono grid grid-cols-2 gap-x-2 gap-y-1 text-slate-400">
                <div>
                  <span className="text-slate-500 font-bold">NOMBRE EXTRAÍDO:</span>
                  <p className="text-emerald-400 font-bold truncate">{scanResult.name}</p>
                </div>
                <div>
                  <span className="text-slate-500 font-bold">NÚMERO EXTRAÍDO:</span>
                  <p className="text-emerald-400 font-bold font-mono">{scanResult.value}</p>
                </div>
                {scanResult.vencimiento && (
                  <div className="col-span-2 pt-1 border-t border-slate-900 mt-1 flex justify-between items-center">
                    <span>VENCE: <b className="text-white font-bold">{scanResult.vencimiento}</b></span>
                    <span className="text-emerald-400 bg-emerald-500/10 px-1 rounded text-[8px] font-bold">REGISTRO SEGURO</span>
                  </div>
                )}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

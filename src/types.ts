export interface Direccion {
  id: string;
  alias: string;
  direccion: string;
  lat: number;
  lng: number;
  geohash?: string;
}

export interface Usuario {
  id: string;
  telefono: string;
  email: string;
  rol: "PRODUCTOR" | "CAMIONERO" | "ADMIN";
  cuit: string;
  razon_social: string;
  condicion_iva: string;
  domicilio_fiscal: string;
  estado_cuenta: "PENDIENTE" | "APROBADO" | "RECHAZADO";
  onboarding_completado?: boolean;
  token_whatsapp_validado: boolean;
  direcciones?: Direccion[];
  fecha_creacion: string;
  perfil_chofer?: {
    dni: string;
    numero_linti: string;
    linti_vencimiento: string;
    validado_por_ansv: boolean;
    fotos: {
      dni_frente: string;
      dni_dorso: string;
      linti: string;
    };
  };
}

export interface Vehiculo {
  id: string;
  chofer_id: string;
  chasis: {
    patente: string;
    marca: string;
    modelo: string;
    vtv_vencimiento: string;
    seguro_vencimiento: string;
    estado_verificacion: "PENDIENTE" | "APROBADO" | "RECHAZADO";
    url_cedula_verde: string;
    url_poliza: string;
    url_vtv: string;
  };
  acoplado?: {
    patente: string;
    tipo_carroceria: "TOLVA" | "BARANDA_VOLCABLE" | "BATEA" | "TODO_PUERTAS";
    vtv_vencimiento: string;
    estado_verificacion: "PENDIENTE" | "APROBADO" | "RECHAZADO";
    url_cedula_titulo: string;
    url_vtv_acoplado: string;
  };
}

export interface TransaccionAlerta {
  monto: number;
  fecha_vencimiento: string;
  plazo_dias: number;
  tipo: "PRODUCTOR" | "CAMIONERO";
  mensaje: string;
  estado: "PENDIENTE" | "VENCIDO" | "COMPLETADO";
}

export interface ComprobantePublicacion {
  fileName: string;
  mimeType: string;
  storagePath: string;
  uploadedAt: string;
  uploadedBy: string;
}

export interface Viaje {
  id: string;
  productor_id: string;
  chofer_id: string | null;
  tipo_grano: "SOJA" | "MAIZ" | "TRIGO" | "GIRASOL" | "SORGO";
  toneladas: number;
  tipo_carroceria_requerida: "TOLVA" | "BARANDA_VOLCABLE" | "BATEA" | "TODO_PUERTAS";
  origen: {
    direccion: string;
    geohash: string;
    lat: number;
    lng: number;
  };
  destino: {
    direccion: string;
    lat: number;
    lng: number;
  };
  tarifa_por_tonelada: number;
  acuerdo_monto?: number;
  numero_transaccion?: string;
  pago_publicacion_estado?: "PENDIENTE" | "ABONADA";
  comprobante_publicacion?: ComprobantePublicacion;
  pago_comision_camionero_estado?: "PENDIENTE" | "ABONADA";
  comprobante_comision_camionero?: ComprobantePublicacion;
  notificaciones_transaccion?: {
    productor: TransaccionAlerta;
    camionero?: TransaccionAlerta;
  };
  fecha_carga_pactada: string;
  estado: "DISPONIBLE" | "ASIGNADO" | "EN_CARGA" | "EN_TRANSITO" | "ENTREGADO" | "CANCELADO";
  fecha_creacion: string;
  fecha_actualizacion: string;
}


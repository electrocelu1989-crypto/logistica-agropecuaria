export interface Penalidad {
  id: string;
  viaje_id: string;
  solicitante_cancelacion_id: string;
  usuario_deudor_id: string;
  usuario_beneficiario_id: string;
  monto_penalidad: number;
  motivo: string;
  detalle_justificacion?: string;
  estado_pago: "PENDIENTE" | "COMPENSADO" | "INCOBRABLE";
  fecha_cancelacion: string;
  fecha_creacion: string;
}

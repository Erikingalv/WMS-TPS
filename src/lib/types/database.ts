// Tipos escritos a mano (sin CLI de Supabase disponible en esta máquina).
// Cuando el proyecto tenga `supabase` CLI, reemplazar por:
//   supabase gen types typescript --project-id <ref> > src/lib/types/database.ts
// manteniendo el mismo nombre de export `Database` para no romper imports.

export type RolUsuario =
  | "administrador"
  | "supervisor"
  | "capturista"
  | "consulta";

// Nota: estos tipos de entidad deben declararse con `type`, no `interface`.
// Con `interface` como Row dentro de Database, la inferencia condicional
// profunda de @supabase/postgrest-js no logra resolver el schema y todo cae
// silenciosamente en `never` (por eso los tipos generados por el CLI de
// Supabase tampoco usan `interface`).
export type Usuario = {
  id: string;
  auth_user_id: string;
  nombre: string;
  correo: string;
  rol: RolUsuario;
  activo: boolean;
  created_at: string;
  updated_at: string;
};

export type Cliente = {
  id: string;
  nombre: string;
  empresa: string | null;
  rfc: string | null;
  direccion: string | null;
  contacto: string | null;
  correo: string | null;
  telefono: string | null;
  observaciones: string | null;
  activo: boolean;
  created_at: string;
  updated_at: string;
};

export type Producto = {
  id: string;
  cliente_id: string;
  nombre: string;
  sku: string;
  descripcion: string | null;
  unidad: string;
  peso_kg: number | null;
  largo_cm: number | null;
  ancho_cm: number | null;
  alto_cm: number | null;
  foto_url: string | null;
  codigo_barras: string | null;
  stock_minimo_piezas: number | null;
  activo: boolean;
  created_at: string;
  updated_at: string;
};

export type Ubicacion = {
  id: string;
  codigo: string;
  zona: string | null;
  capacidad_max_tarimas: number;
  activo: boolean;
  created_at: string;
  updated_at: string;
};

export type EstadoLote = "activo" | "agotado";

export type Lote = {
  id: string;
  producto_id: string;
  codigo_lote: string;
  fecha_ingreso: string;
  fecha_caducidad: string | null;
  piezas_inicial: number;
  tarimas_inicial: number;
  estado: EstadoLote;
  qr_payload: string;
  created_at: string;
  updated_at: string;
};

export type InventarioLoteUbicacion = {
  id: string;
  lote_id: string;
  ubicacion_id: string;
  cantidad_piezas: number;
  cantidad_tarimas: number;
  updated_at: string;
};

export type Entrada = {
  id: string;
  fecha: string;
  cliente_id: string;
  producto_id: string;
  lote_id: string;
  cantidad_piezas: number;
  cantidad_tarimas: number;
  peso_kg: number | null;
  ubicacion_id: string;
  recibio_usuario_id: string | null;
  observaciones: string | null;
  created_by: string;
  created_at: string;
  hora_carga_descarga: string;
  cajas_por_pallet: number | null;
  cantidad_por_caja: number | null;
  categoria_producto: string | null;
  lote_1: string | null;
  lote_2: string | null;
  numero_contenedor: string | null;
  numero_bl: string | null;
  presentacion: string | null;
};

export type Salida = {
  id: string;
  fecha: string;
  cliente_id: string;
  producto_id: string;
  lote_id: string;
  ubicacion_id: string;
  cantidad_piezas: number;
  cantidad_tarimas: number;
  destino: string | null;
  transportista: string | null;
  placas: string | null;
  operador: string | null;
  autorizo_usuario_id: string | null;
  observaciones: string | null;
  firma_digital_url: string | null;
  created_by: string;
  created_at: string;
  hora_carga_descarga: string;
  cajas_por_pallet: number | null;
  cantidad_por_caja: number | null;
  categoria_producto: string | null;
  lote_1: string | null;
  lote_2: string | null;
  numero_contenedor: string | null;
  numero_bl: string | null;
  presentacion: string | null;
};

export type MovimientoInterno = {
  id: string;
  lote_id: string;
  ubicacion_origen_id: string;
  ubicacion_destino_id: string;
  cantidad_piezas: number;
  cantidad_tarimas: number;
  motivo: string | null;
  usuario_id: string;
  created_at: string;
};

export type TipoDocumento =
  | "factura"
  | "carta_porte"
  | "packing_list"
  | "orden_compra"
  | "foto"
  | "otro";

export type ArchivoAdjunto = {
  id: string;
  entidad_tipo: "entrada" | "salida";
  entidad_id: string;
  tipo_documento: TipoDocumento;
  storage_path: string;
  nombre_archivo: string | null;
  subido_por: string | null;
  created_at: string;
};

export type EstadoReserva = "activa" | "liberada" | "consumida";

export type Reserva = {
  id: string;
  lote_id: string;
  ubicacion_id: string;
  cantidad_piezas: number;
  cantidad_tarimas: number;
  fecha_reserva: string;
  fecha_liberacion: string | null;
  estado: EstadoReserva;
  usuario_id: string;
  observaciones: string | null;
};

export type EstadoAuditoria = "en_proceso" | "cerrada";

export type Auditoria = {
  id: string;
  fecha_inicio: string;
  fecha_cierre: string | null;
  responsable_id: string;
  estado: EstadoAuditoria;
  observaciones: string | null;
};

export type AuditoriaDetalle = {
  id: string;
  auditoria_id: string;
  lote_id: string;
  ubicacion_id: string;
  cantidad_sistema_piezas: number;
  cantidad_sistema_tarimas: number;
  cantidad_fisica_piezas: number | null;
  cantidad_fisica_tarimas: number | null;
  diferencia_piezas: number | null;
  diferencia_tarimas: number | null;
  observaciones: string | null;
  contado_por: string | null;
  contado_at: string | null;
};

export type TipoAlerta = "dias_almacenados" | "ocupacion" | "inventario_bajo" | "caducidad";
export type NivelAlerta = "info" | "warning" | "critico";

export type Alerta = {
  id: string;
  tipo: TipoAlerta;
  referencia_tabla: string;
  referencia_id: string;
  mensaje: string;
  nivel: NivelAlerta;
  atendida: boolean;
  atendida_por: string | null;
  atendida_at: string | null;
  created_at: string;
};

export type ConfiguracionAlertas = {
  id: string;
  umbral_dias_amarillo: number;
  umbral_dias_naranja: number;
  umbral_dias_rojo: number;
  umbral_ocupacion_pct: number;
  umbral_caducidad_dias: number;
  created_at: string;
  updated_at: string;
};

export type Periodicidad = "diario" | "semanal" | "mensual";

export type TarifaAlmacenaje = {
  id: string;
  cliente_id: string;
  nombre: string;
  periodicidad: Periodicidad;
  activo: boolean;
  created_at: string;
  updated_at: string;
};

export type TarifaEscalon = {
  id: string;
  tarifa_id: string;
  dia_inicio: number;
  dia_fin: number | null;
  costo_por_tarima: number;
  es_gratis: boolean;
};

export type EstadoCargo = "pendiente" | "facturado";

export type CargoAlmacenaje = {
  id: string;
  lote_id: string;
  cliente_id: string;
  tarifa_id: string | null;
  periodo_desde: string;
  periodo_hasta: string;
  dias: number;
  tarimas_promedio: number;
  costo_calculado: number;
  estado: EstadoCargo;
  created_at: string;
  updated_at: string;
};

export type HistorialMovimiento = {
  id: string;
  tabla_afectada: string;
  registro_id: string | null;
  tipo_movimiento: string;
  usuario_id: string | null;
  fecha_hora: string;
  ip: string | null;
  dispositivo: string | null;
  datos_antes: Record<string, unknown> | null;
  datos_despues: Record<string, unknown> | null;
};

// Debe calzar con `GenericTable` de @supabase/postgrest-js (Row/Insert/Update
// /Relationships) o el cliente tipado cae en `never` para todas las tablas.
type TableDef<Row, Insert, Update> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: [];
};

export type Database = {
  public: {
    Tables: {
      usuarios: TableDef<
        Usuario,
        Omit<Usuario, "id" | "created_at" | "updated_at"> & { id?: string },
        Partial<Omit<Usuario, "id">>
      >;
      clientes: TableDef<
        Cliente,
        Omit<Cliente, "id" | "created_at" | "updated_at" | "activo"> & {
          id?: string;
          activo?: boolean;
        },
        Partial<Omit<Cliente, "id">>
      >;
      productos: TableDef<
        Producto,
        Omit<Producto, "id" | "created_at" | "updated_at" | "activo"> & {
          id?: string;
          activo?: boolean;
        },
        Partial<Omit<Producto, "id">>
      >;
      ubicaciones: TableDef<
        Ubicacion,
        Omit<Ubicacion, "id" | "created_at" | "updated_at" | "activo"> & {
          id?: string;
          activo?: boolean;
        },
        Partial<Omit<Ubicacion, "id">>
      >;
      lotes: TableDef<
        Lote,
        Omit<Lote, "id" | "created_at" | "updated_at">,
        Partial<Omit<Lote, "id">>
      >;
      inventario_lote_ubicacion: TableDef<
        InventarioLoteUbicacion,
        Omit<InventarioLoteUbicacion, "id" | "updated_at"> & { id?: string },
        Partial<Omit<InventarioLoteUbicacion, "id">>
      >;
      entradas: TableDef<
        Entrada,
        Omit<Entrada, "id" | "created_at">,
        Partial<Omit<Entrada, "id">>
      >;
      salidas: TableDef<
        Salida,
        Omit<Salida, "id" | "created_at">,
        Partial<Omit<Salida, "id">>
      >;
      movimientos_internos: TableDef<
        MovimientoInterno,
        Omit<MovimientoInterno, "id" | "created_at">,
        Partial<Omit<MovimientoInterno, "id">>
      >;
      archivos_adjuntos: TableDef<
        ArchivoAdjunto,
        Omit<ArchivoAdjunto, "id" | "created_at">,
        Partial<Omit<ArchivoAdjunto, "id">>
      >;
      historial_movimientos: TableDef<
        HistorialMovimiento,
        Omit<HistorialMovimiento, "id">,
        Partial<Omit<HistorialMovimiento, "id">>
      >;
      reservas: TableDef<
        Reserva,
        Omit<Reserva, "id" | "fecha_reserva" | "fecha_liberacion" | "estado"> & {
          id?: string;
          estado?: EstadoReserva;
        },
        Partial<Omit<Reserva, "id">>
      >;
      auditorias: TableDef<
        Auditoria,
        Omit<Auditoria, "id" | "fecha_inicio" | "fecha_cierre" | "estado"> & {
          id?: string;
          estado?: EstadoAuditoria;
        },
        Partial<Omit<Auditoria, "id">>
      >;
      auditoria_detalle: TableDef<
        AuditoriaDetalle,
        Omit<
          AuditoriaDetalle,
          "id" | "diferencia_piezas" | "diferencia_tarimas" | "contado_at" | "contado_por"
        > & { id?: string; contado_por?: string | null; contado_at?: string | null },
        Partial<Omit<AuditoriaDetalle, "id" | "diferencia_piezas" | "diferencia_tarimas">>
      >;
      alertas: TableDef<
        Alerta,
        Omit<Alerta, "id" | "created_at" | "atendida" | "atendida_por" | "atendida_at"> & {
          id?: string;
          atendida?: boolean;
        },
        Partial<Omit<Alerta, "id">>
      >;
      configuracion_alertas: TableDef<
        ConfiguracionAlertas,
        Omit<ConfiguracionAlertas, "id" | "created_at" | "updated_at"> & { id?: string },
        Partial<Omit<ConfiguracionAlertas, "id">>
      >;
      tarifas_almacenaje: TableDef<
        TarifaAlmacenaje,
        Omit<TarifaAlmacenaje, "id" | "created_at" | "updated_at" | "activo"> & {
          id?: string;
          activo?: boolean;
        },
        Partial<Omit<TarifaAlmacenaje, "id">>
      >;
      tarifa_escalones: TableDef<
        TarifaEscalon,
        Omit<TarifaEscalon, "id"> & { id?: string },
        Partial<Omit<TarifaEscalon, "id">>
      >;
      cargos_almacenaje: TableDef<
        CargoAlmacenaje,
        Omit<CargoAlmacenaje, "id" | "created_at" | "updated_at" | "estado"> & {
          id?: string;
          estado?: EstadoCargo;
        },
        Partial<Omit<CargoAlmacenaje, "id">>
      >;
    };
    Views: Record<string, never>;
    Functions: {
      registrar_entrada: {
        Args: {
          p_cliente_id: string;
          p_producto_id: string;
          p_ubicacion_id: string;
          p_cantidad_piezas: number;
          p_cantidad_tarimas: number;
          p_fecha_movimiento: string;
          p_hora_carga_descarga: string;
          p_peso_kg: number | null;
          p_recibio_usuario_id: string | null;
          p_observaciones: string | null;
          p_fecha_caducidad?: string | null;
          p_cajas_por_pallet?: number | null;
          p_cantidad_por_caja?: number | null;
          p_categoria_producto?: string | null;
          p_lote_1?: string | null;
          p_lote_2?: string | null;
          p_numero_contenedor?: string | null;
          p_numero_bl?: string | null;
          p_presentacion?: string | null;
        };
        Returns: Entrada;
      };
      registrar_salida: {
        Args: {
          p_lote_id: string;
          p_ubicacion_id: string;
          p_cantidad_piezas: number;
          p_cantidad_tarimas: number;
          p_fecha_movimiento: string;
          p_hora_carga_descarga: string;
          p_destino: string | null;
          p_transportista: string | null;
          p_placas: string | null;
          p_operador: string | null;
          p_autorizo_usuario_id: string | null;
          p_observaciones: string | null;
          p_firma_digital_url?: string | null;
          p_cajas_por_pallet?: number | null;
          p_cantidad_por_caja?: number | null;
          p_categoria_producto?: string | null;
          p_lote_1?: string | null;
          p_lote_2?: string | null;
          p_numero_contenedor?: string | null;
          p_numero_bl?: string | null;
          p_presentacion?: string | null;
        };
        Returns: Salida;
      };
      registrar_movimiento_interno: {
        Args: {
          p_lote_id: string;
          p_ubicacion_origen_id: string;
          p_ubicacion_destino_id: string;
          p_cantidad_piezas: number;
          p_cantidad_tarimas: number;
          p_motivo: string | null;
        };
        Returns: MovimientoInterno;
      };
      registrar_reserva: {
        Args: {
          p_lote_id: string;
          p_ubicacion_id: string;
          p_cantidad_piezas: number;
          p_cantidad_tarimas: number;
          p_observaciones: string | null;
        };
        Returns: Reserva;
      };
      liberar_reserva: {
        Args: { p_reserva_id: string };
        Returns: Reserva;
      };
      marcar_alerta_atendida: {
        Args: { p_alerta_id: string };
        Returns: Alerta;
      };
      generar_alertas: {
        Args: Record<string, never>;
        Returns: undefined;
      };
      calcular_cargo_lote: {
        Args: { p_lote_id: string };
        Returns: CargoAlmacenaje | null;
      };
      calcular_cargos_almacenaje: {
        Args: Record<string, never>;
        Returns: undefined;
      };
      iniciar_auditoria: {
        Args: { p_observaciones?: string | null };
        Returns: Auditoria;
      };
      cerrar_auditoria: {
        Args: { p_auditoria_id: string };
        Returns: Auditoria;
      };
    };
  };
};

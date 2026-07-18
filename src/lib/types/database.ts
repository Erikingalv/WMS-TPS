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
          p_peso_kg: number | null;
          p_recibio_usuario_id: string | null;
          p_observaciones: string | null;
          p_fecha_caducidad?: string | null;
        };
        Returns: Entrada;
      };
      registrar_salida: {
        Args: {
          p_lote_id: string;
          p_ubicacion_id: string;
          p_cantidad_piezas: number;
          p_cantidad_tarimas: number;
          p_destino: string | null;
          p_transportista: string | null;
          p_placas: string | null;
          p_operador: string | null;
          p_autorizo_usuario_id: string | null;
          p_observaciones: string | null;
          p_firma_digital_url?: string | null;
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
    };
  };
};

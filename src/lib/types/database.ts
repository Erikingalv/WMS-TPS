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
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
  };
};

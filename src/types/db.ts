// Tipos de la base de datos Supabase.
//
// Normalmente se generarían con `supabase gen types typescript`, pero ese
// comando requiere un proyecto Supabase ya provisionado. Este archivo se
// escribió a mano a partir de supabase/01_schema.sql y debe mantenerse
// sincronizado con él. Una vez exista el proyecto real, puede
// reemplazarse por la salida del generador sin tocar el código que lo
// consume (src/server/integrations/supabase.ts expone el mismo tipo).
//
// `Relationships: []` en cada tabla es requerido por el tipo `GenericTable`
// de @supabase/postgrest-js aunque este proyecto no declare joins vía FK
// embeds (las relaciones se resuelven con `select` explícito + JOIN en
// las funciones SQL, no con la sintaxis de embeds de PostgREST).

export interface Database {
  public: {
    Tables: {
      categorias: {
        Row: {
          id: number;
          slug: string;
          nombre: string;
          descripcion: string | null;
          icono: string | null;
          orden: number;
        };
        Insert: Partial<Database["public"]["Tables"]["categorias"]["Row"]>;
        Update: Partial<Database["public"]["Tables"]["categorias"]["Row"]>;
        Relationships: [];
      };
      modelos_toyota: {
        Row: {
          id: number;
          slug: string;
          nombre: string;
          carroceria: string | null;
          anio_desde: number;
          anio_hasta: number | null;
        };
        Insert: Partial<Database["public"]["Tables"]["modelos_toyota"]["Row"]>;
        Update: Partial<Database["public"]["Tables"]["modelos_toyota"]["Row"]>;
        Relationships: [];
      };
      repuestos: {
        Row: {
          id: string;
          sku: string;
          slug: string;
          nombre: string;
          descripcion: string;
          categoria_id: number;
          numero_parte: string | null;
          marca_repuesto: string;
          precio: number;
          moneda: string;
          imagen_url: string;
          garantia_meses: number;
          especificaciones: Record<string, unknown>;
          destacado: boolean;
          activo: boolean;
          creado_en: string;
        };
        Insert: Partial<Database["public"]["Tables"]["repuestos"]["Row"]>;
        Update: Partial<Database["public"]["Tables"]["repuestos"]["Row"]>;
        Relationships: [];
      };
      repuesto_compatibilidad: {
        Row: {
          repuesto_id: string;
          modelo_id: number;
          anio_desde: number | null;
          anio_hasta: number | null;
        };
        Insert: Partial<Database["public"]["Tables"]["repuesto_compatibilidad"]["Row"]>;
        Update: Partial<Database["public"]["Tables"]["repuesto_compatibilidad"]["Row"]>;
        Relationships: [];
      };
      inventario: {
        Row: {
          repuesto_id: string;
          stock: number;
          stock_reservado: number;
          stock_disponible: number;
          stock_minimo: number;
          ubicacion: string | null;
          dias_reposicion: number;
          actualizado_en: string;
        };
        Insert: Partial<Database["public"]["Tables"]["inventario"]["Row"]>;
        Update: Partial<Database["public"]["Tables"]["inventario"]["Row"]>;
        Relationships: [];
      };
      mantenimientos: {
        Row: {
          id: number;
          slug: string;
          nombre: string;
          descripcion: string;
          duracion_minutos: number;
          precio: number;
          intervalo_km: number | null;
          incluye: string[];
          imagen_url: string | null;
          orden: number;
          activo: boolean;
        };
        Insert: Partial<Database["public"]["Tables"]["mantenimientos"]["Row"]>;
        Update: Partial<Database["public"]["Tables"]["mantenimientos"]["Row"]>;
        Relationships: [];
      };
      citas: {
        Row: {
          id: string;
          codigo: string;
          nombre_cliente: string;
          email: string;
          telefono: string;
          modelo_vehiculo: string;
          anio_vehiculo: number | null;
          placa: string | null;
          mantenimiento_id: number;
          inicio: string;
          fin: string;
          estado: "confirmada" | "cancelada" | "atendida" | "no_asistio";
          google_event_id: string | null;
          notas: string | null;
          origen: "chat" | "web";
          creado_en: string;
          cancelada_en: string | null;
          motivo_cancelacion: string | null;
        };
        Insert: Partial<Database["public"]["Tables"]["citas"]["Row"]>;
        Update: Partial<Database["public"]["Tables"]["citas"]["Row"]>;
        Relationships: [];
      };
      pedidos: {
        Row: {
          id: string;
          codigo: string;
          nombre_cliente: string;
          email: string;
          telefono: string;
          modalidad_entrega: "recojo" | "delivery";
          direccion: string | null;
          distrito: string | null;
          ciudad: string | null;
          referencia_entrega: string | null;
          monto_items: number;
          costo_envio: number;
          subtotal: number;
          igv: number;
          total: number;
          estado: "pendiente" | "pagado" | "rechazado" | "anulado";
          metodo_pago: string;
          referencia_pago: string | null;
          ultimos4: string | null;
          creado_en: string;
        };
        Insert: Partial<Database["public"]["Tables"]["pedidos"]["Row"]>;
        Update: Partial<Database["public"]["Tables"]["pedidos"]["Row"]>;
        Relationships: [];
      };
      pedido_items: {
        Row: {
          id: number;
          pedido_id: string;
          repuesto_id: string;
          sku: string;
          nombre: string;
          precio_unitario: number;
          cantidad: number;
          subtotal: number;
        };
        Insert: Partial<Database["public"]["Tables"]["pedido_items"]["Row"]>;
        Update: Partial<Database["public"]["Tables"]["pedido_items"]["Row"]>;
        Relationships: [];
      };
      emails_enviados: {
        Row: {
          id: number;
          tipo: "cita_confirmada" | "cita_cancelada" | "pedido_confirmado";
          destinatario: string;
          asunto: string;
          referencia: string;
          clave_idem: string;
          proveedor: string;
          proveedor_id: string | null;
          estado: "enviado" | "fallido";
          error_detalle: string | null;
          intentos: number;
          creado_en: string;
        };
        Insert: Partial<Database["public"]["Tables"]["emails_enviados"]["Row"]>;
        Update: Partial<Database["public"]["Tables"]["emails_enviados"]["Row"]>;
        Relationships: [];
      };
      conversaciones: {
        Row: {
          id: string;
          session_id: string;
          creado_en: string;
          meta: Record<string, unknown>;
        };
        Insert: Partial<Database["public"]["Tables"]["conversaciones"]["Row"]>;
        Update: Partial<Database["public"]["Tables"]["conversaciones"]["Row"]>;
        Relationships: [];
      };
      mensajes: {
        Row: {
          id: number;
          conversacion_id: string;
          rol: "user" | "assistant" | "tool" | "system";
          contenido: string | null;
          tool_nombre: string | null;
          tool_payload: Record<string, unknown> | null;
          tool_resultado: Record<string, unknown> | null;
          latencia_ms: number | null;
          creado_en: string;
        };
        Insert: Partial<Database["public"]["Tables"]["mensajes"]["Row"]>;
        Update: Partial<Database["public"]["Tables"]["mensajes"]["Row"]>;
        Relationships: [];
      };
      faq_toyota: {
        Row: {
          id: number;
          pregunta: string;
          respuesta: string;
          categoria: string;
          modelos: string[];
          tags: string[];
        };
        Insert: Partial<Database["public"]["Tables"]["faq_toyota"]["Row"]>;
        Update: Partial<Database["public"]["Tables"]["faq_toyota"]["Row"]>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      buscar_repuestos: {
        Args: {
          p_consulta?: string | null;
          p_modelo?: string | null;
          p_anio?: number | null;
          p_categoria?: string | null;
          p_limite?: number | null;
        };
        Returns: {
          id: string;
          sku: string;
          slug: string;
          nombre: string;
          descripcion: string;
          categoria: string;
          precio: number;
          imagen_url: string;
          stock_disponible: number;
          estado_stock: string;
          compatibilidad: string[];
          relevancia: number;
        }[];
      };
      buscar_conocimiento: {
        Args: { p_consulta: string; p_limite?: number | null };
        Returns: {
          id: number;
          pregunta: string;
          respuesta: string;
          categoria: string;
          relevancia: number;
        }[];
      };
      descontar_stock: {
        Args: { p_repuesto_id: string; p_cantidad: number };
        Returns: number;
      };
      citas_por_email: {
        Args: { p_email: string; p_incluir_pasadas?: boolean | null; p_limite?: number | null };
        Returns: {
          codigo: string;
          estado: string;
          inicio: string;
          servicio: string;
          precio: number;
          duracion_minutos: number;
          modelo_vehiculo: string;
          placa: string | null;
          es_futura: boolean;
        }[];
      };
      cancelar_cita: {
        Args: { p_codigo: string; p_email: string; p_motivo?: string | null };
        Returns: {
          codigo: string;
          google_event_id: string | null;
          inicio: string;
          servicio: string;
        }[];
      };
    };
    Enums: Record<string, never>;
  };
}

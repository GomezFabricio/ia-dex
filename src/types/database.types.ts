export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      clasificaciones_si: {
        Row: {
          created_at: string | null
          ejemplos: string | null
          en_que_consiste: string | null
          enlaces: Json | null
          id: string
          imagen_url: string | null
          nombre: string
          orden: number | null
          slug: string
        }
        Insert: {
          created_at?: string | null
          ejemplos?: string | null
          en_que_consiste?: string | null
          enlaces?: Json | null
          id?: string
          imagen_url?: string | null
          nombre: string
          orden?: number | null
          slug: string
        }
        Update: {
          created_at?: string | null
          ejemplos?: string | null
          en_que_consiste?: string | null
          enlaces?: Json | null
          id?: string
          imagen_url?: string | null
          nombre?: string
          orden?: number | null
          slug?: string
        }
        Relationships: []
      }
      eventos: {
        Row: {
          created_at: string | null
          id: string
          metadata: Json | null
          software_id: string | null
          tipo: string
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          metadata?: Json | null
          software_id?: string | null
          tipo: string
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          metadata?: Json | null
          software_id?: string | null
          tipo?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "eventos_software_id_fkey"
            columns: ["software_id"]
            isOneToOne: false
            referencedRelation: "software"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "eventos_software_id_fkey"
            columns: ["software_id"]
            isOneToOne: false
            referencedRelation: "v_software_populares"
            referencedColumns: ["software_id"]
          },
          {
            foreignKeyName: "eventos_software_id_fkey"
            columns: ["software_id"]
            isOneToOne: false
            referencedRelation: "v_software_rating"
            referencedColumns: ["software_id"]
          },
        ]
      }
      mensajes_foro: {
        Row: {
          contenido: string
          created_at: string | null
          id: string
          tema_foro_id: string
          user_id: string
        }
        Insert: {
          contenido: string
          created_at?: string | null
          id?: string
          tema_foro_id: string
          user_id: string
        }
        Update: {
          contenido?: string
          created_at?: string | null
          id?: string
          tema_foro_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mensajes_foro_tema_foro_id_fkey"
            columns: ["tema_foro_id"]
            isOneToOne: false
            referencedRelation: "temas_foro"
            referencedColumns: ["id"]
          },
        ]
      }
      software: {
        Row: {
          anio_lanzamiento: number | null
          autor_referencia: string | null
          clasificacion_si_id: string | null
          created_at: string | null
          descripcion_corta: string | null
          id: string
          imagen_url: string | null
          licencia: string | null
          nombre: string
          objetivo: string | null
          tema_id: string
          url_acceso: string | null
          video_url: string | null
        }
        Insert: {
          anio_lanzamiento?: number | null
          autor_referencia?: string | null
          clasificacion_si_id?: string | null
          created_at?: string | null
          descripcion_corta?: string | null
          id?: string
          imagen_url?: string | null
          licencia?: string | null
          nombre: string
          objetivo?: string | null
          tema_id: string
          url_acceso?: string | null
          video_url?: string | null
        }
        Update: {
          anio_lanzamiento?: number | null
          autor_referencia?: string | null
          clasificacion_si_id?: string | null
          created_at?: string | null
          descripcion_corta?: string | null
          id?: string
          imagen_url?: string | null
          licencia?: string | null
          nombre?: string
          objetivo?: string | null
          tema_id?: string
          url_acceso?: string | null
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "software_clasificacion_si_id_fkey"
            columns: ["clasificacion_si_id"]
            isOneToOne: false
            referencedRelation: "clasificaciones_si"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "software_tema_id_fkey"
            columns: ["tema_id"]
            isOneToOne: false
            referencedRelation: "temas"
            referencedColumns: ["id"]
          },
        ]
      }
      temas: {
        Row: {
          created_at: string | null
          descripcion: string | null
          id: string
          nombre: string
          orden: number | null
          slug: string
        }
        Insert: {
          created_at?: string | null
          descripcion?: string | null
          id?: string
          nombre: string
          orden?: number | null
          slug: string
        }
        Update: {
          created_at?: string | null
          descripcion?: string | null
          id?: string
          nombre?: string
          orden?: number | null
          slug?: string
        }
        Relationships: []
      }
      temas_foro: {
        Row: {
          created_at: string | null
          cuerpo: string | null
          id: string
          titulo: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          cuerpo?: string | null
          id?: string
          titulo: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          cuerpo?: string | null
          id?: string
          titulo?: string
          user_id?: string
        }
        Relationships: []
      }
      valoraciones: {
        Row: {
          contenido_id: string
          contenido_tipo: string
          created_at: string | null
          id: string
          puntaje: number
          user_id: string
        }
        Insert: {
          contenido_id: string
          contenido_tipo: string
          created_at?: string | null
          id?: string
          puntaje: number
          user_id: string
        }
        Update: {
          contenido_id?: string
          contenido_tipo?: string
          created_at?: string | null
          id?: string
          puntaje?: number
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      v_software_populares: {
        Row: {
          nombre: string | null
          software_id: string | null
          vistas: number | null
        }
        Relationships: []
      }
      v_software_rating: {
        Row: {
          cantidad_votos: number | null
          nombre: string | null
          promedio: number | null
          software_id: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const

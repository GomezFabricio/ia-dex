// TODO: regenerate via gen:types once supabase login is available
// Command: npm run gen:types
// This file mirrors the verified Supabase schema for project othwyesmfpjaykbdwxrh.
// Column nullability verified via live PostgREST column-explicit probe (2026-06-10).

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      temas: {
        Row: {
          id: string
          slug: string
          nombre: string
          descripcion: string | null
          orden: number
          created_at: string
        }
        Insert: {
          id?: string
          slug: string
          nombre: string
          descripcion?: string | null
          orden?: number
          created_at?: string
        }
        Update: {
          id?: string
          slug?: string
          nombre?: string
          descripcion?: string | null
          orden?: number
          created_at?: string
        }
        Relationships: []
      }
      clasificaciones_si: {
        Row: {
          id: string
          slug: string
          nombre: string
          en_que_consiste: string | null
          imagen_url: string | null
          ejemplos: string | null
          enlaces: Json
          orden: number
          created_at: string
        }
        Insert: {
          id?: string
          slug: string
          nombre: string
          en_que_consiste?: string | null
          imagen_url?: string | null
          ejemplos?: string | null
          enlaces?: Json
          orden?: number
          created_at?: string
        }
        Update: {
          id?: string
          slug?: string
          nombre?: string
          en_que_consiste?: string | null
          imagen_url?: string | null
          ejemplos?: string | null
          enlaces?: Json
          orden?: number
          created_at?: string
        }
        Relationships: []
      }
      software: {
        Row: {
          id: string
          tema_id: string
          clasificacion_si_id: string | null
          nombre: string
          objetivo: string | null
          descripcion_corta: string | null
          url_acceso: string | null
          licencia: string | null
          anio_lanzamiento: number | null
          autor_referencia: string | null
          video_url: string | null
          imagen_url: string | null
          created_at: string
        }
        Insert: {
          id?: string
          tema_id: string
          clasificacion_si_id?: string | null
          nombre: string
          objetivo?: string | null
          descripcion_corta?: string | null
          url_acceso?: string | null
          licencia?: string | null
          anio_lanzamiento?: number | null
          autor_referencia?: string | null
          video_url?: string | null
          imagen_url?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          tema_id?: string
          clasificacion_si_id?: string | null
          nombre?: string
          objetivo?: string | null
          descripcion_corta?: string | null
          url_acceso?: string | null
          licencia?: string | null
          anio_lanzamiento?: number | null
          autor_referencia?: string | null
          video_url?: string | null
          imagen_url?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "software_tema_id_fkey"
            columns: ["tema_id"]
            isOneToOne: false
            referencedRelation: "temas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "software_clasificacion_si_id_fkey"
            columns: ["clasificacion_si_id"]
            isOneToOne: false
            referencedRelation: "clasificaciones_si"
            referencedColumns: ["id"]
          }
        ]
      }
      valoraciones: {
        Row: {
          id: string
          user_id: string | null
          contenido_tipo: string
          contenido_id: string
          puntaje: number
          created_at: string
        }
        Insert: {
          id?: string
          user_id?: string | null
          contenido_tipo: string
          contenido_id: string
          puntaje: number
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string | null
          contenido_tipo?: string
          contenido_id?: string
          puntaje?: number
          created_at?: string
        }
        Relationships: []
      }
      temas_foro: {
        Row: {
          id: string
          user_id: string | null
          titulo: string
          cuerpo: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id?: string | null
          titulo: string
          cuerpo: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string | null
          titulo?: string
          cuerpo?: string
          created_at?: string
        }
        Relationships: []
      }
      mensajes_foro: {
        Row: {
          id: string
          tema_foro_id: string
          user_id: string | null
          contenido: string
          created_at: string
        }
        Insert: {
          id?: string
          tema_foro_id: string
          user_id?: string | null
          contenido: string
          created_at?: string
        }
        Update: {
          id?: string
          tema_foro_id?: string
          user_id?: string | null
          contenido?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mensajes_foro_tema_foro_id_fkey"
            columns: ["tema_foro_id"]
            isOneToOne: false
            referencedRelation: "temas_foro"
            referencedColumns: ["id"]
          }
        ]
      }
      eventos: {
        Row: {
          id: string
          user_id: string | null
          software_id: string | null
          tipo: string
          metadata: Json
          created_at: string
        }
        Insert: {
          id?: string
          user_id?: string | null
          software_id?: string | null
          tipo: string
          metadata?: Json
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string | null
          software_id?: string | null
          tipo?: string
          metadata?: Json
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "eventos_software_id_fkey"
            columns: ["software_id"]
            isOneToOne: false
            referencedRelation: "software"
            referencedColumns: ["id"]
          }
        ]
      }
    }
    Views: {
      v_software_rating: {
        Row: {
          software_id: string | null
          nombre: string | null
          promedio: number | null
          cantidad_votos: number | null
        }
      }
      v_software_populares: {
        Row: {
          software_id: string | null
          nombre: string | null
          vistas: number | null
        }
      }
    }
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
    Functions: Record<string, never>
  }
}

// Convenience type helpers (mirrors supabase-js gen v2 output)
export type Tables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row']

export type TablesInsert<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Insert']

export type Views<T extends keyof Database['public']['Views']> =
  Database['public']['Views'][T]['Row']

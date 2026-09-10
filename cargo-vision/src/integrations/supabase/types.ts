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
      materiais: {
        Row: {
          altura_calcos_cm: number | null
          altura_cm: number
          capa_inferior_cm: number | null
          capa_superior_cm: number | null
          comprimento_cm: number
          cor: string
          criado_em: string
          densidade_kg_m3: number | null
          espessura_chapa_cm: number | null
          espessura_cm: number | null
          id: string
          largura_cm: number
          nome: string
          permite_rotacao: boolean
          peso_insumos_kg: number | null
          peso_kg: number
          qtd_chapas: number | null
          rot_x: boolean
          rot_y: boolean
          rot_z: boolean
          sku: string | null
          tipo_embalagem: string
          user_id: string
        }
        Insert: {
          altura_calcos_cm?: number | null
          altura_cm: number
          capa_inferior_cm?: number | null
          capa_superior_cm?: number | null
          comprimento_cm: number
          cor?: string
          criado_em?: string
          densidade_kg_m3?: number | null
          espessura_chapa_cm?: number | null
          espessura_cm?: number | null
          id?: string
          largura_cm: number
          nome: string
          permite_rotacao?: boolean
          peso_insumos_kg?: number | null
          peso_kg: number
          qtd_chapas?: number | null
          rot_x?: boolean
          rot_y?: boolean
          rot_z?: boolean
          sku?: string | null
          tipo_embalagem?: string
          user_id: string
        }
        Update: {
          altura_calcos_cm?: number | null
          altura_cm?: number
          capa_inferior_cm?: number | null
          capa_superior_cm?: number | null
          comprimento_cm?: number
          cor?: string
          criado_em?: string
          densidade_kg_m3?: number | null
          espessura_chapa_cm?: number | null
          espessura_cm?: number | null
          id?: string
          largura_cm?: number
          nome?: string
          permite_rotacao?: boolean
          peso_insumos_kg?: number | null
          peso_kg?: number
          qtd_chapas?: number | null
          rot_x?: boolean
          rot_y?: boolean
          rot_z?: boolean
          sku?: string | null
          tipo_embalagem?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          criado_em: string
          id: string
          nome: string | null
        }
        Insert: {
          criado_em?: string
          id: string
          nome?: string | null
        }
        Update: {
          criado_em?: string
          id?: string
          nome?: string | null
        }
        Relationships: []
      }
      simulacao_itens: {
        Row: {
          id: string
          material_id: string
          quantidade: number
          simulacao_id: string
        }
        Insert: {
          id?: string
          material_id: string
          quantidade: number
          simulacao_id: string
        }
        Update: {
          id?: string
          material_id?: string
          quantidade?: number
          simulacao_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "simulacao_itens_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materiais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "simulacao_itens_simulacao_id_fkey"
            columns: ["simulacao_id"]
            isOneToOne: false
            referencedRelation: "simulacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      simulacoes: {
        Row: {
          altura_cm: number
          atualizada_em: string
          capacidade_peso_kg: number
          comprimento_cm: number
          container_tipo: string
          criada_em: string
          id: string
          largura_cm: number
          nome: string
          user_id: string
          veiculo_nome: string
        }
        Insert: {
          altura_cm?: number
          atualizada_em?: string
          capacidade_peso_kg?: number
          comprimento_cm?: number
          container_tipo?: string
          criada_em?: string
          id?: string
          largura_cm?: number
          nome: string
          user_id: string
          veiculo_nome?: string
        }
        Update: {
          altura_cm?: number
          atualizada_em?: string
          capacidade_peso_kg?: number
          comprimento_cm?: number
          container_tipo?: string
          criada_em?: string
          id?: string
          largura_cm?: number
          nome?: string
          user_id?: string
          veiculo_nome?: string
        }
        Relationships: []
      }
      veiculos: {
        Row: {
          altura_cm: number
          capacidade_peso_kg: number
          comprimento_cm: number
          criado_em: string
          id: string
          largura_cm: number
          nome: string
          user_id: string
        }
        Insert: {
          altura_cm: number
          capacidade_peso_kg?: number
          comprimento_cm: number
          criado_em?: string
          id?: string
          largura_cm: number
          nome: string
          user_id: string
        }
        Update: {
          altura_cm?: number
          capacidade_peso_kg?: number
          comprimento_cm?: number
          criado_em?: string
          id?: string
          largura_cm?: number
          nome?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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

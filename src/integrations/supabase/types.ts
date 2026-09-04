export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      access_profiles: {
        Row: { created_at: string; role: "owner" | "demo"; user_id: string };
        Insert: { created_at?: string; role?: "owner" | "demo"; user_id: string };
        Update: { created_at?: string; role?: "owner" | "demo"; user_id?: string };
        Relationships: [];
      };
      configuracoes_ia: {
        Row: {
          ia_global_ativa: boolean;
          id: string;
          singleton: boolean;
          system_message: string;
          updated_at: string;
        };
        Insert: {
          ia_global_ativa?: boolean;
          id?: string;
          singleton?: boolean;
          system_message?: string;
          updated_at?: string;
        };
        Update: {
          ia_global_ativa?: boolean;
          id?: string;
          singleton?: boolean;
          system_message?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      dados_cliente: {
        Row: {
          bsuid: string;
          created_at: string;
          ia_ativa: boolean;
          id: string;
          nome: string | null;
          responded: string | null;
          telefone: string | null;
        };
        Insert: {
          bsuid: string;
          created_at?: string;
          ia_ativa?: boolean;
          id?: string;
          nome?: string | null;
          responded?: string | null;
          telefone?: string | null;
        };
        Update: {
          bsuid?: string;
          created_at?: string;
          ia_ativa?: boolean;
          id?: string;
          nome?: string | null;
          responded?: string | null;
          telefone?: string | null;
        };
        Relationships: [];
      };
      campanhas: {
        Row: {
          created_at: string;
          created_by: string | null;
          descricao: string | null;
          id: number;
          meta_templates_status: Json;
          nome: string;
          status: Database["public"]["Enums"]["campanha_status"];
          templates_meta: Json | null;
          tipo: number;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          descricao?: string | null;
          id?: number;
          meta_templates_status?: Json;
          nome: string;
          status?: Database["public"]["Enums"]["campanha_status"];
          templates_meta?: Json | null;
          tipo?: number;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          descricao?: string | null;
          id?: number;
          meta_templates_status?: Json;
          nome?: string;
          status?: Database["public"]["Enums"]["campanha_status"];
          templates_meta?: Json | null;
          tipo?: number;
        };
        Relationships: [];
      };
      templates_meta: {
        Row: {
          category: string;
          created_at: string;
          created_by: string;
          id: number;
          language: string;
          meta_id: string | null;
          name: string;
          payload: Json;
          status: string;
          updated_at: string;
        };
        Insert: {
          category: string;
          created_at?: string;
          created_by: string;
          id?: number;
          language: string;
          meta_id?: string | null;
          name: string;
          payload: Json;
          status?: string;
          updated_at?: string;
        };
        Update: {
          category?: string;
          created_at?: string;
          created_by?: string;
          id?: number;
          language?: string;
          meta_id?: string | null;
          name?: string;
          payload?: Json;
          status?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      campanha_templates: {
        Row: { campanha_id: number; created_at: string; template_id: number };
        Insert: { campanha_id: number; created_at?: string; template_id: number };
        Update: { campanha_id?: number; created_at?: string; template_id?: number };
        Relationships: [
          {
            foreignKeyName: "campanha_templates_campanha_id_fkey";
            columns: ["campanha_id"];
            isOneToOne: false;
            referencedRelation: "campanhas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "campanha_templates_template_id_fkey";
            columns: ["template_id"];
            isOneToOne: false;
            referencedRelation: "templates_meta";
            referencedColumns: ["id"];
          },
        ];
      };
      envio_em_massa: {
        Row: {
          bsuid: string | null;
          campanha_id: number | null;
          clicked_at: string | null;
          etapa: number | null;
          etapa_manual_at: string | null;
          id: number;
          nome: string | null;
          telefone: string | null;
        };
        Insert: {
          bsuid?: string | null;
          campanha_id?: number | null;
          clicked_at?: string | null;
          etapa?: number | null;
          etapa_manual_at?: string | null;
          id?: number;
          nome?: string | null;
          telefone?: string | null;
        };
        Update: {
          bsuid?: string | null;
          campanha_id?: number | null;
          clicked_at?: string | null;
          etapa?: number | null;
          etapa_manual_at?: string | null;
          id?: number;
          nome?: string | null;
          telefone?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "envio_em_massa_campanha_id_fkey";
            columns: ["campanha_id"];
            isOneToOne: false;
            referencedRelation: "campanhas";
            referencedColumns: ["id"];
          },
        ];
      };
      webhook_messages: {
        Row: {
          bsuid: string | null;
          campanha_id: number | null;
          created_at: string;
          envio_em_massa_id: number | null;
          id: string;
          message_id: string;
          message_status: string | null;
          message_text: string | null;
          telefone: string | null;
          who_sent: string | null;
        };
        Insert: {
          bsuid?: string | null;
          campanha_id?: number | null;
          created_at?: string;
          envio_em_massa_id?: number | null;
          id?: string;
          message_id: string;
          message_status?: string | null;
          message_text?: string | null;
          telefone?: string | null;
          who_sent?: string | null;
        };
        Update: {
          bsuid?: string | null;
          campanha_id?: number | null;
          created_at?: string;
          envio_em_massa_id?: number | null;
          id?: string;
          message_id?: string;
          message_status?: string | null;
          message_text?: string | null;
          telefone?: string | null;
          who_sent?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "webhook_messages_campanha_id_fkey";
            columns: ["campanha_id"];
            isOneToOne: false;
            referencedRelation: "campanhas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "webhook_messages_envio_em_massa_id_fkey";
            columns: ["envio_em_massa_id"];
            isOneToOne: false;
            referencedRelation: "envio_em_massa";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      campanha_status:
        | "rascunho"
        | "aguardando_aprovacao"
        | "pronta"
        | "em_andamento"
        | "pausada"
        | "concluida"
        | "cancelada"
        | "erro";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      campanha_status: [
        "rascunho",
        "aguardando_aprovacao",
        "pronta",
        "em_andamento",
        "pausada",
        "concluida",
        "cancelada",
        "erro",
      ],
    },
  },
} as const;

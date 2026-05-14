export type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

export interface Database {
  public: {
    Tables: {
      tenants: {
        Row: {
          id: string;
          org_name: string;
          logo_url: string | null;
          brand_color: string;
          created_at: string;
          onboarding_completed_at: string | null;
        };
        Insert: Omit<Database['public']['Tables']['tenants']['Row'], 'created_at'>;
        Update: Partial<Database['public']['Tables']['tenants']['Insert']>;
      };
      tenant_config: {
        Row: {
          tenant_id: string;
          jira_base_url: string;
          jira_user_email: string;
          jira_api_token_secret: string;
          anthropic_key_secret: string;
          project_keys: string[];
          active_epics_max: number;
          completed_lookback_days: number;
          comment_lookback_days: number;
          page_title: string;
          schedule_days: number[];
          schedule_time_utc: string;
          next_run_at: string;
          last_run_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<
          Database['public']['Tables']['tenant_config']['Row'],
          'created_at' | 'updated_at'
        >;
        Update: Partial<Database['public']['Tables']['tenant_config']['Insert']>;
      };
      dashboard_data: {
        Row: {
          tenant_id: string;
          payload: Json;
          generated_at: string;
          run_status: 'pending' | 'running' | 'success' | 'failed';
          error_msg: string | null;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['dashboard_data']['Row'], 'updated_at'>;
        Update: Partial<Database['public']['Tables']['dashboard_data']['Insert']>;
      };
    };
  };
}

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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      agencies: {
        Row: {
          address: string | null
          auth_user_id: string | null
          city: string
          code: string
          company_name: string | null
          contract_status: string
          created_at: string
          credit_limit: number
          current_balance: number
          discount_percent: number
          id: string
          is_public_representative: boolean
          latitude: number | null
          longitude: number | null
          name: string
          next_check_date: string | null
          phone: string
          province: string
          raw_payload: Json
          sub_users: Json
          territories: Json
          updated_at: string
        }
        Insert: {
          address?: string | null
          auth_user_id?: string | null
          city: string
          code: string
          company_name?: string | null
          contract_status?: string
          created_at?: string
          credit_limit?: number
          current_balance?: number
          discount_percent?: number
          id: string
          is_public_representative?: boolean
          latitude?: number | null
          longitude?: number | null
          name: string
          next_check_date?: string | null
          phone: string
          province: string
          raw_payload?: Json
          sub_users?: Json
          territories?: Json
          updated_at?: string
        }
        Update: {
          address?: string | null
          auth_user_id?: string | null
          city?: string
          code?: string
          company_name?: string | null
          contract_status?: string
          created_at?: string
          credit_limit?: number
          current_balance?: number
          discount_percent?: number
          id?: string
          is_public_representative?: boolean
          latitude?: number | null
          longitude?: number | null
          name?: string
          next_check_date?: string | null
          phone?: string
          province?: string
          raw_payload?: Json
          sub_users?: Json
          territories?: Json
          updated_at?: string
        }
        Relationships: []
      }
      agency_applications: {
        Row: {
          active_brands: string | null
          address: string | null
          admin_note: string | null
          applicant_user_id: string | null
          city: string
          company_name: string | null
          created_at: string
          documents: Json
          email: string | null
          experience_years: number | null
          full_name: string
          id: string
          ownership_type: string | null
          phone: string
          province: string
          requested_categories: Json
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          store_area_sqm: number | null
          updated_at: string
        }
        Insert: {
          active_brands?: string | null
          address?: string | null
          admin_note?: string | null
          applicant_user_id?: string | null
          city: string
          company_name?: string | null
          created_at?: string
          documents?: Json
          email?: string | null
          experience_years?: number | null
          full_name: string
          id: string
          ownership_type?: string | null
          phone: string
          province: string
          requested_categories?: Json
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          store_area_sqm?: number | null
          updated_at?: string
        }
        Update: {
          active_brands?: string | null
          address?: string | null
          admin_note?: string | null
          applicant_user_id?: string | null
          city?: string
          company_name?: string | null
          created_at?: string
          documents?: Json
          email?: string | null
          experience_years?: number | null
          full_name?: string
          id?: string
          ownership_type?: string | null
          phone?: string
          province?: string
          requested_categories?: Json
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          store_area_sqm?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      agency_deposit_receipts: {
        Row: {
          admin_note: string | null
          agency_id: string | null
          amount: number
          bank_name: string | null
          created_at: string
          dealer_name: string
          deposit_date: string | null
          id: string
          receipt_image_url: string | null
          status: string
          tracking_code: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          admin_note?: string | null
          agency_id?: string | null
          amount: number
          bank_name?: string | null
          created_at?: string
          dealer_name: string
          deposit_date?: string | null
          id: string
          receipt_image_url?: string | null
          status?: string
          tracking_code: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          admin_note?: string | null
          agency_id?: string | null
          amount?: number
          bank_name?: string | null
          created_at?: string
          dealer_name?: string
          deposit_date?: string | null
          id?: string
          receipt_image_url?: string | null
          status?: string
          tracking_code?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agency_deposit_receipts_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
        ]
      }
      agency_messages: {
        Row: {
          agency_id: string | null
          attachments: Json
          body: string
          created_at: string
          id: string
          is_read: boolean
          sender: string
          subject: string | null
        }
        Insert: {
          agency_id?: string | null
          attachments?: Json
          body: string
          created_at?: string
          id: string
          is_read?: boolean
          sender: string
          subject?: string | null
        }
        Update: {
          agency_id?: string | null
          attachments?: Json
          body?: string
          created_at?: string
          id?: string
          is_read?: boolean
          sender?: string
          subject?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agency_messages_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
        ]
      }
      agency_supply_requests: {
        Row: {
          agency_id: string | null
          agency_name: string
          created_at: string
          id: string
          notes: string | null
          product_code: string
          product_name: string
          quantity: number
          status: string
          updated_at: string
          urgency: string
        }
        Insert: {
          agency_id?: string | null
          agency_name: string
          created_at?: string
          id: string
          notes?: string | null
          product_code: string
          product_name: string
          quantity: number
          status?: string
          updated_at?: string
          urgency?: string
        }
        Update: {
          agency_id?: string | null
          agency_name?: string
          created_at?: string
          id?: string
          notes?: string | null
          product_code?: string
          product_name?: string
          quantity?: number
          status?: string
          updated_at?: string
          urgency?: string
        }
        Relationships: [
          {
            foreignKeyName: "agency_supply_requests_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          created_at: string
          details: string | null
          entity: string | null
          extra_payload: Json
          id: string
          target: string | null
          timestamp_label: string | null
          user_id: string | null
          user_name: string | null
          user_role: string | null
        }
        Insert: {
          action: string
          created_at?: string
          details?: string | null
          entity?: string | null
          extra_payload?: Json
          id: string
          target?: string | null
          timestamp_label?: string | null
          user_id?: string | null
          user_name?: string | null
          user_role?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          details?: string | null
          entity?: string | null
          extra_payload?: Json
          id?: string
          target?: string | null
          timestamp_label?: string | null
          user_id?: string | null
          user_name?: string | null
          user_role?: string | null
        }
        Relationships: []
      }
      blog_posts: {
        Row: {
          author: string | null
          category: string
          content: string
          created_at: string
          excerpt: string | null
          id: string
          image_url: string | null
          published: boolean
          published_at: string | null
          slug: string
          tags: Json
          title: string
          updated_at: string
          views: number
        }
        Insert: {
          author?: string | null
          category: string
          content: string
          created_at?: string
          excerpt?: string | null
          id: string
          image_url?: string | null
          published?: boolean
          published_at?: string | null
          slug: string
          tags?: Json
          title: string
          updated_at?: string
          views?: number
        }
        Update: {
          author?: string | null
          category?: string
          content?: string
          created_at?: string
          excerpt?: string | null
          id?: string
          image_url?: string | null
          published?: boolean
          published_at?: string | null
          slug?: string
          tags?: Json
          title?: string
          updated_at?: string
          views?: number
        }
        Relationships: []
      }
      catalog_brands: {
        Row: {
          country: string | null
          created_at: string
          description: string | null
          id: string
          is_featured: boolean
          logo_url: string | null
          name: string
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          country?: string | null
          created_at?: string
          description?: string | null
          id: string
          is_featured?: boolean
          logo_url?: string | null
          name: string
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          country?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_featured?: boolean
          logo_url?: string | null
          name?: string
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      catalog_categories: {
        Row: {
          created_at: string
          description: string | null
          icon: string | null
          id: string
          image_url: string | null
          is_active: boolean
          metadata: Json
          name: string
          parent_id: string | null
          slug: string
          sort_order: number
          submenu: string | null
          technical_type: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          icon?: string | null
          id: string
          image_url?: string | null
          is_active?: boolean
          metadata?: Json
          name: string
          parent_id?: string | null
          slug: string
          sort_order?: number
          submenu?: string | null
          technical_type?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          metadata?: Json
          name?: string
          parent_id?: string | null
          slug?: string
          sort_order?: number
          submenu?: string | null
          technical_type?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "catalog_categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "catalog_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      catalog_families: {
        Row: {
          brand: string
          canonical_family_code: string | null
          category_name: string
          category_slug: string
          code: string
          correction_pages: string | null
          created_at: string
          description: string | null
          filters_hint: string | null
          has_catalogue_image: boolean
          image_scope: Database["public"]["Enums"]["image_scope_type"] | null
          images: Json
          is_active: boolean
          is_deleted: boolean
          item_count: number
          materials: string | null
          name: string
          override_version: number
          profiles: string | null
          sizes_summary: string | null
          source_row: number | null
          source_status: string | null
          subcategory: string | null
          submenu: string | null
          tags: Json
          technical_specs: Json
          unit: string
          updated_at: string
        }
        Insert: {
          brand?: string
          canonical_family_code?: string | null
          category_name: string
          category_slug: string
          code: string
          correction_pages?: string | null
          created_at?: string
          description?: string | null
          filters_hint?: string | null
          has_catalogue_image?: boolean
          image_scope?: Database["public"]["Enums"]["image_scope_type"] | null
          images?: Json
          is_active?: boolean
          is_deleted?: boolean
          item_count?: number
          materials?: string | null
          name: string
          override_version?: number
          profiles?: string | null
          sizes_summary?: string | null
          source_row?: number | null
          source_status?: string | null
          subcategory?: string | null
          submenu?: string | null
          tags?: Json
          technical_specs?: Json
          unit?: string
          updated_at?: string
        }
        Update: {
          brand?: string
          canonical_family_code?: string | null
          category_name?: string
          category_slug?: string
          code?: string
          correction_pages?: string | null
          created_at?: string
          description?: string | null
          filters_hint?: string | null
          has_catalogue_image?: boolean
          image_scope?: Database["public"]["Enums"]["image_scope_type"] | null
          images?: Json
          is_active?: boolean
          is_deleted?: boolean
          item_count?: number
          materials?: string | null
          name?: string
          override_version?: number
          profiles?: string | null
          sizes_summary?: string | null
          source_row?: number | null
          source_status?: string | null
          subcategory?: string | null
          submenu?: string | null
          tags?: Json
          technical_specs?: Json
          unit?: string
          updated_at?: string
        }
        Relationships: []
      }
      catalog_gallery_images: {
        Row: {
          created_at: string
          family_code: string
          file_name: string | null
          id: string
          identity_verified: boolean
          scope: Database["public"]["Enums"]["image_scope_type"]
          sort_order: number
          title: string | null
          updated_at: string
          url: string
          variant_code: string | null
        }
        Insert: {
          created_at?: string
          family_code: string
          file_name?: string | null
          id: string
          identity_verified?: boolean
          scope?: Database["public"]["Enums"]["image_scope_type"]
          sort_order?: number
          title?: string | null
          updated_at?: string
          url: string
          variant_code?: string | null
        }
        Update: {
          created_at?: string
          family_code?: string
          file_name?: string | null
          id?: string
          identity_verified?: boolean
          scope?: Database["public"]["Enums"]["image_scope_type"]
          sort_order?: number
          title?: string | null
          updated_at?: string
          url?: string
          variant_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "catalog_gallery_images_family_code_fkey"
            columns: ["family_code"]
            isOneToOne: false
            referencedRelation: "catalog_families"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "catalog_gallery_images_variant_code_fkey"
            columns: ["variant_code"]
            isOneToOne: false
            referencedRelation: "catalog_variants"
            referencedColumns: ["code"]
          },
        ]
      }
      catalog_image_audits: {
        Row: {
          exact_sku: string | null
          family_code: string | null
          family_name: string | null
          file_name: string
          identity_status: string | null
          image_url: string
          normalized_file_key: string | null
          observed_description: string | null
          reason: string | null
          required_checks: Json
          review_date: string | null
          review_status: string
          sha256: string | null
          sku_verified: boolean
          source_row: number | null
          standard_status: string | null
          visible_features: Json
          visual_type: string | null
        }
        Insert: {
          exact_sku?: string | null
          family_code?: string | null
          family_name?: string | null
          file_name: string
          identity_status?: string | null
          image_url: string
          normalized_file_key?: string | null
          observed_description?: string | null
          reason?: string | null
          required_checks?: Json
          review_date?: string | null
          review_status: string
          sha256?: string | null
          sku_verified?: boolean
          source_row?: number | null
          standard_status?: string | null
          visible_features?: Json
          visual_type?: string | null
        }
        Update: {
          exact_sku?: string | null
          family_code?: string | null
          family_name?: string | null
          file_name?: string
          identity_status?: string | null
          image_url?: string
          normalized_file_key?: string | null
          observed_description?: string | null
          reason?: string | null
          required_checks?: Json
          review_date?: string | null
          review_status?: string
          sha256?: string | null
          sku_verified?: boolean
          source_row?: number | null
          standard_status?: string | null
          visible_features?: Json
          visual_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "catalog_image_audits_family_code_fkey"
            columns: ["family_code"]
            isOneToOne: false
            referencedRelation: "catalog_families"
            referencedColumns: ["code"]
          },
        ]
      }
      catalog_image_features: {
        Row: {
          clean_ah: string | null
          clean_aspect: number | null
          clean_col: Json | null
          clean_dh: string | null
          clean_eh: string | null
          clean_grid: Json | null
          clean_hog: Json | null
          clean_hu: Json | null
          clean_ph: string | null
          clean_radial: Json | null
          embedding: string | null
          embedding_model: string
          family_code: string | null
          file_name: string
          image_url: string
          padded_file_key: string | null
          raw_ah: string | null
          raw_aspect: number | null
          raw_col: Json | null
          raw_dh: string | null
          raw_eh: string | null
          raw_grid: Json | null
          raw_hog: Json | null
          raw_hu: Json | null
          raw_ph: string | null
          raw_radial: Json | null
          updated_at: string
          variant_code: string | null
        }
        Insert: {
          clean_ah?: string | null
          clean_aspect?: number | null
          clean_col?: Json | null
          clean_dh?: string | null
          clean_eh?: string | null
          clean_grid?: Json | null
          clean_hog?: Json | null
          clean_hu?: Json | null
          clean_ph?: string | null
          clean_radial?: Json | null
          embedding?: string | null
          embedding_model?: string
          family_code?: string | null
          file_name: string
          image_url: string
          padded_file_key?: string | null
          raw_ah?: string | null
          raw_aspect?: number | null
          raw_col?: Json | null
          raw_dh?: string | null
          raw_eh?: string | null
          raw_grid?: Json | null
          raw_hog?: Json | null
          raw_hu?: Json | null
          raw_ph?: string | null
          raw_radial?: Json | null
          updated_at?: string
          variant_code?: string | null
        }
        Update: {
          clean_ah?: string | null
          clean_aspect?: number | null
          clean_col?: Json | null
          clean_dh?: string | null
          clean_eh?: string | null
          clean_grid?: Json | null
          clean_hog?: Json | null
          clean_hu?: Json | null
          clean_ph?: string | null
          clean_radial?: Json | null
          embedding?: string | null
          embedding_model?: string
          family_code?: string | null
          file_name?: string
          image_url?: string
          padded_file_key?: string | null
          raw_ah?: string | null
          raw_aspect?: number | null
          raw_col?: Json | null
          raw_dh?: string | null
          raw_eh?: string | null
          raw_grid?: Json | null
          raw_hog?: Json | null
          raw_hu?: Json | null
          raw_ph?: string | null
          raw_radial?: Json | null
          updated_at?: string
          variant_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "catalog_image_features_family_code_fkey"
            columns: ["family_code"]
            isOneToOne: false
            referencedRelation: "catalog_families"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "catalog_image_features_variant_code_fkey"
            columns: ["variant_code"]
            isOneToOne: false
            referencedRelation: "catalog_variants"
            referencedColumns: ["code"]
          },
        ]
      }
      catalog_import_manifests: {
        Row: {
          categories_summary: Json
          families_count: number
          id: string
          imported_at: string
          sheet_name: string
          skus_count: number
          source_file: string
          source_sha256: string
          submenus_summary: Json
          technical_types_summary: Json
        }
        Insert: {
          categories_summary?: Json
          families_count: number
          id?: string
          imported_at?: string
          sheet_name: string
          skus_count: number
          source_file: string
          source_sha256: string
          submenus_summary?: Json
          technical_types_summary?: Json
        }
        Update: {
          categories_summary?: Json
          families_count?: number
          id?: string
          imported_at?: string
          sheet_name?: string
          skus_count?: number
          source_file?: string
          source_sha256?: string
          submenus_summary?: Json
          technical_types_summary?: Json
        }
        Relationships: []
      }
      catalog_summary_entries: {
        Row: {
          category_name: string
          category_slug: string
          code: string
          created_at: string
          forza_code: string
          image_url: string | null
          linked_family_code: string | null
          linked_variant_code: string | null
          name: string
          page: number | null
          specs: Json
          subcategory: string | null
        }
        Insert: {
          category_name: string
          category_slug: string
          code: string
          created_at?: string
          forza_code: string
          image_url?: string | null
          linked_family_code?: string | null
          linked_variant_code?: string | null
          name: string
          page?: number | null
          specs?: Json
          subcategory?: string | null
        }
        Update: {
          category_name?: string
          category_slug?: string
          code?: string
          created_at?: string
          forza_code?: string
          image_url?: string | null
          linked_family_code?: string | null
          linked_variant_code?: string | null
          name?: string
          page?: number | null
          specs?: Json
          subcategory?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "catalog_summary_entries_linked_family_code_fkey"
            columns: ["linked_family_code"]
            isOneToOne: false
            referencedRelation: "catalog_families"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "catalog_summary_entries_linked_variant_code_fkey"
            columns: ["linked_variant_code"]
            isOneToOne: false
            referencedRelation: "catalog_variants"
            referencedColumns: ["code"]
          },
        ]
      }
      catalog_variants: {
        Row: {
          active: boolean
          brand: string | null
          code: string
          created_at: string
          family_code: string
          images: Json
          in_research_cohort: boolean
          model: string | null
          name: string
          size: string | null
          sort_order: number
          technical_review: Json
          technical_specs: Json
          unit: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          brand?: string | null
          code: string
          created_at?: string
          family_code: string
          images?: Json
          in_research_cohort?: boolean
          model?: string | null
          name: string
          size?: string | null
          sort_order?: number
          technical_review?: Json
          technical_specs?: Json
          unit?: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          brand?: string | null
          code?: string
          created_at?: string
          family_code?: string
          images?: Json
          in_research_cohort?: boolean
          model?: string | null
          name?: string
          size?: string | null
          sort_order?: number
          technical_review?: Json
          technical_specs?: Json
          unit?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "catalog_variants_family_code_fkey"
            columns: ["family_code"]
            isOneToOne: false
            referencedRelation: "catalog_families"
            referencedColumns: ["code"]
          },
        ]
      }
      checkout_requests: {
        Row: {
          created_at: string
          order_id: string
          request_key: string
          request_sha256: string
          user_id: string
        }
        Insert: {
          created_at?: string
          order_id: string
          request_key: string
          request_sha256: string
          user_id: string
        }
        Update: {
          created_at?: string
          order_id?: string
          request_key?: string
          request_sha256?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "checkout_requests_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checkout_requests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      client_logos: {
        Row: {
          active: boolean
          city: string | null
          created_at: string
          id: string
          industry: string | null
          logo_url: string
          name: string
          sort_order: number
        }
        Insert: {
          active?: boolean
          city?: string | null
          created_at?: string
          id: string
          industry?: string | null
          logo_url: string
          name: string
          sort_order?: number
        }
        Update: {
          active?: boolean
          city?: string | null
          created_at?: string
          id?: string
          industry?: string | null
          logo_url?: string
          name?: string
          sort_order?: number
        }
        Relationships: []
      }
      club_configs: {
        Row: {
          bronze_threshold: number
          extra_rules: Json
          gold_threshold: number
          id: string
          points_per_100k_tomans: number
          silver_threshold: number
          toman_per_point_redeem: number
          updated_at: string
          welcome_gift_points: number
        }
        Insert: {
          bronze_threshold?: number
          extra_rules?: Json
          gold_threshold?: number
          id?: string
          points_per_100k_tomans?: number
          silver_threshold?: number
          toman_per_point_redeem?: number
          updated_at?: string
          welcome_gift_points?: number
        }
        Update: {
          bronze_threshold?: number
          extra_rules?: Json
          gold_threshold?: number
          id?: string
          points_per_100k_tomans?: number
          silver_threshold?: number
          toman_per_point_redeem?: number
          updated_at?: string
          welcome_gift_points?: number
        }
        Relationships: []
      }
      club_milestones: {
        Row: {
          active: boolean
          icon: string | null
          id: string
          min_purchase_volume: number | null
          portal: string | null
          raw_payload: Json
          reward_title: string
          reward_type: string
          reward_value: string | null
          sort_order: number
          target_points: number
          title: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          icon?: string | null
          id: string
          min_purchase_volume?: number | null
          portal?: string | null
          raw_payload?: Json
          reward_title: string
          reward_type?: string
          reward_value?: string | null
          sort_order?: number
          target_points: number
          title: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          icon?: string | null
          id?: string
          min_purchase_volume?: number | null
          portal?: string | null
          raw_payload?: Json
          reward_title?: string
          reward_type?: string
          reward_value?: string | null
          sort_order?: number
          target_points?: number
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      club_rewards: {
        Row: {
          active: boolean
          created_at: string
          description: string | null
          discount_percent: number | null
          id: string
          image_url: string | null
          max_amount: number | null
          min_grade: string | null
          points_cost: number
          raw_payload: Json
          reward_type: string
          title: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          description?: string | null
          discount_percent?: number | null
          id: string
          image_url?: string | null
          max_amount?: number | null
          min_grade?: string | null
          points_cost: number
          raw_payload?: Json
          reward_type?: string
          title: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          description?: string | null
          discount_percent?: number | null
          id?: string
          image_url?: string | null
          max_amount?: number | null
          min_grade?: string | null
          points_cost?: number
          raw_payload?: Json
          reward_type?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      credit_reservations: {
        Row: {
          amount: number
          created_at: string
          expires_at: string
          id: string
          order_id: string
          state: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          expires_at: string
          id?: string
          order_id: string
          state?: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          expires_at?: string
          id?: string
          order_id?: string
          state?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "credit_reservations_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_reservations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "customer_finance_accounts"
            referencedColumns: ["user_id"]
          },
        ]
      }
      crm_customers: {
        Row: {
          address: string | null
          approval_status: string
          approved_b2b: boolean
          assigned_price_list_id: string | null
          auth_user_id: string | null
          city: string | null
          company: string | null
          created_at: string
          credit_info: Json
          credit_limit: number
          economic_code: string | null
          email: string | null
          grade_code: string | null
          id: string
          is_legacy: boolean
          name: string
          national_id: string | null
          notes: string | null
          phone: string
          points: number
          portal_overrides: Json
          postal_code: string | null
          price_overrides: Json
          province: string | null
          raw_payload: Json
          total_orders: number
          total_spent: number
          updated_at: string
          used_credit: number
          wallet_balance: number
        }
        Insert: {
          address?: string | null
          approval_status?: string
          approved_b2b?: boolean
          assigned_price_list_id?: string | null
          auth_user_id?: string | null
          city?: string | null
          company?: string | null
          created_at?: string
          credit_info?: Json
          credit_limit?: number
          economic_code?: string | null
          email?: string | null
          grade_code?: string | null
          id: string
          is_legacy?: boolean
          name: string
          national_id?: string | null
          notes?: string | null
          phone: string
          points?: number
          portal_overrides?: Json
          postal_code?: string | null
          price_overrides?: Json
          province?: string | null
          raw_payload?: Json
          total_orders?: number
          total_spent?: number
          updated_at?: string
          used_credit?: number
          wallet_balance?: number
        }
        Update: {
          address?: string | null
          approval_status?: string
          approved_b2b?: boolean
          assigned_price_list_id?: string | null
          auth_user_id?: string | null
          city?: string | null
          company?: string | null
          created_at?: string
          credit_info?: Json
          credit_limit?: number
          economic_code?: string | null
          email?: string | null
          grade_code?: string | null
          id?: string
          is_legacy?: boolean
          name?: string
          national_id?: string | null
          notes?: string | null
          phone?: string
          points?: number
          portal_overrides?: Json
          postal_code?: string | null
          price_overrides?: Json
          province?: string | null
          raw_payload?: Json
          total_orders?: number
          total_spent?: number
          updated_at?: string
          used_credit?: number
          wallet_balance?: number
        }
        Relationships: [
          {
            foreignKeyName: "crm_customers_grade_code_fkey"
            columns: ["grade_code"]
            isOneToOne: false
            referencedRelation: "customer_grade_configs"
            referencedColumns: ["grade_code"]
          },
        ]
      }
      customer_finance_accounts: {
        Row: {
          created_at: string
          currency: string
          opening_debt: number
          opening_points: number
          opening_wallet: number
          source_reference: string
          user_id: string
        }
        Insert: {
          created_at?: string
          currency: string
          opening_debt?: number
          opening_points?: number
          opening_wallet?: number
          source_reference: string
          user_id: string
        }
        Update: {
          created_at?: string
          currency?: string
          opening_debt?: number
          opening_points?: number
          opening_wallet?: number
          source_reference?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_finance_accounts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_grade_configs: {
        Row: {
          benefits: Json
          can_buy_on_credit: boolean
          can_view_prices: boolean
          can_view_stock: boolean
          credit_limit: number
          discount_percent: number
          grade_code: string
          metadata: Json
          min_points: number
          min_purchase_volume: number
          settlement_days: number
          title: string
          updated_at: string
        }
        Insert: {
          benefits?: Json
          can_buy_on_credit?: boolean
          can_view_prices?: boolean
          can_view_stock?: boolean
          credit_limit?: number
          discount_percent?: number
          grade_code: string
          metadata?: Json
          min_points?: number
          min_purchase_volume?: number
          settlement_days?: number
          title: string
          updated_at?: string
        }
        Update: {
          benefits?: Json
          can_buy_on_credit?: boolean
          can_view_prices?: boolean
          can_view_stock?: boolean
          credit_limit?: number
          discount_percent?: number
          grade_code?: string
          metadata?: Json
          min_points?: number
          min_purchase_volume?: number
          settlement_days?: number
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      customer_reward_assignments: {
        Row: {
          assigned_by: string | null
          code: string | null
          created_at: string
          customer_id: string | null
          expires_at: string | null
          id: string
          raw_payload: Json
          reward_id: string | null
          reward_title: string
          status: string
          used_at: string | null
          user_id: string | null
        }
        Insert: {
          assigned_by?: string | null
          code?: string | null
          created_at?: string
          customer_id?: string | null
          expires_at?: string | null
          id: string
          raw_payload?: Json
          reward_id?: string | null
          reward_title: string
          status?: string
          used_at?: string | null
          user_id?: string | null
        }
        Update: {
          assigned_by?: string | null
          code?: string | null
          created_at?: string
          customer_id?: string | null
          expires_at?: string | null
          id?: string
          raw_payload?: Json
          reward_id?: string | null
          reward_title?: string
          status?: string
          used_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_reward_assignments_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "crm_customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_reward_assignments_reward_id_fkey"
            columns: ["reward_id"]
            isOneToOne: false
            referencedRelation: "club_rewards"
            referencedColumns: ["id"]
          },
        ]
      }
      discount_codes: {
        Row: {
          active: boolean
          code: string
          created_at: string
          discount_percent: number
          id: string
          max_discount_amount: number | null
          min_order_amount: number
          target_tier: string | null
          title: string | null
          updated_at: string
          usage_limit: number | null
          used_count: number
          valid_until: string | null
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          discount_percent?: number
          id: string
          max_discount_amount?: number | null
          min_order_amount?: number
          target_tier?: string | null
          title?: string | null
          updated_at?: string
          usage_limit?: number | null
          used_count?: number
          valid_until?: string | null
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          discount_percent?: number
          id?: string
          max_discount_amount?: number | null
          min_order_amount?: number
          target_tier?: string | null
          title?: string | null
          updated_at?: string
          usage_limit?: number | null
          used_count?: number
          valid_until?: string | null
        }
        Relationships: []
      }
      document_assets: {
        Row: {
          bucket_id: string
          byte_size: number
          created_at: string
          id: string
          mime_type: string
          object_path: string
          purpose: string
          sha256: string | null
          user_id: string | null
        }
        Insert: {
          bucket_id: string
          byte_size: number
          created_at?: string
          id?: string
          mime_type: string
          object_path: string
          purpose: string
          sha256?: string | null
          user_id?: string | null
        }
        Update: {
          bucket_id?: string
          byte_size?: number
          created_at?: string
          id?: string
          mime_type?: string
          object_path?: string
          purpose?: string
          sha256?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "document_assets_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_entries: {
        Row: {
          created_at: string
          debt_delta: number
          description: string
          id: string
          kind: string
          order_id: string | null
          points_delta: number
          reference: string
          user_id: string
          wallet_delta: number
        }
        Insert: {
          created_at?: string
          debt_delta?: number
          description?: string
          id?: string
          kind: string
          order_id?: string | null
          points_delta?: number
          reference: string
          user_id: string
          wallet_delta?: number
        }
        Update: {
          created_at?: string
          debt_delta?: number
          description?: string
          id?: string
          kind?: string
          order_id?: string | null
          points_delta?: number
          reference?: string
          user_id?: string
          wallet_delta?: number
        }
        Relationships: [
          {
            foreignKeyName: "financial_entries_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_entries_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "customer_finance_accounts"
            referencedColumns: ["user_id"]
          },
        ]
      }
      industrial_chat_sessions: {
        Row: {
          created_at: string
          customer_name: string | null
          customer_phone: string | null
          department: string | null
          id: string
          last_updated: string
          messages: Json
          status: string
          unread_count: number
          user_id: string | null
        }
        Insert: {
          created_at?: string
          customer_name?: string | null
          customer_phone?: string | null
          department?: string | null
          id: string
          last_updated?: string
          messages?: Json
          status?: string
          unread_count?: number
          user_id?: string | null
        }
        Update: {
          created_at?: string
          customer_name?: string | null
          customer_phone?: string | null
          department?: string | null
          id?: string
          last_updated?: string
          messages?: Json
          status?: string
          unread_count?: number
          user_id?: string | null
        }
        Relationships: []
      }
      inventory_events: {
        Row: {
          created_at: string
          id: string
          quantity_delta: number
          reason: string
          reference: string
          variant_code: string
        }
        Insert: {
          created_at?: string
          id?: string
          quantity_delta: number
          reason: string
          reference: string
          variant_code: string
        }
        Update: {
          created_at?: string
          id?: string
          quantity_delta?: number
          reason?: string
          reference?: string
          variant_code?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_events_variant_code_fkey"
            columns: ["variant_code"]
            isOneToOne: false
            referencedRelation: "catalog_variants"
            referencedColumns: ["code"]
          },
        ]
      }
      marketing_campaigns: {
        Row: {
          active: boolean
          created_at: string
          description: string | null
          end_date: string | null
          id: string
          multiplier: number | null
          participants_count: number
          reward_type: string | null
          reward_value: string | null
          start_date: string | null
          target_tier: string | null
          title: string
          updated_at: string
          valid_until: string | null
        }
        Insert: {
          active?: boolean
          created_at?: string
          description?: string | null
          end_date?: string | null
          id: string
          multiplier?: number | null
          participants_count?: number
          reward_type?: string | null
          reward_value?: string | null
          start_date?: string | null
          target_tier?: string | null
          title: string
          updated_at?: string
          valid_until?: string | null
        }
        Update: {
          active?: boolean
          created_at?: string
          description?: string | null
          end_date?: string | null
          id?: string
          multiplier?: number | null
          participants_count?: number
          reward_type?: string | null
          reward_value?: string | null
          start_date?: string | null
          target_tier?: string | null
          title?: string
          updated_at?: string
          valid_until?: string | null
        }
        Relationships: []
      }
      official_invoices: {
        Row: {
          buyer_address: string | null
          buyer_economic_code: string | null
          buyer_name: string
          buyer_national_id: string | null
          buyer_phone: string | null
          buyer_postal_code: string | null
          created_at: string
          discount_amount: number
          id: string
          invoice_number: string
          issued_date: string | null
          items: Json
          order_id: string | null
          seller_info: Json
          status: string
          subtotal_amount: number
          tax_amount: number
          total_payable: number
          updated_at: string
          user_id: string | null
        }
        Insert: {
          buyer_address?: string | null
          buyer_economic_code?: string | null
          buyer_name: string
          buyer_national_id?: string | null
          buyer_phone?: string | null
          buyer_postal_code?: string | null
          created_at?: string
          discount_amount?: number
          id: string
          invoice_number: string
          issued_date?: string | null
          items?: Json
          order_id?: string | null
          seller_info?: Json
          status?: string
          subtotal_amount?: number
          tax_amount?: number
          total_payable?: number
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          buyer_address?: string | null
          buyer_economic_code?: string | null
          buyer_name?: string
          buyer_national_id?: string | null
          buyer_phone?: string | null
          buyer_postal_code?: string | null
          created_at?: string
          discount_amount?: number
          id?: string
          invoice_number?: string
          issued_date?: string | null
          items?: Json
          order_id?: string | null
          seller_info?: Json
          status?: string
          subtotal_amount?: number
          tax_amount?: number
          total_payable?: number
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "official_invoices_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          created_at: string
          id: string
          order_id: string
          product_code: string
          product_name: string
          quantity: number
          total_price: number
          unit_price: number
        }
        Insert: {
          created_at?: string
          id?: string
          order_id: string
          product_code: string
          product_name: string
          quantity: number
          total_price?: number
          unit_price?: number
        }
        Update: {
          created_at?: string
          id?: string
          order_id?: string
          product_code?: string
          product_name?: string
          quantity?: number
          total_price?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_shipments: {
        Row: {
          carrier: string
          created_at: string
          id: string
          order_id: string
          payload: Json
          state: string
          tracking_code: string | null
        }
        Insert: {
          carrier: string
          created_at?: string
          id?: string
          order_id: string
          payload?: Json
          state?: string
          tracking_code?: string | null
        }
        Update: {
          carrier?: string
          created_at?: string
          id?: string
          order_id?: string
          payload?: Json
          state?: string
          tracking_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_shipments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_status_events: {
        Row: {
          actor_id: string | null
          created_at: string
          from_status: Database["public"]["Enums"]["order_status_type"] | null
          id: string
          note: string
          order_id: string
          to_status: Database["public"]["Enums"]["order_status_type"]
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          from_status?: Database["public"]["Enums"]["order_status_type"] | null
          id?: string
          note?: string
          order_id: string
          to_status: Database["public"]["Enums"]["order_status_type"]
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          from_status?: Database["public"]["Enums"]["order_status_type"] | null
          id?: string
          note?: string
          order_id?: string
          to_status?: Database["public"]["Enums"]["order_status_type"]
        }
        Relationships: [
          {
            foreignKeyName: "order_status_events_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          carrier: string | null
          company: string | null
          created_at: string
          crm_customer_id: string | null
          currency: string
          customer_name: string
          discount_amount: number
          final_amount: number | null
          id: string
          items_json: Json
          metadata: Json
          payment_method: Database["public"]["Enums"]["payment_method_type"]
          payment_status: string
          phone: string
          receipt_image_url: string | null
          receipt_tracking_code: string | null
          receipt_verified: boolean
          shipping_address: string | null
          shipping_amount: number
          status: Database["public"]["Enums"]["order_status_type"]
          tax_amount: number
          total_amount: number
          tracking_number: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          carrier?: string | null
          company?: string | null
          created_at?: string
          crm_customer_id?: string | null
          currency?: string
          customer_name: string
          discount_amount?: number
          final_amount?: number | null
          id: string
          items_json?: Json
          metadata?: Json
          payment_method?: Database["public"]["Enums"]["payment_method_type"]
          payment_status?: string
          phone: string
          receipt_image_url?: string | null
          receipt_tracking_code?: string | null
          receipt_verified?: boolean
          shipping_address?: string | null
          shipping_amount?: number
          status?: Database["public"]["Enums"]["order_status_type"]
          tax_amount?: number
          total_amount?: number
          tracking_number?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          carrier?: string | null
          company?: string | null
          created_at?: string
          crm_customer_id?: string | null
          currency?: string
          customer_name?: string
          discount_amount?: number
          final_amount?: number | null
          id?: string
          items_json?: Json
          metadata?: Json
          payment_method?: Database["public"]["Enums"]["payment_method_type"]
          payment_status?: string
          phone?: string
          receipt_image_url?: string | null
          receipt_tracking_code?: string | null
          receipt_verified?: boolean
          shipping_address?: string | null
          shipping_amount?: number
          status?: Database["public"]["Enums"]["order_status_type"]
          tax_amount?: number
          total_amount?: number
          tracking_number?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_crm_customer_id_fkey"
            columns: ["crm_customer_id"]
            isOneToOne: false
            referencedRelation: "crm_customers"
            referencedColumns: ["id"]
          },
        ]
      }
      owner_catalogue_photos: {
        Row: {
          bbox: Json
          catalogue_group: string | null
          document_sha256: string
          exact_warehouse_sku: string | null
          file_name: string
          image_sha256: string | null
          inliers: number | null
          match_ratio: number | null
          pdf_page: number
          printed_page: number | null
          review_status: string | null
          reviewed_on: string | null
          scope: string | null
        }
        Insert: {
          bbox?: Json
          catalogue_group?: string | null
          document_sha256: string
          exact_warehouse_sku?: string | null
          file_name: string
          image_sha256?: string | null
          inliers?: number | null
          match_ratio?: number | null
          pdf_page: number
          printed_page?: number | null
          review_status?: string | null
          reviewed_on?: string | null
          scope?: string | null
        }
        Update: {
          bbox?: Json
          catalogue_group?: string | null
          document_sha256?: string
          exact_warehouse_sku?: string | null
          file_name?: string
          image_sha256?: string | null
          inliers?: number | null
          match_ratio?: number | null
          pdf_page?: number
          printed_page?: number | null
          review_status?: string | null
          reviewed_on?: string | null
          scope?: string | null
        }
        Relationships: []
      }
      owner_catalogue_pin_rows: {
        Row: {
          conflict_details: Json | null
          dim_2r_inner: string | null
          dim_2r_outer: string | null
          dim_h: string | null
          dim_w: string | null
          drawing_pdf_page: number
          is_conflict: boolean
          not_in_inventory: boolean
          pdf_page: number
          printed_page: number
          sku: string
          source_sha256: string
          units: string
        }
        Insert: {
          conflict_details?: Json | null
          dim_2r_inner?: string | null
          dim_2r_outer?: string | null
          dim_h?: string | null
          dim_w?: string | null
          drawing_pdf_page?: number
          is_conflict?: boolean
          not_in_inventory?: boolean
          pdf_page?: number
          printed_page?: number
          sku: string
          source_sha256: string
          units?: string
        }
        Update: {
          conflict_details?: Json | null
          dim_2r_inner?: string | null
          dim_2r_outer?: string | null
          dim_h?: string | null
          dim_w?: string | null
          drawing_pdf_page?: number
          is_conflict?: boolean
          not_in_inventory?: boolean
          pdf_page?: number
          printed_page?: number
          sku?: string
          source_sha256?: string
          units?: string
        }
        Relationships: []
      }
      payment_attempts: {
        Row: {
          amount: number
          created_at: string
          currency: string
          evidence: Json | null
          id: string
          order_id: string
          provider: string
          provider_reference: string | null
          request_key: string
          state: string
          user_id: string
          verified_at: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          currency: string
          evidence?: Json | null
          id?: string
          order_id: string
          provider: string
          provider_reference?: string | null
          request_key: string
          state?: string
          user_id: string
          verified_at?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          evidence?: Json | null
          id?: string
          order_id?: string
          provider?: string
          provider_reference?: string | null
          request_key?: string
          state?: string
          user_id?: string
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_attempts_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_attempts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_refunds: {
        Row: {
          amount: number
          created_at: string
          evidence: Json | null
          id: string
          payment_id: string
          provider_reference: string | null
          request_key: string
          state: string
        }
        Insert: {
          amount: number
          created_at?: string
          evidence?: Json | null
          id?: string
          payment_id: string
          provider_reference?: string | null
          request_key: string
          state?: string
        }
        Update: {
          amount?: number
          created_at?: string
          evidence?: Json | null
          id?: string
          payment_id?: string
          provider_reference?: string | null
          request_key?: string
          state?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_refunds_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payment_attempts"
            referencedColumns: ["id"]
          },
        ]
      }
      plant_machinery_passports: {
        Row: {
          created_at: string
          criticality_level: string | null
          crm_customer_id: string | null
          id: string
          installed_parts: Json
          line_name: string | null
          machine_name: string
          maintenance_schedule: Json
          manufacturer: string | null
          model_year: string | null
          notes: string | null
          serial_number: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          criticality_level?: string | null
          crm_customer_id?: string | null
          id: string
          installed_parts?: Json
          line_name?: string | null
          machine_name: string
          maintenance_schedule?: Json
          manufacturer?: string | null
          model_year?: string | null
          notes?: string | null
          serial_number?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          criticality_level?: string | null
          crm_customer_id?: string | null
          id?: string
          installed_parts?: Json
          line_name?: string | null
          machine_name?: string
          maintenance_schedule?: Json
          manufacturer?: string | null
          model_year?: string | null
          notes?: string | null
          serial_number?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "plant_machinery_passports_crm_customer_id_fkey"
            columns: ["crm_customer_id"]
            isOneToOne: false
            referencedRelation: "crm_customers"
            referencedColumns: ["id"]
          },
        ]
      }
      portal_announcements: {
        Row: {
          active: boolean
          body: string
          created_at: string
          expires_at: string | null
          id: string
          pinned: boolean
          priority: string
          raw_payload: Json
          target_grades: Json
          target_roles: Json
          title: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          body: string
          created_at?: string
          expires_at?: string | null
          id: string
          pinned?: boolean
          priority?: string
          raw_payload?: Json
          target_grades?: Json
          target_roles?: Json
          title: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          body?: string
          created_at?: string
          expires_at?: string | null
          id?: string
          pinned?: boolean
          priority?: string
          raw_payload?: Json
          target_grades?: Json
          target_roles?: Json
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      portal_banners: {
        Row: {
          active: boolean
          created_at: string
          cta_text: string | null
          id: string
          image_url: string
          link_url: string | null
          position: string
          raw_payload: Json
          scope: string
          sort_order: number
          subtitle: string | null
          target_roles: Json
          title: string
          updated_at: string
          valid_until: string | null
        }
        Insert: {
          active?: boolean
          created_at?: string
          cta_text?: string | null
          id: string
          image_url: string
          link_url?: string | null
          position?: string
          raw_payload?: Json
          scope?: string
          sort_order?: number
          subtitle?: string | null
          target_roles?: Json
          title: string
          updated_at?: string
          valid_until?: string | null
        }
        Update: {
          active?: boolean
          created_at?: string
          cta_text?: string | null
          id?: string
          image_url?: string
          link_url?: string | null
          position?: string
          raw_payload?: Json
          scope?: string
          sort_order?: number
          subtitle?: string | null
          target_roles?: Json
          title?: string
          updated_at?: string
          valid_until?: string | null
        }
        Relationships: []
      }
      portal_kv_store: {
        Row: {
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          value: Json
        }
        Update: {
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      portal_layout_configs: {
        Row: {
          config: Json
          portal_key: string
          updated_at: string
        }
        Insert: {
          config?: Json
          portal_key: string
          updated_at?: string
        }
        Update: {
          config?: Json
          portal_key?: string
          updated_at?: string
        }
        Relationships: []
      }
      price_change_history: {
        Row: {
          changed_by: string
          created_at: string
          date_label: string | null
          id: string
          new_price: number
          old_price: number
          price_list_id: string | null
          product_code: string
          product_name: string | null
          reason: string | null
          snapshot: Json
        }
        Insert: {
          changed_by: string
          created_at?: string
          date_label?: string | null
          id: string
          new_price?: number
          old_price?: number
          price_list_id?: string | null
          product_code: string
          product_name?: string | null
          reason?: string | null
          snapshot?: Json
        }
        Update: {
          changed_by?: string
          created_at?: string
          date_label?: string | null
          id?: string
          new_price?: number
          old_price?: number
          price_list_id?: string | null
          product_code?: string
          product_name?: string | null
          reason?: string | null
          snapshot?: Json
        }
        Relationships: [
          {
            foreignKeyName: "price_change_history_price_list_id_fkey"
            columns: ["price_list_id"]
            isOneToOne: false
            referencedRelation: "price_lists"
            referencedColumns: ["id"]
          },
        ]
      }
      price_inquiries: {
        Row: {
          admin_reply: string | null
          attachments: Json
          company_name: string | null
          created_at: string
          crm_customer_id: string | null
          customer_name: string
          customer_note: string | null
          id: string
          items: Json
          phone: string
          product_code: string
          product_name: string
          quantity: number
          quoted_total_price: number | null
          quoted_unit_price: number | null
          status: Database["public"]["Enums"]["inquiry_status_type"]
          unit: string | null
          updated_at: string
          urgency: string | null
          user_id: string | null
          validity_date: string | null
        }
        Insert: {
          admin_reply?: string | null
          attachments?: Json
          company_name?: string | null
          created_at?: string
          crm_customer_id?: string | null
          customer_name: string
          customer_note?: string | null
          id: string
          items?: Json
          phone: string
          product_code: string
          product_name: string
          quantity?: number
          quoted_total_price?: number | null
          quoted_unit_price?: number | null
          status?: Database["public"]["Enums"]["inquiry_status_type"]
          unit?: string | null
          updated_at?: string
          urgency?: string | null
          user_id?: string | null
          validity_date?: string | null
        }
        Update: {
          admin_reply?: string | null
          attachments?: Json
          company_name?: string | null
          created_at?: string
          crm_customer_id?: string | null
          customer_name?: string
          customer_note?: string | null
          id?: string
          items?: Json
          phone?: string
          product_code?: string
          product_name?: string
          quantity?: number
          quoted_total_price?: number | null
          quoted_unit_price?: number | null
          status?: Database["public"]["Enums"]["inquiry_status_type"]
          unit?: string | null
          updated_at?: string
          urgency?: string | null
          user_id?: string | null
          validity_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "price_inquiries_crm_customer_id_fkey"
            columns: ["crm_customer_id"]
            isOneToOne: false
            referencedRelation: "crm_customers"
            referencedColumns: ["id"]
          },
        ]
      }
      price_lists: {
        Row: {
          created_at: string
          created_by: string | null
          currency: string
          description: string | null
          discount_percent: number
          id: string
          is_active: boolean
          is_default: boolean
          items: Json
          name: string
          target_grades: Json
          updated_at: string
          valid_from: string | null
          valid_until: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          currency?: string
          description?: string | null
          discount_percent?: number
          id: string
          is_active?: boolean
          is_default?: boolean
          items?: Json
          name: string
          target_grades?: Json
          updated_at?: string
          valid_from?: string | null
          valid_until?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          currency?: string
          description?: string | null
          discount_percent?: number
          id?: string
          is_active?: boolean
          is_default?: boolean
          items?: Json
          name?: string
          target_grades?: Json
          updated_at?: string
          valid_from?: string | null
          valid_until?: string | null
        }
        Relationships: []
      }
      reward_redemptions: {
        Row: {
          created_at: string
          id: string
          points_spent: number
          request_key: string
          reward_id: string
          state: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          points_spent: number
          request_key: string
          reward_id: string
          state?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          points_spent?: number
          request_key?: string
          reward_id?: string
          state?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reward_redemptions_reward_id_fkey"
            columns: ["reward_id"]
            isOneToOne: false
            referencedRelation: "club_rewards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reward_redemptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      sms_logs: {
        Row: {
          created_at: string
          event_key: string | null
          id: string
          message_text: string
          recipient_name: string | null
          recipient_phone: string
          sent_at: string | null
          status: string
        }
        Insert: {
          created_at?: string
          event_key?: string | null
          id: string
          message_text: string
          recipient_name?: string | null
          recipient_phone: string
          sent_at?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          event_key?: string | null
          id?: string
          message_text?: string
          recipient_name?: string | null
          recipient_phone?: string
          sent_at?: string | null
          status?: string
        }
        Relationships: []
      }
      sms_templates: {
        Row: {
          event_key: string
          id: string
          text: string
          title: string
          updated_at: string
          variables: Json
        }
        Insert: {
          event_key: string
          id: string
          text: string
          title: string
          updated_at?: string
          variables?: Json
        }
        Update: {
          event_key?: string
          id?: string
          text?: string
          title?: string
          updated_at?: string
          variables?: Json
        }
        Relationships: []
      }
      static_pages: {
        Row: {
          content: string
          id: string
          last_updated: string | null
          slug: string
          title: string
          updated_at: string
        }
        Insert: {
          content: string
          id: string
          last_updated?: string | null
          slug: string
          title: string
          updated_at?: string
        }
        Update: {
          content?: string
          id?: string
          last_updated?: string | null
          slug?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      stock_reservations: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          order_id: string
          quantity: number
          state: string
          variant_code: string
        }
        Insert: {
          created_at?: string
          expires_at: string
          id?: string
          order_id: string
          quantity: number
          state?: string
          variant_code: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          order_id?: string
          quantity?: number
          state?: string
          variant_code?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_reservations_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_reservations_variant_code_fkey"
            columns: ["variant_code"]
            isOneToOne: false
            referencedRelation: "catalog_variants"
            referencedColumns: ["code"]
          },
        ]
      }
      support_tickets: {
        Row: {
          created_at: string
          customer_name: string
          id: string
          messages: Json
          phone: string
          status: string
          subject: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          customer_name: string
          id: string
          messages?: Json
          phone: string
          status?: string
          subject: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          customer_name?: string
          id?: string
          messages?: Json
          phone?: string
          status?: string
          subject?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      system_settings: {
        Row: {
          currency: string
          id: string
          payment_gateway: Json
          raw_settings: Json
          seo: Json
          shipping_methods: Json
          sms_provider: Json
          updated_at: string
        }
        Insert: {
          currency?: string
          id?: string
          payment_gateway?: Json
          raw_settings?: Json
          seo?: Json
          shipping_methods?: Json
          sms_provider?: Json
          updated_at?: string
        }
        Update: {
          currency?: string
          id?: string
          payment_gateway?: Json
          raw_settings?: Json
          seo?: Json
          shipping_methods?: Json
          sms_provider?: Json
          updated_at?: string
        }
        Relationships: []
      }
      technical_research_records: {
        Row: {
          catalog_marking: string | null
          checked_on: string | null
          model: string | null
          original_identity_preserved: boolean
          original_name: string
          original_size: string | null
          outcome: string
          owner_catalogue: Json | null
          part_type: string | null
          reference_length_check: Json | null
          reference_urls: Json
          sku: string
          warnings: Json
        }
        Insert: {
          catalog_marking?: string | null
          checked_on?: string | null
          model?: string | null
          original_identity_preserved?: boolean
          original_name: string
          original_size?: string | null
          outcome: string
          owner_catalogue?: Json | null
          part_type?: string | null
          reference_length_check?: Json | null
          reference_urls?: Json
          sku: string
          warnings?: Json
        }
        Update: {
          catalog_marking?: string | null
          checked_on?: string | null
          model?: string | null
          original_identity_preserved?: boolean
          original_name?: string
          original_size?: string | null
          outcome?: string
          owner_catalogue?: Json | null
          part_type?: string | null
          reference_length_check?: Json | null
          reference_urls?: Json
          sku?: string
          warnings?: Json
        }
        Relationships: []
      }
      ticket_messages: {
        Row: {
          author_id: string
          body: string
          created_at: string
          file_id: string | null
          id: string
          internal: boolean
          ticket_id: string
        }
        Insert: {
          author_id: string
          body: string
          created_at?: string
          file_id?: string | null
          id?: string
          internal?: boolean
          ticket_id: string
        }
        Update: {
          author_id?: string
          body?: string
          created_at?: string
          file_id?: string | null
          id?: string
          internal?: boolean
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_messages_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_messages_file_id_fkey"
            columns: ["file_id"]
            isOneToOne: false
            referencedRelation: "document_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_messages_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      timing_belt_reference_lengths: {
        Row: {
          checked_on: string | null
          conflict_note: string | null
          designation: string
          id: string
          is_conflict: boolean
          length_mm: number | null
          pdf_page: number | null
          profile_code: string | null
          raw_entry: Json
          reference_source: string
          source_page: number | null
          source_sha256: string | null
          source_url: string | null
          teeth_count: number | null
        }
        Insert: {
          checked_on?: string | null
          conflict_note?: string | null
          designation: string
          id?: string
          is_conflict?: boolean
          length_mm?: number | null
          pdf_page?: number | null
          profile_code?: string | null
          raw_entry?: Json
          reference_source: string
          source_page?: number | null
          source_sha256?: string | null
          source_url?: string | null
          teeth_count?: number | null
        }
        Update: {
          checked_on?: string | null
          conflict_note?: string | null
          designation?: string
          id?: string
          is_conflict?: boolean
          length_mm?: number | null
          pdf_page?: number | null
          profile_code?: string | null
          raw_entry?: Json
          reference_source?: string
          source_page?: number | null
          source_sha256?: string | null
          source_url?: string | null
          teeth_count?: number | null
        }
        Relationships: []
      }
      user_addresses: {
        Row: {
          active: boolean
          city: string
          created_at: string
          full_address: string
          id: string
          legacy_id: string | null
          postal_code: string | null
          province: string
          recipient_name: string | null
          recipient_phone: string | null
          title: string
          user_id: string
        }
        Insert: {
          active?: boolean
          city: string
          created_at?: string
          full_address: string
          id?: string
          legacy_id?: string | null
          postal_code?: string | null
          province: string
          recipient_name?: string | null
          recipient_phone?: string | null
          title: string
          user_id: string
        }
        Update: {
          active?: boolean
          city?: string
          created_at?: string
          full_address?: string
          id?: string
          legacy_id?: string | null
          postal_code?: string | null
          province?: string
          recipient_name?: string | null
          recipient_phone?: string | null
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_addresses_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_profiles: {
        Row: {
          address: string | null
          approved_b2b: boolean
          assigned_price_list_id: string | null
          can_view_prices: boolean
          can_view_stock: boolean
          city: string | null
          club_points: number
          company_name: string | null
          created_at: string
          credit_limit: number
          credit_used: number
          current_debt: number
          custom_discount_percent: number
          economic_code: string | null
          email: string | null
          full_name: string
          grade_code: string | null
          id: string
          last_login_at: string | null
          legacy_user_id: string | null
          lifetime_points: number
          national_id: string | null
          phone: string | null
          postal_code: string | null
          preferences: Json
          province: string | null
          registration_number: string | null
          role: Database["public"]["Enums"]["app_role_type"]
          status: Database["public"]["Enums"]["account_status_type"]
          updated_at: string
          username: string | null
          viewed_categories: Json
          wallet_balance: number
        }
        Insert: {
          address?: string | null
          approved_b2b?: boolean
          assigned_price_list_id?: string | null
          can_view_prices?: boolean
          can_view_stock?: boolean
          city?: string | null
          club_points?: number
          company_name?: string | null
          created_at?: string
          credit_limit?: number
          credit_used?: number
          current_debt?: number
          custom_discount_percent?: number
          economic_code?: string | null
          email?: string | null
          full_name?: string
          grade_code?: string | null
          id: string
          last_login_at?: string | null
          legacy_user_id?: string | null
          lifetime_points?: number
          national_id?: string | null
          phone?: string | null
          postal_code?: string | null
          preferences?: Json
          province?: string | null
          registration_number?: string | null
          role?: Database["public"]["Enums"]["app_role_type"]
          status?: Database["public"]["Enums"]["account_status_type"]
          updated_at?: string
          username?: string | null
          viewed_categories?: Json
          wallet_balance?: number
        }
        Update: {
          address?: string | null
          approved_b2b?: boolean
          assigned_price_list_id?: string | null
          can_view_prices?: boolean
          can_view_stock?: boolean
          city?: string | null
          club_points?: number
          company_name?: string | null
          created_at?: string
          credit_limit?: number
          credit_used?: number
          current_debt?: number
          custom_discount_percent?: number
          economic_code?: string | null
          email?: string | null
          full_name?: string
          grade_code?: string | null
          id?: string
          last_login_at?: string | null
          legacy_user_id?: string | null
          lifetime_points?: number
          national_id?: string | null
          phone?: string | null
          postal_code?: string | null
          preferences?: Json
          province?: string | null
          registration_number?: string | null
          role?: Database["public"]["Enums"]["app_role_type"]
          status?: Database["public"]["Enums"]["account_status_type"]
          updated_at?: string
          username?: string | null
          viewed_categories?: Json
          wallet_balance?: number
        }
        Relationships: [
          {
            foreignKeyName: "user_profiles_assigned_price_list_id_fkey"
            columns: ["assigned_price_list_id"]
            isOneToOne: false
            referencedRelation: "price_lists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_profiles_grade_code_fkey"
            columns: ["grade_code"]
            isOneToOne: false
            referencedRelation: "customer_grade_configs"
            referencedColumns: ["grade_code"]
          },
        ]
      }
      user_saved_collections: {
        Row: {
          collection_type: string
          id: string
          items: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          collection_type: string
          id?: string
          items?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          collection_type?: string
          id?: string
          items?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      variant_commercial_specs: {
        Row: {
          base_price: number
          currency: string
          dealer_price: number
          family_code: string
          inquiry_only: boolean
          price: number
          retail_price: number
          stock: number
          stock_known: boolean
          stock_reserved: number
          stock_version: number
          updated_at: string
          updated_by: string | null
          variant_code: string
          wholesale_price: number
        }
        Insert: {
          base_price?: number
          currency?: string
          dealer_price?: number
          family_code: string
          inquiry_only?: boolean
          price?: number
          retail_price?: number
          stock?: number
          stock_known?: boolean
          stock_reserved?: number
          stock_version?: number
          updated_at?: string
          updated_by?: string | null
          variant_code: string
          wholesale_price?: number
        }
        Update: {
          base_price?: number
          currency?: string
          dealer_price?: number
          family_code?: string
          inquiry_only?: boolean
          price?: number
          retail_price?: number
          stock?: number
          stock_known?: boolean
          stock_reserved?: number
          stock_version?: number
          updated_at?: string
          updated_by?: string | null
          variant_code?: string
          wholesale_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "variant_commercial_specs_family_code_fkey"
            columns: ["family_code"]
            isOneToOne: false
            referencedRelation: "catalog_families"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "variant_commercial_specs_variant_code_fkey"
            columns: ["variant_code"]
            isOneToOne: true
            referencedRelation: "catalog_variants"
            referencedColumns: ["code"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_current_user_view_commercial: { Args: never; Returns: boolean }
      get_family_variants_for_current_user: {
        Args: { target_family_code: string }
        Returns: {
          active: boolean
          brand: string
          code: string
          dealer_price: number
          family_code: string
          images: Json
          inquiry_only: boolean
          model: string
          name: string
          price: number
          retail_price: number
          size: string
          stock: number
          stock_known: boolean
          technical_review: Json
          technical_specs: Json
          unit: string
          wholesale_price: number
        }[]
      }
      is_admin_user: { Args: never; Returns: boolean }
      match_catalog_images_by_family: {
        Args: {
          match_count?: number
          match_threshold?: number
          query_embedding: string
          target_family_code?: string
        }
        Returns: {
          clean_ah: string
          clean_dh: string
          clean_ph: string
          family_code: string
          file_name: string
          image_url: string
          similarity: number
          variant_code: string
        }[]
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
    }
    Enums: {
      account_status_type: "pending" | "active" | "suspended" | "rejected"
      app_role_type:
        | "guest"
        | "client"
        | "club"
        | "agency"
        | "warehouse_operator"
        | "sales_manager"
        | "super_admin"
      customer_grade_code:
        | "bronze"
        | "silver"
        | "gold"
        | "platinum"
        | "diamond"
        | "vip_partner"
      image_scope_type: "family" | "family-example" | "variant" | "unassigned"
      inquiry_status_type:
        | "pending"
        | "reviewing"
        | "quoted"
        | "approved"
        | "rejected"
        | "expired"
        | "converted_to_order"
      order_status_type:
        | "pending"
        | "confirmed"
        | "packing"
        | "shipped"
        | "delivered"
        | "cancelled"
      payment_method_type: "online" | "receipt" | "credit" | "check" | "wallet"
      technical_review_status_type:
        | "reference-enriched"
        | "catalog-extracted"
        | "needs-identification"
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
    Enums: {
      account_status_type: ["pending", "active", "suspended", "rejected"],
      app_role_type: [
        "guest",
        "client",
        "club",
        "agency",
        "warehouse_operator",
        "sales_manager",
        "super_admin",
      ],
      customer_grade_code: [
        "bronze",
        "silver",
        "gold",
        "platinum",
        "diamond",
        "vip_partner",
      ],
      image_scope_type: ["family", "family-example", "variant", "unassigned"],
      inquiry_status_type: [
        "pending",
        "reviewing",
        "quoted",
        "approved",
        "rejected",
        "expired",
        "converted_to_order",
      ],
      order_status_type: [
        "pending",
        "confirmed",
        "packing",
        "shipped",
        "delivered",
        "cancelled",
      ],
      payment_method_type: ["online", "receipt", "credit", "check", "wallet"],
      technical_review_status_type: [
        "reference-enriched",
        "catalog-extracted",
        "needs-identification",
      ],
    },
  },
} as const

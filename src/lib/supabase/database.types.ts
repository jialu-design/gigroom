/**
 * TEMPORARY — replace with `supabase gen types typescript` after project is linked.
 *
 * 本文件为 P10.1.5 临时 Database 类型入口，覆盖 P10.2-A 已接入的公共读表：
 * - profiles（P10.1）
 * - artists / venues / shows / show_artists（P10.2-A）
 *
 * 后续业务表迁移后，应使用官方生成类型替换：
 *
 *   npx supabase gen types typescript --project-id <PROJECT_ID> \
 *     > src/lib/supabase/database.types.ts
 *
 * 注意：
 * - 使用 `type` 而非 `interface`，确保 `Database[Schema] extends GenericSchema`
 *   条件类型能正确匹配。
 * - Table 的 Relationships 必须是 postgrest-js GenericRelationship 数组形状
 *   （foreignKeyName/columns/referencedRelation/referencedColumns），否则
 *   `.update()` 参数会被推导为 never。
 * - 不要把本文件内容冒充为真实的 generated types——真实 generated 会带有
 *   Enums、CompositeTypes、完整 Tables/Views/Functions 列表。
 */

// 与 @supabase/postgrest-js 的 GenericRelationship 形状保持一致，
// 满足 ProfilesQueryBuilder.Schema.Tables[*].Relationships 的严格约束。
type GenericRelationshipShape = {
  foreignKeyName: string;
  columns: string[];
  isOneToOne?: boolean;
  referencedRelation: string;
  referencedColumns: string[];
};

export type Database = {
  public: {
    Tables: {
      // ============ P10.1 / P10.4 profiles ============
      profiles: {
        Row: {
          id: string;
          display_name: string;
          avatar_url: string | null;
          city: string | null;
          bio: string | null;
          onboarding_completed: boolean;
          created_at: string;
          updated_at: string;
          // P10.4 为 AI 推荐预留的用户画像字段（先以 jsonb 存储，
          // 未来根据实际查询模式再拆成独立列）
          music_preferences: unknown | null;
          favorite_artists: string[] | null;
          favorite_genres: string[] | null;
          attendance_history: unknown | null;
          interaction_tags: string[] | null;
        };
        Insert: {
          id: string;
          display_name: string;
          avatar_url?: string | null;
          city?: string | null;
          bio?: string | null;
          onboarding_completed?: boolean;
          music_preferences?: unknown | null;
          favorite_artists?: string[] | null;
          favorite_genres?: string[] | null;
          attendance_history?: unknown | null;
          interaction_tags?: string[] | null;
        };
        Update: {
          display_name?: string;
          avatar_url?: string | null;
          city?: string | null;
          bio?: string | null;
          onboarding_completed?: boolean;
          updated_at?: string;
          music_preferences?: unknown | null;
          favorite_artists?: string[] | null;
          favorite_genres?: string[] | null;
          attendance_history?: unknown | null;
          interaction_tags?: string[] | null;
        };
        Relationships: GenericRelationshipShape[];
      };

      // ============ P10.2-A public read ============
      artists: {
        Row: {
          id: string;
          name: string;
          cover_url: string | null;
          city: string | null;
          country: string | null;
          genres: string[];
          bio: string | null;
          external_links: Record<string, string> | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          cover_url?: string | null;
          city?: string | null;
          country?: string | null;
          genres?: string[];
          bio?: string | null;
          external_links?: Record<string, string> | null;
        };
        Update: {
          name?: string;
          cover_url?: string | null;
          city?: string | null;
          country?: string | null;
          genres?: string[];
          bio?: string | null;
          external_links?: Record<string, string> | null;
        };
        Relationships: GenericRelationshipShape[];
      };

      venues: {
        Row: {
          id: string;
          name: string;
          city: string;
          address: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          city: string;
          address?: string | null;
        };
        Update: {
          name?: string;
          city?: string;
          address?: string | null;
        };
        Relationships: GenericRelationshipShape[];
      };

      shows: {
        Row: {
          id: string;
          title: string | null;
          venue_id: string | null;
          city: string;
          date_time: string;
          poster_url: string | null;
          price_presale: number | null;
          price_door: number | null;
          price_text: string | null;
          ticket_platform: string | null;
          ticket_url: string | null;
          ticket_status: string | null;
          status: string;
          is_demo: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          title?: string | null;
          venue_id?: string | null;
          city: string;
          date_time: string;
          poster_url?: string | null;
          price_presale?: number | null;
          price_door?: number | null;
          price_text?: string | null;
          ticket_platform?: string | null;
          ticket_url?: string | null;
          ticket_status?: string | null;
          status: string;
          is_demo?: boolean;
        };
        Update: {
          title?: string | null;
          venue_id?: string | null;
          city?: string;
          date_time?: string;
          poster_url?: string | null;
          price_presale?: number | null;
          price_door?: number | null;
          price_text?: string | null;
          ticket_platform?: string | null;
          ticket_url?: string | null;
          ticket_status?: string | null;
          status?: string;
          is_demo?: boolean;
          updated_at?: string;
        };
        Relationships: GenericRelationshipShape[];
      };

      show_artists: {
        Row: {
          id: string;
          show_id: string;
          artist_id: string;
          role: string;
          billing_order: number;
        };
        Insert: {
          id?: string;
          show_id: string;
          artist_id: string;
          role: string;
          billing_order?: number;
        };
        Update: {
          role?: string;
          billing_order?: number;
        };
        Relationships: GenericRelationshipShape[];
      };

      // ============ P10.2-B 用户行为：user_artist_follows ============
      user_artist_follows: {
        Row: {
          id: string;
          user_id: string;
          artist_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          artist_id: string;
          created_at?: string;
        };
        Update: {
          created_at?: string;
        };
        Relationships: GenericRelationshipShape[];
      };

      // ============ V1 HR Demo Mock 乐队关注云端持久化（artist_id 为 text） ============
      user_mock_artist_follows: {
        Row: {
          user_id: string;
          artist_id: string;
          created_at: string;
        };
        Insert: {
          user_id: string;
          artist_id: string;
          created_at?: string;
        };
        Update: {
          user_id?: string;
          artist_id?: string;
          created_at?: string;
        };
        Relationships: GenericRelationshipShape[];
      };

      // ============ P10.2-D 观演小屋 ============
      show_rooms: {
        Row: {
          id: string;
          show_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          show_id: string;
          created_at?: string;
        };
        Update: {
          created_at?: string;
        };
        Relationships: GenericRelationshipShape[];
      };

      // ============ P10.2-D 房间成员 ============
      room_memberships: {
        Row: {
          id: string;
          user_id: string;
          room_id: string;
          joined_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          room_id: string;
          joined_at?: string;
        };
        Update: {
          joined_at?: string;
        };
        Relationships: GenericRelationshipShape[];
      };

      // ============ P10.2-D 讨论消息 ============
      discussion_messages: {
        Row: {
          id: string;
          room_id: string;
          user_id: string;
          content: string;
          reply_to_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          room_id: string;
          user_id: string;
          content: string;
          reply_to_id?: string | null;
          created_at?: string;
        };
        Update: {
          content?: string;
          reply_to_id?: string | null;
        };
        Relationships: GenericRelationshipShape[];
      };

      // ============ P10.3 社区帖子 ============
      buddy_posts: {
        Row: {
          id: string;
          show_id: string;
          user_id: string;
          content: string;
          tags: string[];
          created_at: string;
        };
        Insert: {
          id?: string;
          show_id: string;
          user_id: string;
          content: string;
          tags?: string[];
          created_at?: string;
        };
        Update: {
          content?: string;
          tags?: string[];
        };
        Relationships: GenericRelationshipShape[];
      };

      buddy_post_comments: {
        Row: {
          id: string;
          buddy_post_id: string;
          user_id: string;
          content: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          buddy_post_id: string;
          user_id: string;
          content: string;
          created_at?: string;
        };
        Update: {
          content?: string;
        };
        Relationships: GenericRelationshipShape[];
      };

      ticket_posts: {
        Row: {
          id: string;
          show_id: string;
          user_id: string;
          type: string;
          quantity: number;
          face_value: number | null;
          price: number | null;
          note: string | null;
          status: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          show_id: string;
          user_id: string;
          type: string;
          quantity: number;
          face_value?: number | null;
          price?: number | null;
          note?: string | null;
          status?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          quantity?: number;
          face_value?: number | null;
          price?: number | null;
          note?: string | null;
          status?: string;
          updated_at?: string;
        };
        Relationships: GenericRelationshipShape[];
      };

      ticket_post_comments: {
        Row: {
          id: string;
          ticket_post_id: string;
          user_id: string;
          content: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          ticket_post_id: string;
          user_id: string;
          content: string;
          created_at?: string;
        };
        Update: {
          content?: string;
        };
        Relationships: GenericRelationshipShape[];
      };

      live_posts: {
        Row: {
          id: string;
          show_id: string;
          user_id: string;
          content: string | null;
          image_urls: string[];
          video_url: string | null;
          video_platform: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          show_id: string;
          user_id: string;
          content?: string | null;
          image_urls?: string[];
          video_url?: string | null;
          video_platform?: string | null;
          created_at?: string;
        };
        Update: {
          content?: string | null;
          image_urls?: string[];
          video_url?: string | null;
          video_platform?: string | null;
        };
        Relationships: GenericRelationshipShape[];
      };

      // ============ P10.5 用户行为事件 ============
      user_events: {
        Row: {
          id: string;
          user_id: string;
          event_type: string;
          target_type: string;
          target_id: string;
          metadata: Record<string, unknown> | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          event_type: string;
          target_type: string;
          target_id: string;
          metadata?: Record<string, unknown> | null;
          created_at?: string;
        };
        Update: {
          event_type?: string;
          target_type?: string;
          target_id?: string;
          metadata?: Record<string, unknown> | null;
        };
        Relationships: GenericRelationshipShape[];
      };

      // ============ P10.6 票务持有 ============
      ticket_ownerships: {
        Row: {
          id: string;
          user_id: string;
          show_id: string;
          ticket_id: string;
          status: string;
          verified_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          show_id: string;
          ticket_id: string;
          status?: string;
          verified_at?: string | null;
          created_at?: string;
        };
        Update: {
          status?: string;
          verified_at?: string | null;
        };
        Relationships: GenericRelationshipShape[];
      };

      // ============ P10.6.3 找搭子请求 ============
      companion_requests: {
        Row: {
          id: string;
          user_id: string;
          show_id: string;
          type: string;
          content: string;
          status: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          show_id: string;
          type: string;
          content: string;
          status?: string;
          created_at?: string;
        };
        Update: {
          type?: string;
          content?: string;
          status?: string;
        };
        Relationships: GenericRelationshipShape[];
      };

      // ============ P10.6.4 官方转票 ============
      ticket_transfers: {
        Row: {
          id: string;
          ticket_id: string;
          seller_id: string;
          buyer_id: string | null;
          original_price: number;
          transfer_price: number;
          status: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          ticket_id: string;
          seller_id: string;
          buyer_id?: string | null;
          original_price: number;
          transfer_price: number;
          status?: string;
          created_at?: string;
        };
        Update: {
          buyer_id?: string | null;
          status?: string;
        };
        Relationships: GenericRelationshipShape[];
      };

      // ============ P10.7 用户信用汇总 ============
      user_reputations: {
        Row: {
          user_id: string;
          total_score: number;
          transfer_count: number;
          companion_count: number;
          attended_count: number;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          total_score?: number;
          transfer_count?: number;
          companion_count?: number;
          attended_count?: number;
          updated_at?: string;
        };
        Update: {
          total_score?: number;
          transfer_count?: number;
          companion_count?: number;
          attended_count?: number;
          updated_at?: string;
        };
        Relationships: GenericRelationshipShape[];
      };

      // ============ P10.7 信用事件记录 ============
      reputation_events: {
        Row: {
          id: string;
          user_id: string;
          event_type: string;
          score_delta: number;
          description: string;
          related_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          event_type: string;
          score_delta: number;
          description: string;
          related_id?: string | null;
          created_at?: string;
        };
        Update: {
          score_delta?: number;
          description?: string;
        };
        Relationships: GenericRelationshipShape[];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
  };
};

/** profiles 表 Row 类型（从 Database 派生，避免重复手写） */
export type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];

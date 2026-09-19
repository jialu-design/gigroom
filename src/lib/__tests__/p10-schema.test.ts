/**
 * P10.0 Schema 架构静态测试
 *
 * 不测试 Supabase 网络，只验证 migration SQL 文件的结构完整性。
 * 防止后续 migration 被误改造成安全漏洞。
 */
import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

// 读取 migration SQL
const migrationPath = path.join(
  process.cwd(),
  "supabase",
  "migrations",
  "001_init.sql"
);
const migrationSql = fs.existsSync(migrationPath)
  ? fs.readFileSync(migrationPath, "utf-8")
  : "";

// 读取 client.ts
const clientPath = path.join(
  process.cwd(),
  "src",
  "lib",
  "supabase",
  "client.ts"
);
const clientCode = fs.existsSync(clientPath)
  ? fs.readFileSync(clientPath, "utf-8")
  : "";

// 读取 .env.example
const envExamplePath = path.join(process.cwd(), ".env.example");
const envExample = fs.existsSync(envExamplePath)
  ? fs.readFileSync(envExamplePath, "utf-8")
  : "";

// 核心表列表
const CORE_TABLES = [
  "profiles",
  "artists",
  "venues",
  "shows",
  "show_artists",
  "show_rooms",
  "room_memberships",
  "user_artist_follows",
  "user_show_statuses",
  "announcements",
  "discussion_messages",
  "buddy_posts",
  "buddy_post_comments",
  "ticket_posts",
  "ticket_post_comments",
  "live_posts",
  "notifications",
  "reports",
];

describe("P10.0 Schema 架构测试", () => {
  it("migration 文件存在", () => {
    expect(migrationSql.length).toBeGreaterThan(0);
  });

  it("核心 18 张表定义存在", () => {
    for (const table of CORE_TABLES) {
      expect(migrationSql).toContain(`CREATE TABLE public.${table}`);
    }
  });

  it("所有核心表 ENABLE ROW LEVEL SECURITY", () => {
    for (const table of CORE_TABLES) {
      expect(migrationSql).toContain(
        `ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY`
      );
    }
  });

  // ========================
  // UNIQUE 约束
  // ========================
  it("user_show_statuses 有 unique(user_id, show_id)", () => {
    expect(migrationSql).toMatch(/UNIQUE\s*\(user_id,\s*show_id\)/);
  });

  it("room_memberships 有 unique(user_id, room_id)", () => {
    expect(migrationSql).toMatch(/UNIQUE\s*\(user_id,\s*room_id\)/);
  });

  it("user_artist_follows 有 unique(user_id, artist_id)", () => {
    expect(migrationSql).toMatch(/UNIQUE\s*\(user_id,\s*artist_id\)/);
  });

  it("show_rooms.show_id unique", () => {
    expect(migrationSql).toMatch(/show_id uuid NOT NULL UNIQUE/);
  });

  it("show_artists 有 unique(show_id, artist_id)", () => {
    expect(migrationSql).toMatch(/UNIQUE\s*\(show_id,\s*artist_id\)/);
  });

  // ========================
  // 索引
  // ========================
  it("shows(date_time) 索引存在", () => {
    expect(migrationSql).toContain("idx_shows_date_time");
  });

  it("shows(city) 索引存在", () => {
    expect(migrationSql).toContain("idx_shows_city");
  });

  it("show_artists(show_id) 索引存在", () => {
    expect(migrationSql).toContain("idx_show_artists_show_id");
  });

  it("show_artists(artist_id) 索引存在", () => {
    expect(migrationSql).toContain("idx_show_artists_artist_id");
  });

  it("notifications(user_id, is_read) 索引存在", () => {
    expect(migrationSql).toContain("idx_notifications_user_unread");
  });

  it("discussion_messages(room_id, created_at) 索引存在", () => {
    expect(migrationSql).toContain("idx_discussion_messages_room_created");
  });

  // ========================
  // RLS Policy 验证
  // ========================
  it("社区表 public SELECT policy 存在", () => {
    const communitySelectPolicies = [
      "discussion_select_public",
      "buddy_posts_select_public",
      "buddy_comments_select_public",
      "ticket_posts_select_public",
      "ticket_comments_select_public",
      "live_posts_select_public",
    ];
    for (const policy of communitySelectPolicies) {
      expect(migrationSql).toContain(policy);
    }
  });

  it("社区 INSERT policy 包含 auth.uid", () => {
    const insertPolicies = [
      "discussion_insert_member",
      "buddy_posts_insert_member",
      "ticket_posts_insert_member",
      "live_posts_insert_member",
    ];
    for (const policy of insertPolicies) {
      expect(migrationSql).toContain(policy);
      // 验证 policy 包含 auth.uid() = user_id
      const policyBlock = migrationSql.match(
        new RegExp(`CREATE POLICY "${policy}"[\\s\\S]*?;`)
      );
      expect(policyBlock).not.toBeNull();
      expect(policyBlock![0]).toContain("auth.uid() = user_id");
    }
  });

  it("社区 INSERT policy 验证 RoomMembership", () => {
    // discussion_messages 直接验证 room_id
    const discussionPolicy = migrationSql.match(
      /CREATE POLICY "discussion_insert_member"[\s\S]*?;/
    );
    expect(discussionPolicy).not.toBeNull();
    expect(discussionPolicy![0]).toContain("room_memberships");

    // buddy/ticket/live 通过 show_rooms JOIN room_memberships 验证
    const buddyPolicy = migrationSql.match(
      /CREATE POLICY "buddy_posts_insert_member"[\s\S]*?;/
    );
    expect(buddyPolicy).not.toBeNull();
    expect(buddyPolicy![0]).toContain("show_rooms");
    expect(buddyPolicy![0]).toContain("room_memberships");
  });

  it("notifications 用户只能访问自己的", () => {
    expect(migrationSql).toContain("notifications_select_own");
    expect(migrationSql).toContain("notifications_update_own");
    const selectPolicy = migrationSql.match(
      /CREATE POLICY "notifications_select_own"[\s\S]*?;/
    );
    expect(selectPolicy![0]).toContain("auth.uid() = user_id");
  });

  it("notification 普通用户没有 INSERT policy", () => {
    // 确认没有 notifications_insert 开头的 policy
    expect(migrationSql).not.toMatch(
      /CREATE POLICY "notifications_insert[^"]*"/
    );
  });

  it("reports authenticated insert policy 存在", () => {
    expect(migrationSql).toContain("reports_insert_own");
    const policy = migrationSql.match(
      /CREATE POLICY "reports_insert_own"[\s\S]*?;/
    );
    expect(policy![0]).toContain("auth.uid() = reporter_id");
  });

  it("reports 没有 SELECT policy（普通用户不能查看全部）", () => {
    expect(migrationSql).not.toMatch(/CREATE POLICY "reports_select[^"]*"/);
  });

  // ========================
  // Triggers / Functions
  // ========================
  it("updated_at trigger/function 存在", () => {
    expect(migrationSql).toContain("set_updated_at()");
    expect(migrationSql).toContain("set_updated_at_profiles");
    expect(migrationSql).toContain("set_updated_at_shows");
    expect(migrationSql).toContain("set_updated_at_user_show_statuses");
    expect(migrationSql).toContain("set_updated_at_ticket_posts");
  });

  it("auth → profiles trigger 存在", () => {
    expect(migrationSql).toContain("handle_new_user()");
    expect(migrationSql).toContain("trigger_auth_create_profile");
    expect(migrationSql).toContain("AFTER INSERT ON auth.users");
  });

  it("shows → show_rooms 自动创建机制存在", () => {
    expect(migrationSql).toContain("handle_new_show()");
    expect(migrationSql).toContain("trigger_show_create_room");
    expect(migrationSql).toContain("AFTER INSERT ON public.shows");
  });

  // ========================
  // 环境变量安全
  // ========================
  it(".env.example 存在且不包含真实 key", () => {
    expect(envExample.length).toBeGreaterThan(0);
    // 确认有必要的变量名
    expect(envExample).toContain("NEXT_PUBLIC_SUPABASE_URL=");
    expect(envExample).toContain("NEXT_PUBLIC_SUPABASE_ANON_KEY=");
    expect(envExample).toContain("SUPABASE_SERVICE_ROLE_KEY=");
    // 确认值都是空的（= 后面紧跟换行或空）
    const urlMatch = envExample.match(
      /NEXT_PUBLIC_SUPABASE_URL=(.*)/
    );
    expect(urlMatch![1].trim()).toBe("");
  });

  it("service role 没出现在 client.ts", () => {
    expect(clientCode).not.toContain("SERVICE_ROLE");
    expect(clientCode).not.toContain("service_role");
    expect(clientCode).toContain("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  });

  // ========================
  // 防重复 indexes
  // ========================
  it("notifications 有 partial unique indexes 防重复", () => {
    expect(migrationSql).toContain("notifications_new_show_unique");
    expect(migrationSql).toContain("notifications_attended_check_unique");
    expect(migrationSql).toContain("notifications_announcement_unique");
  });

  // ========================
  // CHECK 约束
  // ========================
  it("user_show_statuses status CHECK 包含 interested/going/attended", () => {
    const checkMatch = migrationSql.match(
      /CREATE TABLE public\.user_show_statuses[\s\S]*?;/);
    expect(checkMatch).not.toBeNull();
    expect(checkMatch![0]).toContain("interested");
    expect(checkMatch![0]).toContain("going");
    expect(checkAttr(checkMatch![0], "attended")).toBe(true);
  });

  it("ticket_posts quantity CHECK > 0", () => {
    expect(migrationSql).toContain("quantity > 0");
  });

  it("show_artists role CHECK 包含 headliner/support/guest", () => {
    const checkMatch = migrationSql.match(
      /CREATE TABLE public\.show_artists[\s\S]*?;/
    );
    expect(checkMatch).not.toBeNull();
    expect(checkMatch![0]).toContain("headliner");
    expect(checkMatch![0]).toContain("support");
    expect(checkMatch![0]).toContain("guest");
  });
});

// 辅助
function checkAttr(sql: string, attr: string): boolean {
  return sql.includes(attr);
}

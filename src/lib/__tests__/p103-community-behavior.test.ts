/**
 * P10.3 行为测试 - 社区内容系统 Supabase 迁移
 *
 * 覆盖：
 * A. API contract 保持（buddyPosts / ticketPosts / livePosts 签名不变）
 * B. Supabase 路径（mock Supabase client 验证 DB 调用）
 * C. Mock fallback 路径（Supabase 未配置时返回 mock 数据）
 * D. UI 不直接访问 Supabase
 * E. 用户只能删除自己的内容（RLS 兜底 + fallback 校验）
 * F. 类型 adapter 正确
 * G. database.types.ts 覆盖
 * H. UI 页面不直接 import mocks（rooms/page.tsx 架构修复）
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import * as fs from "fs";
import * as path from "path";

// ============
// helpers
// ============

function read(relPath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relPath), "utf-8");
}

// ============
// Mock Supabase client 工厂（参考 p102d 测试模式）
// ============

function createMockSupabaseClient(overrides: {
  buddyPosts?: unknown[];
  buddyComments?: unknown[];
  ticketPosts?: unknown[];
  ticketComments?: unknown[];
  livePosts?: unknown[];
  inserted?: unknown;
} = {}) {
  const tables: Record<string, unknown[]> = {
    buddy_posts: overrides.buddyPosts ?? [],
    buddy_post_comments: overrides.buddyComments ?? [],
    ticket_posts: overrides.ticketPosts ?? [],
    ticket_post_comments: overrides.ticketComments ?? [],
    live_posts: overrides.livePosts ?? [],
  };

  const chainable = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockReturnThis(),
    upsert: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    filter: vi.fn().mockReturnThis(),
  };

  const from = vi.fn((table: string) => {
    const tableData = tables[table] ?? [];

    const builder = {
      ...chainable,
      // 终端方法（用于 select 列表查询）
      then: vi.fn((resolve: (val: unknown) => void) => {
        resolve({ data: tableData, error: null });
        return Promise.resolve({ data: tableData, error: null });
      }),
    };

    // 链式 order() 后的终端
    builder.order = vi.fn(() => ({
      then: vi.fn((resolve: (val: unknown) => void) => {
        resolve({ data: tableData, error: null });
        return Promise.resolve({ data: tableData, error: null });
      }),
    }));

    // single() 返回第一条或 null
    builder.single = vi.fn(() => ({
      then: vi.fn((resolve: (val: unknown) => void) => {
        resolve({ data: overrides.inserted ?? tableData[0] ?? null, error: null });
        return Promise.resolve({
          data: overrides.inserted ?? tableData[0] ?? null,
          error: null,
        });
      }),
    }));

    // insert().select().single()
    builder.insert = vi.fn(() => ({
      ...chainable,
      select: vi.fn(() => ({
        single: vi.fn(() => ({
          then: vi.fn((resolve: (val: unknown) => void) => {
            resolve({ data: overrides.inserted ?? tableData[0] ?? null, error: null });
            return Promise.resolve({
              data: overrides.inserted ?? tableData[0] ?? null,
              error: null,
            });
          }),
        })),
      })),
    }));

    // update().eq().eq().select().single()
    builder.update = vi.fn(() => ({
      ...chainable,
      eq: vi.fn().mockReturnThis(),
      select: vi.fn(() => ({
        single: vi.fn(() => ({
          then: vi.fn((resolve: (val: unknown) => void) => {
            resolve({ data: overrides.inserted ?? tableData[0] ?? null, error: null });
            return Promise.resolve({
              data: overrides.inserted ?? tableData[0] ?? null,
              error: null,
            });
          }),
        })),
      })),
    }));

    // delete().eq().eq() 终端
    builder.delete = vi.fn(() => ({
      ...chainable,
      eq: vi.fn(() => ({
        ...chainable,
        eq: vi.fn(() => ({
          then: vi.fn((resolve: (val: unknown) => void) => {
            resolve({ error: null });
            return Promise.resolve({ error: null });
          }),
        })),
      })),
    }));

    return builder;
  });

  return { from };
}

// ============
// A. API contract 保持
// ============

describe("P10.3 A — API contract 保持", () => {
  it("buddyPosts 签名保持：getBuddyPosts(showId) => Promise<BuddyPost[]>", async () => {
    const { getBuddyPosts } = await import("@/lib/api/posts/buddyPosts");
    const list = await getBuddyPosts("show-4");
    expect(Array.isArray(list)).toBe(true);
    list.forEach((p) => expect(p.show_id).toBe("show-4"));
  });

  it("buddyPosts 签名保持：createBuddyPost(showId, userId, input) => Promise<BuddyPost>", async () => {
    const { createBuddyPost } = await import("@/lib/api/posts/buddyPosts");
    const post = await createBuddyPost("show-4", "user-1", {
      content: "P10.3 测试",
      tags: ["一起看演出"],
    });
    expect(post.show_id).toBe("show-4");
    expect(post.user_id).toBe("user-1");
    expect(post.content).toBe("P10.3 测试");
  });

  it("buddyPosts 签名保持：deleteBuddyPost(postId, userId) => Promise<void>", async () => {
    const { deleteBuddyPost } = await import("@/lib/api/posts/buddyPosts");
    const result = await deleteBuddyPost("bp-1", "user-1");
    expect(result).toBeUndefined();
  });

  it("buddyPosts 签名保持：getBuddyPostComments(postId) => Promise<BuddyPostComment[]>", async () => {
    const { getBuddyPostComments } = await import("@/lib/api/posts/buddyPosts");
    const list = await getBuddyPostComments("bp-1");
    expect(Array.isArray(list)).toBe(true);
  });

  it("buddyPosts 签名保持：replyBuddyPost(postId, userId, content) => Promise<BuddyPostComment>", async () => {
    const { replyBuddyPost } = await import("@/lib/api/posts/buddyPosts");
    const comment = await replyBuddyPost("bp-2", "user-1", "P10.3 回复");
    expect(comment.buddy_post_id).toBe("bp-2");
    expect(comment.user_id).toBe("user-1");
    expect(comment.content).toBe("P10.3 回复");
  });

  it("ticketPosts 签名保持：getTicketPosts(showId, type?) => Promise<TicketPost[]>", async () => {
    const { getTicketPosts } = await import("@/lib/api/posts/ticketPosts");
    const list = await getTicketPosts("show-4");
    expect(Array.isArray(list)).toBe(true);
  });

  it("ticketPosts 签名保持：createTicketPost + updateTicketPostStatus + deleteTicketPost", async () => {
    const {
      createTicketPost,
      updateTicketPostStatus,
      deleteTicketPost,
    } = await import("@/lib/api/posts/ticketPosts");
    const { TicketPostType, TicketPostStatus } = await import("@/lib/types");

    const post = await createTicketPost("show-4", "user-1", {
      type: TicketPostType.SELLING,
      quantity: 1,
      faceValue: 100,
      price: 100,
    });
    expect(post.user_id).toBe("user-1");

    const updated = await updateTicketPostStatus(
      post.id,
      "user-1",
      TicketPostStatus.COMPLETED
    );
    expect(updated.status).toBe(TicketPostStatus.COMPLETED);

    await deleteTicketPost(post.id, "user-1");
  });

  it("ticketPosts 签名保持：getTicketPostComments + replyTicketPost", async () => {
    const { getTicketPostComments, replyTicketPost } = await import(
      "@/lib/api/posts/ticketPosts"
    );
    const list = await getTicketPostComments("tp-1");
    expect(Array.isArray(list)).toBe(true);

    const comment = await replyTicketPost("tp-1", "user-1", "P10.3 票务回复");
    expect(comment.ticket_post_id).toBe("tp-1");
    expect(comment.user_id).toBe("user-1");
  });

  it("livePosts 签名保持：getLivePosts + createLivePost + deleteLivePost", async () => {
    const { getLivePosts, createLivePost, deleteLivePost } = await import(
      "@/lib/api/posts/livePosts"
    );
    const list = await getLivePosts("show-1");
    expect(Array.isArray(list)).toBe(true);

    const post = await createLivePost("show-1", "user-1", {
      content: "P10.3 现场帖",
      imageUrls: ["https://example.com/a.jpg"],
    });
    expect(post.user_id).toBe("user-1");

    await deleteLivePost(post.id, "user-1");
  });

  it("livePosts 纯函数 detectVideoPlatform / getVideoPlatformLabel 保持", async () => {
    const { detectVideoPlatform, getVideoPlatformLabel } = await import(
      "@/lib/api/posts/livePosts"
    );
    const { VideoPlatform } = await import("@/lib/types");
    expect(detectVideoPlatform("https://www.bilibili.com/x")).toBe(
      VideoPlatform.BILIBILI
    );
    expect(getVideoPlatformLabel(VideoPlatform.BILIBILI)).toBe("B站");
  });
});

// ============
// B. Supabase 路径
// ============

describe("P10.3 B — Supabase 路径", () => {
  beforeEach(() => {
    vi.resetModules();
    // 配置 Supabase 环境变量
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";
  });

  afterEach(() => {
    // 清理环境变量
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    vi.restoreAllMocks();
  });

  it("buddyPosts 文件引用 Supabase helpers", () => {
    const content = read("src/lib/api/posts/buddyPosts.ts");
    expect(content).toContain('from "@/lib/supabase/publicData"');
    expect(content).toContain("buddyPostsFrom");
    expect(content).toContain("buddyPostCommentsFrom");
    expect(content).toContain("isBehaviorSupabaseEnabled");
  });

  it("ticketPosts 文件引用 Supabase helpers", () => {
    const content = read("src/lib/api/posts/ticketPosts.ts");
    expect(content).toContain('from "@/lib/supabase/publicData"');
    expect(content).toContain("ticketPostsFrom");
    expect(content).toContain("ticketPostCommentsFrom");
    expect(content).toContain("isBehaviorSupabaseEnabled");
  });

  it("livePosts 文件引用 Supabase helpers", () => {
    const content = read("src/lib/api/posts/livePosts.ts");
    expect(content).toContain('from "@/lib/supabase/publicData"');
    expect(content).toContain("livePostsFrom");
    expect(content).toContain("isBehaviorSupabaseEnabled");
  });

  it("buddyPosts getBuddyPosts 调用 buddyPostsFrom().select()", async () => {
    const mockClient = createMockSupabaseClient({
      buddyPosts: [
        {
          id: "bp-test",
          show_id: "show-4",
          user_id: "user-1",
          content: "test",
          tags: ["一起看演出"],
          created_at: "2026-08-01T00:00:00Z",
        },
      ],
    });
    vi.doMock("@/lib/supabase/client", () => ({
      createClient: () => mockClient,
    }));

    const { getBuddyPosts } = await import("@/lib/api/posts/buddyPosts");
    const list = await getBuddyPosts("show-4");
    expect(list.length).toBe(1);
    expect(list[0].id).toBe("bp-test");
    expect(list[0].tags).toEqual(["一起看演出"]);
    expect(mockClient.from).toHaveBeenCalledWith("buddy_posts");
  });

  it("ticketPosts createTicketPost 调用 ticketPostsFrom().insert()", async () => {
    const insertedRow = {
      id: "tp-new",
      show_id: "show-4",
      user_id: "user-1",
      type: "selling",
      quantity: 1,
      face_value: 100,
      price: 100,
      note: null,
      status: "active",
      created_at: "2026-08-01T00:00:00Z",
      updated_at: "2026-08-01T00:00:00Z",
    };
    const mockClient = createMockSupabaseClient({ inserted: insertedRow });
    vi.doMock("@/lib/supabase/client", () => ({
      createClient: () => mockClient,
    }));

    const { createTicketPost } = await import("@/lib/api/posts/ticketPosts");
    const { TicketPostType } = await import("@/lib/types");
    const post = await createTicketPost("show-4", "user-1", {
      type: TicketPostType.SELLING,
      quantity: 1,
      faceValue: 100,
      price: 100,
    });
    expect(post.id).toBe("tp-new");
    expect(post.type).toBe(TicketPostType.SELLING);
    expect(mockClient.from).toHaveBeenCalledWith("ticket_posts");
  });

  it("livePosts deleteLivePost 调用 livePostsFrom().delete().eq(user_id)", async () => {
    const mockClient = createMockSupabaseClient({});
    vi.doMock("@/lib/supabase/client", () => ({
      createClient: () => mockClient,
    }));

    const { deleteLivePost } = await import("@/lib/api/posts/livePosts");
    await deleteLivePost("lp-1", "user-1");
    expect(mockClient.from).toHaveBeenCalledWith("live_posts");
  });

  it("buddyPosts replyBuddyPost 调用 buddyPostCommentsFrom().insert()", async () => {
    const insertedComment = {
      id: "bpc-new",
      buddy_post_id: "bp-1",
      user_id: "user-1",
      content: "supabase reply",
      created_at: "2026-08-01T00:00:00Z",
    };
    const mockClient = createMockSupabaseClient({ inserted: insertedComment });
    vi.doMock("@/lib/supabase/client", () => ({
      createClient: () => mockClient,
    }));

    const { replyBuddyPost } = await import("@/lib/api/posts/buddyPosts");
    const comment = await replyBuddyPost("bp-1", "user-1", "supabase reply");
    expect(comment.id).toBe("bpc-new");
    expect(comment.buddy_post_id).toBe("bp-1");
    expect(mockClient.from).toHaveBeenCalledWith("buddy_post_comments");
  });
});

// ============
// C. Mock fallback 路径
// ============

describe("P10.3 C — Mock fallback 路径", () => {
  beforeEach(() => {
    // 确保未配置 Supabase
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    vi.resetModules();
  });

  it("buddyPosts 包含 mockBuddyPosts fallback", () => {
    const content = read("src/lib/api/posts/buddyPosts.ts");
    expect(content).toContain("mockBuddyPosts");
    expect(content).toContain("isBehaviorSupabaseEnabled");
  });

  it("ticketPosts 包含 mockTicketPosts fallback", () => {
    const content = read("src/lib/api/posts/ticketPosts.ts");
    expect(content).toContain("mockTicketPosts");
    expect(content).toContain("isBehaviorSupabaseEnabled");
  });

  it("livePosts 包含 mockLivePosts fallback", () => {
    const content = read("src/lib/api/posts/livePosts.ts");
    expect(content).toContain("mockLivePosts");
    expect(content).toContain("isBehaviorSupabaseEnabled");
  });

  it("Supabase 未配置时 getBuddyPosts 走 mock 返回数据", async () => {
    const { getBuddyPosts } = await import("@/lib/api/posts/buddyPosts");
    const list = await getBuddyPosts("show-4");
    expect(list.length).toBeGreaterThan(0);
    list.forEach((p) => expect(p.show_id).toBe("show-4"));
  });

  it("Supabase 未配置时 getTicketPosts 走 mock 返回数据", async () => {
    const { getTicketPosts } = await import("@/lib/api/posts/ticketPosts");
    const list = await getTicketPosts("show-4");
    expect(list.length).toBeGreaterThan(0);
  });

  it("Supabase 未配置时 getLivePosts 走 mock 返回数据", async () => {
    const { getLivePosts } = await import("@/lib/api/posts/livePosts");
    const list = await getLivePosts("show-1");
    expect(list.length).toBeGreaterThan(0);
  });

  it("Supabase 未配置时 createBuddyPost 校验 ghost 用户被拒绝", async () => {
    const { createBuddyPost } = await import("@/lib/api/posts/buddyPosts");
    await expect(
      createBuddyPost("show-4", "ghost-nonexistent", {
        content: "x",
        tags: [],
      })
    ).rejects.toThrow();
  });

  it("Supabase 未配置时 createTicketPost 校验 ghost 用户被拒绝", async () => {
    const { createTicketPost } = await import("@/lib/api/posts/ticketPosts");
    const { TicketPostType } = await import("@/lib/types");
    await expect(
      createTicketPost("show-4", "ghost-nonexistent", {
        type: TicketPostType.SELLING,
        quantity: 1,
        faceValue: 100,
        price: 100,
      })
    ).rejects.toThrow();
  });

  it("Supabase 未配置时 createLivePost 校验 ghost 用户被拒绝", async () => {
    const { createLivePost } = await import("@/lib/api/posts/livePosts");
    await expect(
      createLivePost("show-4", "ghost-nonexistent", {
        content: "x",
        imageUrls: [],
      })
    ).rejects.toThrow();
  });

  it("Supabase 未配置时 getBuddyPostComments 走 mock 返回数据", async () => {
    const { getBuddyPostComments } = await import("@/lib/api/posts/buddyPosts");
    const list = await getBuddyPostComments("bp-1");
    expect(list.length).toBeGreaterThan(0);
  });

  it("Supabase 未配置时 getTicketPostComments 走 mock 返回数据", async () => {
    const { getTicketPostComments } = await import("@/lib/api/posts/ticketPosts");
    const list = await getTicketPostComments("tp-1");
    expect(list.length).toBeGreaterThan(0);
  });
});

// ============
// D. UI 不直接访问 Supabase
// ============

describe("P10.3 D — UI 不直接访问 Supabase", () => {
  it("BuddyTab 不直接 import supabase client", () => {
    const content = read("src/components/room/BuddyTab.tsx");
    expect(content).not.toContain('from "@/lib/supabase/client"');
    expect(content).not.toContain('from "@/lib/supabase/server"');
    expect(content).not.toContain('from "@/lib/supabase/publicData"');
  });

  it("TicketTab 不直接 import supabase client", () => {
    const content = read("src/components/room/TicketTab.tsx");
    expect(content).not.toContain('from "@/lib/supabase/client"');
    expect(content).not.toContain('from "@/lib/supabase/server"');
    expect(content).not.toContain('from "@/lib/supabase/publicData"');
  });

  it("LiveTab 不直接 import supabase client", () => {
    const content = read("src/components/room/LiveTab.tsx");
    expect(content).not.toContain('from "@/lib/supabase/client"');
    expect(content).not.toContain('from "@/lib/supabase/server"');
    expect(content).not.toContain('from "@/lib/supabase/publicData"');
  });

  it("BuddyTab 通过 API 层调用 buddyPosts", () => {
    const content = read("src/components/room/BuddyTab.tsx");
    expect(content).toContain('from "@/lib/api/posts/buddyPosts"');
  });

  it("TicketTab 通过 API 层调用 ticketPosts", () => {
    const content = read("src/components/room/TicketTab.tsx");
    expect(content).toContain('from "@/lib/api/posts/ticketPosts"');
  });

  it("LiveTab 通过 API 层调用 livePosts", () => {
    const content = read("src/components/room/LiveTab.tsx");
    expect(content).toContain('from "@/lib/api/posts/livePosts"');
  });

  it("UI 组件不直接 import @/mocks", () => {
    const files = [
      "src/components/room/BuddyTab.tsx",
      "src/components/room/TicketTab.tsx",
      "src/components/room/LiveTab.tsx",
      "src/components/room/DiscussionTab.tsx",
      "src/components/room/LivePostModal.tsx",
      "src/components/room/VideoLinkCard.tsx",
    ];
    for (const f of files) {
      const content = read(f);
      expect(content).not.toContain('from "@/mocks/');
    }
  });
});

// ============
// E. 用户只能删除自己的内容
// ============

describe("P10.3 E — 用户只能删除自己的内容", () => {
  beforeEach(() => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    vi.resetModules();
  });

  it("deleteBuddyPost 非作者被拒绝（fallback 路径）", async () => {
    const { getBuddyPosts, deleteBuddyPost } = await import(
      "@/lib/api/posts/buddyPosts"
    );
    const list = await getBuddyPosts("show-4");
    const others = list.find((p) => p.user_id !== "user-3");
    expect(others).toBeDefined();
    await expect(deleteBuddyPost(others!.id, "user-3")).rejects.toThrow();
  });

  it("deleteBuddyPost ghost 用户被拒绝", async () => {
    const { getBuddyPosts, deleteBuddyPost } = await import(
      "@/lib/api/posts/buddyPosts"
    );
    const list = await getBuddyPosts("show-4");
    await expect(deleteBuddyPost(list[0].id, "ghost-nonexistent")).rejects.toThrow();
  });

  it("deleteTicketPost 非作者被拒绝（fallback 路径）", async () => {
    const { getTicketPosts, deleteTicketPost } = await import(
      "@/lib/api/posts/ticketPosts"
    );
    const list = await getTicketPosts("show-4");
    const others = list.find((p) => p.user_id !== "user-3");
    expect(others).toBeDefined();
    await expect(deleteTicketPost(others!.id, "user-3")).rejects.toThrow();
  });

  it("deleteTicketPost ghost 用户被拒绝", async () => {
    const { getTicketPosts, deleteTicketPost } = await import(
      "@/lib/api/posts/ticketPosts"
    );
    const list = await getTicketPosts("show-4");
    await expect(deleteTicketPost(list[0].id, "ghost-nonexistent")).rejects.toThrow();
  });

  it("deleteLivePost 非作者被拒绝（fallback 路径）", async () => {
    const { getLivePosts, deleteLivePost } = await import(
      "@/lib/api/posts/livePosts"
    );
    const list = await getLivePosts("show-1");
    const others = list.find((p) => p.user_id !== "user-3");
    expect(others).toBeDefined();
    await expect(deleteLivePost(others!.id, "user-3")).rejects.toThrow();
  });

  it("deleteLivePost ghost 用户被拒绝", async () => {
    const { getLivePosts, deleteLivePost } = await import(
      "@/lib/api/posts/livePosts"
    );
    const list = await getLivePosts("show-1");
    await expect(deleteLivePost(list[0].id, "ghost-nonexistent")).rejects.toThrow();
  });

  it("updateTicketPostStatus 非作者被拒绝（fallback 路径）", async () => {
    const { getTicketPosts, updateTicketPostStatus } = await import(
      "@/lib/api/posts/ticketPosts"
    );
    const { TicketPostStatus } = await import("@/lib/types");
    const list = await getTicketPosts("show-4");
    const others = list.find((p) => p.user_id !== "user-3");
    expect(others).toBeDefined();
    await expect(
      updateTicketPostStatus(others!.id, "user-3", TicketPostStatus.COMPLETED)
    ).rejects.toThrow();
  });

  it("Supabase 路径 DELETE 显式 eq user_id（不绕过 RLS）", () => {
    const buddyContent = read("src/lib/api/posts/buddyPosts.ts");
    expect(buddyContent).toMatch(/\.delete\(\)[\s\S]*?\.eq\("id"[\s\S]*?\.eq\("user_id"/);

    const ticketContent = read("src/lib/api/posts/ticketPosts.ts");
    expect(ticketContent).toMatch(/\.delete\(\)[\s\S]*?\.eq\("id"[\s\S]*?\.eq\("user_id"/);

    const liveContent = read("src/lib/api/posts/livePosts.ts");
    expect(liveContent).toMatch(/\.delete\(\)[\s\S]*?\.eq\("id"[\s\S]*?\.eq\("user_id"/);
  });

  it("Supabase 路径 UPDATE 显式 eq user_id（不绕过 RLS）", () => {
    const ticketContent = read("src/lib/api/posts/ticketPosts.ts");
    expect(ticketContent).toMatch(/\.update\(\{ status[\s\S]*?\.eq\("id"[\s\S]*?\.eq\("user_id"/);
  });
});

// ============
// F. 类型 adapter 正确
// ============

describe("P10.3 F — 类型 adapter 正确", () => {
  it("buddyPostRowToBuddyPost 正确映射 DB Row → BuddyPost", async () => {
    const { buddyPostRowToBuddyPost } = await import("@/lib/supabase/publicData");
    const row = {
      id: "bp-1",
      show_id: "show-4",
      user_id: "user-1",
      content: "test content",
      tags: ["一起看演出", "吃饭"],
      created_at: "2026-08-01T00:00:00Z",
    };
    const post = buddyPostRowToBuddyPost(row as never);
    expect(post.id).toBe("bp-1");
    expect(post.show_id).toBe("show-4");
    expect(post.user_id).toBe("user-1");
    expect(post.content).toBe("test content");
    expect(post.tags).toEqual(["一起看演出", "吃饭"]);
    expect(post.created_at).toBe("2026-08-01T00:00:00Z");
  });

  it("buddyPostRowToBuddyPost tags null → []", async () => {
    const { buddyPostRowToBuddyPost } = await import("@/lib/supabase/publicData");
    const row = {
      id: "bp-1",
      show_id: "show-4",
      user_id: "user-1",
      content: "test",
      tags: null,
      created_at: "2026-08-01T00:00:00Z",
    };
    const post = buddyPostRowToBuddyPost(row as never);
    expect(post.tags).toEqual([]);
  });

  it("buddyPostCommentRowToBuddyPostComment 正确映射", async () => {
    const { buddyPostCommentRowToBuddyPostComment } = await import(
      "@/lib/supabase/publicData"
    );
    const row = {
      id: "bpc-1",
      buddy_post_id: "bp-1",
      user_id: "user-1",
      content: "comment",
      created_at: "2026-08-01T00:00:00Z",
    };
    const c = buddyPostCommentRowToBuddyPostComment(row as never);
    expect(c.id).toBe("bpc-1");
    expect(c.buddy_post_id).toBe("bp-1");
    expect(c.user_id).toBe("user-1");
    expect(c.content).toBe("comment");
  });

  it("ticketPostRowToTicketPost 正确映射 type/status 枚举", async () => {
    const { ticketPostRowToTicketPost } = await import("@/lib/supabase/publicData");
    const { TicketPostType, TicketPostStatus } = await import("@/lib/types");
    const row = {
      id: "tp-1",
      show_id: "show-4",
      user_id: "user-1",
      type: "selling",
      quantity: 2,
      face_value: 100,
      price: 100,
      note: "原价转",
      status: "active",
      created_at: "2026-08-01T00:00:00Z",
      updated_at: "2026-08-02T00:00:00Z",
    };
    const post = ticketPostRowToTicketPost(row as never);
    expect(post.type).toBe(TicketPostType.SELLING);
    expect(post.status).toBe(TicketPostStatus.ACTIVE);
    expect(post.quantity).toBe(2);
    expect(post.face_value).toBe(100);
    expect(post.price).toBe(100);
    expect(post.note).toBe("原价转");
    expect(post.updated_at).toBe("2026-08-02T00:00:00Z");
  });

  it("ticketPostRowToTicketPost null → undefined", async () => {
    const { ticketPostRowToTicketPost } = await import("@/lib/supabase/publicData");
    const row = {
      id: "tp-1",
      show_id: "show-4",
      user_id: "user-1",
      type: "buying",
      quantity: 1,
      face_value: null,
      price: null,
      note: null,
      status: "active",
      created_at: "2026-08-01T00:00:00Z",
      updated_at: null,
    };
    const post = ticketPostRowToTicketPost(row as never);
    expect(post.face_value).toBeUndefined();
    expect(post.price).toBeUndefined();
    expect(post.note).toBeUndefined();
    expect(post.updated_at).toBeUndefined();
  });

  it("ticketPostCommentRowToTicketPostComment 正确映射", async () => {
    const { ticketPostCommentRowToTicketPostComment } = await import(
      "@/lib/supabase/publicData"
    );
    const row = {
      id: "tpc-1",
      ticket_post_id: "tp-1",
      user_id: "user-1",
      content: "comment",
      created_at: "2026-08-01T00:00:00Z",
    };
    const c = ticketPostCommentRowToTicketPostComment(row as never);
    expect(c.id).toBe("tpc-1");
    expect(c.ticket_post_id).toBe("tp-1");
  });

  it("livePostRowToLivePost 正确映射", async () => {
    const { livePostRowToLivePost } = await import("@/lib/supabase/publicData");
    const { VideoPlatform } = await import("@/lib/types");
    const row = {
      id: "lp-1",
      show_id: "show-1",
      user_id: "user-1",
      content: "现场帖",
      image_urls: ["https://example.com/1.jpg", "https://example.com/2.jpg"],
      video_url: "https://www.bilibili.com/x",
      video_platform: "bilibili",
      created_at: "2026-08-01T00:00:00Z",
    };
    const post = livePostRowToLivePost(row as never);
    expect(post.id).toBe("lp-1");
    expect(post.content).toBe("现场帖");
    expect(post.image_urls).toHaveLength(2);
    expect(post.video_url).toBe("https://www.bilibili.com/x");
    expect(post.video_platform).toBe(VideoPlatform.BILIBILI);
  });

  it("livePostRowToLivePost null 字段 → undefined / []", async () => {
    const { livePostRowToLivePost } = await import("@/lib/supabase/publicData");
    const row = {
      id: "lp-1",
      show_id: "show-1",
      user_id: "user-1",
      content: null,
      image_urls: null,
      video_url: null,
      video_platform: null,
      created_at: "2026-08-01T00:00:00Z",
    };
    const post = livePostRowToLivePost(row as never);
    expect(post.content).toBeUndefined();
    expect(post.image_urls).toEqual([]);
    expect(post.video_url).toBeUndefined();
    expect(post.video_platform).toBeUndefined();
  });

  it("publicData.ts 导出 posts/comments helpers", () => {
    const content = read("src/lib/supabase/publicData.ts");
    expect(content).toContain("buddyPostsFrom");
    expect(content).toContain("buddyPostCommentsFrom");
    expect(content).toContain("ticketPostsFrom");
    expect(content).toContain("ticketPostCommentsFrom");
    expect(content).toContain("livePostsFrom");
    expect(content).toContain("buddyPostRowToBuddyPost");
    expect(content).toContain("buddyPostCommentRowToBuddyPostComment");
    expect(content).toContain("ticketPostRowToTicketPost");
    expect(content).toContain("ticketPostCommentRowToTicketPostComment");
    expect(content).toContain("livePostRowToLivePost");
  });
});

// ============
// G. database.types.ts 覆盖
// ============

describe("P10.3 G — database.types.ts 覆盖社区表", () => {
  it("buddy_posts 表类型存在", () => {
    const content = read("src/lib/supabase/database.types.ts");
    expect(content).toContain("buddy_posts:");
    expect(content).toMatch(/buddy_posts:\s*\{[\s\S]*?Row:/);
  });

  it("buddy_post_comments 表类型存在", () => {
    const content = read("src/lib/supabase/database.types.ts");
    expect(content).toContain("buddy_post_comments:");
  });

  it("ticket_posts 表类型存在", () => {
    const content = read("src/lib/supabase/database.types.ts");
    expect(content).toContain("ticket_posts:");
  });

  it("ticket_post_comments 表类型存在", () => {
    const content = read("src/lib/supabase/database.types.ts");
    expect(content).toContain("ticket_post_comments:");
  });

  it("live_posts 表类型存在", () => {
    const content = read("src/lib/supabase/database.types.ts");
    expect(content).toContain("live_posts:");
  });

  it("buddy_posts Row 包含 id/show_id/user_id/content/tags/created_at", () => {
    const content = read("src/lib/supabase/database.types.ts");
    const idx = content.indexOf("buddy_posts:");
    const block = content.slice(idx, idx + 500);
    expect(block).toContain("id: string");
    expect(block).toContain("show_id: string");
    expect(block).toContain("user_id: string");
    expect(block).toContain("content: string");
    expect(block).toContain("tags: string[]");
    expect(block).toContain("created_at: string");
  });

  it("ticket_posts Row 包含 type/quantity/face_value/price/status/updated_at", () => {
    const content = read("src/lib/supabase/database.types.ts");
    const idx = content.indexOf("ticket_posts:");
    const block = content.slice(idx, idx + 800);
    expect(block).toContain("type: string");
    expect(block).toContain("quantity: number");
    expect(block).toContain("face_value");
    expect(block).toContain("price");
    expect(block).toContain("status: string");
    expect(block).toContain("updated_at: string");
  });

  it("live_posts Row 包含 image_urls/video_url/video_platform", () => {
    const content = read("src/lib/supabase/database.types.ts");
    const idx = content.indexOf("live_posts:");
    const block = content.slice(idx, idx + 600);
    expect(block).toContain("image_urls: string[]");
    expect(block).toContain("video_url");
    expect(block).toContain("video_platform");
  });

  it("每张表都包含 Row/Insert/Update/Relationships", () => {
    const content = read("src/lib/supabase/database.types.ts");
    const tables = [
      "buddy_posts",
      "buddy_post_comments",
      "ticket_posts",
      "ticket_post_comments",
      "live_posts",
    ];
    for (const t of tables) {
      const idx = content.indexOf(`${t}:`);
      const block = content.slice(idx, idx + 1500);
      expect(block).toContain("Row:");
      expect(block).toContain("Insert:");
      expect(block).toContain("Update:");
      expect(block).toContain("Relationships:");
    }
  });
});

// ============
// H. UI 页面不直接 import mocks
// ============

describe("P10.3 H — UI 页面不直接 import mocks（rooms/page.tsx 架构修复）", () => {
  it("Rooms 页面不直接 import from @/mocks", () => {
    const content = read("src/app/rooms/page.tsx");
    expect(content).not.toContain('from "@/mocks/shows"');
    expect(content).not.toContain('from "@/mocks/artists"');
    expect(content).not.toContain('from "@/mocks/messages"');
    // 原直接 import 形式：`import { showMap, mockShowRooms } from "@/mocks/shows"`
    // 已通过上面 from "@/mocks/shows" 断言覆盖；不检查局部变量名 showMap
  });

  it("Rooms 页面通过 API 层获取数据", () => {
    const content = read("src/app/rooms/page.tsx");
    expect(content).toContain('getShowLookupMap');
    expect(content).toContain('getRoomsByUser');
    expect(content).toContain('from "@/lib/api/shows"');
    expect(content).toContain('from "@/lib/api/rooms"');
  });

  it("Rooms 页面不直接 import supabase", () => {
    const content = read("src/app/rooms/page.tsx");
    expect(content).not.toContain('from "@/lib/supabase/client"');
    expect(content).not.toContain('from "@/lib/supabase/server"');
    expect(content).not.toContain('from "@/lib/supabase/publicData"');
  });

  it("ShowDetail 页面不直接 import from @/mocks", () => {
    const content = read("src/app/show/[id]/page.tsx");
    expect(content).not.toContain('from "@/mocks/');
  });

  it("所有 app 路由页面不直接 import @/mocks", () => {
    const appPages = [
      "src/app/rooms/page.tsx",
      "src/app/profile/page.tsx",
      "src/app/show/[id]/page.tsx",
      "src/app/shows/page.tsx",
      "src/app/artists/page.tsx",
      "src/app/artist/[id]/page.tsx",
      "src/app/page.tsx",
      "src/app/notifications/page.tsx",
    ];
    for (const p of appPages) {
      if (fs.existsSync(path.join(process.cwd(), p))) {
        const content = read(p);
        expect(content).not.toContain('from "@/mocks/');
      }
    }
  });
});

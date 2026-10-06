/**
 * P5 现场分享互动回归测试 — 点赞 / 评论 / 分享链接 / 通知联动
 *
 * 覆盖：
 * A. 点赞（toggle 幂等、计数正确、刷新持久化、通知作者、自发不通知、登出清空）
 * B. 评论（创建、计数、通知作者、自发不通知、空内容拒绝、ghost 拒绝）
 * C. 分享链接（深链格式）
 *
 * 时钟：FixedDate 模式（livePosts 均为已结束场，不影响互动 mock）
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { useUserStore } from "@/lib/stores/useUserStore";
import {
  toggleLivePostLike,
  getLiveInteractionSummaries,
  getLivePostComments,
  createLivePostComment,
  buildLiveShareUrl,
} from "@/lib/api/liveInteractions";
import { NotificationType } from "@/lib/types";

const RealDate = Date;
const FIXED_NOW = new RealDate("2026-09-28T12:00:00+08:00").getTime();
class FixedDate extends RealDate {
  constructor(...args: unknown[]) {
    if (args.length === 0) {
      super(FIXED_NOW);
    } else {
      super(...(args as unknown as ConstructorParameters<typeof RealDate>));
    }
  }
  static now(): number {
    return FIXED_NOW;
  }
}
beforeEach(() => {
  (globalThis as { Date: unknown }).Date = FixedDate;
  useUserStore.getState().mockLogin(); // user-1
});
afterEach(() => {
  (globalThis as { Date: unknown }).Date = RealDate;
  useUserStore.getState().logout();
});

// ============================================================
// A. 点赞
// ============================================================

describe("现场帖点赞", () => {
  it("点赞他人帖子 → liked=true 且计数 +1；再点取消 → 计数 -1", async () => {
    // lp-4 是 user-4 的帖子，无种子赞
    const before = await getLiveInteractionSummaries(["lp-4"], "user-1");
    expect(before["lp-4"].likeCount).toBe(0);
    expect(before["lp-4"].likedByMe).toBe(false);

    const liked = await toggleLivePostLike("lp-4", "user-1");
    expect(liked.liked).toBe(true);
    expect(liked.likeCount).toBe(1);

    const unliked = await toggleLivePostLike("lp-4", "user-1");
    expect(unliked.liked).toBe(false);
    expect(unliked.likeCount).toBe(0);
  });

  it("种子赞计数排除当前用户，避免重复计数", async () => {
    // lp-1 有 3 个种子赞（含 user-1）。user-1 未点赞时应显示 2（排除自己）
    const s = await getLiveInteractionSummaries(["lp-1"], "user-1");
    expect(s["lp-1"].likeCount).toBe(2);
    expect(s["lp-1"].likedByMe).toBe(false);

    // user-1 点赞后 = 2（他人）+ 1（自己）= 3
    const r = await toggleLivePostLike("lp-1", "user-1");
    expect(r.likeCount).toBe(3);
  });

  it("点赞态写入 store（刷新持久化的数据源）", async () => {
    await toggleLivePostLike("lp-5", "user-1");
    expect(useUserStore.getState().likedLivePostIds).toContain("lp-5");
    await toggleLivePostLike("lp-5", "user-1");
    expect(useUserStore.getState().likedLivePostIds).not.toContain("lp-5");
  });

  it("登出后点赞态清空", async () => {
    await toggleLivePostLike("lp-5", "user-1");
    useUserStore.getState().logout();
    expect(useUserStore.getState().likedLivePostIds).toEqual([]);
  });

  it("点赞他人帖子 → 通知发给作者（作者未登录时不落入当前用户列表）", async () => {
    // user-1 点赞 user-4 的 lp-4 → recipient=user-4 未登录，当前用户（user-1）不应收到通知
    await toggleLivePostLike("lp-4", "user-1");
    const notifs = useUserStore.getState().notifications;
    expect(
      notifs.filter((n) => n.type === NotificationType.LIVE_INTERACTION)
    ).toHaveLength(0);
  });

  it("他人点赞我的帖子 → 我收到 LIVE_INTERACTION 通知（action=like）", async () => {
    // lp-8 是 user-1 的帖子；user-2 点赞 → recipient=user-1（当前已登录）→ 通知生成
    await toggleLivePostLike("lp-8", "user-2");
    const live = useUserStore
      .getState()
      .notifications.filter((n) => n.type === NotificationType.LIVE_INTERACTION);
    expect(live).toHaveLength(1);
    expect(live[0].title).toContain("点赞了你的现场分享");
    expect(live[0].target_url).toBe("/show/show-3?tab=live#room");
  });

  it("给自己的帖子点赞 → 不产生通知", async () => {
    // lp-8 是 user-1 自己的帖子
    await toggleLivePostLike("lp-8", "user-1");
    const notifs = useUserStore.getState().notifications;
    expect(
      notifs.filter((n) => n.type === NotificationType.LIVE_INTERACTION)
    ).toHaveLength(0);
  });

  it("不存在的帖子 → 抛错", async () => {
    await expect(toggleLivePostLike("lp-999", "user-1")).rejects.toThrow(
      "Post not found"
    );
  });
});

// ============================================================
// B. 评论
// ============================================================

describe("现场帖评论", () => {
  it("评论成功 → 计数 +1，内容正序返回", async () => {
    const before = await getLivePostComments("lp-5");
    expect(before).toHaveLength(0);

    await createLivePostComment("lp-5", "user-1", "氛围太棒了");
    const after = await getLivePostComments("lp-5");
    expect(after).toHaveLength(1);
    expect(after[0].content).toBe("氛围太棒了");
    expect(after[0].user_id).toBe("user-1");
  });

  it("评论计数反映在互动汇总里", async () => {
    await createLivePostComment("lp-7", "user-1", "赞");
    const s = await getLiveInteractionSummaries(["lp-7"], "user-1");
    expect(s["lp-7"].commentCount).toBe(1);
  });

  it("空评论 → 抛错", async () => {
    await expect(createLivePostComment("lp-5", "user-1", "   ")).rejects.toThrow(
      "评论内容不能为空"
    );
  });

  it("ghost 用户 → 抛错", async () => {
    await expect(
      createLivePostComment("lp-5", "ghost-user", "hi")
    ).rejects.toThrow("User not found");
  });

  it("评论他人帖子 → 作者收到 LIVE_INTERACTION 通知（action=comment）", async () => {
    // lp-8 是 user-1 的帖子；模拟 user-2 评论 → recipient=user-1（当前已登录）→ 通知应生成
    await createLivePostComment("lp-8", "user-2", "拍得真好");
    const notifs = useUserStore.getState().notifications;
    const live = notifs.filter(
      (n) => n.type === NotificationType.LIVE_INTERACTION
    );
    expect(live).toHaveLength(1);
    expect(live[0].title).toContain("评论了你的现场分享");
    expect(live[0].target_url).toBe("/show/show-3?tab=live#room");
  });

  it("评论自己的帖子 → 不产生通知", async () => {
    await createLivePostComment("lp-8", "user-1", "自己顶一下");
    const notifs = useUserStore.getState().notifications;
    expect(
      notifs.filter((n) => n.type === NotificationType.LIVE_INTERACTION)
    ).toHaveLength(0);
  });
});

// ============================================================
// C. 分享链接
// ============================================================

describe("现场分享链接", () => {
  it("深链格式：/show/{id}?tab=live#room", () => {
    expect(buildLiveShareUrl("show-1")).toBe("/show/show-1?tab=live#room");
  });
});

"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MapPin, MessageSquare } from "lucide-react";
import type { User } from "@/lib/types";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { useUserStore } from "@/lib/stores/useUserStore";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { useToast } from "@/components/ui/Toast";

interface PublicProfileClientProps {
  user: User;
}

/**
 * 最小用户主页（/u/[id]）
 * 只展示公开基础信息：头像 / 昵称 / 城市 / Bio。
 * 不展示手机号、微信、邮箱等任何隐私字段；不展示对方关注/演出清单。
 * 提供「私信」入口：当前复用交易消息私聊口径（站内私信通道待独立接入）。
 */
export function PublicProfileClient({ user }: PublicProfileClientProps) {
  const router = useRouter();
  const currentUser = useUserStore((s) => s.user);
  const requireAuth = useRequireAuth();
  const { showToast } = useToast();

  const isSelf = currentUser?.id === user.id;

  const handleMessage = () => {
    requireAuth(() => {
      // 站内私信通道待独立接入；当前给出明确反馈，不静默失败
      showToast(`私信「${user.display_name}」功能即将上线`, "info");
    });
  };

  return (
    <main className="container-gigroom py-8 md:py-12">
      <button
        onClick={() => router.back()}
        className="text-sm text-text-tertiary hover:text-text-primary mb-6 transition-colors"
      >
        ← 返回
      </button>

      <div className="max-w-2xl rounded-md border border-border bg-bg-secondary p-5 md:p-6">
        <div className="flex flex-col md:flex-row md:items-start gap-5">
          <Avatar
            src={user.avatar_url ?? null}
            alt={user.display_name}
            fallbackName={user.display_name}
            size="xl"
            shape="circle"
            className="shrink-0 mx-auto md:mx-0"
          />

          <div className="flex-1 min-w-0 text-center md:text-left">
            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
              <div className="min-w-0">
                <h1 className="text-h2 text-text-primary line-clamp-1">
                  {user.display_name}
                </h1>
                {user.city && (
                  <div className="mt-1 inline-flex items-center gap-1 text-sm text-text-tertiary">
                    <MapPin size={14} aria-hidden />
                    <span>{user.city}</span>
                  </div>
                )}
                {user.bio && (
                  <p className="mt-3 text-body text-text-secondary whitespace-pre-wrap line-clamp-3">
                    {user.bio}
                  </p>
                )}
              </div>

              {!isSelf && (
                <div className="shrink-0 flex justify-center md:justify-start">
                  <Button variant="primary" size="sm" onClick={handleMessage}>
                    <MessageSquare size={14} />
                    私信
                  </Button>
                </div>
              )}
            </div>

            {isSelf && (
              <div className="mt-4">
                <Link
                  href="/profile"
                  className="text-sm text-accent-lime hover:underline"
                >
                  这是我的主页，去编辑资料 →
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}

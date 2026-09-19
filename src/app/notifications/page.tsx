"use client";

import * as React from "react";
import { Bell } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { NotificationItem } from "@/components/notification/NotificationItem";
import { useUserStore } from "@/lib/stores/useUserStore";
import { useUIStore } from "@/lib/stores/useUIStore";
import { markAllNotificationsRead } from "@/lib/api/notifications";

export default function NotificationsPage() {
  const isLoggedIn = useUserStore((s) => s.isLoggedIn);
  const user = useUserStore((s) => s.user);
  const notifications = useUserStore((s) => s.notifications);
  const openLoginModal = useUIStore((s) => s.openLoginModal);

  // 派生：unreadCount（单一来源 → 派生，不另存）
  const unreadCount = React.useMemo(
    () => notifications.filter((n) => !n.is_read).length,
    [notifications]
  );

  // 按 created_at 倒序
  const sortedNotifications = React.useMemo(
    () => [...notifications].sort((a, b) => b.created_at.localeCompare(a.created_at)),
    [notifications]
  );

  const handleMarkAllRead = () => {
    if (!user) return;
    void markAllNotificationsRead(user.id);
  };

  // 未登录态
  if (!isLoggedIn || !user) {
    return (
      <main className="container-gigroom py-12">
        <h1 className="text-h1 mb-8 text-text-primary">通知</h1>
        <EmptyState
          icon={<Bell size={48} />}
          title="登录后查看通知"
          description="关注乐队和演出后，重要消息会出现在这里"
          action={{
            label: "登录",
            variant: "primary",
            onClick: openLoginModal,
          }}
          className="border border-border rounded-md bg-bg-secondary py-16"
        />
      </main>
    );
  }

  return (
    <main className="container-gigroom py-8 md:py-12">
      {/* 标题 + 全部已读 */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-h1 text-text-primary">通知</h1>
        {unreadCount > 0 && (
          <Button variant="ghost" size="sm" onClick={handleMarkAllRead}>
            全部标为已读
          </Button>
        )}
      </div>

      {sortedNotifications.length === 0 ? (
        <EmptyState
          icon={<Bell size={48} />}
          title="暂时没有新通知"
          description="关注乐队和演出后，重要消息会出现在这里"
          className="border border-border rounded-md bg-bg-secondary py-16"
        />
      ) : (
        <div className="rounded-md border border-border overflow-hidden bg-bg-primary">
          {sortedNotifications.map((n) => (
            <NotificationItem key={n.id} notification={n} />
          ))}
        </div>
      )}
    </main>
  );
}

"use client";

import * as React from "react";
import { MapPin, LogOut } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { useUIStore } from "@/lib/stores/useUIStore";
import { useLogout } from "@/hooks/useLogout";
import type { User } from "@/lib/types";

interface ProfileHeaderProps {
  user: User;
  followedCount: number;
  attendedCount: number;
}

/**
 * ProfileHeader（P8）
 * 显示：头像、用户名、城市、Bio、统计（喜欢的乐队数、去过的现场数）、编辑资料按钮
 * 统计直接从 props 传入（由 Profile 页面从 store 派生后再传入）
 */
export function ProfileHeader({ user, followedCount, attendedCount }: ProfileHeaderProps) {
  const openEditProfileModal = useUIStore((s) => s.openEditProfileModal);
  const handleLogout = useLogout();

  return (
    <div className="rounded-md border border-border bg-bg-secondary p-5 md:p-6">
      <div className="flex flex-col md:flex-row md:items-start gap-5">
        {/* 头像 */}
        <Avatar
          src={user.avatar_url ?? null}
          alt={user.display_name}
          fallbackName={user.display_name}
          size="xl"
          shape="circle"
          className="shrink-0 mx-auto md:mx-0"
        />

        {/* 信息区 */}
        <div className="flex-1 min-w-0 text-center md:text-left">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
            <div className="min-w-0">
              {/* 用户名 */}
              <h2 className="text-h2 text-text-primary line-clamp-1">
                {user.display_name}
              </h2>

              {/* 城市 */}
              {user.city && (
                <div className="mt-1 inline-flex items-center gap-1 text-sm text-text-tertiary">
                  <MapPin size={14} aria-hidden />
                  <span>{user.city}</span>
                </div>
              )}

              {/* Bio */}
              {user.bio && (
                <p className="mt-3 text-body text-text-secondary whitespace-pre-wrap line-clamp-3">
                  {user.bio}
                </p>
              )}
            </div>

            {/* 操作按钮 */}
            <div className="flex gap-2 justify-center md:justify-start shrink-0">
              <Button variant="secondary" size="sm" onClick={openEditProfileModal}>
                编辑资料
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleLogout}
                aria-label="退出登录"
                title="退出登录"
              >
                <LogOut size={16} />
                <span className="hidden sm:inline">退出</span>
              </Button>
            </div>
          </div>

          {/* 统计 */}
          <div className="mt-5 flex items-center justify-center md:justify-start gap-6 border-t border-border pt-4">
            <div className="text-center">
              <div className="text-h3 font-bold text-text-primary">
                {followedCount}
              </div>
              <div className="text-xs text-text-tertiary mt-0.5">
                喜欢的乐队
              </div>
            </div>
            <div className="w-px h-8 bg-border" aria-hidden />
            <div className="text-center">
              <div className="text-h3 font-bold text-text-primary">
                {attendedCount}
              </div>
              <div className="text-xs text-text-tertiary mt-0.5">
                去过的演出
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

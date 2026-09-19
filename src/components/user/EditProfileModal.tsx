"use client";

import * as React from "react";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Select, SelectOption } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Avatar";
import { useUIStore } from "@/lib/stores/useUIStore";
import { useUserStore } from "@/lib/stores/useUserStore";
import { CITIES } from "@/lib/constants";
import { updateProfile } from "@/lib/api/profile";
import { useToast } from "@/components/ui/Toast";

/**
 * EditProfileModal（P8）
 * 字段：头像（URL 输入）、用户名、城市（Select 从 CITIES 选）、Bio
 * 校验：用户名不能为空；保存后 updateUser，Zustand persist 自动持久化
 * 保存后关闭 Modal；ProfileHeader 和 TopNav 从 user store 响应式更新
 */
export function EditProfileModal() {
  const isOpen = useUIStore((s) => s.isEditProfileModalOpen);
  const closeModal = useUIStore((s) => s.closeEditProfileModal);
  const user = useUserStore((s) => s.user);
  const updateUser = useUserStore((s) => s.updateUser);
  const { showToast } = useToast();

  const [avatarUrl, setAvatarUrl] = React.useState("");
  const [displayName, setDisplayName] = React.useState("");
  const [city, setCity] = React.useState("");
  const [bio, setBio] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // 打开时初始化字段
  React.useEffect(() => {
    if (isOpen && user) {
      setAvatarUrl(user.avatar_url ?? "");
      setDisplayName(user.display_name ?? "");
      setCity(user.city ?? "");
      setBio(user.bio ?? "");
      setError(null);
      setSaving(false);
    }
  }, [isOpen, user]);

  const cityOptions: SelectOption[] = React.useMemo(
    () => CITIES.map((c) => ({ value: c, label: c })),
    []
  );

  const canSave = React.useMemo(() => {
    return displayName.trim().length > 0;
  }, [displayName]);

  const handleSave = async () => {
    if (!canSave || !user) return;
    setError(null);
    setSaving(true);
    try {
      // P10.1: 写入 profiles 表
      const updatedUser = await updateProfile(user.id, {
        avatar_url: avatarUrl.trim() || undefined,
        display_name: displayName.trim(),
        city: city || undefined,
        bio: bio.trim() || undefined,
      });
      // 同步本地 store snapshot
      updateUser({
        avatar_url: updatedUser.avatar_url,
        display_name: updatedUser.display_name,
        city: updatedUser.city,
        bio: updatedUser.bio,
      });
      showToast("保存成功", "success");
      closeModal();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "保存失败";
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={isOpen} onClose={closeModal} title="编辑资料">
      <div className="flex flex-col gap-5">
        {/* 头像预览 + URL 输入 */}
        <div className="flex items-center gap-4">
          <Avatar
            src={avatarUrl || null}
            alt={displayName || "头像"}
            fallbackName={displayName || user?.display_name}
            size="lg"
            shape="circle"
          />
          <div className="flex-1">
            <label className="block text-sm text-text-tertiary mb-1.5">
              头像 URL（Mock 阶段，P10 接 Storage 上传）
            </label>
            <Input
              value={avatarUrl}
              onChange={(e) => setAvatarUrl(e.target.value)}
              placeholder="https://example.com/avatar.jpg（可留空）"
              type="url"
            />
          </div>
        </div>

        {/* 用户名 */}
        <div>
          <label className="block text-sm text-text-tertiary mb-1.5">
            用户名 <span className="text-accent-lime">*</span>
          </label>
          <Input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="请输入用户名"
          />
        </div>

        {/* 城市 */}
        <div>
          <label className="block text-sm text-text-tertiary mb-1.5">
            所在城市
          </label>
          <Select
            options={cityOptions}
            value={city}
            onChange={setCity}
            placeholder="请选择城市（可留空）"
          />
        </div>

        {/* Bio */}
        <div>
          <label className="block text-sm text-text-tertiary mb-1.5">
            简介
          </label>
          <Textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="一句话介绍你自己（可留空）"
            rows={3}
          />
        </div>

        {error && (
          <p className="text-sm text-accent-red">{error}</p>
        )}

        {/* 按钮行 */}
        <div className="flex justify-end gap-3 pt-1">
          <Button
            variant="ghost"
            onClick={closeModal}
            disabled={saving}
          >
            取消
          </Button>
          <Button
            variant="primary"
            onClick={handleSave}
            disabled={!canSave || saving}
          >
            {saving ? "保存中…" : "保存"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

"use client";

import * as React from "react";
import { X, Plus, Link2 } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";
import { useUserStore } from "@/lib/stores/useUserStore";
import {
  isStorageConfigured,
  uploadLivePostImage,
} from "@/lib/supabase/storage";
import {
  detectVideoPlatform,
  getVideoPlatformLabel,
} from "@/lib/api/posts/livePosts";

interface LivePostModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (input: {
    content?: string;
    imageUrls: string[];
    videoUrl?: string;
  }) => void;
}

/** 待发布图片：File 用于上传，previewUrl（blob:）仅用于本地预览 */
interface PendingImage {
  file: File;
  previewUrl: string;
}

export function LivePostModal({ open, onClose, onSubmit }: LivePostModalProps) {
  const [content, setContent] = React.useState("");
  const [images, setImages] = React.useState<PendingImage[]>([]);
  const [videoUrl, setVideoUrl] = React.useState("");
  const [error, setError] = React.useState("");
  const [uploading, setUploading] = React.useState(false);

  // 清理 object URLs（仅预览用）
  React.useEffect(() => {
    return () => {
      images.forEach((img) => {
        if (img.previewUrl.startsWith("blob:")) {
          URL.revokeObjectURL(img.previewUrl);
        }
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    const newImages: PendingImage[] = Array.from(files).map((file) => ({
      file,
      previewUrl: URL.createObjectURL(file),
    }));
    setImages((prev) => [...prev, ...newImages]);
    e.target.value = "";
  };

  const removeImage = (image: PendingImage) => {
    if (image.previewUrl.startsWith("blob:")) {
      URL.revokeObjectURL(image.previewUrl);
    }
    setImages((prev) => prev.filter((img) => img !== image));
  };

  const platform = videoUrl ? detectVideoPlatform(videoUrl) : undefined;

  const handleSubmit = async () => {
    setError("");
    if (!content.trim() && images.length === 0 && !videoUrl.trim()) {
      setError("至少填写文字、图片或视频链接中的一种");
      return;
    }
    if (uploading) return;

    let imageUrls = images.map((img) => img.previewUrl);

    // Supabase 已配置：先把图片上传到 Storage 拿持久公开 URL，
    // 禁止 blob: 临时 URL 进入 image_urls 写库（刷新即破图）
    if (isStorageConfigured() && images.length > 0) {
      setUploading(true);
      try {
        const userId =
          useUserStore.getState().user?.id ?? "anonymous";
        imageUrls = await Promise.all(
          images.map((img) => uploadLivePostImage(img.file, userId))
        );
      } catch (err) {
        console.error("[LivePostModal] 图片上传失败:", err);
        setError(
          err instanceof Error && err.message
            ? `图片上传失败：${err.message}`
            : "图片上传失败，请重试"
        );
        setUploading(false);
        return;
      }
      setUploading(false);
    }

    onSubmit({
      content: content.trim() || undefined,
      imageUrls,
      videoUrl: videoUrl.trim() || undefined,
    });
    // Reset
    setContent("");
    images.forEach((img) => {
      if (img.previewUrl.startsWith("blob:")) {
        URL.revokeObjectURL(img.previewUrl);
      }
    });
    setImages([]);
    setVideoUrl("");
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="分享现场">
      <div className="space-y-5">
        <Textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="记录这一刻的现场…"
          rows={4}
        />

        {/* 图片选择 */}
        <div>
          <p className="mb-2 text-sm text-text-secondary">现场照片</p>
          <div className="flex flex-wrap gap-2">
            {images.map((img, i) => (
              <div
                key={img.previewUrl}
                className="relative w-20 h-20 rounded-sm overflow-hidden border border-border"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={img.previewUrl}
                  alt={`预览 ${i + 1}`}
                  className="w-full h-full object-cover"
                />
                <button
                  type="button"
                  onClick={() => removeImage(img)}
                  className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 flex items-center justify-center text-white"
                >
                  <X size={12} />
                </button>
              </div>
            ))}
            <label className="w-20 h-20 rounded-sm border border-dashed border-border flex items-center justify-center cursor-pointer hover:border-border-light text-text-tertiary hover:text-text-secondary">
              <Plus size={20} />
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={handleFileSelect}
                className="hidden"
              />
            </label>
          </div>
        </div>

        {/* 视频链接 */}
        <div>
          <p className="mb-2 text-sm text-text-secondary">视频链接（选填）</p>
          <div className="relative">
            <Link2
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary"
            />
            <input
              type="url"
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
              placeholder="B站 / 小红书 / 抖音 / YouTube"
              className="w-full rounded-md border border-border bg-bg-secondary pl-9 pr-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus-visible:outline-none focus-visible:border-accent-lime"
            />
          </div>
          {videoUrl && platform && (
            <p className="mt-1 text-xs text-accent-green">
              识别到：{getVideoPlatformLabel(platform)}
            </p>
          )}
          {videoUrl && !platform && (
            <p className="mt-1 text-xs text-accent-yellow">
              不支持的平台，将作为普通外部链接显示
            </p>
          )}
        </div>

        {error && <p className="text-sm text-accent-red">{error}</p>}

        <div className="flex justify-end gap-3 pt-2">
          <Button variant="ghost" onClick={onClose}>
            取消
          </Button>
          <Button variant="primary" onClick={handleSubmit} disabled={uploading}>
            {uploading ? "上传中…" : "发布"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

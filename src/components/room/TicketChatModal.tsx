"use client";

import * as React from "react";
import { X, Send, Copy, Link2, ExternalLink } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { useUserStore } from "@/lib/stores/useUserStore";
import type { TicketConversation, TicketMessage } from "@/lib/types";
import {
  getTicketMessages,
  sendTicketMessage,
  markConversationRead,
} from "@/lib/api/ticketMessages";
import { findTicketPostById } from "@/lib/api/posts/ticketPosts";
import { getShowLifecycle } from "@/lib/utils/showLifecycle";
import { formatRelativeTime } from "@/lib/utils/format";
import { cn } from "@/lib/utils";
import { tryCopy } from "./LiveShareMenu";

interface TicketChatModalProps {
  conversation: TicketConversation | null;
  onClose: () => void;
}

/**
 * 交易消息聊天弹窗（V1 mock，无支付/订单）
 * - 演出结束后只读（历史消息保留）
 * - 打开即把对方消息标记已读
 */
export function TicketChatModal({ conversation, onClose }: TicketChatModalProps) {
  const { showToast } = useToast();
  const user = useUserStore((s) => s.user);
  const [messages, setMessages] = React.useState<TicketMessage[]>([]);
  const [input, setInput] = React.useState("");
  const [sending, setSending] = React.useState(false);
  const listRef = React.useRef<HTMLDivElement>(null);
  // P1-9 闲鱼 DEMO：绑定链接仅存本次弹窗内存，不做订单/实名/状态同步
  const [xianyuUrl, setXianyuUrl] = React.useState<string | null>(null);
  const [bindingOpen, setBindingOpen] = React.useState(false);
  const [urlInput, setUrlInput] = React.useState("");

  // 切换会话时重置 DEMO 绑定状态（不持久化，明确 DEMO 边界）
  React.useEffect(() => {
    setXianyuUrl(null);
    setBindingOpen(false);
    setUrlInput("");
  }, [conversation?.id]);

  const conv = conversation;
  const showEnded = React.useMemo(() => {
    if (!conv?.show) return false;
    return getShowLifecycle(conv.show).hasEnded;
  }, [conv]);

  // 对方信息
  const peer = React.useMemo(() => {
    if (!conv || !user) return null;
    return conv.owner_user_id === user.id ? conv.requester : conv.owner;
  }, [conv, user]);

  // 关联帖子摘要
  const post = React.useMemo(
    () => (conv ? findTicketPostById(conv.ticket_post_id) : undefined),
    [conv]
  );

  React.useEffect(() => {
    if (!conv || !user) return;
    let cancelled = false;
    void getTicketMessages(conv.id).then((msgs) => {
      if (!cancelled) setMessages(msgs);
    });
    // 打开即标记对方消息已读
    void markConversationRead(conv.id, user.id);
    return () => {
      cancelled = true;
    };
  }, [conv, user]);

  // 新消息后滚到底部
  React.useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages.length]);

  if (!conv) return null;

  const handleSend = async () => {
    if (!user || !input.trim() || sending) return;
    setSending(true);
    try {
      const msg = await sendTicketMessage(conv.id, user.id, input);
      setMessages((prev) => [...prev, msg]);
      setInput("");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "发送失败", "error");
    } finally {
      setSending(false);
    }
  };

  // ===== 闲鱼 DEMO（P1-9）：复制交易信息 / 绑定闲鱼链接 / 前往闲鱼 =====
  const handleCopyTradeInfo = async () => {
    if (!post) {
      showToast("交易信息不可用", "error");
      return;
    }
    const lines = [
      "【Gigroom 交易信息（DEMO）】",
      `演出：${conv.show?.title ?? "未知演出"}`,
      `类型：${post.type === "selling" ? "出票" : "收票"}`,
      `数量：${post.quantity} 张`,
      post.price != null ? `价格：¥${post.price}` : null,
      `对方：${peer?.display_name ?? "未知用户"}`,
      `帖子：${post.id}`,
    ].filter(Boolean);
    const ok = await tryCopy(lines.join("\n"));
    showToast(ok ? "已复制交易信息" : "复制失败，请手动复制", ok ? "success" : "error");
  };

  const handleBind = () => {
    const url = urlInput.trim();
    if (!/^https?:\/\//i.test(url)) {
      showToast("请粘贴有效的闲鱼链接（http/https）", "warning");
      return;
    }
    setXianyuUrl(url);
    setBindingOpen(false);
    showToast("已绑定闲鱼链接（DEMO，仅本次会话有效）", "success");
  };

  const handleCopyXianyuLink = async () => {
    if (!xianyuUrl) return;
    const ok = await tryCopy(xianyuUrl);
    showToast(ok ? "已复制闲鱼链接" : "复制失败，请手动复制", ok ? "success" : "error");
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/60"
      onClick={onClose}
    >
      <div
        className="w-full md:max-w-lg bg-bg-primary border border-border rounded-t-lg md:rounded-lg flex flex-col max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 头部 */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div className="flex items-center gap-2 min-w-0">
            <Avatar src={peer?.avatar_url} fallbackName={peer?.display_name ?? "?"} size="sm" />
            <div className="min-w-0">
              <p className="text-sm font-medium text-text-primary truncate">
                {peer?.display_name ?? "未知用户"}
              </p>
              {post && (
                <p className="text-[11px] text-text-tertiary truncate">
                  {post.type === "selling" ? "出票" : "收票"} · {post.quantity} 张
                  {post.price != null ? ` · ¥${post.price}` : ""}
                </p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-text-tertiary hover:text-text-primary"
            aria-label="关闭"
          >
            <X size={18} />
          </button>
        </div>

        {/* 结束提示 */}
        {showEnded && (
          <div className="px-4 py-2 border-b border-border bg-bg-secondary text-center">
            <p className="text-xs text-text-tertiary">
              演出已结束，交易沟通已关闭，历史消息保留
            </p>
          </div>
        )}

        {/* 消息列表 */}
        <div ref={listRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-[200px]">
          {messages.length === 0 ? (
            <p className="text-center text-xs text-text-tertiary py-8">
              打个招呼，开始沟通票务细节吧
            </p>
          ) : (
            messages.map((m) => {
              const mine = m.from_user_id === user?.id;
              return (
                <div
                  key={m.id}
                  className={cn("flex", mine ? "justify-end" : "justify-start")}
                >
                  <div
                    className={cn(
                      "max-w-[75%] rounded-sm px-3 py-2",
                      mine
                        ? "bg-accent-lime text-bg-primary"
                        : "bg-bg-secondary text-text-primary"
                    )}
                  >
                    <p className="text-sm leading-relaxed break-words">{m.content}</p>
                    <p
                      className={cn(
                        "mt-1 text-[10px]",
                        mine ? "text-bg-primary/60" : "text-text-tertiary"
                      )}
                    >
                      {formatRelativeTime(m.created_at)}
                    </p>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* 闲鱼 DEMO 工具条（P1-9）：仅复制信息/绑定链接/跳转，不创建订单、不实名、不同步已售状态 */}
        <div className="px-4 py-2.5 border-t border-border bg-bg-secondary/40">
          <p className="text-[10px] text-text-tertiary mb-2 flex items-center gap-1">
            <ExternalLink size={10} />
            闲鱼交易助手 · DEMO
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="secondary" size="sm" onClick={() => void handleCopyTradeInfo()}>
              <Copy size={12} />
              复制交易信息
            </Button>
            {xianyuUrl ? (
              <>
                <Button variant="secondary" size="sm" onClick={() => void handleCopyXianyuLink()}>
                  <Link2 size={12} />
                  复制闲鱼链接
                </Button>
                <a
                  href={xianyuUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 h-9 px-3 text-sm rounded-sm border border-accent-lime/60 text-accent-lime font-medium transition-colors hover:bg-accent-lime/10"
                >
                  <ExternalLink size={12} />
                  前往闲鱼
                </a>
              </>
            ) : (
              <Button variant="secondary" size="sm" onClick={() => setBindingOpen((v) => !v)}>
                <Link2 size={12} />
                绑定闲鱼链接
              </Button>
            )}
          </div>
          {bindingOpen && (
            <div className="mt-2 flex gap-2">
              <input
                type="url"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                placeholder="粘贴闲鱼商品链接（DEMO，不与站内状态同步）"
                className="flex-1 h-9 px-3 rounded-sm border border-border bg-bg-primary text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-accent-lime"
              />
              <Button variant="primary" size="sm" onClick={handleBind} disabled={!urlInput.trim()}>
                绑定
              </Button>
            </div>
          )}
        </div>

        {/* 输入区 */}
        {!showEnded && (
          <div className="flex items-center gap-2 px-4 py-3 border-t border-border">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  void handleSend();
                }
              }}
              placeholder="输入消息…"
              className="flex-1 h-9 px-3 rounded-sm border border-border bg-bg-secondary text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-accent-lime"
            />
            <Button
              variant="primary"
              size="sm"
              onClick={() => void handleSend()}
              disabled={sending || !input.trim()}
            >
              <Send size={14} />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

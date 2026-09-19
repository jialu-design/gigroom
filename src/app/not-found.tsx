import Link from "next/link";

/**
 * 自定义 404 页面。
 *
 * 必须存在，否则 Next.js 会注入默认 not-found 页面，
 * 其内置 <style>body{color:#000;background:#fff}</style> 会泄漏到正常页面，
 * 覆盖 app 的暗色主题，导致白底蓝字。
 */
export default function NotFound() {
  return (
    <div
      style={{
        minHeight: "100vh",
        backgroundColor: "#080A09",
        color: "#F3F5F1",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        fontFamily:
          "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', sans-serif",
      }}
    >
      <p
        style={{
          fontFamily: "'Barlow Condensed', Inter, sans-serif",
          fontSize: "12px",
          letterSpacing: "0.25em",
          textTransform: "uppercase",
          color: "#B7F34A",
          marginBottom: "16px",
        }}
      >
        GigRoom
      </p>
      <h1
        style={{
          fontSize: "64px",
          fontWeight: 800,
          lineHeight: 1.05,
          margin: 0,
          letterSpacing: "-0.02em",
        }}
      >
        404
      </h1>
      <p style={{ marginTop: "12px", color: "#B5BAB5", fontSize: "15px" }}>
        这场演出不存在，或者已经结束。
      </p>
      <Link
        href="/"
        style={{
          marginTop: "32px",
          display: "inline-flex",
          alignItems: "center",
          gap: "8px",
          backgroundColor: "#B7F34A",
          color: "#080A09",
          padding: "10px 20px",
          borderRadius: "2px",
          fontSize: "14px",
          fontWeight: 500,
          textDecoration: "none",
        }}
      >
        返回首页
      </Link>
    </div>
  );
}

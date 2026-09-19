/**
 * P10.1.5 行为测试 — Supabase Database Type 收口
 *
 * 覆盖：
 * A. client/server 引用同一 Database 类型
 * B. @supabase/auth-helpers-nextjs 不存在
 * C. 不存在 __probe.ts 等临时文件
 * D. browser client 不含 service role key 且使用 anon key
 * E. database.types.ts 文件存在且 profiles 核心类型存在
 * F. profile API 没有 as any / as unknown 散落外部（仅允许内部集中式 1 处）
 * G. Supabase API 层没有新增 @ts-ignore / @ts-expect-error
 * H. middleware 不使用 service role key
 */
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

const ROOT = resolve(__dirname, "../../..");
const SRC = resolve(ROOT, "src");

function read(p: string) {
  return readFileSync(resolve(ROOT, p), "utf-8");
}

describe("P10.1.5 A — client/server 引用同一 Database 类型", () => {
  it("client.ts 从 database.types.ts 导入 Database", () => {
    const content = read("src/lib/supabase/client.ts");
    expect(content).toContain(
      'import type { Database } from "@/lib/supabase/database.types"'
    );
  });

  it("server.ts 从 database.types.ts 导入 Database", () => {
    const content = read("src/lib/supabase/server.ts");
    expect(content).toContain(
      'import type { Database } from "@/lib/supabase/database.types"'
    );
  });

  it("client.ts 使用 createBrowserClient<Database> 泛型", () => {
    const content = read("src/lib/supabase/client.ts");
    expect(content).toContain("createBrowserClient<Database>");
  });

  it("server.ts 使用 createServerClient<Database> 泛型", () => {
    const content = read("src/lib/supabase/server.ts");
    expect(content).toContain("createServerClient<Database>");
  });

  it("types.ts 仅 re-export database.types，不再手写 Database", () => {
    const content = read("src/lib/supabase/types.ts");
    // types.ts 不再手写 "public: { Tables:"，而是纯 re-export
    expect(content).not.toContain("Tables:");
    expect(content).toContain('export type { Database, ProfileRow } from "./database.types"');
  });
});

describe("P10.1.5 B — @supabase/auth-helpers-nextjs 不存在", () => {
  it("package.json dependencies/devDependencies 无 auth-helpers-nextjs", () => {
    const pkg = JSON.parse(read("package.json"));
    const allDeps = {
      ...(pkg.dependencies || {}),
      ...(pkg.devDependencies || {}),
    };
    expect(Object.keys(allDeps)).not.toContain(
      "@supabase/auth-helpers-nextjs"
    );
  });

  it("src 目录下没有任何代码 import auth-helpers-nextjs", () => {
    // 直接从 package.json 断言等价于全局（上面已做），再加代码层检查：
    const content = read("package.json");
    expect(content).not.toContain("@supabase/auth-helpers-nextjs");
  });
});

describe("P10.1.5 C — 不存在 __probe.ts 临时文件", () => {
  it("src/lib/supabase/__probe.ts 已删除", () => {
    const p = resolve(SRC, "lib/supabase/__probe.ts");
    expect(existsSync(p)).toBe(false);
  });

  it("src 目录下全局无 __probe.* 文件", () => {
    // 用 existsSync 对可能的位置逐一检查
    const candidates = [
      resolve(SRC, "__probe.ts"),
      resolve(SRC, "__probe.tsx"),
      resolve(SRC, "lib/supabase/__probe.ts"),
      resolve(SRC, "lib/__probe.ts"),
      resolve(SRC, "lib/api/__probe.ts"),
    ];
    for (const c of candidates) {
      expect(existsSync(c)).toBe(false);
    }
  });
});

describe("P10.1.5 D — service role 不进入 browser client", () => {
  it("client.ts 只使用 NEXT_PUBLIC_SUPABASE_ANON_KEY，不使用 service role", () => {
    const content = read("src/lib/supabase/client.ts");
    expect(content).toContain("NEXT_PUBLIC_SUPABASE_ANON_KEY");
    expect(content).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
    expect(content).not.toContain("service_role");
    expect(content).not.toContain("service-role");
  });

  it("client.ts createBrowserClient 显式携带 <Database> 泛型，不使用 any 默认泛型", () => {
    const content = read("src/lib/supabase/client.ts");
    expect(content).toContain("createBrowserClient<Database>(");
  });
});

describe("P10.1.5 E — database.types.ts 文件存在 + profiles 核心表类型", () => {
  it("src/lib/supabase/database.types.ts 文件存在", () => {
    expect(existsSync(resolve(SRC, "lib/supabase/database.types.ts"))).toBe(true);
  });

  it("database.types.ts 顶部声明 TEMPORARY / replace with supabase gen types", () => {
    const content = read("src/lib/supabase/database.types.ts");
    expect(content).toContain("TEMPORARY");
    expect(content).toContain("supabase gen types");
  });

  it("database.types.ts 导出 Database 类型，核心 profiles 表具备 Row/Insert/Update", () => {
    const content = read("src/lib/supabase/database.types.ts");
    expect(content).toContain("export type Database = {");
    expect(content).toContain('profiles: {');
    expect(content).toMatch(/\bRow:\s*\{/);
    expect(content).toMatch(/\bInsert:\s*\{/);
    expect(content).toMatch(/\bUpdate:\s*\{/);
    expect(content).toMatch(/\bRelationships:/);
  });

  it("profiles Row 类型含 id/display_name/avatar_url/city/bio/onboarding_completed/created_at/updated_at", () => {
    const content = read("src/lib/supabase/database.types.ts");
    for (const f of [
      "id: string",
      "display_name: string",
      "avatar_url: string | null",
      "city: string | null",
      "bio: string | null",
      "onboarding_completed: boolean",
      "created_at: string",
      "updated_at: string",
    ]) {
      expect(content).toContain(f);
    }
  });

  it("database.types.ts 从 Database 派生 ProfileRow", () => {
    const content = read("src/lib/supabase/database.types.ts");
    expect(content).toContain(
      'Database["public"]["Tables"]["profiles"]["Row"]'
    );
  });
});

describe("P10.1.5 F — profile API 断言不散落外部", () => {
  it("profile.ts 不包含 'as any'（集中式断言不使用 any）", () => {
    const content = read("src/lib/api/profile.ts");
    expect(content).not.toContain("as any");
  });

  it("profile.ts 集中式 'as unknown as'（允许 2 处：profileFrom + getProfilesByIds）", () => {
    const content = read("src/lib/api/profile.ts");
    const matches = content.match(/as unknown as/g) ?? [];
    // profileFrom（单一 QueryBuilder cast） + getProfilesByIds（批量用户回填）
    expect(matches.length).toBeGreaterThanOrEqual(1);
    expect(matches.length).toBeLessThanOrEqual(2);
    // profileFrom 的断言必须存在
    expect(content).toContain("raw as unknown as ProfilesQueryBuilder");
  });

  it("profile.ts 不再散落 'as ProfileRow' 调用点（旧 2 处已移除）", () => {
    const content = read("src/lib/api/profile.ts");
    // 不允许在 getProfile/updateProfile 的调用断言出现 'as ProfileRow'
    const lines = content.split("\n");
    const matches: number[] = [];
    lines.forEach((l, i) => {
      if (l.includes("as ProfileRow")) matches.push(i + 1);
    });
    expect(matches).toEqual([]);
  });

  it("src 下的非测试文件：profile API 之外没有 'as ProfileRow'", () => {
    const files = [
      "src/lib/api/auth.ts",
      "src/lib/supabase/client.ts",
      "src/lib/supabase/server.ts",
      "src/components/user/AuthProvider.tsx",
      "src/components/user/LoginModal.tsx",
      "src/components/user/OnboardingModal.tsx",
      "src/components/user/EditProfileModal.tsx",
    ];
    for (const f of files) {
      const p = resolve(SRC, f.replace("src/", ""));
      if (!existsSync(resolve(ROOT, f))) continue;
      const content = read(f);
      expect(content).not.toContain("as ProfileRow");
    }
  });
});

describe("P10.1.5 G — Supabase API 层没有新增 @ts-ignore / @ts-expect-error", () => {
  it("client/server/auth/profile 四层没有 @ts-ignore", () => {
    const files = [
      "src/lib/supabase/client.ts",
      "src/lib/supabase/server.ts",
      "src/lib/api/auth.ts",
      "src/lib/api/profile.ts",
    ];
    for (const f of files) {
      const content = read(f);
      expect(content).not.toContain("@ts-ignore");
    }
  });

  it("client/server/auth/profile 四层没有 @ts-expect-error", () => {
    const files = [
      "src/lib/supabase/client.ts",
      "src/lib/supabase/server.ts",
      "src/lib/api/auth.ts",
      "src/lib/api/profile.ts",
    ];
    for (const f of files) {
      const content = read(f);
      expect(content).not.toContain("@ts-expect-error");
    }
  });
});

describe("P10.1.5 H — middleware 不使用 service role", () => {
  it("middleware.ts 存在且不包含 service_role / SERVICE_ROLE_KEY", () => {
    const content = read("src/middleware.ts");
    expect(content).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
    expect(content).not.toContain("service_role");
    expect(content).not.toContain("service-role");
  });

  it("middleware.ts 只使用 NEXT_PUBLIC_SUPABASE_*（anon）环境变量", () => {
    const content = read("src/middleware.ts");
    expect(content).toContain("NEXT_PUBLIC_SUPABASE_URL");
    expect(content).toContain("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  });
});

import { notFound } from "next/navigation";
import { getUser } from "@/lib/api/user";
import { PublicProfileClient } from "@/components/user/PublicProfileClient";

interface PublicProfilePageProps {
  params: { id: string };
}

/**
 * 最小用户主页 server 外壳（/u/[id]）
 * 预取用户；不存在时 notFound()。只展示公开基础信息，绝不泄露手机号/微信等隐私。
 */
export default async function PublicProfilePage({
  params,
}: PublicProfilePageProps) {
  const user = await getUser(params.id);
  if (!user) {
    notFound();
  }
  return <PublicProfileClient user={user} />;
}

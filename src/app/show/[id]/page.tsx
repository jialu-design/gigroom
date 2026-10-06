import { notFound } from "next/navigation";
import { getShowById } from "@/lib/api/shows";
import { ShowEditorialClient } from "@/components/show/editorial/ShowEditorialClient";

interface ShowDetailPageProps {
  params: { id: string };
}

/**
 * 演出详情 server 外壳（Show Editorial Page）：
 * - 预取 show；不存在时 notFound()，返回真正的 404（不渲染 200 空详情页）
 * - 交互、Room、Tab 深链由 client 内核 ShowEditorialClient 承担
 */
export default async function ShowDetailPage({
  params,
}: ShowDetailPageProps) {
  const show = await getShowById(params.id);
  if (!show) {
    notFound();
  }

  return <ShowEditorialClient initialShow={show} />;
}

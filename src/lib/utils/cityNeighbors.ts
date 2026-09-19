/**
 * 城市工具（DEMO 阶段）
 *
 * - NEARBY_CITY_MAP / getNearbyCities：写死的周边城市邻近关系
 * - filterCities：城市选择弹窗的搜索过滤
 *
 * 邻近关系用途：首页"即将上演"在本城没有演出时，按距离近→远推荐周边城市的真实演出。
 *
 * 说明：
 * - 第一版不做 GPS、不做真实距离计算，数组顺序即邻近顺序（近 → 远）。
 * - 后续接入真实距离/地理位置时只需替换本文件（或改为 API 返回），调用方不变。
 * - 未配置邻近关系的城市返回空数组，由调用方回退到原空状态。
 */
export const NEARBY_CITY_MAP: Readonly<Record<string, readonly string[]>> = {
  上海: ["杭州", "苏州", "南京"],
  北京: ["天津", "石家庄"],
  广州: ["深圳", "佛山"],
  成都: ["重庆"],
  // 测试用：无锡无本地演出，验证周边兜底链路
  无锡: ["上海", "苏州", "南京"],
};

/**
 * 获取某城市的周边城市列表（按距离近 → 远）。
 * 未配置邻近关系的城市返回空数组。
 */
export function getNearbyCities(city: string): string[] {
  const neighbors = NEARBY_CITY_MAP[city];
  return neighbors ? [...neighbors] : [];
}

/**
 * 城市搜索过滤（城市选择弹窗用）：
 * - 输入先 trim，空串等价于不过滤（返回全部副本）
 * - 非空时按子串包含匹配
 */
export function filterCities(
  query: string,
  cities: readonly string[]
): string[] {
  const q = query.trim();
  if (!q) return [...cities];
  return cities.filter((c) => c.includes(q));
}

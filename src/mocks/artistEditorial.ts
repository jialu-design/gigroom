/**
 * Artist Editorial 内容资产层 Mock（Show Editorial Page 数据准备）
 *
 * 范围：仅 8 个核心 Canonical Artist 样本（不覆盖全部 40 个）。
 * 规则：
 * - artist_id 必须存在于 artists.ts Canonical Registry；city/genres 不在这里重复。
 * - bio_long 为 80–150 字真实简介，事实可经 bio_sources 溯源，不猜信息。
 * - fan_impressions 全部为 DEMO 虚构短评（is_demo 恒 true），
 *   只谈 Artist / 过往现场，不评价任何尚未发生的 Show。
 * - photos 为人工策展清单：图片文件落地 /public/images/artists/<id>/ 后回填 url；
 *   调研期仅保留官方来源（official_sources），不编造图片直链、不冒标官方。
 * - 所有图片仅作 DEMO/reference，不宣称拥有商用版权。
 */
import type { ArtistEditorial } from "@/lib/types";

export const artistEditorials: ArtistEditorial[] = [
  // ==========================================================================
  // artist-1 Chinese Football（武汉 / Indie Rock, Emo, Math Rock）
  // ==========================================================================
  {
    artist_id: "artist-1",
    bio_long:
      "2012 年起活跃于武汉的独立摇滚乐队，承袭 90 年代 Emo 与 Math Rock 脉络，用流畅又生涩的吉他语言唱热血、幻想与其挫败。2015 年发表同名首张专辑，随后以 2017、2019 两张关于“人生游戏”的迷你专辑与 2022 年全长《Win&Lose》完成三部曲，并凭充满张力的现场从全国 Livehouse 走向日本、东南亚与欧美巡演。",
    bio_sources: [
      "https://wap.showstart.com/event/291678",
      "https://www.sina.cn/media/2749012581",
    ],
    official_sources: [
      {
        platform: "weibo",
        account: "@ChineseFootball乐队",
        url: "https://weibo.com/u/2749012581",
        verified: true,
        verified_note: "微博官方认证账号，简介含官方演出联系邮箱",
      },
    ],
    photos: [],
    fan_impressions: [
      {
        id: "ae-1-fi-1",
        content: "上次在 VOX 看他们，唱到跪地那首，全场大合唱直接盖过乐队声。",
        is_demo: true,
        about: "past_live",
      },
      {
        id: "ae-1-fi-2",
        content: "从同名专辑听到现在，吉他一响就是那种笨拙又真诚的劲。",
        is_demo: true,
        about: "artist",
      },
      {
        id: "ae-1-fi-3",
        content: "巡演每场都像最后一场，散场后满屋子汗味和不想走的人。",
        is_demo: true,
        about: "past_live",
      },
    ],
  },

  // ==========================================================================
  // artist-7 RUBUR（上海 / Shoegaze）
  // ==========================================================================
  {
    artist_id: "artist-7",
    bio_long:
      "2014 年成立于上海的盯鞋乐队，在 My Bloody Valentine、Slowdive 式的吉他音墙传统里，注入属于自己的文学性与哲思。他们自称“动作不快”，但凭借《Evening Sitdown Vision》《珀耳塞福涅的四季》《Meanwhile…》等全长与 EP，建立起轰鸣与梦幻并置的独特美学，是上海 Shoegaze 场景里口碑坚实的代表名字。",
    bio_sources: [
      "https://i2.y.qq.com/n3/other/pages/details/playlist.html?id=8669424454",
    ],
    official_sources: [
      {
        platform: "weibo",
        account: "@RUBUR（ruburband）",
        url: "https://weibo.com/ruburband",
        verified: false,
        verified_note:
          "见于兵马司唱片 2017 年官方巡演微博，暂未见平台认证证据，策展前需再核实",
      },
    ],
    photos: [],
    fan_impressions: [
      {
        id: "ae-7-fi-1",
        content: "音墙压下来的瞬间整个人是懵的，结束后耳鸣一整晚，但值。",
        is_demo: true,
        about: "past_live",
      },
      {
        id: "ae-7-fi-2",
        content: "适合深夜一个人戴耳机听，也适合在现场被音量整个裹住。",
        is_demo: true,
        about: "artist",
      },
      {
        id: "ae-7-fi-3",
        content: "那场灯暗到只剩剪影，效果器的声音像从墙里渗出来一样。",
        is_demo: true,
        about: "past_live",
      },
    ],
  },

  // ==========================================================================
  // artist-3 缺省 Default（北京 / Shoegaze, Dream Pop, Alternative）
  // ==========================================================================
  {
    artist_id: "artist-3",
    bio_long:
      "2015 年集结于北京的盯鞋与梦幻流行乐队，2017 年发表首张 EP《California Nebula》并签入生煎唱片，次年曾为 Slowdive 中国巡演担任暖场嘉宾。长篇吉他回授与人声旋律交叠，从首张全长《Life In A Vacuum》到 EP《Can You Hear The Whistle Blow?》，他们在轰鸣与空灵之间铺陈成长与自由的拉扯，是北京自赏场景中辨识度极高的一支。",
    bio_sources: ["https://wap.showstart.com/artist/58456"],
    official_sources: [
      {
        platform: "netease",
        account: "缺省 Default（网易云艺人页）",
        url: "https://music.163.com/#/artist?id=12051076",
        verified: false,
        verified_note: "乐迷资料普遍标注的官方艺人页，建议经厂牌/后台再核实",
      },
    ],
    photos: [],
    fan_impressions: [
      {
        id: "ae-3-fi-1",
        content: "《California Nebula》里的长段吉他，适合把耳机音量拧到底。",
        is_demo: true,
        about: "artist",
      },
      {
        id: "ae-3-fi-2",
        content: "给 Slowdive 暖场那场完全不虚，回授声一起鸡皮疙瘩就起来了。",
        is_demo: true,
        about: "past_live",
      },
      {
        id: "ae-3-fi-3",
        content: "北京盯鞋队里旋律最抓人的一支，吵，但一点都不刺耳。",
        is_demo: true,
        about: "artist",
      },
    ],
  },

  // ==========================================================================
  // artist-9 toe（东京 / Math Rock, Post-Rock）
  // ==========================================================================
  {
    artist_id: "artist-9",
    bio_long:
      "2000 年结成于东京的四人器乐摇滚乐队，以清澈分解和弦、精密分层的节拍与内敛旋律，重塑了日系 Math Rock 与 Post-Rock 的声音想象。2025 年迎来结成 25 周年，发行新专辑《NOW WE SEE THE LIGHT》并在两国国技馆举办纪念专场；多年来频繁巡演亚洲、欧洲与美洲，也曾多次来华，是数摇与后摇场景公认的标杆乐队之一。",
    bio_sources: [
      "https://www.toe.st/",
      "https://www.rice.press/talk/31273",
    ],
    official_sources: [
      {
        platform: "official_site",
        account: "toe official site",
        url: "https://www.toe.st/",
        verified: true,
        verified_note: "乐队官网，持续更新作品与巡演日程",
      },
      {
        platform: "instagram",
        account: "@toe_music_official",
        url: "https://www.instagram.com/toe_music_official/",
        verified: true,
        verified_note: "RiCE.press 官方专访信息栏列出的官方 Instagram",
      },
    ],
    photos: [],
    fan_impressions: [
      {
        id: "ae-9-fi-1",
        content: "鼓点像精密仪器，现场却一点都不冷，安可时全场喊到哑。",
        is_demo: true,
        about: "past_live",
      },
      {
        id: "ae-9-fi-2",
        content: "很少有乐队能把复杂拍号做得这么温柔，戴耳机听层次会着迷。",
        is_demo: true,
        about: "artist",
      },
      {
        id: "ae-9-fi-3",
        content: "第一次在现场听到熟曲前奏，眼泪完全不受控制。",
        is_demo: true,
        about: "past_live",
      },
    ],
  },

  // ==========================================================================
  // artist-10 tricot（京都 / Math Rock, Indie Rock）
  // ==========================================================================
  {
    artist_id: "artist-10",
    bio_long:
      "2010 年 9 月 1 日成立于京都的数学摇滚乐队，以流行感旋律、情绪唱腔与复杂变拍的碰撞为标志。她们在自主厂牌体系下发表《T H E》《A N D》《3》《Jodeki》等专辑，从亚洲演到欧洲与北美，海外演出上百场并曾为 Pixies 暖场，2025 年迎来成团 15 周年，是日本 Math Rock 场景最活跃的出海代表之一。",
    bio_sources: [
      "https://tricot-official.fanpla.jp/",
      "https://www.discogs.com/artist/2869329-tricot",
    ],
    official_sources: [
      {
        platform: "official_site",
        account: "tricot official website",
        url: "https://tricot-official.fanpla.jp/",
        verified: true,
        verified_note: "乐队官网（含官方会员站、巡演与作品年表）",
      },
      {
        platform: "instagram",
        account: "@tricot_band_jp",
        url: "https://www.instagram.com/tricot_band_jp/",
        verified: true,
        verified_note: "官方 MV 简介栏与官网列出的账号一致",
      },
    ],
    photos: [],
    fan_impressions: [
      {
        id: "ae-10-fi-1",
        content: "主唱一边跳一边唱复杂变拍居然稳得可怕，贝斯手全程带笑。",
        is_demo: true,
        about: "past_live",
      },
      {
        id: "ae-10-fi-2",
        content: "甜美的旋律撞上突然急转弯的节奏，只有她们能这么玩。",
        is_demo: true,
        about: "artist",
      },
      {
        id: "ae-10-fi-3",
        content: "散场后排周边的队伍绕了半条街，成员还挨个跟大家合影。",
        is_demo: true,
        about: "past_live",
      },
    ],
  },

  // ==========================================================================
  // artist-14 草东没有派对（台北 / Indie Rock, Alternative, Post-Rock）
  // ==========================================================================
  {
    artist_id: "artist-14",
    bio_long:
      "队名来自台北的草东街。2015 年以自费发行的 EP 闯入独立场景，2016 年首张专辑《丑奴儿》与《大风吹》《山海》等曲目引发世代共鸣，2017 年成为金曲奖史上首组同获最佳新人与最佳乐团的艺人，2023 年发表第二张专辑《瓦合》。粗粝吉他与嘶吼交织，是当下华语独立摇滚最具分量的名字之一。",
    bio_sources: [
      "https://weibo.com/u/5697791666",
      "https://b10live.cn/events/2018/10/5",
    ],
    official_sources: [
      {
        platform: "weibo",
        account: "@草東沒有派對",
        url: "https://weibo.com/u/5697791666",
        verified: true,
        verified_note: "微博蓝V认证：草东没有派对乐队官方微博",
      },
      {
        platform: "facebook",
        account: "nopartyforcaodong",
        url: "https://www.facebook.com/nopartyforcaodong",
        verified: true,
        verified_note: "B10 现场官方活动页列出的官方脸书账号",
      },
    ],
    photos: [],
    fan_impressions: [
      {
        id: "ae-14-fi-1",
        content: "《山海》前奏一响身边全在哭，没人想到自己会跟唱得那么大声。",
        is_demo: true,
        about: "past_live",
      },
      {
        id: "ae-14-fi-2",
        content: "他们的歌里有一种不讲道理的重量，前奏一响人就安静下来。",
        is_demo: true,
        about: "artist",
      },
      {
        id: "ae-14-fi-3",
        content: "那场没有花哨灯光，四个人站定就唱，反而更狠。",
        is_demo: true,
        about: "past_live",
      },
    ],
  },

  // ==========================================================================
  // artist-15 落日飞车 Sunset Rollercoaster（台北 / Indie Rock, Dream Pop）
  // ==========================================================================
  {
    artist_id: "artist-15",
    bio_long:
      "来自台北的浪漫流行乐队，由主唱曾国宏领军，把 Soul、R&B 与日系 City Pop 的质感揉进华语流行旋律，潮湿、慵懒又带着忧郁。代表作《My Jinji》风靡东亚，《Cassa Nova》《SOFT STORM》等专辑持续打开国际声量，巡演足迹遍及日本、北美与欧洲，从地下场景一路登上各地音乐节压轴，是华语独立音乐最具国际号召力的名字之一。",
    bio_sources: [
      "https://www.sunsetrollercoaster.com/",
      "https://do617.com/artists/sunset-rollercoaster",
    ],
    official_sources: [
      {
        platform: "official_site",
        account: "Sunset Rollercoaster official site",
        url: "https://www.sunsetrollercoaster.com/",
        verified: true,
        verified_note: "乐队官网（夕陽音樂產業运营，含巡演与官方影像）",
      },
      {
        platform: "instagram",
        account: "@sunsetrollercoaster",
        url: "https://www.instagram.com/sunsetrollercoaster/",
        verified: true,
        verified_note: "官网与多个第三方艺人页一致列出的官方 Instagram",
      },
    ],
    photos: [],
    fan_impressions: [
      {
        id: "ae-15-fi-1",
        content: "现场比唱片还松弛，萨克斯一起，整间场馆像在深夜兜风。",
        is_demo: true,
        about: "past_live",
      },
      {
        id: "ae-15-fi-2",
        content: "《My Jinji》前奏是那种一响起就想发给某个人的声音。",
        is_demo: true,
        about: "artist",
      },
      {
        id: "ae-15-fi-3",
        content: "安可时全场开手机灯合唱，主唱说那是他最喜欢的一站。",
        is_demo: true,
        about: "past_live",
      },
    ],
  },

  // ==========================================================================
  // artist-17 大象体操 Elephant Gym（高雄 / Math Rock, Post-Rock）
  // ==========================================================================
  {
    artist_id: "artist-17",
    bio_long:
      "2012 年 2 月成立于高雄的三件式数学摇滚乐队，由贝斯手张凯婷、吉他手张凯翔兄妹与鼓手涂嘉钦组成。他们让贝斯担纲主旋律，以爵士与放克气息的精密律动游走在变拍之间，专辑《水底》《梦境》先后带动横跨十余国、上百场的世界巡演，也曾登上 Summer Sonic 与 Camp Flog Gnaw，是台湾数学摇滚在国际上最活跃的名字之一。",
    bio_sources: ["https://elephantgym.co/bio/"],
    official_sources: [
      {
        platform: "official_site",
        account: "大象體操 Elephant Gym official site",
        url: "https://elephantgym.co/",
        verified: true,
        verified_note: "乐队官网，含官方传记、巡演与影像年表",
      },
      {
        platform: "youtube",
        account: "@ElephantGym（大象體操 Elephant Gym）",
        url: "https://www.youtube.com/@ElephantGym",
        verified: true,
        verified_note: "官网内嵌的官方 YouTube 频道",
      },
    ],
    photos: [],
    fan_impressions: [
      {
        id: "ae-17-fi-1",
        content: "把贝斯当主旋律弹的乐队，听完会重新认识这件乐器。",
        is_demo: true,
        about: "artist",
      },
      {
        id: "ae-17-fi-2",
        content: "三个人在台上对位精准得像机器，却一直在笑，能量特别好。",
        is_demo: true,
        about: "past_live",
      },
      {
        id: "ae-17-fi-3",
        content: "《水底》整张像一场潮起潮落，戴上耳机就再也摘不下来。",
        is_demo: true,
        about: "artist",
      },
    ],
  },
];

/** artist_id → ArtistEditorial 索引 */
export const artistEditorialMap = new Map(
  artistEditorials.map((e) => [e.artist_id, e])
);

/** 已配置 Editorial 内容资产的 Artist ID 列表（8 个样本） */
export const editorialArtistIds = artistEditorials.map((e) => e.artist_id);

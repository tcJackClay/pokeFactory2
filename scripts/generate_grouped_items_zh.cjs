const fs = require("fs");
const path = require("path");

const repoRoot = process.cwd();
const refRoot = path.join(repoRoot, "reference", "pokeemerald-expansion");
const itemsDataPath = path.join(refRoot, "src", "data", "items.h");
const iconsDataPath = path.join(refRoot, "src", "data", "graphics", "items.h");
const iconsDir = path.join(refRoot, "graphics", "items", "icons");
const outMdPath = path.join(refRoot, "ITEMS_LIST_GROUPED_ZH.md");
const outCsvPath = path.join(refRoot, "ITEMS_LIST_GROUPED_ZH.csv");

const sortTypeZh = {
  ITEM_TYPE_UNCATEGORIZED: "未分类",
  ITEM_TYPE_HEALTH_RECOVERY: "HP恢复",
  ITEM_TYPE_STATUS_RECOVERY: "状态恢复",
  ITEM_TYPE_PP_RECOVERY: "PP恢复",
  ITEM_TYPE_STAT_BOOST_DRINK: "能力提升饮料",
  ITEM_TYPE_STAT_BOOST_FEATHER: "能力羽毛",
  ITEM_TYPE_STAT_BOOST_MOCHI: "能力麻薯",
  ITEM_TYPE_FIELD_USE: "野外功能道具",
  ITEM_TYPE_NATURE_MINT: "薄荷",
  ITEM_TYPE_LEVEL_UP_ITEM: "等级提升",
  ITEM_TYPE_FLUTE: "笛子",
  ITEM_TYPE_X_ITEM: "战斗强化",
  ITEM_TYPE_BATTLE_ITEM: "战斗道具",
  ITEM_TYPE_SELLABLE: "可售卖道具",
  ITEM_TYPE_SHARD: "碎片",
  ITEM_TYPE_RELIC: "古代遗物",
  ITEM_TYPE_FOSSIL: "化石",
  ITEM_TYPE_GROWTH: "培养道具",
  ITEM_TYPE_EVOLUTION_ITEM: "进化道具",
  ITEM_TYPE_MAIL: "邮件",
  ITEM_TYPE_EVOLUTION_STONE: "进化石",
  ITEM_TYPE_NECTAR: "花蜜",
  ITEM_TYPE_PLATE: "石板",
  ITEM_TYPE_DRIVE: "驱动器",
  ITEM_TYPE_MEMORY: "存储碟",
  ITEM_TYPE_GEM: "宝石",
  ITEM_TYPE_BERRY: "树果",
  ITEM_TYPE_KEY_ITEM: "重要道具",
  ITEM_TYPE_MEGA_STONE: "Mega石",
  ITEM_TYPE_Z_CRYSTAL: "Z纯晶",
  ITEM_TYPE_HELD_ITEM: "携带道具",
  ITEM_TYPE_SPECIAL_HELD_ITEM: "特殊携带道具",
  ITEM_TYPE_INCENSE: "薰香",
  ITEM_TYPE_CONTEST_HELD_ITEM: "华丽大赛携带道具",
  ITEM_TYPE_EV_BOOST_HELD_ITEM: "努力值相关携带道具",
  ITEM_TYPE_TYPE_BOOST_HELD_ITEM: "属性增强携带道具",
  ITEM_TYPE_TERA_SHARD: "太晶碎块",
  ITEM_TYPE_AUX_ITEM: "辅助道具",
};

const pocketZh = {
  POCKET_ITEMS: "道具口袋",
  POCKET_KEY_ITEMS: "重要道具口袋",
  POCKET_POKE_BALLS: "精灵球口袋",
  POCKET_TM_HM: "招式学习器口袋",
  POCKET_BERRIES: "树果口袋",
};

function readText(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function normalizeIconFilename(fromIncbinPath) {
  return fromIncbinPath.replace(/\.4bpp\.smol$/i, ".png");
}

function parseIconVarToFileMap(iconsDataText) {
  const map = new Map();
  const regex =
    /const u32\s+(gItemIcon_[A-Za-z0-9_]+)\[\]\s*=\s*INCBIN_U32\("graphics\/items\/icons\/([^"]+?\.4bpp\.smol)"\);/g;
  let match;
  while ((match = regex.exec(iconsDataText)) !== null) {
    const [, iconVar, iconSmolPath] = match;
    map.set(iconVar, normalizeIconFilename(path.basename(iconSmolPath)));
  }
  return map;
}

function parseItems(itemsDataText, iconVarToFileMap) {
  const items = [];
  const blockRegex = /\[(ITEM_[A-Z0-9_]+)\]\s*=\s*\{([\s\S]*?)^\s*\},/gm;
  let match;
  while ((match = blockRegex.exec(itemsDataText)) !== null) {
    const [, itemConst, body] = match;

    const nameMatch = body.match(/\.name\s*=\s*ITEM_NAME\("([^"]*)"\)/);
    const sortTypeMatch = body.match(/\.sortType\s*=\s*(ITEM_TYPE_[A-Z0-9_]+)/);
    const pocketMatch = body.match(/\.pocket\s*=\s*(POCKET_[A-Z0-9_]+)/);
    const iconVarMatch = body.match(/\.iconPic\s*=\s*(gItemIcon_[A-Za-z0-9_]+)/);

    const enName = nameMatch ? nameMatch[1] : itemConst;
    const sortType = sortTypeMatch ? sortTypeMatch[1] : "ITEM_TYPE_UNCATEGORIZED";
    const pocket = pocketMatch ? pocketMatch[1] : "";
    const iconVar = iconVarMatch ? iconVarMatch[1] : "gItemIcon_QuestionMark";
    const iconFile =
      iconVarToFileMap.get(iconVar) ||
      `${itemConst.toLowerCase().replace(/^item_/, "")}.png`;

    const iconAbsPath = path.join(iconsDir, iconFile);
    const iconRelPath = path
      .relative(refRoot, iconAbsPath)
      .replace(/\\/g, "/");
    const iconExists = fs.existsSync(iconAbsPath);

    items.push({
      itemConst,
      enName,
      sortType,
      sortTypeZh: sortTypeZh[sortType] || sortType,
      pocket,
      pocketZh: pocketZh[pocket] || pocket,
      iconVar,
      iconFile,
      iconRelPath,
      iconAbsPath,
      iconExists,
    });
  }
  return items;
}

function groupBySortType(items) {
  const groups = new Map();
  for (const item of items) {
    if (!groups.has(item.sortType)) groups.set(item.sortType, []);
    groups.get(item.sortType).push(item);
  }
  for (const arr of groups.values()) {
    arr.sort((a, b) => a.itemConst.localeCompare(b.itemConst));
  }
  return [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0]));
}

function csvEscape(value) {
  const s = String(value ?? "");
  return `"${s.replace(/"/g, '""')}"`;
}

function buildMd(items) {
  const now = new Date().toLocaleString("zh-CN", { hour12: false });
  const missing = items.filter((i) => !i.iconExists).length;
  const groups = groupBySortType(items);
  const lines = [];
  lines.push("# pokeemerald-expansion 道具清单（按类别分组，中文）");
  lines.push("");
  lines.push(`- 生成时间：${now}`);
  lines.push(`- 道具总数：${items.length}`);
  lines.push(`- 类别总数：${groups.length}`);
  lines.push(`- 图标缺失数：${missing}`);
  lines.push("- 图片路径基于仓库目录 `graphics/items/icons/*.png`");
  lines.push("");
  lines.push("说明：本清单按 `sortType` 分组，名称为英文原名，备注与分组为中文。");
  lines.push("");

  let idx = 1;
  for (const [sortType, groupItems] of groups) {
    const zh = sortTypeZh[sortType] || sortType;
    lines.push(`## ${zh}（${sortType}，${groupItems.length}项）`);
    lines.push("");
    lines.push("| # | 道具常量 | 英文名 | 口袋 | 图标文件 | 图片 |");
    lines.push("|---:|---|---|---|---|---|");
    for (const item of groupItems) {
      const existsMark = item.iconExists ? "✅" : "❌";
      const img = item.iconExists ? `![${item.iconFile}](${item.iconRelPath})` : "（缺失）";
      lines.push(
        `| ${idx} | \`${item.itemConst}\` | ${item.enName} | ${item.pocketZh} | \`${item.iconFile}\` ${existsMark} | ${img} |`
      );
      idx += 1;
    }
    lines.push("");
  }
  return `${lines.join("\n")}\n`;
}

function buildCsv(items) {
  const groups = groupBySortType(items);
  const rows = [
    [
      "index",
      "category_zh",
      "sort_type",
      "pocket_zh",
      "pocket",
      "item_constant",
      "en_name",
      "icon_var",
      "icon_file",
      "icon_rel_path",
      "icon_abs_path",
      "icon_exists",
    ],
  ];
  let idx = 1;
  for (const [sortType, groupItems] of groups) {
    for (const item of groupItems) {
      rows.push([
        idx,
        sortTypeZh[sortType] || sortType,
        sortType,
        item.pocketZh,
        item.pocket,
        item.itemConst,
        item.enName,
        item.iconVar,
        item.iconFile,
        item.iconRelPath,
        item.iconAbsPath,
        item.iconExists ? "TRUE" : "FALSE",
      ]);
      idx += 1;
    }
  }
  return rows.map((r) => r.map(csvEscape).join(",")).join("\n") + "\n";
}

function main() {
  const itemsDataText = readText(itemsDataPath);
  const iconsDataText = readText(iconsDataPath);
  const iconVarToFileMap = parseIconVarToFileMap(iconsDataText);
  const items = parseItems(itemsDataText, iconVarToFileMap);
  const md = buildMd(items);
  const csv = buildCsv(items);

  fs.writeFileSync(outMdPath, md, "utf8");
  fs.writeFileSync(outCsvPath, csv, "utf8");

  const missing = items.filter((i) => !i.iconExists).length;
  console.log(`Items=${items.length}`);
  console.log(`Categories=${groupBySortType(items).length}`);
  console.log(`MissingIcons=${missing}`);
}

main();

# -*- coding: utf-8 -*-
"""从 pokeemerald-expansion（rogue 的上游）抽取「道具 → 进化」完整映射，生成中文附录。"""
import re, glob, os

REF = 'D:/Games/pokeFactory2/reference/pokeemerald-expansion/src/data/pokemon/species_info'
OUT = 'D:/Games/pokeFactory2/docs/tasks/扩池规则/evolution-items.generated.md'

ITEM_ZH = {
    'ITEM_FIRE_STONE': '火之石', 'ITEM_WATER_STONE': '水之石', 'ITEM_THUNDER_STONE': '雷之石',
    'ITEM_LEAF_STONE': '叶之石', 'ITEM_ICE_STONE': '冰之石', 'ITEM_MOON_STONE': '月之石',
    'ITEM_SUN_STONE': '日之石', 'ITEM_SHINY_STONE': '光之石', 'ITEM_DUSK_STONE': '暗之石',
    'ITEM_DAWN_STONE': '觉醒之石',
    'ITEM_LINKING_CORD': '连接线',
    'ITEM_KINGS_ROCK': '王者之证', 'ITEM_METAL_COAT': '金属膜', 'ITEM_DRAGON_SCALE': '龙之鳞片',
    'ITEM_UPGRADE': '升级数据', 'ITEM_DUBIOUS_DISC': '可疑补丁', 'ITEM_PROTECTOR': '护具',
    'ITEM_ELECTIRIZER': '电力增幅器', 'ITEM_MAGMARIZER': '熔岩增幅器', 'ITEM_REAPER_CLOTH': '灵界之布',
    'ITEM_DEEP_SEA_TOOTH': '深海之牙', 'ITEM_DEEP_SEA_SCALE': '深海之鳞',
    'ITEM_SACHET': '香袋', 'ITEM_WHIPPED_DREAM': '泡沫奶油', 'ITEM_PRISM_SCALE': '美丽鳞片',
    'ITEM_GALARICA_CUFF': '伽勒豆蔻手环', 'ITEM_GALARICA_WREATH': '伽勒豆蔻花圈',
    'ITEM_BLACK_AUGURITE': '黑色碎石', 'ITEM_TART_APPLE': '酸苹果', 'ITEM_SWEET_APPLE': '甜苹果',
    'ITEM_SYRUPY_APPLE': '糖浆苹果', 'ITEM_CRACKED_POT': '破碎的茶壶', 'ITEM_CHIPPED_POT': '缺损的茶壶',
    'ITEM_METAL_ALLOY': '复合金属', 'ITEM_SCROLL_OF_DARKNESS': '暗之卷轴',
    'ITEM_SCROLL_OF_WATERS': '水之卷轴', 'ITEM_AUSPICIOUS_ARMOR': '喜庆铠甲',
    'ITEM_MALICIOUS_ARMOR': '咒术铠甲', 'ITEM_UNREMARKABLE_TEACUP': '凡作的茶杯',
    'ITEM_MASTERPIECE_TEACUP': '杰出的茶杯',
}

SPECIES_ZH = {
    'SANDSHREW_ALOLA': '阿罗拉穿山鼠', 'SANDSLASH_ALOLA': '阿罗拉穿山王',
    'NIDORINA': '尼多娜', 'NIDOQUEEN': '尼多后', 'NIDORINO': '尼多力诺', 'NIDOKING': '尼多王',
    'CLEFAIRY': '皮皮', 'CLEFABLE': '皮可西', 'VULPIX': '六尾', 'NINETALES': '九尾',
    'VULPIX_ALOLA': '阿罗拉六尾', 'NINETALES_ALOLA': '阿罗拉九尾',
    'JIGGLYPUFF': '胖丁', 'WIGGLYTUFF': '胖可丁', 'GLOOM': '臭臭花',
    'VILEPLUME': '霸王花', 'BELLOSSOM': '美丽花',
    'GROWLITHE': '卡蒂狗', 'ARCANINE': '风速狗', 'GROWLITHE_HISUI': '洗翠卡蒂狗', 'ARCANINE_HISUI': '洗翠风速狗',
    'POLIWHIRL': '蚊香君', 'POLIWRATH': '蚊香泳士', 'POLITOED': '蚊香蛙皇',
    'KADABRA': '勇基拉', 'ALAKAZAM': '胡地', 'MACHOKE': '豪力', 'MACHAMP': '怪力',
    'WEEPINBELL': '口呆花', 'VICTREEBEL': '大食花',
    'GRAVELER': '隆隆石', 'GOLEM': '隆隆岩', 'GRAVELER_ALOLA': '阿罗拉隆隆石', 'GOLEM_ALOLA': '阿罗拉隆隆岩',
    'SLOWPOKE': '呆呆兽', 'SLOWKING': '呆呆王',
    'SLOWPOKE_GALAR': '伽勒尔呆呆兽', 'SLOWBRO_GALAR': '伽勒尔呆壳兽', 'SLOWKING_GALAR': '伽勒尔呆呆王',
    'MAGNETON': '三合一磁怪', 'MAGNEZONE': '自爆磁怪', 'SHELLDER': '大舌贝', 'CLOYSTER': '刺甲贝',
    'HAUNTER': '鬼斯通', 'GENGAR': '耿鬼', 'ONIX': '大岩蛇', 'STEELIX': '大钢蛇',
    'VOLTORB_HISUI': '洗翠霹雳电球', 'ELECTRODE_HISUI': '洗翠顽皮雷弹',
    'RHYDON': '铁甲暴龙', 'RHYPERIOR': '超铁暴龙', 'SEADRA': '海刺龙', 'KINGDRA': '刺龙王',
    'STARYU': '海星星', 'STARMIE': '宝石海星',
    'SCYTHER': '飞天螳螂', 'SCIZOR': '巨钳螳螂', 'KLEAVOR': '劈斧螳螂',
    'ELECTABUZZ': '电击兽', 'ELECTIVIRE': '电击魔兽', 'MAGMAR': '鸭嘴火兽', 'MAGMORTAR': '鸭嘴炎兽',
    'EEVEE': '伊布', 'JOLTEON': '雷伊布', 'VAPOREON': '水伊布', 'FLAREON': '火伊布',
    'LEAFEON': '叶伊布', 'GLACEON': '冰伊布',
    'PORYGON': '多边兽', 'PORYGON2': '多边兽Ⅱ', 'PORYGON_Z': '多边兽乙型',
    'TOGETIC': '波克基古', 'TOGEKISS': '波克基斯',
    'SUNKERN': '向日种子', 'SUNFLORA': '向日花怪',
    'MURKROW': '黑暗鸦', 'HONCHKROW': '乌鸦头头', 'MISDREAVUS': '梦妖', 'MISMAGIUS': '梦妖魔',
    'LOMBRE': '莲帽小童', 'LUDICOLO': '乐天河童', 'NUZLEAF': '长鼻叶', 'SHIFTRY': '狡猾天狗',
    'NOSEPASS': '朝北鼻', 'PROBOPASS': '大朝北鼻', 'SKITTY': '向尾喵', 'DELCATTY': '优雅猫',
    'ROSELIA': '毒蔷薇', 'ROSERADE': '罗丝雷朵', 'FEEBAS': '笨笨鱼', 'MILOTIC': '美纳斯',
    'DUSCLOPS': '夜巡灵', 'DUSKNOIR': '夜黑魔人', 'CLAMPERL': '珍珠贝',
    'HUNTAIL': '猎斑鱼', 'GOREBYSS': '樱花鱼',
    'PANSAGE': '花椰猴', 'SIMISAGE': '花椰猿', 'PANSEAR': '爆香猴', 'SIMISEAR': '爆香猿',
    'PANPOUR': '冷水猴', 'SIMIPOUR': '冷水猿', 'MUNNA': '食梦梦', 'MUSHARNA': '梦梦蚀',
    'BOLDORE': '地幔岩', 'GIGALITH': '庞岩怪', 'GURDURR': '铁骨土人', 'CONKELDURR': '修缮老头',
    'COTTONEE': '木棉球', 'WHIMSICOTT': '风妖精',
    'DARUMAKA_GALAR': '伽勒尔火红不倒翁', 'DARMANITAN_GALAR_STANDARD': '伽勒尔达摩狒狒',
    'MINCCINO': '泡沫栗鼠', 'CINCCINO': '奇诺栗鼠', 'EELEKTRIK': '麻麻鳗', 'EELEKTROSS': '麻麻鳗鱼王',
    'LAMPENT': '灯火幽灵', 'CHANDELURE': '水晶灯火灵',
    'FLABEBE_WHITE': '白花蓓蓓', 'FLORGES': '花洁夫人',
    'DOUBLADE': '双剑鞘', 'AEGISLASH_SHIELD': '坚盾剑怪（盾牌形态）',
    'SPRITZEE': '粉香香', 'AROMATISSE': '芳香精', 'SWIRLIX': '绵绵泡芙', 'SLURPUFF': '胖甜妮',
    'HELIOPTILE': '伞电蜥', 'HELIOLISK': '光电伞蜥',
    'PHANTUMP': '小木灵', 'TREVENANT': '朽木妖',
    'PUMPKABOO_AVERAGE': '南瓜精（普通尺寸）', 'GOURGEIST_AVERAGE': '南瓜怪人（普通尺寸）',
    'PUMPKABOO_SMALL': '南瓜精（小尺寸）', 'GOURGEIST_SMALL': '南瓜怪人（小尺寸）',
    'PUMPKABOO_LARGE': '南瓜精（大尺寸）', 'GOURGEIST_LARGE': '南瓜怪人（大尺寸）',
    'PUMPKABOO_SUPER': '南瓜精（特大尺寸）', 'GOURGEIST_SUPER': '南瓜怪人（特大尺寸）',
    'CHARJABUG': '虫电宝', 'VIKAVOLT': '锹农炮虫',
    'CRABRAWLER': '好胜蟹', 'CRABOMINABLE': '好胜毛蟹',
    'APPLIN': '啃果虫', 'FLAPPLE': '苹裹龙', 'APPLETUN': '丰蜜龙', 'DIPPLIN': '裹蜜虫',
    'SINISTEA_PHONY': '来悲茶（赝品）', 'POLTEAGEIST_PHONY': '怖思壶（赝品）',
    'SINISTEA_ANTIQUE': '来悲茶（真品）', 'POLTEAGEIST_ANTIQUE': '怖思壶（真品）',
    'DURALUDON': '铝钢龙', 'ARCHALUDON': '铝钢桥龙',
    'KUBFU': '熊徒弟', 'URSHIFU_SINGLE_STRIKE': '武道熊师（一击流）', 'URSHIFU_RAPID_STRIKE': '武道熊师（连击流）',
    'CHARCADET': '炭小侍', 'ARMAROUGE': '红莲铠骑', 'CERULEDGE': '苍炎刃鬼',
    'TADBULB': '电海燕', 'BELLIBOLT': '大电海燕',
    'CAPSAKID': '热辣娃', 'SCOVILLAIN': '狠辣椒',
    'CETODDLE': '走鲸', 'CETITAN': '浩大鲸',
    'POLTCHAGEIST_COUNTERFEIT': '斯魔茶（冒牌）', 'SINISTCHA_UNREMARKABLE': '来杯茶（凡作）',
    'POLTCHAGEIST_ARTISAN': '斯魔茶（高档）', 'SINISTCHA_MASTERPIECE': '来杯茶（杰作）',
}

GEN_OF_SPECIES = {}


def zh_species(const):
    key = re.sub(r'\s*##.*$', '', const).replace('SPECIES_', '').strip().rstrip('_')
    return SPECIES_ZH.get(key, key)


def zh_item(const):
    return ITEM_ZH.get(const, const)


rows = []
for f in sorted(glob.glob(os.path.join(REF, 'gen_*_families.h'))):
    text = open(f, encoding='utf-8', errors='replace').read()
    blocks = re.split(r'\n\s*\[(SPECIES_[A-Z0-9_]+)\]\s*=\s*', text)
    for i in range(1, len(blocks), 2):
        sp, body = blocks[i], blocks[i + 1]
        m = re.search(r'\.evolutions\s*=\s*EVOLUTION\((.*?)\)\s*,', body, re.S)
        if not m:
            continue
        for item in re.finditer(r'\{([^{}]*)\}', m.group(1)):
            parts = [p.strip() for p in item.group(1).split(',')]
            if len(parts) >= 3:
                rows.append((sp, parts[0], parts[1], parts[2]))

by_item = {}
for sp, kind, arg, tgt in rows:
    if kind == 'EVO_ITEM':
        by_item.setdefault(arg, []).append((sp, tgt))
    elif kind == 'EVO_TRADE':
        by_item.setdefault('ITEM_LINKING_CORD', []).append((sp, tgt))

lines = []
lines.append('# 附录：进化道具完整映射（自动生成，请勿手改）')
lines.append('')
lines.append('> 数据来源：`reference/pokeemerald-expansion/src/data/pokemon/species_info/gen_*_families.h`。')
lines.append('> 该仓库是用户指定的参考项目 [Pokabbie/pokeemerald-rogue](https://github.com/Pokabbie/pokeemerald-rogue) 的上游；')
lines.append('> rogue 分支把「通讯进化」实现为使用 `ITEM_LINKING_CORD`（连接线）的道具进化，本表已合并该口径。')
lines.append('> 重新生成：`python docs/tasks/_gen_evolution_appendix.py`。')
lines.append('')
lines.append('| 道具 | 英文常量 | 用它的宝可梦 → 进化成 | 条数 |')
lines.append('| --- | --- | --- | --- |')
for item in sorted(by_item, key=lambda k: (not k.endswith('_STONE') and k != 'ITEM_LINKING_CORD', k)):
    pairs = by_item[item]
    pairs = sorted(set(pairs))
    listing = '；'.join('%s → %s' % (zh_species(a), zh_species(b)) for a, b in pairs)
    lines.append('| %s | `%s` | %s | %d |' % (zh_item(item), item.replace('ITEM_', '').lower(), listing, len(pairs)))

lines.append('')
lines.append('合计：**%d** 种道具、**%d** 条进化关系。' % (len(by_item), sum(len(set(v)) for v in by_item.values())))

open(OUT, 'w', encoding='utf-8').write('\n'.join(lines) + '\n')
print('wrote', OUT)
print('items', len(by_item), 'relations', sum(len(set(v)) for v in by_item.values()))

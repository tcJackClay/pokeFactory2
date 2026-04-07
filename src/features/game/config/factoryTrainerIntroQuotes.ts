export interface FactoryTrainerIntroQuoteContext {
  currentLanguage: string;
  facilityClass: string;
  battleInSet: number;
  setNo: number;
  isSpecialBoss: boolean;
  isSetBoss: boolean;
}

interface IntroQuoteRuleSet {
  zh: string;
  en: string;
}

const FACILITY_CLASS_INTRO_QUOTES: Record<string, IntroQuoteRuleSet> = {
  FACILITY_CLASS_BIRD_KEEPER: {
    zh: '我的节奏，会像俯冲一样把你压住。',
    en: 'I will keep the pressure on from the first turn.',
  },
  FACILITY_CLASS_BLACK_BELT: {
    zh: '来吧，正面较量才最痛快。',
    en: 'Come on. A straight fight is the best kind.',
  },
  FACILITY_CLASS_BATTLE_GIRL: {
    zh: '来吧，正面较量才最痛快。',
    en: 'Come on. A straight fight is the best kind.',
  },
  FACILITY_CLASS_EXPERT_F: {
    zh: '来吧，正面较量才最痛快。',
    en: 'Come on. A straight fight is the best kind.',
  },
  FACILITY_CLASS_EXPERT_M: {
    zh: '来吧，正面较量才最痛快。',
    en: 'Come on. A straight fight is the best kind.',
  },
  FACILITY_CLASS_POKEFAN_F: {
    zh: '我最喜欢的伙伴们，可不会轻易认输。',
    en: 'My favorite partners never back down.',
  },
  FACILITY_CLASS_POKEFAN_M: {
    zh: '我最喜欢的伙伴们，可不会轻易认输。',
    en: 'My favorite partners never back down.',
  },
  FACILITY_CLASS_PSYCHIC_F: {
    zh: '这场对决的走向，我已经看见了。',
    en: 'I can already see how this battle unfolds.',
  },
  FACILITY_CLASS_PSYCHIC_M: {
    zh: '这场对决的走向，我已经看见了。',
    en: 'I can already see how this battle unfolds.',
  },
  FACILITY_CLASS_HEX_MANIAC: {
    zh: '这场对决的走向，我已经看见了。',
    en: 'I can already see how this battle unfolds.',
  },
  FACILITY_CLASS_DRAGON_TAMER: {
    zh: '别眨眼，我的阵容不会给你喘息。',
    en: 'Do not blink. My lineup will not let you breathe.',
  },
  FACILITY_CLASS_COOLTRAINER_F: {
    zh: '别眨眼，我的阵容不会给你喘息。',
    en: 'Do not blink. My lineup will not let you breathe.',
  },
  FACILITY_CLASS_COOLTRAINER_M: {
    zh: '别眨眼，我的阵容不会给你喘息。',
    en: 'Do not blink. My lineup will not let you breathe.',
  },
  FACILITY_CLASS_SWIMMER_F: {
    zh: '一旦被我带进节奏，你就很难翻身。',
    en: 'Once you lose the tempo, I will carry the rest.',
  },
  FACILITY_CLASS_SWIMMER_M: {
    zh: '一旦被我带进节奏，你就很难翻身。',
    en: 'Once you lose the tempo, I will carry the rest.',
  },
  FACILITY_CLASS_SWIMMING_TRIATHLETE_F: {
    zh: '一旦被我带进节奏，你就很难翻身。',
    en: 'Once you lose the tempo, I will carry the rest.',
  },
  FACILITY_CLASS_SWIMMING_TRIATHLETE_M: {
    zh: '一旦被我带进节奏，你就很难翻身。',
    en: 'Once you lose the tempo, I will carry the rest.',
  },
  FACILITY_CLASS_RUNNING_TRIATHLETE_F: {
    zh: '一旦被我带进节奏，你就很难翻身。',
    en: 'Once you lose the tempo, I will carry the rest.',
  },
  FACILITY_CLASS_RUNNING_TRIATHLETE_M: {
    zh: '一旦被我带进节奏，你就很难翻身。',
    en: 'Once you lose the tempo, I will carry the rest.',
  },
  FACILITY_CLASS_CYCLING_TRIATHLETE_F: {
    zh: '一旦被我带进节奏，你就很难翻身。',
    en: 'Once you lose the tempo, I will carry the rest.',
  },
  FACILITY_CLASS_CYCLING_TRIATHLETE_M: {
    zh: '一旦被我带进节奏，你就很难翻身。',
    en: 'Once you lose the tempo, I will carry the rest.',
  },
  FACILITY_CLASS_SAILOR: {
    zh: '一旦被我带进节奏，你就很难翻身。',
    en: 'Once you lose the tempo, I will carry the rest.',
  },
  FACILITY_CLASS_GENTLEMAN: {
    zh: '让我们优雅地结束这场较量。',
    en: 'Let us settle this with style.',
  },
  FACILITY_CLASS_LADY: {
    zh: '让我们优雅地结束这场较量。',
    en: 'Let us settle this with style.',
  },
  FACILITY_CLASS_RICH_BOY: {
    zh: '让我们优雅地结束这场较量。',
    en: 'Let us settle this with style.',
  },
  FACILITY_CLASS_COLLECTOR: {
    zh: '让我们优雅地结束这场较量。',
    en: 'Let us settle this with style.',
  },
  FACILITY_CLASS_YOUNGSTER: {
    zh: '可别因为我看起来轻松，就小看这场战斗。',
    en: 'Do not mistake a relaxed smile for an easy win.',
  },
  FACILITY_CLASS_LASS: {
    zh: '可别因为我看起来轻松，就小看这场战斗。',
    en: 'Do not mistake a relaxed smile for an easy win.',
  },
  FACILITY_CLASS_SCHOOL_KID_F: {
    zh: '可别因为我看起来轻松，就小看这场战斗。',
    en: 'Do not mistake a relaxed smile for an easy win.',
  },
  FACILITY_CLASS_SCHOOL_KID_M: {
    zh: '可别因为我看起来轻松，就小看这场战斗。',
    en: 'Do not mistake a relaxed smile for an easy win.',
  },
  FACILITY_CLASS_CAMPER: {
    zh: '可别因为我看起来轻松，就小看这场战斗。',
    en: 'Do not mistake a relaxed smile for an easy win.',
  },
  FACILITY_CLASS_PICNICKER: {
    zh: '可别因为我看起来轻松，就小看这场战斗。',
    en: 'Do not mistake a relaxed smile for an easy win.',
  },
  FACILITY_CLASS_TUBER_F: {
    zh: '可别因为我看起来轻松，就小看这场战斗。',
    en: 'Do not mistake a relaxed smile for an easy win.',
  },
  FACILITY_CLASS_TUBER_M: {
    zh: '可别因为我看起来轻松，就小看这场战斗。',
    en: 'Do not mistake a relaxed smile for an easy win.',
  },
  FACILITY_CLASS_BUG_CATCHER: {
    zh: '只要你一分神，我的组合就会把你缠住。',
    en: 'One mistake, and my lineup will lock you in.',
  },
  FACILITY_CLASS_BUG_MANIAC: {
    zh: '只要你一分神，我的组合就会把你缠住。',
    en: 'One mistake, and my lineup will lock you in.',
  },
};

const SPECIAL_BOSS_QUOTES: IntroQuoteRuleSet = {
  zh: '这场特别解锁战，就由我亲手收下。',
  en: 'This special unlock battle ends with me.',
};

const DEFAULT_RULES = {
  firstBattle: {
    zh: '新的对局开始了，让我看看你的选择。',
    en: 'A new battle starts now. Show me what you picked.',
  },
  lateBattle: {
    zh: '已经走到这里了，你的状态还能稳住吗？',
    en: 'You made it this far. Can you still hold steady?',
  },
  standard: {
    zh: '这一次，我可不会让你轻松过关。',
    en: 'I am not making this one easy for you.',
  },
};

export function getFactoryTrainerIntroQuote({
  currentLanguage,
  facilityClass,
  battleInSet,
  setNo,
  isSpecialBoss,
  isSetBoss,
}: FactoryTrainerIntroQuoteContext) {
  const isZh = currentLanguage.startsWith('zh');

  if (isSpecialBoss) {
    return isZh ? SPECIAL_BOSS_QUOTES.zh : SPECIAL_BOSS_QUOTES.en;
  }

  if (isSetBoss) {
    return isZh
      ? `第${setNo}组的终局，就在这里见真章。`
      : `Set ${setNo} ends here. Show me your best.`;
  }

  const facilityRule = FACILITY_CLASS_INTRO_QUOTES[facilityClass];
  if (facilityRule) {
    return isZh ? facilityRule.zh : facilityRule.en;
  }

  if (battleInSet === 1) {
    return isZh ? DEFAULT_RULES.firstBattle.zh : DEFAULT_RULES.firstBattle.en;
  }

  if (battleInSet >= 6) {
    return isZh ? DEFAULT_RULES.lateBattle.zh : DEFAULT_RULES.lateBattle.en;
  }

  return isZh ? DEFAULT_RULES.standard.zh : DEFAULT_RULES.standard.en;
}

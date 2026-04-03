import { useCallback } from 'react';
import type { Nature } from '../../../types';
import uiStrings from '../../../uiStrings';

export function useGameLocalization(currentLanguage: string) {
  const t = useCallback((key: string, params?: Record<string, string | number>) => {
    const lang = currentLanguage.startsWith('zh')
      ? currentLanguage
      : (uiStrings[currentLanguage] ? currentLanguage : 'en');
    let str = uiStrings[lang]?.[key] || uiStrings.en?.[key] || key;

    if (params) {
      Object.entries(params).forEach(([paramKey, value]) => {
        str = str.replace(`{${paramKey}}`, String(value));
      });
    }

    return str;
  }, [currentLanguage]);

  const getLocalized = useCallback((obj: any) => {
    if (!obj) return '';

    if (obj.id && (obj.id === 'potion' || obj.id === 'pokeball' || obj.isBall || obj.isBattleItem)) {
      return currentLanguage.startsWith('zh') ? obj.zhName : obj.name;
    }

    if (obj.names && Array.isArray(obj.names)) {
      const exactMatch = obj.names.find((nameEntry: any) => nameEntry.language.name === currentLanguage);
      if (exactMatch) return exactMatch.name;

      if (currentLanguage === 'zh-hans') {
        const traditionalMatch = obj.names.find((nameEntry: any) => nameEntry.language.name === 'zh-hant');
        if (traditionalMatch) return traditionalMatch.name;
      } else if (currentLanguage === 'zh-hant') {
        const simplifiedMatch = obj.names.find((nameEntry: any) => nameEntry.language.name === 'zh-hans');
        if (simplifiedMatch) return simplifiedMatch.name;
      }

      const englishMatch = obj.names.find((nameEntry: any) => nameEntry.language.name === 'en');
      if (englishMatch) return englishMatch.name;
    }

    return obj.zhName || obj.name || '';
  }, [currentLanguage]);

  const getLocalizedDesc = useCallback((obj: any) => {
    if (!obj) return '';

    if (obj.id && (obj.id === 'potion' || obj.id === 'pokeball' || obj.isBall || obj.isBattleItem)) {
      return currentLanguage.startsWith('zh') ? obj.zhDescription : obj.description;
    }

    if (obj.flavor_text_entries && Array.isArray(obj.flavor_text_entries)) {
      const exactMatch = obj.flavor_text_entries.find((entry: any) => entry.language.name === currentLanguage);
      if (exactMatch) return exactMatch.flavor_text.replace(/\f/g, ' ');

      if (currentLanguage === 'zh-hans') {
        const traditionalMatch = obj.flavor_text_entries.find((entry: any) => entry.language.name === 'zh-hant');
        if (traditionalMatch) return traditionalMatch.flavor_text.replace(/\f/g, ' ');
      } else if (currentLanguage === 'zh-hant') {
        const simplifiedMatch = obj.flavor_text_entries.find((entry: any) => entry.language.name === 'zh-hans');
        if (simplifiedMatch) return simplifiedMatch.flavor_text.replace(/\f/g, ' ');
      }

      const englishMatch = obj.flavor_text_entries.find((entry: any) => entry.language.name === 'en');
      if (englishMatch) return englishMatch.flavor_text.replace(/\f/g, ' ');
    }

    return obj.zhDescription || obj.description || '';
  }, [currentLanguage]);

  const getLocalizedNature = useCallback((nature: Nature) => {
    return currentLanguage.startsWith('zh') ? nature.zhName : nature.name;
  }, [currentLanguage]);

  const getStatName = useCallback((stat: string) => t(stat) || stat, [t]);

  return {
    t,
    getLocalized,
    getLocalizedDesc,
    getLocalizedNature,
    getStatName,
  };
}

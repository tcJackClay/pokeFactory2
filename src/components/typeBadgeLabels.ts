import { TYPE_ZH } from '../constants';

export function getTypeBadgeLabel(type: string, language: string): string {
  if (language.startsWith('zh')) return TYPE_ZH[type] || type;
  return type.replace(/[-_]/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

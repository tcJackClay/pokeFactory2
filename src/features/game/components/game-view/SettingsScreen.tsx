import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, useReducedMotion } from 'motion/react';
import { ArrowLeft, Bell, Check, ChevronUp, Download, FileJson, Globe, Layers, ScrollText, SlidersHorizontal, Upload, X } from 'lucide-react';
import { GENERATIONS } from '../../../../constants';
import type { GameViewSectionProps } from './shared';

const ENGLISH_REGIONS = ['Kanto', 'Johto', 'Hoenn', 'Sinnoh', 'Unova', 'Kalos', 'Alola', 'Galar', 'Paldea'];
const GENERATION_IDS = GENERATIONS.map((generation) => generation.id);

export function SettingsScreen({ viewModel }: GameViewSectionProps) {
  const {
    currentLanguage,
    setCurrentLanguage,
    selectedGens,
    setSelectedGens,
    hasFactoryRunToResume,
    enterBase,
    setGameState,
    devToolsAvailable,
    developerMode,
    toggleDeveloperMode,
    exportSaveData,
    importSaveData,
  } = viewModel;

  const shouldReduceMotion = useReducedMotion();
  const isZh = currentLanguage.startsWith('zh');
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const generationTriggerRef = useRef<HTMLButtonElement | null>(null);
  const generationDialogRef = useRef<HTMLDivElement | null>(null);
  const selectedGenerationRef = useRef<HTMLInputElement | null>(null);
  const [importStatus, setImportStatus] = useState<{ ok: boolean; message: string } | null>(null);
  const [generationPickerOpen, setGenerationPickerOpen] = useState(false);
  const activeGeneration = selectedGens.length === 1 && GENERATION_IDS.includes(selectedGens[0])
    ? selectedGens[0]
    : GENERATION_IDS[0];
  const activeGenerationIndex = GENERATIONS.findIndex((generation) => generation.id === activeGeneration);
  const activeGenerationData = GENERATIONS[activeGenerationIndex];

  useEffect(() => {
    if (!generationPickerOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    selectedGenerationRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setGenerationPickerOpen(false);
        return;
      }
      if (event.key !== 'Tab') return;
      const focusable: HTMLElement[] = generationDialogRef.current
        ? Array.from(generationDialogRef.current.querySelectorAll<HTMLElement>('button:not([disabled]), input[type="radio"]:checked'))
        : [];
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
      generationTriggerRef.current?.focus();
    };
  }, [generationPickerOpen]);

  useEffect(() => {
    if (hasFactoryRunToResume) setGenerationPickerOpen(false);
  }, [hasFactoryRunToResume]);

  const selectGeneration = (id: number) => {
    if (hasFactoryRunToResume) return;
    setSelectedGens([id]);
    setGenerationPickerOpen(false);
  };

  return (
    <motion.div
      key="settings"
      initial={shouldReduceMotion ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 12 }}
      className="pf-system-page"
    >
      <div className="pf-system-header">
        <div>
          <h2 className={`text-slate-950 ${isZh ? 'text-[28px] font-black' : 'text-[26px] font-black uppercase tracking-[0.05em]'}`}>
            {isZh ? '设置' : 'Settings'}
          </h2>
        </div>

        <button
          type="button"
          onClick={enterBase}
          className="pf-action-button px-4"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>{isZh ? '返回' : 'Back'}</span>
        </button>
      </div>

      <div className="relative z-10 flex-1 min-h-0 px-3 pb-3">
        <div className="custom-scrollbar grid h-full min-h-0 grid-cols-1 gap-3 overflow-y-auto pr-1 lg:grid-cols-2">
          <div className="pf-settings-card">
            <div className="flex items-center gap-2">
              <Globe className="h-4 w-4 text-sky-600" />
              <p className="text-sm font-black text-slate-900">{isZh ? '语言' : 'Language'}</p>
            </div>

            <div className="pf-segmented mt-3 grid-cols-2">
              <button
                type="button"
                data-active={currentLanguage.startsWith('zh') ? 'true' : 'false'}
                onClick={() => setCurrentLanguage('zh-hans')}
                className="pf-segmented-button"
              >
                中文
              </button>
              <button
                type="button"
                data-active={currentLanguage === 'en' ? 'true' : 'false'}
                onClick={() => setCurrentLanguage('en')}
                className="pf-segmented-button"
              >
                English
              </button>
            </div>
          </div>

          <div className="pf-settings-card" data-settings-section="generations">
            <div className="flex items-center gap-2">
              <Layers className="h-4 w-4 text-violet-600" />
              <p className="text-sm font-black text-slate-900">{isZh ? '当前世代' : 'Current Generation'}</p>
            </div>
            <p className="mt-2 text-xs leading-5 text-slate-600">
              {isZh
                ? '扩展世代随机池：九选一。所选世代决定下一次新挑战中随机出现的宝可梦。'
                : 'Expanded generation random pool: choose one of nine. Your choice determines the Pokemon in your next new challenge.'}
            </p>
            {hasFactoryRunToResume && (
              <p className="mt-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-bold leading-5 text-amber-800" role="status">
                {isZh
                  ? '当前挑战仍可继续。请先完成或结束该挑战，再修改世代；设置仅对下一次新挑战生效。'
                  : 'A challenge can still be resumed. Finish or end it before changing generations; the setting applies to the next new challenge.'}
              </p>
            )}
            <button
              ref={generationTriggerRef}
              type="button"
              disabled={hasFactoryRunToResume}
              aria-haspopup="dialog"
              aria-expanded={generationPickerOpen}
              aria-controls="generation-picker-dialog"
              onClick={() => setGenerationPickerOpen(true)}
              className="pf-generation-option mt-3 w-full cursor-pointer disabled:cursor-not-allowed"
            >
              <span className="min-w-0 text-left">
                <span className="block text-base font-black">{isZh ? activeGenerationData.region : ENGLISH_REGIONS[activeGenerationIndex]}</span>
                <span className="block text-[11px] font-semibold opacity-75">{isZh ? activeGenerationData.name : `Generation ${activeGeneration}`}</span>
              </span>
              <ChevronUp className="h-4 w-4 shrink-0 rotate-180" aria-hidden="true" />
            </button>
          </div>

          <div className="pf-settings-card">
            <div className="flex items-center gap-2">
              <FileJson className="h-4 w-4 text-emerald-600" />
              <p className="text-sm font-black text-slate-900">{isZh ? '存档管理' : 'Save Data'}</p>
            </div>

            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => {
                  exportSaveData();
                  setImportStatus({
                    ok: true,
                    message: isZh ? '已导出存档文件。' : 'Save file exported.',
                  });
                }}
                className="pf-action-button"
              >
                <Download className="h-4 w-4" />
                <span>{isZh ? '导出存档' : 'Export Save'}</span>
              </button>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="pf-action-button"
              >
                <Upload className="h-4 w-4" />
                <span>{isZh ? '导入存档' : 'Import Save'}</span>
              </button>

              <input
                ref={fileInputRef}
                type="file"
                accept="application/json,.json"
                className="hidden"
                onChange={async (event) => {
                  const file = event.target.files?.[0];
                  if (!file) return;
                  try {
                    const text = await file.text();
                    const result = importSaveData(text);
                    setImportStatus(result);
                  } catch (error) {
                    console.error('Read import file failed', error);
                    setImportStatus({
                      ok: false,
                      message: isZh ? '读取文件失败。' : 'Failed to read file.',
                    });
                  } finally {
                    event.target.value = '';
                  }
                }}
              />
            </div>

            {importStatus && (
              <div className={`mt-3 rounded-[16px] border px-3 py-2 text-sm font-semibold ${
                importStatus.ok
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                  : 'border-rose-200 bg-rose-50 text-rose-700'
              }`}>
                {importStatus.message}
              </div>
            )}
          </div>

          <div className="pf-settings-card opacity-90">
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-slate-500" />
              <p className="text-sm font-black text-slate-900">{isZh ? '通知' : 'Notifications'}</p>
            </div>
            <div className="mt-3 rounded-[16px] border border-dashed border-slate-200 bg-slate-50/80 px-3 py-4 text-sm font-semibold text-slate-400">
              {isZh ? '当前版本暂不提供消息推送与提醒。' : 'Push notifications and reminder controls are not available in this version yet.'}
            </div>
          </div>

          <div className="pf-settings-card">
            <div className="flex items-center gap-2">
              <ScrollText className="h-4 w-4 text-indigo-600" />
              <p className="text-sm font-black text-slate-900">{isZh ? '版权与素材来源' : 'Credits and Sources'}</p>
            </div>
            <button
              type="button"
              onClick={() => setGameState('CREDITS')}
              className="pf-action-button mt-3 w-full"
            >
              {isZh ? '查看版权说明' : 'View Credits'}
            </button>
          </div>

          {devToolsAvailable && (
            <div className="pf-settings-card">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="h-4 w-4 text-cyan-600" />
              <p className="text-sm font-black text-slate-900">{isZh ? 'DEV 面板' : 'DEV Panel'}</p>
            </div>

            <div className="pf-segmented mt-3 grid-cols-2">
              <button
                type="button"
                data-active={developerMode ? 'true' : 'false'}
                onClick={() => {
                  if (!devToolsAvailable || developerMode) return;
                  toggleDeveloperMode();
                }}
                disabled={!devToolsAvailable || developerMode}
                className="pf-segmented-button"
              >
                {isZh ? '开启' : 'Enable'}
              </button>
              <button
                type="button"
                data-active={!developerMode ? 'true' : 'false'}
                onClick={() => {
                  if (!devToolsAvailable || !developerMode) return;
                  toggleDeveloperMode();
                }}
                disabled={!devToolsAvailable || !developerMode}
                className="pf-segmented-button"
              >
                {isZh ? '关闭' : 'Disable'}
              </button>
            </div>

            {!devToolsAvailable && (
              <div className="mt-3 rounded-[16px] border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-700">
                {isZh ? '当前环境未开启 DEV 工具。' : 'DEV tools are unavailable in this environment.'}
              </div>
            )}
            </div>
          )}
        </div>
      </div>
      {generationPickerOpen && createPortal(
        <div className="fixed inset-0 z-[200] flex items-end justify-center">
          <div className="absolute inset-0 bg-slate-950/60" aria-hidden="true" onClick={() => setGenerationPickerOpen(false)} />
          <div
            id="generation-picker-dialog"
            ref={generationDialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="generation-picker-title"
            className="relative flex max-h-[calc(100dvh-0.75rem)] w-full max-w-[520px] flex-col overflow-hidden rounded-t-[24px] border border-slate-200 bg-white shadow-2xl sm:rounded-[24px]"
            style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
          >
            <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
              <div>
                <h2 id="generation-picker-title" className="text-base font-black text-slate-950">{isZh ? '选择世代' : 'Choose Generation'}</h2>
                <p className="text-xs text-slate-500">{isZh ? '九个世代中选择一个' : 'Select one of nine generations'}</p>
              </div>
              <button
                type="button"
                onClick={() => setGenerationPickerOpen(false)}
                aria-label={isZh ? '关闭世代选择' : 'Close generation picker'}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-700 focus-visible:outline-2 focus-visible:outline-blue-600"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
            <div role="radiogroup" aria-label={isZh ? '出场世代' : 'Generation'} className="min-h-0 overflow-y-auto overscroll-contain px-3 py-2 custom-scrollbar">
              <div className="grid grid-cols-3 gap-2">
                {GENERATIONS.map((generation, index) => {
                  const selected = activeGeneration === generation.id;
                  return (
                    <label key={generation.id} data-active={selected ? 'true' : 'false'} className="pf-generation-option pf-generation-card w-full cursor-pointer focus-within:outline-2 focus-within:outline-blue-600">
                      <input
                        ref={selected ? selectedGenerationRef : undefined}
                        type="radio"
                        name="factory-generation"
                        value={generation.id}
                        checked={selected}
                        onChange={() => selectGeneration(generation.id)}
                        aria-label={isZh ? `${generation.region}，${generation.name}` : `${ENGLISH_REGIONS[index]}, Generation ${generation.id}`}
                        className="sr-only"
                      />
                      <span className="min-w-0 w-full text-left">
                        <span className="block text-base font-black leading-tight">{isZh ? generation.region : ENGLISH_REGIONS[index]}</span>
                        <span className="mt-1 flex w-full items-center justify-between gap-1 text-[10px] font-semibold leading-tight opacity-75">
                          <span className="min-w-0 truncate">{isZh ? generation.name : `Gen ${generation.id}`}</span>
                          <Check className={`h-3.5 w-3.5 shrink-0 ${selected ? 'opacity-100' : 'opacity-0'}`} aria-hidden="true" />
                        </span>
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </motion.div>
  );
}

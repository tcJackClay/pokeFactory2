import { useRef, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { ArrowLeft, Bell, Download, FileJson, Globe, SlidersHorizontal, Upload } from 'lucide-react';
import type { GameViewSectionProps } from './shared';

export function SettingsScreen({ viewModel }: GameViewSectionProps) {
  const {
    currentLanguage,
    setCurrentLanguage,
    enterBase,
    devToolsAvailable,
    developerMode,
    toggleDeveloperMode,
    exportSaveData,
    importSaveData,
  } = viewModel;

  const shouldReduceMotion = useReducedMotion();
  const isZh = currentLanguage.startsWith('zh');
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [importStatus, setImportStatus] = useState<{ ok: boolean; message: string } | null>(null);

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
    </motion.div>
  );
}

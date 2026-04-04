import { useRef, useState } from 'react';
import { motion } from 'motion/react';
import { ArrowLeft, Bell, Download, FileJson, Globe, SlidersHorizontal, Upload } from 'lucide-react';
import type { GameViewSectionProps } from './shared';
import { TopRecordPanel } from './TopRecordPanel';
import { APP_PALETTE } from '../../../../theme/palette';

export function SettingsScreen({ viewModel }: GameViewSectionProps) {
  const {
    currentLanguage,
    setCurrentLanguage,
    setGameState,
    devToolsAvailable,
    developerMode,
    toggleDeveloperMode,
    coins,
    stage,
    streak,
    exportSaveData,
    importSaveData,
  } = viewModel;
  const isZh = currentLanguage.startsWith('zh');
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [importStatus, setImportStatus] = useState<{ ok: boolean; message: string } | null>(null);

  const screenStyle = {
    backgroundImage: `linear-gradient(180deg, ${APP_PALETTE.page.backgroundTop} 0%, ${APP_PALETTE.page.backgroundBottom} 100%)`,
  };

  return (
    <motion.div
      key="settings"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 12 }}
      className="flex-1 min-h-0 flex flex-col overflow-hidden"
      style={screenStyle}
    >
      <div className="px-3 pt-1 pb-0.5">
        <TopRecordPanel currentLanguage={currentLanguage} coins={coins} stage={stage} streak={streak} />
      </div>

      <div className="px-3 pt-2 pb-2 flex items-center justify-between">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.24em] text-slate-500">{isZh ? '系统' : 'System'}</p>
          <h2 className="mt-1 text-2xl font-black italic text-slate-900">{isZh ? '设置' : 'Settings'}</h2>
        </div>
        <button
          onClick={() => setGameState('START')}
          className="h-10 px-4 skew-x-[-12deg] border border-slate-300 bg-white text-slate-800 font-black text-xs uppercase tracking-wide flex items-center gap-2 hover:border-slate-900"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="skew-x-[12deg]">{isZh ? '返回' : 'Back'}</span>
        </button>
      </div>

      <div className="px-3 pb-3 flex-1 min-h-0 overflow-y-auto custom-scrollbar">
        <div className="space-y-2">
          <div className="rounded-xl border border-slate-200 bg-white p-3">
            <div className="flex items-center gap-2">
              <Globe className="w-4 h-4 text-sky-600" />
              <p className="text-sm font-black text-slate-900">{isZh ? '语言' : 'Language'}</p>
            </div>
            <p className="mt-1 text-[11px] text-slate-500 font-semibold">
              {isZh ? '切换界面显示语言。' : 'Change the display language.'}
            </p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <button
                onClick={() => setCurrentLanguage('zh-hans')}
                className={`rounded-lg px-3 py-2 text-xs font-black uppercase tracking-wide border ${
                  currentLanguage.startsWith('zh')
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-white text-slate-700 border-slate-300'
                }`}
              >
                中文
              </button>
              <button
                onClick={() => setCurrentLanguage('en')}
                className={`rounded-lg px-3 py-2 text-xs font-black uppercase tracking-wide border ${
                  currentLanguage === 'en'
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-white text-slate-700 border-slate-300'
                }`}
              >
                English
              </button>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-3">
            <div className="flex items-center gap-2">
              <FileJson className="w-4 h-4 text-emerald-600" />
              <p className="text-sm font-black text-slate-900">{isZh ? '存档管理' : 'Save Data'}</p>
            </div>
            <p className="mt-1 text-[11px] text-slate-500 font-semibold">
              {isZh ? '导出当前进度为 JSON，或导入已有 JSON 存档。' : 'Export progress to JSON, or import an existing JSON save.'}
            </p>

            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                onClick={() => {
                  exportSaveData();
                  setImportStatus({
                    ok: true,
                    message: isZh ? '已导出存档文件。' : 'Save file exported.',
                  });
                }}
                className="rounded-lg px-3 py-2 text-xs font-black uppercase tracking-wide border border-slate-300 bg-white text-slate-700 hover:border-slate-900 flex items-center justify-center gap-2"
              >
                <Download className="w-3.5 h-3.5" />
                {isZh ? '导出存档' : 'Export Save'}
              </button>

              <button
                onClick={() => fileInputRef.current?.click()}
                className="rounded-lg px-3 py-2 text-xs font-black uppercase tracking-wide border border-slate-300 bg-white text-slate-700 hover:border-slate-900 flex items-center justify-center gap-2"
              >
                <Upload className="w-3.5 h-3.5" />
                {isZh ? '导入存档' : 'Import Save'}
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
              <p className={`mt-2 text-[11px] font-semibold ${importStatus.ok ? 'text-emerald-600' : 'text-rose-600'}`}>
                {importStatus.message}
              </p>
            )}
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-3 opacity-75">
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-slate-500" />
              <p className="text-sm font-black text-slate-900">{isZh ? '通知' : 'Notifications'}</p>
            </div>
            <p className="mt-1 text-[11px] text-slate-500 font-semibold">
              {isZh ? '后续版本开放。' : 'Coming in a later version.'}
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-3">
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="w-4 h-4 text-cyan-600" />
              <p className="text-sm font-black text-slate-900">{isZh ? 'DEV 面板' : 'DEV Panel'}</p>
            </div>
            <p className="mt-1 text-[11px] text-slate-500 font-semibold">
              {isZh ? '在游戏画面显示或隐藏 DEV 控制面板。' : 'Show or hide the DEV control panel in game view.'}
            </p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <button
                onClick={() => {
                  if (!devToolsAvailable || developerMode) return;
                  toggleDeveloperMode();
                }}
                disabled={!devToolsAvailable || developerMode}
                className={`rounded-lg px-3 py-2 text-xs font-black uppercase tracking-wide border ${
                  developerMode
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-white text-slate-700 border-slate-300'
                } disabled:opacity-45`}
              >
                {isZh ? '开启' : 'Enable'}
              </button>
              <button
                onClick={() => {
                  if (!devToolsAvailable || !developerMode) return;
                  toggleDeveloperMode();
                }}
                disabled={!devToolsAvailable || !developerMode}
                className={`rounded-lg px-3 py-2 text-xs font-black uppercase tracking-wide border ${
                  !developerMode
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-white text-slate-700 border-slate-300'
                } disabled:opacity-45`}
              >
                {isZh ? '关闭' : 'Disable'}
              </button>
            </div>
            {!devToolsAvailable && (
              <p className="mt-2 text-[11px] font-semibold text-amber-600">
                {isZh ? '当前环境未开启 DEV 工具。' : 'DEV tools are unavailable in this environment.'}
              </p>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

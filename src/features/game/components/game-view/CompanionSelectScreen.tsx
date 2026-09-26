import { useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { COMPANION_CANDIDATES } from '../../config/companionCandidates';
import { getPokemonOfficialArtworkUrl, getPokemonSpriteUrl } from '../../../../services/pokeApiEndpoint';
import type { GameViewSectionProps } from './shared';

function CompanionImage({ id, name }: { id: number; name: string }) {
  const [fallback, setFallback] = useState(false);
  return (
    <img
      src={fallback ? getPokemonSpriteUrl(id) : getPokemonOfficialArtworkUrl(id)}
      alt={name}
      onError={() => setFallback(true)}
      className="h-20 w-20 object-contain drop-shadow-md sm:h-24 sm:w-24"
    />
  );
}

export function CompanionSelectScreen({ viewModel }: GameViewSectionProps) {
  const { currentLanguage, confirmCompanion } = viewModel;
  const isZh = currentLanguage.startsWith('zh');
  const shouldReduceMotion = useReducedMotion();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [saveError, setSaveError] = useState(false);

  return (
    <motion.div
      key="companion-select"
      initial={shouldReduceMotion ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className="flex min-h-0 flex-1 flex-col overflow-y-auto px-3 pb-3 text-slate-900 sm:px-5"
    >
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-3 py-3">
        <header className="text-center">
          <h1 className="text-2xl font-black sm:text-3xl">{isZh ? '初遇伙伴' : 'Meet Your Companion'}</h1>
          <p className="mt-1 text-sm leading-5 text-slate-600">
            {isZh ? '从六位伙伴中选一位陪伴你待在基地。确认前可随时改选。' : 'Choose one of six companions for your base. You can change your choice before confirming.'}
          </p>
        </header>
        <div role="group" aria-label={isZh ? '选择基地伙伴' : 'Choose a base companion'} className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3">
          {COMPANION_CANDIDATES.map((candidate) => {
            const selected = selectedId === candidate.id;
            const name = isZh ? candidate.zhName : candidate.enName;
            return (
              <button
                key={candidate.id}
                type="button"
                aria-pressed={selected}
                onClick={() => { setSelectedId(candidate.id); setSaveError(false); }}
                className={`flex min-h-32 flex-col items-center justify-center rounded-2xl border-2 bg-white/95 px-2 py-3 text-center shadow-sm focus-visible:outline-2 focus-visible:outline-blue-700 ${selected ? 'border-blue-600 ring-2 ring-blue-200' : 'border-slate-200'}`}
              >
                <CompanionImage id={candidate.id} name={name} />
                <span className="mt-1 text-sm font-black">{name}</span>
                <span className={`mt-0.5 text-xs font-bold ${selected ? 'text-blue-700' : 'text-slate-500'}`}>
                  {selected ? (isZh ? '已选择' : 'Selected') : (isZh ? '点按选择' : 'Tap to choose')}
                </span>
              </button>
            );
          })}
        </div>
        <div className="sticky bottom-0 z-10 rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-lg backdrop-blur-sm">
          <p className="mb-2 text-center text-xs font-semibold text-slate-600">
            {isZh ? '确认后会绑定当前存档，基地内无法改选。' : 'Confirmation binds this companion to the current save. It cannot be changed at the base.'}
          </p>
          <button
            type="button"
            disabled={selectedId === null}
            onClick={() => {
              if (selectedId !== null && !confirmCompanion(selectedId)) setSaveError(true);
            }}
            className="pf-action-button w-full disabled:cursor-not-allowed disabled:opacity-50"
            data-tone="primary"
          >
            {isZh ? '确认伙伴并进入基地' : 'Confirm companion and enter base'}
          </button>
          {saveError && (
            <p role="alert" className="mt-2 text-center text-xs font-bold text-rose-700">
              {isZh ? '保存失败，选择尚未绑定。请重试。' : 'Save failed. Your choice was not bound. Please try again.'}
            </p>
          )}
        </div>
      </div>
    </motion.div>
  );
}

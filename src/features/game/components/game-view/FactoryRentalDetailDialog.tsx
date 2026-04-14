import { useEffect, useId, useMemo, useRef } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { X } from 'lucide-react';
import type { GamePokemon } from '../../../../types';
import type { LocalizeDescFn, LocalizeFn, TranslateFn } from '../../view-model';
import { PokemonDetailPanel } from './PokemonDetailPanel';

interface FactoryRentalDetailDialogProps {
  pokemon: GamePokemon;
  isZh: boolean;
  t: TranslateFn;
  getLocalized: LocalizeFn;
  getLocalizedDesc: LocalizeDescFn;
  getLocalizedNature: (nature: GamePokemon['nature']) => string;
  getStatName: (stat: string) => string;
  onClose: () => void;
}

export function FactoryRentalDetailDialog({
  pokemon,
  isZh,
  t,
  getLocalized,
  getLocalizedDesc,
  getLocalizedNature,
  getStatName,
  onClose,
}: FactoryRentalDetailDialogProps) {
  const shouldReduceMotion = useReducedMotion();
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const titleId = useId();

  const copy = useMemo(
    () => ({
      title: isZh ? '租借详情' : 'Rental Details',
      close: isZh ? '返回选择' : 'Back to Selection',
    }),
    [isZh],
  );

  useEffect(() => {
    if (typeof document === 'undefined') {
      return undefined;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeButtonRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key !== 'Tab') {
        return;
      }

      const dialog = dialogRef.current;
      if (!dialog) {
        return;
      }

      const focusables = Array.from<HTMLElement>(
        dialog.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'),
      ).filter((element) => !element.hasAttribute('disabled') && element.getAttribute('aria-hidden') !== 'true');

      if (focusables.length === 0) {
        return;
      }

      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement as HTMLElement | null;

      if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      } else if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  return (
    <motion.div
      initial={shouldReduceMotion ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0 }}
      transition={{ duration: shouldReduceMotion ? 0.01 : 0.2, ease: 'easeOut' }}
      className="absolute inset-0 z-40 flex items-center justify-center bg-slate-950/48 p-3 backdrop-blur-[3px] md:p-5"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <motion.div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        initial={shouldReduceMotion ? false : { opacity: 0, y: 12, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 12, scale: 0.98 }}
        transition={{ duration: shouldReduceMotion ? 0.01 : 0.22, ease: 'easeOut' }}
        className="flex max-h-[min(92vh,900px)] w-full max-w-[1120px] flex-col overflow-hidden rounded-[30px] border border-white/75 bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(241,245,249,0.97)_100%)] shadow-[0_36px_80px_rgba(15,23,42,0.34)]"
      >
        <div className="border-b border-slate-200/80 bg-white/[0.78] px-4 py-4 backdrop-blur md:px-6 md:py-5">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-blue-700">
                  {copy.title}
                </span>
                <span className="rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">
                  LV.{pokemon.level}
                </span>
              </div>
              <h3 id={titleId} className={`text-slate-950 ${isZh ? 'text-[28px] font-black' : 'text-[24px] font-black uppercase tracking-[0.05em]'}`}>
                {getLocalized(pokemon)}
              </h3>
            </div>

            <button
              ref={closeButtonRef}
              type="button"
              onClick={onClose}
              className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
              aria-label={copy.close}
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto">
          <PokemonDetailPanel
            pokemon={pokemon}
            isZh={isZh}
            t={t}
            getLocalized={getLocalized}
            getLocalizedDesc={getLocalizedDesc}
            getLocalizedNature={getLocalizedNature}
            getStatName={getStatName}
          />
        </div>

        <div className="border-t border-slate-200/80 bg-white/[0.78] px-4 py-4 md:px-6">
          <div className="flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="min-h-[48px] rounded-[18px] border border-orange-300 bg-orange-500 px-6 py-3 text-sm font-black uppercase tracking-[0.14em] text-white shadow-[0_18px_28px_rgba(249,115,22,0.22)] transition-colors hover:bg-orange-600"
            >
              {copy.close}
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

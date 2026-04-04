import { RefreshCw, Target } from 'lucide-react';
import loadingIllustration from '../../../assets/loading/battle-factory-loading.jpg';

export function LoadingScreen({ message }: { message: string }) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[#020d2a] font-sans text-white">
      <img
        src={loadingIllustration}
        alt=""
        aria-hidden="true"
        className="absolute inset-0 h-full w-full object-cover object-center"
      />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(2,6,23,0.24)_0%,rgba(2,6,23,0.16)_30%,rgba(2,6,23,0.52)_64%,rgba(2,6,23,0.88)_100%)]" />

      <div className="relative z-10 flex min-h-screen items-end justify-center px-4 py-8 md:py-10">
        <div className="w-full max-w-[420px] text-center">
          <div className="relative mx-auto flex h-16 w-16 items-center justify-center">
            <RefreshCw className="h-16 w-16 animate-spin text-cyan-300" />
            <div className="absolute inset-0 flex items-center justify-center">
              <Target className="h-6 w-6 text-fuchsia-300" />
            </div>
          </div>
          <p className="mt-5 text-[24px] font-black tracking-[0.12em] text-cyan-100/96 drop-shadow-[0_0_20px_rgba(56,189,248,0.9)]">
            Loading...
          </p>
          <p className="mt-4 text-sm font-semibold leading-7 text-cyan-50/92 drop-shadow-[0_3px_10px_rgba(2,6,23,0.92)] md:text-[15px]">
            {message}
          </p>
        </div>
      </div>
    </div>
  );
}

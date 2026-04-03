import { RefreshCw, Target } from 'lucide-react';

export function LoadingScreen({ message }: { message: string }) {
  return (
    <div className="min-h-screen bg-white flex items-center justify-center text-slate-900 font-sans">
      <div className="flex flex-col items-center gap-6">
        <div className="relative">
          <RefreshCw className="animate-spin w-16 h-16 text-blue-500" />
          <div className="absolute inset-0 flex items-center justify-center">
            <Target className="w-6 h-6 text-red-500" />
          </div>
        </div>
        <p className="text-2xl font-black tracking-tighter uppercase italic">{message}</p>
      </div>
    </div>
  );
}

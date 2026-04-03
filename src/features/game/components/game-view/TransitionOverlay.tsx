import { motion } from 'motion/react';

export function TransitionOverlay() {
  return (
    <motion.div
      key="transition-overlay"
      initial={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ delay: 1.2 }}
      className="fixed inset-0 z-[100] flex flex-col pointer-events-none"
    >
      <motion.div
        initial={{ y: '-100%' }}
        animate={{ y: '0%' }}
        exit={{ y: '-100%' }}
        transition={{
          duration: 0.6,
          ease: 'circOut',
          exit: { duration: 1.2, ease: [0.45, 0, 0.55, 1] },
        }}
        className="flex-1 bg-red-600 border-b-[12px] border-slate-900 relative"
      >
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 w-40 h-40 bg-white rounded-full border-[12px] border-slate-900 z-10 flex items-center justify-center shadow-[0_0_50px_rgba(0,0,0,0.3)]">
          <div className="w-16 h-16 rounded-full border-[8px] border-slate-100 bg-white shadow-inner" />
        </div>
      </motion.div>

      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: '0%' }}
        exit={{ y: '100%' }}
        transition={{
          duration: 0.6,
          ease: 'circOut',
          exit: { duration: 1.2, ease: [0.45, 0, 0.55, 1] },
        }}
        className="flex-1 bg-white border-t-[12px] border-slate-900"
      />
    </motion.div>
  );
}

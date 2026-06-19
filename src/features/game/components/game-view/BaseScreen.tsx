import type { GameViewSectionProps } from './shared';
import { StartScreen } from './StartScreen';

/**
 * BaseScreen is the dedicated BASE entry container.
 * For now it reuses StartScreen UI and can evolve independently later.
 */
export function BaseScreen({ viewModel }: GameViewSectionProps) {
  return <StartScreen viewModel={viewModel} />;
}

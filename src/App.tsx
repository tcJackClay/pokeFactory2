/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GameView } from './features/game/components/GameView';
import { LoadingScreen } from './features/game/components/LoadingScreen';
import { usePokeFactoryGame } from './features/game/hooks/usePokeFactoryGame';

export default function App() {
  const viewModel = usePokeFactoryGame();

  if (viewModel.loading && (viewModel.gameState === 'BASE' || viewModel.gameState === 'START')) {
    return <LoadingScreen message={viewModel.t('searchingPokemon')} />;
  }

  return <GameView viewModel={viewModel} />;
}

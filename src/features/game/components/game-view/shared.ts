import type { GamePokemon } from '../../../../types';
import type { GameViewModel } from '../../view-model';

export interface GameViewSectionProps {
  viewModel: GameViewModel;
}

export interface PokemonInfoScreenProps extends GameViewSectionProps {
  displayPokemon: GamePokemon;
  isMobileViewport: boolean;
}

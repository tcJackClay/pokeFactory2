import type { GamePokemon } from '../../../../types';
import type { GameViewModel } from '../../view-model';

export interface GameViewSectionProps {
  key?: string;
  viewModel: GameViewModel;
}

export interface PokemonInfoScreenProps extends GameViewSectionProps {
  displayPokemon: GamePokemon;
  pokemonList: GamePokemon[];
  selectedIndex: number;
  isMobileViewport: boolean;
}

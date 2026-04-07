import React from 'react';
import bugIcon from '../assets/icons/types-52poke/bug.png';
import darkIcon from '../assets/icons/types-52poke/dark.png';
import dragonIcon from '../assets/icons/types-52poke/dragon.png';
import electricIcon from '../assets/icons/types-52poke/electric.png';
import fairyIcon from '../assets/icons/types-52poke/fairy.png';
import fightingIcon from '../assets/icons/types-52poke/fighting.png';
import fireIcon from '../assets/icons/types-52poke/fire.png';
import flyingIcon from '../assets/icons/types-52poke/flying.png';
import ghostIcon from '../assets/icons/types-52poke/ghost.png';
import grassIcon from '../assets/icons/types-52poke/grass.png';
import groundIcon from '../assets/icons/types-52poke/ground.png';
import iceIcon from '../assets/icons/types-52poke/ice.png';
import normalIcon from '../assets/icons/types-52poke/normal.png';
import poisonIcon from '../assets/icons/types-52poke/poison.png';
import psychicIcon from '../assets/icons/types-52poke/psychic.png';
import rockIcon from '../assets/icons/types-52poke/rock.png';
import steelIcon from '../assets/icons/types-52poke/steel.png';
import waterIcon from '../assets/icons/types-52poke/water.png';

export type TypeIconProps = React.HTMLAttributes<HTMLSpanElement> & {
  color?: string;
  size?: number | string;
};

export type TypeIconComponent = React.ForwardRefExoticComponent<TypeIconProps & React.RefAttributes<HTMLSpanElement>>;

function createTypeIcon(displayName: string, iconUrl: string): TypeIconComponent {
  const TypeIcon = React.forwardRef<HTMLSpanElement, TypeIconProps>(function TypeIcon(
    { className = '', color, size, style, ...props },
    ref,
  ) {
    const resolvedSize = typeof size === 'number' ? `${size}px` : size;

    return (
      <span
        {...props}
        ref={ref}
        aria-hidden="true"
        className={`inline-block shrink-0 align-middle ${className}`.trim()}
        style={{
          width: resolvedSize,
          height: resolvedSize,
          backgroundColor: color ?? 'currentColor',
          WebkitMaskImage: `url(${iconUrl})`,
          maskImage: `url(${iconUrl})`,
          WebkitMaskPosition: 'center',
          maskPosition: 'center',
          WebkitMaskRepeat: 'no-repeat',
          maskRepeat: 'no-repeat',
          WebkitMaskSize: 'contain',
          maskSize: 'contain',
          ...style,
        }}
      />
    );
  });

  TypeIcon.displayName = displayName;
  return TypeIcon;
}

export const TYPE_ICON_COMPONENTS = {
  normal: createTypeIcon('TypeIconNormal', normalIcon),
  fire: createTypeIcon('TypeIconFire', fireIcon),
  water: createTypeIcon('TypeIconWater', waterIcon),
  electric: createTypeIcon('TypeIconElectric', electricIcon),
  grass: createTypeIcon('TypeIconGrass', grassIcon),
  ice: createTypeIcon('TypeIconIce', iceIcon),
  fighting: createTypeIcon('TypeIconFighting', fightingIcon),
  poison: createTypeIcon('TypeIconPoison', poisonIcon),
  ground: createTypeIcon('TypeIconGround', groundIcon),
  flying: createTypeIcon('TypeIconFlying', flyingIcon),
  psychic: createTypeIcon('TypeIconPsychic', psychicIcon),
  bug: createTypeIcon('TypeIconBug', bugIcon),
  rock: createTypeIcon('TypeIconRock', rockIcon),
  ghost: createTypeIcon('TypeIconGhost', ghostIcon),
  dragon: createTypeIcon('TypeIconDragon', dragonIcon),
  dark: createTypeIcon('TypeIconDark', darkIcon),
  steel: createTypeIcon('TypeIconSteel', steelIcon),
  fairy: createTypeIcon('TypeIconFairy', fairyIcon),
} satisfies Record<string, TypeIconComponent>;

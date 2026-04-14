import type { FactoryTrainerTemplate } from './factoryTrainerTemplates';

export interface FactoryTrainerPresentation {
  displayName: string;
  classLabel: string;
  portraitPath: string;
}

const GENERIC_TRAINER_PORTRAIT_PATH = '/trainers/factory-trainer-generic.svg';
const REFERENCE_TRAINER_PORTRAIT_BASE = '/trainers/reference/front_pics';

const FACILITY_CLASS_LABEL_OVERRIDES: Record<string, string> = {
  FACILITY_CLASS_PKMN_BREEDER_F: 'Pokemon Breeder',
  FACILITY_CLASS_PKMN_BREEDER_M: 'Pokemon Breeder',
  FACILITY_CLASS_PKMN_RANGER_F: 'Pokemon Ranger',
  FACILITY_CLASS_PKMN_RANGER_M: 'Pokemon Ranger',
  FACILITY_CLASS_POKEFAN_F: 'Poke Fan',
  FACILITY_CLASS_POKEFAN_M: 'Poke Fan',
  FACILITY_CLASS_SWIMMING_TRIATHLETE_F: 'Swimming Triathlete',
  FACILITY_CLASS_SWIMMING_TRIATHLETE_M: 'Swimming Triathlete',
  FACILITY_CLASS_RUNNING_TRIATHLETE_F: 'Running Triathlete',
  FACILITY_CLASS_RUNNING_TRIATHLETE_M: 'Running Triathlete',
  FACILITY_CLASS_CYCLING_TRIATHLETE_F: 'Cycling Triathlete',
  FACILITY_CLASS_CYCLING_TRIATHLETE_M: 'Cycling Triathlete',
  FACILITY_CLASS_COOLTRAINER_F: 'Cooltrainer',
  FACILITY_CLASS_COOLTRAINER_M: 'Cooltrainer',
};

const FACILITY_CLASS_TO_REFERENCE_PORTRAIT: Record<string, string> = {
  FACILITY_CLASS_AROMA_LADY: 'aroma_lady.png',
  FACILITY_CLASS_BATTLE_GIRL: 'battle_girl.png',
  FACILITY_CLASS_BEAUTY: 'beauty.png',
  FACILITY_CLASS_BIRD_KEEPER: 'bird_keeper.png',
  FACILITY_CLASS_BLACK_BELT: 'black_belt.png',
  FACILITY_CLASS_BUG_CATCHER: 'bug_catcher.png',
  FACILITY_CLASS_BUG_MANIAC: 'bug_maniac.png',
  FACILITY_CLASS_CAMPER: 'camper.png',
  FACILITY_CLASS_COLLECTOR: 'collector.png',
  FACILITY_CLASS_COOLTRAINER_F: 'cooltrainer_f.png',
  FACILITY_CLASS_COOLTRAINER_M: 'cooltrainer_m.png',
  FACILITY_CLASS_CYCLING_TRIATHLETE_F: 'cycling_triathlete_f.png',
  FACILITY_CLASS_CYCLING_TRIATHLETE_M: 'cycling_triathlete_m.png',
  FACILITY_CLASS_DRAGON_TAMER: 'dragon_tamer.png',
  FACILITY_CLASS_EXPERT_F: 'expert_f.png',
  FACILITY_CLASS_EXPERT_M: 'expert_m.png',
  FACILITY_CLASS_FISHERMAN: 'fisherman.png',
  FACILITY_CLASS_GENTLEMAN: 'gentleman.png',
  FACILITY_CLASS_GUITARIST: 'guitarist.png',
  FACILITY_CLASS_HEX_MANIAC: 'hex_maniac.png',
  FACILITY_CLASS_HIKER: 'hiker.png',
  FACILITY_CLASS_KINDLER: 'kindler.png',
  FACILITY_CLASS_LADY: 'lady.png',
  FACILITY_CLASS_LASS: 'lass.png',
  FACILITY_CLASS_NINJA_BOY: 'ninja_boy.png',
  FACILITY_CLASS_PARASOL_LADY: 'parasol_lady.png',
  FACILITY_CLASS_PICNICKER: 'picnicker.png',
  FACILITY_CLASS_PKMN_BREEDER_F: 'pokemon_breeder_f.png',
  FACILITY_CLASS_PKMN_BREEDER_M: 'pokemon_breeder_m.png',
  FACILITY_CLASS_PKMN_RANGER_F: 'pokemon_ranger_f.png',
  FACILITY_CLASS_PKMN_RANGER_M: 'pokemon_ranger_m.png',
  FACILITY_CLASS_POKEFAN_F: 'pokefan_f.png',
  FACILITY_CLASS_POKEFAN_M: 'pokefan_m.png',
  FACILITY_CLASS_POKEMANIAC: 'pokemaniac.png',
  FACILITY_CLASS_PSYCHIC_F: 'psychic_f.png',
  FACILITY_CLASS_PSYCHIC_M: 'psychic_m.png',
  FACILITY_CLASS_RICH_BOY: 'rich_boy.png',
  FACILITY_CLASS_RUIN_MANIAC: 'ruin_maniac.png',
  FACILITY_CLASS_RUNNING_TRIATHLETE_F: 'running_triathlete_f.png',
  FACILITY_CLASS_RUNNING_TRIATHLETE_M: 'running_triathlete_m.png',
  FACILITY_CLASS_SAILOR: 'sailor.png',
  FACILITY_CLASS_SCHOOL_KID_F: 'school_kid_f.png',
  FACILITY_CLASS_SCHOOL_KID_M: 'school_kid_m.png',
  FACILITY_CLASS_SWIMMER_F: 'swimmer_f.png',
  FACILITY_CLASS_SWIMMER_M: 'swimmer_m.png',
  FACILITY_CLASS_SWIMMING_TRIATHLETE_F: 'swimming_triathlete_f.png',
  FACILITY_CLASS_SWIMMING_TRIATHLETE_M: 'swimming_triathlete_m.png',
  FACILITY_CLASS_TUBER_F: 'tuber_f.png',
  FACILITY_CLASS_TUBER_M: 'tuber_m.png',
  FACILITY_CLASS_YOUNGSTER: 'youngster.png',
};

function toTitleCase(value: string): string {
  return value
    .toLowerCase()
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function formatTrainerName(name: string): string {
  return name
    .toLowerCase()
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function getFactoryTrainerPresentation(trainer: FactoryTrainerTemplate): FactoryTrainerPresentation {
  const classLabel = FACILITY_CLASS_LABEL_OVERRIDES[trainer.facilityClass]
    ?? toTitleCase(trainer.facilityClass.replace(/^FACILITY_CLASS_/, ''));
  const referencePortrait = FACILITY_CLASS_TO_REFERENCE_PORTRAIT[trainer.facilityClass];

  return {
    displayName: formatTrainerName(trainer.trainerName),
    classLabel,
    portraitPath: referencePortrait
      ? `${REFERENCE_TRAINER_PORTRAIT_BASE}/${referencePortrait}`
      : GENERIC_TRAINER_PORTRAIT_PATH,
  };
}

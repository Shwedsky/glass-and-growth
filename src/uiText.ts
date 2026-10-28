import type { Locale } from './i18n';

export type UiTextKey =
  | 'tap_tree_hint'
  | 'tree_help_radial'
  | 'node_opened'
  | 'node_available'
  | 'node_locked'
  | 'node_mystery'
  | 'open_for'
  | 'need_requirements'
  | 'event_water'
  | 'event_light'
  | 'event_bee'
  | 'event_flowers'
  | 'event_pump'
  | 'event_hint'
  | 'object_rain'
  | 'object_pump'
  | 'object_flowers'
  | 'object_hive'
  | 'object_vines';

const copy: Record<Locale, Record<UiTextKey, string>> = {
  ru: {
    tap_tree_hint: 'Тапай по дереву, чтобы ускорять рост',
    tree_help_radial: 'Выбери узел. Зелёный — открыт, золотой — можно открыть, серый — пока заблокирован.',
    node_opened: 'ОТКРЫТО',
    node_available: 'МОЖНО ОТКРЫТЬ',
    node_locked: 'ЗАБЛОКИРОВАНО',
    node_mystery: 'НЕИЗВЕСТНО',
    open_for: 'Открыть за {value}',
    need_requirements: 'Сначала открой предыдущие узлы',
    event_water: 'Собрать воду',
    event_light: 'Поймать солнечный луч',
    event_bee: 'Помочь пчеле',
    event_flowers: 'Ухаживать за цветами',
    event_pump: 'Настроить помпу',
    event_hint: 'АКТИВНОЕ СОБЫТИЕ',
    object_rain: 'Сборщик дождя',
    object_pump: 'Помпа',
    object_flowers: 'Цветочная грядка',
    object_hive: 'Улей',
    object_vines: 'Вьющиеся растения',
  },
  en: {
    tap_tree_hint: 'Tap the tree to accelerate growth',
    tree_help_radial: 'Select a node. Green is unlocked, gold is available, grey is still locked.',
    node_opened: 'UNLOCKED',
    node_available: 'READY TO UNLOCK',
    node_locked: 'LOCKED',
    node_mystery: 'UNKNOWN',
    open_for: 'Unlock for {value}',
    need_requirements: 'Unlock the prerequisite nodes first',
    event_water: 'Collect water',
    event_light: 'Catch a sunbeam',
    event_bee: 'Help the bee',
    event_flowers: 'Tend the flowers',
    event_pump: 'Tune the pump',
    event_hint: 'ACTIVE EVENT',
    object_rain: 'Rain collector',
    object_pump: 'Pump',
    object_flowers: 'Flower bed',
    object_hive: 'Hive',
    object_vines: 'Climbing plants',
  },
};

export function uiText(locale: Locale, key: UiTextKey, vars: Record<string, string | number> = {}): string {
  let value = copy[locale][key];
  for (const [name, replacement] of Object.entries(vars)) value = value.replaceAll(`{${name}}`, String(replacement));
  return value;
}

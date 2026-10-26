export type Locale = 'ru' | 'en';

const STORAGE_KEY = 'glass-and-growth.locale';

const messages = {
  en: {
    growth: 'Growth',
    tap: 'tap',
    discoveries: 'Discoveries',
    back: 'Back to greenhouse',
    reset: 'Reset slice',
    intro: 'The greenhouse is quiet.\nTap anywhere inside to gather Growth.',
    status_world: 'Tap the greenhouse for active Growth. Restore systems to automate it.',
    status_tree: 'Unknown nodes reveal themselves only when their path becomes possible.',
    status_complete: 'The greenhouse is restored. P0 mini-ending reached.',
    tree_title: 'Discovery Tree',
    offline: 'While you were away: +{value} Growth',
    need_more: 'Need {value} more Growth',
    ending_toast: 'The roof opens. The greenhouse breathes.',
    language: 'RU',

    node_sprout_name: 'First Sprout',
    node_sprout_desc: 'A stubborn green shoot pushes through the dry soil.',
    node_pump_name: 'Old Pump',
    node_pump_desc: 'Water returns to the greenhouse pipes.',
    node_planter_name: 'Warm Planter',
    node_planter_desc: 'A dormant planting bed becomes productive again.',
    node_rain_name: 'Rain Collector',
    node_rain_desc: 'The glass roof starts feeding a simple reservoir.',
    node_flowers_name: 'First Flowers',
    node_flowers_desc: 'Colour returns to the beds and the air feels different.',
    node_hive_name: 'A Quiet Buzz',
    node_hive_desc: 'Small visitors make the greenhouse their home.',
    node_pollination_name: 'Pollination',
    node_pollination_desc: 'Flowers and bees begin amplifying one another.',
    node_roof_name: 'Open the Roof',
    node_roof_desc: 'Let the restored greenhouse breathe again.',
  },
  ru: {
    growth: 'Рост',
    tap: 'нажатие',
    discoveries: 'Открытия',
    back: 'Вернуться в оранжерею',
    reset: 'Сбросить прогресс',
    intro: 'В оранжерее тихо.\nНажимай внутри, чтобы накапливать Рост.',
    status_world: 'Нажимай на оранжерею, чтобы получать Рост. Восстанавливай системы для автоматизации.',
    status_tree: 'Неизвестные узлы раскрываются только тогда, когда путь к ним становится возможным.',
    status_complete: 'Оранжерея восстановлена. Мини-финал P0 достигнут.',
    tree_title: 'Дерево открытий',
    offline: 'Пока тебя не было: +{value} Роста',
    need_more: 'Нужно ещё {value} Роста',
    ending_toast: 'Крыша открывается. Оранжерея снова дышит.',
    language: 'EN',

    node_sprout_name: 'Первый росток',
    node_sprout_desc: 'Упрямый зелёный побег пробивается сквозь сухую землю.',
    node_pump_name: 'Старый насос',
    node_pump_desc: 'Вода снова идёт по трубам оранжереи.',
    node_planter_name: 'Тёплая грядка',
    node_planter_desc: 'Спящая грядка снова начинает приносить жизнь.',
    node_rain_name: 'Сбор дождя',
    node_rain_desc: 'Стеклянная крыша начинает наполнять простой резервуар.',
    node_flowers_name: 'Первые цветы',
    node_flowers_desc: 'На грядки возвращаются краски, и воздух будто меняется.',
    node_hive_name: 'Тихое жужжание',
    node_hive_desc: 'Маленькие гости находят в оранжерее новый дом.',
    node_pollination_name: 'Опыление',
    node_pollination_desc: 'Цветы и пчёлы начинают усиливать друг друга.',
    node_roof_name: 'Открыть крышу',
    node_roof_desc: 'Позволь восстановленной оранжерее снова дышать.',
  },
} as const;

export type MessageKey = keyof typeof messages.en;

export function loadLocale(): Locale {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === 'ru' || stored === 'en') return stored;
  return navigator.language.toLowerCase().startsWith('ru') ? 'ru' : 'en';
}

export function saveLocale(locale: Locale): void {
  localStorage.setItem(STORAGE_KEY, locale);
}

export function t(locale: Locale, key: MessageKey, vars: Record<string, string | number> = {}): string {
  let value: string = messages[locale][key];
  for (const [name, replacement] of Object.entries(vars)) {
    value = value.replaceAll(`{${name}}`, String(replacement));
  }
  return value;
}

export function nodeNameKey(id: string): MessageKey {
  return `node_${id}_name` as MessageKey;
}

export function nodeDescriptionKey(id: string): MessageKey {
  return `node_${id}_desc` as MessageKey;
}

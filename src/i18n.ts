export type Locale = 'ru' | 'en';

const STORAGE_KEY = 'glass-and-growth.locale';

const messages = {
  en: {
    growth: 'Growth',
    per_second: '/s',
    tap: 'tap',
    discoveries: 'Discoveries',
    back: 'Back to greenhouse',
    reset: 'Reset progress',
    intro: 'The greenhouse is quiet.\nTap inside to wake the first growth.',
    status_bootstrap: 'Tap to gather Growth and wake the first systems.',
    status_world: 'Tap anywhere to accelerate Growth. Automation is the baseline; active play is faster. Watch for bonus events.',
    status_tree: 'Explore the five branches. Only revealed dependencies are shown.',
    status_complete: 'The greenhouse is alive. Final Bloom reached.',
    tree_title: 'Discovery Tree',
    tree_help: 'Five branches grow downward. Cross-branch links appear only when they become relevant.',
    offline: 'While you were away: +{value} Growth',
    need_more: 'Need {value} more Growth',
    event_reward: '+{value} Growth',
    event_hint: 'Active event',
    ending_toast: 'The roof opens. The final bloom reaches the sky.',
    language: 'RU',
    stage: 'Stage {value}/32',
    branch_water: 'Water',
    branch_plants: 'Plants',
    branch_climate: 'Climate',
    branch_mechanisms: 'Mechanisms',
    branch_life: 'Life',

    node_sprout_name: 'First Sprout', node_sprout_desc: 'A stubborn green shoot breaks through dry soil.',
    node_pump_name: 'Old Pump', node_pump_desc: 'Water begins moving through the old pipes again.',
    node_bed_name: 'Warm Bed', node_bed_desc: 'A dormant planting bed becomes productive.',
    node_gutters_name: 'Roof Gutters', node_gutters_desc: 'Rainwater finally has somewhere useful to go.',
    node_flowers_name: 'First Flowers', node_flowers_desc: 'Colour returns to the greenhouse.',
    node_glass_name: 'Clean Glass', node_glass_desc: 'Dust leaves the panes and sunlight reaches deeper.',
    node_cistern_name: 'Cistern', node_cistern_desc: 'Collected water can now be stored between rains.',
    node_herbs_name: 'Herb Beds', node_herbs_desc: 'Dense useful greenery fills the lower beds.',
    node_gears_name: 'Old Gears', node_gears_desc: 'The greenhouse machinery begins moving again.',
    node_mirrors_name: 'Sun Mirrors', node_mirrors_desc: 'Adjustable mirrors redirect light into dark corners.',
    node_bees_name: 'A Quiet Buzz', node_bees_desc: 'Bees find enough flowers to stay.',
    node_irrigation_name: 'Irrigation Lines', node_irrigation_desc: 'Water reaches the beds without constant attention.',
    node_vines_name: 'Climbing Vines', node_vines_desc: 'Life starts moving vertically along the old frame.',
    node_timer_name: 'Timing Mechanism', node_timer_desc: 'Old mechanisms begin working on a reliable rhythm.',
    node_vents_name: 'Working Vents', node_vents_desc: 'The greenhouse can finally exchange warm, wet air.',
    node_butterflies_name: 'Butterflies', node_butterflies_desc: 'The restored light and flowers attract new visitors.',
    node_filter_name: 'Water Filter', node_filter_desc: 'The water cycle becomes cleaner and more stable.',
    node_pollination_name: 'Pollination', node_pollination_desc: 'Flowers and insects begin amplifying the entire system.',
    node_orchid_name: 'Rare Orchid', node_orchid_desc: 'A demanding plant proves the greenhouse is recovering.',
    node_auto_valves_name: 'Automatic Valves', node_auto_valves_desc: 'Water is redirected without manual adjustment.',
    node_heater_name: 'Old Heater', node_heater_desc: 'A steady source of warmth returns to the building.',
    node_dragonflies_name: 'Dragonflies', node_dragonflies_desc: 'A healthy water habitat brings fast new life.',
    node_pond_name: 'Greenhouse Pond', node_pond_desc: 'A real body of water changes the whole atmosphere.',
    node_humidity_name: 'Humidity Cycle', node_humidity_desc: 'Water and ventilation begin balancing one another.',
    node_canopy_name: 'Living Canopy', node_canopy_desc: 'Leaves spread overhead and reshape the space.',
    node_roof_drive_name: 'Roof Drive', node_roof_drive_desc: 'The heavy roof mechanism can move again.',
    node_climate_name: 'Stable Climate', node_climate_desc: 'Heat, light and ventilation finally hold a healthy balance.',
    node_birds_name: 'First Birds', node_birds_desc: 'The greenhouse now feels safe enough for birds to remain.',
    node_ecosystem_name: 'Living Ecosystem', node_ecosystem_desc: 'Separate systems finally become one living whole.',
    node_central_bud_name: 'Central Bud', node_central_bud_desc: 'The old central plant gathers enough strength to change.',
    node_open_roof_name: 'Open the Roof', node_open_roof_desc: 'Let the restored greenhouse reconnect with the outside world.',
    node_final_bloom_name: 'Final Bloom', node_final_bloom_desc: 'The greenhouse completes its recovery.',
  },
  ru: {
    growth: 'Рост',
    per_second: '/с',
    tap: 'тап',
    discoveries: 'Открытия',
    back: 'Вернуться в оранжерею',
    reset: 'Сбросить прогресс',
    intro: 'В оранжерее тихо.\nНажимай внутри, чтобы пробудить первую жизнь.',
    status_bootstrap: 'Тапай, чтобы накопить Рост и запустить первые системы.',
    status_world: 'Тапай в любом месте, чтобы ускорять Рост. Пассив — база, активная игра быстрее. Следи за бонусными событиями.',
    status_tree: 'Изучай пять ветвей. Показываются только уже актуальные зависимости.',
    status_complete: 'Оранжерея ожила. Финальное цветение достигнуто.',
    tree_title: 'Дерево открытий',
    tree_help: 'Пять ветвей идут вниз. Межветочные связи появляются только когда становятся актуальны.',
    offline: 'Пока тебя не было: +{value} Роста',
    need_more: 'Нужно ещё {value} Роста',
    event_reward: '+{value} Роста',
    event_hint: 'Активное событие',
    ending_toast: 'Крыша открывается. Финальный цветок тянется к небу.',
    language: 'EN',
    stage: 'Этап {value}/32',
    branch_water: 'Вода',
    branch_plants: 'Растения',
    branch_climate: 'Климат',
    branch_mechanisms: 'Механизмы',
    branch_life: 'Жизнь',

    node_sprout_name: 'Первый росток', node_sprout_desc: 'Упрямый зелёный побег пробивается сквозь сухую землю.',
    node_pump_name: 'Старый насос', node_pump_desc: 'Вода снова начинает двигаться по старым трубам.',
    node_bed_name: 'Тёплая грядка', node_bed_desc: 'Спящая грядка вновь становится плодородной.',
    node_gutters_name: 'Водостоки', node_gutters_desc: 'Дождевая вода наконец направляется туда, где нужна.',
    node_flowers_name: 'Первые цветы', node_flowers_desc: 'В оранжерею возвращаются краски.',
    node_glass_name: 'Чистые стёкла', node_glass_desc: 'Пыль уходит, и солнечный свет проникает глубже.',
    node_cistern_name: 'Цистерна', node_cistern_desc: 'Теперь дождевую воду можно запасать.',
    node_herbs_name: 'Грядки с травами', node_herbs_desc: 'Нижние грядки заполняются плотной зеленью.',
    node_gears_name: 'Старые шестерни', node_gears_desc: 'Механизмы оранжереи снова начинают двигаться.',
    node_mirrors_name: 'Солнечные зеркала', node_mirrors_desc: 'Зеркала направляют свет в тёмные участки.',
    node_bees_name: 'Тихое жужжание', node_bees_desc: 'Цветов достаточно, чтобы пчёлы остались.',
    node_irrigation_name: 'Система полива', node_irrigation_desc: 'Вода поступает к растениям без постоянного участия.',
    node_vines_name: 'Вьющиеся лозы', node_vines_desc: 'Жизнь поднимается вверх по старому каркасу.',
    node_timer_name: 'Часовой механизм', node_timer_desc: 'Старые устройства начинают работать в устойчивом ритме.',
    node_vents_name: 'Рабочие форточки', node_vents_desc: 'Оранжерея снова умеет выпускать тёплый влажный воздух.',
    node_butterflies_name: 'Бабочки', node_butterflies_desc: 'Свет и цветы привлекают новых гостей.',
    node_filter_name: 'Фильтр воды', node_filter_desc: 'Водный цикл становится чище и стабильнее.',
    node_pollination_name: 'Опыление', node_pollination_desc: 'Цветы и насекомые начинают усиливать всю систему.',
    node_orchid_name: 'Редкая орхидея', node_orchid_desc: 'Требовательное растение доказывает, что среда восстановилась.',
    node_auto_valves_name: 'Автоматические клапаны', node_auto_valves_desc: 'Вода перенаправляется без ручной настройки.',
    node_heater_name: 'Старый обогреватель', node_heater_desc: 'В здание возвращается стабильное тепло.',
    node_dragonflies_name: 'Стрекозы', node_dragonflies_desc: 'Здоровая водная среда приносит новую жизнь.',
    node_pond_name: 'Пруд', node_pond_desc: 'Настоящий водоём меняет атмосферу всей оранжереи.',
    node_humidity_name: 'Цикл влажности', node_humidity_desc: 'Вода и вентиляция начинают уравновешивать друг друга.',
    node_canopy_name: 'Живой полог', node_canopy_desc: 'Листва заполняет верхний уровень и меняет пространство.',
    node_roof_drive_name: 'Привод крыши', node_roof_drive_desc: 'Тяжёлый механизм крыши снова способен двигаться.',
    node_climate_name: 'Стабильный климат', node_climate_desc: 'Тепло, свет и вентиляция приходят в равновесие.',
    node_birds_name: 'Первые птицы', node_birds_desc: 'Оранжерея становится достаточно безопасной для птиц.',
    node_ecosystem_name: 'Живая экосистема', node_ecosystem_desc: 'Разрозненные системы становятся единым живым целым.',
    node_central_bud_name: 'Центральный бутон', node_central_bud_desc: 'Старое центральное растение набирает силы для перемены.',
    node_open_roof_name: 'Открыть крышу', node_open_roof_desc: 'Соедини восстановленную оранжерею с внешним миром.',
    node_final_bloom_name: 'Финальное цветение', node_final_bloom_desc: 'Восстановление оранжереи завершено.',
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
  for (const [name, replacement] of Object.entries(vars)) value = value.replaceAll(`{${name}}`, String(replacement));
  return value;
}

export function nodeNameKey(id: string): MessageKey {
  return `node_${id}_name` as MessageKey;
}

export function nodeDescriptionKey(id: string): MessageKey {
  return `node_${id}_desc` as MessageKey;
}

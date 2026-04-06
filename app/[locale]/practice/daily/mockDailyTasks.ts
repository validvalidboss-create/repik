export type TaskType = "word" | "video" | "practice" | "theory";
export type DailyTask = {
  id: string;
  type: TaskType;
  title: string;
  prompt?: string;
  image?: string;
  video?: { src: string; poster?: string };
  options?: string[];
  answer?: string | string[];
  steps?: string[]; // for practice ordering
};

export function getDailyTasks(): DailyTask[] {
  return [
    { id: "w1", type: "word", title: "Слово: mast", prompt: "Выберите перевод слова 'mast'", image: "https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=800&q=70", options: ["мачта", "парус", "киль"], answer: "мачта" },
    { id: "w2", type: "word", title: "Слово: boom", prompt: "Выберите перевод 'boom'", options: ["гику", "шкот", "мачта"], answer: "гику" },
    { id: "w3", type: "word", title: "Слово: harness", prompt: "Выберите перевод 'harness'", options: ["трапеція", "весло", "лист"], answer: "трапеція" },

    { id: "v1", type: "video", title: "Видео: Правильный водный старт", video: { src: "https://www.w3schools.com/html/mov_bbb.mp4", poster: "https://images.unsplash.com/photo-1501785888041-af3ef285b470?w=800&q=70" }, prompt: "После просмотра выберите верный ответ", options: ["Сначала парус под ветер", "Сначала корпус в воду"], answer: "Сначала парус под ветер" },
    { id: "v2", type: "video", title: "Видео: Разворот через фордевинд", video: { src: "https://www.w3schools.com/html/movie.mp4" }, prompt: "Какой шаг идёт первым?", options: ["Переносим хват на гик", "Переносим ноги"], answer: "Переносим хват на гик" },

    { id: "p1", type: "practice", title: "Практика: порядок хамбак", prompt: "Соберите шаги по порядку", steps: ["Набираем скорость", "Смещаем вес назад", "Поворачиваем парус", "Меняем стойку"] },
    { id: "p2", type: "practice", title: "Практика: фордевинд", prompt: "Расставьте шаги", steps: ["Поджимаем парус", "Проходим по ветру", "Смена рук", "Выход"] },

    { id: "t1", type: "theory", title: "Теория: правила безопасности", prompt: "Что НЕ верно?", options: ["Всегда в жилете", "Не смотреть по сторонам"], answer: "Не смотреть по сторонам" },
  ];
}

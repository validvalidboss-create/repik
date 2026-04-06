export type MockTutor = {
  slug: string;
  name: string;
  subjects: string[];
  languages: string[];
  rateCents: number;
  currency: string;
  rating: number;
  ratingCount: number;
  bio: string;
};

export const MOCK_TUTORS: MockTutor[] = [
  {
    slug: "olena-english",
    name: "Olena K.",
    subjects: ["english"],
    languages: ["uk", "en"],
    rateCents: 30000,
    currency: "UAH",
    rating: 4.9,
    ratingCount: 12,
    bio: "Підготовка до співбесід, бізнес-англійська, розмовна практика.",
  },
  {
    slug: "dmytro-math",
    name: "Dmytro P.",
    subjects: ["math"],
    languages: ["uk", "ru"],
    rateCents: 25000,
    currency: "UAH",
    rating: 4.7,
    ratingCount: 8,
    bio: "ЗНО/НМТ, олімпіади, підготовка до вступу.",
  },
  {
    slug: "maksym-physics",
    name: "Maksym B.",
    subjects: ["physics"],
    languages: ["uk", "en"],
    rateCents: 28000,
    currency: "UAH",
    rating: 4.8,
    ratingCount: 20,
    bio: "Шкільна програма і поглиблена фізика, підготовка до НМТ.",
  },
  {
    slug: "ira-ukrainian",
    name: "Ira S.",
    subjects: ["ukrainian"],
    languages: ["uk"],
    rateCents: 20000,
    currency: "UAH",
    rating: 4.6,
    ratingCount: 15,
    bio: "Українська мова та література, підготовка до НМТ.",
  },
  {
    slug: "yulia-german",
    name: "Yulia H.",
    subjects: ["german"],
    languages: ["uk", "de"],
    rateCents: 35000,
    currency: "UAH",
    rating: 5.0,
    ratingCount: 5,
    bio: "Німецька для роботи та переїзду, розмовна практика.",
  },
];

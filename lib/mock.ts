export type MockTutor = {
  id: string;
  name: string;
  avatar?: string;
  subjects: string[];
  languages: string[];
  rateCents: number;
  currency: string;
  rating: number;
  ratingCount: number;
  bio: string;
};

export const mockTutors: MockTutor[] = [
  {
    id: "t1",
    name: "Olena K.",
    subjects: ["english"],
    languages: ["uk", "en"],
    rateCents: 30000,
    currency: "UAH",
    rating: 4.9,
    ratingCount: 142,
    bio: "CELTA certified English tutor with 7+ years experience.",
  },
  {
    id: "t2",
    name: "Dmytro P.",
    subjects: ["math"],
    languages: ["uk", "ru"],
    rateCents: 25000,
    currency: "UAH",
    rating: 4.8,
    ratingCount: 96,
    bio: "Math olympiad mentor. Personalized approach.",
  },
  {
    id: "t3",
    name: "Anna S.",
    subjects: ["german"],
    languages: ["uk", "ru", "de"],
    rateCents: 35000,
    currency: "UAH",
    rating: 4.7,
    ratingCount: 58,
    bio: "Native-level German for work and study.",
  },
];

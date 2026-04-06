import { NextRequest } from "next/server";
import { promises as fs } from "fs";
import path from "path";

export async function GET(_req: NextRequest) {
  const levels = [
    { code: "A1", title: "Beginner" },
    { code: "A2", title: "Elementary" },
    { code: "B1", title: "Intermediate" },
    { code: "B2", title: "Upper-Intermediate" },
    { code: "C1", title: "Advanced" },
    { code: "C2", title: "Proficient" },
  ];

  const categoriesByLevel: Record<string, Array<{ slug: string; title: string; image?: string }>> = {
    A1: [
      { slug: "transportation", title: "Transportation" },
      { slug: "food-and-drinks", title: "Food and Drinks" },
      { slug: "famous-people", title: "Famous People" },
    ],
    A2: [
      { slug: "stories", title: "Stories" },
    ],
    B1: [
      { slug: "science", title: "Science" },
      { slug: "sports", title: "Sports" },
      { slug: "animals", title: "Animals" },
    ],
    B2: [
      { slug: "science", title: "Science" },
      { slug: "geography", title: "Geography" },
    ],
    C1: [
      { slug: "arts", title: "Arts" },
      { slug: "technology", title: "Technology" },
    ],
    C2: [
      { slug: "philosophy", title: "Philosophy" },
      { slug: "economics", title: "Economics" },
    ],
  };

  const filePath = path.join(process.cwd(), "public", "books", "the-little-prince.txt");
  let lpCount = 27;
  try {
    const raw = await fs.readFile(filePath, "utf8");
    const parts = raw.split(/\n\s*Chapter\s+([IVXLC]+|\d+)\s*\n/i);
    lpCount = Math.max(1, Math.floor(parts.length / 2));
  } catch {}

  const booksByLevelCategory: Record<string, Record<string, Array<{ id: string; title: string; chaptersCount: number }>>> = {
    A2: {
      stories: [
        { id: "little-prince", title: "The Little Prince", chaptersCount: lpCount },
      ],
    },
    B1: {
      science: [
        { id: "space-exploration", title: "Space Exploration", chaptersCount: 10 },
        { id: "scientists", title: "Scientists", chaptersCount: 40 },
      ],
    },
  };

  return Response.json({ levels, categoriesByLevel, booksByLevelCategory });
}

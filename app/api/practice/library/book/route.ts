import { NextRequest } from "next/server";
import { promises as fs } from "fs";
import path from "path";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const level = searchParams.get("level") || "B1";
  const category = searchParams.get("category");
  const bookId = searchParams.get("book") || "scientists";

  const books: Record<string, any> = {
    B1: {
      science: {
        "space-exploration": {
          id: "space-exploration",
          title: "Space Exploration",
          level: "B1",
          chaptersCount: 10,
          description: "Stories about exploring space.",
          content: [
            { type: "h2", text: "The Early Days" },
            { type: "p", text: "Space exploration began with early rocketry and the dreams of scientists and writers." },
            { type: "img", src: "https://images.unsplash.com/photo-1446776811953-b23d57bd21aa?w=1200&q=80", alt: "Rocket" },
            { type: "p", text: "In 1969, humans first walked on the Moon. Since then, probes have visited every planet." },
          ],
          chapters: [
            { id: "1", title: "Early Rockets", duration: 90 },
            { id: "2", title: "Moon Landing", duration: 95 },
          ],
          audio: { src: "https://samplelib.com/lib/preview/mp3/sample-6s.mp3", duration: 95 },
        },
        scientists: {
          id: "scientists",
          title: "Scientists",
          level: "B1",
          chaptersCount: 40,
          description: "Short stories about famous scientists.",
          content: [
            { type: "h2", text: "Albert Einstein" },
            { type: "p", text: "Albert Einstein was a theoretical physicist who developed the theory of relativity." },
            { type: "img", src: "https://images.unsplash.com/photo-1542751110-97427bbecf20?w=1200&q=80", alt: "Science" },
            { type: "p", text: "He received the 1921 Nobel Prize in Physics for his explanation of the photoelectric effect." },
          ],
          chapters: [
            { id: "1", title: "Albert Einstein", duration: 90 },
            { id: "2", title: "Isaac Newton", duration: 85 },
            { id: "3", title: "Marie Curie", duration: 80 },
          ],
          audio: { src: "https://samplelib.com/lib/preview/mp3/sample-6s.mp3", duration: 90 },
        },
      },
    },
    A2: {
      "clothes-and-fashion": {
        "casual-tops": {
          id: "casual-tops",
          title: "Casual Tops",
          level: "A2",
          chaptersCount: 6,
          description: "Everyday clothes descriptions and vocabulary.",
          content: [
            { type: "h2", text: "T‑Shirt" },
            { type: "p", text: "The T‑shirt is one of the most popular and versatile items of clothing in the world today." },
            { type: "img", src: "https://images.unsplash.com/photo-1520975922284-8b456906c813?w=1200&q=80", alt: "T‑Shirt" },
            { type: "p", text: "It is a staple for people of all ages, and it is worn for all kinds of occasions." },
          ],
          chapters: [
            { id: "1", title: "T-shirts", duration: 70 },
            { id: "2", title: "Shirts", duration: 75 },
          ],
          audio: { src: "https://samplelib.com/lib/preview/mp3/sample-3s.mp3", duration: 75 },
        },
      },
      stories: {
        "little-prince": await buildLittlePrinceFromFile().catch(() => ({
          id: "little-prince",
          title: "The Little Prince",
          level: "A2",
          chaptersCount: 3,
          description: "Antoine de Saint‑Exupéry’s classic tale about a boy from a small planet who travels and learns what truly matters.",
          content: [
            { type: "h2", text: "Chapter I" },
            { type: "p", text: "Once when I was six years old I saw a magnificent picture in a book..." },
            { type: "h2", text: "Chapter II" },
            { type: "p", text: "So I lived my life alone, until I had an accident with my plane in the Desert of Sahara..." },
            { type: "h2", text: "Chapter III" },
            { type: "p", text: "It took me a long time to learn where he came from..." },
          ],
          chapters: [
            { id: "1", title: "Chapter I", duration: 300 },
            { id: "2", title: "Chapter II", duration: 300 },
            { id: "3", title: "Chapter III", duration: 300 },
          ],
          audio: { src: "https://samplelib.com/lib/preview/mp3/sample-12s.mp3", duration: 120 },
        })),
      },
    },
  };

  let book = undefined as any;
  if (category) {
    book = books[level]?.[category]?.[bookId];
  } else {
    const cats = books[level] || {};
    for (const c of Object.keys(cats)) {
      if (cats[c]?.[bookId]) { book = cats[c][bookId]; break; }
    }
  }
  if (!book) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json(book);
}

async function buildLittlePrinceFromFile() {
  const filePath = path.join(process.cwd(), "public", "books", "the-little-prince.txt");
  const raw = await fs.readFile(filePath, "utf8");
  // Split by Chapter headings like: Chapter I / Chapter 1
  const parts = raw.split(/\n\s*Chapter\s+([IVXLC]+|\d+)\s*\n/i);
  // parts like [pre, chapNum1, rest1, chapNum2, rest2, ...]
  const chapters: Array<{ id: string; title: string; text: string }> = [];
  for (let i = 1; i < parts.length; i += 2) {
    const num = parts[i];
    const body = parts[i + 1] || "";
    const title = `Chapter ${num}`;
    chapters.push({ id: String(chapters.length + 1), title, text: body.trim() });
  }
  // Build content blocks for ALL chapters
  const images = [
    "https://images.unsplash.com/photo-1519681393784-d120267933ba?w=1200&q=80",
    "https://images.unsplash.com/photo-1501785888041-af3ef285b470?w=1200&q=80",
    "https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=1200&q=80",
    "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?w=1200&q=80",
  ];
  const content: any[] = [];
  chapters.forEach((ch, idx) => {
    content.push({ type: "h2", text: ch.title });
    const img = images[idx % images.length];
    if (img) content.push({ type: "img", src: img, alt: ch.title });
    ch.text.split(/\n+/).filter(Boolean).forEach(p => content.push({ type: "p", text: p.trim() }));
  });
  return {
    id: "little-prince",
    title: "The Little Prince",
    level: "A2",
    chaptersCount: chapters.length || 1,
    description: "Antoine de Saint‑Exupéry’s classic tale about a boy from a small planet who travels and learns what truly matters.",
    content,
    chapters: chapters.map((c) => ({ id: c.id, title: c.title, duration: estimateDuration(c.text) })),
    audio: { src: "https://samplelib.com/lib/preview/mp3/sample-12s.mp3", duration: 120 },
  };
}

function estimateDuration(text: string) {
  try {
    const words = text.replace(/\s+/g, " ").trim().split(" ").filter(Boolean).length;
    return Math.max(90, Math.min(600, Math.round(words / 2)));
  } catch {
    return 120;
  }
}

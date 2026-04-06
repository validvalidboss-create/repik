import { NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const level = searchParams.get("level") || "B1";
  const category = searchParams.get("category") || "science";
  const book = searchParams.get("book") || "scientists";
  const id = searchParams.get("id") || "1";

  // Very small mock data: key path level/category/book -> chapters
  const chapters: Record<string, any> = {
    B1: {
      science: {
        scientists: {
          "1": {
            id: "1",
            title: "Albert Einstein",
            sub: [
              { tag: "1.1", text: "Albert Einstein was a theoretical physicist who developed the theory of relativity." },
              { tag: "1.2", text: "He was born in 1879 in Ulm, Germany." },
              { tag: "1.3", text: "Einstein received the 1921 Nobel Prize in Physics." },
            ],
            audio: { src: "https://samplelib.com/lib/preview/mp3/sample-6s.mp3", duration: 90 },
          },
          "2": {
            id: "2",
            title: "Isaac Newton",
            sub: [
              { tag: "1.1", text: "Isaac Newton formulated the laws of motion and universal gravitation." },
              { tag: "1.2", text: "He published the Principia Mathematica in 1687." },
            ],
            audio: { src: "https://samplelib.com/lib/preview/mp3/sample-6s.mp3", duration: 85 },
          },
        },
      },
    },
    A2: {
      "clothes-and-fashion": {
        "casual-tops": {
          "1": {
            id: "1",
            title: "T-shirts",
            sub: [
              { tag: "1.1", text: "T-shirts are casual tops usually made of cotton." },
              { tag: "1.2", text: "They are comfortable and popular around the world." },
            ],
            audio: { src: "https://samplelib.com/lib/preview/mp3/sample-3s.mp3", duration: 70 },
          },
        },
      },
    },
  };

  const chapter = chapters[level]?.[category]?.[book]?.[id];
  if (!chapter) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json(chapter);
}

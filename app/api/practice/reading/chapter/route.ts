import { NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const bookId = searchParams.get("bookId") || "scientists";
  const id = searchParams.get("id") || "1";

  const chapters: Record<string, Record<string, any>> = {
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
        title: "Marie Curie",
        sub: [
          { tag: "1.1", text: "Marie Curie was a physicist and chemist who conducted pioneering research on radioactivity." },
          { tag: "1.2", text: "She was the first woman to win a Nobel Prize." },
        ],
        audio: { src: "https://samplelib.com/lib/preview/mp3/sample-6s.mp3", duration: 85 },
      },
    },
    "casual-tops": {
      "1": {
        id: "1",
        title: "T-shirts",
        sub: [
          { tag: "1.1", text: "T-shirts are casual tops usually made of cotton." },
          { tag: "1.2", text: "They come in many colors and styles." },
        ],
        audio: { src: "https://samplelib.com/lib/preview/mp3/sample-3s.mp3", duration: 70 },
      },
    },
  };

  const chapter = chapters[bookId]?.[id] || chapters["scientists"]["1"];
  return Response.json(chapter);
}

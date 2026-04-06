import { NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const bookId = searchParams.get("bookId") || "scientists";

  const books: Record<string, any> = {
    scientists: {
      id: "scientists",
      title: "Scientists",
      level: "Beginner",
      cover: "/images/reading/scientists.jpg",
      chaptersCount: 3,
      description: "Short stories about famous scientists.",
      chapters: [
        { id: "1", title: "Albert Einstein", duration: 90 },
        { id: "2", title: "Marie Curie", duration: 85 },
        { id: "3", title: "Isaac Newton", duration: 80 },
      ],
      audio: {
        src: "https://samplelib.com/lib/preview/mp3/sample-6s.mp3",
        duration: 90,
      },
    },
    "casual-tops": {
      id: "casual-tops",
      title: "Casual Tops",
      level: "Intermediate",
      cover: "/images/reading/casual-tops.jpg",
      chaptersCount: 2,
      description: "Everyday clothes descriptions and vocabulary.",
      chapters: [
        { id: "1", title: "T-shirts", duration: 70 },
        { id: "2", title: "Shirts", duration: 75 },
      ],
      audio: {
        src: "https://samplelib.com/lib/preview/mp3/sample-3s.mp3",
        duration: 75,
      },
    },
  };

  const book = books[bookId] || books["scientists"];
  return Response.json(book);
}

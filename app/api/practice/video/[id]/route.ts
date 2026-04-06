import { NextRequest } from "next/server";

const VIDEOS: any = {
  video_1: {
    id: "video_1",
    title: "At the Airport",
    level: "A2",
    duration: 35,
    poster: "https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=1200&q=80",
    src: "https://www.w3schools.com/html/mov_bbb.mp4",
    description: "Basic phrases at the airport.",
    subtitles: [
      { timeStart: 0.0, timeEnd: 3.0, text: "Good morning. Where is the check-in desk?" },
      { timeStart: 3.1, timeEnd: 6.5, text: "The man is checking his luggage at the airport." },
      { timeStart: 6.6, timeEnd: 10.0, text: "Please show your passport and ticket." },
    ],
    exercises: [
      { type: "multiple_choice", question: "The man is ... his luggage.", options: ["checking", "cooking", "throwing"], answer: "checking" },
      { type: "translate", text: "boarding", answer: "садиться на самолёт" },
    ],
  },
  video_2: {
    id: "video_2",
    title: "On the Bus",
    level: "A1",
    duration: 20,
    poster: "https://images.unsplash.com/photo-1501785888041-af3ef285b470?w=1200&q=80",
    src: "https://samplelib.com/lib/preview/mp4/sample-5s.mp4",
    description: "Simple travel phrases on a bus.",
    subtitles: [
      { timeStart: 0.0, timeEnd: 2.5, text: "Good morning. Where does this bus go?" },
      { timeStart: 2.6, timeEnd: 5.0, text: "It goes to the city center." },
    ],
    exercises: [
      { type: "multiple_choice", question: "What greeting is used?", options: ["Good morning", "Good night"], answer: "Good morning" },
    ],
  },
};

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const resolvedParams: any = typeof (params as any)?.then === "function" ? await (params as any) : params;
  const id = String(resolvedParams?.id || "");
  const v = (VIDEOS as any)[id];
  if (!v) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json(v);
}

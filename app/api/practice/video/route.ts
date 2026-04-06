import { NextRequest } from "next/server";

export async function GET(_req: NextRequest) {
  const videos = [
    {
      id: "video_1",
      title: "At the Airport",
      level: "A2",
      duration: 35,
      poster: "https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=800&q=70",
      description: "Basic phrases at the airport.",
      progress: 0,
    },
    {
      id: "video_2",
      title: "On the Bus",
      level: "A1",
      duration: 20,
      poster: "https://images.unsplash.com/photo-1501785888041-af3ef285b470?w=800&q=70",
      description: "Simple travel phrases on a bus.",
      progress: 0,
    },
    {
      id: "video_3",
      title: "At the Cafe",
      level: "A1",
      duration: 28,
      poster: "https://images.unsplash.com/photo-1498654200943-1088dd4438ae?w=800&q=70",
      description: "Ordering coffee and snacks.",
      progress: 0,
    },
    {
      id: "video_4",
      title: "Hotel Check-in",
      level: "A2",
      duration: 32,
      poster: "https://images.unsplash.com/photo-1528909514045-2fa4ac7a08ba?w=800&q=70",
      description: "Checking in at a hotel reception.",
      progress: 0,
    },
    {
      id: "video_5",
      title: "Job Interview Tips",
      level: "B1",
      duration: 45,
      poster: "https://images.unsplash.com/photo-1521737604893-d14cc237f11d?w=800&q=70",
      description: "Common interview questions and answers.",
      progress: 0,
    },
    {
      id: "video_6",
      title: "At the Doctor's",
      level: "B1",
      duration: 38,
      poster: "https://images.unsplash.com/photo-1579684385127-1ef15d508118?w=800&q=70",
      description: "Describing symptoms and getting advice.",
      progress: 0,
    },
    {
      id: "video_7",
      title: "Tech News Briefing",
      level: "B2",
      duration: 50,
      poster: "https://images.unsplash.com/photo-1518770660439-4636190af475?w=800&q=70",
      description: "Latest technology headlines.",
      progress: 0,
    },
    {
      id: "video_8",
      title: "Environmental Report",
      level: "C1",
      duration: 60,
      poster: "https://images.unsplash.com/photo-1432821596592-e2c18b78144f?w=800&q=70",
      description: "Discussion on climate policies.",
      progress: 0,
    },
    {
      id: "video_9",
      title: "Academic Lecture: Economics",
      level: "C2",
      duration: 75,
      poster: "https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=800&q=70",
      description: "Complex macroeconomic concepts.",
      progress: 0,
    },
  ];

  return Response.json({ videos });
}

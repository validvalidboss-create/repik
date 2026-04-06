import { NextRequest } from "next/server";

export async function GET(_req: NextRequest) {
  // Mock 5–8 mixed tasks
  const tasks = [
    {
      id: "daily_1",
      type: "translate",
      question: "cat",
      answer: "кіт",
      options: ["кіт", "пес", "стілець"],
    },
    {
      id: "daily_2",
      type: "flashcards",
      word: "apple",
      translation: "яблуко",
    },
    {
      id: "daily_3",
      type: "listen_choose",
      audio: "https://files.freemusicarchive.org/storage-freemusicarchive-org/music/no_curator/Glitch/Glass/Glitch_-_01_-_Short_Audio_Sample.mp3",
      question: "Що ви почули?",
      options: ["Hello", "Goodbye", "Thanks"],
      answer: "Hello",
    },
    {
      id: "daily_4",
      type: "mini_reading",
      passage: "Tom has a cat. The cat likes milk.",
      question: "Що любить кіт?",
      options: ["milk", "water", "bread"],
      answer: "milk",
    },
    {
      id: "daily_5",
      type: "matching",
      pairs: [
        { left: "apple", right: "яблуко" },
        { left: "dog", right: "пес" },
        { left: "house", right: "дім" },
      ],
    },
    {
      id: "daily_6",
      type: "translate",
      question: "travel",
      answer: "подорож",
      options: ["подорож", "робота", "їжа"],
    },
    {
      id: "daily_7",
      type: "flashcards",
      word: "school",
      translation: "школа",
    },
  ].slice(0, 7);

  return Response.json({ tasks });
}

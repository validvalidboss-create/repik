import { NextRequest } from "next/server";

export async function GET(_req: NextRequest) {
  const categories = [
    {
      category: "Food",
      level: "A1",
      blocks: [
        {
          id: "food_1",
          words: [
            { word: "apple", translation: "яблуко", status: "new" },
            { word: "bread", translation: "хліб", status: "learning" },
            { word: "water", translation: "вода", status: "learned" },
            { word: "milk", translation: "молоко", status: "new" },
            { word: "egg", translation: "яйце", status: "new" },
            { word: "cheese", translation: "сир", status: "learning" },
            { word: "soup", translation: "суп", status: "new" },
            { word: "salt", translation: "сіль", status: "new" },
          ],
        },
      ],
    },
    {
      category: "Travel",
      level: "A2",
      blocks: [
        {
          id: "travel_1",
          words: [
            { word: "airport", translation: "аеропорт", status: "new" },
            { word: "ticket", translation: "квиток", status: "learning" },
            { word: "train", translation: "потяг", status: "learned" },
            { word: "bus", translation: "автобус", status: "new" },
            { word: "hotel", translation: "готель", status: "new" },
            { word: "map", translation: "карта", status: "learning" },
            { word: "luggage", translation: "багаж", status: "new" },
            { word: "passport", translation: "паспорт", status: "new" },
          ],
        },
      ],
    },
  ];

  return Response.json({ categories });
}

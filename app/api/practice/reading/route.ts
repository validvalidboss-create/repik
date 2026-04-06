import { NextRequest } from "next/server";

export async function GET(_req: NextRequest) {
  // Mock categories and demo readings
  const categories = [
    { slug: "famous-people", title: "Famous People", books: 8, level: "Intermediate", premium: true, image: "/images/reading/famous.jpg" },
    { slug: "food-and-drinks", title: "Food and Drinks", books: 9, level: "A1", premium: true, image: "/images/reading/food.jpg" },
    { slug: "transportation", title: "Transportation", books: 6, level: "Beginner", premium: false, image: "/images/reading/transport.jpg" },
    { slug: "clothes-fashion", title: "Clothes and Fashion", books: 7, level: "Intermediate", premium: false, image: "/images/reading/clothes.jpg" },
    { slug: "animals", title: "Animals", books: 5, level: "A1", premium: false, image: "/images/reading/animals.jpg" },
  ];

  const demo = [
    { id: "scientists", title: "Scientists", level: "Beginner", cover: "/images/reading/scientists.jpg", premium: false, chaptersCount: 40 },
    { id: "casual-tops", title: "Casual Tops", level: "Intermediate", cover: "/images/reading/casual-tops.jpg", premium: false, chaptersCount: 24 },
  ];

  const categoryBooks: Record<string, Array<{ id: string; title: string; premium?: boolean }>> = {
    transportation: [
      { id: "car-companies", title: "Car Companies" },
      { id: "cars-and-motorcycles", title: "Cars and Motorcycles" },
      { id: "water-transportation", title: "Water Transportation" },
    ],
    "clothes-fashion": [
      { id: "casual-tops", title: "Casual Tops" },
      { id: "street-fashion", title: "Street Fashion" },
      { id: "footwear", title: "Footwear", premium: true },
    ],
  };

  return Response.json({ categories, demo, categoryBooks });
}

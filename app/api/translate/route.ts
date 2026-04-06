import { NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const text = (searchParams.get("text") || "").trim();
  const from = searchParams.get("from") || "en";
  const to = searchParams.get("to") || "uk";
  if (!text) return Response.json({ error: "No text" }, { status: 400 });
  // Try external provider (LibreTranslate-compatible) if configured
  const LT_URL = process.env.LIBRETRANSLATE_URL; // e.g. https://libretranslate.com/translate
  try {
    if (LT_URL) {
      const res = await fetch(LT_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ q: text, source: from, target: to, format: "text" }),
      });
      if (res.ok) {
        const data: any = await res.json();
        const translated = data.translatedText || data.translation || "";
        if (translated) {
          return Response.json({ from, to, text, translated, definitions: [translated], phonetic: "" });
        }
      }
    }
  } catch {}

  // Public fallback: MyMemory API (no key required)
  try {
    const mm = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${encodeURIComponent(from)}|${encodeURIComponent(to)}`);
    if (mm.ok) {
      const data: any = await mm.json();
      const translated = data?.responseData?.translatedText;
      if (translated) {
        return Response.json({ from, to, text, translated, definitions: [translated], phonetic: "" });
      }
    }
  } catch {}

  // Fallback mock: basic dictionary + reversed text placeholder
  const basic: Record<string, Record<string, string>> = {
    people: { uk: "люди", ru: "люди" },
    prince: { uk: "принц", ru: "принц" },
    hat: { uk: "капелюх", ru: "шляпа" },
    elephant: { uk: "слон", ru: "слон" },
    pilot: { uk: "пілот", ru: "пилот" },
    adventures: { uk: "пригоди", ru: "приключения" },
    frightened: { uk: "налякані", ru: "испуганные" },
    boa: { uk: "боа", ru: "боа" },
    constrictor: { uk: "удав", ru: "удав" },
  };
  const key = text.toLowerCase();
  const translated = basic[key]?.[to] || text.split("").reverse().join("");
  return Response.json({ from, to, text, translated, definitions: [translated], phonetic: "" });
}

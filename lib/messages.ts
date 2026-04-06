import en from "@/messages/en.json";
import ru from "@/messages/ru.json";
import uk from "@/messages/uk.json";
import { Locale } from "./i18n";

export function getMessages(locale: Locale) {
  switch (locale) {
    case "en":
      return en;
    case "ru":
      return ru;
    case "uk":
    default:
      return uk;
  }
}

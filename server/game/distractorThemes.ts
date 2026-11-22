export type DistractorTheme =
  | "animal"
  | "color"
  | "vehicle"
  | "weather"
  | "nature"
  | "person"
  | "food"
  | "time"
  | "adjective"
  | "body"
  | "unknown";

interface ThemeRule {
  theme: DistractorTheme;
  pattern: RegExp;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function keywordPattern(keywords: string[]): RegExp {
  const alternatives = [...keywords]
    .sort((left, right) => right.length - left.length)
    .map(escapeRegExp)
    .join("|");
  return new RegExp(`(?:^|[^\\p{L}\\p{N}])(?:${alternatives})(?:$|[^\\p{L}\\p{N}])`, "iu");
}

const THEME_RULES: ThemeRule[] = [
  {
    theme: "animal",
    pattern: keywordPattern([
      "animal", "animals", "bird", "birds", "fish", "reptile", "mammal", "pet", "farm", "egg", "eggs", "feathers", "fins", "claws", "shell", "wild", "lion", "bear", "elephant", "monkey", "kuş", "kuşu", "hayvan", "hayvanı", "balık", "sürüngen", "memeli", "evcil", "çiftlik", "yumurta", "yumurtalayan", "tüy", "tüyleri", "yüzgeç", "kabuk", "vahşi", "yele", "yeleli", "kedi", "köpek", "inek", "koyun", "tavuk", "ördek", "kurbağa", "yılan", "aslan", "ayı", "fil", "maymun",
    ]),
  },
  {
    theme: "color",
    pattern: keywordPattern([
      "color", "colour", "red", "blue", "green", "yellow", "black", "white", "renk", "kırmızı", "mavi", "yeşil", "sarı", "siyah", "beyaz",
    ]),
  },
  {
    theme: "vehicle",
    pattern: keywordPattern([
      "vehicle", "vehicles", "car", "cars", "bus", "train", "bicycle", "bike", "boat", "ship", "plane", "rails", "wheel", "wheels", "pedal", "taşıt", "araba", "otobüs", "tren", "bisiklet", "gemi", "tekne", "uçak", "raylar", "tekerlek", "tekerlekli", "pedal",
    ]),
  },
  {
    theme: "weather",
    pattern: keywordPattern([
      "sky", "sun", "moon", "star", "rain", "snow", "wind", "cloud", "clouds", "gökyüzü", "güneş", "ay", "yıldız", "yağmur", "kar", "rüzgâr", "rüzgar", "bulut",
    ]),
  },
  {
    theme: "nature",
    pattern: keywordPattern([
      "sea", "water", "lake", "river", "ocean", "coast", "shore", "mountain", "hill", "forest", "field", "road", "bridge", "tree", "plant", "trunk", "branch", "branches", "deniz", "su", "göl", "nehir", "okyanus", "kıyı", "sahil", "dağ", "tepe", "orman", "tarla", "yol", "köprü", "ağaç", "bitki", "gövde", "dal", "dallar", "çiçek",
    ]),
  },
  {
    theme: "person",
    pattern: keywordPattern([
      "parent", "mother", "father", "brother", "sister", "child", "friend", "teacher", "doctor", "police", "neighbour", "neighbor", "person", "people", "anne", "baba", "kardeş", "çocuk", "arkadaş", "öğretmen", "doktor", "polis", "komşu", "insan", "kişi",
    ]),
  },
  {
    theme: "food",
    pattern: keywordPattern([
      "drink", "tea", "coffee", "food", "meal", "eat", "içecek", "çay", "kahve", "yemek", "yemeğe",
    ]),
  },
  {
    theme: "time",
    pattern: keywordPattern([
      "day", "week", "year", "morning", "evening", "night", "today", "tomorrow", "yesterday", "hour", "gün", "hafta", "yıl", "sabah", "akşam", "gece", "bugün", "yarın", "dün", "saat",
    ]),
  },
  {
    theme: "adjective",
    pattern: keywordPattern([
      "big", "small", "long", "short", "fast", "slow", "beautiful", "pleasant", "bad", "happy", "sad", "büyük", "küçük", "uzun", "kısa", "hızlı", "yavaş", "güzel", "kötü", "mutlu", "üzgün",
    ]),
  },
  {
    theme: "body",
    pattern: keywordPattern(["hand", "foot", "head", "eye", "el", "ayak", "baş", "göz"]),
  },
];

export function detectDistractorTheme(input: {
  answer: string;
  prompt?: string;
  explanation?: string;
}): DistractorTheme {
  const text = [input.prompt, input.explanation, input.answer].filter(Boolean).join(" ").toLocaleLowerCase("tr-TR");
  for (const rule of THEME_RULES) {
    if (rule.pattern.test(text)) return rule.theme;
  }
  return "unknown";
}

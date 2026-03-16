const MAX_TWEET_LENGTH = 280;
const INDICATOR_RESERVE = 8; // " (XX/YY)"

export function buildThread(text: string): string[] {
  const limit = MAX_TWEET_LENGTH - INDICATOR_RESERVE;
  const paragraphs = text.split(/\n\n+/).filter((p) => p.trim());

  // Try fitting in a single tweet first
  if (text.length <= MAX_TWEET_LENGTH) {
    return [text];
  }

  const chunks: string[] = [];
  let current = '';

  for (const paragraph of paragraphs) {
    if (paragraph.length <= limit) {
      if (current && current.length + 2 + paragraph.length > limit) {
        chunks.push(current.trim());
        current = paragraph;
      } else {
        current = current ? `${current}\n\n${paragraph}` : paragraph;
      }
    } else {
      // Paragraph too long — split by sentences
      if (current) {
        chunks.push(current.trim());
        current = '';
      }
      splitBySentences(paragraph, limit, chunks);
    }
  }

  if (current.trim()) {
    chunks.push(current.trim());
  }

  // Add thread indicators
  if (chunks.length > 1) {
    return chunks.map((chunk, i) => `${chunk} (${i + 1}/${chunks.length})`);
  }

  return chunks;
}

function splitBySentences(text: string, limit: number, chunks: string[]) {
  const sentences = text.match(/[^.!?]+[.!?]+\s*/g) ?? [text];
  let current = '';

  for (const sentence of sentences) {
    if (sentence.length > limit) {
      if (current) {
        chunks.push(current.trim());
        current = '';
      }
      splitByWords(sentence.trim(), limit, chunks);
    } else if (current.length + sentence.length > limit) {
      chunks.push(current.trim());
      current = sentence;
    } else {
      current += sentence;
    }
  }

  if (current.trim()) {
    chunks.push(current.trim());
  }
}

function splitByWords(text: string, limit: number, chunks: string[]) {
  const words = text.split(/\s+/);
  let current = '';

  for (const word of words) {
    if (current && current.length + 1 + word.length > limit) {
      chunks.push(current.trim());
      current = word;
    } else {
      current = current ? `${current} ${word}` : word;
    }
  }

  if (current.trim()) {
    chunks.push(current.trim());
  }
}

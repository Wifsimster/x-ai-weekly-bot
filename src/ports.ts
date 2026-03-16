export interface Tweet {
  id: string;
  text: string;
  createdAt: string;
  urls: string[];
}

export interface TweetReader {
  fetchRecentTweets(): Promise<Tweet[]>;
}

export function isXUrl(url: string): boolean {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    return (
      hostname === 'twitter.com' ||
      hostname === 'x.com' ||
      hostname.endsWith('.twitter.com') ||
      hostname.endsWith('.x.com')
    );
  } catch {
    return false;
  }
}

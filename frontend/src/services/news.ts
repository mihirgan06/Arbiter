import axios from "axios";
import type { NewsCorrelation } from "@/lib/types";

const NEWS_API_KEY = process.env.NEWS_API_KEY;
const NEWS_API_URL = "https://newsapi.org/v2";

interface NewsArticle {
  title: string;
  description: string;
  url: string;
  source: { name: string };
  publishedAt: string;
}

interface NewsApiResponse {
  status: string;
  totalResults: number;
  articles: NewsArticle[];
}

export class NewsService {
  private client = axios.create({
    baseURL: NEWS_API_URL,
    timeout: 10000,
    headers: {
      "X-Api-Key": NEWS_API_KEY || "",
    },
  });

  /**
   * Search for news articles related to a market question
   */
  async searchNews(query: string, from?: Date, to?: Date): Promise<NewsCorrelation[]> {
    if (!NEWS_API_KEY) {
      console.warn("[News] API key not configured, returning mock data");
      return this.getMockNews(query);
    }

    try {
      const response = await this.client.get<NewsApiResponse>("/everything", {
        params: {
          q: this.extractKeywords(query),
          from: from?.toISOString().split("T")[0],
          to: to?.toISOString().split("T")[0],
          sortBy: "publishedAt",
          language: "en",
          pageSize: 10,
        },
      });

      return response.data.articles.map((article) => ({
        title: article.title,
        source: article.source.name,
        url: article.url,
        publishedAt: new Date(article.publishedAt),
        sentiment: this.analyzeSentiment(article.title + " " + article.description),
        relevanceScore: this.calculateRelevance(query, article.title + " " + article.description),
      }));
    } catch (error) {
      console.error("[News] Failed to fetch news:", error);
      return this.getMockNews(query);
    }
  }

  /**
   * Extract search keywords from a market question
   */
  private extractKeywords(question: string): string {
    // Remove common question words and extract key terms
    const stopWords = new Set([
      "will", "the", "a", "an", "be", "by", "in", "on", "at", "to", "for",
      "of", "and", "or", "is", "are", "was", "were", "been", "being",
      "have", "has", "had", "do", "does", "did", "before", "after",
    ]);

    return question
      .toLowerCase()
      .replace(/[?.,!]/g, "")
      .split(" ")
      .filter((word) => !stopWords.has(word) && word.length > 2)
      .slice(0, 5)
      .join(" ");
  }

  /**
   * Simple sentiment analysis based on keyword matching
   * Returns -1 (negative) to 1 (positive)
   */
  private analyzeSentiment(text: string): number {
    const lower = text.toLowerCase();
    
    const positiveWords = [
      "surge", "rise", "gain", "success", "win", "approve", "pass",
      "increase", "boost", "rally", "positive", "confident", "optimistic",
    ];
    
    const negativeWords = [
      "fall", "drop", "decline", "fail", "lose", "reject", "block",
      "decrease", "crash", "plunge", "negative", "concern", "worry",
    ];

    let score = 0;
    for (const word of positiveWords) {
      if (lower.includes(word)) score += 0.2;
    }
    for (const word of negativeWords) {
      if (lower.includes(word)) score -= 0.2;
    }

    return Math.max(-1, Math.min(1, score));
  }

  /**
   * Calculate relevance score between query and article
   */
  private calculateRelevance(query: string, articleText: string): number {
    const queryWords = new Set(
      query.toLowerCase().replace(/[?.,!]/g, "").split(" ")
    );
    const articleWords = articleText.toLowerCase().replace(/[?.,!]/g, "").split(" ");
    
    let matches = 0;
    for (const word of articleWords) {
      if (queryWords.has(word)) matches++;
    }

    return Math.min(1, matches / queryWords.size);
  }

  /**
   * Return mock news for development/demo purposes
   */
  private getMockNews(query: string): NewsCorrelation[] {
    const lower = query.toLowerCase();
    
    if (lower.includes("bitcoin") || lower.includes("btc") || lower.includes("crypto")) {
      return [
        {
          title: "Bitcoin ETF Sees Record Inflows as Institutional Interest Grows",
          source: "Bloomberg",
          url: "https://bloomberg.com",
          publishedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
          sentiment: 0.6,
          relevanceScore: 0.85,
        },
        {
          title: "Crypto Markets React to Federal Reserve Minutes",
          source: "Reuters",
          url: "https://reuters.com",
          publishedAt: new Date(Date.now() - 5 * 60 * 60 * 1000),
          sentiment: 0.2,
          relevanceScore: 0.7,
        },
      ];
    }

    if (lower.includes("fed") || lower.includes("rate") || lower.includes("interest")) {
      return [
        {
          title: "Fed Officials Signal Patience on Rate Cuts Amid Sticky Inflation",
          source: "WSJ",
          url: "https://wsj.com",
          publishedAt: new Date(Date.now() - 3 * 60 * 60 * 1000),
          sentiment: -0.3,
          relevanceScore: 0.9,
        },
        {
          title: "Markets Adjust Rate Cut Expectations Following Economic Data",
          source: "Financial Times",
          url: "https://ft.com",
          publishedAt: new Date(Date.now() - 8 * 60 * 60 * 1000),
          sentiment: 0.1,
          relevanceScore: 0.75,
        },
      ];
    }

    if (lower.includes("gpt") || lower.includes("openai") || lower.includes("ai")) {
      return [
        {
          title: "OpenAI Reportedly Preparing Major Model Update for 2026",
          source: "The Information",
          url: "https://theinformation.com",
          publishedAt: new Date(Date.now() - 4 * 60 * 60 * 1000),
          sentiment: 0.5,
          relevanceScore: 0.88,
        },
        {
          title: "AI Companies Race to Release Next-Generation Models",
          source: "TechCrunch",
          url: "https://techcrunch.com",
          publishedAt: new Date(Date.now() - 12 * 60 * 60 * 1000),
          sentiment: 0.3,
          relevanceScore: 0.65,
        },
      ];
    }

    return [
      {
        title: "Market Analysis: Key Events to Watch This Week",
        source: "Reuters",
        url: "https://reuters.com",
        publishedAt: new Date(Date.now() - 6 * 60 * 60 * 1000),
        sentiment: 0.1,
        relevanceScore: 0.4,
      },
    ];
  }
}

export const newsService = new NewsService();


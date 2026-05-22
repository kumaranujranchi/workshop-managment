/**
 * Simple local NLP analyzer for participant expectations.
 * Computes sentiment, extracts themes, and generates a cohort summary.
 */

const SENTIMENT_WORDS = {
  positive: ['excited', 'great', 'eager', 'good', 'perfect', 'helpful', 'love', 'nice', 'hopeful', 'awesome', 'skills', 'grow', 'improve'],
  curious: ['how to', 'understand', 'explore', 'wonder', 'curious', 'what is', 'why', 'learn', 'interested', 'know', 'discover'],
  concerned: ['worried', 'difficult', 'time', 'rushed', 'confused', 'hard', 'scared', 'afraid', 'stress', 'struggle', 'anxious', 'concerned']
};

const THEME_PATTERNS = [
  {
    name: 'AI & Machine Learning',
    keywords: ['ai', 'artificial intelligence', 'ml', 'machine learning', 'llm', 'gpt', 'agent', 'model', 'neural', 'deep learning']
  },
  {
    name: 'Hands-on Practice & Labs',
    keywords: ['hands-on', 'practice', 'lab', 'exercise', 'build', 'coding', 'code', 'implement', 'interactive', 'demo', 'workshop']
  },
  {
    name: 'Advanced & Architecture',
    keywords: ['advanced', 'deep dive', 'scale', 'architecture', 'expert', 'complex', 'performance', 'optimize']
  },
  {
    name: 'Beginner & Foundations',
    keywords: ['beginner', 'basics', 'intro', 'introduction', 'start', 'easy', 'simple', 'foundation', 'fundamentals']
  },
  {
    name: 'Career & Networking',
    keywords: ['career', 'job', 'network', 'colleague', 'team', 'connect', 'industry', 'meet', 'people']
  },
  {
    name: 'Leadership & Soft Skills',
    keywords: ['communication', 'presentation', 'manage', 'leadership', 'lead', 'collaboration', 'soft skill', 'feedback']
  }
];

export function analyzeExpectations(expectationsList) {
  // Filter out empty or whitespace-only expectations
  const validExpectations = (expectationsList || [])
    .map(e => (typeof e === 'string' ? e.trim() : ''))
    .filter(e => e.length > 0);

  if (validExpectations.length === 0) {
    return {
      sentiment: { positive: 0, curious: 0, concerned: 0, neutral: 0 },
      themes: [],
      summary: 'No expectations captured yet. Share what you want to learn to get started!'
    };
  }

  const sentimentCounts = { positive: 0, curious: 0, concerned: 0, neutral: 0 };
  const themeCounts = {};
  THEME_PATTERNS.forEach(theme => {
    themeCounts[theme.name] = 0;
  });

  validExpectations.forEach(exp => {
    const text = exp.toLowerCase();

    // 1. Analyze Sentiment
    let posCount = 0;
    let curCount = 0;
    let conCount = 0;

    SENTIMENT_WORDS.positive.forEach(word => {
      if (text.includes(word)) posCount++;
    });
    SENTIMENT_WORDS.curious.forEach(word => {
      if (text.includes(word)) curCount++;
    });
    SENTIMENT_WORDS.concerned.forEach(word => {
      if (text.includes(word)) conCount++;
    });

    if (posCount === 0 && curCount === 0 && conCount === 0) {
      sentimentCounts.neutral++;
    } else {
      const max = Math.max(posCount, curCount, conCount);
      if (max === posCount) {
        sentimentCounts.positive++;
      } else if (max === curCount) {
        sentimentCounts.curious++;
      } else {
        sentimentCounts.concerned++;
      }
    }

    // 2. Extract Themes
    THEME_PATTERNS.forEach(theme => {
      let matched = false;
      theme.keywords.forEach(keyword => {
        if (text.includes(keyword)) {
          matched = true;
        }
      });
      if (matched) {
        themeCounts[theme.name]++;
      }
    });
  });

  // Calculate percentages / ratios
  const total = validExpectations.length;
  const sentiment = {
    positive: Math.round((sentimentCounts.positive / total) * 100),
    curious: Math.round((sentimentCounts.curious / total) * 100),
    concerned: Math.round((sentimentCounts.concerned / total) * 100),
    neutral: Math.round((sentimentCounts.neutral / total) * 100)
  };

  // Convert themes to sorted array
  const themes = Object.entries(themeCounts)
    .map(([name, count]) => ({
      name,
      count,
      percentage: Math.round((count / total) * 100)
    }))
    .filter(t => t.count > 0)
    .sort((a, b) => b.count - a.count);

  // 3. Generate summary
  let summary = '';
  const topThemeObj = themes[0];
  const dominantSentiment = Object.entries(sentimentCounts).sort((a, b) => b[1] - a[1])[0][0];

  if (topThemeObj && topThemeObj.count > 0) {
    if (dominantSentiment === 'positive') {
      summary = `The cohort is highly enthusiastic about "${topThemeObj.name}" and eager to enhance their skills.`;
    } else if (dominantSentiment === 'curious') {
      summary = `Participants are primarily curious about exploring "${topThemeObj.name}" and understanding core concepts.`;
    } else if (dominantSentiment === 'concerned') {
      summary = `There are some concerns regarding pacing/difficulty in "${topThemeObj.name}"; facilitators should allocate extra Q&A time.`;
    } else {
      summary = `The expectations focus mainly on "${topThemeObj.name}" with a neutral, objective learning interest.`;
    }
  } else {
    if (dominantSentiment === 'positive') {
      summary = `Participants have a highly positive outlook and are ready to start learning.`;
    } else if (dominantSentiment === 'curious') {
      summary = `The cohort displays strong curiosity to learn new tools and ask questions.`;
    } else if (dominantSentiment === 'concerned') {
      summary = `Some anxious expectations have been logged; consider starting with an easy introduction.`;
    } else {
      summary = `The cohort has general expectations focused on workshop topics.`;
    }
  }

  // If there are specific concerns logged
  if (sentimentCounts.concerned > 0) {
    summary += ` Note: ${sentimentCounts.concerned} participant(s) expressed concern about difficulty or timing constraints.`;
  }

  return {
    sentiment,
    themes,
    summary,
    sampleCount: total
  };
}

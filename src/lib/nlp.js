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

/**
 * Analyzes feedback comments for post-workshop qualitative insights.
 * Returns themes, sentiment clusters, and improvement summary.
 */
export function analyzeFeedbackComments(feedbackList) {
  const comments = (feedbackList || [])
    .map(f => (typeof f.comments === 'string' ? f.comments.trim() : ''))
    .filter(c => c.length > 0);

  if (comments.length === 0) {
    return {
      sentiment: { positive: 0, curious: 0, concerned: 0, neutral: 0 },
      themes: [],
      improvements: [],
      summary: 'No qualitative feedback submitted yet.',
      sampleCount: 0
    };
  }

  const IMPROVEMENT_PATTERNS = [
    { theme: 'Add more hands-on labs', keywords: ['lab', 'hands-on', 'practice', 'exercise', 'interactive', 'practical'] },
    { theme: 'Improve pacing / timing', keywords: ['rushed', 'slow', 'pacing', 'fast', 'time', 'quick', 'long'] },
    { theme: 'More real-world examples', keywords: ['example', 'case study', 'real world', 'use case', 'application'] },
    { theme: 'Deeper content coverage', keywords: ['deep', 'advanced', 'detailed', 'comprehensive', 'thorough', 'complex'] },
    { theme: 'Better Q&A / discussion time', keywords: ['question', 'discussion', 'q&a', 'doubt', 'clarity', 'ask'] },
    { theme: 'Improve facilitator delivery', keywords: ['facilitator', 'presenter', 'speaker', 'instructor', 'teaching'] },
  ];

  const FEEDBACK_THEME_PATTERNS = [
    { name: 'Content Quality', keywords: ['content', 'material', 'curriculum', 'syllabus', 'topic', 'subject'] },
    { name: 'Facilitator Effectiveness', keywords: ['facilitator', 'presenter', 'instructor', 'teaching', 'delivery', 'speaker'] },
    { name: 'Hands-on / Practical', keywords: ['hands-on', 'lab', 'exercise', 'practice', 'practical', 'interactive', 'demo'] },
    { name: 'Pacing & Time Management', keywords: ['pace', 'pacing', 'time', 'rushed', 'slow', 'duration', 'schedule'] },
    { name: 'Learning Outcomes', keywords: ['learn', 'skill', 'knowledge', 'outcome', 'takeaway', 'insight', 'understand'] },
    { name: 'Overall Experience', keywords: ['great', 'excellent', 'good', 'amazing', 'wonderful', 'helpful', 'useful', 'enjoyable'] },
  ];

  const sentimentCounts = { positive: 0, curious: 0, concerned: 0, neutral: 0 };
  const themeCounts = {};
  FEEDBACK_THEME_PATTERNS.forEach(t => { themeCounts[t.name] = 0; });
  const improvementCounts = {};
  IMPROVEMENT_PATTERNS.forEach(i => { improvementCounts[i.theme] = 0; });

  comments.forEach(comment => {
    const text = comment.toLowerCase();

    let posCount = 0, curCount = 0, conCount = 0;
    SENTIMENT_WORDS.positive.forEach(w => { if (text.includes(w)) posCount++; });
    SENTIMENT_WORDS.curious.forEach(w => { if (text.includes(w)) curCount++; });
    SENTIMENT_WORDS.concerned.forEach(w => { if (text.includes(w)) conCount++; });

    if (posCount === 0 && curCount === 0 && conCount === 0) {
      sentimentCounts.neutral++;
    } else {
      const max = Math.max(posCount, curCount, conCount);
      if (max === posCount) sentimentCounts.positive++;
      else if (max === curCount) sentimentCounts.curious++;
      else sentimentCounts.concerned++;
    }

    FEEDBACK_THEME_PATTERNS.forEach(t => {
      if (t.keywords.some(k => text.includes(k))) themeCounts[t.name]++;
    });

    IMPROVEMENT_PATTERNS.forEach(i => {
      if (i.keywords.some(k => text.includes(k))) improvementCounts[i.theme]++;
    });
  });

  const total = comments.length;
  const sentiment = {
    positive: Math.round((sentimentCounts.positive / total) * 100),
    curious: Math.round((sentimentCounts.curious / total) * 100),
    concerned: Math.round((sentimentCounts.concerned / total) * 100),
    neutral: Math.round((sentimentCounts.neutral / total) * 100),
  };

  const themes = Object.entries(themeCounts)
    .map(([name, count]) => ({ name, count, percentage: Math.round((count / total) * 100) }))
    .filter(t => t.count > 0)
    .sort((a, b) => b.count - a.count);

  const improvements = Object.entries(improvementCounts)
    .map(([theme, count]) => ({ theme, count, percentage: Math.round((count / total) * 100) }))
    .filter(i => i.count > 0)
    .sort((a, b) => b.count - a.count);

  const dominantSentiment = Object.entries(sentimentCounts).sort((a, b) => b[1] - a[1])[0][0];
  const topTheme = themes[0];
  const topImprovement = improvements[0];

  let summary = '';
  if (dominantSentiment === 'positive') {
    summary = `Overall feedback is highly positive${topTheme ? `, especially around "${topTheme.name}"` : ''}.`;
  } else if (dominantSentiment === 'concerned') {
    summary = `Feedback signals some concerns${topTheme ? ` in "${topTheme.name}"` : ''} — action is recommended.`;
  } else if (dominantSentiment === 'curious') {
    summary = `Participants express a desire to learn more and explore deeper topics.`;
  } else {
    summary = `Feedback is neutral${topTheme ? `, focusing mainly on "${topTheme.name}"` : ''}.`;
  }

  if (topImprovement) {
    summary += ` Key improvement area: ${topImprovement.theme}.`;
  }

  return { sentiment, themes, improvements, summary, sampleCount: total };
}

/**
 * Aggregates MCQ responses across all feedback submissions.
 * mcqList: array of JSON-parsed MCQ objects { valuable: [], pacing: '', recommend: '' }
 */
export function aggregateMCQResponses(feedbackList) {
  const valuableCounts = {};
  const pacingCounts = { 'Too Fast': 0, 'Just Right': 0, 'Too Slow': 0 };
  const recommendCounts = { 'Definitely Yes': 0, 'Probably Yes': 0, 'Probably Not': 0, 'Definitely Not': 0 };
  let totalMCQ = 0;

  feedbackList.forEach(f => {
    if (!f.mcqResponses) return;
    try {
      const mcq = typeof f.mcqResponses === 'string' ? JSON.parse(f.mcqResponses) : f.mcqResponses;
      totalMCQ++;

      if (Array.isArray(mcq.valuable)) {
        mcq.valuable.forEach(v => {
          valuableCounts[v] = (valuableCounts[v] || 0) + 1;
        });
      }
      if (mcq.pacing && pacingCounts[mcq.pacing] !== undefined) {
        pacingCounts[mcq.pacing]++;
      }
      if (mcq.recommend && recommendCounts[mcq.recommend] !== undefined) {
        recommendCounts[mcq.recommend]++;
      }
    } catch (e) {
      // Invalid JSON, skip
    }
  });

  const valuableArray = Object.entries(valuableCounts)
    .map(([label, count]) => ({ label, count, percentage: totalMCQ > 0 ? Math.round((count / totalMCQ) * 100) : 0 }))
    .sort((a, b) => b.count - a.count);

  const recommendScore = totalMCQ > 0
    ? Math.round(
        ((recommendCounts['Definitely Yes'] * 100 + recommendCounts['Probably Yes'] * 75 +
          recommendCounts['Probably Not'] * 25 + recommendCounts['Definitely Not'] * 0) /
          (totalMCQ * 100)) * 100
      )
    : 0;

  return { valuableArray, pacingCounts, recommendCounts, recommendScore, totalMCQ };
}


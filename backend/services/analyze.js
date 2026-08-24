/**
 * Deterministic engagement analysis — no paid LLM.
 * Stats are counted from the extracted text; suggestions are produced
 * by transparent rules so the same post always yields the same advice.
 */

const CTA_PATTERNS = [
  /\b(comment|comments)\b/i,
  /\b(share|shares|reshare|repost)\b/i,
  /\b(like|likes|double[- ]tap)\b/i,
  /\b(follow|follows|subscribe|dm|message me)\b/i,
  /\b(click|tap|swipe|link in (bio|comments))\b/i,
  /\b(sign up|join|register|save this|tag a friend)\b/i,
  /\b(what do you think|let me know|drop a|tell us|tell me)\b/i,
];

const EMOJI_REGEX = /\p{Extended_Pictographic}/gu;

function countMatches(text, regex) {
  const matches = text.match(regex);
  return matches ? matches.length : 0;
}

function splitSentences(text) {
  const parts = text
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.trim())
    .filter(Boolean);
  return parts.length ? parts : text.trim() ? [text.trim()] : [];
}

function computeStats(text) {
  const words = text.match(/[A-Za-z0-9']+/g) || [];
  const sentences = splitSentences(text);
  const hashtags = countMatches(text, /#[\p{L}\p{N}_]+/gu);
  const mentions = countMatches(text, /@[\p{L}\p{N}_.]+/gu);
  const emojis = countMatches(text, EMOJI_REGEX);
  const questions = countMatches(text, /\?/g);
  const hasQuestion = questions > 0;
  const hasCTA = CTA_PATTERNS.some((re) => re.test(text));
  const urls = countMatches(text, /https?:\/\/\S+/gi);
  const allCapsTokens = (text.match(/\b[A-Z]{4,}\b/g) || []).length;

  return {
    wordCount: words.length,
    characterCount: text.length,
    sentenceCount: sentences.length,
    hashtagCount: hashtags,
    mentionCount: mentions,
    emojiCount: emojis,
    questionCount: questions,
    hasQuestion,
    hasCallToAction: hasCTA,
    urlCount: urls,
    allCapsWordCount: allCapsTokens,
    averageWordsPerSentence:
      sentences.length === 0
        ? 0
        : Math.round((words.length / sentences.length) * 10) / 10,
  };
}

function suggestion(id, priority, title, detail) {
  return { id, priority, title, detail };
}

function generateSuggestions(text, stats) {
  const items = [];

  if (stats.wordCount < 8) {
    items.push(
      suggestion(
        "expand",
        "high",
        "Expand the post",
        "This copy is very short. Add a one-sentence hook plus a little context so people have a reason to stop scrolling."
      )
    );
  } else if (stats.wordCount > 220) {
    items.push(
      suggestion(
        "shorten",
        "high",
        "Shorten the post",
        "Long walls of text get skipped. Aim for a tight hook, 2–4 short paragraphs, and a single ask at the end."
      )
    );
  } else if (stats.wordCount > 120) {
    items.push(
      suggestion(
        "tighten",
        "medium",
        "Tighten the middle",
        "The post is on the long side. Cut repeated ideas and keep only the line that would make someone stop mid-feed."
      )
    );
  }

  if (stats.hashtagCount === 0) {
    items.push(
      suggestion(
        "hashtags",
        "high",
        "Add 2–5 relevant hashtags",
        "There are no hashtags. Add a small set of specific tags (topic + community) rather than generic ones like #love."
      )
    );
  } else if (stats.hashtagCount > 8) {
    items.push(
      suggestion(
        "fewer-hashtags",
        "medium",
        "Use fewer hashtags",
        "Too many hashtags can look spammy and dilute reach. Keep the 3–5 that actually describe this post."
      )
    );
  }

  if (!stats.hasCallToAction) {
    items.push(
      suggestion(
        "cta",
        "high",
        "Add a call-to-action",
        'End with a clear next step, e.g. "Save this for later," "Comment your take," or "Share with someone who needs this."'
      )
    );
  }

  if (!stats.hasQuestion && !stats.hasCallToAction) {
    items.push(
      suggestion(
        "question",
        "medium",
        "Ask a question",
        "Questions invite replies. Close with something specific enough to answer in one line."
      )
    );
  }

  if (stats.emojiCount === 0 && stats.wordCount >= 8) {
    items.push(
      suggestion(
        "emojis",
        "low",
        "Add a few emojis for scannability",
        "One or two well-placed emojis help the eye land on the hook. Avoid stacking them in every sentence."
      )
    );
  } else if (stats.emojiCount > 12) {
    items.push(
      suggestion(
        "fewer-emojis",
        "medium",
        "Dial back the emojis",
        "Emoji overload hides the actual message. Keep them as signposts, not decoration."
      )
    );
  }

  if (stats.mentionCount === 0 && stats.wordCount >= 20) {
    items.push(
      suggestion(
        "mentions",
        "low",
        "Tag a relevant account if it fits",
        "A genuine @mention (collaborator, source, or community) can pull the right people into the thread. Skip tags that feel like spam."
      )
    );
  }

  const firstLine = text.split(/\n/)[0] || "";
  if (firstLine.length > 140) {
    items.push(
      suggestion(
        "hook",
        "medium",
        "Lead with a shorter hook",
        "The first line is long. Put the most interesting claim in the first ~80 characters so it survives truncated previews."
      )
    );
  }

  if (stats.averageWordsPerSentence > 28) {
    items.push(
      suggestion(
        "sentences",
        "medium",
        "Break up long sentences",
        "Dense sentences are hard to scan on a phone. Split them so each line carries one idea."
      )
    );
  }

  if (stats.allCapsWordCount >= 3) {
    items.push(
      suggestion(
        "caps",
        "low",
        "Ease off ALL CAPS",
        "Heavy capitalization reads as shouting and can hurt trust. Use it for one word at most."
      )
    );
  }

  if (stats.urlCount > 0 && !/link in (bio|comments)/i.test(text)) {
    items.push(
      suggestion(
        "link-context",
        "low",
        "Give the link a reason to be clicked",
        "URLs without context get ignored. Say what the reader gets (a template, a thread, a demo) before the link."
      )
    );
  }

  if (text === text.toLowerCase() && stats.wordCount > 12) {
    items.push(
      suggestion(
        "punctuation",
        "low",
        "Use normal capitalization",
        "All-lowercase copy can feel unfinished. Capitalize the first word of each sentence so it looks intentional."
      )
    );
  }

  if (items.length === 0) {
    items.push(
      suggestion(
        "solid",
        "low",
        "This is already in good shape",
        "You have length, a prompt for replies, and discovery tags. Next lift: post when your audience is online and reply to early comments fast."
      )
    );
  }

  const rank = { high: 0, medium: 1, low: 2 };
  items.sort((a, b) => rank[a.priority] - rank[b.priority]);
  return items;
}

function analyzeText(text) {
  const stats = computeStats(text);
  const suggestions = generateSuggestions(text, stats);
  return { stats, suggestions };
}

module.exports = { analyzeText, computeStats, generateSuggestions };

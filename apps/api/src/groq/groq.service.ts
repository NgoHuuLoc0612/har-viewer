import { Injectable, Logger, BadRequestException, HttpException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Groq from 'groq-sdk';

// ─── Models that do NOT support chat completions ───────────────────────────
const NON_CHAT_PATTERNS = [
  /whisper/i,        // speech-to-text
  /canopylabs\//i,   // TTS (requires terms)
  /playai\//i,       // TTS
  /distil-whisper/i,
  /\.tts$/i,
];

function isChatModel(id: string): boolean {
  return !NON_CHAT_PATTERNS.some(p => p.test(id));
}

// ─── Per-model context window caps (tokens) ────────────────────────────────
// Models with small context windows or very low free-tier TPM limits
const MODEL_MAX_INPUT: Record<string, number> = {
  'allam-2-7b':             2000,
  'llama-3.1-8b-instant':   3000,
  'gemma2-9b-it':           3000,
  'gemma-7b-it':            2500,
  'mixtral-8x7b-32768':     6000,
  'llama-3.3-70b-versatile': 6000,
  'llama-3.1-70b-versatile': 6000,
  'deepseek-r1-distill-llama-70b': 6000,
  'qwen-qwq-32b':           6000,
};

function maxInputTokens(modelId: string): number {
  // Check exact match first
  if (MODEL_MAX_INPUT[modelId]) return MODEL_MAX_INPUT[modelId];
  // Heuristic: models with /openai/ or /meta/ prefix from Groq tend to have stricter limits
  if (modelId.includes('openai/')) return 4000;
  return 4000; // safe default for unknown models
}

// Rough char-to-token estimate (1 token ≈ 4 chars for English)
function charsToTokens(chars: number): number {
  return Math.ceil(chars / 4);
}

@Injectable()
export class GroqService {
  private client: Groq;
  private readonly logger = new Logger(GroqService.name);
  // Cache model context windows after first fetch
  private modelContextWindows: Record<string, number> = {};

  constructor(private config: ConfigService) {
    this.client = new Groq({
      apiKey: this.config.get('GROQ_API_KEY', ''),
    });
  }

  async getAvailableModels() {
    try {
      const response = await this.client.models.list();

      const models = response.data
        .filter(m => isChatModel(m.id))   // exclude audio/TTS models
        .map(m => {
          const ctxWindow = (m as any).context_window || 32768;
          this.modelContextWindows[m.id] = ctxWindow;
          return {
            id: m.id,
            object: m.object,
            created: m.created,
            owned_by: m.owned_by,
            active: true,
            context_window: ctxWindow,
          };
        })
        .sort((a, b) => b.context_window - a.context_window);

      return models;
    } catch (error) {
      this.logger.warn('Could not fetch Groq models, using fallback list: ' + error.message);
      // Known stable chat models only
      return [
        { id: 'llama-3.3-70b-versatile',        object: 'model', created: 0, owned_by: 'Meta',      active: true, context_window: 128000 },
        { id: 'llama-3.1-70b-versatile',        object: 'model', created: 0, owned_by: 'Meta',      active: true, context_window: 128000 },
        { id: 'llama-3.1-8b-instant',           object: 'model', created: 0, owned_by: 'Meta',      active: true, context_window: 128000 },
        { id: 'mixtral-8x7b-32768',             object: 'model', created: 0, owned_by: 'Mistral',   active: true, context_window: 32768  },
        { id: 'gemma2-9b-it',                   object: 'model', created: 0, owned_by: 'Google',    active: true, context_window: 8192   },
        { id: 'deepseek-r1-distill-llama-70b',  object: 'model', created: 0, owned_by: 'DeepSeek',  active: true, context_window: 128000 },
        { id: 'qwen-qwq-32b',                   object: 'model', created: 0, owned_by: 'Alibaba',   active: true, context_window: 32768  },
      ];
    }
  }

  async analyzeHar(
    analysisData: any,
    prompt: string,
    modelId: string,
    analysisType: string,
  ): Promise<{ result: string; tokensUsed: number }> {
    // Guard: reject non-chat models immediately
    if (!isChatModel(modelId)) {
      throw new BadRequestException(
        `Model "${modelId}" does not support chat completions. Please select a text model.`
      );
    }

    const systemPrompt = this.buildSystemPrompt(analysisType);
    const userMessage  = this.buildUserMessage(analysisData, prompt, analysisType, modelId);

    // Calculate safe max_tokens: context_window - input_tokens, capped at 4096
    const ctxWindow   = this.modelContextWindows[modelId] || 32768;
    const inputTokens = charsToTokens(systemPrompt.length + userMessage.length);
    const maxTokens   = Math.min(4096, Math.max(256, ctxWindow - inputTokens - 200));

    try {
      const completion = await this.client.chat.completions.create({
        model: modelId,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user',   content: userMessage  },
        ],
        max_tokens:  maxTokens,
        temperature: 0.3,
      });

      const result     = completion.choices[0]?.message?.content || '';
      const tokensUsed = completion.usage?.total_tokens || 0;
      return { result, tokensUsed };

    } catch (err: any) {
      throw this.mapGroqError(err, modelId);
    }
  }

  async chatWithHar(
    messages: Array<{ role: string; content: string }>,
    context: any,
    modelId: string,
  ): Promise<string> {
    if (!isChatModel(modelId)) {
      throw new BadRequestException(
        `Model "${modelId}" does not support chat completions. Please select a text model.`
      );
    }

    const systemContent = this.buildChatSystem(context);
    const ctxWindow     = this.modelContextWindows[modelId] || 32768;

    // Trim history if it would overflow the model's limit
    const trimmedMessages = this.trimMessages(messages, modelId, systemContent);
    const inputTokens     = charsToTokens(
      systemContent.length + trimmedMessages.reduce((s, m) => s + m.content.length, 0)
    );
    const maxTokens = Math.min(2048, Math.max(256, ctxWindow - inputTokens - 200));

    try {
      const completion = await this.client.chat.completions.create({
        model: modelId,
        messages: [
          { role: 'system', content: systemContent },
          ...trimmedMessages.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
        ],
        max_tokens:  maxTokens,
        temperature: 0.5,
      });

      return completion.choices[0]?.message?.content || '';

    } catch (err: any) {
      throw this.mapGroqError(err, modelId);
    }
  }

  // ─── Private helpers ─────────────────────────────────────────────────────

  private buildSystemPrompt(analysisType: string): string {
    const base = `You are an expert HTTP archive (HAR) analyst. Provide technical, actionable insights in Markdown.`;
    const extra: Record<string, string> = {
      performance: ' Focus on: load times, bottlenecks, caching, compression, Core Web Vitals.',
      security:    ' Focus on: HTTPS, TLS, security headers, cookie flags, sensitive data exposure.',
      general:     ' Cover performance, security, resource usage, and optimization opportunities.',
    };
    return base + (extra[analysisType] || extra.general);
  }

  /**
   * Build a token-efficient text summary instead of raw JSON.
   * Targets ~1500–3000 chars (~375–750 tokens) so free-tier models stay under 6000 TPM.
   */
  private buildUserMessage(
    data: any,
    prompt: string,
    _analysisType: string,
    modelId: string,
  ): string {
    const maxChars = maxInputTokens(modelId) * 4 * 0.7; // leave 30% for system + output
    const rs = data.dashboard?.requestSummary || {};
    const ts = data.dashboard?.timingSummary   || {};
    const tf = data.dashboard?.transferSummary || {};

    const lines: string[] = [
      '## HAR Summary',
      `Requests: ${rs.total||0} total | ${rs.successful||0} ok | ${rs.failed||0} failed | ${rs.cached||0} cached | ${rs.redirects||0} redirects`,
      `Timing: avg ${Math.round(ts.avgDuration||0)}ms | P50 ${Math.round(ts.p50||0)}ms | P95 ${Math.round(ts.p95||0)}ms | P99 ${Math.round(ts.p99||0)}ms | TTFB avg ${Math.round(ts.avgTtfb||0)}ms`,
      `Transfer: ${Math.round((tf.totalTransferred||0)/1024)}KB in | ${Math.round((tf.totalDecoded||0)/1024)}KB decoded | saved ${Math.round((tf.compressionSavings||0)/1024)}KB via compression`,
      '',
      '## Top Domains',
      ...(data.domains||[]).slice(0,5).map((d:any) =>
        `- ${d.domain}: ${d.requestCount} req, avg ${Math.round(d.avgDuration||0)}ms, ${Math.round((d.totalSize||0)/1024)}KB`
      ),
    ];

    if (data.security) {
      const s = data.security;
      lines.push('', `## Security  score:${s.score||0}/100  https:${s.httpsPercentage||0}%`);
      const issues = (s.issues||[]).slice(0,4).map((i:any)=>i.title||i.message);
      if (issues.length) lines.push('Issues: ' + issues.join(' | '));
    }

    if (data.performance) {
      const p = data.performance;
      lines.push('', `## Performance  score:${p.score||0}/100`);
      const slow = (p.slowRequests||[]).slice(0,3).map((r:any)=>`${r.url?.split('/').pop()||r.url} ${Math.round(r.duration||0)}ms`);
      if (slow.length) lines.push('Slow: ' + slow.join(' | '));
      const large = (p.largeResources||[]).slice(0,3).map((r:any)=>`${r.url?.split('/').pop()||r.url} ${Math.round((r.size||0)/1024)}KB`);
      if (large.length) lines.push('Large: ' + large.join(' | '));
    }

    lines.push('', '## Task', prompt || 'Analyze this HAR and provide insights.');

    // Trim to safe char budget
    const full = lines.join('\n');
    return full.length > maxChars ? full.slice(0, maxChars) + '\n...(truncated)' : full;
  }

  private buildChatSystem(context: any): string {
    return [
      'You are an expert HTTP/web performance analyst reviewing a HAR file.',
      `HAR: ${context.entryCount||0} requests | ${context.domains?.length||0} domains`,
      `Avg duration: ${Math.round(context.avgDuration||0)}ms | Failed: ${context.failed||0}`,
      'Be concise and technical.',
    ].join('\n');
  }

  /** Trim message history to fit within token budget */
  private trimMessages(
    messages: Array<{ role: string; content: string }>,
    modelId: string,
    systemContent: string,
  ) {
    const budget = maxInputTokens(modelId) * 4 * 0.6; // chars
    const sysLen = systemContent.length;
    let used = sysLen;
    const result: typeof messages = [];

    // Keep the last N messages that fit
    for (let i = messages.length - 1; i >= 0; i--) {
      const len = messages[i].content.length;
      if (used + len > budget && result.length > 0) break;
      result.unshift(messages[i]);
      used += len;
    }
    return result;
  }

  /** Convert Groq API errors to user-friendly HttpExceptions */
  private mapGroqError(err: any, modelId: string): HttpException {
    const status  = err.status || 500;
    const code    = err.error?.error?.code || '';
    const message = err.error?.error?.message || err.message || 'Unknown Groq error';

    // User-friendly messages per error type
    if (code === 'model_terms_required') {
      return new BadRequestException(
        `Model "${modelId}" requires terms acceptance. Please visit console.groq.com to accept terms, then try again.`
      );
    }
    if (status === 413 || (status === 400 && message.includes('too large'))) {
      return new HttpException(
        `Request too large for model "${modelId}" (free tier TPM limit exceeded). Try a larger model like llama-3.3-70b-versatile.`,
        413,
      );
    }
    if (status === 429) {
      const retryAfter = err.headers?.['retry-after'] || '60';
      return new HttpException(
        `Rate limit reached for model "${modelId}". Please wait ${retryAfter}s and try again, or switch to a different model.`,
        429,
      );
    }
    if (status === 400 && message.includes('max_tokens')) {
      return new BadRequestException(
        `Model "${modelId}" has a small context window. Try llama-3.3-70b-versatile or mixtral-8x7b-32768.`
      );
    }
    if (status === 400 && message.includes('does not support chat')) {
      return new BadRequestException(
        `Model "${modelId}" does not support chat completions. Please select a text/chat model.`
      );
    }
    if (status === 401) {
      return new HttpException('Invalid Groq API key. Check GROQ_API_KEY in apps/api/.env', 401);
    }

    this.logger.error(`Groq API error [${status}] model=${modelId}: ${message}`);
    return new HttpException(`Groq error: ${message}`, status);
  }
}

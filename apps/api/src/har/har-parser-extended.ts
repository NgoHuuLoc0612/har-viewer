// This file intentionally extends the base HarParserService with browser-specific handling.
// Import into har-parser.service.ts as needed.
// The base service already handles all major cases; this provides additional enrichment.

import {
  normalizeHttpVersion,
  detectResourceTypeFromHeaders,
  extractBrowserFromUserAgent,
  extractOsFromUserAgent,
  estimateTlsFromHeaders,
} from './har-utils';

// Re-export for convenience
export {
  normalizeHttpVersion,
  detectResourceTypeFromHeaders,
  extractBrowserFromUserAgent,
  extractOsFromUserAgent,
  estimateTlsFromHeaders,
};

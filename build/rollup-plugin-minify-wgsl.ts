// Rollup plugin to minify WGSL shader code in template literals.
// Targets template literals tagged with the "wgsl" comment marker.

import type { Plugin, TransformResult } from 'rollup';

const COMMENT_REGEX = /\s*\/\/.*$/gm;
const MULTILINE_REGEX = /\n+/g;
const INDENT_REGEX = /\n\s+/g;
const OPERATOR_REGEX = /\s?([+\-/*=,<>!&|%:])\s?/g;
const LINEBREAK_REGEX = /([;,{}])\n(?=[^#])/g;
const BRACE_OPEN_REGEX = /([{(])\s+/g;
const BRACE_CLOSE_REGEX = /\s+([})])/g;
const KEYWORD_PAREN_REGEX = /\b(if|for|while|switch|return|let|var|const|fn)\s+(\(|{)/g;
const PAREN_BRACE_REGEX = /\)\s+\{/g;

/**
 * Minify WGSL code by stripping comments, whitespace, and unnecessary line breaks
 */
function minifyWGSL(code: string): string {
  return code
    .trim()
    .replace(COMMENT_REGEX, '')
    .replace(MULTILINE_REGEX, '\n')
    .replace(INDENT_REGEX, '\n')
    .replace(OPERATOR_REGEX, '$1')
    .replace(BRACE_OPEN_REGEX, '$1')
    .replace(BRACE_CLOSE_REGEX, '$1')
    .replace(KEYWORD_PAREN_REGEX, '$1$2')
    .replace(PAREN_BRACE_REGEX, '){')
    .replace(LINEBREAK_REGEX, '$1');
}

/**
 * Rollup plugin that minifies WGSL template literals
 */
export default function minifyWGSLPlugin(): Plugin {
  return {
    name: 'minify-wgsl',

    transform(code: string, id: string): TransformResult {
      // Only process JavaScript files
      if (!id.endsWith('.js') && !id.endsWith('.mjs') && !id.endsWith('.ts')) {
        return null;
      }

      // Look for template literals with /* wgsl */ tag comment
      // Pattern: /* wgsl */`...` (the comment immediately precedes the template literal)
      const wgslTagPattern = /\/\*\s*wgsl\s*\*\/\s*`([\s\S]*?)`/g;

      let hasChanges = false;
      const result = code.replace(wgslTagPattern, (_match: string, templateContent: string): string => {
        hasChanges = true;
        const minified = minifyWGSL(templateContent);
        return `/* wgsl */\`${minified}\``;
      });

      if (!hasChanges) {
        return null;
      }

      return {
        code: result,
        map: null
      };
    }
  };
}

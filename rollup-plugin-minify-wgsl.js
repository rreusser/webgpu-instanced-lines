// Rollup plugin to minify WGSL shader code in template literals.
// Targets template literals tagged with the "wgsl" comment marker.

const COMMENT_REGEX = /\s*\/\/.*$/gm;
const MULTILINE_REGEX = /\n+/g;
const INDENT_REGEX = /\n\s+/g;
const OPERATOR_REGEX = /\s?([+\-/*=,])\s?/g;
const LINEBREAK_REGEX = /([;,{}])\n(?=[^#])/g;

/**
 * Minify WGSL code by stripping comments, whitespace, and unnecessary line breaks
 * @param {string} code - WGSL source code
 * @returns {string} Minified WGSL code
 */
function minifyWGSL(code) {
  return code
    .trim()
    .replace(COMMENT_REGEX, '')
    .replace(MULTILINE_REGEX, '\n')
    .replace(INDENT_REGEX, '\n')
    .replace(OPERATOR_REGEX, '$1')
    .replace(LINEBREAK_REGEX, '$1');
}

/**
 * Rollup plugin that minifies WGSL template literals
 * @returns {import('rollup').Plugin}
 */
export default function minifyWGSLPlugin() {
  return {
    name: 'minify-wgsl',

    transform(code, id) {
      // Only process JavaScript files
      if (!id.endsWith('.js') && !id.endsWith('.mjs') && !id.endsWith('.ts')) {
        return null;
      }

      // Look for template literals with /* wgsl */ tag comment
      // Pattern: /* wgsl */`...` (the comment immediately precedes the template literal)
      const wgslTagPattern = /\/\*\s*wgsl\s*\*\/\s*`([\s\S]*?)`/g;

      let hasChanges = false;
      const result = code.replace(wgslTagPattern, (match, templateContent) => {
        hasChanges = true;
        const minified = minifyWGSL(templateContent);
        return `/* wgsl */\`${minified}\``;
      });

      if (!hasChanges) {
        return null;
      }

      return {
        code: result,
        map: null // We're not generating source maps for this transform
      };
    }
  };
}

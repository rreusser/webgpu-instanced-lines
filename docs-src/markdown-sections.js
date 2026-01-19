/**
 * Helper to extract sections from markdown by heading
 *
 * @param {string} markdown - Full markdown content
 * @param {string} heading - Heading text to find (without # prefix)
 * @param {number} [level] - Heading level (1-6), or 0 to match any level
 * @returns {string} Content from the heading until the next heading of same/higher level
 */
export function getSection(markdown, heading, level = 0) {
  const lines = markdown.split('\n');
  let capturing = false;
  let captureLevel = 0;
  const result = [];

  for (const line of lines) {
    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);

    if (headingMatch) {
      const hLevel = headingMatch[1].length;
      const hText = headingMatch[2].trim();

      if (capturing) {
        // Stop capturing at same or higher level heading
        if (hLevel <= captureLevel) {
          break;
        }
      } else if (hText === heading && (level === 0 || hLevel === level)) {
        // Start capturing (don't include the heading itself)
        capturing = true;
        captureLevel = hLevel;
        continue;
      }
    }

    if (capturing) {
      result.push(line);
    }
  }

  // Trim leading/trailing empty lines
  while (result.length && result[0].trim() === '') result.shift();
  while (result.length && result[result.length - 1].trim() === '') result.pop();

  return result.join('\n');
}

/**
 * Get section including its heading
 */
export function getSectionWithHeading(markdown, heading, level = 0) {
  const lines = markdown.split('\n');
  let capturing = false;
  let captureLevel = 0;
  const result = [];

  for (const line of lines) {
    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);

    if (headingMatch) {
      const hLevel = headingMatch[1].length;
      const hText = headingMatch[2].trim();

      if (capturing) {
        if (hLevel <= captureLevel) {
          break;
        }
      } else if (hText === heading && (level === 0 || hLevel === level)) {
        capturing = true;
        captureLevel = hLevel;
        result.push(line); // Include the heading
        continue;
      }
    }

    if (capturing) {
      result.push(line);
    }
  }

  while (result.length && result[result.length - 1].trim() === '') result.pop();

  return result.join('\n');
}

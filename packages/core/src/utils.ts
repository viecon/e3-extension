/**
 * Flatten nested params for Moodle API's expected format.
 * e.g. { courseids: [1, 2] } → courseids[0]=1&courseids[1]=2
 */
export function flattenParams(
  params: Record<string, unknown>,
  body: URLSearchParams,
  prefix = '',
): void {
  for (const [key, value] of Object.entries(params)) {
    const fullKey = prefix ? `${prefix}[${key}]` : key;

    if (Array.isArray(value)) {
      value.forEach((item, index) => {
        if (typeof item === 'object' && item !== null) {
          flattenParams(item as Record<string, unknown>, body, `${fullKey}[${index}]`);
        } else {
          body.append(`${fullKey}[${index}]`, String(item));
        }
      });
    } else if (typeof value === 'object' && value !== null) {
      flattenParams(value as Record<string, unknown>, body, fullKey);
    } else if (value !== undefined && value !== null) {
      body.append(fullKey, String(value));
    }
  }
}

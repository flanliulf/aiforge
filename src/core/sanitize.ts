/**
 * Token sanitization utilities — never log raw tokens
 * Rule: first 8 + **** + last 4 for tokens > 12 chars
 *       first 4 + **** (no tail) for tokens <= 12 chars
 */

export function sanitizeToken(token: string): string {
  if (token.length > 12) {
    return token.slice(0, 8) + '****' + token.slice(-4)
  }
  return token.slice(0, 4) + '****'
}

export function sanitizeUrl(url: string): string {
  // Match userinfo in https://[user:]token@host/... pattern
  // Handles both https://token@host and https://oauth2:token@host (GitLab standard)
  // Also handles hostless URLs like https://oauth2:token@ (bare @ with no host/path)
  return url.replace(/^(https?:\/\/)([^@]+)(@.*)$/, (_match, scheme, userinfo, rest) => {
    const colonIdx = userinfo.indexOf(':')
    if (colonIdx !== -1) {
      // oauth2:token format — sanitize only the credential after ':'
      const prefix = userinfo.slice(0, colonIdx + 1)
      const credential = userinfo.slice(colonIdx + 1)
      return scheme + prefix + sanitizeToken(credential) + rest
    }
    return scheme + sanitizeToken(userinfo) + rest
  })
}

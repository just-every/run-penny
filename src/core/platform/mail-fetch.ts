/** Workers supports only follow/manual. Implement Fetch's error redirect policy
 * for Base's relay adapter without ever making a second network request. */
export const mailRelayFetch: typeof fetch = async (input, init) => {
  const response = await fetch(input, { ...init, redirect: 'manual' })
  if (response.status >= 300 && response.status < 400) throw new TypeError('Mail relay redirect refused.')
  return response
}

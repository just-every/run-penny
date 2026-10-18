export function pennyApi(client, settings) {
  let origin;
  try {
    const url = new URL(settings.penny_origin);
    if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || url.pathname !== '/' || url.port || url.hostname !== settings.penny_host || !/^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/.test(url.hostname)) throw new Error();
    origin = url.origin;
  } catch {
    throw new Error('Ask your Zendesk admin to set a valid Penny HTTPS origin and matching allowed hostname, without a path or port.');
  }
  return async function request(path, body) {
    return client.request({
      url: origin + path,
      type: body === undefined ? 'GET' : 'POST',
      headers: { Authorization: 'Bearer {{setting.penny_api_key}}' },
      secure: true,
      cors: false,
      autoRetry: false,
      dataType: 'json',
      ...(body === undefined ? {} : { contentType: 'application/json', data: JSON.stringify(body) })
    });
  };
}

export function visibleError(error) {
  if (error instanceof Error) return error.message;
  const status = Number(error?.status);
  if (status === 401 || status === 403) return 'Penny refused access. Ask your admin to check the key, scopes, expiry and issuing operator.';
  if (status === 409) return 'The customer or request changed, or that email already belongs to a customer. Find and select the current customer and review again.';
  if (status === 404) return 'This request is no longer available. Search for the current request.';
  return `Penny could not complete the request${status ? ` (HTTP ${status})` : ''}. Check the connection and try again.`;
}

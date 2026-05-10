export function getSessionId(): string {
  const key = 'uweather_session_id';
  let id = sessionStorage.getItem(key);
  if (!id) {
    id = `web-${crypto.randomUUID()}`;
    sessionStorage.setItem(key, id);
  }
  return id;
}

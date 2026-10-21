window.GAME_REQUEST = async function (url, options = {}) {
  const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    const data = await response.json().catch(() => ({ ok: false, error: "서버 응답을 읽을 수 없습니다" }));
    if (response.status >= 500 && typeof CustomEvent === 'function') {
      const action = new URL(url, location.href).searchParams.get('a') || '';
      if (/^[a-z_]{1,40}$/.test(action)) window.dispatchEvent(new CustomEvent('api-diagnostic', {detail:{action,status:response.status,requestId:response.headers?.get('X-Request-Id')||''}}));
    }
    return { response, data };
  } catch (e) {
    throw Object.assign(new Error(e.name === "AbortError" ? "요청 시간이 초과되었습니다. 다시 시도해 주세요" : "offline"), { network: true });
  } finally { clearTimeout(timer); }
};

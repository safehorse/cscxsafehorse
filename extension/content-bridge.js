// Roda no "isolated world" (contexto normal de content script da extensão).
// Recebe os dados que o content-main.js (que roda dentro da página de
// verdade) manda via postMessage, e repassa pro service worker, que é quem
// tem permissão de chamar a API do CSCX.
window.addEventListener('message', event => {
  if (event.source !== window) return
  const data = event.data
  if (!data || data.source !== 'cscx-wa-main') return
  chrome.runtime.sendMessage({ type: data.type, payload: data.payload }).catch(() => {})
})

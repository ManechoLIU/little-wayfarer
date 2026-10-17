// Shared allowlist: the relay must never become an arbitrary network proxy.
const BASES = new Map([
  ['https://api.deepseek.com', 'DeepSeek'],
  ['https://api.deepseek.com/v1', 'DeepSeek'],
  ['https://api.siliconflow.cn/v1', '硅基流动'],
]);
export function normalizePersonalModel(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const keys = Object.keys(value).sort();
  if (keys.length !== 3 || keys.join(',') !== 'apiKey,baseURL,model' || typeof value.baseURL !== 'string' || typeof value.model !== 'string' || typeof value.apiKey !== 'string') return null;
  let url;
  try { url = new URL(value.baseURL.trim()); } catch { return null; }
  if (url.protocol !== 'https:' || url.username || url.password || url.port || url.search || url.hash) return null;
  const baseURL = `${url.origin}${url.pathname}`.replace(/\/+$/, '').replace(/\/chat\/completions$/, '');
  if (!BASES.has(baseURL) || !/^[A-Za-z0-9][A-Za-z0-9_.:/-]{0,159}$/.test(value.model.trim()) || !/^[\x21-\x7e]{1,512}$/.test(value.apiKey)) return null;
  return { baseURL, model: value.model.trim(), apiKey: value.apiKey };
}
export function personalModelProvider(config) { return BASES.get(config?.baseURL) || '自己的模型'; }

export async function requestRecordAnalysis(text, { personalModel, accessCode = '', onAccessRequired, fetch: fetchImpl = globalThis.fetch } = {}) {
  const response = await fetchImpl('/api/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(!personalModel && accessCode ? { 'x-ai-access-code': accessCode } : {}) },
    body: JSON.stringify({ text, ...(personalModel ? { personalModel } : {}) }),
  });
  let data;
  try { data = await response.json(); } catch { throw Error('分析服务返回异常，文字还在，请稍后再试。'); }
  if (response.status === 401) {
    if (personalModel) throw Error('自己的模型未授权，请核对密钥。没有改用本站额度。');
    onAccessRequired?.();
    throw Error('请输入现场提供的体验码，或使用自己的模型。');
  }
  if (!response.ok) throw Error(personalModel ? '自己的模型调用失败，请核对接口、模型名、密钥和余额。没有改用本站额度。' : data.error || 'AI分析没有完成，请稍后重试。');
  return data;
}

import { isAddress } from 'ethers';

export function chooseAuthorizedAccount(accounts, preferred = '') {
  const valid = Array.isArray(accounts) ? accounts.filter(isAddress) : [];
  if (!valid.length) throw new Error('钱包没有返回已授权账户，请重新连接。');
  if (!preferred) return valid[0];
  const selected = valid.find(address => address.toLowerCase() === preferred.toLowerCase());
  if (!selected) throw new Error('所选账户已不在授权列表中，请重新选择账户。');
  return selected;
}

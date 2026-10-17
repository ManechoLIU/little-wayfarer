// Never overwrite another tab's newer journal, or treat a failed write as saved.
export function writeJournal(storage,key,value,expected){
  try{
    if(storage.getItem(key)!==expected)throw Error('另一页更新了旅程。请先导出当前手账，再刷新打开最新记录。');
    const encoded=JSON.stringify(value);storage.setItem(key,encoded);return encoded;
  }catch(e){if(e.message?.includes('另一页'))throw e;throw Error('浏览器未能保存这一步，操作没有完成。请导出已有手账，检查存储空间后重试。');}
}
export function verifySyncCursor(onchain,local,confirmed){
  if(onchain>local)throw Error('链上旅程比本机更新，请保留当前手账并核验链上记录。');
  if(onchain!==confirmed)throw Error('链上记录已在另一页更新，或上次回执未保存。为避免把不同故事标成上链，请先导出并核验记录。');
}

export function verifyCardReplay(traveler) {
 const chapter=traveler.chapter;
 if(!Number.isInteger(chapter)||chapter<0||chapter>100||!Array.isArray(traveler.memories)||traveler.memories.length!==chapter||traveler.memories.some((m,i)=>m.chapter!==i+1))throw Error('本机缺少完整的早期章节，无法更换同行卡。原卡仍保留，请先备份记录。');
}

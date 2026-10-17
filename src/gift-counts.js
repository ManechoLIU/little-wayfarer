// Old cards do not expose counters. Never invent a total from their mark bits.
export async function readGiftCounts(contract, id) {
  try {
    const counts = await contract.getGiftCounts(id);
    return Array.from(counts, count => BigInt(count).toString());
  } catch (error) {
    if (error?.code === 'CALL_EXCEPTION') return undefined;
    throw error;
  }
}

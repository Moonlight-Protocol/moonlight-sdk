import { StellarPlus } from "stellar-plus";
import type { NetworkConfig } from "stellar-plus/lib/stellar-plus/network";

const { DefaultAccountHandler } = StellarPlus.Account;

/**
 * Creates a default account handler with TestNet configuration
 * @returns The initialized account handler and network configuration
 */
export async function createTestAccount(): Promise<{
  account: typeof DefaultAccountHandler.prototype;
  networkConfig: NetworkConfig;
}> {
  const networkConfig = StellarPlus.Network.TestNet();
  const account = new DefaultAccountHandler({
    networkConfig: networkConfig,
  });
  await account.initializeWithFriendbot();
  return { account, networkConfig };
}

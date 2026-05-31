import type { DefaultAccountHandler } from "stellar-plus/lib/stellar-plus/account";
import type { NetworkConfig } from "stellar-plus/lib/stellar-plus/network";
import { loadContractWasm } from "./load-wasm.ts";
import { PoolEngine } from "../../mod.ts";
export const deployPrivacyPool = async (args: {
  admin: DefaultAccountHandler;
  assetContractId: string;
  networkConfig: NetworkConfig;
}) => {
  const { admin, assetContractId, networkConfig } = args;

  const wasm = loadContractWasm("privacy_pool");

  const pool = await PoolEngine.create({
    networkConfig,
    wasm,
    assetContractId,
  });

  const txInvocation = {
    header: {
      source: admin.getPublicKey(),
      fee: "100000",
      timeout: 30,
    },
    signers: [admin],
  };

  await pool.uploadWasm(txInvocation);

  await pool.deploy({
    ...txInvocation,
    contractArgs: { admin: admin.getPublicKey() },
  });

  return pool;
};

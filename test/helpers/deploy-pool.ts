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

  console.log("Uploading pool contract...");
  await pool.uploadWasm(txInvocation);

  console.log("Pool contract uploaded: ", pool.getWasmHash());

  console.log("Deploying pool contract...");

  await pool.deploy({
    ...txInvocation,
    contractArgs: { admin: admin.getPublicKey() },
  });

  console.log("Pool contract deployed: ", pool.getContractId());

  return pool;
};

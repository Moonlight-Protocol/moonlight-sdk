// import { StellarPlus } from "stellar-plus";
// import { deployPrivacyPool } from "../helpers/deploy-pool.ts";
// import { traverseObjectLog } from "../utils/traverse-object-log.ts";
// import { ReadMethods, WriteMethods } from "../../mod.ts";
// import { deriveP256KeyPairFromSeed } from "../../src/utils/secp256r1/deriveP256KeyPairFromSeed.ts";
// import { Buffer } from "buffer";
// import { signPayload } from "../../src/utils/secp256r1/signPayload.ts";

// const { DefaultAccountHandler } = StellarPlus.Account;
// const { SACHandler } = StellarPlus.Asset;
// const { TestNet } = StellarPlus.Network;

// export const TEST_NETWORK = TestNet();

// export const admin = new DefaultAccountHandler({
//   networkConfig: TEST_NETWORK,
// });

// const XLM_CONTRACT_ID_TESTNET =
//   "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC";

// const XLM_CONTRACT_ID =
//   TEST_NETWORK.name === TestNet().name ? XLM_CONTRACT_ID_TESTNET : "";

// const XLM = new SACHandler({
//   networkConfig: TEST_NETWORK,
//   code: "XLM",
//   contractParameters: {
//     contractId: XLM_CONTRACT_ID,
//   },
// });

// const txInvocation = {
//   header: {
//     source: admin.getPublicKey(),
//     fee: "100000",
//     timeout: 30,
//   },
//   signers: [admin],
// };

// const runSetup = async () => {
//   console.log("Initializing admin: ", admin.getPublicKey());
//   await admin.initializeWithFriendbot();
//   console.log(
//     "Admin initialized with balance: ",
//     await XLM.classicHandler.balance(admin.getPublicKey())
//   );

//   const pool = await deployPrivacyPool({
//     admin: admin,
//     assetContractId: XLM_CONTRACT_ID,
//     networkConfig: TEST_NETWORK,
//   });

//   // console.log(
//   //   "admin: ",
//   //   await pool.read({
//   //     ...txInvocation,
//   //     method: ReadMethods.admin,
//   //     methodArgs: {},
//   //   })
//   // );

//   // const utxoKP = deriveP256KeyPairFromSeed(Buffer.from("TEST"));

//   // await pool.write({
//   //   ...txInvocation,
//   //   method: WriteMethods.deposit,
//   //   methodArgs: {
//   //     amount: 5000n,
//   //     from: admin.getPublicKey(),
//   //     utxo: utxoKP.publicKey as Buffer,
//   //   },
//   // });

//   // const pyaload = pool.buildBurnPayload({
//   //   utxo: utxoKP.publicKey as Buffer,
//   //   amount: 5000n,
//   // });

//   // const signedPayload = await signPayload(pyaload, utxoKP.privateKey as Buffer);

//   // await pool.write({
//   //   ...txInvocation,
//   //   method: WriteMethods.withdraw,
//   //   methodArgs: {
//   //     utxo: utxoKP.publicKey as Buffer,
//   //     to: admin.getPublicKey(),
//   //     signature: signedPayload as Buffer,
//   //     amount: 5000n,
//   //   },
//   // });
// };

// runSetup()
//   .catch((e) => traverseObjectLog(e, { maxDepth: 4, nodeThreshold: 7 }))
//   .then(() => console.log("Setup complete!"));

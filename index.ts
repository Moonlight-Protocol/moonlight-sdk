import { StellarPlus } from "stellar-plus";
import {
  Bundle,
  PermissionlessPool,
} from "./src/pool/permissionlessPoolClient.ts";
import { TransactionInvocation } from "stellar-plus/lib/stellar-plus/types";
import { Buffer } from "buffer";
import { StellarPlusErrorObject as SPError } from "stellar-plus/lib/stellar-plus/error/types";
import { hash } from "node:crypto";
import { SPPAccount } from "./src/account/sppAccount.ts";
import {
  StellarNetwork,
  StellarNetworkDerivatorFactory,
} from "./src/account/derivation/schemas/stellar.ts";
import { UTXOPublicKey } from "./src/core/utxo-keypair-base/types.ts";
import { ExecutorClient } from "./src/executor/client.ts";
import { SelectionDirective } from "./mod.ts";
const { TestNet } = StellarPlus.Network;
const XLM_CONTRACT_ID =
  "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC";
// console.log(a);

const XLM = new StellarPlus.Asset.SACHandler({
  networkConfig: TestNet(),
  code: "XLM",
  contractParameters: {
    contractId: XLM_CONTRACT_ID,
  },
});
const pool = new PermissionlessPool({
  assetContractId: XLM_CONTRACT_ID,
  networkConfig: TestNet(),
});

const admin = new StellarPlus.Account.DefaultAccountHandler({
  networkConfig: TestNet(),
  secretKey: "SB6MNQ3CF7C2AYEUM6HRKSRPAPXX6NRXFJSCGIYR2DHSCIMFPTO5KLA7",
});

const txInvocation: TransactionInvocation = {
  header: {
    source: admin.getPublicKey(),
    fee: "100000",
    timeout: 30,
  },
  signers: [admin],
};

const run = async () => {
  // console.log("Creating admin: ", admin.getPublicKey());
  // await admin.initializeWithFriendbot();

  console.log(
    "Admin initialized with balance: ",
    await XLM.classicHandler.balance(admin.getPublicKey())
  );

  const derivatorFactory = StellarNetworkDerivatorFactory({
    network: StellarNetwork.Testnet,
    smartContract: pool.getContractId(),
  });

  const account = new SPPAccount({
    networkConfig: TestNet(),
    secretKey: "SB5UPGAHUHJ53GZNAMEQKLHPGIKDUY3Y37THVTRXBFQGKBFCOVAQD7EF",
    derivatorFactory,
    utxoBalances: (publicKeys: UTXOPublicKey[]) => {
      return pool.balances({
        utxos: publicKeys.map((pk) => Buffer.from(pk)),
        txInvocation,
      });
    },
  });

  console.log("Secret: ", account.getSecretKey());
  await account.deriveAndLoad(500);

  // ==========DEPOSIT ===============

  // const depSeqs = await account.selectFreeUtxos(3);

  // console.log("Depositing");
  // await pool.deposit({
  //   amount: 50000n,
  //   from: admin.getPublicKey(),
  //   txInvocation,
  //   utxo: Buffer.from(account.getUtxo(depSeqs[0]).keypair.publicKey),
  // });

  // await account.updateAndReleaseUtxos(depSeqs);
  // ==========TRANSFER================
  {
    console.log("Reserved Sequences: ", account.getReservedSequences());

    const receivers = 40;
    const selectedSequences = await account.selectFreeUtxos(receivers);

    //divides 1200 into two random numbers
    let totalAllocated = 0;
    const parts = [];

    for (let i = 0; i < receivers; i++) {
      const part = Math.floor(
        Math.random() *
          (Number(await account.getUnspentBalance()) / 10 / receivers)
      );

      totalAllocated += part;
      parts.push(part);
    }

    console.log("TOTAL ALLOC: ", totalAllocated);

    const { senders, change } = await account.getSenderSample(
      BigInt(totalAllocated),
      SelectionDirective.RANDOM
    );

    console.log(
      "selected senders Sequences: ",
      senders.map((sender) => sender.derivation.sequence)
    );

    console.log("Parts: ", parts);

    const bundle: Bundle = {
      spend: [
        ...senders.map((sender) => Buffer.from(sender.keypair.publicKey)),
      ],
      create: parts.map((p, i) => [
        Buffer.from(account.getUtxo(selectedSequences[i]).keypair.publicKey),
        BigInt(p),
      ]),
      signatures: [],
    };

    console.log("checking for change ", change);
    if (change) {
      //   bundle.create.push([
      //     Buffer.from(account.getUtxo(selectedSequences[2]).keypair.publicKey),
      //     BigInt(change),
      //   ]);
    }

    const payload = pool.buildBundlePayload(bundle);

    bundle.signatures = [
      ...(await account.signUtxos(
        payload,
        senders.map((sender) => sender.derivation.sequence)
      )),
    ];

    console.log("Sending bundle");

    const executor = new ExecutorClient({
      apiUrl: "http://localhost:8000",
    });

    const res = await executor.delegatedTransfer([bundle]);
    console.log("Response: ", res);

    // const unbufferizedBundle = {
    //   spend: bundle.spend.map((spend) => new Uint8Array(spend)), // ✅ Keep Uint8Array
    //   create: bundle.create.map(([pk, amount]) => [
    //     new Uint8Array(pk), // ✅ Keep Uint8Array
    //     amount.toString(), // ✅ Convert BigInt to string
    //   ]),
    //   signatures: bundle.signatures.map(
    //     (signature) => new Uint8Array(signature)
    //   ), // ✅ Keep Uint8Array
    // };

    // const apiUrl = "http://localhost:8000/execute";

    // const execPayload = {
    //   bundles: [unbufferizedBundle],
    // };

    // // ✅ Custom JSON.stringify to handle BigInt
    // const jsonPayload = JSON.stringify(execPayload, (_, value) => {
    //   if (value instanceof Uint8Array) {
    //     return Array.from(value); // ✅ Convert Uint8Array to plain array
    //   }
    //   if (typeof value === "bigint") {
    //     return value.toString(); // ✅ Convert BigInt to string
    //   }
    //   return value;
    // });

    // const response = await fetch(apiUrl, {
    //   method: "POST",
    //   headers: { "Content-Type": "application/json" },
    //   body: jsonPayload,
    // });

    // const data = await response.json();
    // console.log("Response:", data);

    //     await pool.transfer({
    //       bundles: [bundle],
    //       txInvocation,
    //     });

    //     console.log("Updating");
    //     await account.updateAndReleaseUtxos([
    //       ...senders.map((sender) => sender.derivation.sequence),
    //       ...selectedSequences,
    //     ]);

    //     console.log("local balance: ", account.getUnspentBalance());
    //     console.log("UTXOs: ");
    //     account.getUTXOs().forEach((utxo) => {
    //       console.log(
    //         "UTXO: ",
    //         utxo.sequence,
    //         " status: ",
    //         utxo.status,
    //         " balance: ",
    //         utxo.balance
    //       );
    //     });
  }
  //  ==============DEPOSIT================
  // {
  //   const selectedSequences = await account.selectFreeUtxos(3);

  //   console.log("Depositing 1000");
  //   await pool.deposit({
  //     from: admin.getPublicKey(),
  //     amount: 10000n,
  //     utxo: Buffer.from(
  //       account.getUtxo(selectedSequences[0]).keypair.publicKey
  //     ),
  //     txInvocation,
  //   });

  //   console.log("Depositing 500");
  //   await pool.deposit({
  //     from: admin.getPublicKey(),
  //     amount: 5000n,
  //     utxo: Buffer.from(
  //       account.getUtxo(selectedSequences[1]).keypair.publicKey
  //     ),
  //     txInvocation,
  //   });

  //   console.log("Depositing 125");
  //   await pool.deposit({
  //     from: admin.getPublicKey(),
  //     amount: 7000n,
  //     utxo: Buffer.from(
  //       account.getUtxo(selectedSequences[2]).keypair.publicKey
  //     ),
  //     txInvocation,
  //   });

  //   console.log("Deposited!");
  //   console.log("local balance: ", account.getUnspentBalance());
  //   console.log("Unspent UTXOs: ", account.getUnspentBalances());

  //   console.log("updating");

  //   await account.loadUTXOs(selectedSequences);
  //   console.log("local balance: ", account.getUnspentBalance());
  //   console.log("Unspent UTXOs: ", account.getUnspentBalances());
  // }
};

run().catch((e) => {
  console.log(e);

  // console.log((e as SPError).meta);

  // console.log("XDR: ", (e as SPError).?.);
});

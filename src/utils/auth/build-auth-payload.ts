import { Buffer } from "node:buffer";
import {
  Condition,
  CreateCondition,
  DepositCondition,
  WithdrawCondition,
} from "../../conditions/types.ts";

export const buildAuthPayloadHash = ({
  contractId,
  conditions,
  liveUntilLedger,
}: {
  contractId: string;
  conditions: Condition[];
  liveUntilLedger: number;
}): Uint8Array => {
  const encoder = new TextEncoder();

  const encodedContractId = encoder.encode(contractId);
  // const addr = Address.fromString(contractId);
  // const addrXdr = addr.toScAddress().toXDR();
  const parts: Uint8Array[] = [encodedContractId];

  const createConditions: CreateCondition[] = [];
  const depositConditions: DepositCondition[] = [];
  const withdrawConditions: WithdrawCondition[] = [];

  for (const condition of conditions) {
    if (condition.action === "CREATE") {
      createConditions.push(condition);
    } else if (condition.action === "DEPOSIT") {
      depositConditions.push(condition);
    } else if (condition.action === "WITHDRAW") {
      withdrawConditions.push(condition);
    }
  }

  // CREATE
  // parts.push(encoder.encode("CREATE"));
  for (const createCond of createConditions) {
    parts.push(new Uint8Array(createCond.utxo));
    const amountBytes = bigintToLE(createCond.amount, 16);
    parts.push(amountBytes);
  }
  // DEPOSIT
  // parts.push(encoder.encode("DEPOSIT"));
  for (const depositCond of depositConditions) {
    // const addrXdr = Address.fromString(depositCond.publicKey)
    //   .toScAddress()
    //   .toXDR();
    parts.push(encoder.encode(depositCond.publicKey));
    parts.push(bigintToLE(depositCond.amount, 16));
  }
  // WITHDRAW
  // parts.push(encoder.encode("WITHDRAW"));
  for (const withdrawCond of withdrawConditions) {
    // const addrXdr = Address.fromString(withdrawCond.publicKey)
    //   .toScAddress()
    //   .toXDR();
    // parts.push(new Uint8Array(addrXdr));
    parts.push(encoder.encode(withdrawCond.publicKey));
    parts.push(bigintToLE(withdrawCond.amount, 16));
  }

  // parts.push(encoder.encode("INTEGRATE"));
  // MOCK

  const encodedLiveUntil = bigintToLE(BigInt(liveUntilLedger), 4);
  parts.push(encodedLiveUntil);

  // Concatenate all parts into one Uint8Array
  const payloadBuffer = Buffer.concat(parts);
  // const payload = new Uint8Array(payloadBuffer);
  const payload = Buffer.concat(parts);

  // return sha256Buffer(payload);
  return payload;
};

//convert bigint to little endian
export function bigintToLE(amount: bigint, byteLength: number): Uint8Array {
  const result = new Uint8Array(byteLength);
  let temp = amount;
  for (let i = 0; i < byteLength; i++) {
    result[i] = Number(temp & BigInt(0xff));
    temp = temp >> BigInt(8);
  }
  return result;
}

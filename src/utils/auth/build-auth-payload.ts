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
  for (const createCond of createConditions) {
    parts.push(new Uint8Array(createCond.utxo));
    const amountBytes = bigintToLE(createCond.amount, 16);
    parts.push(amountBytes);
  }
  // DEPOSIT
  for (const depositCond of depositConditions) {
    parts.push(encoder.encode(depositCond.publicKey));
    parts.push(bigintToLE(depositCond.amount, 16));
  }
  // WITHDRAW
  for (const withdrawCond of withdrawConditions) {
    parts.push(encoder.encode(withdrawCond.publicKey));
    parts.push(bigintToLE(withdrawCond.amount, 16));
  }

  const encodedLiveUntil = bigintToLE(BigInt(liveUntilLedger), 4);
  parts.push(encodedLiveUntil);

  // Concatenate all parts into one Uint8Array
  const payloadBuffer = Buffer.concat(parts);
  const payload = Buffer.concat(parts);

  return payload;
};

// Convert bigint to little endian
export function bigintToLE(amount: bigint, byteLength: number): Uint8Array {
  const result = new Uint8Array(byteLength);
  let temp = amount;
  for (let i = 0; i < byteLength; i++) {
    result[i] = Number(temp & BigInt(0xff));
    temp = temp >> BigInt(8);
  }
  return result;
}

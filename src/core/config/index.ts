import { Server } from "@stellar/stellar-sdk/rpc";
import { highlightText } from "../../utils/common"

export function getRequiredEnv(key: string): string {
  const value = Deno.env.get(key);
  if (!value) {
    console.error(
      highlightText(
        `Error: Environment variable ${key} is not set.\nCheck the 'Setup' section of the README.md file.`,
        "red"
      )
    );

    throw new Error(`Required environment variable ${key} is not set. `);
  }
  return value;
}

export const getRpc = () => {
  return new Server(getRequiredEnv("STELLAR_RPC_URL"), { allowHttp: true });
};
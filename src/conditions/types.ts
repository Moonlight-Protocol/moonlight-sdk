export type CreateCondition = {
    action: "CREATE";
    utxo: Uint8Array;
    amount: bigint;
  };
  
  export type DepositCondition = {
    action: "DEPOSIT";
    publicKey: string;
    amount: bigint;
  };

  export type WithdrawCondition = {
    action: "WITHDRAW";
    publicKey: string;
    amount: bigint;
  };
  
  export type Condition = CreateCondition | DepositCondition | WithdrawCondition;
import { Account, Credit, Debit, Payment, Transfer } from "../types";
import {
  StellarOperation,
  StellarEffect,
  SorobanEvent,
} from "@subql/types-stellar";
import {
  AccountCredited,
  AccountDebited,
} from "@stellar/stellar-sdk/lib/horizon/types/effects";
import { Horizon } from "@stellar/stellar-sdk";
import { Address, xdr } from "@stellar/stellar-sdk";

export async function handleOperation(
  op: StellarOperation<Horizon.HorizonApi.PaymentOperationResponse>
): Promise<void> {
  logger.info(`Indexing operation ${op.id}, type: ${op.type}`);

  const fromAccount = await checkAndGetAccount(op.from, op.ledger.sequence);
  const toAccount = await checkAndGetAccount(op.to, op.ledger.sequence);

  const payment = Payment.create({
    id: op.id,
    fromId: fromAccount.id,
    toId: toAccount.id,
    txHash: op.transaction_hash,
    amount: op.amount,
  });

  fromAccount.lastSeenLedger = op.ledger.sequence;
  toAccount.lastSeenLedger = op.ledger.sequence;
  await Promise.all([fromAccount.save(), toAccount.save(), payment.save()]);
}

export async function handleCredit(
  effect: StellarEffect<AccountCredited>
): Promise<void> {
  logger.info(`Indexing effect ${effect.id}, type: ${effect.type}`);

  const account = await checkAndGetAccount(
    effect.account,
    effect.ledger.sequence
  );

  const credit = Credit.create({
    id: effect.id,
    accountId: account.id,
    amount: effect.amount,
  });

  account.lastSeenLedger = effect.ledger.sequence;
  await Promise.all([account.save(), credit.save()]);
}

export async function handleDebit(
  effect: StellarEffect<AccountDebited>
): Promise<void> {
  logger.info(`Indexing effect ${effect.id}, type: ${effect.type}`);

  const account = await checkAndGetAccount(
    effect.account,
    effect.ledger.sequence
  );

  const debit = Debit.create({
    id: effect.id,
    accountId: account.id,
    amount: effect.amount,
  });

  account.lastSeenLedger = effect.ledger.sequence;
  await Promise.all([account.save(), debit.save()]);
}
// export async function handleEventTestnet(event: SorobanEvent): Promise<void> {
//   logger.info(`Transaction hash: ${event.transaction.hash.toString()}`);
//   if (event.type.toString() == "contract") {
//     logger.info(`Event value: ${JSON.stringify(event.value)}`);
//     const increment = Increment.create({
//       id: event.transaction.hash,
//       newValue: BigInt(
//         JSON.parse(JSON.stringify(event.value))["_value"].toString(),
//       ),
//     });
//     await increment.save();
//   }
// }

export async function handleEventMainnet(event: SorobanEvent): Promise<void> {
  logger.info(`New transfer event found at block ${event.ledger}`);
  logger.info(`Event data: ${JSON.stringify(event)}`);
  logger.info(`Topics: ${JSON.stringify(event.topic)}`);

  // Get data from the event
  // The transfer event has the following payload \[env, from, to\]
  logger.info(JSON.stringify(event));
  const {
    topic: [env, fromScVal, toScVal],
  } = event;

  // Usar decodeAddress para convertir los ScVal a strings
  const from = decodeAddress(fromScVal);
  const to = decodeAddress(toScVal);

  const fromAccount = await checkAndGetAccount(from, event.ledger.sequence);
  const toAccount = await checkAndGetAccount(to, event.ledger.sequence);

  // Create the new transfer entity
  const transfer = Transfer.create({
    id: event.id,
    ledger: event.ledger.sequence,
    date: new Date(event.ledgerClosedAt),
    contract: event.contractId.toString(), // Convertir a string
    fromId: fromAccount.id,
    toId: toAccount.id,
    value: BigInt(event.value.toString()), // Convertir ScVal a string
  });

  fromAccount.lastSeenLedger = event.ledger.sequence;
  toAccount.lastSeenLedger = event.ledger.sequence;
  await Promise.all([fromAccount.save(), toAccount.save(), transfer.save()]);
}

async function checkAndGetAccount(
  id: string,
  ledgerSequence: number,
): Promise<Account> {
  let account = await Account.get(id.toLowerCase());
  if (!account) {
    // We couldn't find the account
    account = Account.create({
      id: id.toLowerCase(),
      firstSeenLedger: ledgerSequence,
    });
  }
  return account;
}

// scValToNative not works, temp solution
function decodeAddress(scVal: xdr.ScVal): string {
  try {
    return Address.account(scVal.address().accountId().ed25519()).toString();
  } catch (e) {
    return Address.contract(scVal.address().contractId()).toString();
  }
}
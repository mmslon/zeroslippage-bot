import type { Command } from "commander";
import { Option } from "commander";
import { handle } from "../../utils/command.js";
import { checkExchangeAccount } from "@opentrader/trpc/routers/private/exchange-accounts/check-account/handler.js";

export function checkBalanceExchange(program: Command) {
  program
    .command("exchange-balance")
    .description("Check exchange account balance")
    .addOption(new Option("-i, --id <id>", "Id"))
    .action(handle(checkExchangeAccount));
}

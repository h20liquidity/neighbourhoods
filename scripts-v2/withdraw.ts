import * as path from "path";
import { argv } from "process";
import * as dotenv from "dotenv";
import { getCommons, supportedNetworks } from "./utils";
import networkConfig from "../networkConfig.json"
import { withdrawTokens } from "./utils/pilot";
const { Command } = require("commander");

dotenv.config(); 

async function main() { 

  const cmdOptions = new Command()
    .requiredOption("-f --from <network-name>",`Network to withdraw tokens from. Any of [${supportedNetworks}]`)
    .requiredOption("--token <token symbol>",`Token symbol to withdraw. eg USDT, USDC`)
    .requiredOption("-v --vault <vault>",`Hexadecimal string representing the vault id.`)
    .requiredOption("-a --amount <amount>",`Amount of tokens to withdraw. eg : 3.2, 100`)
    .description([
      "Withdraw Tokens from vault."
    ].join("\n"))
    .parse(argv) 
    .opts(); 

  const fromNetwork = cmdOptions.from
  const token = cmdOptions.token 
  const vaultId = cmdOptions.vault  
  const amount = cmdOptions.amount 

  const tokenDetails = networkConfig.filter(n => n.network === fromNetwork)[0].stableTokens
    .filter(t => t.symbol === token)[0]
  
  if(!tokenDetails){ 
    throw new Error(`Withdraw ${token} is not supported on ${fromNetwork}`)
  } 

  console.log(">>> Withdrawing Tokens from vault...") 
  
  // Get Chain details
  const common = getCommons(fromNetwork)  

  const withdrawTx = await withdrawTokens(fromNetwork,process.env.DEPLOYMENT_KEY,common,amount,vaultId,tokenDetails)  
   
  const receipt = await withdrawTx.wait() 
  console.log(`Amount Withdrawn : ${receipt.transactionHash}`) 
  console.log(`--------------------------------------------`)


}



// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}); 


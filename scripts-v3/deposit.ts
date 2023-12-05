import * as dotenv from "dotenv";
import { getCommons, supportedNetworks } from "./utils";
const { Command } = require("commander");
import networkConfig from "../networkConfig.json"
import { depositTokens } from "./utils/np-strat";

dotenv.config();


async function main(argv){ 

  const cmdOptions = new Command()
    .requiredOption("-t --to <network-name>",`Target network to deposit tokens to. Any of [${supportedNetworks}]`)
    .requiredOption("--token <token symbol>",`Token symbol to deposit. eg USDT, NHT`)
    .requiredOption("-v --vault <vault>",`Hexadecimal string representing the vault id.`)
    .requiredOption("-a --amount <amount>",`Amount of tokens to deposit. eg : 3.2, 100`)
    .description([
      "Deposit Tokens into vault."
    ].join("\n"))
    .parse(argv) 
    .opts(); 

  const toNetwork = cmdOptions.to
  const token = cmdOptions.token 
  const vaultId = cmdOptions.vault 
  const amount = cmdOptions.amount 

  const tokenDeatils = networkConfig.filter(n => n.network === toNetwork)[0].erc20Tokens
    .filter(t => t.symbol === token)[0]
  
  if(!tokenDeatils){ 
    throw new Error(`Deposting ${token} is not supported on ${toNetwork}`)
  }  

  console.log(">>> Depositing Tokens into vault...") 
  
  // Get Chain details
  const common = getCommons(toNetwork)  

  const depoistTx = await depositTokens(toNetwork,process.env.DEPLOYMENT_KEY,common,amount,vaultId,tokenDeatils)  

  const receipt = await depoistTx.wait()
        
  console.log(`Amount Deposited : ${receipt.transactionHash}`)
  console.log(`--------------------------------------------`)
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main(process.argv).catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

import * as dotenv from "dotenv";
const { Command } = require("commander");

import {  getCommons, supportedNetworks } from "./utils"; 
import { removeOrder } from "./utils/np-strat";

dotenv.config(); 

async function main(argv){

  const cmdOptions = new Command()
    .requiredOption("-f --from <network-name>",`Network to withdraw tokens from. Any of [${supportedNetworks}]`)
    .requiredOption("--tx-hash <transaction hash>",`Transaction hash of the order to be removed.`)
    .description([
      "Remove an order from the orderbook."
    ].join("\n"))
    .parse(argv) 
    .opts(); 

  const fromNetwork = cmdOptions.from
  const hash = cmdOptions.txHash

  console.log(">>> Removing Order...") 
  
  // Get Chain details
  const common = getCommons(fromNetwork)  

  const removeTx = await removeOrder(fromNetwork,process.env.DEPLOYMENT_KEY,common,hash) 
  const receipt = await removeTx.wait()
  console.log(`Order Removed: ${receipt.transactionHash}`)
  console.log(`--------------------------------------------`)


}
 

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main(process.argv).catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

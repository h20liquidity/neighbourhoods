import * as path from "path";
import { argv } from "process";
import * as dotenv from "dotenv";
import { BigNumber, ethers } from "ethers";  
import { randomUint256 } from "./utils";
import { supportedNetworks } from "./utils";
import { deployLimitStrategy } from "./DeployStrategy/deployStrategy";
const { Command } = require("commander");

dotenv.config();


async function main(argv){  

  const cmdOptions = new Command()
    .requiredOption("-t --to <network-name>",`Target network to deploy order to. Any of [${supportedNetworks}]`)
    .requiredOption("-s --sell-ratio <Sell Ratio>",`Limit Sell Order Ratio`)
    .requiredOption("-b --buy-ratio <Buy Ratio>",`Limit Buy Order Ratio`)
    .description([
      "Deploy Limit Orders"
    ].join("\n"))
    .parse(argv) 
    .opts();   

  const toNetwork = cmdOptions.to
  const sellRatio = cmdOptions.sellRatio 
  const buyRatio = cmdOptions.buyRatio 

  
  console.log(`\n>>>> Deploying limit orders to ${toNetwork.toUpperCase()}...`) 
 
  // const vaultId = randomUint256().toString()
  const vaultId = "82212972147442832250651702525296904327619221408273464764340702831835315043991"


  await deployLimitStrategy(toNetwork,vaultId,sellRatio,buyRatio)

  

}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main(process.argv).catch((error) => {
  console.error(error);
  process.exitCode = 1;
}); 



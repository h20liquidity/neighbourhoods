import * as path from "path";
import { argv } from "process";
import * as dotenv from "dotenv";
import { deployPilotStrategyWithNP } from "./DeployStrategy/deployStrategy";
import { BigNumber, ethers } from "ethers";  
import { randomUint256 } from "../utils";
import { supportedNetworks } from "./utils";
const { Command } = require("commander");

dotenv.config();


async function main(argv){  

  const cmdOptions = new Command()
    .requiredOption("-t --to <network-name>",`Target network to deploy order to. Any of [${supportedNetworks}]`)
    .description([
      "Deploy Strategy to target network"
    ].join("\n"))
    .parse(argv) 
    .opts();   

  const toNetwork = cmdOptions.to 
  
  console.log(`\n>>>> Deploying strategy to ${toNetwork.toUpperCase()}...`) 
 
  const vaultId = randomUint256().toString()

  await deployPilotStrategyWithNP(toNetwork,vaultId)

}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main(process.argv).catch((error) => {
  console.error(error);
  process.exitCode = 1;
}); 




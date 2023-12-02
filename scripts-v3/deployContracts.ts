import { ethers,  network} from "hardhat"; 

import * as dotenv from "dotenv";
import {supportedContracts, supportedNetworks } from "./utils";
import { deployArbInstance} from "./deployContract/deployArbImplnstance";
import { deployRainContract } from "./deployContract/deployRainContract";
const { Command } = require("commander"); 
dotenv.config();

async function main(argv){

  const cmdOptions = new Command()
    .requiredOption("-f --from <network-name>",`Name of the originating network to deploy from. Any of [${supportedNetworks}].`)
    .requiredOption("-t --to <network-name>",`Name of the originating network to deploy to. Any of [${supportedNetworks}].`)
    .description([
      "Deploy Contracts from source network to target network"
    ].join("\n"))
    .parse(argv) 
    .opts();
    
  if(supportedNetworks.indexOf(cmdOptions.from) == -1 || supportedNetworks.indexOf(cmdOptions.to) == -1){
    throw new Error(`Invalid network name. Please use one of [${supportedNetworks}]`)
  } 

  const fromNetwork = cmdOptions.from
  const toNetwork = cmdOptions.to

  console.log(`\n>>>> Deploying contracts from ${fromNetwork.toUpperCase()} to ${toNetwork.toUpperCase()}...`)
  
  await deployRainContract(fromNetwork,toNetwork,supportedContracts.Rainterpreter)  

  await deployRainContract(fromNetwork,toNetwork,supportedContracts.RainterpreterStore)
  
  await deployRainContract(fromNetwork,toNetwork,supportedContracts.RainterpreterParser)  
  
  await deployRainContract(fromNetwork,toNetwork,supportedContracts.RainterpreterExpressionDeployer)

  await deployRainContract(fromNetwork,toNetwork,supportedContracts.Orderbook) 

  await deployRainContract(fromNetwork,toNetwork,supportedContracts.CloneFactory)

  await deployRainContract(fromNetwork,toNetwork,supportedContracts.RouteProcessorOrderBookV3ArbOrderTakerImplementation) 

  await deployArbInstance(toNetwork) 

} 

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main(process.argv).catch((error) => {
  console.error(error);
  process.exitCode = 1;
});  




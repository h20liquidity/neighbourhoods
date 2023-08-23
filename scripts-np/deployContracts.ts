import { ethers,  network} from "hardhat"; 

import * as path from "path";
import { argv } from "process";
import * as dotenv from "dotenv";
import { deployContractToNetwork, getCommons, getProvider, getTransactionData, getTransactionDataForNetwork } from "./utils";
import { delay, verify } from "./verify";
import { deployInterpreterNP } from "./DISpair/deployInterpreterNP";
import { deployStoreNP } from "./DISpair/deployStore";
import { deployExpressionDeployerNP } from "./DISpair/deployExpressionDeployerNP";
import { deployOrderBookNP } from "./ContractDeploy/deployOrderbookNP";
import { deployCloneFactoryNP } from "./ContractDeploy/deployCloneFactoryNP";
import { deployZeroExInstance } from "./ContractDeploy/deployArbImplnstance";
import { deployArbImplementation } from "./ContractDeploy/deployZeroXArb";
dotenv.config();


async function main() {    

  const root = path.resolve();
  const args = argv.slice(2);   


  if (
    !args.length ||
    args.includes("--help") ||
    args.includes("-h") ||
    args.includes("-H")
  ) {
    console.log(
      `
      Deploy contracts

        --from, -f <network name>
          Name of the network to deploy from. Any of ["snowtrace","goerli","mumbai","sepolia","polygon"]

        --to, -t <network name>
          Name of the network to deploy the contract. Any of ["snowtrace",goerli","mumbai","sepolia","polygon"]
      `
    );
  }else{ 
    let fromNetwork 
    let toNetwork  


    //valid networks
    const validNetworks = ["goerli","snowtrace","mumbai","sepolia","polygon"]


    if (
      args.includes("--from") ||
      args.includes("-f")
    ) {
      const _i =
        args.indexOf("--from") > -1
          ? args.indexOf("--from")
          : args.indexOf("-f")
      const _tmp = args.splice(_i,2);
      if (_tmp.length != 2) throw new Error("expected network to deploy from");
      if(validNetworks.indexOf(_tmp[1]) == -1 ) throw new Error(`Unsupported network : ${_tmp[1]}`);
      fromNetwork = _tmp[1]
    }  
    if(!fromNetwork) throw Error("Origin Network not provided. Must provide --from <network name> argument")  

    if (
      args.includes("--to") ||
      args.includes("-t")
    ) {
      const _i =
        args.indexOf("--to") > -1
          ? args.indexOf("--to")
          : args.indexOf("-t")
      const _tmp = args.splice(_i,2);
      if (_tmp.length != 2) throw new Error("expected network to deploy to");
      if(validNetworks.indexOf(_tmp[1]) == -1 ) throw new Error(`Unsupported network : ${_tmp[1]}`);
      toNetwork = _tmp[1]
    }   

    if(!toNetwork) throw Error("Target Network not provided. Must provide --to <network name> argument")  
    
   
    await deployInterpreterNP(fromNetwork,toNetwork)  

    await deployStoreNP(fromNetwork,toNetwork)  

    await deployExpressionDeployerNP(fromNetwork,toNetwork) 

    await deployOrderBookNP(fromNetwork,toNetwork) 

    await deployCloneFactoryNP(fromNetwork,toNetwork)

    await deployArbImplementation(fromNetwork,toNetwork) 

    await deployZeroExInstance(toNetwork) 

  }

  


}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}); 



import { ethers,  network} from "hardhat"; 

import * as path from "path";
import { argv } from "process";
import * as dotenv from "dotenv";
import { deployContractToNetwork, getCommons, getProvider, getTransactionData, getTransactionDataForNetwork , deployArbContractInstance} from "../utils";
import { delay, verify } from "../verify"; 
import {writeFileSync} from "fs";

import contractConfig from "../contracts.config.json" 

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
      Deploy Arb implementation
      options:

        --to, -t <network name>
          Name of the network to deploy the contract. Any of ["snowtrace",goerli","mumbai","sepolia","polygon"]

        --counterparty, -c <address>
          Counterparty address for strategy.
      `
    );
  }else{ 

    let toNetwork  
    let counterparty

    //valid networks
    const validNetworks = ["goerli","snowtrace","mumbai","sepolia","polygon"]


    if (
      args.includes("--to") ||
      args.includes("-t")
    ) {
      const _i =
        args.indexOf("--to") > -1
          ? args.indexOf("--to")
          : args.indexOf("-t")
      const _tmp = args.splice(_i, _i + 2);
      if (_tmp.length != 2) throw new Error("expected network to deploy to");
      if(validNetworks.indexOf(_tmp[1]) == -1 ) throw new Error(`Unsupported network : ${_tmp[1]}`);
      toNetwork = _tmp[1]
    }  
    
    
    if (
      args.includes("--counterparty") ||
      args.includes("-c")
    ) {
      const _i =
        args.indexOf("--counterparty") > -1
          ? args.indexOf("--counterparty")
          : args.indexOf("-c")
      const _tmp = args.splice(_i, _i + 2);
      if (_tmp.length != 2) throw new Error("expected counterparty");
      counterparty = _tmp[1]
    }  
    

    

    //Get Provider for the network where the contract is to be deployed to
    const deployProvider = getProvider(toNetwork) 


    // Get Chain details
    const common = getCommons(toNetwork) 

    //Deploy transaction
    const {cloneEventData,contractTransaction} = await deployArbContractInstance(deployProvider,common,process.env.DEPLOYMENT_KEY,toNetwork,counterparty) 

    
    console.log(`Arb Instance deployed to ${toNetwork} at : ${cloneEventData.clone}`)    

    let updateNetConfig = contractConfig 

    updateNetConfig[toNetwork] ? (
      updateNetConfig[toNetwork]["zeroexorderbookinstance"] = {
        "address" : cloneEventData.clone.toLowerCase(),
        "transaction" : contractTransaction.hash.toLowerCase()
       } 
    ) : ( 
       updateNetConfig[toNetwork] = {
        "zeroexorderbookinstance" :{
            "address" : cloneEventData.clone.toLowerCase(),
            "transaction" : contractTransaction.hash.toLowerCase()
         }
      }    
    )   

    let data = JSON.stringify(updateNetConfig,null,2) 

    writeFileSync('./scripts/contracts.config.json', data)  

  }

  


}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}); 



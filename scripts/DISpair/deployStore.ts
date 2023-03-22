import { ethers,  network} from "hardhat"; 

import * as path from "path";
import { argv } from "process";
import * as dotenv from "dotenv";
import { deployContractToNetwork, getCommons, getProvider, getTransactionData } from "../utils";
dotenv.config();
import netConfig from "../network.config.json" 
import {writeFileSync} from "fs";



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
      Clone contract from a deployed network.
      options:

        --transaction, -tx, <hash>
          Hash of the transaction.

        --from, -f <network name>
          Name of the network to deploy from. Any of ["snowtrace","goerli","mumbai"]

        --to, -t <network name>
          Name of the network to deploy the contract. Any of ["snowtrace",goerli","mumbai"]
      `
    );
  }else{ 
    let fromNetwork 
    let toNetwork
    let txHash  

    //valid networks
    const validNetworks = ["goerli","snowtrace","mumbai",]

    if (
      args.includes("--transaction") ||
      args.includes("-tx")
    ) {
      const _i =
        args.indexOf("--transaction") > -1
          ? args.indexOf("--transaction")
          : args.indexOf("-tx")
      const _tmp = args.splice(_i, _i + 2);
      if (_tmp.length != 2) throw new Error("expected transaction hash"); 
      txHash = _tmp[1]
    }  

    if (
      args.includes("--from") ||
      args.includes("-f")
    ) {
      const _i =
        args.indexOf("--from") > -1
          ? args.indexOf("--from")
          : args.indexOf("-f")
      const _tmp = args.splice(_i, _i + 2);
      if (_tmp.length != 2) throw new Error("expected network to deploy from");
      if(validNetworks.indexOf(_tmp[1]) == -1 ) throw new Error(`Unsupported network : ${_tmp[1]}`);
      fromNetwork = _tmp[1]
    }  

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

    //Get Provider for testnet from where the data is to be fetched 
    const mumbaiProvider = getProvider(fromNetwork)  

    //Get Provider for the network where the contract is to be deployed to
    const deployProvider = getProvider(toNetwork) 

    // Get transaction data
    const txData = await getTransactionData(mumbaiProvider, txHash) 

    // Get Chain details
    const common = getCommons(toNetwork) 

    //Deploy transaction
    const deployTransaction = await deployContractToNetwork(deployProvider,common,process.env.DEPLOYMENT_KEY,txData)
    
    //Wait for confirmation and get receipt
    const transactionReceipt = await deployTransaction.wait()  

    console.log(`Contract deployed to ${network.name} at : ${transactionReceipt.contractAddress}`)  


    let updateNetConfig = netConfig
    updateNetConfig[toNetwork]["store"] = {
        
            "address" : transactionReceipt.contractAddress.toLowerCase(),
            "transaction" : transactionReceipt.transactionHash.toLowerCase()
    
    } 

    let data = JSON.stringify(updateNetConfig,null,2) 

    writeFileSync('./scripts/network.config.json', data)


  }

  


}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}); 


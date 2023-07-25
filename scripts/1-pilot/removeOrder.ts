import * as path from "path";
import { argv } from "process";
import * as dotenv from "dotenv";
import { emptyNHTAmount, emptyUSDTAmount } from "../Withdraw/withdraw";
import { ethers } from "ethers";
import contractConfig from "../../config/config.json"
import orderBookDetails1 from "../../config/Orderbook/1-OrderBook.json"  

import orderDetails from "../DeployStrategy/orderDetails.json"

import {  getCommons, getProvider } from "../utils"; 
import { network } from "hardhat";
import { removeOrder } from "../utils/1-pilot.utils";
// import { BigNumber, ethers } from "ethers"; 

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
      Remove order from orderbook
      options:

      --tx-hash, -h <transaction hash>
        Hash of the Add Order transaction to be removed.

      --from, -f <network name>
          Name of the network to remove order from. Any of ["snowtrace",goerli","mumbai","sepolia","polygon"].
      `
    );
  }else{ 

    let fromNetwork
    let hash    

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
     if(!fromNetwork) throw new Error("From Network Not Provided")
     if (
        args.includes("--tx-hash") ||
        args.includes("-h")
      ) {
        const _i =
          args.indexOf("--tx-hash") > -1
            ? args.indexOf("--tx-hash")
            : args.indexOf("-h")
        const _tmp = args.splice(_i,2);
        if (_tmp.length != 2) throw new Error("expected transaction hash");
        hash = _tmp[1]
     }
     if(!hash) throw new Error("Transaction Hash Not Provided")

     const common = getCommons(fromNetwork)

    const removeTx =  await removeOrder(fromNetwork,process.env.DEPLOYMENT_KEY,common,hash) 
    
    if(removeTx){
        const receipt = await removeTx.wait()
        console.log(`Order Removed: ${receipt.transactionHash}`)
    }


  }

  


}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});  

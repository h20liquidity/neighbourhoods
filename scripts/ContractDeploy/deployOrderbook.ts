import { ethers,  network} from "hardhat"; 

import * as path from "path";
import { argv } from "process";
import * as dotenv from "dotenv";
import { deployContractToNetwork, getCommons, getProvider, getTransactionData, getTransactionDataForNetwork } from "../utils";
import { delay, verify } from "../verify"; 
import {writeFileSync} from "fs";

import contractConfig from "../config/contracts.config.json" 

dotenv.config();


export const deployOrderBook = async (fromNetwork:string, toNetwork:string) => {    

    const txHash  = contractConfig[fromNetwork].orderbook.transaction
  
    //Get Provider for testnet from where the data is to be fetched 
    const mumbaiProvider = getProvider(fromNetwork)  

    //Get Provider for the network where the contract is to be deployed to
    const deployProvider = getProvider(toNetwork) 

    // Get transaction data
    let txData = await getTransactionData(mumbaiProvider, txHash)  

    console.log("txData succeded ")
    //replace DISpair instances
    txData = getTransactionDataForNetwork(txData,fromNetwork, toNetwork)  

    // Get Chain details
    const common = getCommons(toNetwork) 

    //Deploy transaction
    const deployTransaction = await deployContractToNetwork(deployProvider,common,process.env.DEPLOYMENT_KEY,txData)
    
    //Wait for confirmation and get receipt
    const transactionReceipt = await deployTransaction.wait()  

    console.log(`OrderBook deployed to ${toNetwork} at : ${transactionReceipt.contractAddress}`)   

    let updateContractConfig = contractConfig 

    updateContractConfig[toNetwork] ? (
      updateContractConfig[toNetwork]["orderbook"] = {
        "address" : transactionReceipt.contractAddress.toLowerCase(),
        "transaction" : transactionReceipt.transactionHash.toLowerCase()
       } 
    ) : ( 
       updateContractConfig[toNetwork] = {
        "orderbook" :{
            "address" : transactionReceipt.contractAddress.toLowerCase(),
            "transaction" : transactionReceipt.transactionHash.toLowerCase()
         }
      }    
    )   

    let data = JSON.stringify(updateContractConfig,null,2) 

    writeFileSync('./scripts/config/contracts.config.json', data)  

    console.log("Submitting contract for verification...")


    // Wait 15sec before trying to Verify. That way, if the code was deployed,
    // it will be available for locate it.
    await delay(30000);

    await verify(transactionReceipt.contractAddress,txHash,fromNetwork,toNetwork) 


}




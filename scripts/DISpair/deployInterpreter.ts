import { ethers,  network} from "hardhat"; 

import * as path from "path";
import { argv } from "process";
import * as dotenv from "dotenv";
import { deployContractToNetwork, getCommons, getProvider, getTransactionData } from "../utils";
dotenv.config();
import contractConfig from "../config/contracts.config.json" 
import {writeFileSync} from "fs";
import { delay, verify } from "../verify";



export const  deployInterpreter = async (fromNetwork:string, toNetwork:string) => {    

   
    const txHash = contractConfig[fromNetwork].interpreter.transaction

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

    console.log(`Interpreter deployed to ${toNetwork} at : ${transactionReceipt.contractAddress}`)  


    let updateContractConfig = contractConfig
   
    updateContractConfig[toNetwork] ? (
      updateContractConfig[toNetwork]["interpreter"] = {
        "address" : transactionReceipt.contractAddress.toLowerCase(),
        "transaction" : transactionReceipt.transactionHash.toLowerCase()
       } 
    ) : ( 
       updateContractConfig[toNetwork] = {
        "interpreter" :{
            "address" : transactionReceipt.contractAddress.toLowerCase(),
            "transaction" : transactionReceipt.transactionHash.toLowerCase()
         }
      }       
    )

    let data = JSON.stringify(updateContractConfig,null,2)  

    writeFileSync('./scripts/config/contracts.config.json', data)  

    

    if(toNetwork != 'hardhat'){ 
      console.log("Submitting contract for verification...")
      // Wait 15sec before trying to Verify. That way, if the code was deployed,
      // it will be available for locate it.
      await delay(30000);
  
      await verify(transactionReceipt.contractAddress,txHash,fromNetwork,toNetwork)
    }


  


}




import { ethers,  network} from "hardhat"; 

import * as path from "path";
import { argv } from "process";
import * as dotenv from "dotenv";
import { deployContractToNetwork, getCommons, getProvider, getTransactionData, getTransactionDataForNetwork , deployArbContractInstance} from "../utils";
import { delay, verify } from "../verify"; 
import {writeFileSync} from "fs";

import contractConfig from "../../config/config.json"  

dotenv.config();


export const deployZeroExInstance = async(toNetwork,counterparty) => {    

    
    //Get Provider for the network where the contract is to be deployed to
    const deployProvider = getProvider(toNetwork) 


    // Get Chain details
    const common = getCommons(toNetwork) 

    //Deploy transaction
    const {cloneEventData,contractTransaction} = await deployArbContractInstance(deployProvider,common,process.env.DEPLOYMENT_KEY,toNetwork,counterparty) 

    
    console.log(`Arb Instance deployed to ${toNetwork} at : ${cloneEventData.clone}`)    

    let updateContractConfig = contractConfig["contracts"]  

    updateContractConfig[toNetwork] ? (
      updateContractConfig[toNetwork]["zeroexorderbookinstance"] = {
        "address" : cloneEventData.clone.toLowerCase(),
        "transaction" : contractTransaction.hash.toLowerCase()
       } 
    ) : ( 
      updateContractConfig[toNetwork] = {
        "zeroexorderbookinstance" :{
            "address" : cloneEventData.clone.toLowerCase(),
            "transaction" : contractTransaction.hash.toLowerCase()
         }
      }    
    )   

    contractConfig["contracts"] = updateContractConfig
    let data = JSON.stringify(contractConfig,null,2)  

    writeFileSync('./config/config.json', data)  

  
}




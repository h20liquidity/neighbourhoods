
import * as dotenv from "dotenv";
import {  getCommons, getProvider, deployArbContractInstance, supportedContracts} from "../utils";
import {writeFileSync} from "fs";

import contractConfig from "../v3-config.json"  

dotenv.config();


export const deployArbInstance = async(toNetwork) => {    

    
    //Get Provider for the network where the contract is to be deployed to
    const deployProvider = getProvider(toNetwork) 


    // Get Chain details
    const common = getCommons(toNetwork) 

    //Deploy transaction
    const {cloneEventData,contractTransaction} = await deployArbContractInstance(deployProvider,common,process.env.DEPLOYMENT_KEY,toNetwork) 

    
    console.log(`Arb Instance deployed to ${toNetwork} at : ${cloneEventData.clone}`)    

    let updateContractConfig = contractConfig["contracts"]  

    updateContractConfig[toNetwork] ? (
      updateContractConfig[toNetwork][supportedContracts.GenericPoolOrderBookFlashBorrowerInstance] = {
        "address" : cloneEventData.clone.toLowerCase(),
        "transaction" : contractTransaction.hash.toLowerCase()
       } 
    ) : ( 
      updateContractConfig[toNetwork] = {
        [supportedContracts.GenericPoolOrderBookFlashBorrowerInstance]  :{
            "address" : cloneEventData.clone.toLowerCase(),
            "transaction" : contractTransaction.hash.toLowerCase()
         }
      }    
    )   

    contractConfig["contracts"] = updateContractConfig
    let data = JSON.stringify(contractConfig,null,2)  

    writeFileSync('./scripts-v3/v3-config.json', data)  

  
}




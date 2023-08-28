import * as dotenv from "dotenv";
import { deployContractToNetwork, getCommons, getProvider, getTransactionData } from "../utils";
dotenv.config();
import contractConfig from "../config.json" 
import {writeFileSync} from "fs";
import { delay, verify } from "../verify";



export const deployStore = async (fromNetwork:string , toNetwork: string) =>  {    


    const txHash  =  contractConfig.contracts[fromNetwork].store.transaction
   
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

    console.log(`Store deployed to ${toNetwork} at : ${transactionReceipt.contractAddress}`)  


    let updateContractConfig = contractConfig["contracts"] 

    updateContractConfig[toNetwork] ? (
      updateContractConfig[toNetwork]["store"] = {
        "address" : transactionReceipt.contractAddress.toLowerCase(),
        "transaction" : transactionReceipt.transactionHash.toLowerCase()
       } 
    ) : ( 
       updateContractConfig[toNetwork] = {
        "store" :{
            "address" : transactionReceipt.contractAddress.toLowerCase(),
            "transaction" : transactionReceipt.transactionHash.toLowerCase()
         }
      }       
    ) 
    
    contractConfig["contracts"] = updateContractConfig
    let data = JSON.stringify(contractConfig,null,2)  

    writeFileSync('./scripts-v2/config.json', data)  

    

    if(toNetwork != 'hardhat'){ 
      console.log("Submitting contract for verification...") 
      
      // Wait 15sec before trying to Verify. That way, if the code was deployed,
      // it will be available for locate it.
      await delay(30000);

      await verify(transactionReceipt.contractAddress,txHash,fromNetwork,toNetwork)

    }

  

  


}



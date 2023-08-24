import * as dotenv from "dotenv";
import { deployContractToNetwork, getCommons, getProvider, getTransactionData, getTransactionDataForNetwork } from "../utils";
import { delay, verify } from "../verify"; 
import {writeFileSync} from "fs";

import contractConfig from "../np-config.json" 

dotenv.config();


export const deployArbImplementation = async (fromNetwork,toNetwork) => {    


    const txHash  = contractConfig.contracts[fromNetwork].zeroexorderbookimplmentation.transaction

    //Get Provider for testnet from where the data is to be fetched 
    const mumbaiProvider = getProvider(fromNetwork)  

    //Get Provider for the network where the contract is to be deployed to
    const deployProvider = getProvider(toNetwork) 

    // Get transaction data
    let txData = await getTransactionData(mumbaiProvider, txHash)  

    //replace proxy and ob instances
    txData = getTransactionDataForNetwork(txData,fromNetwork, toNetwork)  

    // Get Chain details
    const common = getCommons(toNetwork) 

    //Deploy transaction
    const deployTransaction = await deployContractToNetwork(deployProvider,common,process.env.DEPLOYMENT_KEY,txData)
    
    //Wait for confirmation and get receipt
    const transactionReceipt = await deployTransaction.wait()  

    console.log(`ZeroExImplementaion deployed to ${toNetwork} at : ${transactionReceipt.contractAddress}`)   

    let updateContractConfig = contractConfig["contracts"]  

    updateContractConfig[toNetwork] ? (
      updateContractConfig[toNetwork]["zeroexorderbookimplmentation"] = {
        "address" : transactionReceipt.contractAddress.toLowerCase(),
        "transaction" : transactionReceipt.transactionHash.toLowerCase()
       } 
    ) : ( 
      updateContractConfig[toNetwork] = {
        "zeroexorderbookimplmentation" :{
            "address" : transactionReceipt.contractAddress.toLowerCase(),
            "transaction" : transactionReceipt.transactionHash.toLowerCase()
         }
      }    
    )   

    contractConfig["contracts"] = updateContractConfig
    let data = JSON.stringify(contractConfig,null,2)  

    writeFileSync('./scripts-np/np-config.json', data)  

    console.log("Submitting contract for verification...")

    // Wait 15sec before trying to Verify. That way, if the code was deployed,
    // it will be available for locate it.
    await delay(30000);

    await verify(transactionReceipt.contractAddress,txHash,fromNetwork,toNetwork) 

}




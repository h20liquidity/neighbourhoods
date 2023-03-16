import { ethers,  network} from "hardhat"; 

import config from "../config/config.json"
import * as dotenv from "dotenv";
import { deployContractToNetwork, getCommons, getProvider, getTransactionData } from "./utils";
dotenv.config();


async function main() {   

  //Get Provider for testnet from where the data is to be fetched 
  const mumbaiProvider = getProvider("mumbai")  

  //Get Provider for the network where the contract is to be deployed to
  const deployProvider = getProvider(network.name) 

  // Get transaction data
  const txData = await getTransactionData(mumbaiProvider, config.contracts.orderbook.transaction) 

  // Get Chain details
  const common = getCommons(network.name) 

  //Deploy transaction
  const deployTransaction = await deployContractToNetwork(deployProvider,common,process.env.DEPLOYMENT_KEY_MUMBAI,txData)
  
  //Wait for confirmation and get receipt
  const transactionReceipt = await deployTransaction.wait()  

  console.log(`Contract deployed to ${network.name} at : ${transactionReceipt.contractAddress}`)


}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}); 



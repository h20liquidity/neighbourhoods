import { ethers,  network} from "hardhat"; 

import * as path from "path";
import { argv } from "process";
import * as dotenv from "dotenv";
import { deployContractToNetwork, getCommons, getProvider, getTransactionData, getTransactionDataForNetwork } from "./utils";
import { delay, verify } from "./verify";
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
      Clone contract from a deployed network.
      options:

        --transaction, -tx, <hash>
          Hash of the transaction.

        --from, -f <network name>
          Name of the network to deploy from. Any of ["snowtrace","goerli","mumbai","sepolia","polygon"]

        --to, -t <network name>
          Name of the network to deploy the contract. Any of ["snowtrace",goerli","mumbai","sepolia","polygon"]
      `
    );
  }else{ 
    let fromNetwork 
    let toNetwork
    let txHash  

    //valid networks
    const validNetworks = ["goerli","snowtrace","mumbai","sepolia","polygon"]

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
    let txData = await getTransactionData(mumbaiProvider, txHash)  

    //replace DISpair instances
    txData = getTransactionDataForNetwork(txData,fromNetwork, toNetwork)  

    // Get Chain details
    const common = getCommons(toNetwork) 

    //Deploy transaction
    const deployTransaction = await deployContractToNetwork(deployProvider,common,process.env.DEPLOYMENT_KEY_MUMBAI,txData)
    
    //Wait for confirmation and get receipt
    const transactionReceipt = await deployTransaction.wait()  

    console.log(`Contract deployed to ${toNetwork} at : ${transactionReceipt.contractAddress}`)  

    // Wait 15sec before trying to Verify. That way, if the code was deployed,
    // it will be available for locate it.
    await delay(30000);

    await verify(transactionReceipt.contractAddress,txHash,fromNetwork,toNetwork)



  }

  


}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}); 



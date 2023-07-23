import * as path from "path";
import { argv } from "process";
import * as dotenv from "dotenv";
import { deployPilotStrategyWithVault } from "../DeployStrategy/deployStrategy";
import { BigNumber, ethers } from "ethers";  
import { randomUint256 } from "../utils";
import orderDetails from "../DeployStrategy/orderDetails.json"


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
      Deploy a strategy.
      options:

        --to, -t <network name>
          Name of the network to deploy the contract. Any of ["snowtrace",goerli","mumbai","sepolia","polygon"]. 
      `
    );
  }else{ 

    let toNetwork
    //valid networks
    const validNetworks = ["goerli","snowtrace","mumbai","sepolia","polygon"]
   
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

    // Not giving predetermined vaultId
    // const vaultId = ethers.BigNumber.from(orderDetails[0].validOutputs[0].vaultId) 

    // Generating random vaultId 
    const vaultId = randomUint256().toString()

     await deployPilotStrategyWithVault(toNetwork,vaultId)

  }

  


}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}); 



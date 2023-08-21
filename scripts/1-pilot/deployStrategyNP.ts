import * as path from "path";
import { argv } from "process";
import * as dotenv from "dotenv";
import { deployPilotStrategyWithNP } from "../DeployStrategy/deployStrategy";
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

        --parser, -p <parser address>
          Address of the parser contract. 
        
        --orderbook, -o <orderbook address>
          Address of the parser contract. 
      `
    );
  }else{ 

    let toNetwork
    let parser
    let orderbook
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
      const _tmp = args.splice(_i,2);
      if (_tmp.length != 2) throw new Error("expected network to deploy to");
      if(validNetworks.indexOf(_tmp[1]) == -1 ) throw new Error(`Unsupported network : ${_tmp[1]}`);
      toNetwork = _tmp[1]
    }   

    
    if (
        args.includes("--parser") ||
        args.includes("-p")
        ) {
          const _i =
          args.indexOf("--parser") > -1
          ? args.indexOf("--parser")
          : args.indexOf("-p")
          const _tmp = args.splice(_i,2);
          if (_tmp.length != 2) throw new Error("expected parser address");
          parser = _tmp[1]
    } 
        
    
    if (
      args.includes("--orderbook") ||
      args.includes("-o")
      ) {
        const _i =
        args.indexOf("--orderbook") > -1
        ? args.indexOf("--orderbook")
        : args.indexOf("-o")
        const _tmp = args.splice(_i,2);
        if (_tmp.length != 2) throw new Error("expected orderbook address");
        orderbook = _tmp[1]
      }
  
  
    if(!toNetwork) throw Error("Target Network not provided. Must provide --to <network name> argument") 
    
    if(!parser) throw Error("Parser address not provided. Must provide --parser <parser address> argument")

    if(!orderbook) throw Error("Orderbook not provided. Must provide --orderbook <orderbook address> argument")


    // Generating random vaultId 
    const vaultId = randomUint256().toString()

     await deployPilotStrategyWithNP(toNetwork,vaultId,parser,orderbook)

  }

  


}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}); 



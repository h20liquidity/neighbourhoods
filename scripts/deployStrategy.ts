import * as path from "path";
import { argv } from "process";
import * as dotenv from "dotenv";
import { deployPilotStrategy } from "./DeployStrategy/deployStrategy";


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

        --ratio -r <ratio value> 
          Ratio for the startegy
      `
    );
  }else{ 

    let toNetwork
    let ratio
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

    if (
      args.includes("--ratio") ||
      args.includes("-r")
    ) {
      const _i =
        args.indexOf("--ratio") > -1
          ? args.indexOf("--ratio")
          : args.indexOf("-r")
      const _tmp = args.splice(_i, _i + 2); 
      if (_tmp.length != 2) throw new Error("expected ratio");
      ratio = _tmp[1]
    }  

     await deployPilotStrategy(toNetwork,ratio)

  }

  


}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}); 



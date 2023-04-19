import { ethers,  network} from "hardhat"; 

import * as path from "path";
import { argv } from "process";
import * as dotenv from "dotenv";
import { deployContractToNetwork, getCommons, getProvider, getTransactionData, getTransactionDataForNetwork } from "../utils";
import { delay, verify } from "../verify";
import { deployInterpreter } from "../DISpair/deployInterpreter";
import { deployStore } from "../DISpair/deployStore";
import { deployExpressionDeployer } from "../DISpair/deployExpressionDeployer";
import { deployOrderBook } from "../ContractDeploy/deployOrderbook";
import { deployCloneFactory } from "../ContractDeploy/deployCloneFactory";
import { deployZeroExInstance } from "../ContractDeploy/deployArbImplnstance";
import { deployArbImplementation } from "../ContractDeploy/deployZeroXArb";
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
      Deploy contracts

        --from, -f <network name>
          Name of the network to deploy from. Any of ["snowtrace","goerli","mumbai","sepolia","polygon"]

        --to, -t <network name>
          Name of the network to deploy the contract. Any of ["snowtrace",goerli","mumbai","sepolia","polygon"]

        --counterparty, -c <address>
          Counterparty address for strategy.
      `
    );
  }else{ 
    let fromNetwork 
    let toNetwork  
    let counterparty 


    //valid networks
    const validNetworks = ["goerli","snowtrace","mumbai","sepolia","polygon"]


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

    if (
      args.includes("--counterparty") ||
      args.includes("-c")
    ) {
      const _i =
        args.indexOf("--counterparty") > -1
          ? args.indexOf("--counterparty")
          : args.indexOf("-c")
      const _tmp = args.splice(_i, _i + 2);
      if (_tmp.length != 2) throw new Error("expected counterparty");
      counterparty = _tmp[1]
    }
    
   
    await deployInterpreter(fromNetwork,toNetwork)  

    await deployStore(fromNetwork,toNetwork)  

    await deployExpressionDeployer(fromNetwork,toNetwork) 

    await deployOrderBook(fromNetwork,toNetwork) 

    await deployCloneFactory(fromNetwork,toNetwork)

    await deployArbImplementation(fromNetwork,toNetwork) 

    await deployZeroExInstance(toNetwork,counterparty) 

  }

  


}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}); 



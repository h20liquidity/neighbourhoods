import * as path from "path";
import { argv } from "process";
import * as dotenv from "dotenv";
import { depositAmount } from "../Deposit/deposit";
import { withdrawNHTAmount } from "../Withdraw/withdraw";


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
      Withdraw NHT token from the vault.
      options:

        --from, -f <network name>
          Name of the network to deploy the contract. Any of ["snowtrace",goerli","mumbai","sepolia","polygon"].

        --amount, -a <Amount in NHT>
          Amount in NHT to deposit
      `
    );
  }else{ 

    let fromNetwork
    let amount

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
        args.includes("--amount") ||
        args.includes("-a")
      ) {
        const _i =
          args.indexOf("--amount") > -1
            ? args.indexOf("--amount")
            : args.indexOf("-a")
        const _tmp = args.splice(_i, _i + 2);
        if (_tmp.length != 2) throw new Error("Expected Amount");
        amount = _tmp[1]
      }  

        await withdrawNHTAmount(fromNetwork,amount)
  }

  


}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}); 



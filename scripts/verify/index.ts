
import axios from "axios" 

import solc from "solc"
import { getEtherscanBaseURL, getEtherscanKey, getProvider, getTransactionDataForNetwork } from "../utils";
import * as dotenv from "dotenv";
dotenv.config();


export const delay = (ms: number): unknown =>
  new Promise((res) => setTimeout(res, ms)); 

export const verify = async (
        toContract:string,
        fromTx:string,
        fromNetwork:string,
        toNetwork:string
    ) => { 
 
       try { 
            
            let provider = await getProvider(fromNetwork) 
            let txReceipt = await provider.getTransaction(fromTx) 

            let contractyAddress = txReceipt.creates 
            
            if(contractyAddress != ''){  

                //Get Source code from contract
                const url = `${getEtherscanBaseURL(fromNetwork)}?module=contract&action=getsourcecode&address=${contractyAddress}&apikey=${getEtherscanKey(fromNetwork)}`;
                const resp = await axios.get(url);    
                const source = resp.data.result[0] 
                
                const sourceCode = new Object(source.SourceCode.substring(1,source.SourceCode.length-1))   

                const sourceKeys = Object.keys(JSON.parse(sourceCode.toString()).sources).filter(i => {
                    return i.includes(`${source.ContractName}.sol`)
                })

                // Submit for verification

                let bodyVerify = {
                    apikey: getEtherscanKey(toNetwork) ,
                    module: "contract",
                    action: "verifysourcecode",
                    sourceCode: sourceCode.toString(),
                    contractaddress: toContract.toLowerCase(),
                    codeformat: "solidity-standard-json-input",
                    contractname: `${sourceKeys[0]}:${source.ContractName}`,
                    compilerversion: source.CompilerVersion, 
                    optimizationUsed: source.OptimizationUsed,
                    runs: source.Runs, 
                    constructorArguements: getTransactionDataForNetwork(source.ConstructorArguments,fromNetwork,toNetwork) 
                };

                const headers = { "Content-Type": "application/x-www-form-urlencoded" };
                const snedVerify = await axios.post(getEtherscanBaseURL(toNetwork), bodyVerify, { headers }); 
            
                // The verification was sent
                const bodyCheck = {
                    apikey: getEtherscanKey(toNetwork) ,
                    guid: snedVerify.data.result,
                    module: "contract",
                    action: "checkverifystatus",
                };
            
                let isVerified = false;
                let i = 0;
            
                // Now wait a few secs (max 20) to ask if the contract is verified
                // It's possible that verification take to much and fail (for many reasons).
                // WARNING: Be careful and take attention to the messages.
                while (!isVerified && i < 4) {
                    await delay(5000);
                    const respCheck = await axios.get(getEtherscanBaseURL(toNetwork), {
                    data: bodyCheck,
                    headers: headers,
                    });

                    if (respCheck.data.status == 1) {
                        // The contract is verified
                        isVerified = true;
                    }
            
                    i++;
                }
                if(isVerified){
                    console.log(`Successfully Verified`)
                }else{
                    console.log(`Verify Callback Fail. Contract may still be verified. Check on explorer.`)   
                }

            }else{
                console.log("Verification Failed")
            }
        
       } catch (error) {
            console.log("Verification Failed")
       }
        
        

} 


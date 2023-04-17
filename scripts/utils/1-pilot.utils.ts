import { BigNumber, ethers } from "ethers";  

import {  Common,  CustomChain, Chain, Hardfork } from '@ethereumjs/common'
import {  FeeMarketEIP1559Transaction } from '@ethereumjs/tx'  
import { getContractAddressesForChainOrThrow } from "@0x/contract-addresses";
import fs from "fs"  
import * as mustache from 'mustache'; 
import * as path from "path";  
import orderBookDetails from "../../config/Orderbook/1-OrderBook.json" 
import {writeFileSync} from "fs"; 
import orderDetails from "../DeployStrategy/orderDetails.json"
import abi from 'erc-20-abi' 
import hre from "hardhat"


import {
  allChains,
  configureChains,
  createClient,
  fetchFeeData,
} from "@sonicswap/wagmi-core";
import { publicProvider } from "@sonicswap/wagmi-core/providers/public";

import contractConfig from "../../config/config.json"

import axios from "axios";
import { standardEvaluableConfig } from "../../utils/interpreter/interpreter";
import { hexlify } from "ethers/lib/utils";
import { getEventArgs } from "../../utils";
import { encodeMeta, estimateFeeData, fetchFile, getProvider } from ".";


export const decodeAddOrderEventsArgsPilot1 = async(transaction,orderBook) => {  

    const eventObj = (await transaction.wait()).logs.find(
      (x) =>{  
        return (x.topics[0] == "0x73e46afa6205785bdaa1daaf8b6ccc71715ec06b3b4264f5a00fde98671c2fc6") // Checking for Add Order Event 
      }
        
    ); 
  
  
    if (!eventObj) {
      console.log(`Could not find event data!!!`);
    }
  
    let eventData = orderBook.interface.decodeEventLog(
      "AddOrder",
      eventObj.data,
      eventObj.topics
    );  
    
    let order = eventData.order 
  
    let orderValidInputs = order.validInputs.map(e => { 
      return {
        token:e.token,
        decimals:e.decimals,
        vaultId:e.vaultId._hex
      }
    }) 
  
    let orderValidOutputs = order.validOutputs.map(e => {
      return {
        token:e.token,
        decimals:e.decimals,
        vaultId:e.vaultId._hex
      }
    })
  
    const orderDetailsObject = [{
      owner : order.owner ,
      handleIO: order.handleIO ,
      evaluable: {
        interpreter: order.evaluable.interpreter,
        store: order.evaluable.store ,
        expression: order.evaluable.expression
      },
      validInputs : orderValidInputs , 
      validOutputs: orderValidOutputs
    } 
    ]
  
    
  
    let data = JSON.stringify(orderDetailsObject,null,2) 
  
    writeFileSync('./scripts/1-pilot/1-orderDetails.json', data)  
  
    
  
  
} 

export const deployStrategyWithVault = async(network:string,priKey: string, common: Common,ratio:string,vaultId) => {   

    console.log("Deploying Strategy...") 
  
    if(!ratio) return null
      
    //Get Provider for testnet from where the data is to be fetched 
    const provider = getProvider(network)   
    
  
    const signer  = new ethers.Wallet(priKey,provider) 
   
    //Get Source code from contract
    // const url = `${getEtherscanBaseURL(network)}?module=contract&action=getsourcecode&address=${contractConfig[network].orderbook.address}&apikey=${getEtherscanKey(network)}`;
    // const source = await axios.get(url);    
  
    // Get Orderbook Instance
    const orderBook = new ethers.Contract(contractConfig.contracts[network].orderbook.address,orderBookDetails.abi,signer) 
  
    //Building Expression
    const strategyExpression = path.resolve(
        __dirname,
        "../../src/1-in-token-batch.rain"
      ); 
  
    const strategyString = await fetchFile(strategyExpression);  
  
    const arbCounterParty = contractConfig.contracts[network].zeroexorderbookinstance.address 
    console.log("arbCounterParty: ",arbCounterParty)
  
    const stringExpression = mustache.render(strategyString, {
      counterparty: arbCounterParty,
      ratio: ratio
    });    
  
    const { sources, constants } = await standardEvaluableConfig(stringExpression)  
  
    const EvaluableConfig_A = {
      deployer: contractConfig.contracts[network].expressionDeployer.address,
      sources,
      constants,
    }
    const orderConfig_A = {
      validInputs: [
        { token: contractConfig.contracts[network].usdt.address, decimals: contractConfig.contracts[network].usdt.decimals, vaultId: vaultId },
      ],
      validOutputs: [
        { token: contractConfig.contracts[network].nht.address, decimals: contractConfig.contracts[network].nht.decimals, vaultId: vaultId},
      ],
      evaluableConfig: EvaluableConfig_A,
      meta: encodeMeta(""),
    };  
  
  
    const addOrderData = await orderBook.populateTransaction.addOrder(orderConfig_A);   
  
    // Building Tx
    const nonce = await provider.getTransactionCount(signer.address)   
  
  
      // An estimate may not be accurate since there could be another transaction on the network that was not accounted for,
      // but after being mined affected relevant state.
      // https://docs.ethers.org/v5/api/providers/provider/#Provider-estimateGas
      const gasLimit = await provider.estimateGas({ 
        to:contractConfig.contracts[network].orderbook.address ,
        data: addOrderData.data
      }) 
  
      const feeData = await estimateFeeData(provider)  
      
    
      // hard conded values to be calculated
      const txData = {  
        to: contractConfig.contracts[network].orderbook.address ,
        from: signer.address, 
        nonce: ethers.BigNumber.from(nonce).toHexString() ,
        data : addOrderData.data ,
        gasLimit : gasLimit.toHexString(), 
        maxPriorityFeePerGas: feeData.maxPriorityFeePerGas.toHexString(), 
        maxFeePerGas: feeData.maxFeePerGas.toHexString(),
        type: '0x02'
      }   
          
      // Generate Transaction 
      const tx = FeeMarketEIP1559Transaction.fromTxData(txData, { common })   
    
      const privateKey = Buffer.from(
        priKey,
        'hex'
      ) 
      
      // Sign Transaction 
      const signedTx = tx.sign(privateKey)
    
      // Send the transaction
      const contractTransaction = await provider.sendTransaction(
        "0x" + signedTx.serialize().toString("hex")
      );     
  
      await decodeAddOrderEventsArgsPilot1(contractTransaction,orderBook)
      return contractTransaction

}  

export const approveDepositTokenOB = async(tokenContract, spender, amount, signer, provider, common , priKey) => {  
  
    console.log("Approving Tokens For Deposit.....")   
    
    const balance = await tokenContract.balanceOf(signer.address) 

    if( amount.gt(balance) ){
      console.log(`Not Enough balance, please make sure to have enough balance`)
      return null
    }

    const approveData = await tokenContract.populateTransaction.approve(spender.toLowerCase(), amount.toString());  

    // Building Tx
    const nonce = await provider.getTransactionCount(signer.address)   

    // An estimate may not be accurate since there could be another transaction on the network that was not accounted for,
    // but after being mined affected relevant state.
    // https://docs.ethers.org/v5/api/providers/provider/#Provider-estimateGas
    const gasLimit = await provider.estimateGas({ 
      to: approveData.to.toLowerCase() ,
      from : approveData.from.toLowerCase(),
      data: approveData.data
    }) 

    const feeData = await estimateFeeData(provider)  
    
  
    // hard conded values to be calculated
    const txData = {  
      to: tokenContract.address.toLowerCase() ,
      from: signer.address, 
      nonce: ethers.BigNumber.from(nonce).toHexString() ,
      data : approveData.data ,
      gasLimit : gasLimit.toHexString(), 
      maxPriorityFeePerGas: feeData.maxPriorityFeePerGas.toHexString(), 
      maxFeePerGas: feeData.maxFeePerGas.toHexString(),
      type: '0x02'
    }   
        
    // Generate Transaction 
    const tx = FeeMarketEIP1559Transaction.fromTxData(txData, { common })   
  
    const privateKey = Buffer.from(
      priKey,
      'hex'
    ) 
    
    // Sign Transaction 
    const signedTx = tx.sign(privateKey)
  
    // Send the transaction
    const contractTransaction = await provider.sendTransaction(
      "0x" + signedTx.serialize().toString("hex")
    );      

    return contractTransaction

}

export const depositNHTTokensOB = async(network:string,priKey: string, common: Common,amount:string) => {  
 
    if(orderDetails[0].validOutputs){   

      const outputTokenVault = orderDetails[0].validOutputs[0]  

      const depositToken = outputTokenVault.token
      const depositAmount = ethers.utils.parseUnits(amount , outputTokenVault.decimals )
      const vaultId = ethers.BigNumber.from(outputTokenVault.vaultId)

    
      //Get Provider for testnet from where the data is to be fetched 
      const provider = getProvider(network)  
      
      const signer = new ethers.Wallet(priKey,provider)   

      const tokenContract = new ethers.Contract(depositToken,abi,signer)  

     
      const approveTx = await approveDepositTokenOB(tokenContract, contractConfig.contracts[network].orderbook.address, depositAmount, signer, provider, common , priKey) 

      const approveReceipt = await approveTx.wait()  

  
      if(approveReceipt.transactionHash){   

        console.log("Tokens Approved")
        console.log("Depositing Tokens...")   

         // Get Orderbook Instance
        const orderBook = new ethers.Contract(contractConfig.contracts[network].orderbook.address,orderBookDetails.abi,signer)  

        const depositConfigStruct = {
          token: depositToken ,
          vaultId: vaultId ,
          amount: depositAmount,
        }; 

        const depositData = await orderBook.populateTransaction.deposit(depositConfigStruct);   

        // Building Tx
        const nonce = await provider.getTransactionCount(signer.address)   


          // An estimate may not be accurate since there could be another transaction on the network that was not accounted for,
          // but after being mined affected relevant state.
          // https://docs.ethers.org/v5/api/providers/provider/#Provider-estimateGas
          const gasLimit = await provider.estimateGas({ 
            to:depositData.to.toLowerCase() , 
            from:depositData.from.toLowerCase() , 
            data: depositData.data
          }) 

          const feeData = await estimateFeeData(provider)  
          
        
          // hard conded values to be calculated
          const txData = {  
            to: contractConfig.contracts[network].orderbook.address ,
            from: signer.address, 
            nonce: ethers.BigNumber.from(nonce).toHexString() ,
            data : depositData.data ,
            gasLimit : gasLimit.toHexString(), 
            maxPriorityFeePerGas: feeData.maxPriorityFeePerGas.toHexString(), 
            maxFeePerGas: feeData.maxFeePerGas.toHexString(),
            type: '0x02'
          }   
              
          // Generate Transaction 
          const tx = FeeMarketEIP1559Transaction.fromTxData(txData, { common })   
        
          const privateKey = Buffer.from(
            priKey,
            'hex'
          ) 
          
          // Sign Transaction 
          const signedTx = tx.sign(privateKey)
        
          // Send the transaction
          const contractTransaction = await provider.sendTransaction(
            "0x" + signedTx.serialize().toString("hex")
          );     

          return contractTransaction

      }else{
      console.log("Token Approval failed")
      }

     
 

    }else{
      console.log("Order Details Not Found")
    }

    


}  

export const depositUSDTTokensOB = async(network:string,priKey: string, common: Common,amount:string) => {  
 
  if(orderDetails[0].validInputs){   

    const inputTokenVault = orderDetails[0].validInputs[0]  

    const depositToken = inputTokenVault.token
    const depositAmount = ethers.utils.parseUnits(amount , inputTokenVault.decimals )
    const vaultId = ethers.BigNumber.from(inputTokenVault.vaultId)

  
    //Get Provider for testnet from where the data is to be fetched 
    const provider = getProvider(network)  
    
    const signer = new ethers.Wallet(priKey,provider)   

    const tokenContract = new ethers.Contract(depositToken,abi,signer)  

   
    const approveTx = await approveDepositTokenOB(tokenContract, contractConfig.contracts[network].orderbook.address, depositAmount, signer, provider, common , priKey) 

    const approveReceipt = await approveTx.wait()  


    if(approveReceipt.transactionHash){   

      console.log("Tokens Approved")
      console.log("Depositing Tokens...")   

       // Get Orderbook Instance
      const orderBook = new ethers.Contract(contractConfig.contracts[network].orderbook.address,orderBookDetails.abi,signer)  

      const depositConfigStruct = {
        token: depositToken ,
        vaultId: vaultId ,
        amount: depositAmount,
      }; 

      const depositData = await orderBook.populateTransaction.deposit(depositConfigStruct);   

      // Building Tx
      const nonce = await provider.getTransactionCount(signer.address)   


        // An estimate may not be accurate since there could be another transaction on the network that was not accounted for,
        // but after being mined affected relevant state.
        // https://docs.ethers.org/v5/api/providers/provider/#Provider-estimateGas
        const gasLimit = await provider.estimateGas({ 
          to:depositData.to.toLowerCase() , 
          from:depositData.from.toLowerCase() , 
          data: depositData.data
        }) 

        const feeData = await estimateFeeData(provider)  
        
      
        // hard conded values to be calculated
        const txData = {  
          to: contractConfig.contracts[network].orderbook.address ,
          from: signer.address, 
          nonce: ethers.BigNumber.from(nonce).toHexString() ,
          data : depositData.data ,
          gasLimit : gasLimit.toHexString(), 
          maxPriorityFeePerGas: feeData.maxPriorityFeePerGas.toHexString(), 
          maxFeePerGas: feeData.maxFeePerGas.toHexString(),
          type: '0x02'
        }   
            
        // Generate Transaction 
        const tx = FeeMarketEIP1559Transaction.fromTxData(txData, { common })   
      
        const privateKey = Buffer.from(
          priKey,
          'hex'
        ) 
        
        // Sign Transaction 
        const signedTx = tx.sign(privateKey)
      
        // Send the transaction
        const contractTransaction = await provider.sendTransaction(
          "0x" + signedTx.serialize().toString("hex")
        );     

        return contractTransaction

    }else{
    console.log("Token Approval failed")
    }

   


  }else{
    console.log("Order Details Not Found")
  }

  


} 

export const withdrawNHTTokensOB = async(network:string,priKey: string, common: Common,amount:string) => { 

  if(orderDetails[0].validOutputs){  

    const outputTokenVault = orderDetails[0].validOutputs[0]  

      const withdrawToken = outputTokenVault.token
      const withdrawAmount = ethers.utils.parseUnits(amount , outputTokenVault.decimals )
      const vaultId = ethers.BigNumber.from(outputTokenVault.vaultId) 

      //Get Provider for testnet from where the data is to be fetched 
      const provider = getProvider(network)  
      
      const signer = new ethers.Wallet(priKey,provider)   

      const tokenContract = new ethers.Contract(withdrawToken,abi,signer)  

      // Get Orderbook Instance
      const orderBook = new ethers.Contract(contractConfig.contracts[network].orderbook.address,orderBookDetails.abi,signer)   

      const balance = await orderBook.vaultBalance(
        signer.address ,
        withdrawToken ,
        vaultId
      )   

      if(withdrawAmount.gt(balance)){
        console.log(`Cannot withdraw more than balance. Your current balance is ${ethers.utils.formatUnits(balance.toString(), outputTokenVault.decimals)} NHT`) 
        return null
      }
     
      const withdrawConfigStruct = {
        token: withdrawToken ,
        vaultId: vaultId ,
        amount: withdrawAmount,
      }; 

      const withdrawData = await orderBook.populateTransaction.withdraw(withdrawConfigStruct);   

      // Building Tx
      const nonce = await provider.getTransactionCount(signer.address)   


      // An estimate may not be accurate since there could be another transaction on the network that was not accounted for,
      // but after being mined affected relevant state.
      // https://docs.ethers.org/v5/api/providers/provider/#Provider-estimateGas
      const gasLimit = await provider.estimateGas({ 
        to:withdrawData.to.toLowerCase() , 
        from:withdrawData.from.toLowerCase() , 
        data: withdrawData.data
      }) 

      const feeData = await estimateFeeData(provider)  
      
    
      // hard conded values to be calculated
      const txData = {  
        to: contractConfig.contracts[network].orderbook.address ,
        from: signer.address, 
        nonce: ethers.BigNumber.from(nonce).toHexString() ,
        data : withdrawData.data ,
        gasLimit : gasLimit.toHexString(), 
        maxPriorityFeePerGas: feeData.maxPriorityFeePerGas.toHexString(), 
        maxFeePerGas: feeData.maxFeePerGas.toHexString(),
        type: '0x02'
      }   
          
      // Generate Transaction 
      const tx = FeeMarketEIP1559Transaction.fromTxData(txData, { common })   
    
      const privateKey = Buffer.from(
        priKey,
        'hex'
      ) 
      
      // Sign Transaction 
      const signedTx = tx.sign(privateKey)
    
      // Send the transaction
      const contractTransaction = await provider.sendTransaction(
        "0x" + signedTx.serialize().toString("hex")
      );     

      return contractTransaction




   }

} 

export const withdrawUSDTTokensOB = async(network:string,priKey: string, common: Common,amount:string) => { 

  if(orderDetails[0].validInputs){  

    const inputTokenVault = orderDetails[0].validInputs[0]  

      const withdrawToken = inputTokenVault.token
      const withdrawAmount = ethers.utils.parseUnits(amount , inputTokenVault.decimals )
      const vaultId = ethers.BigNumber.from(inputTokenVault.vaultId)  

      //Get Provider for testnet from where the data is to be fetched 
      const provider = getProvider(network)  
      
      const signer = new ethers.Wallet(priKey,provider)   

      const tokenContract = new ethers.Contract(withdrawToken,abi,signer)  

      // Get Orderbook Instance
      const orderBook = new ethers.Contract(contractConfig.contracts[network].orderbook.address,orderBookDetails.abi,signer)   

      const balance = await orderBook.vaultBalance(
        signer.address ,
        withdrawToken ,
        vaultId
      )   


      if(withdrawAmount.gt(balance)){
        console.log(`Cannot withdraw more than balance. Your current balance is ${ethers.utils.formatUnits(balance.toString(), inputTokenVault.decimals)} USDT`) 
        return null
      }
     
      const withdrawConfigStruct = {
        token: withdrawToken ,
        vaultId: vaultId ,
        amount: withdrawAmount,
      }; 

      const withdrawData = await orderBook.populateTransaction.withdraw(withdrawConfigStruct);   

      // Building Tx
      const nonce = await provider.getTransactionCount(signer.address)   


      // An estimate may not be accurate since there could be another transaction on the network that was not accounted for,
      // but after being mined affected relevant state.
      // https://docs.ethers.org/v5/api/providers/provider/#Provider-estimateGas
      const gasLimit = await provider.estimateGas({ 
        to:withdrawData.to.toLowerCase() , 
        from:withdrawData.from.toLowerCase() , 
        data: withdrawData.data
      }) 

      const feeData = await estimateFeeData(provider)  
      
    
      // hard conded values to be calculated
      const txData = {  
        to: contractConfig.contracts[network].orderbook.address ,
        from: signer.address, 
        nonce: ethers.BigNumber.from(nonce).toHexString() ,
        data : withdrawData.data ,
        gasLimit : gasLimit.toHexString(), 
        maxPriorityFeePerGas: feeData.maxPriorityFeePerGas.toHexString(), 
        maxFeePerGas: feeData.maxFeePerGas.toHexString(),
        type: '0x02'
      }   
          
      // Generate Transaction 
      const tx = FeeMarketEIP1559Transaction.fromTxData(txData, { common })   
    
      const privateKey = Buffer.from(
        priKey,
        'hex'
      ) 
      
      // Sign Transaction 
      const signedTx = tx.sign(privateKey)
    
      // Send the transaction
      const contractTransaction = await provider.sendTransaction(
        "0x" + signedTx.serialize().toString("hex")
      );     

      return contractTransaction




   }

}

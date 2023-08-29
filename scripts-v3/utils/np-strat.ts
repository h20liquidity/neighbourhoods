import {  ethers } from "ethers";  

import {  Common} from '@ethereumjs/common'
import {  FeeMarketEIP1559Transaction } from '@ethereumjs/tx'   
import orderBookDetails from "../abis/Orderbook.json" 
import abi from 'erc-20-abi' 
import contractConfig from "../v3-config.json"
import { encodeMeta, estimateFeeData, getProvider } from "./index";
import {RAINSTRING_BUY_NHT} from "../../src/3-sushi-v2-buy-strat";
import {RAINSTRING_SELL_NHT} from "../../src/3-sushi-v2-sell-strat";

import Parser from "../abis/IParserV1.json" 


export const deploySushiSellStrategy = async(network:string,priKey: string, common: Common,vaultId) => { 

  console.log("Deploying Sushi Sell Strategy with Native Parser...") 

    
  //Get Provider for testnet from where the data is to be fetched 
  const provider = getProvider(network)   
  

  const signer  = new ethers.Wallet(priKey,provider) 
 
  //Get Source code from contract
  // const url = `${getEtherscanBaseURL(network)}?module=contract&action=getsourcecode&address=${contractConfig[network].orderbook.address}&apikey=${getEtherscanKey(network)}`;
  // const source = await axios.get(url);    

  // Get Orderbook Instance  
  const orderBookAddress = contractConfig.contracts[network].orderbook.address
  const parserAddress = contractConfig.contracts[network].expressionDeployer.address 

  const orderBook = new ethers.Contract(orderBookAddress,orderBookDetails.abi,signer) 

  const parser = new ethers.Contract(parserAddress,Parser.abi,provider) 

  const strategyString = RAINSTRING_SELL_NHT;

  let [bytecode,constants] = await parser.parse(
    ethers.utils.toUtf8Bytes(
      strategyString.trim()
    )
  ) 

  const EvaluableConfig_A = {
    deployer: parserAddress,
    bytecode: bytecode,
    constants: constants,
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
    to:orderBook.address ,
    data: addOrderData.data
  }) 
  
  const feeData = await estimateFeeData(provider)  


  // hard conded values to be calculated
  const txData = {  
    to: orderBook.address ,
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

  return contractTransaction



} 

export const deploySushiBuyStrategy = async(network:string,priKey: string, common: Common,vaultId) => { 

  console.log("Deploying Sushi Buy Strategy with Native Parser...") 

    
  //Get Provider for testnet from where the data is to be fetched 
  const provider = getProvider(network)   
  

  const signer  = new ethers.Wallet(priKey,provider) 
 
  //Get Source code from contract
  // const url = `${getEtherscanBaseURL(network)}?module=contract&action=getsourcecode&address=${contractConfig[network].orderbook.address}&apikey=${getEtherscanKey(network)}`;
  // const source = await axios.get(url);    

  // Get Orderbook Instance 

  const orderBookAddress = contractConfig.contracts[network].orderbook.address
  const parserAddress = contractConfig.contracts[network].expressionDeployer.address  

  const orderBook = new ethers.Contract(orderBookAddress,orderBookDetails.abi,signer) 

  const parser = new ethers.Contract(parserAddress,Parser.abi,provider) 

  const strategyString = RAINSTRING_BUY_NHT

  let [bytecode,constants] = await parser.parse(
    ethers.utils.toUtf8Bytes(
      strategyString.trim()
    )
  ) 

  const EvaluableConfig_A = {
    deployer: parserAddress,
    bytecode: bytecode,
    constants: constants,
  } 

  const orderConfig_A = {
    validInputs: [
      { token: contractConfig.contracts[network].nht.address, decimals: contractConfig.contracts[network].nht.decimals, vaultId: vaultId},
    ],
    validOutputs: [
      { token: contractConfig.contracts[network].usdt.address, decimals: contractConfig.contracts[network].usdt.decimals, vaultId: vaultId },
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
    to:orderBook.address ,
    data: addOrderData.data
  }) 
  
  const feeData = await estimateFeeData(provider)  


  // hard conded values to be calculated
  const txData = {  
    to: orderBook.address ,
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

export const depositNHTTokensOB = async(network:string,priKey: string, common: Common,amount:string,vault:string) => {  
 

    

      const depositToken = contractConfig.contracts[network].nht.address
      const depositAmount = ethers.utils.parseUnits(amount , contractConfig.contracts[network].nht.decimals )
      const vaultId = ethers.BigNumber.from(vault)

    
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

        const depositData = await orderBook.populateTransaction.deposit(depositToken,vaultId,depositAmount);   

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

     
 

    

    


}  

export const depositUSDTTokensOB = async(network:string,priKey: string, common: Common,amount:string,vault:string) => {  
 
   
    const depositToken = contractConfig.contracts[network].usdt.address
    const depositAmount = ethers.utils.parseUnits(amount , contractConfig.contracts[network].usdt.decimals)
    const vaultId = ethers.BigNumber.from(vault)

  
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


      const depositData = await orderBook.populateTransaction.deposit(depositToken,vaultId,depositAmount);   

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

   


  

  


} 

export const withdrawNHTTokensOB = async(network:string,priKey: string, common: Common,amount:string,vault:string) => { 

      const withdrawToken = contractConfig.contracts[network].nht.address
      const withdrawTokenDecimal = contractConfig.contracts[network].nht.decimals
      const withdrawAmount = ethers.utils.parseUnits(amount , contractConfig.contracts[network].nht.decimals )
      const vaultId = ethers.BigNumber.from(vault) 

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
        console.log(`Cannot withdraw more than balance. Your current balance for the vault is ${ethers.utils.formatUnits(balance.toString(), withdrawTokenDecimal)} NHT`) 
        return null
      }

      const withdrawData = await orderBook.populateTransaction.withdraw(withdrawToken,vaultId,withdrawAmount);   

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

export const withdrawUSDTTokensOB = async(network:string,priKey: string, common: Common,amount:string, vault:string) => { 

      const withdrawToken = contractConfig.contracts[network].usdt.address
      const withdrawTokenDecimals = contractConfig.contracts[network].usdt.decimals
      const withdrawAmount = ethers.utils.parseUnits(amount , withdrawTokenDecimals)
      const vaultId = ethers.BigNumber.from(vault)  

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
        console.log(`Cannot withdraw more than balance. Your current balance for the vault is ${ethers.utils.formatUnits(balance.toString(), withdrawTokenDecimals)} USDT`) 
        return null
      }
     

      const withdrawData = await orderBook.populateTransaction.withdraw(withdrawToken,vaultId,withdrawAmount);   

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

export const removeOrder = async(network:string,priKey:string,common: Common,hash:string) => { 

   //Get Provider for testnet from where the data is to be fetched 
   const provider = getProvider(network)  
    
   const signer = new ethers.Wallet(process.env.DEPLOYMENT_KEY,provider)  
   
   const orderBookAddress = contractConfig.contracts[network].orderbook.address
   const orderBook = new ethers.Contract(orderBookAddress,orderBookDetails.abi,signer)  

   const remvTx = await provider.getTransactionReceipt(hash)  

   // Filter By AddOrder Event
   const logs = remvTx.logs.filter(e => e.topics[0].toLocaleLowerCase() === "0x6fa57e1a7a1fbbf3623af2b2025fcd9a5e7e4e31a2a6ec7523445f18e9c50ebf")

    const order = ethers.utils.defaultAbiCoder.decode([ 
        "address",
        "address",
        "tuple(address,bool,tuple(address,address,address),tuple(address,uint8,uint256)[],tuple(address,uint8,uint256)[]) order",
        "uint256"
    ],logs[0].data).order 

  const removeData = await orderBook.populateTransaction.removeOrder(order);   

  // Building Tx
  const nonce = await provider.getTransactionCount(signer.address)   

  // An estimate may not be accurate since there could be another transaction on the network that was not accounted for,
  // but after being mined affected relevant state.
  // https://docs.ethers.org/v5/api/providers/provider/#Provider-estimateGas
  const gasLimit = await provider.estimateGas({ 
    to:removeData.to.toLowerCase() , 
    from:removeData.from.toLowerCase() , 
    data: removeData.data
  }) 

  const feeData = await estimateFeeData(provider)  
  

  // hard conded values to be calculated
  const txData = {  
    to: orderBook.address ,
    from: signer.address, 
    nonce: ethers.BigNumber.from(nonce).toHexString() ,
    data : removeData.data ,
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
import { BigNumber, ethers } from "ethers";  

import {  Common,  CustomChain, Chain, Hardfork } from '@ethereumjs/common'
import {  FeeMarketEIP1559Transaction } from '@ethereumjs/tx'  
import { getContractAddressesForChainOrThrow } from "@0x/contract-addresses";
import fs from "fs"  
import * as mustache from 'mustache'; 
import * as path from "path";  
import orderBookDetails from "../../config/Orderbook/OrderBook.json" 
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



import contractConfig from "../config/contracts.config.json"  
import tokens from "../config/tokens.config.json"  



import axios from "axios";
import { standardEvaluableConfig } from "../../utils/interpreter/interpreter";
import { hexlify } from "ethers/lib/utils";
import { getEventArgs } from "../../utils";

/*
* Get etherscan key
*/
export const getEtherscanKey = (network:string) => { 

  let key = ''
  if (network === "mumbai" || network === "polygon"){ 
    key = process.env.POLYGONSCAN_API_KEY
  }else if(network === "goerli"){
    key = ''
  }else if(network === "snowtrace"){
    key = ''
  }else if(network === "sepolia"){
    key = process.env.ETHERSCAN_API_KEY
  }else if(network === "hardhat"){
    key = ''
  }
  return key
}    

/*
* Get base url
*/
export const getEtherscanBaseURL = (network:string) => { 

  let url = ''
  if (network === "mumbai"){ 
    url = 'https://api-testnet.polygonscan.com/api'
  }else if(network === "goerli"){
    url = ''
  }else if(network === "snowtrace"){
    url = ''
  }else if(network === "sepolia"){
    url = 'https://api-sepolia.etherscan.io/api'
  }else if(network === "polygon"){
    url = 'https://api.polygonscan.com/api'
  }else if(network === "hardhat"){
    url = ''
  }
  return url
}  




/*
* Get provider for a specific network
*/
export const getProvider = (network:string) => { 

    let provider 
    if (network === "mumbai"){  
      provider = new ethers.providers.AlchemyProvider("maticmum",`${process.env.ALCHEMY_KEY_MUMBAI}`)   
    }else if(network === "goerli"){
      provider = new ethers.providers.AlchemyProvider("goerli",`${process.env.ALCHEMY_KEY_GORELI}`)  
    }else if(network === "snowtrace"){
      provider = new ethers.providers.JsonRpcProvider('https://api.avax-test.network/ext/bc/C/rpc')
    }else if(network === "sepolia"){ 
      provider = new ethers.providers.JsonRpcProvider(`https://eth-sepolia.g.alchemy.com/v2/${process.env.ALCHEMY_KEY_SEPOLIA}`)
    }else if(network === "polygon"){
      provider = new ethers.providers.AlchemyProvider("matic",`${process.env.ALCHEMY_KEY_POLYGON}`)   
    }else if(network === "hardhat"){
      provider = new ethers.providers.JsonRpcProvider('http://127.0.0.1:8545') 
      
    }
    return provider
} 

/*
* Get @ethereumjs/common Common
*/
export const getCommons = (network:string) => {
    let common 
    if (network === "mumbai"){
        common = Common.custom(CustomChain.PolygonMumbai) 
    }else if(network === "goerli"){
      common = new Common({ chain: Chain.Goerli, hardfork: Hardfork.London })
    }else if(network === "snowtrace"){
      common = Common.custom({ chainId: 43113 })
    }else if(network === "sepolia"){
      common = Common.custom({ chainId: 11155111 })
    }else if(network === "polygon"){
      common = Common.custom(CustomChain.PolygonMainnet) 
    }else if(network === "hardhat"){
      common = Common.custom({ chainId: 31337 })

    }
    
    return common
}

/*
* Get transaction data (bytecode + args)
*/
export const getTransactionData = async (provider: any, address:string): Promise<string> => { 

    const transaction = await provider.getTransaction(address)  

    return transaction.data
}   

/**
 *Replace all DISpair instances 
 */
 export const getTransactionDataForZeroEx = (txData:string,fromNetwork:string,toNetwork:string) => { 

  const fromProvider = getProvider(fromNetwork)
  const toProvider = getProvider(toNetwork)  

  const { exchangeProxy: fromNetworkProxy } = getContractAddressesForChainOrThrow(fromProvider._network.chainId);
  const { exchangeProxy: toNetworkProxy } = getContractAddressesForChainOrThrow(toProvider._network.chainId);  

  
  txData = txData.toLocaleLowerCase()
  const fromContractConfig = contractConfig[fromNetwork]
  const toContractConfig = contractConfig[toNetwork] 

  if(txData.includes(fromContractConfig["orderbook"]["address"].split('x')[1].toLowerCase())){ 
    txData = txData.replace(fromContractConfig["orderbook"]["address"].split('x')[1].toLowerCase(), toContractConfig["orderbook"]["address"].split('x')[1].toLowerCase())
  }
  if(txData.includes(fromNetworkProxy.split('x')[1].toLowerCase())){
    txData = txData.replace(fromNetworkProxy.split('x')[1].toLowerCase(), toNetworkProxy.split('x')[1].toLowerCase())
  }
  return txData 
}   

/**
 * @returns a random 32 byte number in hexstring format
 */
export function randomUint256(): string {
  return ethers.utils.hexZeroPad(ethers.utils.randomBytes(32), 32);
} 


/**
 *Replace all DISpair instances 
 */
export const getTransactionDataForNetwork =  (txData:string,fromNetwork:string,toNetwork:string) => {
  
  txData = txData.toLocaleLowerCase()
  const fromNetworkConfig = contractConfig[fromNetwork]
  const toNetworkConfig = contractConfig[toNetwork]  

  // let contract = await hre.ethers.getContractAt('Rainterpreter',fromNetworkConfig["interpreter"]["address"]) 
  // console.log("contract : " , contract )

  if(txData.includes(fromNetworkConfig["interpreter"]["address"].split('x')[1].toLowerCase())){ 
    txData = txData.replace(fromNetworkConfig["interpreter"]["address"].split('x')[1].toLowerCase(), toNetworkConfig["interpreter"]["address"].split('x')[1].toLowerCase())
  }
  if(txData.includes(fromNetworkConfig["store"]["address"].split('x')[1].toLowerCase())){
    txData = txData.replace(fromNetworkConfig["store"]["address"].split('x')[1].toLowerCase(), toNetworkConfig["store"]["address"].split('x')[1].toLowerCase())
  }
  if(txData.includes(fromNetworkConfig["expressionDeployer"]["address"].split('x')[1].toLowerCase())){
    txData = txData.replace(fromNetworkConfig["expressionDeployer"]["address"].split('x')[1].toLowerCase(), toNetworkConfig["expressionDeployer"]["address"].split('x')[1].toLowerCase())
  }
  return txData 
}  

export const getGasDataForPolygon = async () => {

  let gasData = await axios.get('https://gasstation-mainnet.matic.network/v2') 
  return gasData
}

const estimateFeeData = async ( 
  chainProvider:any ,
): Promise<{
  gasPrice: BigNumber;
  maxFeePerGas: BigNumber;
  maxPriorityFeePerGas: BigNumber;
}> => {
  if (chainProvider._network.chainId === 137) {  
    const gasDataForPolygon = await getGasDataForPolygon()
    return {
      gasPrice: BigNumber.from("21000"),
      maxFeePerGas : ethers.utils.parseUnits(
        Math.ceil(gasDataForPolygon.data.fast.maxFee).toString(),
        "gwei"
      ) , 
      maxPriorityFeePerGas : ethers.utils.parseUnits(
        Math.ceil(gasDataForPolygon.data.fast.maxPriorityFee).toString(),
        "gwei"
      ) 
    }

  }else if (chainProvider._network.chainId === 31337) {
    return {
      gasPrice: BigNumber.from("1980000104"),
      maxFeePerGas: BigNumber.from("1500000030"),
      maxPriorityFeePerGas: BigNumber.from("1500000000"),
    };
  }else if(chainProvider._network.chainId === 43113 || chainProvider._network.chainId === 11155111 ){
    // Snowtrace Network
    const feeData = await chainProvider.getFeeData();   
    return {
      gasPrice: BigNumber.from("0x7A1200"),
      maxPriorityFeePerGas: feeData["maxPriorityFeePerGas"],
      maxFeePerGas: feeData["maxFeePerGas"],
    }
  } else {
    const chain = allChains.find((chain) => chain.id === chainProvider._network.chainId); 

    const { provider, webSocketProvider } = configureChains(
      [chain],
      [publicProvider()]
    );

    createClient({
      autoConnect: true,
      provider,
      webSocketProvider,
    });
    const { gasPrice, maxFeePerGas, maxPriorityFeePerGas } =
      await fetchFeeData();

    return {
      gasPrice,
      maxFeePerGas,
      maxPriorityFeePerGas,
    };
  }
};
 

export const fetchFile = (_path: string): string => {
  try {
    return fs.readFileSync(_path).toString();
  } catch (error) {
    console.log(error);
    return "";
  }
};   

export const encodeMeta = (data: string) => {
  return (
    "0x" +
    BigInt(0xff0a89c674ee7874n).toString(16).toLowerCase() +
    hexlify(ethers.utils.toUtf8Bytes(data)).split("x")[1]
  );
}; 

/*
* Deploy transaction
*/
export const deployContractToNetwork = async (provider: any, common: Common,  priKey: string, transactionData: string) => { 

    console.log("Deploying Contract...")
  
    const signer  = new ethers.Wallet(priKey,provider)   

    const nonce = await provider.getTransactionCount(signer.address)   


    // An estimate may not be accurate since there could be another transaction on the network that was not accounted for,
    // but after being mined affected relevant state.
    // https://docs.ethers.org/v5/api/providers/provider/#Provider-estimateGas
    const gasLimit = await provider.estimateGas({
      data: transactionData
    }) 


    const feeData = await estimateFeeData(provider)  
    
  
    // hard conded values to be calculated
    const txData = { 
      nonce: ethers.BigNumber.from(nonce).toHexString() ,
      data : transactionData ,
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
    const deployTransaction = await provider.sendTransaction(
      "0x" + signedTx.serialize().toString("hex")
    ); 
    
    return deployTransaction
  
  }   

export const decodeAddOrderEventsArgs = async(transaction,orderBook) => {  

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

  writeFileSync('./scripts/DeployStrategy/orderDetails.json', data)  

 


} 

export const decodeCloneEvent = async(transaction,cloneFactory) => {  

  const eventObj = (await transaction.wait()).logs.find(
    (x) =>{  
      return (x.topics[0] == "0x274b5f356634f32a865af65bdc3d8205939d9413d75e1f367652e4f3b24d0c3a") // Checking for New Clone Event 
    }
      
  ); 

  if (!eventObj) {
    console.log(`Could not find event data!!!`);
  }

  let eventData = cloneFactory.interface.decodeEventLog(
    "NewClone",
    eventObj.data,
    eventObj.topics
  );    

  const cloneObject = {
    sender : eventData.sender ,
    implementation: eventData.implementation ,
    clone : eventData.clone ,
  }

  return cloneObject

}


export const deployStrategy = async(network:string,priKey: string, common: Common,ratio:string) => {   

  console.log("Deploying Strategy...") 

  if(!ratio) return null
    
  //Get Provider for testnet from where the data is to be fetched 
  const provider = getProvider(network)   
  
  const vaultId = ethers.BigNumber.from(randomUint256());

  const signer  = new ethers.Wallet(priKey,provider) 
 
  //Get Source code from contract
  // const url = `${getEtherscanBaseURL(network)}?module=contract&action=getsourcecode&address=${contractConfig[network].orderbook.address}&apikey=${getEtherscanKey(network)}`;
  // const source = await axios.get(url);    

  // Get Orderbook Instance
  const orderBook = new ethers.Contract(contractConfig[network].orderbook.address,orderBookDetails.abi,signer) 

  //Building Expression
  const strategyExpression = path.resolve(
      __dirname,
      "../../src/0-pilot.rain"
    ); 

  const strategyString = await fetchFile(strategyExpression);  

  const arbCounterParty = contractConfig[network].zeroexorderbookinstance.address 
  console.log("arbCounterParty: ",arbCounterParty)

  const stringExpression = mustache.render(strategyString, {
    counterparty: arbCounterParty,
    ratio: ratio
  });    

  const { sources, constants } = await standardEvaluableConfig(stringExpression)  

  const EvaluableConfig_A = {
    deployer: contractConfig[network].expressionDeployer.address,
    sources,
    constants,
  }
  const orderConfig_A = {
    validInputs: [
      { token: tokens[network].usdt.address, decimals: tokens[network].usdt.decimals, vaultId: vaultId },
    ],
    validOutputs: [
      { token: tokens[network].nht.address, decimals: tokens[network].nht.decimals, vaultId: vaultId},
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
      to:contractConfig[network].orderbook.address ,
      data: addOrderData.data
    }) 

    const feeData = await estimateFeeData(provider)  
    
  
    // hard conded values to be calculated
    const txData = {  
      to: contractConfig[network].orderbook.address ,
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

    await decodeAddOrderEventsArgs(contractTransaction,orderBook)
    return contractTransaction

    


}  

export const approveDepositToken = async(tokenContract, spender, amount, signer, provider, common , priKey) => {  
  
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

export const depositNHTTokens = async(network:string,priKey: string, common: Common,amount:string) => {  
 
    if(orderDetails[0].validOutputs){   

      const outputTokenVault = orderDetails[0].validOutputs[0]  

      const depositToken = outputTokenVault.token
      const depositAmount = ethers.utils.parseUnits(amount , outputTokenVault.decimals )
      const vaultId = ethers.BigNumber.from(outputTokenVault.vaultId)

    
      //Get Provider for testnet from where the data is to be fetched 
      const provider = getProvider(network)  
      
      const signer = new ethers.Wallet(priKey,provider)   

      const tokenContract = new ethers.Contract(depositToken,abi,signer)  

     
      const approveTx = await approveDepositToken(tokenContract, contractConfig[network].orderbook.address, depositAmount, signer, provider, common , priKey) 

      const approveReceipt = await approveTx.wait()  

  
      if(approveReceipt.transactionHash){   

        console.log("Tokens Approved")
        console.log("Depositing Tokens...")   

         // Get Orderbook Instance
        const orderBook = new ethers.Contract(contractConfig[network].orderbook.address,orderBookDetails.abi,signer)  

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
            to: contractConfig[network].orderbook.address ,
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


export const deployArbContractInstance = async (provider: any, common: Common,  priKey: string, network: string, counterparty: string) => { 

  console.log("Deploying Arb Instance...")

  const signer  = new ethers.Wallet(priKey,provider)   

  const nonce = await provider.getTransactionCount(signer.address)    

  const arbExp = path.resolve(
    __dirname,
    "../../src/0-arb.rain"
  );

  const arbString = await fetchFile(arbExp); 

  const arbExpression = mustache.render(arbString, {
    counterparty: counterparty,
  }); 

  const { sources, constants } = await standardEvaluableConfig(arbExpression)  

  const { exchangeProxy } = getContractAddressesForChainOrThrow(provider._network.chainId);
  

  const borrowerConfig = {
    orderBook : contractConfig[network].orderbook.address,
    zeroExExchangeProxy: exchangeProxy,
    evaluableConfig: {
      deployer: contractConfig[network].expressionDeployer.address,
      sources,
      constants
    }

  }
  const encodedConfig = ethers.utils.defaultAbiCoder.encode(
    [
      "tuple(address orderBook,address zeroExExchangeProxy,tuple(address deployer,bytes[] sources,uint256[] constants) evaluableConfig)",
    ],
    [borrowerConfig]
  ); 
 

  if(contractConfig[network].zeroexorderbookimplmentation.address){
    const zeroExImplementation = contractConfig[network].zeroexorderbookimplmentation.address 
    const cloneFactoryAddress = contractConfig[network].clonefactory.address  

    //Get Source code from contract
    const url = `${getEtherscanBaseURL(network)}?module=contract&action=getsourcecode&address=${cloneFactoryAddress}&apikey=${getEtherscanKey(network)}`;
    const source = await axios.get(url);    

    // Create Clone Factory Instance
    const cloneFactory = new ethers.Contract(cloneFactoryAddress,source.data.result[0].ABI,signer)  

    const cloneData = await cloneFactory.populateTransaction.clone(zeroExImplementation,encodedConfig);   
    
    // Building Tx
    const nonce = await provider.getTransactionCount(signer.address)   


    // An estimate may not be accurate since there could be another transaction on the network that was not accounted for,
    // but after being mined affected relevant state.
    // https://docs.ethers.org/v5/api/providers/provider/#Provider-estimateGas
    const gasLimit = await provider.estimateGas({ 
      to:cloneData.to ,
      from:cloneData.from ,
      data: cloneData.data
    }) 

    const feeData = await estimateFeeData(provider)  
    

    // hard conded values to be calculated
    const txData = {  
      to: cloneFactoryAddress.toLowerCase() ,
      from: signer.address, 
      nonce: ethers.BigNumber.from(nonce).toHexString() ,
      data : cloneData.data ,
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

    const cloneEventData = await decodeCloneEvent(contractTransaction,cloneFactory)

  
    return {cloneEventData,contractTransaction}

  }






  
}  


 

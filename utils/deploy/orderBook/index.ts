import { artifacts } from "hardhat"; 
import { ethers  } from "hardhat"; 
import config from "../../../config/config.json" 
import ob from "../../../config/Orderbook/1-OrderBook.json"
import axios from "axios"

export const getOrderBook = async (address: string) => { 
    const signers = await ethers.getSigners();

    // From the mumbai chain 
    // In near future this will de done from sg  
    
    //Get Source code ABI from contract
    // const url = `https://api-testnet.polygonscan.com/api?module=contract&action=getsourcecode&address=${config.contracts["mumbai"].orderbook.address}&apikey=${process.env.POLYGONSCAN_API_KEY}`;
    // const source = await axios.get(url);   
    
    const orderBook = new ethers.Contract(address,ob.abi,signers[0])    



    return orderBook

} 

export const ob_entrypoints = ["calculate-source","handle-source","calculate-batch"]  
export const arb_entrypoints = ["main"]  


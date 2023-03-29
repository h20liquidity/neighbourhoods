import { artifacts } from "hardhat"; 
import { ethers  } from "hardhat"; 
import config from "../../../config/config.json"
import axios from "axios"

export const getOrderBook = async (address: string) => { 
    const signers = await ethers.getSigners();

    // From the mumbai chain 
    // In near future this will de done from sg  
    
    //Get Source code ABI from contract
    const url = `https://api-testnet.polygonscan.com/api?module=contract&action=getsourcecode&address=${config.contracts.orderbook.address}&apikey=${process.env.POLYGONSCAN_API_KEY}`;
    const source = await axios.get(url);   
    
    const orderBook = new ethers.Contract(address,source.data.result[0].ABI,signers[0])    



    return orderBook

}
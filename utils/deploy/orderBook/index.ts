import { artifacts } from "hardhat"; 
import { ethers  } from "hardhat"; 

export const getOrderBook = async (address: string) => { 
    const signers = await ethers.getSigners();

    const obAbiJSON = artifacts.readArtifactSync("OrderBook").abi; 

    const orderBook = new ethers.Contract(address,obAbiJSON,signers[0])   

    return orderBook

}
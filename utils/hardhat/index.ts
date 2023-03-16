
import { ethers } from "hardhat";
import * as helpers  from "@nomicfoundation/hardhat-network-helpers"


/**
 * @public
 * Forces hardhat network to advance time for the given duration
 *
 * @param duration - time to elapse in seconds
 */
export const timewarp = async (duration: number): Promise<void> => {
    await ethers.provider.send("evm_increaseTime", [duration]);
    await ethers.provider.send("evm_mine", []);
  };
  
export const resetFork = async (url:string , block:number):Promise<void> => {
  await helpers.reset(url, block);
}
import { ethers } from "hardhat";
/**
 * @returns a random 32 byte number in hexstring format
 */
export function randomUint256(): string {
    return ethers.utils.hexZeroPad(ethers.utils.randomBytes(32), 32);
  }
  
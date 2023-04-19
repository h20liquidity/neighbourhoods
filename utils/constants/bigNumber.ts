import { ethers } from "hardhat";

export const sixZeros = "000000";
export const eighteenZeros = "000000000000000000";

export const ONE = ethers.BigNumber.from("1" + eighteenZeros);

export const max_uint256 = ethers.BigNumber.from(
    "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"
  );


import { BigNumber } from "ethers";
import { ONE } from "../constants";




/**
 * @public
 * Partially emulates `LibFixedPointMath.fixedPointMul` function, but to 18 fixed point decimals.
 *
 * @param a First term.
 * @param b Second term.
 * @returns `a_` multiplied by `b_` to 18 fixed point decimals.
 */
export const fixedPointMul = (a: BigNumber, b: BigNumber): BigNumber =>
  a.mul(b).div(ONE); 

export const fixedPointDiv = (a: BigNumber, b: BigNumber): BigNumber =>
  a.mul(ONE).div(b);




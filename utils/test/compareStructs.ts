import { assert } from "chai";
import { BigNumber } from "ethers";
import { hexlify } from "ethers/lib/utils";


/**
 * Uses chai `assert` to compare a Solidity struct with a JavaScript object by checking whether the values for each property are equivalent.
 * Will safely recurse over nested structs and compare nested properties.
 * Throws an error if any comparisons fail.
 * @param solStruct Solidity struct, returned from something such as an emitted solidity Event. This should have an array-like structure with raw values followed by key-values (e.g. `solStruct: ['foo', 'bar', prop1: 'foo', prop2: 'bar']`).
 * @param jsObj JavaScript object literal to use as comparison.
 * @param debug (default: false) Optional debug logging
 */
export const compareStructs = (
  solStruct: unknown[],
  jsObj: Record<string, unknown>,
  debug = false
) => {
  const solEntries = Object.entries(solStruct).splice(
    solStruct.length // actually half the solStruct size
  );

  if (!solEntries.length) {
    throw new Error(
      `Could not generate entries from a solStruct of length ${solStruct.length}. Ensure you are using a Solidity struct for solStruct.`
    );
  }

  const solObj = Object.fromEntries(solEntries);

  testStructs(solObj, jsObj, debug);
};



const testStructs = (
  solObj: Record<string, unknown>,
  jsObj: Record<string, unknown>,
  debug: boolean
) => {
  Object.keys(solObj).forEach((key) => {
    let expectedValue = jsObj[key];
    let actualValue = solObj[key];

    if (expectedValue !== undefined) {
      if (expectedValue instanceof Uint8Array) {
        expectedValue = hexlify(expectedValue);
      }
      if (actualValue instanceof BigNumber) {
        expectedValue = BigNumber.from(expectedValue);
      }

      if (
        typeof actualValue === "string" ||
        typeof expectedValue === "string"
      ) {
        actualValue = `${actualValue}`.toLowerCase();
        expectedValue = `${expectedValue}`.toLowerCase();
      }

      if (
        typeof actualValue === "object" ||
        typeof expectedValue === "object"
      ) {
        // recursive call for nested structs
        testStructs(
          actualValue as Record<string, unknown>,
          expectedValue as Record<string, unknown>,
          debug
        );
      } else {
        let condition: boolean;
        try {
          if (debug)
            console.log({ actualValue, expectedValue, key, jsObj, solObj });

          condition =
            actualValue == expectedValue || actualValue["eq"](expectedValue);
        } catch (error) {
          console.log(error);
        }

        assert(
          condition,
          `wrong value for property: '${key}'
          expected  ${expectedValue}
          got       ${actualValue}
          -
          key       ${key}
          object    ${solObj}`
        );
      }
    }
  });
};


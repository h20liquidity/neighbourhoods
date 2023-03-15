
import Orderbook from "../../../node_modules/@rainprotocol/rain-protocol/contracts/orderbook/OrderBook.meta.json";
import ContractMetaSchema from "../../../schema/meta/v0/contract.meta.schema.json";
import { deflateJson, metaFromBytes, validateMeta } from "../general";
import { MAGIC_NUMBERS, cborEncode } from "../cbor";
import { artifacts } from "hardhat";
import { arrayify, BytesLike } from "ethers/lib/utils";

export type ContractMeta =
  | "orderbook";

/**
 * @public
 * Get deplyable compressed bytes of a Rain contract meta
 *
 * @param contract - Name of a Rain contract, eg "sale", "flowErc20"
 * @returns Deployable bytes as hex string
 */
export const getRainContractMetaBytes = (contract: ContractMeta): string => {
  let meta;
  if (contract === "orderbook") meta = Orderbook;
  if (!validateMeta(meta, ContractMetaSchema))
    throw new Error("invalid contract meta");
  return deflateJson(meta);
};

/**
 * @public
 * Decompress and convert bytes to one of Rain's contract metas
 *
 * @param bytes - Bytes to decompress and convert back to json meta
 * @param path - Path to write the results to if having the output as a json file is desired, won't write to file if not provided.
 * @returns Rain contract Meta as object
 */
export const getRainContractMetaFromBytes = (
  bytes: BytesLike,
  path?: string
) => {
  return metaFromBytes(bytes, ContractMetaSchema, path);
};

/**
 * @public
 * Get cbor encoded deployable compressed bytes of a Rain contract.
 *
 * Encode the `Contract meta v1` and `Solidity ABIv2` with CBOR, and concanate
 * them to generate a CBOR sequence with the Rain meta document Prefix.
 *
 * See more: https://github.com/rainprotocol/metadata-spec/blob/main/README.md
 *
 * @param contract - Name of a Rain contract, eg "sale", "flowErc20"
 * @returns CBOR sequence as hex string with the Rain Prefix
 */
export const getRainMetaDocumentFromContract = (
  contract: ContractMeta
): string => {
  // Prefixes every rain meta document as an hex string
  const metaDocumentHex =
    "0x" + MAGIC_NUMBERS.RAIN_META_DOCUMENT.toString(16).toLowerCase();

  // -- Encoding ContractMeta with CBOR
  // Obtain Contract Meta as string (Deflated JSON) and parse it to an ArrayBuffer
  const contractMeta = arrayify(getRainContractMetaBytes(contract)).buffer;
  const contractMetaEncoded = cborEncode(
    contractMeta,
    MAGIC_NUMBERS.CONTRACT_META_V1,
    "application/json",
    {
      contentEncoding: "deflate",
    }
  );

  // -- Enconding Contract JSON ABIv2 with CBOR
  // Obtain ABIv2 as string (Deflated JSON) and parse it to an ArrayBuffer
  const abiJson = arrayify(getAbi(contract)).buffer;
  const abiEncoded = cborEncode(
    abiJson,
    MAGIC_NUMBERS.SOLIDITY_ABIV2,
    "application/json",
    {
      contentEncoding: "deflate",
    }
  );

  // Contract document magic number plus each encoded data
  return metaDocumentHex + contractMetaEncoded + abiEncoded;
};

/**
 * @public
 * Read the artifacts and obtain the ABI from a given `contractName_` to encode as
 * a deflated JSON.
 *
 * @param contractName_ The contract that will be read to get the ABI
 * @returns The  deflated ABI JSON as hex string.
 */
export const getAbi = (contractName_: ContractMeta): string => {
  let name: string;


  if (contractName_ === "orderbook") name = "OrderBook";
  if (!name) throw new Error("Invalid contract name");

  const abiJSON = artifacts.readArtifactSync(name).abi;

  return deflateJson(abiJSON);
};

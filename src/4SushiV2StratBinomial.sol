// SPDX-License-Identifier: CAL
pragma solidity =0.8.19;

import "src/interface/IERC20.sol";
import "src/interface/IOrderBookV3ArbOrderTaker.sol";
import {IUniswapV2Pair} from "rain.interpreter/lib/rain.uniswapv2/src/interface/IUniswapV2Pair.sol";
import {RainterpreterExpressionDeployerNPE2} from
    "rain.interpreter/src/concrete/RainterpreterExpressionDeployerNPE2.sol";
import {RainterpreterParserNPE2} from "rain.interpreter/src/concrete/RainterpreterParserNPE2.sol";
import {
    SourceIndexV2,
    IInterpreterV2,
    IInterpreterStoreV1
} from "rain.interpreter/src/interface/unstable/IInterpreterV2.sol";
import {EvaluableConfigV3} from "rain.interpreter/src/interface/IInterpreterCallerV2.sol";

// This could easily break, just happened to be some wallet that held NHT when
// I was writing this test.
address constant POLYGON_NHT_HOLDER = 0xe0e0Bb15Ad2dC19e5Eaa133968e498B4D9bF24Da;
// This could easily break, just happened to be some wallet that held USDT when
// I was writing this test.
address constant POLYGON_USDT_HOLDER = 0xF977814e90dA44bFA03b6295A0616a897441aceC;

/// @dev https://docs.sushi.com/docs/Products/Classic%20AMM/Deployment%20Addresses
/// @dev https://polygonscan.com/address/0xc35DADB65012eC5796536bD9864eD8773aBc74C4
address constant POLYGON_SUSHI_V2_FACTORY = 0xc35DADB65012eC5796536bD9864eD8773aBc74C4;

/// @dev https://docs.sushi.com/docs/Products/Classic%20AMM/Deployment%20Addresses
address constant POLYGON_SUSHI_V2_ROUTER = 0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506;

/// @dev https://polygonscan.com/address/0x84342e932797FC62814189f01F0Fb05F52519708
IERC20 constant POLYGON_NHT_TOKEN_ADDRESS = IERC20(0x84342e932797FC62814189f01F0Fb05F52519708);
uint256 constant POLYGON_NHT_TOKEN_DECIMALS = 18;

/// @dev https://polygonscan.com/address/0xc2132D05D31c914a87C6611C10748AEb04B58e8F
IERC20 constant POLYGON_USDT_TOKEN_ADDRESS = IERC20(0xc2132D05D31c914a87C6611C10748AEb04B58e8F);
uint256 constant POLYGON_USDT_TOKEN_DECIMALS = 6;

IUniswapV2Pair constant POLYGON_NHT_USDT_PAIR_ADDRESS = IUniswapV2Pair(0xe427B62B495C1dFe1Fe9F78bEbFcEB877ad05DCE);
address constant POLYGON_PAIR_TOKEN_0 = address(POLYGON_NHT_TOKEN_ADDRESS);
address constant POLYGON_PAIR_TOKEN_1 = address(POLYGON_USDT_TOKEN_ADDRESS);

IOrderBookV3ArbOrderTaker constant POLYGON_ARB_CONTRACT =
    IOrderBookV3ArbOrderTaker(0xb4ffa641e5dA49F7466142E8418622CB64dBe86B);

address constant APPROVED_EOA = 0x669845c29D9B1A64FFF66a55aA13EB4adB889a88;
address constant APPROVED_COUNTERPARTY = address(POLYGON_ARB_CONTRACT);

RainterpreterExpressionDeployerNPE2 constant POLYGON_DEPLOYER_NPE2 =
    RainterpreterExpressionDeployerNPE2(0xD61d03501E95D4B507566fB42Ca2299595c4B1e6);

RainterpreterParserNPE2 constant POLYGON_PARSER_NPE2 =
    RainterpreterParserNPE2(0x63954a113cbDB20A4fD1Ac7DD76c9eDA29727f2D);

address constant POLYGON_INTERPRETER_NPE2 = 0xf374faFE473D76bf9518e437B484FbdD5674daFf;
address constant POLYGON_STORE_NPE2 = 0x5b777FAca336c648262e9c65a3c7A372a08c205b;
IOrderBookV3 constant POLYGON_ORDERBOOK = IOrderBookV3(0xdcdee0E7a58Bba7e305dB3Abc42F4887CE8EF729);

address constant CLEARER = 0xf098172786a87FA7426eA811Ff25D31D599f766D;
address constant OB_FLASH_BORROWER = 0x409717e08DcA5fE40efdB05318FBF0E65762814D;

uint256 constant MAX_COOLDOWN = 2160;
uint256 constant MAX_COOLDOWN_18 = 2160e18;
uint256 constant MAX_USDT_18 = 50e18;

bytes constant RAINSTRING_JITTERY_BINOMIAL =
// Paramaterise the seed for our randomness (hash).
    "input:,"
    // The binomial part is using ctpop over a hash to simulate 10 coin flips.
    // produces a decimal number between 0 and 10.
    "binomial18-10: decimal18-scale18<0>(bitwise-count-ones(bitwise-decode<0 10>(hash(input)))),"
    // The noise is a decimal number between 0 and 1.
    "noise18-1: int-mod(hash(input 0) 1e18),"
    // The jittery is the binomial plus the noise. Which is a range 0-11.
    "jittery-11: decimal18-add(binomial18-10 noise18-1),"
    // The final jittery is the jittery divided by 11, which is a range 0-1.
    "jittery-1: decimal18-div(jittery-11 11e18);";

bytes constant RAINSTRING_PRELUDE =
// Sushi v2 factory address.
    "polygon-sushi-v2-factory: 0xc35DADB65012eC5796536bD9864eD8773aBc74C4,"
    // NHT token address.
    "nht-token-address: 0x84342e932797FC62814189f01F0Fb05F52519708,"
    // USDT token address.
    "usdt-token-address: 0xc2132D05D31c914a87C6611C10748AEb04B58e8F,"
    // Approved counterparty.
    "approved-counterparty: 0xb4ffa641e5dA49F7466142E8418622CB64dBe86B,"
    // Actual counterparty.
    "actual-counterparty: context<1 2>(),"
    // Order hash.
    "order-hash: context<1 0>(),"
    // The last time is stored under the order hash, as there's only a single
    // value stored for this order.
    "last-time: get(order-hash),"
    // Set the last time to this block.
    ":set(order-hash block-timestamp()),"
    // Try to sell $25 worth of nht.
    // Set the max at $50 so that the binomial peak sits at $25.
    "max-usdt-amount18: 50e18,"
    // We can just seed the rng with last time.
    "amount-random-multiplier18: call<2 1>(last-time),"
    // Calculate the target usdt amount for the order, as decimal18.
    "target-usdt-amount18: decimal18-mul(max-usdt-amount18 amount-random-multiplier18),";

bytes constant RAINSTRING_CALCULATE_ORDER_SELL =
// Sushi needs the usdt amount as 6 decimals (tether's native size).
    "target-usdt-amount: decimal18-scale-n<6 1>(target-usdt-amount18),"
    // Try to average a 12 mins cooldown, so the max is 24 mins.
    "max-cooldown18: 2160e18,"
    // Seed the rng with the hash of the last time to make it distinct from the
    // amount random multiplier.
    "cooldown-random-multiplier18: call<2 1>(hash(last-time)),"
    // Calculate the cooldown for the order.
    "cooldown18: decimal18-mul(max-cooldown18 cooldown-random-multiplier18),"
    // Scale the cooldown to integer seconds.
    "cooldown: decimal18-scale-n<0>(cooldown18),"
    // Check all the addresses are correct.
    // - counterparty is approved.
    ":ensure<0>(equal-to(approved-counterparty actual-counterparty)),"
    // Check the cooldown.
    ":ensure<1>(less-than(int-add(last-time cooldown) block-timestamp())),"
    // Token in for uniswap is ob's token out, and vice versa.
    // We want the timestamp as well as the nht amount that sushi wants in.
    // NHT is already 18 decimals, so we don't need to scale it.
    "last-price-timestamp nht-amount18: uniswap-v2-amount-in<1>(polygon-sushi-v2-factory target-usdt-amount nht-token-address usdt-token-address),"
    // Don't allow the price to change this block before this trade.
    ":ensure<2>(less-than(last-price-timestamp block-timestamp())),"
    // nht token address is the token out during a sale.
    ":ensure<3>(equal-to(context<4 0>() nht-token-address)),"
    // usdt token address is the token in during a sale.
    ":ensure<4>(equal-to(context<3 0>() usdt-token-address)),"
    // Order output max is the nht amount from sushi.
    "order-output-max18: nht-amount18,"
    // IO ratio is the usdt target divided by the nht amount from sushi.
    "io-ratio: decimal18-div(target-usdt-amount18 order-output-max18)"
    // end calculate order
    ";";

bytes constant RAINSTRING_HANDLE_IO_SELL =
// context 4 4 is the vault outputs as absolute values.
// context 2 0 is the calculated output as decimal 18.
// NHT is the output which is decimal 18 natively so no scaling is needed.
 ":ensure<5>(greater-than-or-equal-to(context<4 4>() context<2 0>()));";

function rainstringSell() pure returns (bytes memory) {
    return bytes.concat(
        RAINSTRING_PRELUDE, RAINSTRING_CALCULATE_ORDER_SELL, RAINSTRING_HANDLE_IO_SELL, RAINSTRING_JITTERY_BINOMIAL
    );
}

function expectedBinomialSellConstants() pure returns (uint256[] memory constants) {
    constants = new uint256[](9);
    constants[0] = uint256(uint160(POLYGON_SUSHI_V2_FACTORY));
    constants[1] = uint256(uint160(address(POLYGON_NHT_TOKEN_ADDRESS)));
    constants[2] = uint256(uint160(address(POLYGON_USDT_TOKEN_ADDRESS)));
    constants[3] = uint256(uint160(APPROVED_COUNTERPARTY));
    constants[4] = MAX_USDT_18;
    constants[5] = MAX_COOLDOWN_18;
    constants[6] = 0;
    constants[7] = 1e18;
    constants[8] = 11e18;
}

bytes constant SELL_ROUTE =
//offset
    hex"0000000000000000000000000000000000000000000000000000000000000020"
    //stream length
    hex"0000000000000000000000000000000000000000000000000000000000000042"
    //command 2 = processUserERC20
    hex"02"
    //token address
    hex"84342e932797fc62814189f01f0fb05f52519708"
    //number of pools
    hex"01"
    // pool share
    hex"ffff"
    // pool type
    hex"00"
    // pool address
    hex"e427b62b495c1dfe1fe9f78bebfceb877ad05dce"
    // direction 1
    hex"01"
    // to
    hex"b4ffa641e5dA49F7466142E8418622CB64dBe86B"
    // padding
    hex"000000000000000000000000000000000000000000000000000000000000";

bytes constant EXPECTED_SELL_BYTECODE =
    hex"03000000f001043b140013010000000100000101000002010000030a0002010a0000010000000534010000160000000000000535020000010000040000000609010102000000080000000723020000000000092701010601000005000000060b010000090101020000000c0000000b230200000000000d2701000000000004000000031a02000019010000160000000000000e0000000628020000200200001901000100000002000000010000000a0000000036040001160000000000000f2002000019010002000000010a0000041a02000019010003000000020a0000031a0200001901000400000010000000110000000922020000040200000a0000020a0004041d0200001901000510060105000000000b01000005010a0004010000260100000100000701000006000000000b02000030020000000000020000000129020000010000080000000322020000";

bytes constant RAINSTRING_CALCULATE_ORDER_BUY =
// Sushi needs the usdt amount as 6 decimals (tether's native size).
    "target-usdt-amount: decimal18-scale-n<6>(target-usdt-amount18),"
    // Try to average a 12 mins cooldown, so the max is 24 mins.
    "max-cooldown18: 2160e18,"
    // Seed the rng with the hash of the last time to make it distinct from the
    // amount random multiplier.
    "cooldown-random-multiplier18: call<2 1>(hash(last-time)),"
    // Calculate the cooldown for the order.
    "cooldown18: decimal18-mul(max-cooldown18 cooldown-random-multiplier18),"
    // Scale the cooldown to integer seconds.
    "cooldown: decimal18-scale-n<0>(cooldown18),"
    // Check all the addresses are correct.
    // - counterparty is approved.
    ":ensure<0>(equal-to(approved-counterparty actual-counterparty)),"
    // Check the cooldown.
    ":ensure<1>(less-than(int-add(last-time cooldown) block-timestamp())),"
    // Token out for uni is in for ob, and vice versa.
    // We want the timestamp as well as the nht amount that sushi will give us.
    // NHT is already 18 decimals, so we don't need to scale it.
    "last-price-timestamp nht-amount18: uniswap-v2-amount-out<1>(polygon-sushi-v2-factory target-usdt-amount usdt-token-address nht-token-address),"
    // Don't allow the price to change this block before this trade.
    ":ensure<6>(less-than(last-price-timestamp block-timestamp())),"
    // nht token address is the token in during a buy.
    ":ensure<7>(equal-to(context<3 0>() nht-token-address)),"
    // usdt token address is the token out during a buy.
    ":ensure<8>(equal-to(context<4 0>() usdt-token-address)),"
    // Order output max is the usdt amount as decimal 18.
    "order-output-max18: target-usdt-amount18,"
    // IO ratio is the nht amount from sushi divided by the usdt target.
    "io-ratio: decimal18-div(nht-amount18 order-output-max18)"
    // end calculate order
    ";";

bytes constant RAINSTRING_HANDLE_IO_BUY =
// context 4 4 is the vault outputs as absolute values.
// context 2 0 is the calculated output as decimal 18.
// USDT is the output which is decimal 6 natively so we need to scale it.
 ":ensure<9>(greater-than-or-equal-to(context<4 4>() decimal18-scale-n<6>(context<2 0>())));";

function rainstringBuy() pure returns (bytes memory) {
    return bytes.concat(
        RAINSTRING_PRELUDE, RAINSTRING_CALCULATE_ORDER_BUY, RAINSTRING_HANDLE_IO_BUY, RAINSTRING_JITTERY_BINOMIAL
    );
}

function expectedBinomialBuyConstants() pure returns (uint256[] memory constants) {
    constants = new uint256[](9);
    constants[0] = uint256(uint160(POLYGON_SUSHI_V2_FACTORY));
    constants[1] = uint256(uint160(address(POLYGON_NHT_TOKEN_ADDRESS)));
    constants[2] = uint256(uint160(address(POLYGON_USDT_TOKEN_ADDRESS)));
    constants[3] = uint256(uint160(APPROVED_COUNTERPARTY));
    constants[4] = MAX_USDT_18;
    constants[5] = MAX_COOLDOWN_18;
    constants[6] = 0;
    constants[7] = 1e18;
    constants[8] = 11e18;
}

bytes constant BUY_ROUTE =
//offset
    hex"0000000000000000000000000000000000000000000000000000000000000020"
    //stream length
    hex"0000000000000000000000000000000000000000000000000000000000000042"
    //command 2 = processUserERC20
    hex"02"
    //token address
    hex"c2132d05d31c914a87c6611c10748aeb04b58e8f"
    // number of pools
    hex"01"
    // pool share
    hex"ffff"
    // pool type
    hex"00"
    // pool address
    hex"e427b62b495c1dfe1fe9f78bebfceb877ad05dce"
    // direction 0
    hex"00"
    // to
    hex"b4ffa641e5dA49F7466142E8418622CB64dBe86B"
    // padding
    hex"000000000000000000000000000000000000000000000000000000000000";

bytes constant EXPECTED_BUY_BYTECODE =
    hex"03000000f001083b140013010000000100000101000002010000030a0002010a0000010000000534010000160000000000000535020000010000040000000609010102000000080000000723020000000000092701000601000005000000060b010000090101020000000c0000000b230200000000000d2701000000000004000000031a02000019010000160000000000000e0000000628020000200200001901000100000001000000020000000a0000000037040001160000000000000f2002000019010006000000010a0000031a02000019010007000000020a0000041a0200001901000800000009000000110000001022020000050200000a000002270100060a0004041d0200001901000910060105000000000b01000005010a0004010000260100000100000701000006000000000b02000030020000000000020000000129020000010000080000000322020000";

// SPDX-License-Identifier: CAL
pragma solidity =0.8.19;

import "src/interface/IERC20.sol";
import "src/interface/IOrderBookV3.sol";
import "src/interface/IOrderBookV3ArbOrderTaker.sol";
import {IUniswapV2Pair} from "rain.interpreter/lib/v2-core/contracts/interfaces/IUniswapV2Pair.sol";
import {RainterpreterExpressionDeployerNP} from "rain.interpreter/src/concrete/RainterpreterExpressionDeployerNP.sol";

// This could easily break, just happened to be some wallet that held NHT when
// I was writing this test.
address constant POLYGON_NHT_HOLDER = 0xe0e0Bb15Ad2dC19e5Eaa133968e498B4D9bF24Da;
// This could easily break, just happened to be some wallet that held USDT when
// I was writing this test.
address constant POLYGON_USDT_HOLDER = 0x72A53cDBBcc1b9efa39c834A540550e23463AAcB;

/// @dev https://docs.sushi.com/docs/Products/Classic%20AMM/Deployment%20Addresses
/// @dev https://polygonscan.com/address/0xc35DADB65012eC5796536bD9864eD8773aBc74C4
address constant POLYGON_SUSHI_V2_FACTORY = 0xc35DADB65012eC5796536bD9864eD8773aBc74C4;

/// @dev https://docs.sushi.com/docs/Products/Classic%20AMM/Deployment%20Addresses
address constant POLYGON_SUSHI_V2_ROUTER = 0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506;

/// @dev https://polygonscan.com/address/0x84342e932797FC62814189f01F0Fb05F52519708
IERC20 constant POLYGON_NHT_TOKEN_ADDRESS = IERC20(0x84342e932797FC62814189f01F0Fb05F52519708);

/// @dev https://polygonscan.com/address/0xc2132D05D31c914a87C6611C10748AEb04B58e8F
IERC20 constant POLYGON_USDT_TOKEN_ADDRESS = IERC20(0xc2132D05D31c914a87C6611C10748AEb04B58e8F);

IUniswapV2Pair constant POLYGON_NHT_USDT_PAIR_ADDRESS = IUniswapV2Pair(0xe427B62B495C1dFe1Fe9F78bEbFcEB877ad05DCE);
address constant POLYGON_PAIR_TOKEN_0 = address(POLYGON_NHT_TOKEN_ADDRESS);
address constant POLYGON_PAIR_TOKEN_1 = address(POLYGON_USDT_TOKEN_ADDRESS);

IOrderBookV3ArbOrderTaker constant POLYGON_ARB_CONTRACT =
    IOrderBookV3ArbOrderTaker(0xe5518dC11644413418dFba18E53876a645665981);

address constant APPROVED_EOA = 0x669845c29D9B1A64FFF66a55aA13EB4adB889a88;
address constant APPROVED_COUNTERPARTY = address(POLYGON_ARB_CONTRACT);

RainterpreterExpressionDeployerNP constant POLYGON_DEPLOYER =
    RainterpreterExpressionDeployerNP(0x808F049f53Ca70A2b8Ace4c117FFbec4ce77dE84);
address constant POLYGON_INTERPRETER = 0xBBE3275DCD2dF953362f6eC9dB1e44A9c9EF21F2;
address constant POLYGON_STORE = 0x97017811542bF3C4148847DC172d1a0F7e42342D;
IOrderBookV3 constant POLYGON_ORDERBOOK = IOrderBookV3(0x95C9Bf235435b660AA69F519904C3F175Aab393d);

address constant CLEARER = 0xf098172786a87FA7426eA811Ff25D31D599f766D;
address constant OB_FLASH_BORROWER = 0x409717e08DcA5fE40efdB05318FBF0E65762814D;

uint256 constant ORDER_INIT_TIME = 1693216509;

uint256 constant USDT_PER_SECOND = 13889;

uint256 constant MIN_USDT_AMOUNT = 50e6;
uint256 constant ONE_HOUR = 3600;
uint256 constant MAX_COOLDOWN = 2 * ONE_HOUR;

uint256 constant SELL_MULTIPLIER = 1e18;
uint256 constant BUY_MULTIPLIER = 999e15;

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
    "approved-counterparty: 0xe5518dC11644413418dFba18E53876a645665981,"
    // Actual counterparty.
    "actual-counterparty: context<1 2>(),"
    // Order hash.
    "order-hash: context<1 0>(),"
    // The last time is stored under the order hash, as there's only a single
    // value stored for this order.
    "last-time: get(order-hash),"
    // Set the last time to this block.
    ":set(order-hash block-timestamp()),"
    // Try to sell $50 worth of nht.
    // Set the max at $100 so that the binomial peak sits at $50.
    "max-usdt-amount18: 100e18,"
    // We can just seed the rng with last time.
    "amount-random-multiplier18: call<2 1>(last-time),"
    // Calculate the target usdt amount for the order, as decimal18.
    "target-usdt-amount18: decimal18-mul(max-usdt-amount18 amount-random-multiplier18),";

bytes constant RAINSTRING_CALCULATE_ORDER_SELL =
// Sushi needs the usdt amount as 6 decimals (tether's native size).
    "target-usdt-amount: decimal18-scale-n<6 1>(target-usdt-amount18),"
    // Try to average a 1 hour cooldown, so the max is 2 hours.
    "max-cooldown18: 7200e18,"
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

bytes constant EXPECTED_SELL_BYTECODE =
    hex"03000000f001043b140013010000000100000101000002010000030600020106000001000000052b0100000e000000000000052c02000001000004000000060501010200000008000000071b020000000000091e010106010000050000000607010000050101020000000c0000000b1b0200000000000d1e010000000000040000000312020000110100000e0000000000000e000000061f020000180200001101000100000002000000010000000a000000002d0400010e0000000000000f180200001101000200000001060000041202000011010003000000020600000312020000110100040000001000000011000000091a020000040200000600000206000404150200001101000510060105000000000701000003010a00020100001d010000010000070100000600000000070200002702000000000002000000012002000001000008000000031a020000";

bytes constant RAINSTRING_CALCULATE_ORDER_BUY =
// Sushi needs the usdt amount as 6 decimals (tether's native size).
    "target-usdt-amount: decimal18-scale-n<6>(target-usdt-amount18),"
    // Try to average a 1 hour cooldown, so the max is 2 hours.
    "max-cooldown18: 7200e18,"
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

bytes constant EXPECTED_BUY_BYTECODE =
    hex"03000000f001083b140013010000000100000101000002010000030600020106000001000000052b0100000e000000000000052c02000001000004000000060501010200000008000000071b020000000000091e010006010000050000000607010000050101020000000c0000000b1b0200000000000d1e010000000000040000000312020000110100000e0000000000000e000000061f020000180200001101000100000001000000020000000a000000002e0400010e0000000000000f180200001101000600000001060000031202000011010007000000020600000412020000110100080000000900000011000000101a02000005020000060000021e01000606000404150200001101000910060105000000000701000003010a00020100001d010000010000070100000600000000070200002702000000000002000000012002000001000008000000031a020000";

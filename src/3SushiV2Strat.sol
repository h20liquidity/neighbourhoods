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
    IOrderBookV3ArbOrderTaker(0xD1c3Df3b3c5a1059FC1a123562a7215a94F34876);

address constant APPROVED_EOA = 0x669845c29D9B1A64FFF66a55aA13EB4adB889a88;
address constant APPROVED_COUNTERPARTY = address(POLYGON_ARB_CONTRACT);

RainterpreterExpressionDeployerNP constant POLYGON_DEPLOYER =
    RainterpreterExpressionDeployerNP(0x2E4b43db4d4866016eF58D1F9641e835014B3bd5);
address constant POLYGON_INTERPRETER = 0x4B4D3b75209b7e4802F3b23cC09a036386bc1197;
address constant POLYGON_STORE = 0xB10bEb93858Be01eF856304645eBc7d7eC001Ec3;
IOrderBookV3 constant POLYGON_ORDERBOOK = IOrderBookV3(0xcE00CBCC5AeDfee3374d2a4d0e2a207Dc345E650);

address constant CLEARER = 0xf098172786a87FA7426eA811Ff25D31D599f766D;
address constant OB_FLASH_BORROWER = 0x409717e08DcA5fE40efdB05318FBF0E65762814D;

uint256 constant ORDER_INIT_TIME = 1693216509;

uint256 constant USDT_PER_SECOND = 13889;

uint256 constant MIN_USDT_AMOUNT = 50e6;
uint256 constant ONE_HOUR = 3600;

uint256 constant SELL_MULTIPLIER = 1e18;
uint256 constant BUY_MULTIPLIER = 999e15;

// Selling NHT for USDT => NHT is output and USDT is input.
bytes constant RAINSTRING_SELL_NHT =
// String version of factory address.
    "polygon-sushi-v2-factory: 0xc35DADB65012eC5796536bD9864eD8773aBc74C4,"
    // String version of nht token address.
    "nht-token-address: 0x84342e932797FC62814189f01F0Fb05F52519708,"
    // String version of usdt token address.
    "usdt-token-address: 0xc2132D05D31c914a87C6611C10748AEb04B58e8F,"
    // String version of approved counterparty.
    "approved-counterparty: 0xD1c3Df3b3c5a1059FC1a123562a7215a94F34876,"
    // actual counterparty is from context.
    "actual-counterparty: context<1 2>(),"
    // Check that
    ":ensure<0>("
    // - counterparty is approved.
    " equal-to(approved-counterparty actual-counterparty)"
    // - usdt token address is the token in to ob.
    " equal-to(context<3 0>() usdt-token-address)"
    // - nht token address is the token out from ob.
    " equal-to(context<4 0>() nht-token-address)"
    //
    "),"
    // Order hash.
    "order-hash: context<1 0>(),"
    // Try to sell $50 worth of nht.
    "target-usdt-amount: 50e6,"
    // Ensure a 1 hour cooldown.
    "last-time-key: hash(order-hash 1),"
    // Get the last time.
    "last-time: get(last-time-key),"
    // Ensure it is more than 3600 seconds ago.
    ":ensure<1>(less-than(int-add(last-time 3600) block-timestamp()))," ":set(last-time-key block-timestamp()),"
    // Token in for uniswap is ob's token out, and vice versa.
    // We want the timestamp as well as the nht amount that sushi wants in.
    "last-price-timestamp nht-amount: uniswap-v2-amount-in<1>(polygon-sushi-v2-factory target-usdt-amount nht-token-address usdt-token-address),"
    // Don't allow the price to change this block before this trade.
    ":ensure<1>(less-than(last-price-timestamp block-timestamp()))," "order-output-max: nht-amount,"
    "io-ratio: decimal18-div(decimal18-scale18<6>(target-usdt-amount) order-output-max)"
    // end calculate order
    ";"
    // Ensure that we bought at least $50 worth of usdt.
    ":ensure<2>(greater-than-or-equal-to(context<3 4>() 50e6))"
    // end handle io
    ";";

bytes constant EXPECTED_SELL_BYTECODE =
    hex"02000000b82d0e000d010000000100000101000002010000030400020100000001040000040e02000000000002040000030e02000000000004000000030e0200000d030000040000010100000401000005000000050502000000000007270100000a00000001000006000000081b020000140200000d0100010a000000000000072802000000000002000000010000000600000000290400010a00000000000009140200000d0100010000000a0000000b000000061901000616020000040200000100000404000403110200000d010002";

bytes constant EXPECTED_SELL_BYTECODE_FORK =
    hex"02000000b82d0e000d010000000100000101000002010000030400020100000001040000040e02000000000002040000030e02000000000004000000030e0200000d030000040000010100000401000005000000050502000000000007270100000a00000001000006000000081b020000140200000d0100010a000000000000072802000000000002000000010000000600000000290400010a00000000000009140200000d0100010000000a0000000b000000061901000616020000040200000100000404000403110200000d010002";

bytes constant RAINSTRING_BUY_NHT =
// String version of factory address.
    "polygon-sushi-v2-factory: 0xc35DADB65012eC5796536bD9864eD8773aBc74C4,"
    // String version of nht token address.
    "nht-token-address: 0x84342e932797FC62814189f01F0Fb05F52519708,"
    // String version of usdt token address.
    "usdt-token-address: 0xc2132D05D31c914a87C6611C10748AEb04B58e8F,"
    // String version of approved counterparty.
    "approved-counterparty: 0xD1c3Df3b3c5a1059FC1a123562a7215a94F34876,"
    // actual counterparty is from context
    "actual-counterparty: context<1 2>(),"
    // Check that
    ":ensure<0>("
    // - counterparty is approved.
    " equal-to(approved-counterparty actual-counterparty)"
    // - nht token address is the token in to ob.
    " equal-to(context<3 0>() nht-token-address)"
    // - usdt token address is the token out from ob.
    " equal-to(context<4 0>() usdt-token-address)"
    //
    "),"
    // Order hash.
    "order-hash: context<1 0>(),"
    // Try to buy $50 worth of nht.
    "target-usdt-amount: 50e6,"
    // Ensure a 1 hour cooldown.
    "last-time-key: hash(order-hash 1),"
    // Get the last time.
    "last-time: get(last-time-key),"
    // Ensure it is more than 3600 seconds ago.
    ":ensure<1>(less-than(int-add(last-time 3600) block-timestamp())),"
    // Set the new cooldown to start now.
    ":set(last-time-key block-timestamp()),"
    // Token out for uni is in for ob, and vice versa.
    "last-price-timestamp max-nht-amount: uniswap-v2-amount-out<1>(polygon-sushi-v2-factory target-usdt-amount usdt-token-address nht-token-address),"
    // Don't allow the price to change this block before this trade.
    ":ensure<2>(less-than(last-price-timestamp block-timestamp())),"
    "order-output-max: decimal18-scale18<6>(target-usdt-amount),"
    "io-ratio: decimal18-div(max-nht-amount order-output-max)"
    //
    ";"
    // Ensure that we sold at least $50 worth of usdt.
    ":ensure<3>(greater-than-or-equal-to(context<4 4>() 50e6))"
    // ;
    ";";

bytes constant EXPECTED_BUY_BYTECODE =
    hex"02000000b82d0e000d010000000100000101000002010000030400020100000002040000040e02000000000001040000030e02000000000004000000030e0200000d030000040000010100000401000005000000050502000000000007270100000a00000001000006000000081b020000140200000d0100010a0000000000000728020000000000010000000200000006000000002a0400010a00000000000009140200000d01000200000006190100060000000b0000000a16020000040200000100000404000404110200000d010003";

bytes constant EXPECTED_BUY_BYTECODE_FORK =
    hex"02000000b82d0e000d010000000100000101000002010000030400020100000002040000040e02000000000001040000030e02000000000004000000030e0200000d030000040000010100000401000005000000050502000000000007270100000a00000001000006000000081b020000140200000d0100010a0000000000000728020000000000010000000200000006000000002a0400010a00000000000009140200000d01000200000006190100060000000b0000000a16020000040200000100000404000404110200000d010003";

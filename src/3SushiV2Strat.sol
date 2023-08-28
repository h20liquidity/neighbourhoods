// SPDX-License-Identifier: CAL
pragma solidity =0.8.19;

import "src/interface/IERC20.sol";
import "src/interface/IOrderBookV3.sol";
import "src/interface/IOrderBookV3ArbOrderTaker.sol";
import {RainterpreterExpressionDeployerNP} from "rain.interpreter/src/concrete/RainterpreterExpressionDeployerNP.sol";

/// @dev https://docs.sushi.com/docs/Products/Classic%20AMM/Deployment%20Addresses
/// @dev https://polygonscan.com/address/0xc35DADB65012eC5796536bD9864eD8773aBc74C4
address constant POLYGON_SUSHI_V2_FACTORY = 0xc35DADB65012eC5796536bD9864eD8773aBc74C4;

/// @dev https://polygonscan.com/address/0x84342e932797FC62814189f01F0Fb05F52519708
IERC20 constant POLYGON_NHT_TOKEN_ADDRESS = IERC20(0x84342e932797FC62814189f01F0Fb05F52519708);

/// @dev https://polygonscan.com/address/0xc2132D05D31c914a87C6611C10748AEb04B58e8F
IERC20 constant POLYGON_USDT_TOKEN_ADDRESS = IERC20(0xc2132D05D31c914a87C6611C10748AEb04B58e8F);

IOrderBookV3ArbOrderTaker constant POLYGON_ARB_CONTRACT = IOrderBookV3ArbOrderTaker(0x409717e08DcA5fE40efdB05318FBF0E65762814D);

address constant APPROVED_EOA = 0x1F8Cd7FB14b6930665EaaA5F5C71b9e7396df036;
address constant APPROVED_COUNTERPARTY = address(POLYGON_ARB_CONTRACT);


RainterpreterExpressionDeployerNP constant POLYGON_DEPLOYER =
    RainterpreterExpressionDeployerNP(0x386d79440e3fe32BdFb0120034Fb21971151E90f);
address constant POLYGON_INTERPRETER = 0x31fE050009Dc0cAb68fFe3a65A0A466F60bE6c5D;
address constant POLYGON_STORE = 0xc71541cc0684A3ccC86EdA6aFc4a456140130fbD;
IOrderBookV3 constant POLYGON_ORDERBOOK = IOrderBookV3(0x49266c03f3E223657feC33159511d346fe8B2429);
address constant CLEARER = 0xf098172786a87FA7426eA811Ff25D31D599f766D;
address constant OB_FLASH_BORROWER = 0x409717e08DcA5fE40efdB05318FBF0E65762814D;

uint256 constant ORDER_INIT_TIME = 1692775491;

uint256 constant USDT_PER_SECOND = 13889;

uint256 constant MIN_USDT_AMOUNT = 50e6;

uint256 constant SELL_MULTIPLIER = 101e16;
uint256 constant BUY_MULTIPLIER = 99e16;

// Selling NHT for USDT => NHT is output and USDT is input.
bytes constant RAINSTRING_SELL_NHT =
// String version of factory address.
    "polygon-sushi-v2-factory: 0xc35DADB65012eC5796536bD9864eD8773aBc74C4,"
    // String version of nht token address.
    "nht-token-address: 0x84342e932797FC62814189f01F0Fb05F52519708,"
    // String version of usdt token address.
    "usdt-token-address: 0xc2132D05D31c914a87C6611C10748AEb04B58e8F,"
    // String version of approved counterparty.
    "approved-counterparty: 0x409717e08DcA5fE40efdB05318FBF0E65762814D,"
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
    // Figure out when the order started.
    "order-init-time: 1692775491,"
    // We sell $50 worth of nht for usdt per hour.
    // 50e6 is $50 in usdt.
    // 50e6 / 3600 is $50 per hour.
    "usdt-per-second: 13889,"
    // total time is now - init.
    "total-time: int-sub(block-timestamp() order-init-time)," "max-usdt-amount: int-mul(total-time usdt-per-second),"
    // lookup the current usdt amount.
    "current-usdt-amount-key: hash(order-hash 1)," "current-usdt-amount: get(current-usdt-amount-key),"
    "target-usdt-amount: int-sub(max-usdt-amount current-usdt-amount),"
    // Token in for uniswap is ob's token out, and vice versa.
    // We want the timestamp as well as the nht amount that sushi wants in.
    "last-price-timestamp nht-amount: uniswap-v2-amount-in<1>(polygon-sushi-v2-factory target-usdt-amount nht-token-address usdt-token-address),"
    // Don't allow the price to change this block before this trade.
    ":ensure<1>(less-than(last-price-timestamp block-timestamp())),"
    // We want to sell a little more nht amount than sushi sets as the minimum
    // to give some leeway for the arb bot.
    "order-output-max: decimal18-mul(nht-amount 101e16),"
    "io-ratio: decimal18-div(decimal18-scale18<6>(target-usdt-amount) order-output-max)"
    // end calculate order
    ";"
    // Record the amount of usdt we bought.
    "usdt-diff: context<3 4>(),"
    // order hash is same as calculate io
    "order-hash: context<1 0>(),"
    // current usdt amount key is same as calculate io
    "current-usdt-amount-key: hash(order-hash 1),"
    ":set(current-usdt-amount-key int-add(get(current-usdt-amount-key) usdt-diff)),"
    // Ensure that we bought at least $50 worth of usdt.
    ":ensure<2>(greater-than(usdt-diff 50e6))"
    // end handle io
    ";";

bytes constant EXPECTED_SELL_BYTECODE =
// 2 sources
    hex"02"
    // 0 offset
    hex"0000"
    // 196 offset (48 ops + 4 byte header)
    hex"00c4"
    // source 0
    // 48 ops
    hex"30"
    // 18 stack allocation
    hex"12"
    // 0 inputs
    hex"00"
    // 17 outputs
    hex"11"
    // constant 0 (sushi factory)
    hex"01000000"
    // constant 1 (nht token address)
    hex"01000001"
    // constant 2 (usdt token address)
    hex"01000002"
    // constant 3 (approved counterparty)
    hex"01000003"
    // context 1 2 (actual counterparty)
    hex"02000201"
    // stack 1 (nht token address)
    hex"00000001"
    // context 4 0 (output token address)
    hex"02000004"
    // equal to (2 inputs)
    hex"0c020000"
    // stack 2 (usdt token address)
    hex"00000002"
    // context 3 0 (input token address)
    hex"02000003"
    // equal to (2 inputs)
    hex"0c020000"
    // stack 4 (actual counterparty)
    hex"00000004"
    // stack 3 (approved counterparty)
    hex"00000003"
    // equal to (2 inputs)
    hex"0c020000"
    // ensure (3 inputs, 0 error code)
    hex"0b030000"
    //context 1 0 (order hash)
    hex"02000001"
    // constant 4 (order init time)
    hex"01000004"
    // constant 5 (usdt per second)
    hex"01000005"
    // stack 6 (order init time)
    hex"00000006"
    // block timestamp
    hex"08000000"
    // int sub (2 inputs)
    hex"23020000"
    // stack 7 (usdt per second)
    hex"00000007"
    // stack 8 (total time)
    hex"00000008"
    // int mul (2 inputs)
    hex"22020000"
    // constant 6 (1)
    hex"01000006"
    // stack 5 (order hash)
    hex"00000005"
    // hash (2 inputs)
    hex"03020000"
    // stack 10 (current usdt amount key)
    hex"0000000a"
    // get (1 input)
    hex"25010000"
    // stack 11 (current usdt amount)
    hex"0000000b"
    // stack 9 (max usdt amount)
    hex"00000009"
    // int sub (2 inputs)
    hex"23020000"
    // stack 2 (usdt token address)
    hex"00000002"
    // stack 1 (nht token address)
    hex"00000001"
    // stack 12 (target usdt amount)
    hex"0000000c"
    // stack 0 (sushi factory)
    hex"00000000"
    // uniswap v2 amount in (4 inputs + with timestamp)
    hex"27040001"
    // block timestamp
    hex"08000000"
    // stack 13 (last price timestamp)
    hex"0000000d"
    // less than (2 inputs)
    hex"12020000"
    // ensure (1 input, 1 error code)
    hex"0b010001"
    // constant 7 (101e16)
    hex"01000007"
    // stack 14 (nht amount)
    hex"0000000e"
    // decimal18 mul (2 inputs)
    hex"15020000"
    // stack 15 (order output max)
    hex"0000000f"
    // stack 12 (target usdt amount)
    hex"0000000c"
    // decimal18 scale18 (1 input + scale 6 + round down + no saturate)
    hex"17010006"
    // decimal18 div (2 inputs)
    hex"14020000"
    // source 1
    // 15 ops
    hex"0f"
    // 5 stack allocation
    hex"05"
    // 0 inputs
    hex"00"
    // 3 outputs
    hex"03"
    // context 3 4 (input/usdt diff)
    hex"02000403"
    // context 1 0 (order hash)
    hex"02000001"
    // constant 6 (1)
    hex"01000006"
    // stack 1 (order hash)
    hex"00000001"
    // hash (2 inputs)
    hex"03020000"
    // stack 0 (usdt diff)
    hex"00000000"
    // stack 2 (current usdt amount key)
    hex"00000002"
    // get (1 input)
    hex"25010000"
    // int add (2 inputs)
    hex"19020000"
    // stack 2 (current usdt amount key)
    hex"00000002"
    // set (2 inputs)
    hex"26020000"
    // constant 8 (50e6)
    hex"01000008"
    // stack 0 (usdt diff)
    hex"00000000"
    // greater than (2 inputs)
    hex"0e020000"
    // ensure (1 input, 2 error code)
    hex"0b010002";

bytes constant RAINSTRING_BUY_NHT =
// String version of factory address.
    "polygon-sushi-v2-factory: 0xc35DADB65012eC5796536bD9864eD8773aBc74C4,"
    // String version of nht token address.
    "nht-token-address: 0x84342e932797FC62814189f01F0Fb05F52519708,"
    // String version of usdt token address.
    "usdt-token-address: 0xc2132D05D31c914a87C6611C10748AEb04B58e8F,"
    // String version of approved counterparty.
    "approved-counterparty: 0x409717e08DcA5fE40efdB05318FBF0E65762814D,"
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
    // Figure out when the order started.
    "order-init-time: 1692775491,"
    // We buy $50 worth of nht for usdt per hour.
    // 50e6 is $50 in usdt.
    // 50e6 / 3600 is $50 per hour.
    "usdt-per-second: 13889,"
    // total time is now - init.
    "total-time: int-sub(block-timestamp() order-init-time)," "max-usdt-amount: int-mul(total-time usdt-per-second),"
    // lookup the current usdt amount.
    "current-usdt-amount-key: hash(order-hash 1)," "current-usdt-amount: get(current-usdt-amount-key),"
    "target-usdt-amount: int-sub(max-usdt-amount current-usdt-amount),"
    // Token out from uniswap is ob's token in, and vice versa.
    // We want the timestamp as well as the nht amount that sushi wants in.
    "last-price-timestamp max-nht-amount: uniswap-v2-amount-out<1>(polygon-sushi-v2-factory target-usdt-amount usdt-token-address nht-token-address),"
    // Don't allow the price to change this block before this trade.
    ":ensure<1>(less-than(last-price-timestamp block-timestamp())),"
    // We want to buy a little less nht amount than sushi sets as the maximum
    // to give some leeway for the arb bot.
    "actual-nht-amount: decimal18-mul(max-nht-amount 99e16),"
    "order-output-max: decimal18-scale18<6>(target-usdt-amount),"
    "io-ratio: decimal18-div(actual-nht-amount order-output-max)"
    //
    ";"
    // Record the amount of usdt we sold.
    "usdt-diff: context<4 4>(),"
    // order hash is same as calculate io
    "order-hash: context<1 0>(),"
    // current usdt amount key is same as calculate io
    "current-usdt-amount-key: hash(order-hash 1),"
    ":set(current-usdt-amount-key int-add(get(current-usdt-amount-key) usdt-diff)),"
    // Ensure that we sold at least $50 worth of usdt.
    ":ensure<2>(greater-than(usdt-diff 50e6))"
    // ;
    ";";

bytes constant EXPECTED_BUY_BYTECODE =
    // 2 sources
    hex"02"
    // 0 offset
    hex"0000"
    // 200 offset (49 ops + 4 byte header)
    hex"00c8"
    // source 0
    // 49 ops
    hex"31"
    // 19 stack allocation
    hex"13"
    // 0 inputs
    hex"00"
    // 18 outputs
    hex"12"
    // constant 0 (sushi factory)
    hex"01000000"
    // constant 1 (nht token address)
    hex"01000001"
    // constant 2 (usdt token address)
    hex"01000002"
    // constant 3 (approved counterparty)
    hex"01000003"
    // context 1 2 (actual counterparty)
    hex"02000201"
    // stack 2 (usdt token address)
    hex"00000002"
    // context 4 0 (output token address)
    hex"02000004"
    // equal to (2 inputs)
    hex"0c020000"
    // stack 1 (nht token address)
    hex"00000001"
    // context 3 0 (input token address)
    hex"02000003"
    // equal to (2 inputs)
    hex"0c020000"
    // stack 4 (actual counterparty)
    hex"00000004"
    // stack 3 (approved counterparty)
    hex"00000003"
    // equal to (2 inputs)
    hex"0c020000"
    // ensure (3 inputs, 0 error code)
    hex"0b030000"
    //context 1 0 (order hash)
    hex"02000001"
    // constant 4 (order init time)
    hex"01000004"
    // constant 5 (usdt per second)
    hex"01000005"
    // stack 6 (order init time)
    hex"00000006"
    // block timestamp
    hex"08000000"
    // int sub (2 inputs)
    hex"23020000"
    // stack 7 (usdt per second)
    hex"00000007"
    // stack 8 (total time)
    hex"00000008"
    // int mul (2 inputs)
    hex"22020000"
    // constant 6 (1)
    hex"01000006"
    // stack 5 (order hash)
    hex"00000005"
    // hash (2 inputs)
    hex"03020000"
    // stack 10 (current usdt amount key)
    hex"0000000a"
    // get (1 input)
    hex"25010000"
    // stack 11 (current usdt amount)
    hex"0000000b"
    // stack 9 (max usdt amount)
    hex"00000009"
    // int sub (2 inputs)
    hex"23020000"
    // stack 1 (nht token address)
    hex"00000001"
    // stack 2 (usdt token address)
    hex"00000002"
    // stack 12 (target usdt amount)
    hex"0000000c"
    // stack 0 (sushi factory)
    hex"00000000"
    // uniswap v2 amount out (4 inputs + with timestamp)
    hex"28040001"
    // block timestamp
    hex"08000000"
    // stack 13 (last price timestamp)
    hex"0000000d"
    // less than (2 inputs)
    hex"12020000"
    // ensure (1 input, 1 error code)
    hex"0b010001"
    // constant 7 (99e16)
    hex"01000007"
    // stack 14 (max nht amount)
    hex"0000000e"
    // decimal18 mul (2 inputs)
    hex"15020000"
    // stack 12 (target usdt amount)
    hex"0000000c"
    // decimal18 scale18 (1 input + scale 6 + round down + no saturate)
    hex"17010006"
    // stack 16 (order output max)
    hex"00000010"
    // stack 15 (actual nht amount)
    hex"0000000f"
    // decimal18 div (2 inputs)
    hex"14020000"
    // source 1
    // 15 ops
    hex"0f"
    // 5 stack allocation
    hex"05"
    // 0 inputs
    hex"00"
    // 3 outputs
    hex"03"
    // context 4 4 (usdt diff)
    hex"02000404"
    // context 1 0 (order hash)
    hex"02000001"
    // constant 6 (1)
    hex"01000006"
    // stack 1 (order hash)
    hex"00000001"
    // hash (2 inputs)
    hex"03020000"
    // stack 0 (usdt diff)
    hex"00000000"
    // stack 2 (current usdt amount key)
    hex"00000002"
    // get (1 input)
    hex"25010000"
    // int add (2 inputs)
    hex"19020000"
    // stack 2 (current usdt amount key)
    hex"00000002"
    // set (2 inputs)
    hex"26020000"
    // constant 8 (50e6)
    hex"01000008"
    // stack 0 (usdt diff)
    hex"00000000"
    // greater than (2 inputs)
    hex"0e020000"
    // ensure (1 input, 0 error code)
    hex"0b010002";

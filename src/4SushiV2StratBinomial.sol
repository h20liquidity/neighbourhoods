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
    IOrderBookV3ArbOrderTaker(0xD709Bc4c77929C4d9900cB275769Ed9C68716bde);

address constant APPROVED_EOA = 0x669845c29D9B1A64FFF66a55aA13EB4adB889a88;
address constant APPROVED_COUNTERPARTY = address(POLYGON_ARB_CONTRACT);

RainterpreterExpressionDeployerNP constant POLYGON_DEPLOYER =
    RainterpreterExpressionDeployerNP(0x2E4b43db4d4866016eF58D1F9641e835014B3bd5);
address constant POLYGON_INTERPRETER = 0xbCA2CeE3E3Cb149eB72324E358E5355974e5fCf3;
address constant POLYGON_STORE = 0x5f5F282b30177e9fAfC3C1ea25Eb605512029F2a;
IOrderBookV3 constant POLYGON_ORDERBOOK = IOrderBookV3(0xcE00CBCC5AeDfee3374d2a4d0e2a207Dc345E650);
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
    // The binomial part is using ctpop over a hash to simulate 256 coin flips.
    "binomial: bitwise-count-ones(hash(input)),"
    // Rescale the binomial to 18 decimal fixed point so we can easily add some
    // noise to it with a simple mod of a hash.
    "binomial18: decimal18-scale18<0>(binomial),"
    // Generate some noise for the binomial. The noise is a number between 0 and
    // 1e18. Ensure that we use a different seed for the noise than the binomial
    // by concatenating 0 to the seed.
    "noise18: int-mod(hash(input 0) 1e18),"
    // Add the noise to the binomial, subtracting 0.5 to ensure that the noise
    // is centred around the binomial value. This will underflow if the binomial
    // is 0, but that's only possible if the hash of the seed is `0` which is
    // somewhat unlikely.
    "jittery-binomial18: decimal18-sub(decimal18-add(binomial18 noise18) 5e17),"
    // The jittery binomial is a number between 0 and 256e18. We want a number
    // between 0 and 1e18, so we divide by 256. As above, technically this will
    // produce a value outside this range if the hash of the input is
    // `type(256).max`, which is just as unlikely as the hash of the input being
    // `0`.
    "output: decimal18-div(jittery-binomial18 256e18);";

bytes constant RAINSTRING_PRELUDE =
// Sushi v2 factory address.
    "polygon-sushi-v2-factory: 0xc35DADB65012eC5796536bD9864eD8773aBc74C4,"
    // NHT token address.
    "nht-token-address: 0x84342e932797FC62814189f01F0Fb05F52519708,"
    // USDT token address.
    "usdt-token-address: 0xc2132D05D31c914a87C6611C10748AEb04B58e8F,"
    // Approved counterparty.
    "approved-counterparty: 0xD709Bc4c77929C4d9900cB275769Ed9C68716bde,"
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
    "target-usdt-amount18: decimal18-mul(max-usdt-amount18 amount-random-multiplier18),"
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
    ":ensure<1>(less-than(int-add(last-time cooldown) block-timestamp())),";

bytes constant RAINSTRING_CALCULATE_ORDER_SELL =
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

bytes constant EXPECTED_SELL_BYTECODE = hex"03000000f001043b14001301000000010000010100000201000003040002010400000100000005270100000a0000000000000528020000010000040000000603010102000000080000000717020000000000091a010006010000050000000605010000030101020000000c0000000b170200000000000d1a01000000000004000000030e0200000d0100000a0000000000000e000000061b020000140200000d01000100000002000000010000000a00000000290400010a0000000000000f140200000d01000200000001040000040e0200000d01000300000002040000030e0200000d01000400000010000000110000000916020000040200000400000204000404110200000d01000512070106000000000501000002010000000000011901000001000007010000060000000005020000230200000100000800000003000000021c02000026020000010000090000000416020000";

bytes constant RAINSTRING_CALCULATE_ORDER_BUY =
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
    "io-ratio: decimal18-div(nht-amount18 order-output-max18),"
    // end calculate order
    ";";

bytes constant RAINSTRING_HANDLE_IO_BUY =
// context 4 4 is the vault outputs as absolute values.
// context 2 0 is the calculated output as decimal 18.
// USDT is the output which is decimal 6 natively so we need to scale it.
 ":ensure<9>(greater-than-or-equal-to(context<4 4>() decimal18-scalen<6>(context<2 0>())));";

function rainstringBuy() pure returns (bytes memory) {
    return bytes.concat(
        RAINSTRING_PRELUDE, RAINSTRING_CALCULATE_ORDER_BUY, RAINSTRING_HANDLE_IO_BUY, RAINSTRING_JITTERY_BINOMIAL
    );
}

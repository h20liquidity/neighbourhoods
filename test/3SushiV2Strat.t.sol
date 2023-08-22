// SPDX-License-Identifier: CAL
pragma solidity =0.8.19;

import "rain.interpreter/../test/util/abstract/OpTest.sol";

/// @dev https://docs.sushi.com/docs/Products/Classic%20AMM/Deployment%20Addresses
/// @dev https://polygonscan.com/address/0xc35DADB65012eC5796536bD9864eD8773aBc74C4
address constant POLYGON_SUSHI_V2_FACTORY = 0xc35DADB65012eC5796536bD9864eD8773aBc74C4;

/// @dev https://polygonscan.com/address/0x84342e932797FC62814189f01F0Fb05F52519708
address constant POLYGON_NHT_TOKEN_ADDRESS = 0x84342e932797FC62814189f01F0Fb05F52519708;

/// @dev https://polygonscan.com/address/0xc2132D05D31c914a87C6611C10748AEb04B58e8F
address constant USDT_TOKEN_ADDRESS = 0xc2132D05D31c914a87C6611C10748AEb04B58e8F;

address constant APPROVED_COUNTERPARTY = 0x1F8Cd7FB14b6930665EaaA5F5C71b9e7396df036;

bytes constant RAINSTRING =
// String version of factory address.
    "polygon-sushi-v2-factory: 0xc35DADB65012eC5796536bD9864eD8773aBc74C4,"
    // String version of nht token address.
    "polygon-nht-token-address: 0x84342e932797FC62814189f01F0Fb05F52519708,"
    // String version of usdt token address.
    "usdt-token-address: 0xc2132D05D31c914a87C6611C10748AEb04B58e8F,"
    // String version of approved counterparty.
    "approved-counterparty: 0x1F8Cd7FB14b6930665EaaA5F5C71b9e7396df036,"
    "actual-counterparty: context<1 2>(),"
    // Check that the counterparty is approved.
    ":ensure(equal-to(approved-counterparty actual-counterparty)),"
    // Order hash.
    "order-hash: context<1 0>(),"
    // Figure out when the order started.
    "order-init-time-key: hash(order-hash 0),"
    "order-init-time: any(get(order-init-time-key) block-timestamp()),"
    ":set(order-init-time-key order-init-time),"
    // We want the timestamp as well as the nht amount that sushi wants in.
    "last-price-timestamp nht-amount-in: uniswap-v2-amount-in<1>(polygon-sushi-v2-factory 50e6"
    " 0x84342e932797FC62814189f01F0Fb05F52519708" " 0xc2132D05D31c914a87C6611C10748AEb04B58e8F" ");";

contract Test3SushiV2Strat is OpTest {
    function testStratHappyPath() public {
        uint256 reserveIn = 53138576564435538694955386;
        // Using USDT as an example.
        address tokenOut = address(0xc2132D05D31c914a87C6611C10748AEb04B58e8F);
        uint256 reserveOut = 12270399039;

        uint32 reserveTimestamp = 1624291200;

        address expectedPair =
            LibUniswapV2.pairFor(POLYGON_SUSHI_V2_FACTORY, POLYGON_NHT_TOKEN_ADDRESS, USDT_TOKEN_ADDRESS);
        vm.mockCall(
            expectedPair,
            abi.encodeWithSelector(IUniswapV2Pair.getReserves.selector),
            abi.encode(reserveIn, reserveOut, reserveTimestamp)
        );
        (uint256[] memory stack, uint256[] memory kvs) = parseAndEval(RAINSTRING);

        assertEq(stack.length, 5);
        assertEq(stack[0], uint256(uint160(POLYGON_SUSHI_V2_FACTORY)));
        assertEq(stack[1], uint256(uint160(POLYGON_NHT_TOKEN_ADDRESS)));
        assertEq(stack[2], uint256(uint160(USDT_TOKEN_ADDRESS)));
        assertEq(stack[3], reserveTimestamp);
        assertEq(stack[4], 218071733215424131376675);
    }
}

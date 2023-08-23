// SPDX-License-Identifier: CAL
pragma solidity =0.8.19;

import "rain.interpreter/test/util/abstract/OpTest.sol";

import "src/3SushiV2Strat.sol";

// bytes constant RAINSTRING =
//     // String version of factory address.
//     "polygon-sushi-v2-factory: 0xc35DADB65012eC5796536bD9864eD8773aBc74C4,"

//     // String version of nht token address.
//     "polygon-nht-token-address: 0x84342e932797FC62814189f01F0Fb05F52519708,"

//     // String version of usdt token address.
//     "usdt-token-address: 0xc2132D05D31c914a87C6611C10748AEb04B58e8F,"

//     // String version of approved counterparty.
//     "approved-counterparty: 0x1F8Cd7FB14b6930665EaaA5F5C71b9e7396df036,"
//     "actual-counterparty: context<1 2>(),"

//     // Check that
//     // - counterparty is approved.
//     // - usdt token address is the token in to ob.
//     // - nht token address is the token out from ob.
//     ":ensure("
//     " equal-to(approved-counterparty actual-counterparty)"
//     " equal-to(context<3 0>() usdt-token-address)"
//     " equal-to(context<4 0>() polygon-nht-token-address)"
//     "),"

//     // Order hash.
//     "order-hash: context<1 0>(),"

//     // Figure out when the order started.
//     "order-init-time-key: hash(order-hash 0),"
//     "order-init-time: any(get(order-init-time-key) block-timestamp()),"
//     ":set(order-init-time-key order-init-time),"

//     // We sell $50 worth of nht for usdt per hour.
//     // 50e6 is $50 in usdt.
//     // 50e6 / 3600 is $50 per hour.
//     "usdt-per-second: 13889,"

//     // We want the timestamp as well as the nht amount that sushi wants in.
//     "last-price-timestamp nht-amount-in: uniswap-v2-amount-in<1>(polygon-sushi-v2-factory 50e6"
//     // " 0x84342e932797FC62814189f01F0Fb05F52519708" " 0xc2132D05D31c914a87C6611C10748AEb04B58e8F" ")"
//     ";";

contract Test3SushiV2Strat is OpTest {
    function parseAndEvalWithContext(bytes memory rainString, uint256[][] memory context)
        internal
        returns (uint256[] memory, uint256[] memory)
    {
        IInterpreterV1 interpreterDeployer;
        IInterpreterStoreV1 storeDeployer;
        address expression;
        {
            (bytes memory bytecode, uint256[] memory constants) = iDeployer.parse(rainString);
            uint256[] memory minOutputs = new uint256[](1);
            minOutputs[0] = 0;
            (interpreterDeployer, storeDeployer, expression) =
                iDeployer.deployExpression(bytecode, constants, minOutputs);
        }

        (uint256[] memory stack, uint256[] memory kvs) = interpreterDeployer.eval(
            storeDeployer,
            StateNamespace.wrap(0),
            LibEncodedDispatch.encode(expression, SourceIndex.wrap(0), type(uint16).max),
            LibContext.build(context, new SignedContextV1[](0))
        );
        return (stack, kvs);
    }

    function testStratSellNHTHappyPath(uint256 orderHash) public {
        uint256 reserve0 = 53138576564435538694955386;
        // Using USDT as an example.
        // address tokenOut = address(0xc2132D05D31c914a87C6611C10748AEb04B58e8F);
        uint256 reserve1 = 12270399039;

        uint32 reserveTimestamp = 1692775490;

        uint256[][] memory context = new uint256[][](4);
        {
            uint256[] memory callingContext = new uint256[](3);
            // order hash
            callingContext[0] = orderHash;
            // owner
            callingContext[1] = uint256(uint160(address(this)));
            // counterparty
            callingContext[2] = uint256(uint160(APPROVED_COUNTERPARTY));
            context[0] = callingContext;
        }
        {
            uint256[] memory calculationsContext = new uint256[](0);
            context[1] = calculationsContext;
        }
        {
            uint256[] memory inputsContext = new uint256[](2);
            inputsContext[0] = uint256(uint160(USDT_TOKEN_ADDRESS));
            context[2] = inputsContext;
        }
        {
            uint256[] memory outputsContext = new uint256[](2);
            outputsContext[0] = uint256(uint160(POLYGON_NHT_TOKEN_ADDRESS));
            context[3] = outputsContext;
        }

        address expectedPair =
            LibUniswapV2.pairFor(POLYGON_SUSHI_V2_FACTORY, POLYGON_NHT_TOKEN_ADDRESS, USDT_TOKEN_ADDRESS);
        vm.mockCall(
            expectedPair,
            abi.encodeWithSelector(IUniswapV2Pair.getReserves.selector),
            abi.encode(reserve0, reserve1, reserveTimestamp)
        );

        uint256 orderInitTime = 1692775491;
        vm.warp(orderInitTime + 100);

        (uint256[] memory stack, uint256[] memory kvs) = parseAndEvalWithContext(RAINSTRING_SELL_NHT, context);

        uint256 currentUsdtAmountKey = uint256(keccak256(abi.encodePacked(orderHash, uint256(1))));

        assertEq(kvs.length, 2);
        kvs[0] = currentUsdtAmountKey;
        kvs[1] = 0;

        assertEq(stack.length, 17);
        // addresses.
        assertEq(stack[0], uint256(uint160(POLYGON_SUSHI_V2_FACTORY)));
        assertEq(stack[1], uint256(uint160(POLYGON_NHT_TOKEN_ADDRESS)));
        assertEq(stack[2], uint256(uint160(USDT_TOKEN_ADDRESS)));

        // approved counterparty.
        assertEq(stack[3], uint256(uint160(APPROVED_COUNTERPARTY)));
        // // actual counterparty.
        assertEq(stack[4], uint256(uint160(APPROVED_COUNTERPARTY)));

        // order hash.
        assertEq(stack[5], orderHash);
        // order init time.
        assertEq(stack[6], orderInitTime);

        // usdt per second.
        assertEq(stack[7], 13889);
        // total time is 100.
        assertEq(stack[8], 100);
        // max usdt amount.
        assertEq(stack[9], 1388900);
        // current usdt amount key.
        assertEq(stack[10], currentUsdtAmountKey);
        assertEq(stack[11], 0);
        // target usdt amount.
        assertEq(stack[12], 1388900);
        // last price timestamp.
        assertEq(stack[13], reserveTimestamp);
        // nht amount out from ob.
        assertEq(stack[14], 6033595774628543173862);
        // order output max.
        assertEq(stack[15], uint256(uint256(6033595774628543173862) * uint256(1001) / uint256(1000)));
        // // io ratio.
        assertEq(stack[16], 229964442322606);
    }

    function testStratBuyNHTHappyPath(uint256 orderHash) public {
        uint256 reserve0 = 53138576564435538694955386;
        uint256 reserve1 = 12270399039;

        uint32 reserveTimestamp = 1624291200;

        uint256[][] memory context = new uint256[][](1);
        {
            uint256[] memory callingContext = new uint256[](3);
            // order hash
            callingContext[0] = orderHash;
            // owner
            callingContext[1] = uint256(uint160(address(this)));
            // counterparty
            callingContext[2] = uint256(uint160(APPROVED_COUNTERPARTY));
            context[0] = callingContext;
        }

        address expectedPair =
            LibUniswapV2.pairFor(POLYGON_SUSHI_V2_FACTORY, POLYGON_NHT_TOKEN_ADDRESS, USDT_TOKEN_ADDRESS);
        vm.mockCall(
            expectedPair,
            abi.encodeWithSelector(IUniswapV2Pair.getReserves.selector),
            abi.encode(reserve0, reserve1, reserveTimestamp)
        );
        (uint256[] memory stack, uint256[] memory kvs) = parseAndEvalWithContext(RAINSTRING_BUY_NHT, context);
    }
}

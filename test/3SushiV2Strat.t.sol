// SPDX-License-Identifier: CAL
pragma solidity =0.8.19;

import "rain.interpreter/test/util/abstract/OpTest.sol";

import "src/3SushiV2Strat.sol";

uint256 constant CONTEXT_VAULT_INPUTS_COLUMN = 3;
uint256 constant CONTEXT_VAULT_OUTPUTS_COLUMN = 4;
uint256 constant CONTEXT_VAULT_IO_BALANCE_DIFF = 4;
uint256 constant CONTEXT_VAULT_IO_ROWS = 5;

contract Test3SushiV2Strat is OpTest {
    function parseAndEvalWithContext(bytes memory rainString, uint256[][] memory context, SourceIndex sourceIndex)
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
            LibEncodedDispatch.encode(expression, sourceIndex, type(uint16).max),
            context
        );
        return (stack, kvs);
    }

    function checkSellCalculate(uint256[] memory stack, uint256[] memory kvs, uint256 orderHash, uint256 reserveTimestamp, uint256 orderInitTime, uint256 duration) internal {
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
        // total time is duration.
        assertEq(stack[8], duration);
        // max usdt amount.
        assertEq(stack[9], stack[7] * stack[8]);
        // current usdt amount key.
        assertEq(stack[10], currentUsdtAmountKey);
        assertEq(stack[11], 0);
        // target usdt amount.
        assertEq(stack[12], stack[9] - stack[11]);
        // last price timestamp.
        assertEq(stack[13], reserveTimestamp);
        // nht amount out from ob.
        assertEq(stack[14], 218073484927305044988919, "stack[14]");
        // order output max.
        assertEq(stack[15], uint256(uint256(stack[14]) * uint256(1001) / uint256(1000)), "stack[15]");
        // io ratio.
        assertEq(stack[16], 229053291678722, "stack[16]");
    }

    function checkSellHandle(uint256[] memory stack, uint256[] memory kvs, uint256 orderHash) internal {
        uint256 currentUsdtAmountKey = uint256(keccak256(abi.encodePacked(orderHash, uint256(1))));
        assertEq(kvs.length, 2);
        assertEq(kvs[0], currentUsdtAmountKey);
        assertEq(kvs[1], 50000400);
        assertEq(stack.length, 3);
        assertEq(stack[0], kvs[1]);
        assertEq(stack[1], orderHash);
        assertEq(stack[2], currentUsdtAmountKey);
    }

    function testStratSellNHTHappyPath(uint256 orderHash) public {
        uint256 reserve0 = 53138576564435538694955386;
        // Using USDT as an example.
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
            uint256[] memory inputsContext = new uint256[](CONTEXT_VAULT_IO_ROWS);
            inputsContext[0] = uint256(uint160(USDT_TOKEN_ADDRESS));
            context[2] = inputsContext;
        }
        {
            uint256[] memory outputsContext = new uint256[](CONTEXT_VAULT_IO_ROWS);
            outputsContext[0] = uint256(uint160(POLYGON_NHT_TOKEN_ADDRESS));
            context[3] = outputsContext;
        }
        context = LibContext.build(context, new SignedContextV1[](0));

        address expectedPair =
            LibUniswapV2.pairFor(POLYGON_SUSHI_V2_FACTORY, POLYGON_NHT_TOKEN_ADDRESS, USDT_TOKEN_ADDRESS);
        vm.mockCall(
            expectedPair,
            abi.encodeWithSelector(IUniswapV2Pair.getReserves.selector),
            abi.encode(reserve0, reserve1, reserveTimestamp)
        );

        uint256 orderInitTime = 1692775491;
        // Give it an hour so we can clear the handle io check.
        uint256 duration = 3600;
        vm.warp(orderInitTime + duration);

        (uint256[] memory stack, uint256[] memory kvs) = parseAndEvalWithContext(RAINSTRING_SELL_NHT, context, SourceIndex.wrap(0));

        checkSellCalculate(stack, kvs, orderHash, reserveTimestamp, orderInitTime, duration);

        // usdt diff is the amount of usdt we bought (order output max * io ratio) scaled to 6 decimals.
        context[CONTEXT_VAULT_INPUTS_COLUMN][CONTEXT_VAULT_IO_BALANCE_DIFF] =
        FixedPointDecimalScale.scaleN(UD60x18.unwrap(mul(UD60x18.wrap(stack[15]), UD60x18.wrap(stack[16]))), 6, 1);
        // nht diff is the amount of nht we sold (order output max).
        context[CONTEXT_VAULT_OUTPUTS_COLUMN][CONTEXT_VAULT_IO_BALANCE_DIFF] = stack[15];

        // it hasn't been an hour so we should revert.
        (stack, kvs) = parseAndEvalWithContext(RAINSTRING_SELL_NHT, context, SourceIndex.wrap(1));
        checkSellHandle(stack, kvs, orderHash);
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
        (uint256[] memory stack, uint256[] memory kvs) = parseAndEvalWithContext(RAINSTRING_BUY_NHT, context, SourceIndex.wrap(0));
    }
}

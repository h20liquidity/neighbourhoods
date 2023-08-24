// SPDX-License-Identifier: CAL
pragma solidity =0.8.19;

import "rain.interpreter/test/util/abstract/OpTest.sol";

import "src/3SushiV2Strat.sol";
import "src/IOrderBookV3.sol";
import "src/IERC20.sol";

uint256 constant CONTEXT_VAULT_INPUTS_COLUMN = 3;
uint256 constant CONTEXT_VAULT_OUTPUTS_COLUMN = 4;
uint256 constant CONTEXT_VAULT_IO_BALANCE_DIFF = 4;
uint256 constant CONTEXT_VAULT_IO_ROWS = 5;

string constant FORK_RPC = "https://polygon.llamarpc.com";

uint256 constant VAULT_ID = uint256(keccak256("vault"));

bytes constant EXPECTED_SELL_BYTECODE = hex"02000000c430120011010000000100000101000002010000030200020100000001020000040c02000000000002020000030c02000000000004000000030c0200000b0300000200000101000004010000050000000608000000230200000000000700000008220200000100000600000005030200000000000a250100000000000b000000092302000000000002000000010000000c0000000027040001080000000000000d120200000b010001010000070000000e150200000000000f0000000c17010006140200000f050003020004030200000101000006000000010302000000000000000000022501000019020000000000022602000001000008000000000e0200000b010002";

bytes constant EXPECTED_BUY_BYTECODE = hex"02000000c831130012010000000100000101000002010000030200020100000002020000040c02000000000001020000030c02000000000004000000030c0200000b0300000200000101000004010000050000000608000000230200000000000700000008220200000100000600000005030200000000000a250100000000000b000000092302000000000001000000020000000c0000000028040001080000000000000d120200000b010001010000070000000e150200000000000c17010006000000100000000f140200000f050003020004040200000101000006000000010302000000000000000000022501000019020000000000022602000001000008000000000e0200000b010000";

RainterpreterExpressionDeployerNP constant POLYGON_DEPLOYER = RainterpreterExpressionDeployerNP(0x386d79440e3fe32BdFb0120034Fb21971151E90f);
address constant POLYGON_INTERPRETER = 0x31fE050009Dc0cAb68fFe3a65A0A466F60bE6c5D;
address constant POLYGON_STORE = 0xc71541cc0684A3ccC86EdA6aFc4a456140130fbD;
IOrderBookV3 constant POLYGON_ORDERBOOK = IOrderBookV3(0x1320DBB57a65c9CbF785E10770F8f3d51ff92132);

contract Test3SushiV2Strat is OpTest {

    function selectPolygonFork() internal {
        uint256 fork = vm.createFork(FORK_RPC);
        vm.selectFork(fork);
    }

    function parseAndEvalWithContext(bytes memory expectedBytecode, bytes memory rainString, uint256[][] memory context, SourceIndex sourceIndex)
        internal
        returns (uint256[] memory, uint256[] memory)
    {
        IInterpreterV1 interpreterDeployer;
        IInterpreterStoreV1 storeDeployer;
        address expression;
        {
            (bytes memory bytecode, uint256[] memory constants) = iDeployer.parse(rainString);
            assertEq(bytecode, expectedBytecode);
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

    function checkBuyConstants(uint256[] memory constants) internal {
        assertEq(constants.length, 9);
        assertEq(constants[0], uint256(uint160(POLYGON_SUSHI_V2_FACTORY)), "constants[0]");
        assertEq(constants[1], uint256(uint160(POLYGON_NHT_TOKEN_ADDRESS)), "constants[1]");
        assertEq(constants[2], uint256(uint160(POLYGON_USDT_TOKEN_ADDRESS)), "constants[2]");
        assertEq(constants[3], uint256(uint160(APPROVED_COUNTERPARTY)), "constants[3]");
        assertEq(constants[4], ORDER_INIT_TIME, "constants[4]");
        assertEq(constants[5], USDT_PER_SECOND, "constants[5]");
        assertEq(constants[6], 1, "constants[6]");
        assertEq(constants[7], BUY_MULTIPLIER, "constants[7]");
        assertEq(constants[8], MIN_USDT_AMOUNT, "constants[8]");
    }

    function checkSellConstants(uint256[] memory constants) internal {
        assertEq(constants.length, 9);
        assertEq(constants[0], uint256(uint160(POLYGON_SUSHI_V2_FACTORY)), "constants[0]");
        assertEq(constants[1], uint256(uint160(POLYGON_NHT_TOKEN_ADDRESS)), "constants[1]");
        assertEq(constants[2], uint256(uint160(POLYGON_USDT_TOKEN_ADDRESS)), "constants[2]");
        assertEq(constants[3], uint256(uint160(APPROVED_COUNTERPARTY)), "constants[3]");
        assertEq(constants[4], ORDER_INIT_TIME, "constants[4]");
        assertEq(constants[5], USDT_PER_SECOND, "constants[5]");
        assertEq(constants[6], 1, "constants[6]");
        assertEq(constants[7], SELL_MULTIPLIER, "constants[7]");
        assertEq(constants[8], MIN_USDT_AMOUNT, "constants[8]");
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
        assertEq(stack[2], uint256(uint160(POLYGON_USDT_TOKEN_ADDRESS)));

        // approved counterparty.
        assertEq(stack[3], uint256(uint160(APPROVED_COUNTERPARTY)));
        // actual counterparty.
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
        assertEq(stack[15], uint256(uint256(stack[14]) * uint256(101) / uint256(100)), "stack[15]");
        // io ratio.
        uint256 expectedUsdtScaled = 50000400e12;
        assertEq(stack[16], (expectedUsdtScaled * 1e18) / stack[15], "stack[16]");
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
            inputsContext[0] = uint256(uint160(POLYGON_USDT_TOKEN_ADDRESS));
            context[2] = inputsContext;
        }
        {
            uint256[] memory outputsContext = new uint256[](CONTEXT_VAULT_IO_ROWS);
            outputsContext[0] = uint256(uint160(POLYGON_NHT_TOKEN_ADDRESS));
            context[3] = outputsContext;
        }
        context = LibContext.build(context, new SignedContextV1[](0));

        address expectedPair =
            LibUniswapV2.pairFor(POLYGON_SUSHI_V2_FACTORY, POLYGON_NHT_TOKEN_ADDRESS, POLYGON_USDT_TOKEN_ADDRESS);
        vm.mockCall(
            expectedPair,
            abi.encodeWithSelector(IUniswapV2Pair.getReserves.selector),
            abi.encode(reserve0, reserve1, reserveTimestamp)
        );

        uint256 orderInitTime = uint256(reserveTimestamp) + 1;
        // Give it an hour so we can clear the handle io check.
        uint256 duration = 3600;
        vm.warp(orderInitTime + duration);

        (uint256[] memory stack, uint256[] memory kvs) = parseAndEvalWithContext(EXPECTED_SELL_BYTECODE, RAINSTRING_SELL_NHT, context, SourceIndex.wrap(0));

        checkSellCalculate(stack, kvs, orderHash, reserveTimestamp, orderInitTime, duration);

        // usdt diff is the amount of usdt we bought (order output max * io ratio) scaled to 6 decimals.
        // usdt is the input here as we're selling nht.
        context[CONTEXT_VAULT_INPUTS_COLUMN][CONTEXT_VAULT_IO_BALANCE_DIFF] =
        FixedPointDecimalScale.scaleN(UD60x18.unwrap(mul(UD60x18.wrap(stack[15]), UD60x18.wrap(stack[16]))), 6, 1);

        // nht diff is the amount of nht we sold (order output max).
        // nht is the output here as we're selling nht.
        context[CONTEXT_VAULT_OUTPUTS_COLUMN][CONTEXT_VAULT_IO_BALANCE_DIFF] = stack[15];

        // it hasn't been an hour so we should revert.
        (stack, kvs) = parseAndEvalWithContext(EXPECTED_SELL_BYTECODE, RAINSTRING_SELL_NHT, context, SourceIndex.wrap(1));
        checkSellHandle(stack, kvs, orderHash);
    }

    function testDeployer() external {
        selectPolygonFork();

        assertEq(address(POLYGON_DEPLOYER.iInterpreter()), POLYGON_INTERPRETER);
        assertEq(address(POLYGON_DEPLOYER.iStore()), POLYGON_STORE);
    }

    function testStratSellNHTHappyFork() external {
        selectPolygonFork();

        (bytes memory bytecode, uint256[] memory constants) = POLYGON_DEPLOYER.parse(RAINSTRING_SELL_NHT);
        assertEq(bytecode, EXPECTED_SELL_BYTECODE);
        checkSellConstants(constants);

        address nhtHolder = 0xe0e0Bb15Ad2dC19e5Eaa133968e498B4D9bF24Da;
        address orderOwner = address(0x1234);

        vm.prank(nhtHolder);
        // 200 mill nht
        IERC20(POLYGON_NHT_TOKEN_ADDRESS).transfer(orderOwner, 200000000e18);

        assertEq(IERC20(POLYGON_NHT_TOKEN_ADDRESS).balanceOf(orderOwner), 200000000e18);

        {
            address usdtHolder = 0x72A53cDBBcc1b9efa39c834A540550e23463AAcB;
            vm.startPrank(usdtHolder);
            // one million tether to each of owner order and counterparty.
            IERC20(POLYGON_USDT_TOKEN_ADDRESS).transfer(orderOwner, 1000000e6);
            IERC20(POLYGON_USDT_TOKEN_ADDRESS).transfer(APPROVED_COUNTERPARTY, 1000000e6);
            vm.stopPrank();

            assertEq(IERC20(POLYGON_USDT_TOKEN_ADDRESS).balanceOf(orderOwner), 1000000e6);
        }

        Order memory order;
        {
            IO[] memory inputs = new IO[](1);
            inputs[0] = IO(POLYGON_USDT_TOKEN_ADDRESS, 6, VAULT_ID);

            IO[] memory outputs = new IO[](1);
            outputs[0] = IO(POLYGON_NHT_TOKEN_ADDRESS, 18, VAULT_ID);

            EvaluableConfigV2 memory evaluableConfig = EvaluableConfigV2 (
                POLYGON_DEPLOYER,
                bytecode,
                constants
            );

            OrderConfigV2 memory orderConfig = OrderConfigV2 (
                inputs,
                outputs,
                evaluableConfig,
                ""
            );

            vm.startPrank(orderOwner);
            vm.recordLogs();
            (bool stateChanged) = POLYGON_ORDERBOOK.addOrder(orderConfig);
            Vm.Log[] memory entries = vm.getRecordedLogs();
            assertEq(entries.length, 3);
            // assertEq(entries[2].topics[0], AddOrder.selector);
            (,,order,) = abi.decode(entries[2].data, (address, address, Order, bytes32));
            assertEq(order.owner, orderOwner);
            assertEq(order.handleIO, true);
            assertEq(address(order.evaluable.interpreter), address(POLYGON_INTERPRETER));
            assertEq(address(order.evaluable.store), address(POLYGON_STORE));
            assertEq(stateChanged, true);

            IERC20(POLYGON_NHT_TOKEN_ADDRESS).approve(address(POLYGON_ORDERBOOK), 200000000e18);
            POLYGON_ORDERBOOK.deposit(POLYGON_NHT_TOKEN_ADDRESS, VAULT_ID, 200000000e18);
            IERC20(POLYGON_USDT_TOKEN_ADDRESS).approve(address(POLYGON_ORDERBOOK), 1000000e6);
            POLYGON_ORDERBOOK.deposit(POLYGON_USDT_TOKEN_ADDRESS, VAULT_ID, 1000000e6);
            vm.stopPrank();
        }

        {
            vm.startPrank(APPROVED_COUNTERPARTY);
            TakeOrderConfig memory takeOrderConfig = TakeOrderConfig(
                order,
                0,
                0,
                new SignedContextV1[](0)
            );
            TakeOrderConfig[] memory innerConfigs = new TakeOrderConfig[](1);
            innerConfigs[0] = takeOrderConfig;
            TakeOrdersConfig memory takeOrdersConfig = TakeOrdersConfig(
                POLYGON_USDT_TOKEN_ADDRESS,
                POLYGON_NHT_TOKEN_ADDRESS,
                0,
                type(uint256).max,
                type(uint256).max,
                innerConfigs
            );
            uint256 amountToApprove = USDT_PER_SECOND * (block.timestamp - ORDER_INIT_TIME) * 101 / 100;
            console2.log(amountToApprove);
            // uint256 amountToApprove = 1000000e6;
            IERC20(POLYGON_USDT_TOKEN_ADDRESS).approve(address(POLYGON_ORDERBOOK), amountToApprove);
            (uint256 totalInput, uint256 totalOutput) = POLYGON_ORDERBOOK.takeOrders(takeOrdersConfig);
            // Check that the approval amount was exactly right.
            // assertEq(IERC20(POLYGON_USDT_TOKEN_ADDRESS).allowance(APPROVED_COUNTERPARTY, address(orderbook)), 0);
            vm.stopPrank();
        }
    }

    function checkBuyCalculate(uint256[] memory stack, uint256[] memory kvs, uint256 orderHash, uint256 reserveTimestamp, uint256 orderInitTime, uint256 duration) internal {
        uint256 currentUsdtAmountKey = uint256(keccak256(abi.encodePacked(orderHash, uint256(1))));
        assertEq(kvs.length, 2);
        kvs[0] = currentUsdtAmountKey;
        kvs[1] = 0;
        assertEq(stack.length, 18);

        // addresses.
        assertEq(stack[0], uint256(uint160(POLYGON_SUSHI_V2_FACTORY)));
        assertEq(stack[1], uint256(uint160(POLYGON_NHT_TOKEN_ADDRESS)));
        assertEq(stack[2], uint256(uint160(POLYGON_USDT_TOKEN_ADDRESS)));

        // approved counterparty.
        assertEq(stack[3], uint256(uint160(APPROVED_COUNTERPARTY)));
        // actual counterparty.
        assertEq(stack[4], uint256(uint160(APPROVED_COUNTERPARTY)));

        // order hash.
        assertEq(stack[5], orderHash);
        // order init time.
        assertEq(stack[6], orderInitTime, "stack[6]");
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
        // nht amount in to ob.
        assertEq(stack[14], 215010194945733820281886, "stack[14]");
        // nht input expected.
        assertEq(stack[15], uint256(uint256(stack[14]) * uint256(99) / uint256(100)), "stack[15]");
        // order output max usdt.
        assertEq(stack[16], 50000400e12, "stack[16]");
        // io ratio.
        assertEq(stack[17], stack[15] * 1e18 / stack[16], "stack[17]");
    }

    function checkBuyHandle(uint256[] memory stack, uint256[] memory kvs, uint256 orderHash) internal {
        uint256 currentUsdtAmountKey = uint256(keccak256(abi.encodePacked(orderHash, uint256(1))));
        assertEq(kvs.length, 2);
        assertEq(kvs[0], currentUsdtAmountKey);
        assertEq(kvs[1], 50000400);
        assertEq(stack.length, 3);
        assertEq(stack[0], kvs[1]);
        assertEq(stack[1], orderHash);
        assertEq(stack[2], currentUsdtAmountKey);
    }

    function testStratBuyNHTHappyPath(uint256 orderHash) public {
        uint256 reserve0 = 53138576564435538694955386;
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
            inputsContext[0] = uint256(uint160(POLYGON_NHT_TOKEN_ADDRESS));
            context[2] = inputsContext;
        }
        {
            uint256[] memory outputsContext = new uint256[](CONTEXT_VAULT_IO_ROWS);
            outputsContext[0] = uint256(uint160(POLYGON_USDT_TOKEN_ADDRESS));
            context[3] = outputsContext;
        }
        context = LibContext.build(context, new SignedContextV1[](0));

        address expectedPair =
            LibUniswapV2.pairFor(POLYGON_SUSHI_V2_FACTORY, POLYGON_NHT_TOKEN_ADDRESS, POLYGON_USDT_TOKEN_ADDRESS);
        vm.mockCall(
            expectedPair,
            abi.encodeWithSelector(IUniswapV2Pair.getReserves.selector),
            abi.encode(reserve0, reserve1, reserveTimestamp)
        );
        uint256 orderInitTime = uint256(reserveTimestamp) + 1;
        // Give it an hour so we can clear the handle io check.
        uint256 duration = 3600;
        vm.warp(orderInitTime + duration);
        (uint256[] memory stack, uint256[] memory kvs) = parseAndEvalWithContext(EXPECTED_BUY_BYTECODE, RAINSTRING_BUY_NHT, context, SourceIndex.wrap(0));

        checkBuyCalculate(stack, kvs, orderHash, reserveTimestamp, orderInitTime, duration);

        // usdt diff is the order output max scaled to 6 decimals.
        // usdt is the output here as we're buying nht.
        context[CONTEXT_VAULT_OUTPUTS_COLUMN][CONTEXT_VAULT_IO_BALANCE_DIFF] =
            FixedPointDecimalScale.scaleN(stack[16], 6, 1);

        // nht diff is the amount of nht we sold (order output max * io ratio).
        // nht is the input here as we're buying nht.
        context[CONTEXT_VAULT_INPUTS_COLUMN][CONTEXT_VAULT_IO_BALANCE_DIFF] = stack[15] * stack[16] / 1e18;

        // it hasn't been an hour so we should revert.
        (stack, kvs) = parseAndEvalWithContext(EXPECTED_BUY_BYTECODE, RAINSTRING_BUY_NHT, context, SourceIndex.wrap(1));
        checkBuyHandle(stack, kvs, orderHash);
    }

    function testStratBuyNHTHappyFork() external {
        selectPolygonFork();

        (bytes memory bytecode, uint256[] memory constants) = POLYGON_DEPLOYER.parse(RAINSTRING_BUY_NHT);
        assertEq(bytecode, EXPECTED_BUY_BYTECODE);
        checkBuyConstants(constants);
    }
}

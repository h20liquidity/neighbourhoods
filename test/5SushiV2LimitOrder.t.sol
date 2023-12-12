// SPDX-License-Identifier: CAL
pragma solidity =0.8.19;

import "test/util/Test5SushiV2LimitOrderUtil.sol";
import {console2} from "forge-std/console2.sol";

import {Vm} from "forge-std/Vm.sol";
import {
    rainstringSellLimitOrder,
    rainstringBuyLimitOrder,
    ORDER_INIT_RATIO_SELL,
    ORDER_INIT_RATIO_BUY,
    AMOUNT_PER_BATCH,
    INCR_PER_BATCH,
    COOLDOWN,
    ROUTE_PROCESSOR,
    EXPECTED_SELL_LIMIT_BYTECODE,
    EXPECTED_BUY_LIMIT_BYTECODE,
    expectedLimitOrderSellConstants,
    expectedLimitOrderBuyConstants
} from "src/5SushiV2LimitOrder.sol";
import {
    POLYGON_PARSER_NPE2,
    POLYGON_NHT_TOKEN_ADDRESS,
    POLYGON_USDT_TOKEN_ADDRESS,
    APPROVED_COUNTERPARTY,
    POLYGON_NHT_TOKEN_DECIMALS,
    POLYGON_USDT_TOKEN_DECIMALS,
    POLYGON_PARSER_NPE2,
    POLYGON_DEPLOYER_NPE2,
    IInterpreterV2,
    IInterpreterStoreV1,
    IO,
    POLYGON_ORDERBOOK,
    POLYGON_DEPLOYER_NPE2,
    OrderV2,
    IERC20,
    EvaluableConfigV3,
    OrderConfigV2,
    POLYGON_INTERPRETER_NPE2,
    POLYGON_STORE_NPE2,
    POLYGON_NHT_HOLDER,
    SELL_ROUTE,
    APPROVED_EOA,
    TakeOrderConfigV2,
    SignedContextV1,
    TakeOrdersConfigV2,
    POLYGON_ARB_CONTRACT,
    BUY_ROUTE,
    POLYGON_USDT_HOLDER,
    POLYGON_NHT_USDT_PAIR_ADDRESS
} from "src/4SushiV2StratBinomial.sol";
import "rain.interpreter/lib/rain.math.fixedpoint/src/lib/LibFixedPointDecimalArithmeticOpenZeppelin.sol";
import "rain.interpreter/lib/rain.math.fixedpoint/src/lib/LibFixedPointDecimalScale.sol";
import {UD60x18, powu} from "rain.interpreter/lib/prb-math/src/UD60x18.sol";

contract Test4SushiV2LimitOrder is Test5SushiV2LimitOrderUtil {
    using LibFixedPointDecimalArithmeticOpenZeppelin for uint256;
    using LibFixedPointDecimalScale for uint256;

    uint256 constant FORK_BLOCK_NUMBER = 51049758;

    uint32 constant RESERVE_TIMESTAMP = 1701608565;
    uint256 constant VAULT_ID = uint256(keccak256("vault"));

    address constant TEST_ORDER_OWNER = address(0x84723849238);

    uint256 constant CONTEXT_VAULT_IO_ROWS = 5;

    function selectPolygonFork() internal {
        uint256 fork = vm.createFork(vm.envString("RPC_URL_POLYGON"));
        vm.selectFork(fork);
        vm.rollFork(FORK_BLOCK_NUMBER);
    }

    function polygonNhtIo() internal pure returns (IO memory) {
        return IO(address(POLYGON_NHT_TOKEN_ADDRESS), 18, VAULT_ID);
    }

    function polygonUsdtIo() internal pure returns (IO memory) {
        return IO(address(POLYGON_USDT_TOKEN_ADDRESS), 6, VAULT_ID);
    }

    function placeBuyLimitOrderFork() internal returns (OrderV2 memory) {
        (bytes memory bytecode, uint256[] memory constants) = POLYGON_PARSER_NPE2.parse(rainstringBuyLimitOrder());
        assertEq(bytecode, EXPECTED_BUY_LIMIT_BYTECODE);
        uint256[] memory expectedConstants = expectedLimitOrderBuyConstants();
        assertEq(expectedConstants.length, constants.length);
        for (uint256 i = 0; i < constants.length; i++) {
            assertEq(constants[i], expectedConstants[i]);
        }
        return placeOrder(bytecode, constants, polygonNhtIo(), polygonUsdtIo());
    }

    function placeSellLimitOrderFork() internal returns (OrderV2 memory order) {
        (bytes memory bytecode, uint256[] memory constants) = POLYGON_PARSER_NPE2.parse(rainstringSellLimitOrder());
        assertEq(bytecode, EXPECTED_SELL_LIMIT_BYTECODE);
        uint256[] memory expectedConstants = expectedLimitOrderSellConstants();
        assertEq(expectedConstants.length, constants.length);
        for (uint256 i = 0; i < constants.length; i++) {
            assertEq(constants[i], expectedConstants[i]);
        }
        return placeOrder(bytecode, constants, polygonUsdtIo(), polygonNhtIo());
    }

    function getInputVaultBalance(OrderV2 memory order) internal view returns (uint256) {
        return POLYGON_ORDERBOOK.vaultBalance(order.owner, order.validInputs[0].token, order.validInputs[0].vaultId);
    }

    function getOutputVaultBalance(OrderV2 memory order) internal view returns (uint256) {
        return POLYGON_ORDERBOOK.vaultBalance(order.owner, order.validOutputs[0].token, order.validOutputs[0].vaultId);
    }

    function placeOrder(bytes memory bytecode, uint256[] memory constants, IO memory input, IO memory output)
        internal
        returns (OrderV2 memory order)
    {
        IO[] memory inputs = new IO[](1);
        inputs[0] = input;

        IO[] memory outputs = new IO[](1);
        outputs[0] = output;

        EvaluableConfigV3 memory evaluableConfig = EvaluableConfigV3(POLYGON_DEPLOYER_NPE2, bytecode, constants);

        OrderConfigV2 memory orderConfig = OrderConfigV2(inputs, outputs, evaluableConfig, "");

        vm.startPrank(TEST_ORDER_OWNER);
        vm.recordLogs();
        (bool stateChanged) = POLYGON_ORDERBOOK.addOrder(orderConfig);
        Vm.Log[] memory entries = vm.getRecordedLogs();
        assertEq(entries.length, 3);
        (,, order,) = abi.decode(entries[2].data, (address, address, OrderV2, bytes32));
        assertEq(order.owner, TEST_ORDER_OWNER);
        assertEq(order.handleIO, true);
        assertEq(address(order.evaluable.interpreter), address(POLYGON_INTERPRETER_NPE2));
        assertEq(address(order.evaluable.store), address(POLYGON_STORE_NPE2));
        assertEq(stateChanged, true);
    }

    function giveTestAccountsTokens(IERC20 token, address from, address to, uint256 amount) internal {
        vm.startPrank(from);
        token.transfer(to, amount);
        // assertEq(token.balanceOf(to), amount);
        vm.stopPrank();
    }

    function depositTokens(IERC20 token, uint256 vaultId, uint256 amount) internal {
        vm.startPrank(TEST_ORDER_OWNER);
        token.approve(address(POLYGON_ORDERBOOK), amount);
        POLYGON_ORDERBOOK.deposit(address(token), vaultId, amount);
        vm.stopPrank();
    }

    // Encode Target
    function encode(uint256 startBit, uint256 length, uint256 target, uint256 source) internal pure returns (uint256) {
        uint256 mask = (2 ** length - 1);
        target &= ~(mask << startBit);
        target |= (source & mask) << startBit;
        return target;
    }

    // Decode Target
    function decode(uint256 startBit, uint256 length, uint256 target) internal pure returns (uint256) {
        uint256 mask = (2 ** length) - 1;
        return (target >> startBit) & mask;
    }

    function moveSushiV2Price(
        address inputToken,
        address outputToken,
        address tokenHolder,
        uint256 amountIn,
        bytes memory encodedRoute
    ) public {
        // An External Account
        address EXTERNAL_EOA = address(0x654FEf5Fb8A1C91ad47Ba192F7AA81dd3C821427);
        {
            giveTestAccountsTokens(IERC20(inputToken), tokenHolder, EXTERNAL_EOA, amountIn);
        }
        vm.startPrank(EXTERNAL_EOA);

        IERC20(inputToken).approve(address(ROUTE_PROCESSOR), amountIn);

        bytes memory decodedRoute = abi.decode(encodedRoute, (bytes));

        ROUTE_PROCESSOR.processRoute(inputToken, amountIn, outputToken, 0, EXTERNAL_EOA, decodedRoute);
        vm.stopPrank();
    }

    function testSellLimitOrderHappyFork() public {
        selectPolygonFork();
        {
            // Deposit NHT.
            uint256 depositAmount = 100000000e18;
            giveTestAccountsTokens(POLYGON_NHT_TOKEN_ADDRESS, POLYGON_NHT_HOLDER, TEST_ORDER_OWNER, depositAmount);
            depositTokens(POLYGON_NHT_TOKEN_ADDRESS, VAULT_ID, depositAmount);
        }
        // Move External Market in Opposite Direction
        moveSushiV2Price(
            address(POLYGON_USDT_TOKEN_ADDRESS),
            address(POLYGON_NHT_TOKEN_ADDRESS),
            POLYGON_USDT_HOLDER,
            10000e6,
            BUY_ROUTE
        );
        OrderV2 memory sellOrder = placeSellLimitOrderFork();

        for (uint256 i = 0; i < 5; i++) {
            vm.recordLogs();
            takeOrder(sellOrder, SELL_ROUTE);

            Vm.Log[] memory entries = vm.getRecordedLogs();
            uint256 ratio;
            uint256 output;
            uint256 input;
            for (uint256 j = 0; j < entries.length; j++) {
                if (entries[j].topics[0] == keccak256("Context(address,uint256[][])")) {
                    (, uint256[][] memory context) = abi.decode(entries[j].data, (address, uint256[][]));
                    ratio = context[2][1];
                    input = context[3][4];
                    output = context[4][4];
                }
            }
            console2.log("RATIO [%s] : [%s NHT sold, %s USDT bought.]", ratio, output, input);

            vm.warp(block.timestamp + COOLDOWN + 1);
        }
    }

    function testBuyLimitOrderHappyFork() public {
        selectPolygonFork();
        {
            // Deposit USDT.
            uint256 depositAmount = 10000e6;
            giveTestAccountsTokens(POLYGON_USDT_TOKEN_ADDRESS, POLYGON_USDT_HOLDER, TEST_ORDER_OWNER, depositAmount);
            depositTokens(POLYGON_USDT_TOKEN_ADDRESS, VAULT_ID, depositAmount);
        }
        // Move External Market in Opposite Direction
        moveSushiV2Price(
            address(POLYGON_NHT_TOKEN_ADDRESS),
            address(POLYGON_USDT_TOKEN_ADDRESS),
            POLYGON_NHT_HOLDER,
            100000000e18,
            SELL_ROUTE
        );
        OrderV2 memory buyOrder = placeBuyLimitOrderFork();

        for (uint256 i = 0; i < 5; i++) {
            vm.recordLogs();
            takeOrder(buyOrder, BUY_ROUTE);

            Vm.Log[] memory entries = vm.getRecordedLogs();
            uint256 ratio;
            uint256 output;
            uint256 input;
            for (uint256 j = 0; j < entries.length; j++) {
                if (entries[j].topics[0] == keccak256("Context(address,uint256[][])")) {
                    (, uint256[][] memory context) = abi.decode(entries[j].data, (address, uint256[][]));
                    ratio = context[2][1];
                    input = context[3][4];
                    output = context[4][4];
                }
            }
            console2.log("RATIO [%s] : [%s USDT sold, %s NHT bought.]", ratio, output, input);

            vm.warp(block.timestamp + COOLDOWN + 1);
        }
    }

    function takeOrder(OrderV2 memory order, bytes memory route) internal {
        assertTrue(POLYGON_ORDERBOOK.orderExists(keccak256(abi.encode(order))), "order exists");
        vm.startPrank(APPROVED_EOA);
        uint256 inputIOIndex = 0;
        uint256 outputIOIndex = 0;
        TakeOrderConfigV2[] memory innerConfigs = new TakeOrderConfigV2[](1);

        innerConfigs[0] = TakeOrderConfigV2(order, inputIOIndex, outputIOIndex, new SignedContextV1[](0));
        uint256 outputTokenBalance =
            POLYGON_ORDERBOOK.vaultBalance(order.owner, order.validOutputs[0].token, order.validOutputs[0].vaultId);
        TakeOrdersConfigV2 memory takeOrdersConfig =
            TakeOrdersConfigV2(0, outputTokenBalance, type(uint256).max, innerConfigs, route);
        POLYGON_ARB_CONTRACT.arb(takeOrdersConfig, 0);
        vm.stopPrank();
    }

    function testLimitSellOrderReal(uint256 orderHash, uint256 vaultId, uint256 balanceDiff) public {
        vm.assume(balanceDiff > 1 && balanceDiff <= 2000e6);
        vm.warp(RESERVE_TIMESTAMP);

        uint256[][] memory context = new uint256[][](5);
        {
            {
                uint256[] memory baseContext = new uint256[](2);
                context[0] = baseContext;
            }
            {
                uint256[] memory callingContext = new uint256[](3);
                // order hash
                callingContext[0] = orderHash;
                // owner
                callingContext[1] = uint256(uint160(address(this)));
                // counterparty
                callingContext[2] = uint256(uint160(APPROVED_COUNTERPARTY));
                context[1] = callingContext;
            }
            {
                uint256[] memory calculationsContext = new uint256[](0);
                context[2] = calculationsContext;
            }
            {
                uint256[] memory inputsContext = new uint256[](CONTEXT_VAULT_IO_ROWS);
                inputsContext[0] = uint256(uint160(address(POLYGON_USDT_TOKEN_ADDRESS)));
                inputsContext[1] = POLYGON_USDT_TOKEN_DECIMALS;
                inputsContext[2] = vaultId;
                inputsContext[3] = balanceDiff;
                inputsContext[4] = balanceDiff;

                context[3] = inputsContext;
            }
            {
                uint256[] memory outputsContext = new uint256[](CONTEXT_VAULT_IO_ROWS);
                outputsContext[0] = uint256(uint160(address(POLYGON_NHT_TOKEN_ADDRESS)));
                context[4] = outputsContext;
            }
        }

        (bytes memory bytecode, uint256[] memory constants) = iParseExpression(rainstringSellLimitOrder());
        assertEq(bytecode, EXPECTED_SELL_LIMIT_BYTECODE);

        address interpreter;
        address store;
        address expression;
        {
            (interpreter, store, expression) = iDeployExpression(bytecode, constants);
        }

        LimitOrder memory limitOrder;
        for (uint256 i = 0; i < 10; i++) {
            {
                limitOrder = LimitOrder(orderHash, 0, expression, context, new uint256[](0), new uint256[](0));
                // Eval Calculate_Io Source
                limitOrder = evalLimitOrder(limitOrder);
                // Assert stack[0]
                checkCalculateSellStack(limitOrder);
                // Set kvs[0]
                IInterpreterStoreV1(store).set(StateNamespace.wrap(0), limitOrder.kvs);
                context = limitOrder.context;
            }

            {
                limitOrder = LimitOrder(orderHash, 1, expression, context, new uint256[](0), new uint256[](0));
                // Eval Handle_Io source
                limitOrder = evalLimitOrder(limitOrder);
                // set kvs[1]
                IInterpreterStoreV1(store).set(StateNamespace.wrap(0), limitOrder.kvs);

                // Check if floor of div is greater than 0
                if (((limitOrder.stack[6].scale18(POLYGON_USDT_TOKEN_DECIMALS, 1)) / AMOUNT_PER_BATCH) > 0) {
                    // Increment Batch Index
                    vm.warp(block.timestamp + COOLDOWN + 1);
                }
            }
        }
    }

    function testLimitBuyOrderReal(uint256 orderHash, uint256 vaultId, uint256 balanceDiff) public {
        vm.assume(balanceDiff > 1 && balanceDiff <= 3000e18);
        vm.warp(RESERVE_TIMESTAMP);

        uint256[][] memory context = new uint256[][](5);
        {
            {
                uint256[] memory baseContext = new uint256[](2);
                context[0] = baseContext;
            }
            {
                uint256[] memory callingContext = new uint256[](3);
                // order hash
                callingContext[0] = orderHash;
                // owner
                callingContext[1] = uint256(uint160(address(this)));
                // counterparty
                callingContext[2] = uint256(uint160(APPROVED_COUNTERPARTY));
                context[1] = callingContext;
            }
            {
                uint256[] memory calculationsContext = new uint256[](2);
                calculationsContext[1] = ORDER_INIT_RATIO_BUY;
                context[2] = calculationsContext;
            }
            {
                uint256[] memory inputsContext = new uint256[](CONTEXT_VAULT_IO_ROWS);
                inputsContext[0] = uint256(uint160(address(POLYGON_NHT_TOKEN_ADDRESS)));
                inputsContext[1] = POLYGON_NHT_TOKEN_DECIMALS;
                inputsContext[2] = vaultId;
                inputsContext[3] = balanceDiff;
                inputsContext[4] = balanceDiff;

                context[3] = inputsContext;
            }
            {
                uint256[] memory outputsContext = new uint256[](CONTEXT_VAULT_IO_ROWS);
                outputsContext[0] = uint256(uint160(address(POLYGON_USDT_TOKEN_ADDRESS)));
                context[4] = outputsContext;
            }
        }

        (bytes memory bytecode, uint256[] memory constants) = iParseExpression(rainstringBuyLimitOrder());
        assertEq(bytecode, EXPECTED_BUY_LIMIT_BYTECODE);

        address interpreter;
        address store;
        address expression;
        {
            (interpreter, store, expression) = iDeployExpression(bytecode, constants);
        }

        LimitOrder memory limitOrder;

        for (uint256 i = 0; i < 10; i++) {
            {
                limitOrder = LimitOrder(orderHash, 0, expression, context, new uint256[](0), new uint256[](0));
                // Eval Calculate_Io Source
                limitOrder = evalLimitOrder(limitOrder);

                // Assert stack[0]
                checkCalculateBuyStack(limitOrder);
                // Set kvs[0]
                IInterpreterStoreV1(store).set(StateNamespace.wrap(0), limitOrder.kvs);
                context = limitOrder.context;
            }
            {
                limitOrder = LimitOrder(orderHash, 1, expression, context, new uint256[](0), new uint256[](0));
                // Eval Handle_Io source
                limitOrder = evalLimitOrder(limitOrder);

                // set kvs[1]
                IInterpreterStoreV1(store).set(StateNamespace.wrap(0), limitOrder.kvs);

                if ((limitOrder.stack[6] / AMOUNT_PER_BATCH) > 0) {
                    // Increment Batch Index
                    vm.warp(block.timestamp + COOLDOWN + 1);
                }
            }
        }
    }

    function calculateBatch(uint256 orderHash, uint256 newReceived18)
        internal
        view
        returns (uint256, uint256, uint256)
    {
        FullyQualifiedNamespace namespace = LibNamespace.qualifyNamespace(StateNamespace.wrap(0), address(this));
        uint256 totalReceivedKey = uint256(keccak256(abi.encodePacked(orderHash)));
        uint256 totalReceived = IInterpreterStoreV1(address(iStore)).get(namespace, totalReceivedKey);
        uint256 newTotalReceived = totalReceived + newReceived18;
        uint256 newBatchIndex = newTotalReceived / AMOUNT_PER_BATCH;
        uint256 newBatchRemaining = ((newBatchIndex + 1) * AMOUNT_PER_BATCH) - newTotalReceived;
        return (newTotalReceived, newBatchIndex, newBatchRemaining);
    }

    function checkCalculateSellStack(LimitOrder memory limitOrder) internal {
        uint256[] memory stack = limitOrder.stack;
        uint256 orderHash = limitOrder.context[1][0];

        (, uint256 batchIndex, uint256 batchRemaining) = calculateBatch(orderHash, 0);

        FullyQualifiedNamespace namespace = LibNamespace.qualifyNamespace(StateNamespace.wrap(0), address(this));
        uint256 batchStartInfo = IInterpreterStoreV1(address(iStore)).get(namespace, orderHash);
        uint256 batchStartTime = decode(32, 32, batchStartInfo);
        uint256 ratioIncrement = UD60x18.unwrap(powu(UD60x18.wrap(INCR_PER_BATCH), batchIndex));
        uint256 ioRatio = ORDER_INIT_RATIO_SELL.fixedPointMul(ratioIncrement, Math.Rounding.Down);

        uint256 amount = batchRemaining.fixedPointDiv(ioRatio, Math.Rounding.Down);

        assertEq(stack[9], uint256(uint160(address(APPROVED_COUNTERPARTY))), "stack 9");
        assertEq(stack[8], uint256(uint160(address(APPROVED_COUNTERPARTY))), "stack 8");
        assertEq(stack[7], orderHash, "stack 7");
        assertEq(stack[6], batchStartInfo, "stack 6");
        assertEq(stack[5], batchStartTime, "stack 5");
        assertEq(stack[4], batchIndex, "stack 4");
        assertEq(stack[3], batchRemaining, "stack 3");
        assertEq(stack[2], ioRatio, "stack 2");
        assertEq(stack[1], amount, "stack 1");
        assertEq(stack[0], ioRatio, "stack 0");
    }

    function checkCalculateBuyStack(LimitOrder memory limitOrder) internal {
        uint256[] memory stack = limitOrder.stack;
        uint256 orderHash = limitOrder.context[1][0];

        (, uint256 batchIndex, uint256 batchRemaining) = calculateBatch(orderHash, 0);
        FullyQualifiedNamespace namespace = LibNamespace.qualifyNamespace(StateNamespace.wrap(0), address(this));
        uint256 batchStartInfo = IInterpreterStoreV1(address(iStore)).get(namespace, orderHash);
        uint256 batchStartTime = decode(32, 32, batchStartInfo);
        uint256 ratioIncrement = UD60x18.unwrap(powu(UD60x18.wrap(INCR_PER_BATCH), batchIndex));
        uint256 ioRatio = ORDER_INIT_RATIO_BUY.fixedPointMul(ratioIncrement, Math.Rounding.Down);

        uint256 amount = batchRemaining;

        assertEq(stack[9], uint256(uint160(address(APPROVED_COUNTERPARTY))), "stack 9");
        assertEq(stack[8], uint256(uint160(address(APPROVED_COUNTERPARTY))), "stack 8");
        assertEq(stack[7], orderHash, "stack 7");
        assertEq(stack[6], batchStartInfo, "stack 6");
        assertEq(stack[5], batchStartTime, "stack 5");
        assertEq(stack[4], batchIndex, "stack 4");
        assertEq(stack[3], batchRemaining, "stack 3");
        assertEq(stack[2], ioRatio, "stack 2");
        assertEq(stack[1], amount, "stack 1");
        assertEq(stack[0], ioRatio, "stack 0");

        console2.log("here1");
    }
}

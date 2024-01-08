// SPDX-License-Identifier: CAL
pragma solidity =0.8.19;

import {console2} from "forge-std/console2.sol";

import {Vm} from "forge-std/Vm.sol";
import {OpTest} from "rain.interpreter/test/util/abstract/OpTest.sol";
import {IInterpreterStoreV1} from "rain.interpreter/src/interface/IInterpreterStoreV1.sol";
import {SignedContextV1} from "rain.interpreter/src/interface/IInterpreterCallerV2.sol";
import "rain.interpreter/lib/rain.uniswapv2/src/lib/LibUniswapV2.sol";
import {EnsureFailed} from "rain.interpreter/src/lib/op/logic/LibOpEnsureNP.sol";
import {
    rainstringSell,
    rainstringBuy,
    BUY_ROUTE,
    SELL_ROUTE,
    SignedContextV1,
    EXPECTED_SELL_BYTECODE,
    EXPECTED_BUY_BYTECODE,
    POLYGON_SUSHI_V2_FACTORY,
    POLYGON_USDT_TOKEN_ADDRESS,
    POLYGON_NHT_TOKEN_ADDRESS,
    APPROVED_COUNTERPARTY,
    MAX_COOLDOWN,
    POLYGON_DEPLOYER_NPE2,
    OrderV2,
    IOrderBookV3,
    POLYGON_ORDERBOOK,
    APPROVED_EOA,
    TakeOrderConfigV2,
    TakeOrdersConfigV2,
    POLYGON_ARB_CONTRACT,
    IInterpreterV2,
    IInterpreterStoreV1,
    IO,
    IERC20,
    MAX_USDT_18,
    EvaluableConfigV3,
    OrderConfigV2,
    SourceIndexV2,
    POLYGON_INTERPRETER_NPE2,
    POLYGON_STORE_NPE2,
    POLYGON_PARSER_NPE2,
    POLYGON_USDT_HOLDER,
    POLYGON_NHT_HOLDER,
    RAINSTRING_JITTERY_BINOMIAL,
    expectedBinomialBuyConstants,
    expectedBinomialSellConstants
} from "src/4SushiV2StratBinomial.sol";
import "lib/rain.interpreter/src/lib/bitwise/LibCtPop.sol";
import "rain.interpreter/lib/rain.math.fixedpoint/src/lib/LibFixedPointDecimalArithmeticOpenZeppelin.sol";
import "rain.interpreter/lib/rain.math.fixedpoint/src/lib/LibFixedPointDecimalScale.sol";
import "test/lib/OrderBookNPE2Real.sol";

uint256 constant CONTEXT_VAULT_IO_ROWS = 5;

uint256 constant FORK_BLOCK_NUMBER = 52085449;
uint256 constant VAULT_ID = uint256(keccak256("vault"));

address constant TEST_ORDER_OWNER = address(0x84723849238);

uint256 constant RESERVE_ZERO = 53138576564435538694955386;
// Using USDT as an example.
uint256 constant RESERVE_ONE = 12270399039;
uint32 constant RESERVE_TIMESTAMP = 1692775490;

contract Test4SushiV2StratBinomial is OrderBookNPE2Real {
    using LibFixedPointDecimalArithmeticOpenZeppelin for uint256;
    using LibFixedPointDecimalScale for uint256;

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

    function placeBuyOrderFork() internal returns (OrderV2 memory) {
        (bytes memory bytecode, uint256[] memory constants) = POLYGON_PARSER_NPE2.parse(rainstringBuy());
        assertEq(bytecode, EXPECTED_BUY_BYTECODE);
        uint256[] memory expectedConstants = expectedBinomialBuyConstants();
        assertEq(expectedConstants.length, constants.length);
        for (uint256 i = 0; i < constants.length; i++) {
            assertEq(constants[i], expectedConstants[i]);
        }
        return placeOrder(bytecode, constants, polygonNhtIo(), polygonUsdtIo());
    }

    function placeSellOrderFork() internal returns (OrderV2 memory order) {
        (bytes memory bytecode, uint256[] memory constants) = POLYGON_PARSER_NPE2.parse(rainstringSell());
        assertEq(bytecode, EXPECTED_SELL_BYTECODE);
        uint256[] memory expectedConstants = expectedBinomialSellConstants();
        assertEq(expectedConstants.length, constants.length);
        for (uint256 i = 0; i < constants.length; i++) {
            assertEq(constants[i], expectedConstants[i]);
        }
        return placeOrder(bytecode, constants, polygonUsdtIo(), polygonNhtIo());
    }

    function getInputVaultBalance(OrderV2 memory order) internal view returns (uint256) {
        return POLYGON_ORDERBOOK.vaultBalance(order.owner, order.validInputs[0].token, order.validInputs[0].vaultId);
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
        assertEq(token.balanceOf(to), amount);
        vm.stopPrank();
    }

    function depositTokens(IERC20 token, uint256 vaultId, uint256 amount) internal {
        vm.startPrank(TEST_ORDER_OWNER);
        token.approve(address(POLYGON_ORDERBOOK), amount);
        POLYGON_ORDERBOOK.deposit(address(token), vaultId, amount);
        vm.stopPrank();
    }

    function testSellOrderHappyFork() public {
        selectPolygonFork();
        {
            // Deposit NHT.
            uint256 depositAmount = 100000000e18;
            giveTestAccountsTokens(POLYGON_NHT_TOKEN_ADDRESS, POLYGON_NHT_HOLDER, TEST_ORDER_OWNER, depositAmount);
            depositTokens(POLYGON_NHT_TOKEN_ADDRESS, VAULT_ID, depositAmount);
        }
        OrderV2 memory sellOrder = placeSellOrderFork();

        for (uint256 i = 0; i < 10; i++) {
            takeOrder(sellOrder, SELL_ROUTE);
            vm.warp(block.timestamp + MAX_COOLDOWN);
        }
    }

    function testBuyOrderHappyFork() public {
        selectPolygonFork();
        {
            // Deposit USDT.
            uint256 depositAmount = 1000e6;
            giveTestAccountsTokens(POLYGON_USDT_TOKEN_ADDRESS, POLYGON_USDT_HOLDER, TEST_ORDER_OWNER, depositAmount);
            depositTokens(POLYGON_USDT_TOKEN_ADDRESS, VAULT_ID, depositAmount);
        }
        OrderV2 memory buyOrder = placeBuyOrderFork();

        for (uint256 i = 0; i < 10; i++) {
            takeOrder(buyOrder, BUY_ROUTE);
            vm.warp(block.timestamp + MAX_COOLDOWN);
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

    function test4StratBuyNHTHappyPath(uint256 orderHash, uint16 startTime) public {
        uint256 reserve0 = 53138576564435538694955386;
        uint256 reserve1 = 12270399039;
        uint32 reserveTimestamp = 1692775490;
        uint256 lastTime = 0;
        vm.warp(reserveTimestamp + startTime + 1);

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
                inputsContext[0] = uint256(uint160(address(POLYGON_NHT_TOKEN_ADDRESS)));
                context[3] = inputsContext;
            }
            {
                uint256[] memory outputsContext = new uint256[](CONTEXT_VAULT_IO_ROWS);
                outputsContext[0] = uint256(uint160(address(POLYGON_USDT_TOKEN_ADDRESS)));
                context[4] = outputsContext;
            }
        }

        {
            address expectedPair = LibUniswapV2.pairFor(
                POLYGON_SUSHI_V2_FACTORY, address(POLYGON_NHT_TOKEN_ADDRESS), address(POLYGON_USDT_TOKEN_ADDRESS)
            );
            vm.etch(POLYGON_SUSHI_V2_FACTORY, hex"fe");
            vm.mockCall(
                POLYGON_SUSHI_V2_FACTORY,
                abi.encodeWithSelector(IUniswapV2Factory.getPair.selector),
                abi.encode(expectedPair)
            );
            vm.etch(expectedPair, hex"fe");
            vm.mockCall(
                expectedPair,
                abi.encodeWithSelector(IUniswapV2Pair.getReserves.selector),
                abi.encode(reserve0, reserve1, reserveTimestamp)
            );
        }

        address interpreterDeployer;
        address storeDeployer;
        address expression;
        {
            (bytes memory bytecode, uint256[] memory constants) = iParseExpression(rainstringBuy());
            assertEq(bytecode, EXPECTED_BUY_BYTECODE);
            (interpreterDeployer, storeDeployer, expression) = iDeployExpression(bytecode, constants);
        }

        // At this point the cooldown has never triggered so it can eval.
        (uint256[] memory stack, uint256[] memory kvs) =
            iEvalExpression(expression, interpreterDeployer, storeDeployer, context, new uint256[](0));
        IInterpreterStoreV1(storeDeployer).set(StateNamespace.wrap(0), kvs);
        checkBuyCalculate(stack, kvs, orderHash, lastTime, reserveTimestamp);
        lastTime = block.timestamp;

        {
            // Check the first cooldown against what we expect.
            // last time is 0 originally.
            uint256 cooldown0 = cooldown(block.timestamp);
            vm.warp(block.timestamp + cooldown0);

            // At this point the cooldown is not expired.
            vm.expectRevert(abi.encodeWithSelector(EnsureFailed.selector, 1, 0));
            (stack, kvs) = iEvalExpression(expression, interpreterDeployer, storeDeployer, context, new uint256[](0));
            (stack, kvs);
        }

        {
            // The cooldown is expired one second later.
            vm.warp(block.timestamp + 1);
            (stack, kvs) = iEvalExpression(expression, interpreterDeployer, storeDeployer, context, new uint256[](0));
            IInterpreterStoreV1(storeDeployer).set(StateNamespace.wrap(0), kvs);
            checkBuyCalculate(stack, kvs, orderHash, lastTime, reserveTimestamp);
        }
    }

    function test4StratSellNHTHappyPath(uint256 orderHash, uint16 startTime) public {
        uint256 lastTime = 0;
        vm.warp(RESERVE_TIMESTAMP + startTime + 1);

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
                context[3] = inputsContext;
            }
            {
                uint256[] memory outputsContext = new uint256[](CONTEXT_VAULT_IO_ROWS);
                outputsContext[0] = uint256(uint160(address(POLYGON_NHT_TOKEN_ADDRESS)));
                context[4] = outputsContext;
            }
        }

        {
            address expectedPair = LibUniswapV2.pairFor(
                POLYGON_SUSHI_V2_FACTORY, address(POLYGON_NHT_TOKEN_ADDRESS), address(POLYGON_USDT_TOKEN_ADDRESS)
            );
            vm.etch(POLYGON_SUSHI_V2_FACTORY, hex"fe");
            vm.mockCall(
                POLYGON_SUSHI_V2_FACTORY,
                abi.encodeWithSelector(IUniswapV2Factory.getPair.selector),
                abi.encode(expectedPair)
            );
            vm.etch(expectedPair, hex"fe");
            vm.mockCall(
                expectedPair,
                abi.encodeWithSelector(IUniswapV2Pair.getReserves.selector),
                abi.encode(RESERVE_ZERO, RESERVE_ONE, RESERVE_TIMESTAMP)
            );
        }

        address interpreterDeployer;
        address storeDeployer;
        address expression;
        {
            (bytes memory bytecode, uint256[] memory constants) = iParser.parse(rainstringSell());
            assertEq(bytecode, EXPECTED_SELL_BYTECODE);
            (interpreterDeployer, storeDeployer, expression) = iDeployExpression(bytecode, constants);
        }

        // At this point the cooldown has never triggered so it can eval.
        (uint256[] memory stack, uint256[] memory kvs) =
            iEvalExpression(expression, interpreterDeployer, storeDeployer, context, new uint256[](0));

        IInterpreterStoreV1(storeDeployer).set(StateNamespace.wrap(0), kvs);
        checkSellCalculate(stack, kvs, orderHash, lastTime, RESERVE_TIMESTAMP);
        lastTime = block.timestamp;

        {
            // Check the first cooldown against what we expect.
            // last time is 0 originally.
            vm.warp(block.timestamp + cooldown(block.timestamp));

            // At this point the cooldown is not expired.
            vm.expectRevert(abi.encodeWithSelector(EnsureFailed.selector, 1, 0));
            (stack, kvs) = iEvalExpression(expression, interpreterDeployer, storeDeployer, context, new uint256[](0));
            (stack, kvs);
        }

        {
            // The cooldown is expired one second later.
            vm.warp(block.timestamp + 1);
            (stack, kvs) = iEvalExpression(expression, interpreterDeployer, storeDeployer, context, new uint256[](0));
            IInterpreterStoreV1(storeDeployer).set(StateNamespace.wrap(0), kvs);
            checkSellCalculate(stack, kvs, orderHash, lastTime, RESERVE_TIMESTAMP);
        }
    }

    function testJitteryBinomial(uint256 input) public {
        // Parser and Deploy expression
        (bytes memory bytecode, uint256[] memory constants) = iParser.parse(RAINSTRING_JITTERY_BINOMIAL);
        (address interpreter, address store, address expression) = iDeployExpression(bytecode, constants);

        uint256[][] memory context = new uint256[][](0);
        uint256[] memory inputs = new uint256[](1);
        inputs[0] = input;

        // Eval RAINSTRING_JITTERY_BINOMIAL expression
        (uint256[] memory stack, uint256[] memory kvs) =
            iEvalExpression(expression, interpreter, store, context, inputs);
        (kvs);
        uint256 expectedJitteryBinomial = jitteryBinomial(input);

        // Assert stack 0
        assertEq(stack[0], expectedJitteryBinomial);
    }

    function decodeBits(uint256 operand, uint256 input) internal pure returns (uint256 output) {
        uint256 startBit = operand & 0xFF;
        uint256 length = (operand >> 8) & 0xFF;

        uint256 mask = (2 ** length) - 1;
        output = (input >> startBit) & mask;
    }

    function jitteryBinomial(uint256 input) internal pure returns (uint256) {
        uint256 inputHash = uint256(keccak256(abi.encodePacked(input)));
        uint256 binomial = LibCtPop.ctpop(decodeBits(0x010A00, inputHash)) * 1e18;
        uint256 noise = uint256(keccak256(abi.encodePacked(input, uint256(0)))) % 1e18;

        uint256 jittery = binomial + noise;

        return jittery.fixedPointDiv(11e18, Math.Rounding.Down);
    }

    function cooldown(uint256 lastTime) internal pure returns (uint256) {
        uint256 multiplier = jitteryBinomial(uint256(keccak256(abi.encodePacked(lastTime))));
        return MAX_COOLDOWN.scale18(0, 0).fixedPointMul(multiplier, Math.Rounding.Down).scaleN(0, 0);
    }

    function checkSellCalculate(
        uint256[] memory stack,
        uint256[] memory kvs,
        uint256 orderHash,
        uint256 lastTime,
        uint256 sushiLastTime
    ) internal {
        // always track the timestamp that cooldowns are relative to.
        assertEq(kvs.length, 2);
        assertEq(kvs[0], orderHash);
        assertEq(kvs[1], block.timestamp);

        assertEq(stack.length, 19);

        // addresses
        // sushi factory
        assertEq(stack[18], uint256(uint160(address(POLYGON_SUSHI_V2_FACTORY))));
        // nht token
        assertEq(stack[17], uint256(uint160(address(POLYGON_NHT_TOKEN_ADDRESS))));
        // usdt token
        assertEq(stack[16], uint256(uint160(address(POLYGON_USDT_TOKEN_ADDRESS))));
        // approved counterparty
        assertEq(stack[15], uint256(uint160(APPROVED_COUNTERPARTY)));
        // actual counterparty
        assertEq(stack[14], uint256(uint160(APPROVED_COUNTERPARTY)));
        // order hash
        assertEq(stack[13], orderHash);
        // last time
        assertEq(stack[12], lastTime);
        // max usdt amount
        assertEq(stack[11], MAX_USDT_18);
        // amount random multiplier
        assertEq(stack[10], jitteryBinomial(lastTime));
        // target usdt amount e18
        assertEq(stack[9], MAX_USDT_18 * jitteryBinomial(lastTime) / 1e18);
        // target usdt amount e6
        assertEq(stack[8], stack[9].scaleN(6, 1));
        // max cooldown e18
        assertEq(stack[7], MAX_COOLDOWN * 1e18);
        // cooldown random multiplier 18
        assertEq(stack[6], jitteryBinomial(uint256(keccak256(abi.encode(lastTime)))));
        // cooldown e18
        assertEq(stack[5], stack[7].fixedPointMul(stack[6], Math.Rounding.Up));
        // cooldown e0
        assertEq(stack[4], stack[5].scaleN(0, 0));
        // last price timestamp
        assertEq(stack[3], sushiLastTime);
        // nht amount 18
        assertEq(stack[2], LibUniswapV2.getAmountIn(stack[8], RESERVE_ZERO, RESERVE_ONE));
        // amount is nht amount 18
        assertEq(stack[1], stack[2]);
        // ratio is the usdt 18 amount divided by the nht 18 amount
        assertEq(stack[0], stack[9].fixedPointDiv(stack[2], Math.Rounding.Down));
    }

    function checkBuyCalculate(
        uint256[] memory stack,
        uint256[] memory kvs,
        uint256 orderHash,
        uint256 lastTime,
        uint256 sushiLastTime
    ) internal {
        // always track the timestamp that cooldowns are relative to.
        assertEq(kvs.length, 2);
        assertEq(kvs[0], orderHash);
        assertEq(kvs[1], block.timestamp);

        assertEq(stack.length, 19);

        // addresses
        // sushi factory
        assertEq(stack[18], uint256(uint160(address(POLYGON_SUSHI_V2_FACTORY))));
        // nht token
        assertEq(stack[17], uint256(uint160(address(POLYGON_NHT_TOKEN_ADDRESS))));
        // usdt token
        assertEq(stack[16], uint256(uint160(address(POLYGON_USDT_TOKEN_ADDRESS))));
        // approved counterparty
        assertEq(stack[15], uint256(uint160(APPROVED_COUNTERPARTY)));
        // actual counterparty
        assertEq(stack[14], uint256(uint160(APPROVED_COUNTERPARTY)));
        // order hash
        assertEq(stack[13], orderHash);
        // last time
        assertEq(stack[12], lastTime);
        // max usdt amount
        assertEq(stack[11], MAX_USDT_18);
        // amount random multiplier
        assertEq(stack[10], jitteryBinomial(lastTime));
        // target usdt amount e18
        assertEq(stack[9], MAX_USDT_18 * jitteryBinomial(lastTime) / 1e18);
        // target usdt amount e6
        assertEq(stack[8], stack[9] / 1e12);
        // max cooldown e18
        assertEq(stack[7], MAX_COOLDOWN * 1e18);
        // cooldown random multiplier 18
        assertEq(stack[6], jitteryBinomial(uint256(keccak256(abi.encode(lastTime)))));
        // cooldown e18
        assertEq(stack[5], stack[7] * stack[6] / 1e18);
        // cooldown e0
        assertEq(stack[4], stack[5] / 1e18);
        // last price timestamp
        assertEq(stack[3], sushiLastTime);
        // nht amount 18
        assertEq(stack[2], LibUniswapV2.getAmountOut(stack[8], RESERVE_ONE, RESERVE_ZERO));
        // amount is usdt amount 18
        assertEq(stack[1], stack[9]);
        // io ratio is the nht amount 18 divided by the usdt 18 amount
        assertEq(stack[0], stack[2] * 1e18 / stack[9]);
    }
}

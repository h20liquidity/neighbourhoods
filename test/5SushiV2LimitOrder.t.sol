// SPDX-License-Identifier: CAL
pragma solidity =0.8.19;

import "test/util/Test5SushiV2LimitOrderUtil.sol";
import {console2} from "forge-std/console2.sol";
import {
    rainstringSellLimitOrder,
    rainstringBuyLimitOrder,
    ORDER_INIT_RATIO_SELL,
    ORDER_INIT_RATIO_BUY,
    AMOUNT_PER_BATCH,
    INCR_PER_BATCH
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
    IInterpreterStoreV1
} from "src/4SushiV2StratBinomial.sol";
import "rain.interpreter/lib/rain.math.fixedpoint/src/lib/LibFixedPointDecimalArithmeticOpenZeppelin.sol";
import "rain.interpreter/lib/rain.math.fixedpoint/src/lib/LibFixedPointDecimalScale.sol";
import {UD60x18, powu} from "rain.interpreter/lib/prb-math/src/UD60x18.sol";

contract Test4SushiV2LimitOrder is Test5SushiV2LimitOrderUtil {
    using LibFixedPointDecimalArithmeticOpenZeppelin for uint256;
    using LibFixedPointDecimalScale for uint256;

    string constant FORK_RPC = "https://polygon.llamarpc.com";
    uint256 constant FORK_BLOCK_NUMBER = 50715909;

    uint32 constant RESERVE_TIMESTAMP = 1701608565;

    uint256 constant CONTEXT_VAULT_IO_ROWS = 5;

    function selectPolygonFork() internal {
        uint256 fork = vm.createFork(FORK_RPC);
        vm.selectFork(fork);
        vm.rollFork(FORK_BLOCK_NUMBER);
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

        address interpreter;
        address store;
        address expression;
        {
            (interpreter, store, expression) = iDeployExpression(bytecode, constants);
        }

        LimitOrder memory limitOrder;
        for (uint256 i = 0; i < 10; i++) {
            {
                limitOrder = LimitOrder(orderHash, 0, expression, context, new uint256[](0), new uint256[](0), 0);
                // Eval Calculate_Io Source
                limitOrder = evalLimitOrder(limitOrder);
                // Assert stack[0]
                checkCalculateSellStack(limitOrder);
                // Set kvs[0]
                IInterpreterStoreV1(store).set(StateNamespace.wrap(0), limitOrder.kvs);
                context = limitOrder.context;
            }

            {
                limitOrder = LimitOrder(orderHash, 1, expression, context, new uint256[](0), new uint256[](0), 0);
                // Eval Handle_Io source
                limitOrder = evalLimitOrder(limitOrder);
                // set kvs[1]
                IInterpreterStoreV1(store).set(StateNamespace.wrap(0), limitOrder.kvs);

                // Check if floor of div is greater than 0
                if (((limitOrder.stack[6].scale18(POLYGON_USDT_TOKEN_DECIMALS, 1)) / AMOUNT_PER_BATCH) > 0) {
                    // Increment Batch Index
                    vm.warp(block.timestamp + 3600 + 1);
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

        address interpreter;
        address store;
        address expression;
        {
            (interpreter, store, expression) = iDeployExpression(bytecode, constants);
        }

        LimitOrder memory limitOrder;

        for (uint256 i = 0; i < 10; i++) {
            {
                limitOrder = LimitOrder(orderHash, 0, expression, context, new uint256[](0), new uint256[](0), 0);
                // Eval Calculate_Io Source
                limitOrder = evalLimitOrder(limitOrder);

                // Assert stack[0]
                checkCalculateBuyStack(limitOrder);
                // Set kvs[0]
                IInterpreterStoreV1(store).set(StateNamespace.wrap(0), limitOrder.kvs);
                context = limitOrder.context;
            }
            {
                limitOrder = LimitOrder(orderHash, 1, expression, context, new uint256[](0), new uint256[](0), 0);
                // Eval Handle_Io source
                limitOrder = evalLimitOrder(limitOrder);

                // set kvs[1]
                IInterpreterStoreV1(store).set(StateNamespace.wrap(0), limitOrder.kvs);

                if ((limitOrder.stack[6] / AMOUNT_PER_BATCH) > 0) {
                    // Increment Batch Index
                    vm.warp(block.timestamp + 3600 + 1);
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
        uint256 balanceDiff = 0;
        (, uint256 batchIndex, uint256 batchRemaining) =
            calculateBatch(orderHash, balanceDiff.scale18(limitOrder.context[3][1], 0));

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
        uint256 balanceDiff = 0;
        (, uint256 batchIndex, uint256 batchRemaining) =
            calculateBatch(orderHash, balanceDiff.scale18(limitOrder.context[3][1], 0));
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

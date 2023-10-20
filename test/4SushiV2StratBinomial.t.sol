// SPDX-License-Identifier: CAL
pragma solidity =0.8.19;

import {console2} from "forge-std/console2.sol";

import {OpTest} from "rain.interpreter/test/util/abstract/OpTest.sol";
import {StateNamespace, IInterpreterV1, SourceIndex} from "rain.interpreter/src/interface/IInterpreterV1.sol";
import {IInterpreterStoreV1} from "rain.interpreter/src/interface/IInterpreterStoreV1.sol";
import {LibEncodedDispatch} from "rain.interpreter/src/lib/caller/LibEncodedDispatch.sol";
import {SignedContextV1} from "rain.interpreter/src/interface/IInterpreterCallerV2.sol";
import {LibContext} from "rain.interpreter/src/lib/caller/LibContext.sol";
import {LibUniswapV2, IUniswapV2Pair} from "rain.interpreter/src/lib/uniswap/LibUniswapV2.sol";
import {IUniswapV2Factory} from "rain.interpreter/lib/v2-core/contracts/interfaces/IUniswapV2Factory.sol";
import {EnsureFailed} from "rain.interpreter/src/lib/op/logic/LibOpEnsureNP.sol";
import {
    rainstringSell,
    rainstringBuy,
    EXPECTED_SELL_BYTECODE,
    POLYGON_SUSHI_V2_FACTORY,
    POLYGON_USDT_TOKEN_ADDRESS,
    POLYGON_NHT_TOKEN_ADDRESS,
    APPROVED_COUNTERPARTY,
    MAX_COOLDOWN
} from "src/4SushiV2StratBinomial.sol";
import {LibCtPop} from "rain.interpreter/src/lib/bitwise/LibCtPop.sol";

uint256 constant CONTEXT_VAULT_IO_ROWS = 5;

string constant FORK_RPC = "https://polygon.llamarpc.com";
uint256 constant FORK_BLOCK_NUMBER = 48315276;
// taken from block explorer.
// uint256 constant FORK_BLOCK_TIME = 1696419600;

contract Test4SushiV2StratBinomial is OpTest {
    function constructionMetaPath() internal pure override returns (string memory) {
        return "lib/rain.interpreter/meta/RainterpreterExpressionDeployerNP.rain.meta";
    }

    function selectPolygonFork() internal {
        uint256 fork = vm.createFork(FORK_RPC);
        vm.selectFork(fork);
        vm.rollFork(FORK_BLOCK_NUMBER);
        // vm.warp(FORK_BLOCK_TIME);
    }

    function parseAndEvalWithContext(
        bytes memory expectedBytecode,
        bytes memory rainString,
        uint256[][] memory context,
        SourceIndex sourceIndex
    ) internal returns (uint256[] memory, uint256[] memory) {
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

    function test4StratBuyNHTHappyPath(uint256 orderHash, uint16 startTime) public {
        uint256 reserve0 = 53138576564435538694955386;
        uint256 reserve1 = 12270399039;
        uint32 reserveTimestamp = 1692775490;
        uint256 lastTime = 0;
        vm.warp(reserveTimestamp + startTime + 1);

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
            inputsContext[0] = uint256(uint160(address(POLYGON_NHT_TOKEN_ADDRESS)));
            context[2] = inputsContext;
        }
        {
            uint256[] memory outputsContext = new uint256[](CONTEXT_VAULT_IO_ROWS);
            outputsContext[0] = uint256(uint160(address(POLYGON_USDT_TOKEN_ADDRESS)));
            context[3] = outputsContext;
        }
        context = LibContext.build(context, new SignedContextV1[](0));

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

        IInterpreterV1 interpreterDeployer;
        IInterpreterStoreV1 storeDeployer;
        address expression;
        {
            (bytes memory bytecode, uint256[] memory constants) = iDeployer.parse(rainstringBuy());
            // assertEq(bytecode, EXPECTED_BUY_BYTECODE);
            uint256[] memory minOutputs = new uint256[](1);
            minOutputs[0] = 0;
            (interpreterDeployer, storeDeployer, expression) =
                iDeployer.deployExpression(bytecode, constants, minOutputs);
        }

        // At this point the cooldown has never triggered so it can eval.
        (uint256[] memory stack, uint256[] memory kvs) = interpreterDeployer.eval(
            storeDeployer,
            StateNamespace.wrap(0),
            LibEncodedDispatch.encode(expression, SourceIndex.wrap(0), type(uint16).max),
            context
        );
        storeDeployer.set(StateNamespace.wrap(0), kvs);
        checkBuyCalculate(stack, kvs, orderHash, lastTime, reserveTimestamp);
        lastTime = block.timestamp;

        // Check the first cooldown against what we expect.
        // last time is 0 originally.
        uint256 cooldown0 = cooldown(block.timestamp);
        vm.warp(block.timestamp + cooldown0);

        // At this point the cooldown is not expired.
        vm.expectRevert(abi.encodeWithSelector(EnsureFailed.selector, 1, 0));
        (stack, kvs) = interpreterDeployer.eval(
            storeDeployer,
            StateNamespace.wrap(0),
            LibEncodedDispatch.encode(expression, SourceIndex.wrap(0), type(uint16).max),
            context
        );
        (stack, kvs);

        // The cooldown is expired one second later.
        vm.warp(block.timestamp + 1);
        (stack, kvs) = interpreterDeployer.eval(
            storeDeployer,
            StateNamespace.wrap(0),
            LibEncodedDispatch.encode(expression, SourceIndex.wrap(0), type(uint16).max),
            context
        );
        storeDeployer.set(StateNamespace.wrap(0), kvs);
        checkBuyCalculate(stack, kvs, orderHash, lastTime, reserveTimestamp);
    }

    function test4StratSellNHTHappyPath(uint256 orderHash, uint16 startTime) public {
        uint256 reserve0 = 53138576564435538694955386;
        // Using USDT as an example.
        uint256 reserve1 = 12270399039;
        uint32 reserveTimestamp = 1692775490;
        uint256 lastTime = 0;
        vm.warp(reserveTimestamp + startTime + 1);

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
            inputsContext[0] = uint256(uint160(address(POLYGON_USDT_TOKEN_ADDRESS)));
            context[2] = inputsContext;
        }
        {
            uint256[] memory outputsContext = new uint256[](CONTEXT_VAULT_IO_ROWS);
            outputsContext[0] = uint256(uint160(address(POLYGON_NHT_TOKEN_ADDRESS)));
            context[3] = outputsContext;
        }
        context = LibContext.build(context, new SignedContextV1[](0));

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

        IInterpreterV1 interpreterDeployer;
        IInterpreterStoreV1 storeDeployer;
        address expression;
        {
            (bytes memory bytecode, uint256[] memory constants) = iDeployer.parse(rainstringSell());
            // assertEq(bytecode, EXPECTED_SELL_BYTECODE);
            uint256[] memory minOutputs = new uint256[](1);
            minOutputs[0] = 0;
            (interpreterDeployer, storeDeployer, expression) =
                iDeployer.deployExpression(bytecode, constants, minOutputs);
        }

        // At this point the cooldown has never triggered so it can eval.
        (uint256[] memory stack, uint256[] memory kvs) = interpreterDeployer.eval(
            storeDeployer,
            StateNamespace.wrap(0),
            LibEncodedDispatch.encode(expression, SourceIndex.wrap(0), type(uint16).max),
            context
        );
        storeDeployer.set(StateNamespace.wrap(0), kvs);
        checkSellCalculate(stack, kvs, orderHash, lastTime, reserveTimestamp);
        lastTime = block.timestamp;

        // Check the first cooldown against what we expect.
        // last time is 0 originally.
        uint256 cooldown0 = cooldown(block.timestamp);
        vm.warp(block.timestamp + cooldown0);

        // At this point the cooldown is not expired.
        vm.expectRevert(abi.encodeWithSelector(EnsureFailed.selector, 1, 0));
        (stack, kvs) = interpreterDeployer.eval(
            storeDeployer,
            StateNamespace.wrap(0),
            LibEncodedDispatch.encode(expression, SourceIndex.wrap(0), type(uint16).max),
            context
        );
        (stack, kvs);

        // The cooldown is expired one second later.
        vm.warp(block.timestamp + 1);
        (stack, kvs) = interpreterDeployer.eval(
            storeDeployer,
            StateNamespace.wrap(0),
            LibEncodedDispatch.encode(expression, SourceIndex.wrap(0), type(uint16).max),
            context
        );
        storeDeployer.set(StateNamespace.wrap(0), kvs);
        checkSellCalculate(stack, kvs, orderHash, lastTime, reserveTimestamp);
    }

    function jitteryBinomial(uint256 input) internal pure returns (uint256) {
        uint256 binomial = LibCtPop.ctpop(uint256(keccak256(abi.encodePacked(
            input
        )))) * 1e18;
        uint256 noise = uint256(keccak256(abi.encodePacked(input, uint256(0)))) % 1e18;

        uint256 jittery = binomial + noise - 5e17;

        return jittery * 1e18 / 256e18;
    }

    function cooldown(uint256 seed) internal pure returns (uint256) {
        uint256 multiplier = jitteryBinomial(uint256(keccak256(abi.encodePacked(seed))));
        return MAX_COOLDOWN * multiplier / 1e18;
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
        assertEq(stack[0], uint256(uint160(address(POLYGON_SUSHI_V2_FACTORY))));
        // nht token
        assertEq(stack[1], uint256(uint160(address(POLYGON_NHT_TOKEN_ADDRESS))));
        // usdt token
        assertEq(stack[2], uint256(uint160(address(POLYGON_USDT_TOKEN_ADDRESS))));
        // approved counterparty
        assertEq(stack[3], uint256(uint160(APPROVED_COUNTERPARTY)));
        // actual counterparty
        assertEq(stack[4], uint256(uint160(APPROVED_COUNTERPARTY)));
        // order hash
        assertEq(stack[5], orderHash);
        // last time
        assertEq(stack[6], lastTime);
        // max usdt amount
        assertEq(stack[7], 100e18);
        // amount random multiplier
        assertEq(stack[8], jitteryBinomial(lastTime));
        // target usdt amount e18
        assertEq(stack[9], 100e18 * jitteryBinomial(lastTime) / 1e18);
        // target usdt amount e6
        assertEq(stack[10], stack[9] / 1e12);
        // max cooldown e18
        assertEq(stack[11], MAX_COOLDOWN * 1e18);
        // cooldown random multiplier 18
        assertEq(stack[12], jitteryBinomial(uint256(keccak256(abi.encode(lastTime)))));
        // cooldown e18
        assertEq(stack[13], stack[11] * stack[12] / 1e18);
        // cooldown e0
        assertEq(stack[14], stack[13] / 1e18);
        // last price timestamp
        assertEq(stack[15], sushiLastTime);
        // nht amount 18
        // assertEq(stack[16], 0);
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
        assertEq(stack[0], uint256(uint160(address(POLYGON_SUSHI_V2_FACTORY))));
        // nht token
        assertEq(stack[1], uint256(uint160(address(POLYGON_NHT_TOKEN_ADDRESS))));
        // usdt token
        assertEq(stack[2], uint256(uint160(address(POLYGON_USDT_TOKEN_ADDRESS))));
        // approved counterparty
        assertEq(stack[3], uint256(uint160(APPROVED_COUNTERPARTY)));
        // actual counterparty
        assertEq(stack[4], uint256(uint160(APPROVED_COUNTERPARTY)));
        // order hash
        assertEq(stack[5], orderHash);
        // last time
        assertEq(stack[6], lastTime);
        // max usdt amount
        assertEq(stack[7], 100e18);
        // amount random multiplier
        assertEq(stack[8], jitteryBinomial(lastTime));
        // target usdt amount e18
        assertEq(stack[9], 100e18 * jitteryBinomial(lastTime) / 1e18);
        // target usdt amount e6
        assertEq(stack[10], stack[9] / 1e12);
        // max cooldown e18
        assertEq(stack[11], MAX_COOLDOWN * 1e18);
        // cooldown random multiplier 18
        assertEq(stack[12], jitteryBinomial(uint256(keccak256(abi.encode(lastTime)))));
        // cooldown e18
        assertEq(stack[13], stack[11] * stack[12] / 1e18);
        // cooldown e0
        assertEq(stack[14], stack[13] / 1e18);
        // last price timestamp
        assertEq(stack[15], sushiLastTime);
        // nht amount 18
        // assertEq(stack[16], 0);
    }

}

// SPDX-License-Identifier: CAL
pragma solidity =0.8.19;

import {OpTest} from "rain.interpreter/test/util/abstract/OpTest.sol";
import {StateNamespace, IInterpreterV1, SourceIndex} from "rain.interpreter/src/interface/IInterpreterV1.sol";
import {IInterpreterStoreV1} from "rain.interpreter/src/interface/IInterpreterStoreV1.sol";
import {LibEncodedDispatch} from "rain.interpreter/src/lib/caller/LibEncodedDispatch.sol";
import {SignedContextV1} from "rain.interpreter/src/interface/IInterpreterCallerV2.sol";
import {LibContext} from "rain.interpreter/src/lib/caller/LibContext.sol";
import {LibUniswapV2} from "rain.interpreter/src/lib/uniswap/LibUniswapV2.sol";
import {IUniswapV2Factory} from "rain.interpreter/lib/v2-core/contracts/interfaces/IUniswapV2Factory.sol";

import "src/4SushiV2StratBinomial.sol";

uint256 constant CONTEXT_VAULT_IO_ROWS = 5;

string constant FORK_RPC = "https://polygon.llamarpc.com";
uint256 constant FORK_BLOCK_NUMBER = 48315276;

contract Test4SushiV2StratBinomial is OpTest {
    function selectPolygonFork() internal {
        uint256 fork = vm.createFork(FORK_RPC);
        vm.selectFork(fork);
        vm.rollFork(FORK_BLOCK_NUMBER);
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
            inputsContext[0] = uint256(uint160(address(POLYGON_USDT_TOKEN_ADDRESS)));
            context[2] = inputsContext;
        }
        {
            uint256[] memory outputsContext = new uint256[](CONTEXT_VAULT_IO_ROWS);
            outputsContext[0] = uint256(uint160(address(POLYGON_NHT_TOKEN_ADDRESS)));
            context[3] = outputsContext;
        }
        context = LibContext.build(context, new SignedContextV1[](0));

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

        uint256 orderInitTime = uint256(reserveTimestamp) + 1;
        // Give it an hour so we can clear the handle io check.
        uint256 duration = 3600;
        vm.warp(orderInitTime + duration);

        (uint256[] memory stack, uint256[] memory kvs) =
            parseAndEvalWithContext(EXPECTED_SELL_BYTECODE, rainstringSell(), context, SourceIndex.wrap(0));
    }
}
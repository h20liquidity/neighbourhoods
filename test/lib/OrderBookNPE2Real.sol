// SPDX-License-Identifier: CAL
pragma solidity =0.8.19; 

import {OpTest} from "rain.interpreter/test/util/abstract/OpTest.sol";
import {StateNamespace, LibNamespace, FullyQualifiedNamespace} from "rain.interpreter/src/lib/ns/LibNamespace.sol";

import {
    IInterpreterV2,
    IInterpreterStoreV1,
    SourceIndexV2
} from "src/4SushiV2StratBinomial.sol";
import {LibEncodedDispatch} from "lib/rain.interpreter/src/lib/caller/LibEncodedDispatch.sol";

contract OrderBookNPE2Real is OpTest {

    function constructionMetaPath() internal pure override returns (string memory) {
        return "lib/rain.interpreter/meta/RainterpreterExpressionDeployerNPE2.rain.meta";
    }

    function iParseExpression(bytes memory expressionString)
        internal
        view
        returns (bytes memory bytecode, uint256[] memory constants)
    {
        (bytecode, constants) = iParser.parse(expressionString);
    }

    function iDeployExpression(bytes memory bytecode, uint256[] memory constants)
        internal
        returns (address, address, address)
    {
        IInterpreterV2 interpreter;
        IInterpreterStoreV1 store;
        address expression;
        (interpreter, store, expression,) = iDeployer.deployExpression2(bytecode, constants);
        return (address(interpreter), address(store), expression);
    }

    function iEvalExpression(
        address expression,
        address interpreter,
        address store,
        uint256[][] memory context,
        uint256[] memory inputs
    ) internal view returns (uint256[] memory, uint256[] memory) {
        FullyQualifiedNamespace namespace = LibNamespace.qualifyNamespace(StateNamespace.wrap(0), address(this));
        (uint256[] memory stack, uint256[] memory kvs) = IInterpreterV2(interpreter).eval2(
            IInterpreterStoreV1(address(store)),
            namespace,
            LibEncodedDispatch.encode2(expression, SourceIndexV2.wrap(0), type(uint16).max),
            context,
            inputs
        );
        return (stack, kvs);
    } 
    

}
// SPDX-License-Identifier: CAL
pragma solidity =0.8.19;

import "test/lib/OrderBookNPE2Real.sol";

contract Test5SushiV2LimitOrderUtil is OrderBookNPE2Real {
    struct LimitOrder {
        uint256 orderHash;
        uint256 sourceIndex;
        address expression;
        uint256[][] context;
        uint256[] stack;
        uint256[] kvs;
        uint256 balanceDiff;
    }

    function evalLimitOrder(LimitOrder memory limitOrder) internal view returns (LimitOrder memory) {
        FullyQualifiedNamespace namespace = LibNamespace.qualifyNamespace(StateNamespace.wrap(0), address(this));
        (uint256[] memory stack, uint256[] memory kvs) = IInterpreterV2(address(iInterpreter)).eval2(
            IInterpreterStoreV1(address(iStore)),
            namespace,
            LibEncodedDispatch.encode2(
                limitOrder.expression, SourceIndexV2.wrap(limitOrder.sourceIndex), type(uint16).max
            ),
            limitOrder.context,
            new uint256[](0)
        );
        limitOrder.stack = stack;
        limitOrder.kvs = kvs;

        return limitOrder;
    }
}

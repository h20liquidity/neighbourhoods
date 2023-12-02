// SPDX-License-Identifier: CAL
pragma solidity =0.8.19; 
import "test/lib/OrderBookNPE2Real.sol";
import {console2} from "forge-std/console2.sol";
import {rainstringLimitOrder} from "src/5SushiV2LimitOrder.sol";
import {POLYGON_PARSER_NPE2} from "src/4SushiV2StratBinomial.sol"; 

contract Test4SushiV2LimitOrder is OrderBookNPE2Real {

    string constant FORK_RPC = "https://polygon.llamarpc.com";
    uint256 constant FORK_BLOCK_NUMBER = 50654283; 
    
    function selectPolygonFork() internal {
        uint256 fork = vm.createFork(FORK_RPC);
        vm.selectFork(fork);
        vm.rollFork(FORK_BLOCK_NUMBER);
    } 

    function testLimitOrderParser() public {
        selectPolygonFork();
        (bytes memory bytecode, uint256[] memory constants) = POLYGON_PARSER_NPE2.parse(rainstringLimitOrder());
        (bytecode,constants); 
    }
}
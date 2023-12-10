// SPDX-License-Identifier: CAL
pragma solidity =0.8.19;

import {Test, console2} from "forge-std/Test.sol";
import "src/interface/IParserV1.sol";

import {
    rainstringBuy,
    rainstringSell,
    EXPECTED_SELL_BYTECODE,
    EXPECTED_BUY_BYTECODE
} from "src/4SushiV2StratBinomial.sol";

import {
    rainstringBuyLimitOrder,
    rainstringSellLimitOrder,
    EXPECTED_SELL_LIMIT_BYTECODE,
    EXPECTED_BUY_LIMIT_BYTECODE
} from "src/5SushiV2LimitOrder.sol"; 

/// @dev https://mumbai.polygonscan.com/address/0xDaAB45E4BCCEbcE8d84995E41CC251C6F9a92aFD
/// CI : https://github.com/rainlanguage/rain.interpreter/actions/runs/7156612121/job/19486513484
/// Commit Hash : https://github.com/rainlanguage/rain.interpreter/tree/32dc48b362630c9282ea1245fb0185449d90f67c
IParserV1 constant PARSER_NEW = IParserV1(0xDaAB45E4BCCEbcE8d84995E41CC251C6F9a92aFD);


contract TestForkParser is Test {
    string constant FORK_RPC = "https://rpc.ankr.com/polygon_mumbai";
    uint256 constant FORK_BLOCK_NUMBER = 43403339;

    function selectPolygonFork() internal {
        uint256 fork = vm.createFork(FORK_RPC);
        vm.selectFork(fork);
        vm.rollFork(FORK_BLOCK_NUMBER);
    }

    function testVolumeParsedBytecodes() public {
        selectPolygonFork(); 

        // Sell Vol Order
        (bytes memory sellBytecode,) = PARSER_NEW.parse(rainstringSell());
        assertEq(sellBytecode, EXPECTED_SELL_BYTECODE); 

        // Buy Vol Order
        (bytes memory buyBytecode,) = PARSER_NEW.parse(rainstringBuy());
        assertEq(buyBytecode, EXPECTED_BUY_BYTECODE);
    }

    function testLimitParsedBytecodes() public {
        selectPolygonFork(); 

        // Sell Limit Order
        (bytes memory sellBytecode,) = PARSER_NEW.parse(rainstringSellLimitOrder());
        assertEq(sellBytecode, EXPECTED_SELL_BYTECODE); 

        // Buy Limit Order
        (bytes memory buyBytecode,) = PARSER_NEW.parse(rainstringBuyLimitOrder());
        assertEq(buyBytecode, EXPECTED_BUY_BYTECODE);
    }
}

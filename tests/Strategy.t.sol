// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import "forge-std/Test.sol";
import "../contracts/foundry/Strategy.sol";
import "@rainprotocol/rain-protocol/contracts/orderbook/IOrderBookV1.sol" ; 
import "@rainprotocol/rain-protocol/contracts/test/testToken/ReserveToken18.sol" ;


contract StrategyTest is Test { 

    IOrderBookV1 orderBook_ ;   
    ReserveToken18 tokenA ; 
    ReserveToken18 tokenB ; 

    address deployer = address(0x1) ;
    address alice = address(0x2) ; 
    address bob = address(0x3) ; 


    function setUp() public {
        orderBook_ = IOrderBookV1(address(0xe54fE8eE088627365a07E3C3c8Ec21B202041Adf));
        tokenA = new ReserveToken18() ; 
        tokenB = new ReserveToken18() ;    
        vm.startPrank(deployer) ; 
        tokenA.initialize(); 
        tokenB.initialize(); 
        vm.stopPrank(); 
    }  

     function testDeposit() public {  
          uint256 vaultId = 123 ;
          uint256 amount = 123 ;   
          DepositConfig memory aliceDeposit = DepositConfig(address(tokenA), vaultId , amount) ; 
          vm.startPrank(alice) ; 
          tokenA.approve(address(orderBook_),amount) ; 
          orderBook_.deposit(aliceDeposit);
          uint256 aliceVaultBalance = orderBook_.vaultBalance(alice, address(tokenA), vaultId);
          assertEq(aliceVaultBalance , amount) ; 
          vm.stopPrank();
            
     }
    
}

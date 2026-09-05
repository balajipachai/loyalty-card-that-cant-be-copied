// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {LoyaltyCard} from "../src/LoyaltyCard.sol";

contract LoyaltyCardTest is Test {
    LoyaltyCard card;
    address owner = makeAddr("backendSigner");
    address customer = makeAddr("customer");
    address stranger = makeAddr("stranger");

    function setUp() public {
        card = new LoyaltyCard(owner);
    }

    function test_OwnerIsSetFromConstructor() public view {
        assertEq(card.owner(), owner);
    }

    function test_OnlyOwnerCanAwardStamp() public {
        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, stranger));
        card.awardStamp(customer);
    }

    function test_AwardStampRevertsOnZeroAddress() public {
        vm.prank(owner);
        vm.expectRevert(LoyaltyCard.ZeroAddressCustomer.selector);
        card.awardStamp(address(0));
    }

    function test_AwardStampIncrementsCount() public {
        vm.prank(owner);
        card.awardStamp(customer);
        assertEq(card.balanceOf(customer), 1);

        vm.prank(owner);
        card.awardStamp(customer);
        assertEq(card.balanceOf(customer), 2);
    }

    function test_AwardStampEmitsStampAwardedEvent() public {
        vm.expectEmit(true, false, false, true, address(card));
        emit LoyaltyCard.StampAwarded(customer, 1);

        vm.prank(owner);
        card.awardStamp(customer);
    }

    function test_TenthStampEarnsFreeCakeAndResetsCount() public {
        vm.startPrank(owner);
        for (uint8 i = 0; i < 9; i++) {
            card.awardStamp(customer);
        }
        assertEq(card.balanceOf(customer), 9);

        vm.expectEmit(true, false, false, true, address(card));
        emit LoyaltyCard.FreeCakeEarned(customer, 1);
        card.awardStamp(customer);
        vm.stopPrank();

        assertEq(card.balanceOf(customer), 0);
        assertEq(card.freeCakesEarned(customer), 1);
    }

    function test_MultipleFreeCakesAccumulateAcrossCycles() public {
        vm.startPrank(owner);
        for (uint8 cycle = 0; cycle < 2; cycle++) {
            for (uint8 i = 0; i < 10; i++) {
                card.awardStamp(customer);
            }
        }
        vm.stopPrank();

        assertEq(card.balanceOf(customer), 0);
        assertEq(card.freeCakesEarned(customer), 2);
    }

    function test_BalanceOfIsPerCustomer() public {
        vm.startPrank(owner);
        card.awardStamp(customer);
        card.awardStamp(customer);
        card.awardStamp(stranger);
        vm.stopPrank();

        assertEq(card.balanceOf(customer), 2);
        assertEq(card.balanceOf(stranger), 1);
    }

    function test_TransferOwnershipRequiresAcceptanceFromNewOwner() public {
        address newSigner = makeAddr("newSigner");

        vm.prank(owner);
        card.transferOwnership(newSigner);

        // Ownership hasn't actually moved yet - awardStamp still only works
        // for the old owner until the new one calls acceptOwnership().
        assertEq(card.owner(), owner);
        assertEq(card.pendingOwner(), newSigner);

        vm.prank(owner);
        card.awardStamp(customer);
        assertEq(card.balanceOf(customer), 1);

        vm.prank(newSigner);
        card.acceptOwnership();

        assertEq(card.owner(), newSigner);
        vm.prank(owner);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, owner));
        card.awardStamp(customer);
    }

    function test_TransferOwnershipRejectsAcceptFromWrongAddress() public {
        address newSigner = makeAddr("newSigner");

        vm.prank(owner);
        card.transferOwnership(newSigner);

        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, stranger));
        card.acceptOwnership();

        assertEq(card.owner(), owner);
    }

    function test_OnlyOwnerCanSetStampsForFreeCake() public {
        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, stranger));
        card.setStampsForFreeCake(5);
    }

    function test_SetStampsForFreeCakeRevertsOnZero() public {
        vm.prank(owner);
        vm.expectRevert(LoyaltyCard.InvalidStampsForFreeCake.selector);
        card.setStampsForFreeCake(0);
    }

    function test_SetStampsForFreeCakeEmitsEventAndChangesThreshold() public {
        vm.expectEmit(false, false, false, true, address(card));
        emit LoyaltyCard.StampsForFreeCakeUpdated(10, 3);

        vm.prank(owner);
        card.setStampsForFreeCake(3);
        assertEq(card.stampsForFreeCake(), 3);

        vm.startPrank(owner);
        card.awardStamp(customer);
        card.awardStamp(customer);
        assertEq(card.balanceOf(customer), 2);

        card.awardStamp(customer);
        vm.stopPrank();

        assertEq(card.balanceOf(customer), 0);
        assertEq(card.freeCakesEarned(customer), 1);
    }

    function test_LoweringThresholdBelowInProgressCountRedeemsOnNextStamp() public {
        vm.startPrank(owner);
        for (uint8 i = 0; i < 8; i++) {
            card.awardStamp(customer);
        }
        assertEq(card.balanceOf(customer), 8);

        // Lowered below the customer's current progress - without the >=
        // check in awardStamp, this customer could never hit the threshold
        // exactly again and would be stuck past it forever.
        card.setStampsForFreeCake(5);

        card.awardStamp(customer);
        vm.stopPrank();

        assertEq(card.balanceOf(customer), 0);
        assertEq(card.freeCakesEarned(customer), 1);
    }
}

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {LoyaltyCard} from "../src/LoyaltyCard.sol";

/// @notice Deploys LoyaltyCard to Base Sepolia (chain id 84532), owned by the
/// backend signer that will call awardStamp() after verifying Privy tokens.
/// Run with a keystore account, never a raw private key on disk:
///   forge script script/Deploy.s.sol --rpc-url base_sepolia --account backend-signer --broadcast --verify
contract DeployLoyaltyCard is Script {
    function run() external returns (LoyaltyCard card) {
        address owner = msg.sender;

        vm.startBroadcast();
        card = new LoyaltyCard(owner);
        vm.stopBroadcast();

        console.log("LoyaltyCard deployed at:", address(card));
        console.log("Owner (backend signer):", owner);
    }
}
